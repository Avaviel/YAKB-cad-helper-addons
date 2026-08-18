import Decimal from "decimal.js"
import { pointIsLegal, dotsModeFromOutlines, buildGeneratedDots } from "./DotsBuilder"

test("dotsMode defaults to stamp", () => {
  expect(dotsModeFromOutlines({})).toBe("stamp")
  expect(dotsModeFromOutlines({ "Top-Dots": { dotsMode: "ex2" } })).toBe("ex2")
  expect(dotsModeFromOutlines({ "Top-Dots": { dotsMode: "nope" } })).toBe("stamp")
})

test("legal points sit in the plate and off the back-cut keepout", () => {
  const plate = [[{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }]]
  const keep = [[{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }, { x: 10, y: 20 }]]
  expect(pointIsLegal(5, 5, plate, keep)).toBe(true)
  expect(pointIsLegal(15, 15, plate, keep)).toBe(false)
  expect(pointIsLegal(50, 5, plate, keep)).toBe(false)
})

test("ex1 rim places pegs on a simple plate outline", () => {
  const outlines = [{
    zone: 1,
    offset: 0,
    fillet: 0,
    shape: "path",
    vertices: [
      { centerX: 0, centerY: 0 },
      { centerX: 4, centerY: 0 },
      { centerX: 4, centerY: 3 },
      { centerX: 0, centerY: 3 },
    ],
  }]
  const model = buildGeneratedDots({
    outlines,
    unitWidth: new Decimal(19.05),
    unitHeight: new Decimal(19.05),
    layerOutlines: { "Top-Dots": { dotsMode: "ex1" } },
  }, "Top-Dots", null)
  expect(model).toBeTruthy()
  expect(Object.keys(model.paths).length).toBeGreaterThanOrEqual(4)
})

