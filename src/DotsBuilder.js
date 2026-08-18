import makerjs from "makerjs"
import Decimal from "decimal.js"
import { isKeyStaggered } from "./overkill"

export const DOT_RADIUS_MM = 1.5
/** Slide H uprights off the 1U corners toward the switch (stagger-safe). */
export const H_INSET_MM = 4.5
/** Under a stab key, sit below the MX pocket+bobble, between the housings. */
export const STAB_BELOW_Y_MM = -12.5
export const STAB_BROUGHT_IN_X_MM = 4.5
const POCKET_CLEAR_MM = 0.2

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

/** Stab cutouts start at 2U (same threshold as StabilizerMXBasic). */
export function keyHasStabs(key) {
  const w = toNum(key && key.width)
  const h = toNum(key && key.height)
  const size = key && !key.skipOrientationFix && h > w ? h : w
  return size >= 2
}

/**
 * Key-local millimetres, switch at origin, +Y up (stamp space).
 *
 * 1U: H uprights at x=±halfU, y=±4.5 — column webs, not row-seam corners.
 * Staggered 1U: same H (the inset *is* the stagger fix).
 * Stab keys: standard 1U tops (pulled in if staggered), two brought-in
 * under the switch, two outer bottom corners of the key.
 */
export function keyDotLocals(key, keysArray, generatorOptions) {
  const unitW = unitMm(generatorOptions, "unitWidth")
  const unitH = unitMm(generatorOptions, "unitHeight")
  const halfU = unitW / 2
  const halfV = unitH / 2
  const w = toNum(key.width)
  const h = toNum(key.height)
  const swapped = !!(key && !key.skipOrientationFix && h > w)
  const sizeU = swapped ? h : w
  const halfKeyW = (sizeU / 2) * unitW
  const staggered = isKeyStaggered(key, keysArray)
  const pts = []

  if (keyHasStabs(key)) {
    const topY = staggered ? H_INSET_MM : halfV
    pts.push({ x: -halfU, y: topY })
    pts.push({ x: halfU, y: topY })
    pts.push({ x: -STAB_BROUGHT_IN_X_MM, y: STAB_BELOW_Y_MM })
    pts.push({ x: STAB_BROUGHT_IN_X_MM, y: STAB_BELOW_Y_MM })
    pts.push({ x: -halfKeyW, y: -halfV })
    pts.push({ x: halfKeyW, y: -halfV })
  } else {
    pts.push({ x: -halfU, y: H_INSET_MM })
    pts.push({ x: halfU, y: H_INSET_MM })
    pts.push({ x: -halfU, y: -H_INSET_MM })
    pts.push({ x: halfU, y: -H_INSET_MM })
  }

  if (swapped) {
    return pts.map(p => ({ x: p.y, y: -p.x }))
  }
  return pts
}

function rotatePt(p, deg) {
  if (!deg) return p
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
}

export function keyDotWorld(key, keysArray, generatorOptions) {
  const unitW = unitMm(generatorOptions, "unitWidth")
  const unitH = unitMm(generatorOptions, "unitHeight")
  const ox = toNum(key.centerX) * unitW
  const oy = toNum(key.centerY) * unitH * -1
  const angle = -(toNum(key.angle) + toNum(key.independentSwitchAngle))
  return keyDotLocals(key, keysArray, generatorOptions).map(p => {
    const r = rotatePt(p, angle)
    return { x: r.x + ox, y: r.y + oy }
  })
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-18) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function distToLoop(x, y, loop) {
  let d = Infinity
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]
    const b = loop[(i + 1) % loop.length]
    d = Math.min(d, distToSegment(x, y, a.x, a.y, b.x, b.y))
  }
  return d
}

export function diskHitsKeepout(x, y, radius, loops) {
  const r = radius + POCKET_CLEAR_MM
  for (const loop of loops || []) {
    if (pointInLoop(x, y, loop)) return true
    if (distToLoop(x, y, loop) < r) return true
  }
  return false
}

function pointInLoop(x, y, loop) {
  let inside = false
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const yi = loop[i].y
    const yj = loop[j].y
    if ((yi > y) !== (yj > y)) {
      const atX = loop[i].x + ((loop[j].x - loop[i].x) * (y - yi)) / ((yj - yi) || 1e-15)
      if (x < atX) inside = !inside
    }
  }
  return inside
}

function modelToLoops(model) {
  if (!model) return []
  const copy = makerjs.model.clone(model)
  makerjs.model.originate(copy)
  const chains = makerjs.model.findChains(copy, { pointMatchingDistance: 0.25 }) || []
  const loops = []
  for (const chain of chains) {
    const pts = makerjs.chain.toKeyPoints(chain, 0.5) || []
    if (pts.length < 3) continue
    const loop = pts.map(p => ({ x: p[0], y: p[1] }))
    const first = loop[0]
    const last = loop[loop.length - 1]
    if (Math.hypot(first.x - last.x, first.y - last.y) < 0.4) {
      loop.pop()
    }
    if (loop.length >= 3) loops.push(loop)
  }
  return loops
}

function circlesModel(points, layerName, radius = DOT_RADIUS_MM) {
  const paths = {}
  let n = 0
  for (const p of points) {
    const c = new makerjs.paths.Circle([p.x, p.y], radius)
    c.layer = layerName
    paths["dot" + n] = c
    n += 1
  }
  return { paths, layer: layerName }
}

/**
 * H on 1U, stagger-safe tops, stab extras, then drop any peg whose disk
 * nicks the ungrown back-cut (whole peg gone, no crescents).
 */
export function buildPlacedDots(keysArray, generatorOptions, layerName, backCutModel) {
  if (!keysArray || !keysArray.length) {
    return null
  }
  const keepouts = modelToLoops(backCutModel)
  const points = []
  for (const key of keysArray) {
    for (const p of keyDotWorld(key, keysArray, generatorOptions)) {
      if (keepouts.length && diskHitsKeepout(p.x, p.y, DOT_RADIUS_MM, keepouts)) {
        continue
      }
      points.push(p)
    }
  }
  if (!points.length) {
    return null
  }
  return circlesModel(points, layerName || "Top-Dots")
}
