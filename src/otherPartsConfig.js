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
      },
      {
        id: 'tight',
        label: 'Tight',
        hotswapStampId: 'mx-hotswap-tight',
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
  //   description: 'Coming later — enable supportsMirror + fits when stamps land',
  //   fits: [],
  //   defaultFitId: null,
  //   disabled: true,
  //   supportsMirror: true, // REQUIRED when Choc is enabled
  // },
]

/**
 * Multi-layer export assemblies for the 3D-print workflow.
 *
 * SwitchPlate = original switch cutouts + back cut + switchplace extrude
 * MXPlate     = selected MX hotswap stamp + hole cuts
 *
 * FUTURE — Kailh Choc: add a ChocPlate (or rename MXPlate generically) assembly
 * with Choc hotswap + related stamps; keep SwitchPlate structure.
 */
export function getExportAssemblies(switchFamilyId, fitId) {
  const family = switchFamilies.find(f => f.id === switchFamilyId) || switchFamilies[0]
  const fit = (family?.fits || []).find(f => f.id === fitId)
    || (family?.fits || []).find(f => f.id === family?.defaultFitId)
    || (family?.fits || [])[0]

  const backCut = stampOrNull('back-cut', 'Back cut', 'Back-side cut stamp')
  const switchplace = stampOrNull(
    'switchplace-extrude',
    'Switchplace extrude',
    'Switch placement / extrude stamp'
  )
  const holeCuts = stampOrNull('hole-cuts', 'Hole cuts', 'Hole cut stamp')
  const hotswap = fit?.hotswapStampId
    ? stampOrNull(
      fit.hotswapStampId,
      `MX Hotswap (${fit.label})`,
      `Hotswap socket — ${fit.label.toLowerCase()} clearance`
    )
    : null

  const assemblies = []

  // Part 1: Switch Plate (main cutouts + back cut + switchplace extrude)
  assemblies.push({
    id: 'SwitchPlate',
    label: 'Switch Plate',
    description: 'Main switch cutouts, back cut, and switchplace extrude (multi-layer DXF)',
    includeMainPlate: true,
    mainPlateLayerName: 'SWITCH_PLATE',
    stamps: [
      backCut && { ...backCut, modelKey: 'BackCut', layerName: 'BACK_CUT' },
      switchplace && { ...switchplace, modelKey: 'SwitchplaceExtrude', layerName: 'SWITCHPLACE_EXTRUDE' },
    ].filter(Boolean),
    layerSummary: 'SWITCH_PLATE · BACK_CUT · SWITCHPLACE_EXTRUDE · CONSTRUCTION',
  })

  // Part 2: MX Plate (hotswap + hole cuts) — rename path when Choc lands
  assemblies.push({
    id: 'MXPlate',
    label: 'MX Plate',
    description: `Hotswap (${fit?.label || 'fit'}) and hole cuts (multi-layer DXF)`,
    includeMainPlate: false,
    stamps: [
      hotswap && { ...hotswap, modelKey: 'MXHotswap', layerName: hotswap.layerName || 'MX_HOTSWAP' },
      holeCuts && { ...holeCuts, modelKey: 'HoleCuts', layerName: 'HOLE_CUTS' },
    ].filter(Boolean),
    layerSummary: `${hotswap?.layerName || 'HOTSWAP'} · HOLE_CUTS · CONSTRUCTION`,
  })

  return assemblies
}

/** Short summary of what will be exported (for UI helper text). */
export function getExportSummary(switchFamilyId, fitId) {
  return getExportAssemblies(switchFamilyId, fitId)
    .map(a => a.label)
    .join(' · ')
}

export const defaultSwitchFamilyId = switchFamilies[0]?.id || 'mx'
export const defaultFitId = switchFamilies[0]?.defaultFitId || 'betterfit'
