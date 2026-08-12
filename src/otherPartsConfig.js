// Scans src/stamps/*.json at build time (non-recursive — ignores subfolders
// such as "stamps tools") and builds the Other plate parts config.
// Stamp conversion tools live under stamps/stamps tools/ and must not be imported.

/** Stamp ids that are shown as one MX Hotswap control with a fit dropdown. */
const MX_HOTSWAP_VARIANT_IDS = ['mx-hotswap-tight', 'mx-hotswap-betterfit']

const MX_HOTSWAP_VARIANT_LABELS = {
  'mx-hotswap-tight': 'Tight',
  'mx-hotswap-betterfit': 'Better fit',
}

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

function loadStampEntries() {
  // false = do not recurse into subdirectories (e.g. "stamps tools")
  const stampContext = require.context('./stamps', false, /\.json$/)

  return stampContext.keys()
    .map(key => {
      const filename = key.replace(/^\.\//, '')
      const id = filenameToId(filename)
      const label = filenameToLabel(filename)
      const layerName = filenameToLayerName(filename)

      return {
        id,
        label,
        description: `Stamp pattern from ${filename}`,
        file: `stamps/${filename}`,
        defaultEnabled: false,
        layerName,
        // Parsed JSON content bundled at build time
        stampData: stampContext(key),
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
}

/**
 * UI-facing other-parts list:
 * - MX hotswap tight / better-fit are merged into one entry with variants
 * - Registration is not listed (still embedded in plate + stamp CAD exports)
 */
function buildOtherPartsConfig() {
  const stamps = loadStampEntries()
  const hotswapStamps = MX_HOTSWAP_VARIANT_IDS
    .map(id => stamps.find(s => s.id === id))
    .filter(Boolean)
  const otherStamps = stamps.filter(s => !MX_HOTSWAP_VARIANT_IDS.includes(s.id))

  const parts = []

  if (hotswapStamps.length > 0) {
    const variants = hotswapStamps.map(stamp => ({
      id: stamp.id,
      label: MX_HOTSWAP_VARIANT_LABELS[stamp.id] || stamp.label,
      layerName: stamp.layerName,
      stampData: stamp.stampData,
      file: stamp.file,
    }))

    parts.push({
      id: 'mx-hotswap',
      label: 'MX Hotswap',
      description: 'Hotswap socket stamp for 3D-printed plates — choose tight or better-fit clearance',
      type: 'variant-group',
      defaultEnabled: false,
      // Default fit when the checkbox is turned on
      defaultVariantId: variants.find(v => v.id === 'mx-hotswap-betterfit')?.id || variants[0].id,
      variants,
      // Layer / stamp resolved from selected variant at generate time
      layerName: variants[0].layerName,
    })
  }

  for (const stamp of otherStamps) {
    parts.push({
      ...stamp,
      type: 'stamp',
    })
  }

  return parts
}

/** Other plate parts shown in the UI (no standalone registration entry). */
export const otherPartsConfig = buildOtherPartsConfig()

/** Initial enabled map from defaultEnabled flags. */
export function getDefaultEnabledParts() {
  const enabled = {}
  for (const part of otherPartsConfig) {
    enabled[part.id] = !!part.defaultEnabled
  }
  return enabled
}

/**
 * Resolve a UI config entry + optional selected variant id into a buildable part
 * (with stampData / layerName filled in).
 */
export function resolveOtherPartForBuild(partConfig, selectedVariantId) {
  if (!partConfig) {
    return null
  }

  if (partConfig.type === 'variant-group') {
    const variantId = selectedVariantId
      || partConfig.defaultVariantId
      || (partConfig.variants && partConfig.variants[0] && partConfig.variants[0].id)
    const variant = (partConfig.variants || []).find(v => v.id === variantId)
      || (partConfig.variants || [])[0]
    if (!variant) {
      return null
    }
    return {
      id: partConfig.id,
      label: `${partConfig.label} (${variant.label})`,
      description: partConfig.description,
      layerName: variant.layerName,
      stampData: variant.stampData,
      file: variant.file,
      type: 'stamp',
      variantId: variant.id,
      variantLabel: variant.label,
    }
  }

  return partConfig
}
