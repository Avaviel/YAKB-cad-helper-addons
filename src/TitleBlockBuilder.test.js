import makerjs from "makerjs"
import { strokeTextModel } from "./strokeText"
import {
  wrapTextLines,
  TITLE_BLOCK_LAYER,
  TITLE_BLOCK_WIDTH,
  TITLE_BLOCK_HEIGHT,
  TITLE_BLOCK_MARGIN,
  TITLE_BLOCK_DRAWN_BY,
  TITLE_BLOCK_GAP,
  drawingInfoForLayer,
  titleBlockLayerName,
  titleBlockOriginFromExtents,
  buildTitleBlock,
  placeTitleBlock,
  addGappedLine,
  gapAllPaths,
  formatFeatureLine,
  featureFromOutline,
} from "./TitleBlockBuilder"

test("title-block DXF layer names do not contain periods", () => {
  expect(titleBlockLayerName("1.1")).toBe("TITLE_BLOCK_1_1")
  expect(titleBlockLayerName("1.1-3.2")).toBe("TITLE_BLOCK")
  expect(titleBlockLayerName("2.2")).toBe("TITLE_BLOCK_2_2")
})

test("drawing numbers follow the Top / Link / Shell scheme", () => {
  expect(drawingInfoForLayer("Top-SWITCH_PLATE").drawingNo).toBe("1.1")
  expect(drawingInfoForLayer("Top-BACK_CUT").drawingNo).toBe("1.2")
  expect(drawingInfoForLayer("Top-Dots").drawingNo).toBe("1.3")
  expect(drawingInfoForLayer("Link-HOLE_CUTS").drawingNo).toBe("2.1")
  expect(drawingInfoForLayer("Link-MX_HOTSWAP_BF").drawingNo).toBe("2.2")
  expect(drawingInfoForLayer("Link-CHOC_HOTSWAP").drawingNo).toBe("2.2")
  expect(drawingInfoForLayer("Shell").drawingNo).toBe("3.1")
  expect(drawingInfoForLayer("Keys").drawingNo).toBe("3.2")
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
  expect(block.models.frame).toBeTruthy()
  expect(block.models.frame.paths.headBlank).toBeTruthy()
  expect(block.models.drawnBy).toBeTruthy()
  expect(block.models.feature).toBeFalsy()
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

test("cut / extrude prints in the title-block feature box", () => {
  expect(featureFromOutline({ op: "extrude", opMm: "2" })).toEqual({ op: "extrude", opMm: 2 })
  expect(formatFeatureLine({ op: "cut", opMm: 1.5 })).toBe("CUT 1.5 mm")
  expect(formatFeatureLine({ op: "extrude" })).toBe("EXTRUDE")
  const block = buildTitleBlock({
    title: "Desk",
    drawingName: "Top-SWITCH_PLATE",
    drawingNo: "1.1",
    op: "extrude",
    opMm: 2,
    showFeature: true,
  })
  expect(block.models.feature).toBeTruthy()
})

function collectPaths(model, out = []) {
  if (!model) return out
  if (model.paths) out.push(...Object.values(model.paths).filter(Boolean))
  if (model.models) {
    for (const child of Object.values(model.models)) collectPaths(child, out)
  }
  return out
}

test("tiny gaps keep title-block corners from meeting", () => {
  const paths = {}
  addGappedLine(paths, "bottom", [0, 0], [TITLE_BLOCK_WIDTH, 0])
  addGappedLine(paths, "right", [TITLE_BLOCK_WIDTH, 0], [TITLE_BLOCK_WIDTH, TITLE_BLOCK_HEIGHT])
  addGappedLine(paths, "top", [TITLE_BLOCK_WIDTH, TITLE_BLOCK_HEIGHT], [0, TITLE_BLOCK_HEIGHT])
  addGappedLine(paths, "left", [0, TITLE_BLOCK_HEIGHT], [0, 0])
  expect(Object.keys(paths).length).toBe(4)
  const corners = [
    [0, 0],
    [TITLE_BLOCK_WIDTH, 0],
    [TITLE_BLOCK_WIDTH, TITLE_BLOCK_HEIGHT],
    [0, TITLE_BLOCK_HEIGHT],
  ]
  const endpoints = Object.values(paths).flatMap(path => [path.origin, path.end])
  for (const corner of corners) {
    const hits = endpoints.filter(pt =>
      Math.abs(pt[0] - corner[0]) < 0.001 && Math.abs(pt[1] - corner[1]) < 0.001
    )
    expect(hits.length).toBe(0)
  }
  expect(TITLE_BLOCK_GAP).toBeCloseTo(0.01)
})

test("title-block letters O and R include an open cut box", () => {
  const text = strokeTextModel("OR", 2.35, { breakProfiles: true })
  const paths = Object.values(text.paths)
  expect(paths.length).toBeGreaterThan(10)
  const chains = makerjs.model.findChains(text, { pointMatchingDistance: 0.004 }) || []
  expect(chains.filter(chain => chain.endless)).toHaveLength(0)
})

test("every title-block path including text is opened so Select All will not profile the block", () => {
  const block = buildTitleBlock({
    title: "BOOD 808",
    drawingName: "Top-SWITCH_PLATE",
    drawingNo: "1.1",
    date: "2026-08-16",
    designer: "ODO",
    jobNo: "800",
    notes: "O",
    op: "cut",
    opMm: 1.5,
    showFeature: true,
  })
  const corners = [
    [0, 0],
    [TITLE_BLOCK_WIDTH, 0],
    [TITLE_BLOCK_WIDTH, TITLE_BLOCK_HEIGHT],
    [0, TITLE_BLOCK_HEIGHT],
  ]
  const paths = collectPaths(block)
  expect(paths.length).toBeGreaterThan(20)
  const endpoints = paths.flatMap(path => [path.origin, path.end])
  for (const corner of corners) {
    const hits = endpoints.filter(pt =>
      Math.abs(pt[0] - corner[0]) < 0.001 && Math.abs(pt[1] - corner[1]) < 0.001
    )
    expect(hits.length).toBe(0)
  }
  const box = {
    paths: {
      a: new makerjs.paths.Line([0, 0], [10, 0]),
      b: new makerjs.paths.Line([10, 0], [10, 10]),
      c: new makerjs.paths.Line([10, 10], [0, 10]),
      d: new makerjs.paths.Line([0, 10], [0, 0]),
    },
  }
  gapAllPaths(box)
  const boxEnds = Object.values(box.paths).flatMap(path => [path.origin, path.end])
  for (const corner of [[0, 0], [10, 0], [10, 10], [0, 10]]) {
    expect(boxEnds.some(pt => Math.abs(pt[0] - corner[0]) < 0.001 && Math.abs(pt[1] - corner[1]) < 0.001)).toBe(false)
  }
})

test("long notes wrap, keep apostrophes, and grow the bottom band", () => {
  const sample = "Here's some data for us. Can you please give me more text to test. ".repeat(3).trim()
  const lines = wrapTextLines(sample, 2.25, 40)
  expect(lines.length).toBeGreaterThan(2)
  expect(lines.join(" ")).toContain("Here's")
  expect(lines.join(" ")).toContain("test")
  const block = buildTitleBlock({
    title: "Desk",
    drawingName: "Top-SWITCH_PLATE",
    drawingNo: "1.1",
    notes: sample,
    showFeature: true,
  })
  expect(block.height).toBeGreaterThan(TITLE_BLOCK_HEIGHT)
  expect(block.models.notes.models.line0).toBeTruthy()
  expect(block.models.notes.models.line1).toBeTruthy()
})

test("overall title block keeps main notes; per-drawing block can take a section note", () => {
  const overall = buildTitleBlock({
    title: "Desk",
    notes: "Main pack note",
  })
  expect(overall.models.notes.models.line0).toBeTruthy()
  const drawing = buildTitleBlock({
    title: "Desk",
    drawingName: "Top-SWITCH_PLATE",
    drawingNo: "1.1",
    notes: "Switch plate only",
    op: "extrude",
    opMm: 3,
    showFeature: true,
  })
  expect(drawing.models.feature).toBeTruthy()
  expect(drawing.models.notes.models.line0).toBeTruthy()
})

test("per-drawing feature block is a child model, not a sibling TITLE_BLOCK layer", () => {
  const drawing = {
    layer: "Top-SWITCH_PLATE",
    models: {},
  }
  const block = buildTitleBlock({
    title: "Desk",
    drawingName: "Top-SWITCH_PLATE",
    drawingNo: "1.1",
    op: "extrude",
    opMm: 2,
    showFeature: true,
  })
  block.layer = drawing.layer
  drawing.models.TitleBlock = block
  expect(drawing.models.TitleBlock.layer).toBe("Top-SWITCH_PLATE")
  expect(drawing.models.TitleBlock.models.feature).toBeTruthy()
  expect(drawing.layer).toBe("Top-SWITCH_PLATE")
})
