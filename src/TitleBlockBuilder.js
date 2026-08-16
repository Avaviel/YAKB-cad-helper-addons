import makerjs from "makerjs"
import { strokeTextModel } from "./strokeText"

export const TITLE_BLOCK_LAYER = "TITLE_BLOCK"
export const TITLE_BLOCK_WIDTH = 156
export const TITLE_BLOCK_HEIGHT = 48
export const TITLE_BLOCK_MARGIN = 8
export const TITLE_BLOCK_DRAWN_BY = "YAKB CAD Helper"
export const TITLE_BLOCK_FULL_DRAWING_NO = "1.1-3.1"
export const TITLE_BLOCK_FULL_DRAWING_NAME = "Plate export"

const DRAWING_NUMBERS = {
  "Top-SWITCH_PLATE": "1.1",
  "Top-Dots": "1.2",
  "Top-BACK_CUT": "1.3",
  "Link-HOLE_CUTS": "2.1",
  Shell: "3.1",
}

export function todayISODate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function titleBlockLayerName(drawingNo) {
  if (!drawingNo || drawingNo === TITLE_BLOCK_FULL_DRAWING_NO) {
    return TITLE_BLOCK_LAYER
  }
  return `${TITLE_BLOCK_LAYER}_${String(drawingNo).replace(/[^A-Za-z0-9]+/g, "_")}`
}

export function drawingInfoForLayer(layerName) {
  const base = String(layerName || "").split("__")[0]
  if (DRAWING_NUMBERS[base]) {
    return { drawingNo: DRAWING_NUMBERS[base], drawingName: base }
  }
  if (/HOTSWAP/i.test(base) || /^Link-CHOC/i.test(base)) {
    return { drawingNo: "2.2", drawingName: base || "Hotswap" }
  }
  if (base.indexOf("Top-") === 0) {
    return { drawingNo: "1", drawingName: base }
  }
  if (base.indexOf("Link-") === 0) {
    return { drawingNo: "2", drawingName: base }
  }
  if (base.indexOf("Shell") === 0) {
    return { drawingNo: "3.1", drawingName: base }
  }
  return { drawingNo: TITLE_BLOCK_FULL_DRAWING_NO, drawingName: base || TITLE_BLOCK_FULL_DRAWING_NAME }
}

function strokeWidth(text, heightMm) {
  const h = Number(heightMm) || 3
  const scale = h / 1.4
  const advance = 0.75 * scale
  return String(text || "").replace(/\n/g, "").length * advance
}

function fitText(text, heightMm, maxWidth) {
  let t = String(text || "")
  while (t.length && strokeWidth(t, heightMm) > maxWidth) {
    t = t.slice(0, -1)
  }
  return t
}

function placeText(text, x, y, heightMm, maxWidth) {
  const value = fitText(text, heightMm, maxWidth)
  const model = strokeTextModel(value, heightMm)
  model.origin = [x, y]
  return model
}

function labeledInline(label, value, x, y, width) {
  const labelH = 1.55
  const valueH = 2.35
  const labelGap = 2.2
  const labelW = Math.min(strokeWidth(label, labelH) + labelGap, width * 0.42)
  return {
    models: {
      label: placeText(label, x, y, labelH, labelW),
      value: placeText(value, x + labelW, y - 0.15, valueH, width - labelW - 0.4),
    },
  }
}

function labeledIndented(label, value, x, y, width) {
  const labelH = 1.55
  const valueH = 2.25
  return {
    models: {
      label: placeText(label, x, y + 5.4, labelH, width - 0.4),
      value: placeText(value, x + 8, y + 1.1, valueH, width - 9),
    },
  }
}

export function titleBlockOriginFromExtents(extents, margin = TITLE_BLOCK_MARGIN) {
  if (!extents || !extents.high || !extents.low) {
    return [0, 0]
  }
  const gap = Number.isFinite(margin) ? margin : TITLE_BLOCK_MARGIN
  return [
    extents.high[0] - TITLE_BLOCK_WIDTH,
    extents.low[1] - gap - TITLE_BLOCK_HEIGHT,
  ]
}

/**
 * Rectangular title block. Local origin is the bottom-left of the box.
 */
export function buildTitleBlock(fields) {
  const W = TITLE_BLOCK_WIDTH
  const H = TITLE_BLOCK_HEIGHT
  const title = String((fields && fields.title) || "").trim()
  const drawingName = String((fields && fields.drawingName) || TITLE_BLOCK_FULL_DRAWING_NAME).trim()
  const drawingNo = String((fields && fields.drawingNo) || TITLE_BLOCK_FULL_DRAWING_NO).trim()
  const date = String((fields && fields.date) || "").trim()
  const designer = String((fields && fields.designer) || "").trim()
  const jobNo = String((fields && fields.jobNo) || "").trim()
  const notes = String((fields && fields.notes) || "").trim()
  const drawnBy = TITLE_BLOCK_DRAWN_BY

  const botH = 11
  const midH = 12
  const yMid = botH
  const yHead = botH + midH
  const headerW = 100
  const headerRow = (H - yHead) / 3
  const pad = 1.5
  const col = W / 3
  const jobW = W * 0.55

  const model = {
    paths: {
      outerBottom: new makerjs.paths.Line([0, 0], [W, 0]),
      outerRight: new makerjs.paths.Line([W, 0], [W, H]),
      outerTop: new makerjs.paths.Line([W, H], [0, H]),
      outerLeft: new makerjs.paths.Line([0, H], [0, 0]),
      splitHead: new makerjs.paths.Line([0, yHead], [W, yHead]),
      splitMid: new makerjs.paths.Line([0, yMid], [W, yMid]),
      headRow1: new makerjs.paths.Line([0, yHead + headerRow], [headerW, yHead + headerRow]),
      headRow2: new makerjs.paths.Line([0, yHead + headerRow * 2], [headerW, yHead + headerRow * 2]),
      headBlank: new makerjs.paths.Line([headerW, yHead], [headerW, H]),
      midV1: new makerjs.paths.Line([col, yMid], [col, yHead]),
      midV2: new makerjs.paths.Line([col * 2, yMid], [col * 2, yHead]),
      botV: new makerjs.paths.Line([jobW, 0], [jobW, yMid]),
    },
    models: {
      title: labeledInline("TITLE", title, pad, yHead + headerRow * 2 + 2.4, headerW - pad * 2),
      drawing: labeledInline("DRAWING", drawingName, pad, yHead + headerRow + 2.4, headerW - pad * 2),
      drawingNo: labeledInline("DRAWING NO.", drawingNo, pad, yHead + 2.4, headerW - pad * 2),
      date: labeledIndented("DATE", date, pad, yMid + 1, col - pad * 2),
      drawnBy: labeledIndented("DRAWN BY", drawnBy, col + pad, yMid + 1, col - pad * 2),
      designer: labeledIndented("DESIGNER", designer, col * 2 + pad, yMid + 1, col - pad * 2),
      job: labeledIndented("JOB NO.", jobNo, pad, 1, jobW - pad * 2),
      notes: labeledIndented("NOTES", notes, jobW + pad, 1, W - jobW - pad * 2),
    },
    layer: TITLE_BLOCK_LAYER,
    width: W,
    height: H,
  }

  makerjs.model.originate(model)
  return model
}

export function placeTitleBlock(block, extents, margin = TITLE_BLOCK_MARGIN) {
  if (!block) {
    return null
  }
  block.origin = titleBlockOriginFromExtents(extents, margin)
  return block
}

export function titleBlockFieldsFromOptions(generatorOptions, drawingName, drawingNo) {
  const saved = (generatorOptions && generatorOptions.titleBlock) || {}
  return {
    title: generatorOptions && generatorOptions.keyboardTitle,
    drawingName: drawingName || TITLE_BLOCK_FULL_DRAWING_NAME,
    drawingNo: drawingNo || TITLE_BLOCK_FULL_DRAWING_NO,
    date: saved.date || todayISODate(),
    designer: saved.designer || "",
    jobNo: saved.jobNo || "",
    notes: saved.notes || "",
  }
}
