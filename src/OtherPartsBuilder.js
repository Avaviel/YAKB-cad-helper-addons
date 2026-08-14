import makerjs from 'makerjs'
import Decimal from 'decimal.js'
import { annotatedLayerName, strokeTextModel } from './strokeText'
import { buildOutlineModel, zoneOutlineDefaults } from './PlateBuilder'
import { defaultShellFromPlate, defaultShellFromSelf } from './otherPartsConfig'

/**
 * Convert a stamp JSON document into a maker.js model.
 * Arc angles in stamp files are stored in radians (from dxf-parser) and
 * must be converted to degrees for maker.js.
 */
export function stampJsonToModel(stampData, layerName) {
  if (!stampData || !stampData.paths) {
    throw new Error('Invalid stamp data: missing paths')
  }

  const paths = {}

  for (const [name, pathDef] of Object.entries(stampData.paths)) {
    let path = null

    if (pathDef.type === 'line') {
      path = new makerjs.paths.Line(pathDef.origin, pathDef.end)
    } else if (pathDef.type === 'circle') {
      path = new makerjs.paths.Circle(pathDef.origin, pathDef.radius)
    } else if (pathDef.type === 'arc') {
      // Stamp converter stores angles in radians; maker.js uses degrees
      const startDeg = (pathDef.startAngle * 180) / Math.PI
      const endDeg = (pathDef.endAngle * 180) / Math.PI
      path = new makerjs.paths.Arc(pathDef.origin, pathDef.radius, startDeg, endDeg)
    } else {
      console.warn(`Unsupported stamp path type "${pathDef.type}" on "${name}", skipping`)
      continue
    }

    path.layer = layerName
    paths[name] = path
  }

  return {
    paths,
    layer: layerName,
  }
}

/**
 * Simple registration X (two crossed lines).
 * Center defaults to (-100, -100); pass x/y in millimeters to relocate.
 */
export function buildRegistrationMark(layerName = 'CONSTRUCTION', x = -100, y = -100) {
  const cx = Number(x)
  const cy = Number(y)
  const half = 5

  const safeX = Number.isFinite(cx) ? cx : -100
  const safeY = Number.isFinite(cy) ? cy : -100

  const line1 = new makerjs.paths.Line([safeX - half, safeY - half], [safeX + half, safeY + half])
  const line2 = new makerjs.paths.Line([safeX - half, safeY + half], [safeX + half, safeY - half])
  line1.layer = layerName
  line2.layer = layerName

  return {
    paths: {
      registrationX1: line1,
      registrationX2: line2,
    },
    layer: layerName,
  }
}

/** Read registration center from generatorOptions (mm), with defaults. */
export function getRegistrationCenter(generatorOptions) {
  const xRaw = generatorOptions?.registrationX
  const yRaw = generatorOptions?.registrationY
  const x = xRaw instanceof Decimal ? xRaw.toNumber() : Number(xRaw)
  const y = yRaw instanceof Decimal ? yRaw.toNumber() : Number(yRaw)
  return {
    x: Number.isFinite(x) ? x : -100,
    y: Number.isFinite(y) ? y : -100,
  }
}

/**
 * Recursively assign a layer name to a model and all nested paths/models.
 */
function applyLayer(model, layerName) {
  if (!model) {
    return model
  }

  model.layer = layerName

  if (model.paths) {
    for (const path of Object.values(model.paths)) {
      if (path) {
        path.layer = layerName
      }
    }
  }

  if (model.models) {
    for (const child of Object.values(model.models)) {
      applyLayer(child, layerName)
    }
  }

  return model
}

/**
 * Build a stamp part by placing the stamp template at every key center,
 * using the same origin / rotation logic as switch cutouts in PlateBuilder.
 *
 * @param {boolean} includeRegistration - when false, omit CONSTRUCTION marks
 *   (used when assembling multi-layer part files that share one registration set)
 *
 * Optional generatorOptions.mirrorStamps: left-right mirror of stamp geometry only.
 * Registration marks are NEVER mirrored.
 *
 * FUTURE (Kailh Choc): same mirrorStamps + non-mirrored registration rules.
 */
export function buildStampPart(stampData, keysArray, generatorOptions, layerName, includeRegistration = true) {
  let template = stampJsonToModel(stampData, layerName)

  // Left-right flip of the stamp pattern (not registration)
  if (generatorOptions && generatorOptions.mirrorStamps) {
    template = makerjs.model.mirror(template, true, false)
    applyLayer(template, layerName)
  }

  const canvas = { models: {} }
  let id = 0

  const unitWidth = generatorOptions.unitWidth instanceof Decimal
    ? generatorOptions.unitWidth
    : new Decimal(generatorOptions.unitWidth)
  const unitHeight = generatorOptions.unitHeight instanceof Decimal
    ? generatorOptions.unitHeight
    : new Decimal(generatorOptions.unitHeight)

  for (const key of keysArray) {
    const origin = {
      x: key.centerX.times(unitWidth),
      y: key.centerY.times(unitHeight),
    }
    const originNum = [origin.x.toNumber(), origin.y.times(-1).toNumber()]

    // Match switch cutout placement: rotate by -(angle + independentSwitchAngle), then set origin
    let instance = makerjs.model.clone(template)
    instance = makerjs.model.rotate(
      instance,
      key.angle.plus(key.independentSwitchAngle).times(-1).toNumber()
    )
    instance.origin = originNum
    applyLayer(instance, layerName)

    canvas.models['Stamp' + id.toString()] = instance
    id += 1
  }

  // Stamp geometry on its own layer…
  applyLayer(canvas, layerName)

  // Registration omitted by default (geometry is co-aligned). Kept only if explicitly requested.
  if (includeRegistration) {
    const reg = getRegistrationCenter(generatorOptions)
    canvas.models.Registration = buildRegistrationMark('CONSTRUCTION', reg.x, reg.y)
  }

  return canvas
}

/**
 * Build an other-part model from a config entry.
 * Returns null if the part cannot be built yet (e.g. stamp with no keys).
 */
export function buildOtherPart(partConfig, keysArray, generatorOptions) {
  if (partConfig.type === 'generated') {
    if (partConfig.generator === 'registrationX') {
      const reg = getRegistrationCenter(generatorOptions)
      return buildRegistrationMark(partConfig.layerName || 'CONSTRUCTION', reg.x, reg.y)
    }
    throw new Error(`Unknown generated part generator: ${partConfig.generator}`)
  }

  // Stamp file entry
  if (!keysArray || keysArray.length === 0) {
    return null
  }

  if (!partConfig.stampData) {
    throw new Error(`Stamp part "${partConfig.id}" has no stampData`)
  }

  return buildStampPart(
    partConfig.stampData,
    keysArray,
    generatorOptions,
    partConfig.layerName,
    true
  )
}

/**
 * Strip registration sub-models so assemblies can share a single CONSTRUCTION mark.
 */
function stripRegistration(model) {
  if (!model) {
    return model
  }
  const clone = makerjs.model.clone(model)
  if (clone.models && clone.models.Registration) {
    delete clone.models.Registration
  }
  return clone
}

/**
 * Build one multi-layer export (all drawings, separate DXF layers).
 * @param {object} assembly - from getExportAssembly()
 * @param {Array} keysArray - parsed KLE keys
 * @param {object} generatorOptions
 * @param {object|null} mainPlateModel - buildPlate() result when includeMainPlate
 */
export function buildExportAssembly(assembly, keysArray, generatorOptions, mainPlateModel) {
  if (!keysArray || keysArray.length === 0) {
    return null
  }

  const canvas = { models: {} }

  if (assembly.includeMainPlate) {
    if (!mainPlateModel) {
      return null
    }
    const plate = stripRegistration(mainPlateModel)
    applyLayer(plate, assembly.mainPlateLayerName || 'Top-SWITCH_PLATE')
    canvas.models.TopSwitchPlate = plate
  }

  for (const stamp of assembly.stamps || []) {
    if (!stamp.stampData) {
      continue
    }
    const stampModel = buildStampPart(
      stamp.stampData,
      keysArray,
      generatorOptions,
      stamp.layerName,
      false
    )
    // Model key safe for DXF nesting (layer name is what CAM cares about)
    const key = stamp.modelKey || stamp.id.replace(/[^a-zA-Z0-9_]/g, '_')
    canvas.models[key] = stampModel
  }

  // No CONSTRUCTION / registration — all layers share the same origin already.

  attachLayerOutlines(canvas, assembly, generatorOptions)
  applyLayerNotes(
    canvas,
    generatorOptions && generatorOptions.layerNotes,
    assembly,
    generatorOptions && generatorOptions.keyboardTitle
  )

  return orderAssemblyModels(canvas)
}

const assemblyModelOrder = [
  "TopSwitchPlate",
  "TopDots",
  "TopBackCut",
  "LinkHoleCuts",
  "LinkHotswap",
  "Shell",
]

function orderAssemblyModels(canvas) {
  if (!canvas || !canvas.models) {
    return canvas
  }
  const models = {}
  for (const key of assemblyModelOrder) {
    if (canvas.models[key]) {
      models[key] = canvas.models[key]
    }
  }
  for (const key of Object.keys(canvas.models)) {
    if (!models[key]) {
      models[key] = canvas.models[key]
    }
  }
  canvas.models = models
  return canvas
}

function layerSortRank(name) {
  const base = String(name || "").split("__")[0]
  if (base === "Top-SWITCH_PLATE") {
    return 10
  }
  if (base === "Top-Dots") {
    return 20
  }
  if (base === "Top-BACK_CUT") {
    return 25
  }
  if (base.indexOf("Top") === 0) {
    return 15
  }
  if (base === "Link-HOLE_CUTS") {
    return 40
  }
  if (base.indexOf("Link-MX_HOTSWAP") === 0) {
    return 50
  }
  if (base.indexOf("Link") === 0) {
    return 45
  }
  if (base.indexOf("Shell") === 0) {
    return 60
  }
  return 90
}

function collectLayerNames(model, names) {
  if (!model) {
    return
  }
  if (model.layer) {
    names.push(model.layer)
  }
  if (model.paths) {
    for (const path of Object.values(model.paths)) {
      if (path && path.layer) {
        names.push(path.layer)
      }
    }
  }
  if (model.models) {
    for (const child of Object.values(model.models)) {
      collectLayerNames(child, names)
    }
  }
}

export function dxfLayerOptions(model) {
  const seen = []
  collectLayerNames(model, seen)
  const unique = []
  for (const name of seen) {
    if (name && unique.indexOf(name) < 0) {
      unique.push(name)
    }
  }
  unique.sort((a, b) => {
    const d = layerSortRank(a) - layerSortRank(b)
    return d !== 0 ? d : a.localeCompare(b)
  })
  const layerOptions = {}
  for (const name of unique) {
    layerOptions[name] = { color: 7 }
  }
  return layerOptions
}

function layerOutlineValues(layerOutlines, id, zoneDefaults) {
  const saved = (layerOutlines && layerOutlines[id]) || {}
  const offset = saved.offset != null && saved.offset !== "" ? Number(saved.offset) : zoneDefaults.offset
  const fillet = saved.fillet != null && saved.fillet !== "" ? Number(saved.fillet) : zoneDefaults.fillet
  return {
    offset: Number.isFinite(offset) ? offset : zoneDefaults.offset,
    fillet: Number.isFinite(fillet) ? fillet : zoneDefaults.fillet,
  }
}

function attachOutlineToModel(target, outlines, generatorOptions, offset, fillet, layerName) {
  if (!target) {
    return
  }
  const outline = buildOutlineModel(outlines, generatorOptions, { offset, fillet })
  if (!outline) {
    return
  }
  applyLayer(outline, layerName)
  if (!target.models) {
    target.models = {}
  }
  target.models.LayerOutline = outline
}

function attachLayerOutlines(canvas, assembly, generatorOptions) {
  const outlines = (generatorOptions && generatorOptions.outlines) || []
  if (!outlines.length) {
    return
  }
  const layerOutlines = (generatorOptions && generatorOptions.layerOutlines) || {}
  const zoneDefaults = zoneOutlineDefaults(outlines)

  if (canvas.models.TopSwitchPlate) {
    const { offset, fillet } = layerOutlineValues(layerOutlines, "Top-SWITCH_PLATE", zoneDefaults)
    attachOutlineToModel(
      canvas.models.TopSwitchPlate,
      outlines,
      generatorOptions,
      offset,
      fillet,
      assembly.mainPlateLayerName || "Top-SWITCH_PLATE"
    )
  }

  for (const stamp of (assembly && assembly.stamps) || []) {
    if (!stamp.hasOutline) {
      continue
    }
    const model = canvas.models[stamp.modelKey || stamp.id]
    const id = stamp.noteId || stamp.layerName
    const { offset, fillet } = layerOutlineValues(layerOutlines, id, zoneDefaults)
    attachOutlineToModel(model, outlines, generatorOptions, offset, fillet, stamp.layerName)
  }

  const plate = layerOutlineValues(layerOutlines, "Top-SWITCH_PLATE", zoneDefaults)
  const shellSaved = layerOutlines.Shell || {}
  const fromPlate = Number(shellSaved.fromPlate)
  const fromSelf = Number(shellSaved.fromSelf)
  const shellFillet = Number(shellSaved.fillet)
  const innerOff = plate.offset + (Number.isFinite(fromPlate) ? fromPlate : defaultShellFromPlate)
  const outerOff = innerOff + (Number.isFinite(fromSelf) ? fromSelf : defaultShellFromSelf)
  const fillet = Number.isFinite(shellFillet) ? shellFillet : zoneDefaults.fillet
  const inner = buildOutlineModel(outlines, generatorOptions, { offset: innerOff, fillet })
  const outer = buildOutlineModel(outlines, generatorOptions, { offset: outerOff, fillet })
  if (!inner && !outer) {
    return
  }
  const shell = { models: {} }
  if (inner) {
    shell.models.Inner = inner
  }
  if (outer) {
    shell.models.Outer = outer
  }
  applyLayer(shell, "Shell")
  canvas.models.Shell = shell
}

function noteForLayer(layerNotes, noteId, layerName) {
  if (!layerNotes) {
    return ""
  }
  return String(layerNotes[noteId] || layerNotes[layerName] || "").trim()
}

/**
 * Rename each export layer with the operator note and draw that note
 * at the bottom-left of the layer's geometry.
 */
export function applyLayerNotes(canvas, layerNotes, assembly, keyboardTitle) {
  if (!canvas || !canvas.models) {
    return canvas
  }

  const pairs = []
  if (assembly && assembly.includeMainPlate) {
    pairs.push({
      modelKey: "TopSwitchPlate",
      noteId: "Top-SWITCH_PLATE",
      layerName: assembly.mainPlateLayerName || "Top-SWITCH_PLATE",
    })
  }
  for (const stamp of (assembly && assembly.stamps) || []) {
    pairs.push({
      modelKey: stamp.modelKey || stamp.id,
      noteId: stamp.noteId || stamp.layerName,
      layerName: stamp.layerName,
    })
  }
  if (canvas.models.Shell) {
    pairs.push({
      modelKey: "Shell",
      noteId: "Shell",
      layerName: "Shell",
    })
  }

  // Hotswap note is stored under the stable id Link-MX_HOTSWAP
  for (const pair of pairs) {
    if (pair.layerName && pair.layerName.indexOf("Link-MX_HOTSWAP") === 0) {
      pair.noteId = "Link-MX_HOTSWAP"
    }
    if (pair.layerName === "Top-Dots") {
      pair.noteId = "Top-Dots"
    }
  }

  for (const pair of pairs) {
    const model = canvas.models[pair.modelKey]
    if (!model) {
      continue
    }
    const note = noteForLayer(layerNotes, pair.noteId, pair.layerName)
    const title = String(keyboardTitle || "").trim()
    const labelText = [title, note].filter(Boolean).join("  ")
    const named = note ? annotatedLayerName(pair.layerName, note) : pair.layerName
    if (note) {
      applyLayer(model, named)
    }
    if (!labelText) {
      continue
    }

    const extents = makerjs.measure.modelExtents(model)
    if (!extents || !extents.low) {
      continue
    }
    const label = strokeTextModel(labelText, 3)
    applyLayer(label, named)
    const gap = 2
    label.origin = [extents.low[0], extents.low[1] - gap - 3]
    if (!model.models) {
      model.models = {}
    }
    model.models.LayerNote = label
  }

  return canvas
}

const previewGroupKeys = {
  top: ["TopSwitchPlate", "TopDots", "TopBackCut"],
  link: ["LinkHotswap", "LinkHoleCuts"],
  shell: ["Shell"],
}

/** One preview pane per top-level export model, in export order. */
export function previewLayerPanes(model) {
  if (!model || !model.models) {
    return []
  }
  return Object.keys(model.models).map(key => {
    const child = model.models[key]
    const exported = exportOtherPart({ models: { [key]: child } })
    return {
      title: (child && child.layer) || key,
      svg: exported && exported.previewSvg,
    }
  })
}

/** Build a read-only subset of the assembly for a preview pane. */
export function previewSubset(model, groups) {
  if (!model || !model.models) {
    return null
  }
  const keys = (groups || []).flatMap(group => previewGroupKeys[group] || [])
  const models = {}
  for (const key of keys) {
    if (model.models[key]) {
      models[key] = model.models[key]
    }
  }
  if (!Object.keys(models).length) {
    return null
  }
  return { models }
}

/**
 * Export a maker.js model to preview SVG, download SVG, and DXF strings.
 */
export function exportOtherPart(model) {
  if (!model) {
    return null
  }

  const previewSvg = makerjs.exporter.toSVG(model, {
    stroke: 'white',
    strokeWidth: '0.5mm',
    svgAttrs: { width: '100%', height: 'auto' },
  })
  const svg = makerjs.exporter.toSVG(model, { units: makerjs.unitType.Millimeter })
  const dxf = makerjs.exporter.toDXF(model, {
    units: makerjs.unitType.Millimeter,
    layerOptions: dxfLayerOptions(model),
  })

  return { previewSvg, svg, dxf }
}

/** Sanitize one filename segment (Title / PartName). */
export function sanitizeFilenamePart(value, fallback = 'Untitled') {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/[^\w-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48)
  return cleaned || fallback
}

/**
 * Download name: Title.unique.ext
 * e.g. Macropad.lm9k2a.dxf
 * Unique suffix is generated per click so re-downloads never collide.
 */
export function makeDownloadFilename(keyboardTitle, extension) {
  const title = sanitizeFilenamePart(keyboardTitle, 'Untitled')
  const unique = Date.now().toString(36)
  const ext = extension.startsWith('.') ? extension : `.${extension}`
  return `${title}.${unique}${ext}`
}
