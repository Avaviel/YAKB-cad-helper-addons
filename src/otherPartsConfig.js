// Scans src/stamps/*.json at build time (non-recursive — ignores subfolders
// such as "stamps tools") and builds the Other plate parts config.
// Stamp conversion tools live under stamps/stamps tools/ and must not be imported.

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
        description: `Stamp pattern from ${filename} (includes registration marks on CONSTRUCTION)`,
        file: `stamps/${filename}`,
        defaultEnabled: false,
        layerName,
        // Parsed JSON content bundled at build time
        stampData: stampContext(key),
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
}

const registrationEntry = {
  id: 'registration',
  label: 'Registration Marks',
  description: 'Alignment X at (-100, -100) only — also auto-included on every stamp export',
  type: 'generated',
  generator: 'registrationX',
  defaultEnabled: true,
  layerName: 'CONSTRUCTION',
}

/** All other-plate-part entries: scanned stamps + built-in registration mark. */
export const otherPartsConfig = [
  ...loadStampEntries(),
  registrationEntry,
]

/** Initial enabled map from defaultEnabled flags. */
export function getDefaultEnabledParts() {
  const enabled = {}
  for (const part of otherPartsConfig) {
    enabled[part.id] = !!part.defaultEnabled
  }
  return enabled
}
