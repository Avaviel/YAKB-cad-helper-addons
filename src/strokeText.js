import makerjs from "makerjs"

// Single-line stroke glyphs so operator notes export as real DXF/SVG geometry.
// Coordinates are in a 0..1 (x) by 0..1.4 (y) cell; baseline at y=0.

const GLYPHS = {
  " ": [],
  "0": [[[0.1, 0], [0.5, 0], [0.6, 0.2], [0.6, 1.2], [0.5, 1.4], [0.1, 1.4], [0, 1.2], [0, 0.2], [0.1, 0]], [[0.05, 0.15], [0.55, 1.25]]],
  "1": [[[0.15, 1.1], [0.35, 1.4], [0.35, 0]], [[0.1, 0], [0.55, 0]]],
  "2": [[[0, 1.15], [0.1, 1.35], [0.5, 1.4], [0.6, 1.2], [0.55, 0.9], [0, 0], [0.6, 0]]],
  "3": [[[0, 1.3], [0.15, 1.4], [0.5, 1.4], [0.6, 1.2], [0.5, 0.75], [0.2, 0.7]], [[0.5, 0.75], [0.6, 0.5], [0.55, 0.1], [0.35, 0], [0, 0.1]]],
  "4": [[[0.45, 0], [0.45, 1.4]], [[0.45, 1.4], [0, 0.45], [0.65, 0.45]]],
  "5": [[[0.6, 1.4], [0.05, 1.4], [0, 0.8], [0.45, 0.85], [0.6, 0.6], [0.55, 0.1], [0.3, 0], [0, 0.15]]],
  "6": [[[0.5, 1.4], [0.15, 1.35], [0, 0.9], [0, 0.25], [0.15, 0], [0.45, 0], [0.6, 0.25], [0.55, 0.6], [0.35, 0.75], [0, 0.65]]],
  "7": [[[0, 1.4], [0.6, 1.4], [0.2, 0]]],
  "8": [[[0.15, 0.7], [0.05, 0.95], [0.1, 1.3], [0.3, 1.4], [0.5, 1.3], [0.55, 0.95], [0.45, 0.7], [0.15, 0.7], [0.05, 0.4], [0.15, 0.05], [0.35, 0], [0.55, 0.1], [0.6, 0.4], [0.45, 0.7]]],
  "9": [[[0.1, 0], [0.45, 0.05], [0.6, 0.5], [0.6, 1.15], [0.45, 1.4], [0.15, 1.4], [0, 1.15], [0.05, 0.8], [0.25, 0.65], [0.6, 0.75]]],
  A: [[[0, 0], [0.3, 1.4], [0.6, 0]], [[0.12, 0.5], [0.48, 0.5]]],
  B: [[[0, 0], [0, 1.4], [0.4, 1.4], [0.55, 1.2], [0.4, 0.75], [0, 0.75]], [[0.4, 0.75], [0.55, 0.5], [0.5, 0.1], [0.35, 0], [0, 0]]],
  C: [[[0.6, 1.2], [0.45, 1.4], [0.15, 1.4], [0, 1.15], [0, 0.25], [0.15, 0], [0.45, 0], [0.6, 0.2]]],
  D: [[[0, 0], [0, 1.4], [0.35, 1.4], [0.6, 1.1], [0.6, 0.3], [0.35, 0], [0, 0]]],
  E: [[[0.55, 1.4], [0, 1.4], [0, 0], [0.55, 0]], [[0, 0.7], [0.4, 0.7]]],
  F: [[[0.55, 1.4], [0, 1.4], [0, 0]], [[0, 0.7], [0.4, 0.7]]],
  G: [[[0.6, 1.2], [0.4, 1.4], [0.15, 1.4], [0, 1.1], [0, 0.3], [0.2, 0], [0.5, 0], [0.6, 0.25], [0.6, 0.65], [0.35, 0.65]]],
  H: [[[0, 0], [0, 1.4]], [[0.6, 0], [0.6, 1.4]], [[0, 0.7], [0.6, 0.7]]],
  I: [[[0.1, 1.4], [0.5, 1.4]], [[0.3, 1.4], [0.3, 0]], [[0.1, 0], [0.5, 0]]],
  J: [[[0.5, 1.4], [0.5, 0.3], [0.35, 0], [0.1, 0], [0, 0.2]]],
  K: [[[0, 0], [0, 1.4]], [[0.6, 1.4], [0, 0.7], [0.6, 0]]],
  L: [[[0, 1.4], [0, 0], [0.55, 0]]],
  M: [[[0, 0], [0, 1.4], [0.3, 0.7], [0.6, 1.4], [0.6, 0]]],
  N: [[[0, 0], [0, 1.4], [0.6, 0], [0.6, 1.4]]],
  O: [[[0.15, 0], [0.45, 0], [0.6, 0.25], [0.6, 1.15], [0.45, 1.4], [0.15, 1.4], [0, 1.15], [0, 0.25], [0.15, 0]]],
  P: [[[0, 0], [0, 1.4], [0.4, 1.4], [0.6, 1.2], [0.55, 0.85], [0.35, 0.7], [0, 0.7]]],
  Q: [[[0.15, 0], [0.45, 0], [0.6, 0.25], [0.6, 1.15], [0.45, 1.4], [0.15, 1.4], [0, 1.15], [0, 0.25], [0.15, 0]], [[0.35, 0.4], [0.65, -0.1]]],
  R: [[[0, 0], [0, 1.4], [0.4, 1.4], [0.6, 1.2], [0.55, 0.85], [0.3, 0.7], [0, 0.7]], [[0.3, 0.7], [0.6, 0]]],
  S: [[[0.6, 1.2], [0.45, 1.4], [0.15, 1.4], [0, 1.15], [0.1, 0.85], [0.5, 0.55], [0.6, 0.25], [0.45, 0], [0.1, 0], [0, 0.2]]],
  T: [[[0, 1.4], [0.6, 1.4]], [[0.3, 1.4], [0.3, 0]]],
  U: [[[0, 1.4], [0, 0.25], [0.15, 0], [0.45, 0], [0.6, 0.25], [0.6, 1.4]]],
  V: [[[0, 1.4], [0.3, 0], [0.6, 1.4]]],
  W: [[[0, 1.4], [0.15, 0], [0.3, 0.7], [0.45, 0], [0.6, 1.4]]],
  X: [[[0, 1.4], [0.6, 0]], [[0.6, 1.4], [0, 0]]],
  Y: [[[0, 1.4], [0.3, 0.7], [0.6, 1.4]], [[0.3, 0.7], [0.3, 0]]],
  Z: [[[0, 1.4], [0.6, 1.4], [0, 0], [0.6, 0]]],
  ".": [[[0.25, 0], [0.35, 0], [0.35, 0.12], [0.25, 0.12], [0.25, 0]]],
  ",": [[[0.3, 0.12], [0.2, -0.2]]],
  "-": [[[0.05, 0.7], [0.55, 0.7]]],
  "_": [[[0, 0], [0.6, 0]]],
  "+": [[[0.05, 0.7], [0.55, 0.7]], [[0.3, 0.35], [0.3, 1.05]]],
  "/": [[[0.05, 0], [0.55, 1.4]]],
  "\\": [[[0.05, 1.4], [0.55, 0]]],
  "(": [[[0.45, 1.4], [0.2, 1.1], [0.15, 0.7], [0.2, 0.3], [0.45, 0]]],
  ")": [[[0.15, 1.4], [0.4, 1.1], [0.45, 0.7], [0.4, 0.3], [0.15, 0]]],
  ":": [[[0.28, 1.05], [0.38, 1.05], [0.38, 1.15], [0.28, 1.15], [0.28, 1.05]], [[0.28, 0.2], [0.38, 0.2], [0.38, 0.3], [0.28, 0.3], [0.28, 0.2]]],
}

function polylineToSegments(poly) {
  const segs = []
  for (let i = 1; i < poly.length; i++) {
    segs.push([poly[i - 1], poly[i]])
  }
  return segs
}

function glyphSegments(ch) {
  const raw = GLYPHS[ch] || GLYPHS[ch.toUpperCase()]
  if (!raw) {
    return polylineToSegments([[0.05, 0], [0.55, 1.4], [0.55, 0], [0.05, 1.4]])
  }
  const segs = []
  for (const poly of raw) {
    segs.push(...polylineToSegments(poly))
  }
  return segs
}

// Small boxes that sit on closed bowls so Fusion cannot treat O / 0 / R / …
// as sketch profiles. Units are the same 0.6 × 1.4 glyph cell.
// Bottom of O/0, top of R/P, both bowls of B/8.
const GLYPH_OPENERS = {
  "0": [{ x: 0.12, y: -0.04, w: 0.36, h: 0.26 }],
  "4": [{ x: 0.08, y: 0.32, w: 0.44, h: 0.22 }],
  "6": [{ x: 0.10, y: -0.04, w: 0.40, h: 0.28 }],
  "8": [
    { x: 0.12, y: -0.04, w: 0.36, h: 0.24 },
    { x: 0.12, y: 0.58, w: 0.36, h: 0.24 },
  ],
  "9": [{ x: 0.10, y: 1.12, w: 0.40, h: 0.28 }],
  A: [{ x: 0.10, y: 0.40, w: 0.40, h: 0.22 }],
  B: [
    { x: 0.08, y: 1.04, w: 0.38, h: 0.32 },
    { x: 0.08, y: -0.04, w: 0.38, h: 0.28 },
  ],
  D: [{ x: 0.16, y: -0.04, w: 0.34, h: 0.26 }],
  O: [{ x: 0.12, y: -0.04, w: 0.36, h: 0.26 }],
  P: [{ x: 0.08, y: 1.04, w: 0.40, h: 0.32 }],
  Q: [{ x: 0.12, y: -0.04, w: 0.36, h: 0.26 }],
  R: [{ x: 0.08, y: 1.04, w: 0.40, h: 0.32 }],
  ".": [{ x: 0.18, y: -0.04, w: 0.24, h: 0.20 }],
  ":": [
    { x: 0.20, y: 0.98, w: 0.26, h: 0.24 },
    { x: 0.20, y: 0.12, w: 0.26, h: 0.24 },
  ],
}

export function glyphOpeners(ch) {
  const key = Object.prototype.hasOwnProperty.call(GLYPH_OPENERS, ch)
    ? ch
    : String(ch || "").toUpperCase()
  return GLYPH_OPENERS[key] || []
}

function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

function insideInterval(a, b, box) {
  let t0 = 0
  let t1 = 1
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const checks = [
    [-dx, a[0] - box.x],
    [dx, box.x + box.w - a[0]],
    [-dy, a[1] - box.y],
    [dy, box.y + box.h - a[1]],
  ]
  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return null
      continue
    }
    const t = q / p
    if (p < 0) {
      if (t > t1) return null
      if (t > t0) t0 = t
    } else {
      if (t < t0) return null
      if (t < t1) t1 = t
    }
  }
  return t0 < t1 ? [t0, t1] : null
}

function clipSegmentOutsideBoxes(a, b, boxes, inset = 0.03) {
  let parts = [[a, b]]
  for (const box of boxes) {
    const next = []
    for (const [p, q] of parts) {
      const hit = insideInterval(p, q, box)
      if (!hit) {
        next.push([p, q])
        continue
      }
      const [t0, t1] = hit
      if (t0 > 0.02) {
        next.push([p, lerp(p, q, Math.max(0, t0 - inset))])
      }
      if (t1 < 0.98) {
        next.push([lerp(p, q, Math.min(1, t1 + inset)), q])
      }
    }
    parts = next
  }
  return parts.filter(([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.02)
}

function openRectangleSegments(box) {
  const { x, y, w, h } = box
  const gap = Math.max(h * 0.35, 0.08)
  const mid = y + h / 2
  return [
    [[x, y], [x + w, y]],
    [[x, y + h], [x + w, y + h]],
    [[x, y], [x, y + h]],
    [[x + w, y], [x + w, mid - gap / 2]],
    [[x + w, mid + gap / 2], [x + w, y + h]],
  ]
}

/**
 * Build a maker.js model of stroked text. Origin is the bottom-left of the first glyph.
 * @param {string} text
 * @param {number} heightMm
 * @param {{ breakProfiles?: boolean }} [options]  title-block text: clip closed
 *   bowls and draw an open rectangle (one vertical side has a gap) so Fusion
 *   cannot treat O / 0 / R as solids.
 */
export function strokeTextModel(text, heightMm = 3, options) {
  const breakProfiles = !!(options && options.breakProfiles)
  const h = Number(heightMm) || 3
  const scale = h / 1.4
  const advance = 0.75 * scale
  const paths = {}
  let n = 0
  let x = 0
  const src = String(text || "")
  for (const ch of src) {
    if (ch === "\n") {
      continue
    }
    const openers = breakProfiles ? glyphOpeners(ch) : []
    const segs = glyphSegments(ch)
    const clipped = openers.length
      ? segs.flatMap(([a, b]) => clipSegmentOutsideBoxes(a, b, openers))
      : segs
    for (const [a, b] of clipped) {
      paths["s" + n] = new makerjs.paths.Line(
        [x + a[0] * scale, a[1] * scale],
        [x + b[0] * scale, b[1] * scale]
      )
      n += 1
    }
    if (breakProfiles) {
      for (const box of openers) {
        for (const [a, b] of openRectangleSegments(box)) {
          paths["s" + n] = new makerjs.paths.Line(
            [x + a[0] * scale, a[1] * scale],
            [x + b[0] * scale, b[1] * scale]
          )
          n += 1
        }
      }
    }
    x += advance
  }
  return { paths }
}

export function sanitizeNoteForLayer(note) {
  return String(note || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_.-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40)
}

export function annotatedLayerName(baseName, note) {
  const suffix = sanitizeNoteForLayer(note)
  return suffix ? `${baseName}__${suffix}` : baseName
}
