import makerjs from "makerjs"
import Decimal from "decimal.js"

export const LED_LAYER = "Top-LED"
/** Slot centre, millimetres south of the switch centre. */
export const LED_BELOW_MM = 5.1
export const LED_WIDTH_MM = 7
export const LED_HEIGHT_MM = 1.5
/** End radius; equal to half the height, tangent to the top and bottom. */
export const LED_RADIUS_MM = 0.75

function toNum(value) {
  if (value == null) return 0
  if (typeof value === "number") return value
  if (typeof value.toNumber === "function") return value.toNumber()
  return Number(value)
}

function unitMm(generatorOptions, which) {
  const raw = generatorOptions && generatorOptions[which]
  const n = raw instanceof Decimal ? raw.toNumber() : Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 19.05
}

function applyLayer(model, layerName) {
  if (!model) return model
  model.layer = layerName
  if (model.paths) {
    for (const path of Object.values(model.paths)) {
      if (path) path.layer = layerName
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
 * Stadium 7 × 1.5 mm, 0.75 mm ends, centred on (0, -5.1) in switch-local mm (+Y up).
 */
export function ledSlotLocal() {
  const r = LED_RADIUS_MM
  const inner = LED_WIDTH_MM / 2 - r
  const cy = -LED_BELOW_MM
  return {
    paths: {
      top: new makerjs.paths.Line([-inner, cy + r], [inner, cy + r]),
      right: new makerjs.paths.Arc([inner, cy], r, 270, 90),
      bottom: new makerjs.paths.Line([inner, cy - r], [-inner, cy - r]),
      left: new makerjs.paths.Arc([-inner, cy], r, 90, 270),
    },
  }
}

/**
 * One LED slot per switch. Tall keys follow the same 90° swap as the switch cutout.
 */
export function buildLedCutouts(keysArray, generatorOptions, layerName = LED_LAYER) {
  if (!keysArray || !keysArray.length) {
    return null
  }
  const unitW = unitMm(generatorOptions, "unitWidth")
  const unitH = unitMm(generatorOptions, "unitHeight")
  const canvas = { models: {}, layer: layerName }
  keysArray.forEach((key, i) => {
    const ox = toNum(key.centerX) * unitW
    const oy = toNum(key.centerY) * unitH * -1
    const swapped = !!(key && !key.skipOrientationFix && toNum(key.height) > toNum(key.width))
    const angle = -(toNum(key.angle) + toNum(key.independentSwitchAngle))
    let slot = ledSlotLocal()
    if (swapped) {
      slot = makerjs.model.rotate(slot, -90)
    }
    if (angle) {
      slot = makerjs.model.rotate(slot, angle)
    }
    slot.origin = [ox, oy]
    canvas.models["L" + i] = slot
  })
  return applyLayer(canvas, layerName)
}
