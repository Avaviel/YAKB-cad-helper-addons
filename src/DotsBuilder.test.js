import Decimal from "decimal.js"
import { buildBackCutPart } from "./BackCutBuilder"
import {
  buildPlacedDots,
  keyHasStabs,
  keyDotLocals,
  mxStabSpacing,
  STAB_BELOW_Y_MM,
  STAB_OUTBOARD_Y_MM,
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

test("1U ortho is the four X corners", () => {
  const key = fakeKey({ x: 0, y: 0, w: 1, h: 1 })
  const pts = keyDotLocals(key, [key], MX)
  expect(keyHasStabs(key)).toBe(false)
  expect(pts).toHaveLength(4)
  expect(pts.every(p => Math.abs(Math.abs(p.x) - 9.525) < 1e-6)).toBe(true)
  expect(pts.every(p => Math.abs(Math.abs(p.y) - 9.525) < 1e-6)).toBe(true)
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

test("2U stabs: under each housing at y=-12.5, outboard at y=-5 ~19.5", () => {
  const key = fakeKey({ x: 0, y: 0, w: 2, h: 1 })
  expect(keyHasStabs(key)).toBe(true)
  expect(mxStabSpacing(key)).toEqual({ left: 11.938, right: 11.938 })
  const pts = keyDotLocals(key, [key], MX)
  expect(pts).toHaveLength(4)
  const under = pts.filter(p => Math.abs(p.y - STAB_BELOW_Y_MM) < 1e-6)
  const out = pts.filter(p => Math.abs(p.y - STAB_OUTBOARD_Y_MM) < 1e-6)
  expect(under).toHaveLength(2)
  expect(under.every(p => Math.abs(Math.abs(p.x) - 11.938) < 1e-6)).toBe(true)
  expect(out).toHaveLength(2)
  expect(Math.abs(out[0].x)).toBeCloseTo(19.538, 2)
  expect(Math.abs(out[1].x)).toBeCloseTo(19.538, 2)
})

test("6.25U outboard tracks the far housing, not 2U 19.5", () => {
  const key = fakeKey({ x: 0, y: 0, w: 6.25, h: 1 })
  const pts = keyDotLocals(key, [key], MX)
  const out = pts.filter(p => Math.abs(p.y - STAB_OUTBOARD_Y_MM) < 1e-6)
  expect(out).toHaveLength(2)
  expect(Math.abs(out[0].x)).toBeCloseTo(57.6, 1)
})

test("placed 2U dots keep the under-stab pair and drop old X bottoms", () => {
  const key = fakeKey({ x: 0, y: 0, w: 2, h: 1 })
  const opts = {
    ...MX,
    switchCutoutType: "mx-basic",
    stabilizerCutoutType: "mx-small",
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
  const oldXBottom = circles.some(c =>
    Math.hypot(c.origin[0] - (ox + 9.525), c.origin[1] - (oy - 9.525)) < 0.4
    || Math.hypot(c.origin[0] - (ox - 9.525), c.origin[1] - (oy - 9.525)) < 0.4
  )
  expect(oldXBottom).toBe(false)
  const under = circles.filter(c =>
    Math.abs(c.origin[1] - (oy - 12.5)) < 0.4
  )
  expect(under.length).toBe(2)
})
