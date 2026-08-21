import Decimal from "decimal.js"
import makerjs from "makerjs"
import {
  buildLedCutouts,
  ledSlotLocal,
  LED_LAYER,
  LED_BELOW_MM,
  LED_WIDTH_MM,
  LED_HEIGHT_MM,
  LED_RADIUS_MM,
} from "./LedCutBuilder"
import { drawingInfoForLayer } from "./TitleBlockBuilder"

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
    skipOrientationFix: false,
  }
}

const MX = { unitWidth: new Decimal(19.05), unitHeight: new Decimal(19.05) }

test("local slot is a 7 x 1.5 stadium 5.1 mm below the switch", () => {
  expect(LED_BELOW_MM).toBe(5.1)
  expect(LED_WIDTH_MM).toBe(7)
  expect(LED_HEIGHT_MM).toBe(1.5)
  expect(LED_RADIUS_MM).toBe(0.75)
  const slot = ledSlotLocal()
  const ext = makerjs.measure.modelExtents(slot)
  expect(ext.width).toBeCloseTo(7, 5)
  expect(ext.height).toBeCloseTo(1.5, 5)
  expect((ext.low[0] + ext.high[0]) / 2).toBeCloseTo(0, 5)
  expect((ext.low[1] + ext.high[1]) / 2).toBeCloseTo(-5.1, 5)
  expect(slot.paths.right.radius).toBeCloseTo(0.75, 5)
  expect(slot.paths.left.radius).toBeCloseTo(0.75, 5)
})

test("placed 1U slot sits 5.1 mm south of the switch centre", () => {
  const key = fakeKey({ x: 0, y: 0, w: 1, h: 1 })
  const model = buildLedCutouts([key], MX)
  expect(model.layer).toBe(LED_LAYER)
  const ext = makerjs.measure.modelExtents(model)
  const ox = 9.525
  const oy = -9.525
  expect(ext.width).toBeCloseTo(7, 5)
  expect(ext.height).toBeCloseTo(1.5, 5)
  expect((ext.low[0] + ext.high[0]) / 2).toBeCloseTo(ox, 5)
  expect((ext.low[1] + ext.high[1]) / 2).toBeCloseTo(oy - 5.1, 5)
})

test("tall 1x2 rotates the slot with the switch", () => {
  const key = fakeKey({ x: 0, y: 0, w: 1, h: 2 })
  const model = buildLedCutouts([key], MX)
  const ext = makerjs.measure.modelExtents(model)
  expect(ext.width).toBeCloseTo(1.5, 5)
  expect(ext.height).toBeCloseTo(7, 5)
})

test("Top-LED is drawing 1.4", () => {
  expect(drawingInfoForLayer("Top-LED").drawingNo).toBe("1.4")
})
