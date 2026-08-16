import Decimal from "decimal.js"
import makerjs from "makerjs"
import { Key } from "./Key"
import { buildBackCutPart, unionRectsToLoop, offsetLoop, jogBlend } from "./BackCutBuilder"

function keyAt(width, height, extras = {}) {
  return new Key(
    new Decimal(-width / 2),
    new Decimal(-height / 2),
    new Decimal(width),
    new Decimal(height),
    null,
    null,
    new Decimal(extras.angle || 0),
    new Decimal(0),
    new Decimal(0),
    new Decimal(extras.switchAngle || 0),
    new Decimal(extras.stabAngle || 0),
    !!extras.shift6U,
    !!extras.skipOrientationFix
  )
}

function options(over = {}) {
  return {
    switchCutoutType: "mx-basic",
    stabilizerCutoutType: "mx-basic",
    switchFilletRadius: new Decimal(0.5),
    stabilizerFilletRadius: new Decimal(0.5),
    unitWidth: new Decimal(19.05),
    unitHeight: new Decimal(19.05),
    kerf: new Decimal(0),
    stampFamilyId: "mx",
    ...over,
  }
}

function pointIn(x, y, loop) {
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

test("switch plus two stab housings is a bone, not a full-width bar", () => {
  const loop = unionRectsToLoop([
    { minX: -7, minY: -7, maxX: 7, maxY: 7 },
    { minX: -15.438, minY: -9, maxX: -8.438, maxY: 6 },
    { minX: 8.438, minY: -9, maxX: 15.438, maxY: 6 },
    { minX: -8.438, minY: -7, maxX: -7, maxY: 6 },
    { minX: 7, minY: -7, maxX: 8.438, maxY: 6 },
  ])
  expect(loop.length).toBe(12)
  const xs = loop.map(p => p.x)
  const ys = loop.map(p => p.y)
  expect(Math.min(...xs)).toBeCloseTo(-15.438)
  expect(Math.max(...xs)).toBeCloseTo(15.438)
  expect(Math.min(...ys)).toBeCloseTo(-9)
  expect(Math.max(...ys)).toBeCloseTo(7)
  expect(pointIn(0, 0, loop)).toBe(true)
  expect(pointIn(0, -8, loop)).toBe(false)
})

test("offset grows the bone outline by 1mm without filling the middle", () => {
  const loop = unionRectsToLoop([
    { minX: -7, minY: -7, maxX: 7, maxY: 7 },
    { minX: -15.438, minY: -9, maxX: -8.438, maxY: 6 },
    { minX: 8.438, minY: -9, maxX: 15.438, maxY: 6 },
    { minX: -8.438, minY: -7, maxX: -7, maxY: 6 },
    { minX: 7, minY: -7, maxX: 8.438, maxY: 6 },
  ])
  const grown = offsetLoop(loop, 1)
  const xs = grown.map(p => p.x)
  const ys = grown.map(p => p.y)
  expect(Math.min(...xs)).toBeCloseTo(-16.438)
  expect(Math.max(...xs)).toBeCloseTo(16.438)
  expect(Math.min(...ys)).toBeCloseTo(-10)
  expect(Math.max(...ys)).toBeCloseTo(8)
  expect(pointIn(0, -9, grown)).toBe(false)
})

test("close stab-to-switch steps become two matching tangent arcs", () => {
  const blend = jogBlend(
    { x: -15, y: 6 },
    { x: -7, y: 6 },
    { x: -7, y: 7 },
    { x: 7, y: 7 }
  )
  expect(blend).toBeTruthy()
  expect(blend.r).toBeCloseTo(0.5)
  expect(blend.P.x).toBeCloseTo(-7.5)
  expect(blend.P.y).toBeCloseTo(6)
  expect(blend.Q.x).toBeCloseTo(-6.5)
  expect(blend.Q.y).toBeCloseTo(7)
  const midDist = Math.hypot(blend.c2.x - blend.c1.x, blend.c2.y - blend.c1.y)
  expect(midDist).toBeCloseTo(1)
})

test("1U back cut stays a switch-sized square with side bumps", () => {
  const model = buildBackCutPart([keyAt(1, 1)], options(), "Top-BACK_CUT")
  const ext = makerjs.measure.modelExtents(model)
  expect(ext.high[0]).toBeGreaterThan(8)
  expect(ext.high[0]).toBeLessThan(13)
  expect(ext.high[1]).toBeGreaterThan(8)
  expect(Math.abs(ext.high[0] - ext.high[1])).toBeLessThan(0.2)
})

test("2U back cut swallows both MX stabs and is wider than the switch", () => {
  const model = buildBackCutPart([keyAt(2, 1)], options(), "Top-BACK_CUT")
  const ext = makerjs.measure.modelExtents(model)
  expect(ext.high[0]).toBeGreaterThan(16)
  expect(ext.low[0]).toBeLessThan(-16)
  expect(ext.low[1]).toBeLessThan(-8.5)
  expect(ext.high[1]).toBeGreaterThan(8)
})

test("vertical 2U rotates the merged stab outline with the key", () => {
  const model = buildBackCutPart([keyAt(1, 2)], options(), "Top-BACK_CUT")
  const ext = makerjs.measure.modelExtents(model)
  expect(ext.high[1]).toBeGreaterThan(16)
  expect(ext.low[1]).toBeLessThan(-16)
  expect(ext.high[0]).toBeGreaterThan(8)
})

test("rotated stabs still merge and flip the extra length", () => {
  const upright = buildBackCutPart([keyAt(2, 1)], options(), "Top-BACK_CUT")
  const flipped = buildBackCutPart([keyAt(2, 1, { stabAngle: 180 })], options(), "Top-BACK_CUT")
  const up = makerjs.measure.modelExtents(upright)
  const flip = makerjs.measure.modelExtents(flipped)
  expect(up.low[1]).toBeLessThan(-8.5)
  expect(flip.high[1]).toBeGreaterThan(8.5)
  expect(flip.high[0]).toBeGreaterThan(16)
})

test("MX spec expands the real stab outline instead of a bounding box", () => {
  const spec = buildBackCutPart(
    [keyAt(2, 1)],
    options({ stabilizerCutoutType: "mx-spec" }),
    "Top-BACK_CUT"
  )
  const basic = buildBackCutPart([keyAt(2, 1)], options(), "Top-BACK_CUT")
  const specExt = makerjs.measure.modelExtents(spec)
  const basicExt = makerjs.measure.modelExtents(basic)
  expect(specExt.high[0]).toBeGreaterThan(15)
  expect(specExt.low[1]).toBeGreaterThan(basicExt.low[1] + 0.4)
  expect(specExt.low[1]).toBeLessThan(-8.3)
  const specPaths = Object.keys((spec.models.BackCut0 && spec.models.BackCut0.paths) || {}).length
  const basicPaths = Object.keys((basic.models.BackCut0 && basic.models.BackCut0.paths) || {}).length
  expect(specPaths).toBeGreaterThan(basicPaths)
})

test("Choc back cut merges without MX-style bumps", () => {
  const model = buildBackCutPart(
    [keyAt(2, 1)],
    options({ switchCutoutType: "choc-cpg1350", stampFamilyId: "choc" }),
    "Top-BACK_CUT"
  )
  const ext = makerjs.measure.modelExtents(model)
  expect(ext.high[0]).toBeGreaterThan(15.5)
  expect(ext.high[0]).toBeLessThan(17)
})
