import makerjs from 'makerjs'
import Decimal from 'decimal.js'

/**
 * Convert a stamp JSON document into a maker.js model.
 * Arc angles in stamp files are stored in radians (from dxf-parser) and
 * must be converted to degrees for maker.js.
 */
export function stampJsonToModel(stampData, layerName) {
  if (!stampData || !stampData.paths) {
    throw new Error('Invalid stamp data: missing paths')
  }

  const paths = {}

  for (const [name, pathDef] of Object.entries(stampData.paths)) {
    let path = null

    if (pathDef.type === 'line') {
      path = new makerjs.paths.Line(pathDef.origin, pathDef.end)
    } else if (pathDef.type === 'circle') {
      path = new makerjs.paths.Circle(pathDef.origin, pathDef.radius)
    } else if (pathDef.type === 'arc') {
      // Stamp converter stores angles in radians; maker.js uses degrees
      const startDeg = (pathDef.startAngle * 180) / Math.PI
      const endDeg = (pathDef.endAngle * 180) / Math.PI
      path = new makerjs.paths.Arc(pathDef.origin, pathDef.radius, startDeg, endDeg)
    } else {
      console.warn(`Unsupported stamp path type "${pathDef.type}" on "${name}", skipping`)
      continue
    }

    path.layer = layerName
    paths[name] = path
  }

  return {
    paths,
    layer: layerName,
  }
}

/**
 * Simple registration X (two crossed lines).
 * Center defaults to (-100, -100); pass x/y in millimeters to relocate.
 */
export function buildRegistrationMark(layerName = 'CONSTRUCTION', x = -100, y = -100) {
  const cx = Number(x)
  const cy = Number(y)
  const half = 5

  const safeX = Number.isFinite(cx) ? cx : -100
  const safeY = Number.isFinite(cy) ? cy : -100

  const line1 = new makerjs.paths.Line([safeX - half, safeY - half], [safeX + half, safeY + half])
  const line2 = new makerjs.paths.Line([safeX - half, safeY + half], [safeX + half, safeY - half])
  line1.layer = layerName
  line2.layer = layerName

  return {
    paths: {
      registrationX1: line1,
      registrationX2: line2,
    },
    layer: layerName,
  }
}

/** Read registration center from generatorOptions (mm), with defaults. */
export function getRegistrationCenter(generatorOptions) {
  const xRaw = generatorOptions?.registrationX
  const yRaw = generatorOptions?.registrationY
  const x = xRaw instanceof Decimal ? xRaw.toNumber() : Number(xRaw)
  const y = yRaw instanceof Decimal ? yRaw.toNumber() : Number(yRaw)
  return {
    x: Number.isFinite(x) ? x : -100,
    y: Number.isFinite(y) ? y : -100,
  }
}

/**
 * Recursively assign a layer name to a model and all nested paths/models.
 */
function applyLayer(model, layerName) {
  if (!model) {
    return model
  }

  model.layer = layerName

  if (model.paths) {
    for (const path of Object.values(model.paths)) {
      if (path) {
        path.layer = layerName
      }
    }
  }

  if (model.models) {
    for (const child of Object.values(model.models)) {
      applyLayer(child, layerName)
    }
  }

  return model
}

/**
 * Build a stamp part by placing the stamp template at every key center,
 * using the same origin / rotation logic as switch cutouts in PlateBuilder.
 *
 * @param {boolean} includeRegistration - when false, omit CONSTRUCTION marks
 *   (used when assembling multi-layer part files that share one registration set)
 *
 * Optional generatorOptions.mirrorStamps: left-right mirror of stamp geometry only.
 * Registration marks are NEVER mirrored.
 *
 * FUTURE (Kailh Choc): same mirrorStamps + non-mirrored registration rules.
 */
export function buildStampPart(stampData, keysArray, generatorOptions, layerName, includeRegistration = true) {
  let template = stampJsonToModel(stampData, layerName)

  // Left-right flip of the stamp pattern (not registration)
  if (generatorOptions && generatorOptions.mirrorStamps) {
    template = makerjs.model.mirror(template, true, false)
    applyLayer(template, layerName)
  }

  const canvas = { models: {} }
  let id = 0

  const unitWidth = generatorOptions.unitWidth instanceof Decimal
    ? generatorOptions.unitWidth
    : new Decimal(generatorOptions.unitWidth)
  const unitHeight = generatorOptions.unitHeight instanceof Decimal
    ? generatorOptions.unitHeight
    : new Decimal(generatorOptions.unitHeight)

  for (const key of keysArray) {
    const origin = {
      x: key.centerX.times(unitWidth),
      y: key.centerY.times(unitHeight),
    }
    const originNum = [origin.x.toNumber(), origin.y.times(-1).toNumber()]

    // Match switch cutout placement: rotate by -(angle + independentSwitchAngle), then set origin
    let instance = makerjs.model.clone(template)
    instance = makerjs.model.rotate(
      instance,
      key.angle.plus(key.independentSwitchAngle).times(-1).toNumber()
    )
    instance.origin = originNum
    applyLayer(instance, layerName)

    canvas.models['Stamp' + id.toString()] = instance
    id += 1
  }

  // Stamp geometry on its own layer…
  applyLayer(canvas, layerName)

  if (includeRegistration) {
    const reg = getRegistrationCenter(generatorOptions)
    canvas.models.Registration = buildRegistrationMark('CONSTRUCTION', reg.x, reg.y)
  }

  return canvas
}

/**
 * Build an other-part model from a config entry.
 * Returns null if the part cannot be built yet (e.g. stamp with no keys).
 */
export function buildOtherPart(partConfig, keysArray, generatorOptions) {
  if (partConfig.type === 'generated') {
    if (partConfig.generator === 'registrationX') {
      const reg = getRegistrationCenter(generatorOptions)
      return buildRegistrationMark(partConfig.layerName || 'CONSTRUCTION', reg.x, reg.y)
    }
    throw new Error(`Unknown generated part generator: ${partConfig.generator}`)
  }

  // Stamp file entry
  if (!keysArray || keysArray.length === 0) {
    return null
  }

  if (!partConfig.stampData) {
    throw new Error(`Stamp part "${partConfig.id}" has no stampData`)
  }

  return buildStampPart(
    partConfig.stampData,
    keysArray,
    generatorOptions,
    partConfig.layerName,
    true
  )
}

/**
 * Strip registration sub-models so assemblies can share a single CONSTRUCTION mark.
 */
function stripRegistration(model) {
  if (!model) {
    return model
  }
  const clone = makerjs.model.clone(model)
  if (clone.models && clone.models.Registration) {
    delete clone.models.Registration
  }
  return clone
}

/**
 * Build a multi-layer export assembly (e.g. SwitchPlate or MXPlate).
 * @param {object} assembly - from getExportAssemblies()
 * @param {Array} keysArray - parsed KLE keys
 * @param {object} generatorOptions
 * @param {object|null} mainPlateModel - buildPlate() result when includeMainPlate
 */
export function buildExportAssembly(assembly, keysArray, generatorOptions, mainPlateModel) {
  if (!keysArray || keysArray.length === 0) {
    return null
  }

  const canvas = { models: {} }

  if (assembly.includeMainPlate) {
    if (!mainPlateModel) {
      return null
    }
    const plate = stripRegistration(mainPlateModel)
    applyLayer(plate, assembly.mainPlateLayerName || 'SWITCH_PLATE')
    canvas.models.SwitchCutouts = plate
  }

  for (const stamp of assembly.stamps || []) {
    if (!stamp.stampData) {
      continue
    }
    const stampModel = buildStampPart(
      stamp.stampData,
      keysArray,
      generatorOptions,
      stamp.layerName,
      false
    )
    // Model key safe for DXF nesting
    const key = stamp.modelKey || stamp.id.replace(/[^a-zA-Z0-9_]/g, '_')
    canvas.models[key] = stampModel
  }

  const reg = getRegistrationCenter(generatorOptions)
  canvas.models.Registration = buildRegistrationMark('CONSTRUCTION', reg.x, reg.y)

  return canvas
}

/**
 * Export a maker.js model to preview SVG, download SVG, and DXF strings.
 */
export function exportOtherPart(model) {
  if (!model) {
    return null
  }

  const previewSvg = makerjs.exporter.toSVG(model, {
    stroke: 'white',
    strokeWidth: '0.5mm',
    svgAttrs: { width: '100%', height: '100%' },
  })
  const svg = makerjs.exporter.toSVG(model, { units: makerjs.unitType.Millimeter })
  const dxf = makerjs.exporter.toDXF(model, { units: makerjs.unitType.Millimeter })

  return { previewSvg, svg, dxf }
}

/** Sanitize one filename segment (Title / PartName). */
export function sanitizeFilenamePart(value, fallback = 'Untitled') {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48)
  return cleaned || fallback
}

/**
 * Download name: Title.PartName.unique.ext
 * e.g. Macropad.SwitchPlate.lm9k2a.dxf
 */
export function makeDownloadFilename(keyboardTitle, partName, extension) {
  const title = sanitizeFilenamePart(keyboardTitle, 'Untitled')
  const part = sanitizeFilenamePart(partName, 'Part')
  const unique = Date.now().toString(36)
  const ext = extension.startsWith('.') ? extension : `.${extension}`
  return `${title}.${part}.${unique}${ext}`
}
