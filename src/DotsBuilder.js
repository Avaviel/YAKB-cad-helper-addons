import makerjs from "makerjs"
import Decimal from "decimal.js"
import { isKeyStaggered, isKeyStaggeredBelow } from "./overkill"
import { buildOutlineModel, zoneOutlineDefaults } from "./PlateBuilder"
import { resolveBackCutSettings } from "./BackCutBuilder"

export const DOT_RADIUS_MM = 1.5
/** 1U X corners: half of 19.05. */
export const X_HALF_MM = 9.525
/** Staggered 1U: pair at y = -5.25, x = ±9.525. */
export const STAGGER_DOWN_Y_MM = -5.25
/** 19.05 - 5.25: same as the key above's y = -5.25. */
export const STAGGER_ABOVE_Y_MM = 13.8
/** Clearance from the stab through-cut outline (below and to each side). */
export const STAB_CLEAR_MM = 1.7

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

function keySizeU(key) {
  const w = toNum(key && key.width)
  const h = toNum(key && key.height)
  return key && !key.skipOrientationFix && h > w ? h : w
}

/** Stab cutouts start at 2U (same threshold as StabilizerMXBasic). */
export function keyHasStabs(key) {
  return keySizeU(key) >= 2
}

/** MX plate-mount stab centres (mm from switch). Same table as the cutout generators. */
export function mxStabSpacing(key) {
  const size = keySizeU(key)
  if (size < 2) return null
  if (size >= 8) return { left: 66.675, right: 66.675 }
  if (size >= 7) return { left: 57.15, right: 57.15 }
  if (size >= 6.25) return { left: 50, right: 50 }
  if (size >= 6) {
    if (key && key.shift6UStabilizers) return { left: 57.15, right: 38.1 }
    return { left: 47.625, right: 47.625 }
  }
  if (size >= 3) return { left: 19.05, right: 19.05 }
  return { left: 11.938, right: 11.938 }
}

/** Stab housing box in switch-local mm (same numbers as the cutout generators). */
export function mxStabHousing(stabType) {
  if (stabType === "mx-small") {
    return { halfW: 3.375, minY: -8, maxY: 6 }
  }
  if (stabType === "mx-spec") {
    return { halfW: 3.327, minY: -7.772, maxY: 5.69 }
  }
  return { halfW: 3.5, minY: -9, maxY: 6 }
}

function addStabRing(pts, cx, housing, gap) {
  const yBelow = housing.minY - gap
  const yAbove = housing.maxY + gap
  const side = housing.halfW + gap
  pts.push({ x: cx, y: yBelow })
  pts.push({ x: cx - side, y: yBelow })
  pts.push({ x: cx + side, y: yBelow })
  pts.push({ x: cx, y: yAbove })
  pts.push({ x: cx - side, y: yAbove })
  pts.push({ x: cx + side, y: yAbove })
}

/**
 * Key-local millimetres, switch at origin, +Y up (stamp space).
 *
 * 1U ortho: four X corners (±9.525, ±9.525).
 * Staggered 1U (row above is offset): (±9.525, -5.25) plus a centre boss
 * at y=+13.8. Cluster-merge collapses extras.
 * 1U with a staggered row below (number row over QWERTY): keep the ortho
 * top pair, drop the bottom X so it does not land on Q/W/E.
 * Stab keys: around each housing, 1.7 mm outside the through-cut
 * (below, left, right) and the same trio mirrored across that housing
 * so vertical + / Enter get both sides. No extra mirror across the switch.
 */
export function keyDotLocals(key, keysArray, generatorOptions) {
  const unitW = unitMm(generatorOptions, "unitWidth")
  const unitH = unitMm(generatorOptions, "unitHeight")
  const halfU = unitW / 2
  const halfV = unitH / 2
  const w = toNum(key.width)
  const h = toNum(key.height)
  const swapped = !!(key && !key.skipOrientationFix && h > w)
  const staggered = isKeyStaggered(key, keysArray)
  const staggerBelow = isKeyStaggeredBelow(key, keysArray)
  const pts = []

  if (keyHasStabs(key)) {
    const spacing = mxStabSpacing(key)
    const housing = mxStabHousing(generatorOptions && generatorOptions.stabilizerCutoutType)
    if (spacing) {
      addStabRing(pts, -spacing.left, housing, STAB_CLEAR_MM)
      addStabRing(pts, spacing.right, housing, STAB_CLEAR_MM)
    }
  } else if (staggered) {
    pts.push({ x: -halfU, y: STAGGER_DOWN_Y_MM })
    pts.push({ x: halfU, y: STAGGER_DOWN_Y_MM })
    pts.push({ x: 0, y: unitH + STAGGER_DOWN_Y_MM })
  } else if (staggerBelow) {
    pts.push({ x: -halfU, y: halfV })
    pts.push({ x: halfU, y: halfV })
  } else {
    pts.push({ x: -halfU, y: halfV })
    pts.push({ x: halfU, y: halfV })
    pts.push({ x: -halfU, y: -halfV })
    pts.push({ x: halfU, y: -halfV })
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

export function diskHitsKeepout(x, y, radius, loops) {
  for (const loop of loops || []) {
    if (pointInLoop(x, y, loop)) return true
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

function plateLoopsFromOptions(generatorOptions) {
  const outlines = (generatorOptions && generatorOptions.outlines) || []
  if (!outlines.length) return []
  const saved = ((generatorOptions.layerOutlines || {})["Top-SWITCH_PLATE"]) || {}
  const defaults = zoneOutlineDefaults(outlines)
  const offset = saved.offset != null && saved.offset !== "" ? Number(saved.offset) : defaults.offset
  const fillet = saved.fillet != null && saved.fillet !== "" ? Number(saved.fillet) : defaults.fillet
  const model = buildOutlineModel(outlines, generatorOptions, {
    offset: Number.isFinite(offset) ? offset : defaults.offset,
    fillet: Number.isFinite(fillet) ? fillet : defaults.fillet,
  })
  return modelToLoops(model)
}

function rectLoop(minX, minY, maxX, maxY) {
  return [
    { x: minX, y: maxY },
    { x: maxX, y: maxY },
    { x: maxX, y: minY },
    { x: minX, y: minY },
  ]
}

function worldLoop(loop, ox, oy, angle) {
  return loop.map(p => {
    const r = rotatePt(p, angle)
    return { x: r.x + ox, y: r.y + oy }
  })
}

function backCutBoxLoops(keysArray, generatorOptions) {
  const settings = resolveBackCutSettings(
    generatorOptions && generatorOptions.layerOutlines,
    generatorOptions && generatorOptions.stampFamilyId,
    generatorOptions && generatorOptions.switchFilletRadius,
    generatorOptions && generatorOptions.stabilizerFilletRadius
  )
  const off = Number(settings.offset) || 1
  const housing = mxStabHousing(generatorOptions && generatorOptions.stabilizerCutoutType)
  const unitW = unitMm(generatorOptions, "unitWidth")
  const unitH = unitMm(generatorOptions, "unitHeight")
  const loops = []
  for (const key of keysArray || []) {
    const ox = toNum(key.centerX) * unitW
    const oy = toNum(key.centerY) * unitH * -1
    const angle = -(toNum(key.angle) + toNum(key.independentSwitchAngle))
    const swapped = !!(key && !key.skipOrientationFix && toNum(key.height) > toNum(key.width))
    const local = []
    local.push(rectLoop(-7 - off, -7 - off, 7 + off, 7 + off))
    const spacing = mxStabSpacing(key)
    if (spacing) {
      for (const cx of [-spacing.left, spacing.right]) {
        local.push(rectLoop(
          cx - housing.halfW - off,
          housing.minY - off,
          cx + housing.halfW + off,
          housing.maxY + off
        ))
      }
    }
    for (let loop of local) {
      if (swapped) {
        loop = loop.map(p => ({ x: p.y, y: -p.x }))
      }
      loops.push(worldLoop(loop, ox, oy, angle))
    }
  }
  return loops
}

/**
 * Place pegs, then drop any whose centre sits inside the back-cut
 * (switch or stab housing boxes, plus traced loops) or outside the plate outline.
 */
export function buildPlacedDots(keysArray, generatorOptions, layerName, backCutModel) {
  if (!keysArray || !keysArray.length) {
    return null
  }
  const keepouts = modelToLoops(backCutModel).concat(backCutBoxLoops(keysArray, generatorOptions))
  const plate = plateLoopsFromOptions(generatorOptions)
  const points = []
  for (const key of keysArray) {
    for (const p of keyDotWorld(key, keysArray, generatorOptions)) {
      if (keepouts.length && diskHitsKeepout(p.x, p.y, DOT_RADIUS_MM, keepouts)) {
        continue
      }
      if (plate.length && !diskHitsKeepout(p.x, p.y, DOT_RADIUS_MM, plate)) {
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
