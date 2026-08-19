import Decimal from "decimal.js"
import { buildBackCutPart } from "./BackCutBuilder"
import {
  buildPlacedDots,
  keyHasStabs,
  keyDotLocals,
  mxStabSpacing,
  mxStabHousing,
  STAB_CLEAR_MM,
  STAGGER_DOWN_Y_MM,
  STAGGER_ABOVE_Y_MM,
} from "./DotsBuilder"

function fakeKey({ x, y, w, h }) {
  return {
    x: new Decimal(x),
    y: new Decimal(y),
    width: new Decimal(w),
    height: new Decimal(h),
    centerX: new Decimal(x + w / 2),
    centerY: new Decimal(y + h / 2),
    angle: new Decimal(0),
    independentSwitchAngle: new Decimal(0),
    stabilizerAngle: new Decimal(0),
    skipOrientationFix: false,
    shift6UStabilizers: false,
  }
}

const MX = { unitWidth: new Decimal(19.05), unitHeight: new Decimal(19.05) }
const MX_SMALL = { ...MX, stabilizerCutoutType: "mx-small" }

test("1U ortho is the four X corners", () => {
  const key = fakeKey({ x: 0, y: 0, w: 1, h: 1 })
  const pts = keyDotLocals(key, [key], MX)
  expect(keyHasStabs(key)).toBe(false)
  expect(pts).toHaveLength(4)
  expect(pts.every(p => Math.abs(Math.abs(p.x) - 9.525) < 1e-6)).toBe(true)
  expect(pts.every(p => Math.abs(Math.abs(p.y) - 9.525) < 1e-6)).toBe(true)
})

test("number-row key over staggered Q keeps ortho tops and drops bottom X", () => {
  const number = fakeKey({ x: 0, y: 0, w: 1, h: 1 })
  const q = fakeKey({ x: 0.5, y: 1, w: 1, h: 1 })
  const pts = keyDotLocals(number, [number, q], MX)
  expect(pts).toHaveLength(2)
  expect(pts.every(p => p.y > 0)).toBe(true)
  expect(pts.every(p => Math.abs(Math.abs(p.x) - 9.525) < 1e-6)).toBe(true)
})

test("staggered 1U is ±9.525 at y=-5.25 plus centre at y=+13.8", () => {
  const above = fakeKey({ x: 0, y: 0, w: 1, h: 1 })
  const staggered = fakeKey({ x: 0.5, y: 1, w: 1, h: 1 })
  const pts = keyDotLocals(staggered, [above, staggered], MX)
  expect(pts).toHaveLength(3)
  const down = pts.filter(p => Math.abs(p.y - STAGGER_DOWN_Y_MM) < 1e-6)
  const up = pts.filter(p => Math.abs(p.y - STAGGER_ABOVE_Y_MM) < 1e-6)
  expect(down).toHaveLength(2)
  expect(down.every(p => Math.abs(Math.abs(p.x) - 9.525) < 1e-6)).toBe(true)
  expect(up).toHaveLength(1)
  expect(up[0].x).toBeCloseTo(0, 5)
})

test("2U mx-small: 1.7 mm outside each housing, mirrored on the housing", () => {
  const key = fakeKey({ x: 0, y: 0, w: 2, h: 1 })
  expect(mxStabSpacing(key)).toEqual({ left: 11.938, right: 11.938 })
  const h = mxStabHousing("mx-small")
  const yBelow = h.minY - STAB_CLEAR_MM
  const yAbove = h.maxY + STAB_CLEAR_MM
  const side = h.halfW + STAB_CLEAR_MM
  const pts = keyDotLocals(key, [key], MX_SMALL)
  expect(pts).toHaveLength(12)
  const below = pts.filter(p => Math.abs(p.y - yBelow) < 1e-6)
  const above = pts.filter(p => Math.abs(p.y - yAbove) < 1e-6)
  expect(below).toHaveLength(6)
  expect(above).toHaveLength(6)
  const leftCx = -11.938
  expect(below.some(p => Math.abs(p.x - leftCx) < 1e-6)).toBe(true)
  expect(below.some(p => Math.abs(p.x - (leftCx - side)) < 1e-6)).toBe(true)
  expect(below.some(p => Math.abs(p.x - (leftCx + side)) < 1e-6)).toBe(true)
})

test("vertical 2U rotates the housing rings to both sides (no switch-center mirror)", () => {
  const key = fakeKey({ x: 0, y: 0, w: 1, h: 2 })
  const pts = keyDotLocals(key, [key], MX_SMALL)
  expect(pts.length).toBe(12)
  expect(pts.some(p => p.x > 0.1)).toBe(true)
  expect(pts.some(p => p.x < -0.1)).toBe(true)
})

test("placed 2U dots sit 1.7 mm below the housing and not in the pocket", () => {
  const key = fakeKey({ x: 0, y: 0, w: 2, h: 1 })
  const opts = {
    ...MX_SMALL,
    switchCutoutType: "mx-basic",
    switchFilletRadius: new Decimal(0.5),
    stabilizerFilletRadius: new Decimal(0.5),
    kerf: new Decimal(0),
    stampFamilyId: "mx",
  }
  const back = buildBackCutPart([key], opts, "Top-BACK_CUT")
  const model = buildPlacedDots([key], opts, "Top-Dots", back)
  expect(model).toBeTruthy()
  const circles = Object.values(model.paths)
  const ox = 19.05
  const oy = -9.525
  const inHousing = circles.some(c =>
    Math.hypot(c.origin[0] - (ox + 11.938), c.origin[1] - oy) < 2
  )
  expect(inHousing).toBe(false)
  const yBelow = oy + (-8 - STAB_CLEAR_MM)
  const under = circles.filter(c => Math.abs(c.origin[1] - yBelow) < 0.4)
  expect(under.length).toBeGreaterThanOrEqual(1)
})
