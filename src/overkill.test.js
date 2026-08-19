import makerjs from "makerjs"
import { parseKle } from "./KLEParser"
import { overkillCircles, clusterMergeCircles, isKeyStaggered, isKeyStaggeredBelow, stripTopStampCircles } from "./overkill"

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

function k(x, y, w = 1, h = 1) {
  return { x, y, width: w, height: h, centerX: x + w / 2, centerY: y + h / 2 }
}

test("a 0.5U-shifted key under another row is staggered; ortho is not", () => {
  const above = k(0, 0)
  const staggered = k(0.5, 1)
  const ortho = k(0, 1)
  expect(isKeyStaggered(staggered, [above, staggered])).toBe(true)
  expect(isKeyStaggered(ortho, [above, ortho])).toBe(false)
  expect(isKeyStaggered(above, [above, staggered])).toBe(false)
  expect(isKeyStaggeredBelow(above, [above, staggered])).toBe(true)
  expect(isKeyStaggeredBelow(staggered, [above, staggered])).toBe(false)
  expect(isKeyStaggeredBelow(above, [above, ortho])).toBe(false)
})

test("inverted-T arrows stay ortho: side keys only touch the stem at a corner", () => {
  const up = k(1, 0)
  const left = k(0, 1)
  const down = k(1, 1)
  const right = k(2, 1)
  const all = [up, left, down, right]
  expect(isKeyStaggered(left, all)).toBe(false)
  expect(isKeyStaggered(right, all)).toBe(false)
  expect(isKeyStaggered(down, all)).toBe(false)
  expect(isKeyStaggered(up, all)).toBe(false)
  expect(isKeyStaggeredBelow(up, all)).toBe(false)
  expect(isKeyStaggeredBelow(left, all)).toBe(false)
  expect(isKeyStaggeredBelow(down, all)).toBe(false)
  expect(isKeyStaggeredBelow(right, all)).toBe(false)
})

test("2x3 ortho nav is four-corner, even with a caps-row Return beside the gap", () => {
  const prt2 = k(19.75, 0.5)
  const prt = k(20.75, 0.5)
  const pgup = k(21.75, 0.5)
  const del = k(19.75, 1.5)
  const end = k(20.75, 1.5)
  const pgdn = k(21.75, 1.5)
  const ret = k(16.75, 2.5, 2.25, 1)
  const all = [prt2, prt, pgup, del, end, pgdn, ret]
  for (const key of [prt2, prt, pgup, del, end, pgdn]) {
    expect(isKeyStaggered(key, all)).toBe(false)
    expect(isKeyStaggeredBelow(key, all)).toBe(false)
  }
})

test("isolated nav+arrows KLE: every 1U key is ortho, including inverted-T sides", () => {
  const kle = `[
    {name:"nav"},
    [{y:0.5,x:19.75},"prt2","prt","PgUp"],
    [{y:-0.75,x:20,w:0.5,h:0.5,d:true,_z:3},"Z3.0",{x:1.5,w:0.5,h:0.5,d:true,_z:3,_zi:1},"Z3.1"],
    [{y:-0.25,x:19.75},"Delete","End","PgDn"],
    [{y:0.25,x:20.25,w:0.5,h:0.5,d:true,_z:3,_zi:6},"Z3.6",{x:1,w:0.5,h:0.5,d:true,_z:3,_zi:2},"Z3.2"],
    [{y:-0.25,x:20.75},"Up"],
    [{x:19.75},"Left","Down","Right"]
  ]`
  const parsed = parseKle(kle)
  expect(parsed.keys.length).toBe(10)
  for (const key of parsed.keys) {
    expect(isKeyStaggered(key, parsed.keys)).toBe(false)
    expect(isKeyStaggeredBelow(key, parsed.keys)).toBe(false)
  }
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
