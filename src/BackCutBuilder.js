import makerjs from "makerjs"
import Decimal from "decimal.js"

const SWITCH_HALF = 7

function num(value, fallback) {
  const n = value instanceof Decimal ? value.toNumber() : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function filletedSquare(half, cornerR) {
  const h = half
  const model = {
    paths: {
      lineTop: new makerjs.paths.Line([-h, h], [h, h]),
      lineBottom: new makerjs.paths.Line([-h, -h], [h, -h]),
      lineLeft: new makerjs.paths.Line([-h, h], [-h, -h]),
      lineRight: new makerjs.paths.Line([h, h], [h, -h]),
    },
  }
  if (cornerR > 0.001 && cornerR < half) {
    model.paths.filletTopLeft = makerjs.path.fillet(model.paths.lineTop, model.paths.lineLeft, cornerR)
    model.paths.filletTopRight = makerjs.path.fillet(model.paths.lineTop, model.paths.lineRight, cornerR)
    model.paths.filletBottomLeft = makerjs.path.fillet(model.paths.lineBottom, model.paths.lineLeft, cornerR)
    model.paths.filletBottomRight = makerjs.path.fillet(model.paths.lineBottom, model.paths.lineRight, cornerR)
  }
  return model
}

/**
 * One side (bottom): 1mm-offset edge with two 2mm / 1.5mm tangent-arc bumps.
 * Four arcs per side. Exact radii come from settings; the curve only needs to stay tangent.
 */
function bottomBumpPaths(half, bump, blend, notch, flatHalf) {
  const dy = bump + blend - notch
  const spread = (bump + blend) * (bump + blend) - dy * dy
  const dx = Math.sqrt(Math.max(0.01, spread))
  const c2x = -flatHalf - dx
  const c2y = -half - bump
  const c1x = -flatHalf
  const c1y = -half + blend - notch
  const join = Math.atan2(c1y - c2y, c1x - c2x) * 180 / Math.PI
  const yFlat = c1y - blend

  const paths = {
    lineLeft: new makerjs.paths.Line([-half, -half], [c2x, -half]),
    arcBumpL: new makerjs.paths.Arc([c2x, c2y], bump, join, 90),
    arcBlendL: new makerjs.paths.Arc([c1x, c1y], blend, join + 180, -90),
    lineFlat: new makerjs.paths.Line([-flatHalf, yFlat], [flatHalf, yFlat]),
    arcBlendR: new makerjs.paths.Arc([-c1x, c1y], blend, -90, -join),
    arcBumpR: new makerjs.paths.Arc([-c2x, c2y], bump, 90, 180 - join),
    lineRight: new makerjs.paths.Line([-c2x, -half], [half, -half]),
  }
  return { paths }
}

function bumpedSquare(half, cornerR, bump, blend, notch, flatHalf) {
  const sides = {}
  for (let i = 0; i < 4; i++) {
    let side = bottomBumpPaths(half, bump, blend, notch, flatHalf)
    if (i) {
      side = makerjs.model.rotate(side, i * 90)
    }
    sides["side" + i] = side
  }
  const model = { models: sides }
  if (cornerR > 0.001) {
    const box = {
      paths: {
        lineTop: new makerjs.paths.Line([-half, half], [half, half]),
        lineBottom: new makerjs.paths.Line([-half, -half], [half, -half]),
        lineLeft: new makerjs.paths.Line([-half, half], [-half, -half]),
        lineRight: new makerjs.paths.Line([half, half], [half, -half]),
      },
    }
    const fTL = makerjs.path.fillet(box.paths.lineTop, box.paths.lineLeft, cornerR)
    const fTR = makerjs.path.fillet(box.paths.lineTop, box.paths.lineRight, cornerR)
    const fBL = makerjs.path.fillet(box.paths.lineBottom, box.paths.lineLeft, cornerR)
    const fBR = makerjs.path.fillet(box.paths.lineBottom, box.paths.lineRight, cornerR)
    model.paths = {}
    if (fTL) model.paths.filletTopLeft = fTL
    if (fTR) model.paths.filletTopRight = fTR
    if (fBL) model.paths.filletBottomLeft = fBL
    if (fBR) model.paths.filletBottomRight = fBR
  }
  return model
}

export const defaultBackCut = {
  offset: 1,
  bump: 2,
  blend: 1.5,
  notch: 1,
}

export function backCutDefaultsForFamily(familyId) {
  if (familyId === "choc") {
    return { offset: 1, bump: 0, blend: 1.5, notch: 1 }
  }
  return { ...defaultBackCut }
}

export function resolveBackCutSettings(layerOutlines, familyId, switchFillet) {
  const saved = (layerOutlines && layerOutlines["Top-BACK_CUT"]) || {}
  const defaults = backCutDefaultsForFamily(familyId)
  const offset = num(saved.offset, defaults.offset)
  return {
    offset,
    bump: familyId === "choc" ? 0 : num(saved.bump, defaults.bump),
    blend: num(saved.blend, defaults.blend),
    notch: num(saved.notch, defaults.notch),
    cornerFillet: num(switchFillet, 0.5) + offset,
  }
}

export function generateBackCutTemplate(settings, generatorOptions) {
  const kerf = num(generatorOptions && generatorOptions.kerf, 0)
  const half = SWITCH_HALF + settings.offset - kerf
  if (half <= 0.5) {
    return filletedSquare(SWITCH_HALF, 0.5)
  }
  if (settings.bump > 0.05) {
    const flatHalf = Math.max(0.2, settings.blend * 0.5)
    return bumpedSquare(half, settings.cornerFillet, settings.bump, settings.blend, settings.notch, flatHalf)
  }
  return filletedSquare(half, settings.cornerFillet)
}

export function buildBackCutPart(keysArray, generatorOptions, layerName) {
  const settings = resolveBackCutSettings(
    generatorOptions && generatorOptions.layerOutlines,
    generatorOptions && generatorOptions.stampFamilyId,
    generatorOptions && generatorOptions.switchFilletRadius
  )
  const template = generateBackCutTemplate(settings, generatorOptions)
  const canvas = { models: {} }
  let id = 0
  const unitWidth = generatorOptions.unitWidth instanceof Decimal
    ? generatorOptions.unitWidth
    : new Decimal(generatorOptions.unitWidth)
  const unitHeight = generatorOptions.unitHeight instanceof Decimal
    ? generatorOptions.unitHeight
    : new Decimal(generatorOptions.unitHeight)

  for (const key of keysArray || []) {
    const originNum = [
      key.centerX.times(unitWidth).toNumber(),
      key.centerY.times(unitHeight).times(-1).toNumber(),
    ]
    let instance = makerjs.model.clone(template)
    instance = makerjs.model.rotate(
      instance,
      key.angle.plus(key.independentSwitchAngle).times(-1).toNumber()
    )
    if (!key.skipOrientationFix && key.height > key.width) {
      instance = makerjs.model.rotate(instance, -90)
    }
    instance.origin = originNum
    canvas.models["BackCut" + id] = instance
    id += 1
  }
  canvas.layer = layerName
  return canvas
}
