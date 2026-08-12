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
 * Simple registration X (two crossed lines) centered at (-100, -100).
 */
export function buildRegistrationMark(layerName = 'CONSTRUCTION') {
  const cx = -100
  const cy = -100
  const half = 5

  const line1 = new makerjs.paths.Line([cx - half, cy - half], [cx + half, cy + half])
  const line2 = new makerjs.paths.Line([cx - half, cy + half], [cx + half, cy - half])
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
 */
export function buildStampPart(stampData, keysArray, generatorOptions, layerName) {
  const template = stampJsonToModel(stampData, layerName)
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

  applyLayer(canvas, layerName)
  return canvas
}

/**
 * Build an other-part model from a config entry.
 * Returns null if the part cannot be built yet (e.g. stamp with no keys).
 */
export function buildOtherPart(partConfig, keysArray, generatorOptions) {
  if (partConfig.type === 'generated') {
    if (partConfig.generator === 'registrationX') {
      return buildRegistrationMark(partConfig.layerName)
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
    partConfig.layerName
  )
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
