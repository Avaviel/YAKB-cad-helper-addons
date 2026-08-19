import makerjs from "makerjs"
import Decimal from "decimal.js"
import { offsetLoop, unionRectsToLoop, unionRectsToLoops } from "./BackCutBuilder"

export const KEYS_LAYER = "Keys"
export const KEYS_MASS_LAYER = "Keys-MASS"

export const KEYS_DEFAULTS = {
  fillet: 1,
}

export const KEYS_MASS_DEFAULTS = {
  offset: 0,
  round: 1,
}

function toNum(value, fallback = 0) {
  if (value == null || value === "") return fallback
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback
  if (typeof value.toNumber === "function") {
    const n = value.toNumber()
    return Number.isFinite(n) ? n : fallback
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function unitMm(generatorOptions, which) {
  const raw = generatorOptions && generatorOptions[which]
  const n = raw instanceof Decimal ? raw.toNumber() : Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 19.05
}

export function resolveKeysSettings(layerOutlines) {
  const saved = (layerOutlines && layerOutlines.Keys) || {}
  return {
    fillet: toNum(saved.fillet, KEYS_DEFAULTS.fillet),
  }
}

export function resolveKeysMassSettings(layerOutlines) {
  const mass = (layerOutlines && layerOutlines[KEYS_MASS_LAYER]) || {}
  const legacy = (layerOutlines && layerOutlines.Keys) || {}
  const offsetSrc = mass.offset != null && mass.offset !== "" ? mass.offset : legacy.offset
  const roundSrc = mass.round != null && mass.round !== ""
    ? mass.round
    : (legacy.round != null && legacy.round !== "" ? legacy.round : legacy.massFillet)
  return {
    offset: toNum(offsetSrc, KEYS_MASS_DEFAULTS.offset),
    round: toNum(roundSrc, KEYS_MASS_DEFAULTS.round),
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
  const minX = snapMm(xU * unitW)
  const maxX = snapMm((xU + wU) * unitW)
  const maxY = snapMm(-yU * unitH)
  const minY = snapMm(maxY - hU * unitH)
  return { minX, minY, maxX, maxY }
}

function edgeLen(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function snapMm(v) {
  return Math.round(Number(v) * 1000) / 1000
}

function mergeShortEdges(loop, minLen = 0.08) {
  let pts = (loop || []).map(p => ({ x: p.x, y: p.y }))
  if (pts.length < 3) return pts
  let guard = 0
  while (pts.length >= 4 && guard++ < 40) {
    const n = pts.length
    const next = []
    let dropped = false
    for (let i = 0; i < n; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % n]
      if (edgeLen(a, b) < minLen) {
        dropped = true
        continue
      }
      next.push(a)
    }
    if (!dropped || next.length < 3) break
    pts = next
  }
  const n = pts.length
  const out = []
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n]
    const b = pts[i]
    const c = pts[(i + 1) % n]
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (Math.abs(cross) > 1e-6) out.push(b)
  }
  return out.length >= 3 ? out : loop
}

function filletLoopModel(loop, radius) {
  const pts = mergeShortEdges(loop)
  const n = pts.length
  const paths = {}
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    paths["e" + i] = new makerjs.paths.Line([a.x, a.y], [b.x, b.y])
  }
  if (!(radius > 0.001) || n < 3 || !makerjs.path.fillet) {
    return { paths }
  }
  for (let i = 0; i < n; i++) {
    const a = paths["e" + i]
    const b = paths["e" + ((i + 1) % n)]
    const la = edgeLen(pts[i], pts[(i + 1) % n])
    const lb = edgeLen(pts[(i + 1) % n], pts[(i + 2) % n])
    const rad = Math.min(radius, la / 2 - 0.02, lb / 2 - 0.02)
    if (!(rad > 0.001) || !a || !b) continue
    const arc = makerjs.path.fillet(a, b, rad)
    if (arc) paths["f" + i] = arc
  }
  return { paths }
}

function filletedRect(minX, minY, maxX, maxY, radius) {
  const loop = [
    { x: minX, y: maxY },
    { x: maxX, y: maxY },
    { x: maxX, y: minY },
    { x: minX, y: minY },
  ]
  return filletLoopModel(loop, radius)
}

function keyRects(key, unitW, unitH) {
  const x = toNum(key.x)
  const y = toNum(key.y)
  const w = toNum(key.width) || 1
  const h = toNum(key.height) || 1
  const rects = [keyRectMm(x, y, w, h, unitW, unitH)]
  const w2 = key.width2 != null ? toNum(key.width2) : 0
  const h2 = key.height2 != null ? toNum(key.height2) : 0
  if (w2 > 0 && h2 > 0 && (Math.abs(w2 - w) > 1e-6 || Math.abs(h2 - h) > 1e-6 || key.x2 || key.y2)) {
    rects.push(keyRectMm(x + toNum(key.x2), y + toNum(key.y2), w2, h2, unitW, unitH))
  }
  return rects
}

function rotationKey(key) {
  return `${toNum(key.angle)}|${toNum(key.rotx)}|${toNum(key.roty)}`
}

function rotateModel(model, key, unitW, unitH) {
  const angle = toNum(key.angle)
  if (!angle) return model
  const pivot = [toNum(key.rotx) * unitW, -toNum(key.roty) * unitH]
  return makerjs.model.rotate(model, -angle, pivot)
}

function individualKeyModel(key, unitW, unitH, fillet) {
  const rects = keyRects(key, unitW, unitH)
  let model
  if (rects.length === 1) {
    const r = rects[0]
    model = filletedRect(r.minX, r.minY, r.maxX, r.maxY, fillet)
  } else {
    const loop = unionRectsToLoop(rects)
    model = filletLoopModel(loop, fillet)
  }
  return rotateModel(model, key, unitW, unitH)
}

function combinedGroupModel(keys, unitW, unitH, offset, round) {
  const rects = []
  for (const key of keys) {
    rects.push(...keyRects(key, unitW, unitH))
  }
  const loops = unionRectsToLoops(rects)
  const canvas = { models: {} }
  loops.forEach((loop, i) => {
    const grown = offset ? offsetLoop(loop, offset) : loop
    if (!grown || grown.length < 3) return
    canvas.models["I" + i] = filletLoopModel(grown, round)
  })
  if (!Object.keys(canvas.models).length) return null
  return rotateModel(canvas, keys[0], unitW, unitH)
}

/**
 * Drawing 3.2: one filleted rectangle (or ISO L) per key.
 */
export function buildKeyOutlines(keysArray, generatorOptions, layerName = KEYS_LAYER) {
  if (!keysArray || !keysArray.length) {
    return null
  }
  const unitW = unitMm(generatorOptions, "unitWidth")
  const unitH = unitMm(generatorOptions, "unitHeight")
  const settings = resolveKeysSettings(generatorOptions && generatorOptions.layerOutlines)
  const canvas = { models: {}, layer: layerName }
  keysArray.forEach((key, i) => {
    canvas.models["K" + i] = individualKeyModel(key, unitW, unitH, settings.fillet)
  })
  return applyLayer(canvas, layerName)
}

/**
 * Drawing 3.3: union of touching keys, then offset and round, for case design.
 */
export function buildKeyMass(keysArray, generatorOptions, layerName = KEYS_MASS_LAYER) {
  if (!keysArray || !keysArray.length) {
    return null
  }
  const unitW = unitMm(generatorOptions, "unitWidth")
  const unitH = unitMm(generatorOptions, "unitHeight")
  const settings = resolveKeysMassSettings(generatorOptions && generatorOptions.layerOutlines)
  const groups = new Map()
  for (const key of keysArray) {
    const id = rotationKey(key)
    if (!groups.has(id)) groups.set(id, [])
    groups.get(id).push(key)
  }
  const canvas = { models: {}, layer: layerName }
  let g = 0
  for (const group of groups.values()) {
    const island = combinedGroupModel(group, unitW, unitH, settings.offset, settings.round)
    if (island) {
      canvas.models["G" + g] = island
      g += 1
    }
  }
  if (!Object.keys(canvas.models).length) {
    return null
  }
  return applyLayer(canvas, layerName)
}
