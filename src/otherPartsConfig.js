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
    label: 'MX',
    description: 'Cherry MX–compatible hotswap and plate helper stamps',
    // Fit options map to hotswap stamp files
    fits: [
      {
        id: 'betterfit',
        label: 'Better fit',
        hotswapStampId: 'mx-hotswap-betterfit',
        // DXF layer for the Link (secondary) plate hotswap geometry
        hotswapLayerName: 'Link-MX_HOTSWAP_BF',
      },
      {
        id: 'tight',
        label: 'Tight',
        hotswapStampId: 'mx-hotswap-tight',
        hotswapLayerName: 'Link-MX_HOTSWAP_TIGHT',
      },
    ],
    defaultFitId: 'betterfit',
    // Stamps that were authored reversed and corrected in JSON; mirror toggle still useful
    supportsMirror: true,
  },
  // Placeholder for future Kailh Choc support (not selectable until stamps exist)
  // {
  //   id: 'choc',
  //   label: 'Kailh Choc',
  //   description: 'Coming later — Link-* layers for Choc hotswap + related stamps',
  //   fits: [],
  //   defaultFitId: null,
  //   disabled: true,
  //   supportsMirror: true, // REQUIRED when Choc is enabled
  // },
]

/**
 * Single multi-layer export: all geometry in one DXF/SVG, different layer names.
 *
 * Top-*  = primary / switch-plate related
 * Link-* = secondary plate (named "Link" so it can be MX now, Choc later)
 *
 * Layers:
 *   Top-SWITCH_PLATE  — switch/stab/acoustic cutouts + the Top outline
 *   Top-Dots          — switchplace / dots stamp
 *   Top-BACK_CUT      — back-cut stamp (Top part)
 *   Link-HOLE_CUTS    — hole stamps + the Link outline
 *   Link-MX_HOTSWAP_* — selected hotswap fit
 *   Shell             — inner/outer case outline
 *
 * FUTURE — Kailh Choc: add Link-CHOC_* (or similar) layers; keep Top-* + one download.
 */
export function getExportAssembly(switchFamilyId, fitId) {
  const family = switchFamilies.find(f => f.id === switchFamilyId) || switchFamilies[0]
  const fit = (family?.fits || []).find(f => f.id === fitId)
    || (family?.fits || []).find(f => f.id === family?.defaultFitId)
    || (family?.fits || [])[0]

  const backCut = stampOrNull('back-cut', 'Back cut', 'Back-side cut stamp')
  const switchplace = stampOrNull(
    'switchplace-extrude',
    'Top Dots',
    'Switchplace / dots stamp (Top-Dots layer)'
  )
  const holeCuts = stampOrNull('hole-cuts', 'Hole cuts', 'Hole cut stamp')
  const hotswapLayer = fit?.hotswapLayerName || 'Link-MX_HOTSWAP'
  const hotswap = fit?.hotswapStampId
    ? stampOrNull(
      fit.hotswapStampId,
      `Hotswap (${fit.label})`,
      `Hotswap socket — ${fit.label.toLowerCase()} clearance`
    )
    : null

  const stamps = [
    switchplace && { ...switchplace, modelKey: 'TopDots', layerName: 'Top-Dots', noteId: 'Top-Dots', hasOutline: false },
    backCut && { ...backCut, modelKey: 'TopBackCut', layerName: 'Top-BACK_CUT', noteId: 'Top-BACK_CUT', hasOutline: false },
    holeCuts && { ...holeCuts, modelKey: 'LinkHoleCuts', layerName: 'Link-HOLE_CUTS', noteId: 'Link-HOLE_CUTS', hasOutline: true },
    hotswap && { ...hotswap, modelKey: 'LinkHotswap', layerName: hotswapLayer, noteId: 'Link-MX_HOTSWAP', hasOutline: false },
  ].filter(Boolean)

  const layerList = [
    'Top-SWITCH_PLATE',
    'Top-Dots',
    'Top-BACK_CUT',
    'Link-HOLE_CUTS',
    hotswapLayer,
    'Shell',
  ]

  return {
    id: 'FullExport',
    label: 'Plate export',
    description: 'All drawings in one multi-layer DXF/SVG (Top + Link + Shell)',
    includeMainPlate: true,
    mainPlateLayerName: 'Top-SWITCH_PLATE',
    stamps,
    layerSummary: layerList.join(' · '),
    layerGroups: [
      {
        group: 'Top',
        layers: [
          { id: 'Top-SWITCH_PLATE', layerName: 'Top-SWITCH_PLATE', label: 'Top-SWITCH_PLATE', outlineKind: 'plate' },
          { id: 'Top-Dots', layerName: 'Top-Dots', label: 'Top-Dots' },
          { id: 'Top-BACK_CUT', layerName: 'Top-BACK_CUT', label: 'Top-BACK_CUT' },
        ],
      },
      {
        group: 'Link',
        layers: [
          { id: 'Link-HOLE_CUTS', layerName: 'Link-HOLE_CUTS', label: 'Link-HOLE_CUTS', outlineKind: 'plate' },
          { id: 'Link-MX_HOTSWAP', layerName: hotswapLayer, label: hotswapLayer },
        ],
      },
      {
        group: 'Shell',
        layers: [
          { id: 'Shell', layerName: 'Shell', label: 'Shell', outlineKind: 'shell' },
        ],
      },
    ],
  }
}

export const defaultShellFromPlate = 0.5
export const defaultShellFromSelf = 5

/** @deprecated use getExportAssembly — kept as thin wrapper for callers */
export function getExportAssemblies(switchFamilyId, fitId) {
  return [getExportAssembly(switchFamilyId, fitId)]
}

/** Short summary of layers for UI helper text. */
export function getExportSummary(switchFamilyId, fitId) {
  return getExportAssembly(switchFamilyId, fitId)?.layerSummary || '—'
}

export const defaultSwitchFamilyId = switchFamilies[0]?.id || 'mx'
export const defaultFitId = switchFamilies[0]?.defaultFitId || 'betterfit'
