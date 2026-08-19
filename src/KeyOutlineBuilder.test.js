import Decimal from "decimal.js"
import makerjs from "makerjs"
import { parseKle } from "./KLEParser"
import {
  buildKeyOutlines,
  keyRectMm,
  KEYS_LAYER,
  KEYS_DEFAULTS,
  resolveKeysSettings,
} from "./KeyOutlineBuilder"
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

function withKeys(layerOutlines) {
  return { ...MX, layerOutlines: { Keys: layerOutlines } }
}

function countArcs(model) {
  let n = 0
  makerjs.model.walk(model, {
    onPath: walked => {
      if (walked.pathContext && walked.pathContext.type === "arc") n += 1
    },
  })
  return n
}

test("1U is the 19.05 mm cell, switch-centred in CAD y-up", () => {
  const r = keyRectMm(0, 0, 1, 1, 19.05, 19.05)
  expect(r.minX).toBeCloseTo(0, 6)
  expect(r.maxX).toBeCloseTo(19.05, 6)
  expect(r.maxY).toBeCloseTo(0, 6)
  expect(r.minY).toBeCloseTo(-19.05, 6)
  const model = buildKeyOutlines([fakeKey({ x: 0, y: 0, w: 1, h: 1 })], withKeys({ keysMode: "individual", fillet: 0 }))
  expect(model.layer).toBe(KEYS_LAYER)
  const ext = makerjs.measure.modelExtents(model)
  expect(ext.width).toBeCloseTo(19.05, 5)
  expect(ext.height).toBeCloseTo(19.05, 5)
  expect((ext.low[0] + ext.high[0]) / 2).toBeCloseTo(9.525, 5)
  expect((ext.low[1] + ext.high[1]) / 2).toBeCloseTo(-9.525, 5)
})

test("2U is twice as wide, same height", () => {
  const model = buildKeyOutlines([fakeKey({ x: 0, y: 0, w: 2, h: 1 })], withKeys({ keysMode: "individual", fillet: 0 }))
  const ext = makerjs.measure.modelExtents(model)
  expect(ext.width).toBeCloseTo(38.1, 5)
  expect(ext.height).toBeCloseTo(19.05, 5)
})

test("tall 1x2 stays a tall rectangle (keycap, not rotated switch)", () => {
  const model = buildKeyOutlines([fakeKey({ x: 0, y: 0, w: 1, h: 2 })], withKeys({ keysMode: "individual", fillet: 0 }))
  const ext = makerjs.measure.modelExtents(model)
  expect(ext.width).toBeCloseTo(19.05, 5)
  expect(ext.height).toBeCloseTo(38.1, 5)
})

test("ISO enter draws one L outline from the stem plus secondary rectangle", () => {
  const key = fakeKey({ x: 0, y: 0, w: 1.25, h: 2, w2: 1.5, h2: 1, x2: -0.25, y2: 0 })
  const model = buildKeyOutlines([key], withKeys({ keysMode: "individual", fillet: 0 }))
  expect(model.models.Individual.models.K0).toBeTruthy()
  const ext = makerjs.measure.modelExtents(model)
  expect(ext.width).toBeCloseTo(1.5 * 19.05, 5)
  expect(ext.height).toBeCloseTo(38.1, 5)
  expect(ext.low[0]).toBeCloseTo(-0.25 * 19.05, 5)
})

test("Choc 1U uses 18 x 17", () => {
  const choc = { unitWidth: new Decimal(18), unitHeight: new Decimal(17), layerOutlines: { Keys: { keysMode: "individual", fillet: 0 } } }
  const model = buildKeyOutlines([fakeKey({ x: 0, y: 0, w: 1, h: 1 })], choc)
  const ext = makerjs.measure.modelExtents(model)
  expect(ext.width).toBeCloseTo(18, 5)
  expect(ext.height).toBeCloseTo(17, 5)
})

test("parseKle ISO x2 survives into the Keys layer", () => {
  const parsed = parseKle('[[{w:1.25,h:2,w2:1.5,h2:1,x2:-0.25},"Enter"]]')
  expect(parsed.keys).toHaveLength(1)
  expect(parsed.keys[0].x2.toNumber()).toBeCloseTo(-0.25, 6)
  const model = buildKeyOutlines(parsed.keys, withKeys({ keysMode: "individual", fillet: 0 }))
  expect(model.models.Individual.models.K0).toBeTruthy()
})

test("default key fillet is 1 mm and puts arcs on a 1U", () => {
  expect(KEYS_DEFAULTS.fillet).toBe(1)
  expect(resolveKeysSettings({}).fillet).toBe(1)
  const sharp = buildKeyOutlines([fakeKey({ x: 0, y: 0, w: 1, h: 1 })], withKeys({ keysMode: "individual", fillet: 0 }))
  const round = buildKeyOutlines([fakeKey({ x: 0, y: 0, w: 1, h: 1 })], withKeys({ keysMode: "individual", fillet: 1 }))
  expect(countArcs(sharp)).toBe(0)
  expect(countArcs(round)).toBe(4)
})

test("touching 1U keys combine into one mass; a gap stays two islands", () => {
  const touching = [
    fakeKey({ x: 0, y: 0, w: 1, h: 1 }),
    fakeKey({ x: 1, y: 0, w: 1, h: 1 }),
  ]
  const gapped = [
    fakeKey({ x: 0, y: 0, w: 1, h: 1 }),
    fakeKey({ x: 2, y: 0, w: 1, h: 1 }),
  ]
  const one = buildKeyOutlines(touching, withKeys({ keysMode: "combined", fillet: 0, offset: 0, round: 0 }))
  const two = buildKeyOutlines(gapped, withKeys({ keysMode: "combined", fillet: 0, offset: 0, round: 0 }))
  expect(one.models.Individual).toBeFalsy()
  expect(Object.keys(one.models.Combined.models.G0.models).length).toBe(1)
  expect(Object.keys(two.models.Combined.models.G0.models).length).toBe(2)
  const ext = makerjs.measure.modelExtents(one)
  expect(ext.width).toBeCloseTo(38.1, 5)
  expect(ext.height).toBeCloseTo(19.05, 5)
})

test("mass offset expands the combined outline", () => {
  const keys = [fakeKey({ x: 0, y: 0, w: 1, h: 1 })]
  const raw = buildKeyOutlines(keys, withKeys({ keysMode: "combined", offset: 0, round: 0 }))
  const grown = buildKeyOutlines(keys, withKeys({ keysMode: "combined", offset: 2, round: 0 }))
  expect(makerjs.measure.modelExtents(raw).width).toBeCloseTo(19.05, 5)
  expect(makerjs.measure.modelExtents(grown).width).toBeCloseTo(23.05, 5)
})

test("both mode keeps individual keys and the combined mass", () => {
  const model = buildKeyOutlines(
    [fakeKey({ x: 0, y: 0, w: 1, h: 1 }), fakeKey({ x: 1, y: 0, w: 1, h: 1 })],
    withKeys({ keysMode: "both", fillet: 1, offset: 0, round: 1 })
  )
  expect(model.models.Individual.models.K0).toBeTruthy()
  expect(model.models.Individual.models.K1).toBeTruthy()
  expect(model.models.Combined).toBeTruthy()
})

test("Keys is drawing 3.2", () => {
  expect(KEYS_LAYER).toBe("Keys")
  expect(drawingInfoForLayer("Keys").drawingNo).toBe("3.2")
  expect(drawingInfoForLayer("Keys").drawingName).toBe("Keys")
})
