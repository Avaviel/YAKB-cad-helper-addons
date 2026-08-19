import makerjs from "makerjs"
import Decimal from "decimal.js"

export const KEYS_LAYER = "Keys"

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

function rectModel(minX, minY, maxX, maxY) {
  return {
    paths: {
      top: new makerjs.paths.Line([minX, maxY], [maxX, maxY]),
      bottom: new makerjs.paths.Line([minX, minY], [maxX, minY]),
      left: new makerjs.paths.Line([minX, maxY], [minX, minY]),
      right: new makerjs.paths.Line([maxX, maxY], [maxX, minY]),
    },
  }
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

/** Axis-aligned key rectangle in CAD mm (KLE y-down → CAD y-up). */
export function keyRectMm(xU, yU, wU, hU, unitW, unitH) {
  const minX = xU * unitW
  const maxX = (xU + wU) * unitW
  const maxY = -yU * unitH
  const minY = maxY - hU * unitH
  return { minX, minY, maxX, maxY }
}

function addRect(parent, id, xU, yU, wU, hU, unitW, unitH) {
  if (!(wU > 0) || !(hU > 0)) return
  const r = keyRectMm(xU, yU, wU, hU, unitW, unitH)
  parent.models[id] = rectModel(r.minX, r.minY, r.maxX, r.maxY)
}

/**
 * Layout rectangles for every key (1U, 2U, ISO secondary, rotated clusters).
 * Size is the KLE unit cell: width × unitWidth by height × unitHeight.
 * Tall keys stay tall — this is the keycap, not the rotated switch.
 */
export function buildKeyOutlines(keysArray, generatorOptions, layerName = KEYS_LAYER) {
  if (!keysArray || !keysArray.length) {
    return null
  }
  const unitW = unitMm(generatorOptions, "unitWidth")
  const unitH = unitMm(generatorOptions, "unitHeight")
  const canvas = { models: {}, layer: layerName }

  keysArray.forEach((key, i) => {
    const x = toNum(key.x)
    const y = toNum(key.y)
    const w = toNum(key.width) || 1
    const h = toNum(key.height) || 1
    const one = { models: {} }
    addRect(one, "a", x, y, w, h, unitW, unitH)
    const w2 = key.width2 != null ? toNum(key.width2) : 0
    const h2 = key.height2 != null ? toNum(key.height2) : 0
    if (w2 > 0 && h2 > 0 && (Math.abs(w2 - w) > 1e-6 || Math.abs(h2 - h) > 1e-6 || key.x2 || key.y2)) {
      addRect(one, "b", x + toNum(key.x2), y + toNum(key.y2), w2, h2, unitW, unitH)
    }
    const angle = toNum(key.angle)
    if (angle) {
      const pivot = [toNum(key.rotx) * unitW, -toNum(key.roty) * unitH]
      makerjs.model.rotate(one, -angle, pivot)
    }
    canvas.models["K" + i] = one
  })

  return applyLayer(canvas, layerName)
}
