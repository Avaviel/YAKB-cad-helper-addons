import makerjs from "makerjs"
import {
  TITLE_BLOCK_LAYER,
  TITLE_BLOCK_WIDTH,
  TITLE_BLOCK_HEIGHT,
  TITLE_BLOCK_MARGIN,
  TITLE_BLOCK_DRAWN_BY,
  drawingInfoForLayer,
  titleBlockOriginFromExtents,
  buildTitleBlock,
  placeTitleBlock,
} from "./TitleBlockBuilder"
test("drawing numbers follow the Top / Link / Shell scheme", () => {
  expect(drawingInfoForLayer("Top-SWITCH_PLATE").drawingNo).toBe("1.1")
  expect(drawingInfoForLayer("Top-Dots").drawingNo).toBe("1.2")
  expect(drawingInfoForLayer("Top-BACK_CUT").drawingNo).toBe("1.3")
  expect(drawingInfoForLayer("Link-HOLE_CUTS").drawingNo).toBe("2.1")
  expect(drawingInfoForLayer("Link-MX_HOTSWAP_BF").drawingNo).toBe("2.2")
  expect(drawingInfoForLayer("Link-CHOC_HOTSWAP").drawingNo).toBe("2.2")
  expect(drawingInfoForLayer("Shell").drawingNo).toBe("3.1")
})

test("title block sits at the bottom-right of the global extents", () => {
  const extents = { low: [0, -80], high: [200, 20] }
  const origin = titleBlockOriginFromExtents(extents)
  expect(origin[0]).toBeCloseTo(200 - TITLE_BLOCK_WIDTH)
  expect(origin[1]).toBeCloseTo(-80 - TITLE_BLOCK_MARGIN - TITLE_BLOCK_HEIGHT)
})

test("title block keeps the same origin when plate content size changes", () => {
  const global = { low: [-10, -100], high: [180, 40] }
  const originA = titleBlockOriginFromExtents(global)
  const originB = titleBlockOriginFromExtents(global)
  expect(originA).toEqual(originB)
  const smaller = { low: [0, -20], high: [40, 10] }
  const local = titleBlockOriginFromExtents(smaller)
  expect(local[0]).not.toBeCloseTo(originA[0])
})

test("title block is on TITLE_BLOCK and always credits YAKB CAD Helper", () => {
  const block = buildTitleBlock({
    title: "Desk",
    drawingName: "Top-SWITCH_PLATE",
    drawingNo: "1.1",
    date: "2026-08-16",
    designer: "Avaviel",
    jobNo: "J-1",
    notes: "cut 2mm",
  })
  expect(block.layer).toBe(TITLE_BLOCK_LAYER)
  expect(block.models.job).toBeTruthy()
  expect(block.models.drawingNo).toBeTruthy()
  expect(block.paths.headBlank).toBeTruthy()
  expect(block.models.drawnBy).toBeTruthy()
  expect(TITLE_BLOCK_DRAWN_BY).toBe("YAKB CAD Helper")
  const placed = placeTitleBlock(block, { low: [0, 0], high: [160, 80] })
  expect(placed.origin[0]).toBeCloseTo(160 - TITLE_BLOCK_WIDTH)
  expect(placed.origin[1]).toBeCloseTo(0 - TITLE_BLOCK_MARGIN - TITLE_BLOCK_HEIGHT)
})

test("title block origin uses the union of all geometry, not a single child", () => {
  const canvas = {
    models: {
      Wide: {
        paths: {
          a: new makerjs.paths.Line([0, 0], [120, 0]),
          b: new makerjs.paths.Line([120, 0], [120, 40]),
        },
      },
      Tall: {
        paths: {
          c: new makerjs.paths.Line([-20, -60], [-20, 10]),
        },
      },
    },
  }
  const extents = makerjs.measure.modelExtents(canvas)
  const origin = titleBlockOriginFromExtents(extents)
  expect(origin[0]).toBeCloseTo(extents.high[0] - TITLE_BLOCK_WIDTH)
  expect(origin[1]).toBeCloseTo(extents.low[1] - TITLE_BLOCK_MARGIN - TITLE_BLOCK_HEIGHT)
})
