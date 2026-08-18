import makerjs from "makerjs"
import { measureStrokeWidth, strokeTextModel } from "./strokeText"

export const TITLE_BLOCK_LAYER = "TITLE_BLOCK"
export const TITLE_BLOCK_WIDTH = 156
export const TITLE_BLOCK_HEIGHT = 48
export const TITLE_BLOCK_MARGIN = 8
export const TITLE_BLOCK_DRAWN_BY = "YAKB CAD Helper"
export const TITLE_BLOCK_FULL_DRAWING_NO = "1.1-3.1"
export const TITLE_BLOCK_FULL_DRAWING_NAME = "Plate export"
export const TITLE_BLOCK_GAP = 0.01

const DRAWING_NUMBERS = {
  "Top-SWITCH_PLATE": "1.1",
  "Top-BACK_CUT": "1.2",
  "Top-Dots": "1.3",
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

export function normalizeFeatureOp(value) {
  return String(value || "cut").toLowerCase() === "extrude" ? "extrude" : "cut"
}

export function featureFromOutline(saved) {
  const op = normalizeFeatureOp(saved && saved.op)
  const raw = saved && saved.opMm
  const mm = raw != null && raw !== "" ? Number(raw) : NaN
  return {
    op,
    opMm: Number.isFinite(mm) ? mm : "",
  }
}

export function formatFeatureAmount(opMm) {
  if (opMm === "" || opMm == null) {
    return ""
  }
  const mm = Number(opMm)
  if (!Number.isFinite(mm)) {
    return ""
  }
  return `${mm} mm`
}

export function formatFeatureLine(feature) {
  const op = feature && feature.op === "extrude" ? "EXTRUDE" : "CUT"
  const amount = formatFeatureAmount(feature && feature.opMm)
  return amount ? `${op} ${amount}` : op
}

function strokeWidth(text, heightMm) {
  return measureStrokeWidth(text, heightMm)
}

function fitText(text, heightMm, maxWidth) {
  let t = String(text || "")
  while (t.length && strokeWidth(t, heightMm) > maxWidth) {
    t = t.slice(0, -1)
  }
  return t
}

export function wrapTextLines(text, heightMm, maxWidth) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean)
  if (!words.length) {
    return []
  }
  const lines = []
  let current = ""
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word
    if (current && strokeWidth(trial, heightMm) > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = trial
    }
  }
  if (current) {
    lines.push(current)
  }
  return lines
}

function placeText(text, x, y, heightMm, maxWidth, clip = true) {
  const value = clip ? fitText(text, heightMm, maxWidth) : String(text || "")
  const model = strokeTextModel(value, heightMm, { breakProfiles: true })
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

function notesFromTop(lines, x, yTop, width, labelH, valueH, lineGap) {
  const models = {
    label: placeText("NOTES", x, yTop - labelH - 0.15, labelH, width - 0.4),
  }
  let y = yTop - labelH - 0.85 - valueH
  const list = lines && lines.length ? lines : [""]
  list.forEach((line, i) => {
    models["line" + i] = placeText(line, x, y, valueH, width, false)
    y -= valueH + lineGap
  })
  return { models }
}

/**
 * Pull both ends of a line back so it cannot join a neighbor into a Fusion
 * sketch profile. Short marks (punctuation) keep a smaller inset so they
 * stay visible.
 */
export function gapLineEnds(path, gap = TITLE_BLOCK_GAP) {
  if (!path) {
    return null
  }
  const isLine = path.type === "line" || path.type === makerjs.pathType.Line
  if (!isLine || !path.origin || !path.end) {
    return path
  }
  const a = path.origin
  const b = path.end
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  if (!Number.isFinite(len) || len < 1e-6) {
    return null
  }
  const inset = Math.min(gap * 0.5, len * 0.35)
  const ux = dx / len
  const uy = dy / len
  path.origin = [a[0] + ux * inset, a[1] + uy * inset]
  path.end = [b[0] - ux * inset, b[1] - uy * inset]
  return path
}

export function addGappedLine(paths, name, a, b, gap = TITLE_BLOCK_GAP) {
  if (!paths) {
    return 0
  }
  const gapped = gapLineEnds(new makerjs.paths.Line(a, b), gap)
  if (!gapped) {
    return 0
  }
  paths[name] = gapped
  return 1
}

/** @deprecated use addGappedLine — kept so older tests can call the old name */
export function addDashedLine(paths, prefix, a, b, _dash, gap = TITLE_BLOCK_GAP) {
  return addGappedLine(paths, prefix, a, b, gap)
}

export function gapAllPaths(model, gap = TITLE_BLOCK_GAP) {
  if (!model) {
    return model
  }
  if (model.paths) {
    const next = {}
    for (const [key, path] of Object.entries(model.paths)) {
      const gapped = gapLineEnds(path, gap)
      if (gapped) {
        next[key] = gapped
      }
    }
    model.paths = next
  }
  if (model.models) {
    for (const child of Object.values(model.models)) {
      gapAllPaths(child, gap)
    }
  }
  return model
}

export function titleBlockOriginFromExtents(extents, margin = TITLE_BLOCK_MARGIN, height = TITLE_BLOCK_HEIGHT) {
  if (!extents || !extents.high || !extents.low) {
    return [0, 0]
  }
  const gap = Number.isFinite(margin) ? margin : TITLE_BLOCK_MARGIN
  const h = Number.isFinite(height) && height > 0 ? height : TITLE_BLOCK_HEIGHT
  return [
    extents.high[0] - TITLE_BLOCK_WIDTH,
    extents.low[1] - gap - h,
  ]
}

/**
 * Rectangular title block. Local origin is the bottom-left of the box.
 * Every path (frame, dividers, and text) is given a tiny end-gap so Fusion
 * cannot turn the block into sketch profiles when the user selects all.
 */
export function buildTitleBlock(fields) {
  const W = TITLE_BLOCK_WIDTH
  const title = String((fields && fields.title) || "").trim()
  const drawingName = String((fields && fields.drawingName) || TITLE_BLOCK_FULL_DRAWING_NAME).trim()
  const drawingNo = String((fields && fields.drawingNo) || TITLE_BLOCK_FULL_DRAWING_NO).trim()
  const date = String((fields && fields.date) || "").trim()
  const designer = String((fields && fields.designer) || "").trim()
  const jobNo = String((fields && fields.jobNo) || "").trim()
  const notes = String((fields && fields.notes) || "").trim()
  const feature = featureFromOutline(fields)
  const showFeature = !!(fields && fields.showFeature)
  const drawnBy = TITLE_BLOCK_DRAWN_BY

  const midH = 12
  const headerH = TITLE_BLOCK_HEIGHT - 11 - midH
  const pad = 1.5
  const jobW = W * 0.55
  const notesValueH = 2.25
  const notesLabelH = 1.55
  const notesLineGap = 0.65
  const notesInnerW = W - jobW - pad * 2
  const noteLines = wrapTextLines(notes, notesValueH, notesInnerW)
  const notesBodyH = notesLabelH + 1.0 + Math.max(1, noteLines.length) * (notesValueH + notesLineGap)
  let botH = Math.max(11, notesBodyH + 1.6)
  let yMid = botH
  let yHead = botH + midH
  let H = yHead + headerH
  const minH = Number(fields && fields.minHeight)
  if (Number.isFinite(minH) && minH > H) {
    botH += minH - H
    yMid = botH
    yHead = botH + midH
    H = minH
  }
  const headerW = 100
  const headerRow = headerH / 3
  const col = W / 3

  const frame = {
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
  }

  const model = {
    paths: {},
    models: {
      frame,
      title: labeledInline("TITLE", title, pad, yHead + headerRow * 2 + 2.4, headerW - pad * 2),
      drawing: labeledInline("DRAWING", drawingName, pad, yHead + headerRow + 2.4, headerW - pad * 2),
      drawingNo: labeledInline("DRAWING NO.", drawingNo, pad, yHead + 2.4, headerW - pad * 2),
      date: labeledIndented("DATE", date, pad, yMid + 1, col - pad * 2),
      drawnBy: labeledIndented("DRAWN BY", drawnBy, col + pad, yMid + 1, col - pad * 2),
      designer: labeledIndented("DESIGNER", designer, col * 2 + pad, yMid + 1, col - pad * 2),
      job: labeledIndented("JOB NO.", jobNo, pad, yMid - 10, jobW - pad * 2),
      notes: notesFromTop(noteLines, jobW + pad, yMid - 0.4, notesInnerW, notesLabelH, notesValueH, notesLineGap),
    },
    layer: TITLE_BLOCK_LAYER,
    width: W,
    height: H,
  }

  if (showFeature) {
    const opLabel = feature.op === "extrude" ? "EXTRUDE" : "CUT"
    model.models.feature = labeledIndented(
      opLabel,
      formatFeatureAmount(feature.opMm),
      headerW + pad,
      yHead + 8,
      W - headerW - pad * 2
    )
  }

  makerjs.model.originate(model)
  // Only the frame is nicked. Letter bowls are opened by a 0.01 mm slit in
  // strokeText; gapping every text segment made counters look like they fell.
  gapAllPaths(model.models.frame, TITLE_BLOCK_GAP)
  return model
}

export function placeTitleBlock(block, extents, margin = TITLE_BLOCK_MARGIN) {
  if (!block) {
    return null
  }
  block.origin = titleBlockOriginFromExtents(extents, margin, block.height || TITLE_BLOCK_HEIGHT)
  return block
}

export function titleBlockFieldsFromOptions(generatorOptions, drawingName, drawingNo, feature) {
  const saved = (generatorOptions && generatorOptions.titleBlock) || {}
  const feat = feature ? featureFromOutline(feature) : null
  return {
    title: generatorOptions && generatorOptions.keyboardTitle,
    drawingName: drawingName || TITLE_BLOCK_FULL_DRAWING_NAME,
    drawingNo: drawingNo || TITLE_BLOCK_FULL_DRAWING_NO,
    date: saved.date || todayISODate(),
    designer: saved.designer || "",
    jobNo: saved.jobNo || "",
    notes: saved.notes || "",
    op: feat ? feat.op : undefined,
    opMm: feat ? feat.opMm : undefined,
    showFeature: !!feat,
  }
}
