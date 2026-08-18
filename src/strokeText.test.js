import makerjs from "makerjs"
import { glyphOpeners, strokeTextModel, LETTER_SLIT_MM, slitToBox } from "./strokeText"

test("O and 0 get a bottom opener, R gets a top opener", () => {
  const o = glyphOpeners("O")
  const zero = glyphOpeners("0")
  const r = glyphOpeners("R")
  expect(o).toHaveLength(1)
  expect(zero).toHaveLength(1)
  expect(r).toHaveLength(1)
  expect(o[0].y).toBeLessThan(0.2)
  expect(r[0].y).toBeGreaterThan(0.9)
  const scale = 3 / 1.4
  const box = slitToBox(o[0], scale)
  expect(box.h * scale).toBeCloseTo(LETTER_SLIT_MM, 5)
  expect(LETTER_SLIT_MM).toBeCloseTo(0.01)
})

test("title-block text openers leave no closed chain on O 0 R B 8", () => {
  const model = strokeTextModel("O0RB8", 3, { breakProfiles: true })
  expect(Object.keys(model.paths).length).toBeGreaterThan(20)
  const chains = makerjs.model.findChains(model, { pointMatchingDistance: 0.004 }) || []
  const closed = chains.filter(chain => chain.endless)
  expect(closed).toHaveLength(0)
})

test("plain stroke text still draws a closed O (notes, not title block)", () => {
  const model = strokeTextModel("O", 3)
  const chains = makerjs.model.findChains(model, { pointMatchingDistance: 0.05 }) || []
  expect(chains.some(chain => chain.endless)).toBe(true)
})
