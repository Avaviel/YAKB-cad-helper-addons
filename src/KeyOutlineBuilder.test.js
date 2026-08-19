import Decimal from "decimal.js"
import makerjs from "makerjs"
import { parseKle } from "./KLEParser"
import { buildKeyOutlines, keyRectMm, KEYS_LAYER } from "./KeyOutlineBuilder"
import { drawingInfoForLayer } from "./TitleBlockBuilder"

function fakeKey({ x, y, w, h, w2, h2, x2, y2, angle, rotx, roty }) {
  return {
    x: new Decimal(x),
    y: new Decimal(y),
    width: new Decimal(w),
    height: new Decimal(h),
    width2: w2 == null ? null : new Decimal(w2),
    height2: h2 == null ? null : new Decimal(h2),
    x2: x2 == null ? null : new Decimal(x2),
    y2: y2 == null ? null : new Decimal(y2),
    angle: new Decimal(angle || 0),
    rotx: new Decimal(rotx || 0),
    roty: new Decimal(roty || 0),
    centerX: new Decimal(x + w / 2),
    centerY: new Decimal(y + h / 2),
  }
}

const MX = { unitWidth: new Decimal(19.05), unitHeight: new Decimal(19.05) }

test("1U is the 19.05 mm cell, switch-centred in CAD y-up", () => {
  const r = keyRectMm(0, 0, 1, 1, 19.05, 19.05)
  expect(r.minX).toBeCloseTo(0, 6)
  expect(r.maxX).toBeCloseTo(19.05, 6)
  expect(r.maxY).toBeCloseTo(0, 6)
  expect(r.minY).toBeCloseTo(-19.05, 6)
  const model = buildKeyOutlines([fakeKey({ x: 0, y: 0, w: 1, h: 1 })], MX)
  expect(model.layer).toBe(KEYS_LAYER)
  const ext = makerjs.measure.modelExtents(model)
  expect(ext.width).toBeCloseTo(19.05, 5)
  expect(ext.height).toBeCloseTo(19.05, 5)
  expect((ext.low[0] + ext.high[0]) / 2).toBeCloseTo(9.525, 5)
  expect((ext.low[1] + ext.high[1]) / 2).toBeCloseTo(-9.525, 5)
})

test("2U is twice as wide, same height", () => {
  const model = buildKeyOutlines([fakeKey({ x: 0, y: 0, w: 2, h: 1 })], MX)
  const ext = makerjs.measure.modelExtents(model)
  expect(ext.width).toBeCloseTo(38.1, 5)
  expect(ext.height).toBeCloseTo(19.05, 5)
})

test("tall 1x2 stays a tall rectangle (keycap, not rotated switch)", () => {
  const model = buildKeyOutlines([fakeKey({ x: 0, y: 0, w: 1, h: 2 })], MX)
  const ext = makerjs.measure.modelExtents(model)
  expect(ext.width).toBeCloseTo(19.05, 5)
  expect(ext.height).toBeCloseTo(38.1, 5)
})

test("ISO enter draws the stem plus the secondary rectangle", () => {
  const key = fakeKey({ x: 0, y: 0, w: 1.25, h: 2, w2: 1.5, h2: 1, x2: -0.25, y2: 0 })
  const model = buildKeyOutlines([key], MX)
  expect(model.models.K0.models.a).toBeTruthy()
  expect(model.models.K0.models.b).toBeTruthy()
  const ext = makerjs.measure.modelExtents(model)
  expect(ext.width).toBeCloseTo(1.5 * 19.05, 5)
  expect(ext.height).toBeCloseTo(38.1, 5)
  expect(ext.low[0]).toBeCloseTo(-0.25 * 19.05, 5)
})

test("Choc 1U uses 18 x 17", () => {
  const choc = { unitWidth: new Decimal(18), unitHeight: new Decimal(17) }
  const model = buildKeyOutlines([fakeKey({ x: 0, y: 0, w: 1, h: 1 })], choc)
  const ext = makerjs.measure.modelExtents(model)
  expect(ext.width).toBeCloseTo(18, 5)
  expect(ext.height).toBeCloseTo(17, 5)
})

test("parseKle ISO x2 survives into the Keys layer", () => {
  const parsed = parseKle('[[{w:1.25,h:2,w2:1.5,h2:1,x2:-0.25},"Enter"]]')
  expect(parsed.keys).toHaveLength(1)
  expect(parsed.keys[0].x2.toNumber()).toBeCloseTo(-0.25, 6)
  const model = buildKeyOutlines(parsed.keys, MX)
  expect(model.models.K0.models.b).toBeTruthy()
})

test("Keys is drawing 3.2", () => {
  expect(KEYS_LAYER).toBe("Keys")
  expect(drawingInfoForLayer("Keys").drawingNo).toBe("3.2")
  expect(drawingInfoForLayer("Keys").drawingName).toBe("Keys")
})
