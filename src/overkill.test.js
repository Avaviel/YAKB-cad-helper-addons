import makerjs from "makerjs"
import { overkillCircles, cullDotsInSwitchKeepout } from "./overkill"

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

test("0.5U stagger corner on the switch centreline is culled, own corners stay", () => {
  const model = {
    paths: {
      ownCorner: new makerjs.paths.Circle([9.525, 9.525], 1.5),
      staggerOnCenter: new makerjs.paths.Circle([0, 9.525], 1.5),
      far: new makerjs.paths.Circle([30, 30], 1.5),
    },
  }
  const keys = [{ centerX: 0, centerY: 0, angle: 0, independentSwitchAngle: 0 }]
  const result = cullDotsInSwitchKeepout(model, keys, { unitWidth: 1, unitHeight: 1 }, 11)
  expect(result.removed).toBe(1)
  expect(model.paths.staggerOnCenter).toBeFalsy()
  expect(model.paths.ownCorner).toBeTruthy()
  expect(model.paths.far).toBeTruthy()
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
