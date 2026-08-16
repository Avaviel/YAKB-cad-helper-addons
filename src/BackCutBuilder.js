import makerjs from "makerjs"
import Decimal from "decimal.js"

import { SwitchMXBasic } from "./cutouts/SwitchMXBasic"
import { SwitchAlpsSKCM } from "./cutouts/SwitchAlpsSKCM"
import { SwitchAlpsSKCP } from "./cutouts/SwitchAlpsSKCP"
import { SwitchChocCPG1232 } from "./cutouts/SwitchChocCPG1232"
import { SwitchChocCPG1350 } from "./cutouts/SwitchChocCPG1350"
import { SwitchOmronB3G } from "./cutouts/SwitchOmronB3G"
import { SwitchHiTek725 } from "./cutouts/SwitchHiTek725"
import { SwitchIRocks } from "./cutouts/SwitchIRocks"
import { SwitchFutabaMA } from "./cutouts/SwitchFutabaMA"

import { StabilizerMXBasic } from "./cutouts/StabilizerMXBasic"
import { StabilizerMXSmall } from "./cutouts/StabilizerMXSmall"
import { StabilizerMXSpec } from "./cutouts/StabilizerMXSpec"
import { StabilizerAlpsAEK } from "./cutouts/StabilizerAlpsAEK"
import { StabilizerAlpsAT101 } from "./cutouts/StabilizerAlpsAT101"
import { NullGenerator } from "./cutouts/NullGenerator"

const SWITCH_HALF = 7
const EPS = 0.02

function num(value, fallback) {
  const n = value instanceof Decimal ? value.toNumber() : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function createSwitchGenerator(type) {
  switch (type) {
    case "mx-basic": return new SwitchMXBasic()
    case "alps-skcm": return new SwitchAlpsSKCM()
    case "choc-cpg1232": return new SwitchChocCPG1232()
    case "choc-cpg1350": return new SwitchChocCPG1350()
    case "omron-b3g": return new SwitchOmronB3G()
    case "alps-skcp": return new SwitchAlpsSKCP()
    case "hitek-725": return new SwitchHiTek725()
    case "i-rocks": return new SwitchIRocks()
    case "futaba-ma": return new SwitchFutabaMA()
    default: return new SwitchMXBasic()
  }
}

function createStabilizerGenerator(type) {
  switch (type) {
    case "mx-basic": return new StabilizerMXBasic()
    case "mx-small": return new StabilizerMXSmall()
    case "mx-spec": return new StabilizerMXSpec()
    case "alps-aek": return new StabilizerAlpsAEK()
    case "alps-at101": return new StabilizerAlpsAT101()
    case "none": return new NullGenerator()
    default: return new StabilizerMXBasic()
  }
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

function measureBox(model) {
  if (!model) return null
  const ext = makerjs.measure.modelExtents(model)
  if (!ext) return null
  return { minX: ext.low[0], minY: ext.low[1], maxX: ext.high[0], maxY: ext.high[1] }
}

function leafBoxes(model, acc = []) {
  if (!model) return acc
  if (model.models) {
    for (const child of Object.values(model.models)) {
      leafBoxes(child, acc)
    }
  }
  if (model.paths && Object.keys(model.paths).length) {
    const box = measureBox(model)
    if (box) acc.push(box)
  }
  return acc
}

function boxesTouch(a, b) {
  return a.minX <= b.maxX + EPS && a.maxX >= b.minX - EPS &&
    a.minY <= b.maxY + EPS && a.maxY >= b.minY - EPS
}

function connectStabBar(stabBoxes) {
  if (!stabBoxes.length) return null
  return groupExtents(stabBoxes)
}

function bridgeRects(a, b) {
  if (!a || !b || boxesTouch(a, b)) return []
  const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)
  const overlapY = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
  if (overlapX > EPS) {
    const minX = Math.max(a.minX, b.minX)
    const maxX = Math.min(a.maxX, b.maxX)
    if (a.maxY < b.minY - EPS) {
      return [{ minX, maxX, minY: a.maxY, maxY: b.minY }]
    }
    if (b.maxY < a.minY - EPS) {
      return [{ minX, maxX, minY: b.maxY, maxY: a.minY }]
    }
  }
  if (overlapY > EPS) {
    const minY = Math.max(a.minY, b.minY)
    const maxY = Math.min(a.maxY, b.maxY)
    if (a.maxX < b.minX - EPS) {
      return [{ minX: a.maxX, maxX: b.minX, minY, maxY }]
    }
    if (b.maxX < a.minX - EPS) {
      return [{ minX: b.maxX, maxX: a.minX, minY, maxY }]
    }
  }
  return [groupExtents([a, b])]
}

function boxContainsPoint(box, x, y) {
  return x >= box.minX - EPS && x <= box.maxX + EPS &&
    y >= box.minY - EPS && y <= box.maxY + EPS
}

function simplifyColinear(pts) {
  if (pts.length < 3) return pts
  const out = []
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n]
    const b = pts[i]
    const c = pts[(i + 1) % n]
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (Math.abs(cross) > 1e-6) out.push(b)
  }
  return out
}

export function unionRectsToLoop(rects) {
  if (!rects || !rects.length) return []
  if (rects.length === 1) {
    const r = rects[0]
    return [
      { x: r.minX, y: r.maxY },
      { x: r.maxX, y: r.maxY },
      { x: r.maxX, y: r.minY },
      { x: r.minX, y: r.minY },
    ]
  }

  const xs = [...new Set(rects.flatMap(r => [r.minX, r.maxX]))].sort((a, b) => a - b)
  const ys = [...new Set(rects.flatMap(r => [r.minY, r.maxY]))].sort((a, b) => a - b)
  const cols = xs.length - 1
  const rows = ys.length - 1
  const filled = Array.from({ length: rows }, () => Array(cols).fill(false))

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (xs[i + 1] - xs[i] < 1e-9 || ys[j + 1] - ys[j] < 1e-9) continue
      const cx = (xs[i] + xs[i + 1]) / 2
      const cy = (ys[j] + ys[j + 1]) / 2
      filled[j][i] = rects.some(r => boxContainsPoint(r, cx, cy))
    }
  }

  const edgeMap = new Map()
  const ek = (x1, y1, x2, y2) => `${x1},${y1}>${x2},${y2}`
  const add = (x1, y1, x2, y2) => {
    const rev = ek(x2, y2, x1, y1)
    if (edgeMap.has(rev)) edgeMap.delete(rev)
    else edgeMap.set(ek(x1, y1, x2, y2), { x1, y1, x2, y2 })
  }

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (!filled[j][i]) continue
      add(xs[i], ys[j + 1], xs[i + 1], ys[j + 1])
      add(xs[i + 1], ys[j + 1], xs[i + 1], ys[j])
      add(xs[i + 1], ys[j], xs[i], ys[j])
      add(xs[i], ys[j], xs[i], ys[j + 1])
    }
  }

  const edges = [...edgeMap.values()]
  if (!edges.length) return []

  const topY = Math.max(...edges.map(e => Math.max(e.y1, e.y2)))
  let current = edges.find(e =>
    Math.abs(e.y1 - e.y2) < 1e-9 &&
    e.x2 > e.x1 &&
    Math.abs(e.y1 - topY) < 1e-9
  ) || edges[0]

  const used = new Set()
  const loop = [{ x: current.x1, y: current.y1 }]
  for (let n = 0; n < edges.length + 2; n++) {
    loop.push({ x: current.x2, y: current.y2 })
    used.add(ek(current.x1, current.y1, current.x2, current.y2))
    if (Math.abs(current.x2 - loop[0].x) < 1e-9 && Math.abs(current.y2 - loop[0].y) < 1e-9 && loop.length > 2) {
      break
    }
    const next = edges.find(e =>
      !used.has(ek(e.x1, e.y1, e.x2, e.y2)) &&
      Math.abs(e.x1 - current.x2) < 1e-9 &&
      Math.abs(e.y1 - current.y2) < 1e-9
    )
    if (!next) break
    current = next
  }
  if (loop.length > 1) {
    const last = loop[loop.length - 1]
    if (Math.abs(last.x - loop[0].x) < 1e-9 && Math.abs(last.y - loop[0].y) < 1e-9) {
      loop.pop()
    }
  }
  return simplifyColinear(loop)
}

function groupExtents(rects) {
  return {
    minX: Math.min(...rects.map(r => r.minX)),
    minY: Math.min(...rects.map(r => r.minY)),
    maxX: Math.max(...rects.map(r => r.maxX)),
    maxY: Math.max(...rects.map(r => r.maxY)),
  }
}

export function offsetLoop(loop, distance) {
  if (!loop || loop.length < 3) return []
  if (Math.abs(distance) < 1e-9) return loop.map(p => ({ x: p.x, y: p.y }))
  const n = loop.length
  const shifted = []
  for (let i = 0; i < n; i++) {
    const a = loop[i]
    const b = loop[(i + 1) % n]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const ox = -dy / len * distance
    const oy = dx / len * distance
    shifted.push({
      x1: a.x + ox,
      y1: a.y + oy,
      x2: b.x + ox,
      y2: b.y + oy,
    })
  }
  const out = []
  for (let i = 0; i < n; i++) {
    const prev = shifted[(i - 1 + n) % n]
    const cur = shifted[i]
    const prevH = Math.abs(prev.y2 - prev.y1) < 1e-9
    const curH = Math.abs(cur.y2 - cur.y1) < 1e-9
    if (prevH && !curH) out.push({ x: cur.x1, y: prev.y1 })
    else if (!prevH && curH) out.push({ x: prev.x1, y: cur.y1 })
    else out.push({ x: cur.x1, y: cur.y1 })
  }
  return simplifyColinear(out)
}

function uniqueSorted(vals) {
  return [...new Set(vals.map(v => Math.round(v * 1e6) / 1e6))].sort((a, b) => a - b)
}

function pointInLoop(x, y, loop) {
  let inside = false
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const yi = loop[i].y
    const yj = loop[j].y
    if ((yi > y) !== (yj > y)) {
      const atX = loop[i].x + (loop[j].x - loop[i].x) * (y - yi) / ((yj - yi) || 1e-15)
      if (x < atX) inside = !inside
    }
  }
  return inside
}

export function unionLoopsToLoop(loops) {
  const usable = (loops || []).filter(l => l && l.length >= 3)
  if (!usable.length) return []
  if (usable.length === 1) return usable[0].map(p => ({ x: p.x, y: p.y }))
  const xs = uniqueSorted(usable.flatMap(l => l.map(p => p.x)))
  const ys = uniqueSorted(usable.flatMap(l => l.map(p => p.y)))
  const cols = xs.length - 1
  const rows = ys.length - 1
  const filled = Array.from({ length: rows }, () => Array(cols).fill(false))
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (xs[i + 1] - xs[i] < 1e-9 || ys[j + 1] - ys[j] < 1e-9) continue
      const cx = (xs[i] + xs[i + 1]) / 2
      const cy = (ys[j] + ys[j + 1]) / 2
      filled[j][i] = usable.some(loop => pointInLoop(cx, cy, loop))
    }
  }

  const edgeMap = new Map()
  const ek = (x1, y1, x2, y2) => `${x1},${y1}>${x2},${y2}`
  const add = (x1, y1, x2, y2) => {
    const rev = ek(x2, y2, x1, y1)
    if (edgeMap.has(rev)) edgeMap.delete(rev)
    else edgeMap.set(ek(x1, y1, x2, y2), { x1, y1, x2, y2 })
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (!filled[j][i]) continue
      add(xs[i], ys[j + 1], xs[i + 1], ys[j + 1])
      add(xs[i + 1], ys[j + 1], xs[i + 1], ys[j])
      add(xs[i + 1], ys[j], xs[i], ys[j])
      add(xs[i], ys[j], xs[i], ys[j + 1])
    }
  }
  const edges = [...edgeMap.values()]
  if (!edges.length) return []
  const topY = Math.max(...edges.map(e => Math.max(e.y1, e.y2)))
  let current = edges.find(e =>
    Math.abs(e.y1 - e.y2) < 1e-9 &&
    e.x2 > e.x1 &&
    Math.abs(e.y1 - topY) < 1e-9
  ) || edges[0]
  const used = new Set()
  const loop = [{ x: current.x1, y: current.y1 }]
  for (let n = 0; n < edges.length + 2; n++) {
    loop.push({ x: current.x2, y: current.y2 })
    used.add(ek(current.x1, current.y1, current.x2, current.y2))
    if (Math.abs(current.x2 - loop[0].x) < 1e-9 && Math.abs(current.y2 - loop[0].y) < 1e-9 && loop.length > 2) {
      break
    }
    const next = edges.find(e =>
      !used.has(ek(e.x1, e.y1, e.x2, e.y2)) &&
      Math.abs(e.x1 - current.x2) < 1e-9 &&
      Math.abs(e.y1 - current.y2) < 1e-9
    )
    if (!next) break
    current = next
  }
  if (loop.length > 1) {
    const last = loop[loop.length - 1]
    if (Math.abs(last.x - loop[0].x) < 1e-9 && Math.abs(last.y - loop[0].y) < 1e-9) {
      loop.pop()
    }
  }
  return simplifyColinear(loop)
}

function boxToLoop(box) {
  return [
    { x: box.minX, y: box.maxY },
    { x: box.maxX, y: box.maxY },
    { x: box.maxX, y: box.minY },
    { x: box.minX, y: box.minY },
  ]
}

function sharpOptions(generatorOptions) {
  return {
    ...generatorOptions,
    switchFilletRadius: new Decimal(0),
    stabilizerFilletRadius: new Decimal(0),
  }
}

function modelToClosedLoops(model) {
  if (!model) return []
  const copy = makerjs.model.clone(model)
  makerjs.model.originate(copy)
  const chains = makerjs.model.findChains(copy, { pointMatchingDistance: 0.08 }) || []
  const list = Array.isArray(chains) ? chains : []
  return list.map(chain => {
    const pts = makerjs.chain.toKeyPoints(chain, 0.35) || []
    if (pts.length < 3) return null
    return simplifyColinear(pts.map(p => ({ x: p[0], y: p[1] })))
  }).filter(Boolean)
}

function longestLoop(loops) {
  return (loops || []).slice().sort((a, b) => b.length - a.length)[0] || null
}

function isOutlineStabType(type) {
  return type === "mx-spec"
}

function bumpFits(half, bump, blend, notch) {
  const dy = bump + blend - notch
  const spread = (bump + blend) * (bump + blend) - dy * dy
  const dx = Math.sqrt(Math.max(0.01, spread))
  const flatHalf = Math.max(0.2, blend * 0.5)
  return half > flatHalf + dx + 0.2
}

function placeBumpOnEdge(p, q, settings) {
  const dx = q.x - p.x
  const dy = q.y - p.y
  const len = Math.hypot(dx, dy)
  const half = len / 2
  if (!bumpFits(half, settings.bump, settings.blend, settings.notch)) {
    return null
  }
  const flatHalf = Math.max(0.2, settings.blend * 0.5)
  let bump = bottomBumpPaths(half, settings.bump, settings.blend, settings.notch, flatHalf)
  bump = makerjs.model.moveRelative(bump, [0, half])
  const outward = { x: -dy / len, y: dx / len }
  const target = Math.atan2(outward.y, outward.x) * 180 / Math.PI
  bump = makerjs.model.rotate(bump, target + 90)
  bump = makerjs.model.moveRelative(bump, [(p.x + q.x) / 2, (p.y + q.y) / 2])
  return bump
}

function lineRecord(id, path) {
  const p = { x: path.origin[0], y: path.origin[1] }
  const q = { x: path.end[0], y: path.end[1] }
  return {
    id,
    p,
    q,
    mx: (p.x + q.x) / 2,
    my: (p.y + q.y) / 2,
    len: Math.hypot(q.x - p.x, q.y - p.y),
    horiz: Math.abs(q.y - p.y) < 0.08,
    vert: Math.abs(q.x - p.x) < 0.08,
  }
}

function pickLongest(list) {
  return list.slice().sort((a, b) => b.len - a.len)[0] || null
}

function cardinalLineIds(records) {
  const horiz = records.filter(r => r.horiz)
  const vert = records.filter(r => r.vert)
  if (!horiz.length || !vert.length) return {}
  const topY = Math.max(...horiz.map(r => r.my))
  const botY = Math.min(...horiz.map(r => r.my))
  const leftX = Math.min(...vert.map(r => r.mx))
  const rightX = Math.max(...vert.map(r => r.mx))
  return {
    top: pickLongest(horiz.filter(r => Math.abs(r.my - topY) < 0.08)),
    bottom: pickLongest(horiz.filter(r => Math.abs(r.my - botY) < 0.08)),
    left: pickLongest(vert.filter(r => Math.abs(r.mx - leftX) < 0.08)),
    right: pickLongest(vert.filter(r => Math.abs(r.mx - rightX) < 0.08)),
  }
}

function switchTopBottomIds(records, switchBox) {
  if (!switchBox) return {}
  const horiz = records.filter(r => r.horiz)
  return {
    top: pickLongest(horiz.filter(r =>
      Math.abs(r.my - switchBox.maxY) < 0.12 &&
      r.mx > switchBox.minX &&
      r.mx < switchBox.maxX
    )),
    bottom: pickLongest(horiz.filter(r =>
      Math.abs(r.my - switchBox.minY) < 0.12 &&
      r.mx > switchBox.minX &&
      r.mx < switchBox.maxX
    )),
  }
}

function outlineFromLoop(loop, settings, bumpPlan) {
  if (!loop || loop.length < 3) return null
  const n = loop.length
  const model = { paths: {}, models: {} }
  for (let i = 0; i < n; i++) {
    const a = loop[i]
    const b = loop[(i + 1) % n]
    model.paths["e" + i] = new makerjs.paths.Line([a.x, a.y], [b.x, b.y])
  }

  if (settings.cornerFillet > 0.001) {
    for (let i = 0; i < n; i++) {
      const fillet = makerjs.path.fillet(model.paths["e" + i], model.paths["e" + ((i + 1) % n)], settings.cornerFillet)
      if (fillet) model.paths["f" + i] = fillet
    }
  }

  if (settings.bump <= 0.05) {
    return model
  }

  const records = Object.keys(model.paths)
    .filter(id => model.paths[id] && model.paths[id].type === "line")
    .map(id => lineRecord(id, model.paths[id]))
  const plan = bumpPlan || { mode: "cardinal" }
  const chosen = plan.mode === "switchTB"
    ? switchTopBottomIds(records, plan.switchBox)
    : cardinalLineIds(records)
  let bumpId = 0
  for (const kind of ["top", "bottom", "left", "right"]) {
    const rec = chosen[kind]
    if (!rec || !model.paths[rec.id]) continue
    const bump = placeBumpOnEdge(rec.p, rec.q, settings)
    if (!bump) continue
    delete model.paths[rec.id]
    model.models["bump" + bumpId] = bump
    bumpId += 1
  }
  return model
}

function layoutKey(key) {
  if (!key.skipOrientationFix && key.height > key.width) {
    return {
      ...key,
      width: key.height,
      height: key.width,
      skipOrientationFix: true,
    }
  }
  return key
}

function fallbackSquare(settings, generatorOptions) {
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

export function resolveBackCutSettings(layerOutlines, familyId, switchFillet, stabFillet) {
  const saved = (layerOutlines && layerOutlines["Top-BACK_CUT"]) || {}
  const defaults = backCutDefaultsForFamily(familyId)
  const offset = num(saved.offset, defaults.offset)
  return {
    offset,
    bump: familyId === "choc" ? 0 : num(saved.bump, defaults.bump),
    blend: num(saved.blend, defaults.blend),
    notch: num(saved.notch, defaults.notch),
    switchFillet: num(switchFillet, 0.5),
    stabFillet: num(stabFillet, 0.5),
    cornerFillet: num(switchFillet, 0.5),
  }
}

export function generateBackCutTemplate(settings, generatorOptions) {
  return fallbackSquare(settings, generatorOptions)
}

function buildKeyBackCut(key, switchGenerator, stabilizerGenerator, settings, generatorOptions) {
  const keyH = layoutKey(key)
  const sharp = sharpOptions(generatorOptions)
  let switchModel = null
  try {
    switchModel = switchGenerator.generate(keyH, sharp)
  } catch (error) {
    switchModel = null
  }
  let stabModel = null
  try {
    stabModel = stabilizerGenerator && stabilizerGenerator.generate(keyH, sharp)
  } catch (error) {
    stabModel = null
  }

  if (stabModel) {
    const rel = key.stabilizerAngle.minus(key.independentSwitchAngle).times(-1).toNumber()
    if (Math.abs(rel) > 0.01) {
      stabModel = makerjs.model.rotate(stabModel, rel)
    }
  }

  const switchBox = measureBox(switchModel)
  if (!switchBox) {
    return fallbackSquare(settings, generatorOptions)
  }

  const hasStabs = !!(stabModel && leafBoxes(stabModel).length)
  const local = {
    ...settings,
    cornerFillet: hasStabs ? settings.stabFillet : settings.switchFillet,
  }

  const stabType = generatorOptions && generatorOptions.stabilizerCutoutType
  let outlineLoop = null
  let bumpPlan = { mode: "cardinal" }

  if (hasStabs && isOutlineStabType(stabType)) {
    const switchLoop = offsetLoop(boxToLoop(switchBox), local.offset)
    const stabLoops = modelToClosedLoops(stabModel).map(loop => offsetLoop(loop, local.offset))
    const grownStab = stabLoops.length > 1 ? unionLoopsToLoop(stabLoops) : stabLoops[0]
    outlineLoop = grownStab
      ? unionLoopsToLoop([switchLoop, grownStab])
      : switchLoop
    bumpPlan = {
      mode: "switchTB",
      switchBox: {
        minX: switchBox.minX - local.offset,
        minY: switchBox.minY - local.offset,
        maxX: switchBox.maxX + local.offset,
        maxY: switchBox.maxY + local.offset,
      },
    }
  } else {
    const stabBoxes = leafBoxes(stabModel)
    const rects = [switchBox]
    const stabBar = connectStabBar(stabBoxes)
    if (stabBar) {
      rects.push(stabBar)
      rects.push(...bridgeRects(switchBox, stabBar))
    }
    outlineLoop = offsetLoop(unionRectsToLoop(rects), local.offset)
  }

  const outline = outlineFromLoop(outlineLoop, local, bumpPlan)
  if (!outline) {
    return fallbackSquare(settings, generatorOptions)
  }

  let model = outline
  if (!key.skipOrientationFix && key.height > key.width) {
    model = makerjs.model.rotate(model, -90)
  }
  return model
}

export function buildBackCutPart(keysArray, generatorOptions, layerName) {
  const settings = resolveBackCutSettings(
    generatorOptions && generatorOptions.layerOutlines,
    generatorOptions && generatorOptions.stampFamilyId,
    generatorOptions && generatorOptions.switchFilletRadius,
    generatorOptions && generatorOptions.stabilizerFilletRadius
  )
  const switchGenerator = createSwitchGenerator(generatorOptions && generatorOptions.switchCutoutType)
  const stabilizerGenerator = createStabilizerGenerator(generatorOptions && generatorOptions.stabilizerCutoutType)
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
    let instance = buildKeyBackCut(key, switchGenerator, stabilizerGenerator, settings, generatorOptions)
    instance = makerjs.model.rotate(
      instance,
      key.angle.plus(key.independentSwitchAngle).times(-1).toNumber()
    )
    instance.origin = originNum
    canvas.models["BackCut" + id] = instance
    id += 1
  }
  canvas.layer = layerName
  return canvas
}
