// Scans src/stamps/*.json at build time (non-recursive — ignores subfolders
// such as "stamps tools") and builds stamp catalogs for the other-parts UI.
// Stamp conversion tools live under stamps/stamps tools/ and must not be imported.
// Registration is never a UI option (it is embedded in CAD exports only).
//
// Mirror option (App → Other plate parts → Mirror stamps):
//   Left-right flips stamp geometry only. Registration marks stay at absolute X/Y.
// FUTURE — Kailh Choc: when Choc stamps / hotswap variants are added, wire them
// through the same switchFamilies + fits model AND keep the mirrorStamps option
// (Choc will need the same left-right flip control as MX).

function filenameToId(filename) {
  return filename
    .replace(/\.json$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function filenameToLabel(filename) {
  const base = filename.replace(/\.json$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  return base
    .split(' ')
    .map(word => {
      if (word.length <= 3 && word === word.toUpperCase()) {
        return word
      }
      if (/^[A-Z0-9]+-/.test(word) || word.includes('-')) {
        return word
      }
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

function filenameToLayerName(filename) {
  return filename
    .replace(/\.json$/i, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function loadStampMap() {
  // false = do not recurse into subdirectories (e.g. "stamps tools")
  const stampContext = require.context('./stamps', false, /\.json$/)
  const map = {}

  for (const key of stampContext.keys()) {
    const filename = key.replace(/^\.\//, '')
    const id = filenameToId(filename)
    map[id] = {
      id,
      label: filenameToLabel(filename),
      description: `Stamp pattern from ${filename}`,
      file: `stamps/${filename}`,
      layerName: filenameToLayerName(filename),
      stampData: stampContext(key),
      type: 'stamp',
    }
  }

  return map
}

const stampMap = loadStampMap()

function stampOrNull(id, labelOverride, descriptionOverride) {
  const stamp = stampMap[id]
  if (!stamp) {
    return null
  }
  return {
    ...stamp,
    label: labelOverride || stamp.label,
    description: descriptionOverride || stamp.description,
  }
}

/**
 * Switch families available in the other-parts selector.
 * Always-on stamps (back cut, hole cuts, switchplace extrude) export for every family.
 * Hotswap fit chooses which MX hotswap stamp is included.
 *
 * FUTURE — Kailh Choc: add a family entry with fits + hotswapStampId values, and ensure
 * the UI Mirror stamps toggle still applies (same generatorOptions.mirrorStamps path).
 * Registration must remain non-mirrored for Choc stamps as well.
 */
export const switchFamilies = [
  {
    id: 'mx',
    label: '★ MX',
    description: 'Cherry MX–compatible hotswap and plate helper stamps',
    cutoutType: 'mx-basic',
    includeDots: true,
    holeCutsStampId: 'hole-cuts',
    backCutGenerated: true,
    defaultBackCutBump: 2,
    fits: [
      {
        id: 'betterfit',
        label: 'Better fit',
        hotswapStampId: 'mx-hotswap-betterfit',
        hotswapLayerName: 'Link-MX_HOTSWAP_BF',
        hotswapNoteId: 'Link-MX_HOTSWAP',
      },
      {
        id: 'tight',
        label: 'Tight',
        hotswapStampId: 'mx-hotswap-tight',
        hotswapLayerName: 'Link-MX_HOTSWAP_TIGHT',
        hotswapNoteId: 'Link-MX_HOTSWAP',
      },
    ],
    defaultFitId: 'betterfit',
    defaultUnitWidth: 19.05,
    defaultUnitHeight: 19.05,
    supportsMirror: true,
  },
  {
    id: 'choc',
    label: '★ Kailh Choc PG1350',
    description: 'Kailh Choc PG1350 (Choc v1) hotswap and plate helper stamps',
    cutoutType: 'choc-cpg1350',
    includeDots: false,
    holeCutsStampId: 'choc-hole-cuts',
    backCutGenerated: true,
    defaultBackCutBump: 0,
    fits: [
      {
        id: 'standard',
        label: 'Standard',
        hotswapStampId: 'choc-hotswap',
        hotswapLayerName: 'Link-CHOC_HOTSWAP',
        hotswapNoteId: 'Link-CHOC_HOTSWAP',
      },
    ],
    defaultFitId: 'standard',
    defaultUnitWidth: 18,
    defaultUnitHeight: 17,
    supportsMirror: true,
  },
]

export const chocSpacingPresets = [
  { id: '18x17', label: '18 × 17 mm (standard)', width: 18, height: 17 },
  { id: '18x18', label: '18 × 18 mm', width: 18, height: 18 },
  { id: '17x17', label: '17 × 17 mm', width: 17, height: 17 },
  { id: '19.05', label: '19.05 × 19.05 mm (MX grid)', width: 19.05, height: 19.05 },
]

export const supportedCutoutTypes = ['mx-basic', 'choc-cpg1350']

export function familyForCutoutType(cutoutType) {
  return switchFamilies.find(f => f.cutoutType === cutoutType) || null
}

/**
 * Single multi-layer export: all geometry in one DXF/SVG, different layer names.
 *
 * Top-*  = primary / switch-plate related
 * Link-* = secondary plate (named "Link" so it can be MX now, Choc later)
 *
 * Layers:
 *   Top-SWITCH_PLATE  — switch/stab/acoustic cutouts + the Top outline
 *   Top-BACK_CUT      — back-cut stamp (Top part)
 *   Top-Dots          — switchplace / dots stamp
 *   Link-HOLE_CUTS    — hole stamps + the Link outline
 *   Link-MX_HOTSWAP_* — selected hotswap fit
 *   Shell             — inner/outer case outline
 *   Keys              — 1U / 2U key rectangles + combined mass (drawing 3.2)
 *
 * FUTURE — Kailh Choc: add Link-CHOC_* (or similar) layers; keep Top-* + one download.
 */
export function getExportAssembly(switchFamilyId, fitId, options = {}) {
  const family = switchFamilies.find(f => f.id === switchFamilyId) || switchFamilies[0]
  const fit = (family?.fits || []).find(f => f.id === fitId)
    || (family?.fits || []).find(f => f.id === family?.defaultFitId)
    || (family?.fits || [])[0]

  const switchplace = family.includeDots === false || options.includeDots === false
    ? null
    : stampOrNull(
      'switchplace-extrude',
      'Top Dots',
      'Switchplace / dots stamp (Top-Dots layer)'
    )
  const holeCuts = stampOrNull(family.holeCutsStampId || 'hole-cuts', 'Hole cuts', 'Hole cut stamp')
  const hotswapLayer = fit?.hotswapLayerName || 'Link-MX_HOTSWAP'
  const hotswapNoteId = fit?.hotswapNoteId || hotswapLayer
  const hotswap = fit?.hotswapStampId
    ? stampOrNull(
      fit.hotswapStampId,
      `Hotswap (${fit.label})`,
      `Hotswap socket — ${fit.label.toLowerCase()} clearance`
    )
    : null

  const stamps = [
    { type: 'backcut', modelKey: 'TopBackCut', layerName: 'Top-BACK_CUT', noteId: 'Top-BACK_CUT', hasOutline: false },
    switchplace && { ...switchplace, modelKey: 'TopDots', layerName: 'Top-Dots', noteId: 'Top-Dots', hasOutline: false },
    holeCuts && { ...holeCuts, modelKey: 'LinkHoleCuts', layerName: 'Link-HOLE_CUTS', noteId: 'Link-HOLE_CUTS', hasOutline: true },
    hotswap && { ...hotswap, modelKey: 'LinkHotswap', layerName: hotswapLayer, noteId: hotswapNoteId, hasOutline: false },
  ].filter(Boolean)

  const layerList = [
    'Top-SWITCH_PLATE',
    'Top-BACK_CUT',
    switchplace ? 'Top-Dots' : null,
    'Link-HOLE_CUTS',
    hotswapLayer,
    'Shell',
    'Keys',
  ].filter(Boolean)

  return {
    id: 'FullExport',
    label: 'Plate export',
    description: 'All drawings in one multi-layer DXF/SVG (Top + Link + Shell + Keys)',
    includeMainPlate: true,
    mainPlateLayerName: 'Top-SWITCH_PLATE',
    stamps,
    layerSummary: layerList.join(' · '),
    layerGroups: [
      {
        group: 'Top',
        layers: [
          { id: 'Top-SWITCH_PLATE', layerName: 'Top-SWITCH_PLATE', label: 'Top-SWITCH_PLATE', outlineKind: 'plate' },
          { id: 'Top-BACK_CUT', layerName: 'Top-BACK_CUT', label: 'Top-BACK_CUT', outlineKind: 'backcut' },
          switchplace ? { id: 'Top-Dots', layerName: 'Top-Dots', label: 'Top-Dots', outlineKind: 'dots' } : null,
        ].filter(Boolean),
      },
      {
        group: 'Link',
        layers: [
          { id: 'Link-HOLE_CUTS', layerName: 'Link-HOLE_CUTS', label: 'Link-HOLE_CUTS', outlineKind: 'plate' },
          { id: hotswapNoteId, layerName: hotswapLayer, label: hotswapLayer },
        ],
      },
      {
        group: 'Shell',
        layers: [
          { id: 'Shell', layerName: 'Shell', label: 'Shell', outlineKind: 'shell' },
        ],
      },
      {
        group: 'Keys',
        layers: [
          { id: 'Keys', layerName: 'Keys', label: 'Keys', outlineKind: 'keys' },
        ],
      },
    ],
  }
}

export const defaultShellFromPlate = 0.5
export const defaultShellFromSelf = 5

const LAYER_FEATURE_DEFAULTS = {
  "Top-SWITCH_PLATE": { op: "extrude", opMm: 3 },
  "Top-Dots": { op: "extrude", opMm: 1.8 },
}

export function layerFeatureDefault(id) {
  return LAYER_FEATURE_DEFAULTS[id] || { op: "cut", opMm: "" }
}

/** @deprecated use getExportAssembly — kept as thin wrapper for callers */
export function getExportAssemblies(switchFamilyId, fitId, options) {
  return [getExportAssembly(switchFamilyId, fitId, options)]
}

/** Short summary of layers for UI helper text. */
export function getExportSummary(switchFamilyId, fitId, options) {
  return getExportAssembly(switchFamilyId, fitId, options)?.layerSummary || '—'
}

export const defaultSwitchFamilyId = switchFamilies[0]?.id || 'mx'
export const defaultFitId = switchFamilies[0]?.defaultFitId || 'betterfit'
