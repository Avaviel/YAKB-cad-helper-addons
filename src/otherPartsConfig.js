// Scans src/stamps/*.json at build time (non-recursive — ignores subfolders
// such as "stamps tools") and builds stamp catalogs for the other-parts UI.
// Stamp conversion tools live under stamps/stamps tools/ and must not be imported.
// Registration is never a UI option (it is embedded in CAD exports only).

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
  },
  // Placeholder for future Kailh Choc support (not selectable until stamps exist)
  // {
  //   id: 'choc',
  //   label: 'Kailh Choc',
  //   description: 'Coming later',
  //   fits: [],
  //   defaultFitId: null,
  //   disabled: true,
  // },
]

/** Shared stamps always exported for 3D-print hotswap workflows. */
const ALWAYS_STAMP_SPECS = [
  {
    id: 'back-cut',
    label: 'Back cut',
    description: 'Back-side cut stamp (always included)',
  },
  {
    id: 'hole-cuts',
    label: 'Hole cuts',
    description: 'Hole cut stamp (always included)',
  },
  {
    id: 'switchplace-extrude',
    label: 'Switchplace extrude',
    description: 'Switch placement / extrude stamp (always included)',
  },
]

/**
 * Resolve the list of stamp parts to generate for the current switch family + fit.
 * Order: hotswap (selected fit), then always-on stamps.
 */
export function getPartsForSelection(switchFamilyId, fitId) {
  const family = switchFamilies.find(f => f.id === switchFamilyId) || switchFamilies[0]
  if (!family) {
    return []
  }

  const fit = (family.fits || []).find(f => f.id === fitId)
    || (family.fits || []).find(f => f.id === family.defaultFitId)
    || (family.fits || [])[0]

  const parts = []

  if (fit && fit.hotswapStampId) {
    const hotswap = stampOrNull(
      fit.hotswapStampId,
      `MX Hotswap (${fit.label})`,
      `Hotswap socket stamp — ${fit.label.toLowerCase()} clearance`
    )
    if (hotswap) {
      parts.push(hotswap)
    }
  }

  for (const spec of ALWAYS_STAMP_SPECS) {
    const stamp = stampOrNull(spec.id, spec.label, spec.description)
    if (stamp) {
      parts.push(stamp)
    }
  }

  return parts
}

export const defaultSwitchFamilyId = switchFamilies[0]?.id || 'mx'
export const defaultFitId = switchFamilies[0]?.defaultFitId || 'betterfit'
