import makerjs from "makerjs"
import { overkillCircles, clusterMergeCircles, isKeyStaggered, stripTopStampCircles } from "./overkill"

test("overkill keeps one circle when two share a centre", () => {
  const model = {
    paths: {
      a: new makerjs.paths.Circle([0, 0], 1.5),
      b: new makerjs.paths.Circle([0.05, 0], 1.5),
      c: new makerjs.paths.Circle([20, 0], 1.5),
    },
  }
  const result = overkillCircles(model, 0.5)
  expect(result.removed).toBe(1)
  expect(result.kept).toBe(2)
  expect(Object.keys(model.paths).length).toBe(2)
  expect(model.paths.c).toBeTruthy()
})

test("overkill leaves well-separated dots alone", () => {
  const model = {
    paths: {
      a: new makerjs.paths.Circle([-9.525, -9.525], 1.5),
      b: new makerjs.paths.Circle([9.525, -9.525], 1.5),
      c: new makerjs.paths.Circle([9.525, 9.525], 1.5),
    },
  }
  const result = overkillCircles(model, 0.5)
  expect(result.removed).toBe(0)
  expect(result.kept).toBe(3)
})

test("a 0.5U-shifted key under another row is staggered; ortho is not", () => {
  const above = { x: 0, y: 0, width: 1, height: 1, centerX: 0.5, centerY: 0.5 }
  const staggered = { x: 0.5, y: 1, width: 1, height: 1, centerX: 1, centerY: 1.5 }
  const ortho = { x: 0, y: 1, width: 1, height: 1, centerX: 0.5, centerY: 1.5 }
  expect(isKeyStaggered(staggered, [above, staggered])).toBe(true)
  expect(isKeyStaggered(ortho, [above, ortho])).toBe(false)
  expect(isKeyStaggered(above, [above, staggered])).toBe(false)
})

test("cluster merge collapses three overlapping circles in a row to one centroid", () => {
  const model = {
    paths: {
      a: new makerjs.paths.Circle([0, 0], 1.5),
      b: new makerjs.paths.Circle([1.2, 0], 1.5),
      c: new makerjs.paths.Circle([2.4, 0], 1.5),
    },
  }
  const result = clusterMergeCircles(model, 3)
  expect(result.removed).toBe(2)
  expect(result.kept).toBe(1)
  expect(Object.keys(model.paths).length).toBe(1)
  const kept = Object.values(model.paths)[0]
  expect(kept.origin[0]).toBeCloseTo(1.2, 5)
  expect(kept.origin[1]).toBeCloseTo(0, 5)
})

test("cluster merge leaves H uprights on one key alone", () => {
  const model = {
    paths: {
      a: new makerjs.paths.Circle([-9.525, 4.5], 1.5),
      b: new makerjs.paths.Circle([9.525, 4.5], 1.5),
      c: new makerjs.paths.Circle([-9.525, -4.5], 1.5),
      d: new makerjs.paths.Circle([9.525, -4.5], 1.5),
    },
  }
  const result = clusterMergeCircles(model, 3)
  expect(result.removed).toBe(0)
  expect(result.kept).toBe(4)
})

test("stripTopStampCircles removes only the +Y pair", () => {
  const model = {
    paths: {
      tl: new makerjs.paths.Circle([-9.525, 9.525], 1.5),
      tr: new makerjs.paths.Circle([9.525, 9.525], 1.5),
      bl: new makerjs.paths.Circle([-9.525, -9.525], 1.5),
      br: new makerjs.paths.Circle([9.525, -9.525], 1.5),
    },
  }
  expect(stripTopStampCircles(model)).toBe(2)
  expect(model.paths.tl).toBeFalsy()
  expect(model.paths.tr).toBeFalsy()
  expect(model.paths.bl).toBeTruthy()
  expect(model.paths.br).toBeTruthy()
})
