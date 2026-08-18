import makerjs from "makerjs"
import { buildOutlineModel, zoneOutlineDefaults } from "./PlateBuilder"
import { offsetLoop } from "./BackCutBuilder"

export const DOT_RADIUS_MM = 1.5
export const DOTS_MODES = [
  { id: "stamp", label: "Stamp (4 corners)" },
  { id: "ex1", label: "Ex 1 — rim pegs" },
  { id: "ex2", label: "Ex 2 — hex grid" },
  { id: "ex3", label: "Ex 3 — outline corners" },
]

export function dotsModeFromOutlines(layerOutlines) {
  const saved = (layerOutlines && layerOutlines["Top-Dots"]) || {}
  const mode = String(saved.dotsMode || "stamp")
  return DOTS_MODES.some(m => m.id === mode) ? mode : "stamp"
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

function centroid(loop) {
  let x = 0
  let y = 0
  for (const p of loop) {
    x += p.x
    y += p.y
  }
  const n = loop.length || 1
  return { x: x / n, y: y / n }
}

function loopArea(loop) {
  let a = 0
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i]
    const q = loop[(i + 1) % loop.length]
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
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

function insetLoop(loop, mm) {
  if (!loop || loop.length < 3) return []
  const inward = loopArea(loop) > 0 ? mm : -mm
  const shifted = offsetLoop(loop, inward)
  if (shifted.length < 3) return []
  const c = centroid(shifted)
  if (pointInLoop(c.x, c.y, loop)) return shifted
  const other = offsetLoop(loop, -inward)
  return other.length >= 3 ? other : shifted
}

function growLoop(loop, mm) {
  if (!loop || loop.length < 3) return []
  const outward = loopArea(loop) > 0 ? -mm : mm
  const a = offsetLoop(loop, outward)
  const b = offsetLoop(loop, -outward)
  const ca = a.length >= 3 ? Math.abs(loopArea(a)) : 0
  const cb = b.length >= 3 ? Math.abs(loopArea(b)) : 0
  return ca >= cb ? a : b
}

function boundsOf(loops) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const loop of loops) {
    for (const p of loop) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
  }
  return { minX, minY, maxX, maxY }
}

export function pointIsLegal(x, y, plateLoops, keepouts) {
  if (!plateLoops.some(loop => pointInLoop(x, y, loop))) return false
  if (keepouts.some(loop => pointInLoop(x, y, loop))) return false
  return true
}

function sampleLoop(loop, spacing) {
  const pts = []
  const gap = Math.max(4, Number(spacing) || 20)
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]
    const b = loop[(i + 1) % loop.length]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    const n = Math.max(1, Math.round(len / gap))
    for (let k = 0; k < n; k++) {
      const t = k / n
      pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }
  return pts
}

function hexPoints(box, spacing) {
  const pts = []
  const step = Math.max(8, Number(spacing) || 24)
  const rowH = step * 0.86602540378
  let row = 0
  for (let y = box.minY; y <= box.maxY + 0.01; y += rowH) {
    const x0 = box.minX + (row % 2 ? step / 2 : 0)
    for (let x = x0; x <= box.maxX + 0.01; x += step) {
      pts.push({ x, y })
    }
    row += 1
  }
  return pts
}

function uniqued(points, minDist) {
  const keep = []
  const d2 = minDist * minDist
  for (const p of points) {
    if (keep.some(q => (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y) < d2)) {
      continue
    }
    keep.push(p)
  }
  return keep
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

function keepoutLoops(backCutModel) {
  const raw = modelToLoops(backCutModel)
  return raw.map(loop => growLoop(loop, DOT_RADIUS_MM + 1)).filter(l => l.length >= 3)
}

/**
 * Pegs on leftover 3 mm stock. Never a solid "everything that is not the
 * back-cut" — sparse circles so the plate can still flex.
 *
 * ex1 rim along the inset outline
 * ex2 hex fill
 * ex3 outline corners (+ midpoints on long edges)
 */
export function buildGeneratedDots(generatorOptions, layerName, backCutModel) {
  const plate = plateLoopsFromOptions(generatorOptions).map(loop => insetLoop(loop, DOT_RADIUS_MM + 2.5))
    .filter(l => l.length >= 3)
  if (!plate.length) {
    return null
  }
  const keepouts = keepoutLoops(backCutModel)
  const mode = dotsModeFromOutlines(generatorOptions && generatorOptions.layerOutlines)
  let candidates = []
  if (mode === "ex1") {
    candidates = plate.flatMap(loop => sampleLoop(loop, 22))
  } else if (mode === "ex3") {
    for (const loop of plate) {
      for (let i = 0; i < loop.length; i++) {
        candidates.push(loop[i])
        const a = loop[i]
        const b = loop[(i + 1) % loop.length]
        const len = Math.hypot(b.x - a.x, b.y - a.y)
        if (len > 36) {
          candidates.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
        }
      }
    }
  } else {
    candidates = hexPoints(boundsOf(plate), 24)
  }
  const legal = uniqued(
    candidates.filter(p => pointIsLegal(p.x, p.y, plate, keepouts)),
    mode === "ex3" ? 8 : 12
  )
  if (!legal.length) {
    return null
  }
  return circlesModel(legal, layerName || "Top-Dots")
}
