import Decimal from "decimal.js"
import { buildBackCutPart } from "./BackCutBuilder"
import {
  buildPlacedDots,
  keyHasStabs,
  keyDotLocals,
  H_INSET_MM,
  STAB_BELOW_Y_MM,
  STAB_BROUGHT_IN_X_MM,
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

test("1U is an H, not the old X corners", () => {
  const key = fakeKey({ x: 0, y: 0, w: 1, h: 1 })
  const pts = keyDotLocals(key, [key], MX)
  expect(keyHasStabs(key)).toBe(false)
  expect(pts).toHaveLength(4)
  const ys = pts.map(p => p.y).sort((a, b) => a - b)
  expect(ys[0]).toBeCloseTo(-H_INSET_MM, 5)
  expect(ys[3]).toBeCloseTo(H_INSET_MM, 5)
  expect(pts.every(p => Math.abs(Math.abs(p.x) - 9.525) < 1e-6)).toBe(true)
  expect(pts.some(p => Math.abs(p.y) > 9)).toBe(false)
})

test("staggered 1U keeps H tops at +4.5 (the stagger fix)", () => {
  const above = fakeKey({ x: 0, y: 0, w: 1, h: 1 })
  const staggered = fakeKey({ x: 0.5, y: 1, w: 1, h: 1 })
  const pts = keyDotLocals(staggered, [above, staggered], MX)
  const tops = pts.filter(p => p.y > 0)
  expect(tops).toHaveLength(2)
  expect(tops.every(p => Math.abs(p.y - H_INSET_MM) < 1e-6)).toBe(true)
})

test("2U stabs: standard tops, two brought in, two outer bottom corners", () => {
  const key = fakeKey({ x: 0, y: 0, w: 2, h: 1 })
  expect(keyHasStabs(key)).toBe(true)
  const pts = keyDotLocals(key, [key], MX)
  expect(pts).toHaveLength(6)
  const tops = pts.filter(p => p.y > 0)
  const brought = pts.filter(p => Math.abs(p.y - STAB_BELOW_Y_MM) < 1e-6)
  const corners = pts.filter(p => Math.abs(p.y + 9.525) < 1e-6 && Math.abs(Math.abs(p.x) - 19.05) < 1e-6)
  expect(tops).toHaveLength(2)
  expect(tops.every(p => Math.abs(p.y - 9.525) < 1e-6)).toBe(true)
  expect(tops.every(p => Math.abs(Math.abs(p.x) - 9.525) < 1e-6)).toBe(true)
  expect(brought).toHaveLength(2)
  expect(brought.every(p => Math.abs(Math.abs(p.x) - STAB_BROUGHT_IN_X_MM) < 1e-6)).toBe(true)
  expect(corners).toHaveLength(2)
  expect(pts.some(p => Math.abs(p.x - 9.525) < 0.01 && Math.abs(p.y + 9.525) < 0.01)).toBe(false)
})

test("staggered 2U pulls standard tops in by 4.5 mm", () => {
  const above = fakeKey({ x: 0, y: 0, w: 1, h: 1 })
  const space = fakeKey({ x: 0.5, y: 1, w: 2, h: 1 })
  const pts = keyDotLocals(space, [above, space], MX)
  const tops = pts.filter(p => p.y > 0)
  expect(tops).toHaveLength(2)
  expect(tops.every(p => Math.abs(p.y - H_INSET_MM) < 1e-6)).toBe(true)
})

test("placed dots drop any peg that nicks the 2U back-cut", () => {
  const key = fakeKey({ x: 0, y: 0, w: 2, h: 1 })
  const opts = {
    ...MX,
    switchCutoutType: "mx-basic",
    stabilizerCutoutType: "mx-basic",
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
  expect(circles.length).toBeGreaterThanOrEqual(2)
})

