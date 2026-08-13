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
 * Always appends a registration X on the CONSTRUCTION layer so each stamp
 * export is alignable on its own. Position comes from generatorOptions.
 *
 * Optional generatorOptions.mirrorStamps: left-right mirror of stamp geometry only
 * (makerjs mirror about Y axis). Registration marks are NEVER mirrored — they stay
 * at the absolute (registrationX, registrationY) position so layers still align.
 *
 * FUTURE (Kailh Choc): when Choc hotswap / related stamps are added, they must use
 * this same mirrorStamps option and the same registration non-mirror rule.
 */
export function buildStampPart(stampData, keysArray, generatorOptions, layerName) {
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

  // …then add registration marks (do not paint them with the stamp layer name;
  // do not mirror — absolute position for multi-layer alignment)
  const reg = getRegistrationCenter(generatorOptions)
  canvas.models.Registration = buildRegistrationMark('CONSTRUCTION', reg.x, reg.y)

  return canvas
}

/**
 * Build an other-part model from a config entry.
 * Returns null if the part cannot be built yet (e.g. stamp with no keys).
 *
 * Stamp exports always include registration marks (CONSTRUCTION layer) together
 * with the stamped geometry. The standalone "registration" part is still available.
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
