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
  "'": [[[0.28, 1.05], [0.22, 1.4]]],
  "`": [[[0.28, 1.05], [0.22, 1.4]]],
  "\"": [[[0.15, 1.05], [0.1, 1.4]], [[0.42, 1.05], [0.37, 1.4]]],
  "?": [
    [[0.1, 1.15], [0.15, 1.35], [0.45, 1.4], [0.55, 1.2], [0.4, 0.85], [0.3, 0.65], [0.3, 0.4]],
    [[0.28, 0], [0.32, 0.16]],
  ],
  "!": [[[0.3, 0.4], [0.3, 1.4]], [[0.28, 0], [0.32, 0.16]]],
  ";": [[[0.28, 1.05], [0.38, 1.05], [0.38, 1.15], [0.28, 1.15], [0.28, 1.05]], [[0.32, 0.12], [0.22, -0.2]]],
}

const CHAR_ALIASES = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201B": "'",
  "\u2032": "'",
  "\u201C": "\"",
  "\u201D": "\"",
}

const LOWERCASE_SCALE = 0.72

export function normalizeGlyphChar(ch) {
  return CHAR_ALIASES[ch] || ch
}

function isLowercaseLetter(ch) {
  return ch >= "a" && ch <= "z"
}

export function glyphAdvanceFactor(ch) {
  const n = normalizeGlyphChar(ch)
  if (n === "\n") return 0
  if (n === "'" || n === "`") return 0.32
  if (n === "\"") return 0.5
  if (isLowercaseLetter(n)) return 0.75 * LOWERCASE_SCALE
  return 0.75
}

export function measureStrokeWidth(text, heightMm) {
  const h = Number(heightMm) || 3
  const scale = h / 1.4
  let w = 0
  for (const ch of String(text || "")) {
    if (ch === "\n") continue
    w += glyphAdvanceFactor(ch) * scale
  }
  return w
}

function polylineToSegments(poly) {
  const segs = []
  for (let i = 1; i < poly.length; i++) {
    segs.push([poly[i - 1], poly[i]])
  }
  return segs
}

function glyphSegments(ch) {
  const n = normalizeGlyphChar(ch)
  const raw = GLYPHS[n] || GLYPHS[n.toUpperCase()]
  if (!raw) {
    return polylineToSegments([[0.05, 0], [0.55, 1.4], [0.55, 0], [0.05, 1.4]])
  }
  const segs = []
  for (const poly of raw) {
    segs.push(...polylineToSegments(poly))
  }
  return segs
}

// Hairline nick through one stroke of each closed bowl. x,y is the centre
// in the 0.6 × 1.4 glyph cell. Thickness is LETTER_SLIT_MM after scale.
export const LETTER_SLIT_MM = 0.01

const GLYPH_OPENERS = {
  "0": [{ x: 0.30, y: 0, across: 0.14, axis: "h" }],
  "4": [{ x: 0.30, y: 0.45, across: 0.14, axis: "h" }],
  "6": [{ x: 0.30, y: 0, across: 0.14, axis: "h" }],
  "8": [
    { x: 0.35, y: 0, across: 0.14, axis: "h" },
    { x: 0.30, y: 1.4, across: 0.14, axis: "h" },
  ],
  "9": [{ x: 0.30, y: 1.4, across: 0.14, axis: "h" }],
  A: [{ x: 0.30, y: 0.5, across: 0.14, axis: "h" }],
  B: [
    { x: 0.22, y: 1.4, across: 0.14, axis: "h" },
    { x: 0.20, y: 0, across: 0.14, axis: "h" },
  ],
  D: [{ x: 0.18, y: 0, across: 0.14, axis: "h" }],
  O: [{ x: 0.30, y: 0, across: 0.14, axis: "h" }],
  P: [{ x: 0.22, y: 1.4, across: 0.14, axis: "h" }],
  Q: [{ x: 0.30, y: 0, across: 0.14, axis: "h" }],
  R: [{ x: 0.22, y: 1.4, across: 0.14, axis: "h" }],
  ".": [{ x: 0.30, y: 0, across: 0.08, axis: "h" }],
  ":": [
    { x: 0.33, y: 1.05, across: 0.08, axis: "h" },
    { x: 0.33, y: 0.2, across: 0.08, axis: "h" },
  ],
}

export function glyphOpeners(ch) {
  const n = normalizeGlyphChar(ch)
  const key = Object.prototype.hasOwnProperty.call(GLYPH_OPENERS, n)
    ? n
    : String(n || "").toUpperCase()
  return GLYPH_OPENERS[key] || []
}

export function slitToBox(slit, scale) {
  const s = Number(scale) || 1
  const thick = LETTER_SLIT_MM / s
  const across = Number(slit.across) || 0.14
  if (slit.axis === "v") {
    return {
      x: slit.x - thick / 2,
      y: slit.y - across / 2,
      w: thick,
      h: across,
    }
  }
  return {
    x: slit.x - across / 2,
    y: slit.y - thick / 2,
    w: across,
    h: thick,
  }
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

function clipSegmentOutsideBoxes(a, b, boxes, inset) {
  const pad = Number.isFinite(inset) ? inset : 0.001
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
      if (t0 > 0.001) {
        next.push([p, lerp(p, q, Math.max(0, t0 - pad))])
      }
      if (t1 < 0.999) {
        next.push([lerp(p, q, Math.min(1, t1 + pad)), q])
      }
    }
    parts = next
  }
  return parts.filter(([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.002)
}

function openRectangleSegments(box) {
  const { x, y, w, h } = box
  // Three sides only — omit one short end so the nick itself is not a profile.
  return [
    [[x, y], [x + w, y]],
    [[x, y + h], [x + w, y + h]],
    [[x, y], [x, y + h]],
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
  const baseScale = h / 1.4
  const paths = {}
  let n = 0
  let x = 0
  const src = String(text || "")
  for (const ch of src) {
    if (ch === "\n") {
      continue
    }
    const scale = isLowercaseLetter(normalizeGlyphChar(ch)) ? baseScale * LOWERCASE_SCALE : baseScale
    const openers = breakProfiles ? glyphOpeners(ch).map(slit => slitToBox(slit, scale)) : []
    const segs = glyphSegments(ch)
    const clipped = openers.length
      ? segs.flatMap(([a, b]) => clipSegmentOutsideBoxes(a, b, openers, 0.001))
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
    x += glyphAdvanceFactor(ch) * baseScale
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
