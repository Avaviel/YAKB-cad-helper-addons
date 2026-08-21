import makerjs from 'makerjs'
import Decimal from 'decimal.js'
import {
  TITLE_BLOCK_LAYER,
  TITLE_BLOCK_HEIGHT,
  TITLE_BLOCK_FULL_DRAWING_NAME,
  TITLE_BLOCK_FULL_DRAWING_NO,
  buildTitleBlock,
  titleBlockFieldsFromOptions,
  drawingInfoForLayer,
  titleBlockOriginFromExtents,
  TITLE_BLOCK_MARGIN,
  featureFromOutline,
} from './TitleBlockBuilder'
import { buildOutlineModel, zoneOutlineDefaults } from './PlateBuilder'
import { defaultShellFromPlate, defaultShellFromSelf, layerFeatureDefault } from './otherPartsConfig'
import { buildBackCutPart } from './BackCutBuilder'
import { clusterMergeCircles, isKeyStaggered, stripTopStampCircles } from './overkill'
import { buildPlacedDots } from './DotsBuilder'
import { buildKeyOutlines, buildKeyMass, KEYS_LAYER, KEYS_MASS_LAYER } from './KeyOutlineBuilder'
import { buildLedCutouts, LED_LAYER } from './LedCutBuilder'

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
export function buildStampPart(stampData, keysArray, generatorOptions, layerName, includeRegistration = true, stampOptions) {
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
    if (stampOptions && stampOptions.dropStaggeredTops && isKeyStaggered(key, keysArray)) {
      stripTopStampCircles(instance)
    }
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
    const key = stamp.modelKey || (stamp.id && stamp.id.replace(/[^a-zA-Z0-9_]/g, '_'))
    if (stamp.type === 'backcut') {
      const backCut = buildBackCutPart(keysArray, generatorOptions, stamp.layerName)
      applyLayer(backCut, stamp.layerName)
      canvas.models[key] = backCut
      continue
    }
    if (key === "TopDots") {
      const dots = buildPlacedDots(
        keysArray,
        generatorOptions,
        stamp.layerName,
        canvas.models.TopBackCut
      )
      if (dots) {
        clusterMergeCircles(dots)
        canvas.models[key] = dots
      }
      continue
    }
    if (stamp.type === "led" || key === "TopLed") {
      const leds = buildLedCutouts(keysArray, generatorOptions, stamp.layerName || LED_LAYER)
      if (leds) {
        canvas.models[key] = leds
      }
      continue
    }
    if (!stamp.stampData) {
      continue
    }
    const stampModel = buildStampPart(
      stamp.stampData,
      keysArray,
      generatorOptions,
      stamp.layerName,
      false,
      null
    )
    canvas.models[key] = stampModel
  }

  // No CONSTRUCTION / registration — all layers share the same origin already.

  attachLayerOutlines(canvas, assembly, generatorOptions)
  const keyOutlines = buildKeyOutlines(keysArray, generatorOptions, KEYS_LAYER)
  if (keyOutlines) {
    canvas.models.Keys = keyOutlines
  }
  const keyMass = buildKeyMass(keysArray, generatorOptions, KEYS_MASS_LAYER)
  if (keyMass) {
    canvas.models.KeysMass = keyMass
  }
  applyLayerNotes(
    canvas,
    generatorOptions && generatorOptions.layerNotes,
    assembly
  )
  if (!(generatorOptions && generatorOptions.skipTitleBlock)) {
    attachTitleBlock(canvas, generatorOptions)
  }

  return orderAssemblyModels(canvas)
}

const assemblyModelOrder = [
  "TopSwitchPlate",
  "TopBackCut",
  "TopDots",
  "TopLed",
  "LinkHoleCuts",
  "LinkHotswap",
  "Shell",
  "Keys",
  "KeysMass",
  "TitleBlock",
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
  if (base === "Top-BACK_CUT") {
    return 20
  }
  if (base === "Top-Dots") {
    return 25
  }
  if (base === "Top-LED") {
    return 27
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
  if (base === "Keys-MASS" || base.indexOf("Keys-MASS") === 0) {
    return 66
  }
  if (base === "Keys" || base.indexOf("Key") === 0) {
    return 65
  }
  if (base === TITLE_BLOCK_LAYER || base.indexOf("TITLE_BLOCK") === 0) {
    return 80
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

export function sanitizeDxfLayerName(name) {
  const cleaned = String(name || "0")
    .replace(/[<>/\\":;?*|,=`']/g, "_")
    .replace(/\./g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 255)
  return cleaned || "0"
}

function sanitizeModelLayers(model) {
  if (!model) return
  if (model.layer) model.layer = sanitizeDxfLayerName(model.layer)
  if (model.paths) {
    for (const path of Object.values(model.paths)) {
      if (path && path.layer) path.layer = sanitizeDxfLayerName(path.layer)
    }
  }
  if (model.models) {
    for (const child of Object.values(model.models)) {
      sanitizeModelLayers(child)
    }
  }
}

function normalizeExportArcs(model) {
  makerjs.model.walk(model, {
    onPath: walked => {
      const path = walked.pathContext
      if (!path || path.type !== "arc") return
      let start = Number(path.startAngle)
      let end = Number(path.endAngle)
      if (!Number.isFinite(start) || !Number.isFinite(end)) return
      start = ((start % 360) + 360) % 360
      end = ((end % 360) + 360) % 360
      if (end <= start) end += 360
      path.startAngle = start
      path.endAngle = end
    },
  })
}

function prepareModelForCadExport(model) {
  const prepared = makerjs.model.clone(model)
  makerjs.model.originate(prepared)
  sanitizeModelLayers(prepared)
  normalizeExportArcs(prepared)
  return prepared
}

export function dxfLayerOptions(model) {
  const seen = []
  collectLayerNames(model, seen)
  const unique = []
  for (const name of seen) {
    const safe = sanitizeDxfLayerName(name)
    if (safe && unique.indexOf(safe) < 0) {
      unique.push(safe)
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
 * Layer notes print in that drawing's title block. DXF layer names stay clean.
 */
export function applyLayerNotes(canvas) {
  return canvas
}

function layerNameForModel(key, model) {
  if (model && model.layer) {
    return model.layer
  }
  if (key === "TopSwitchPlate") return "Top-SWITCH_PLATE"
  if (key === "TopDots") return "Top-Dots"
  if (key === "TopLed") return LED_LAYER
  if (key === "TopBackCut") return "Top-BACK_CUT"
  if (key === "LinkHoleCuts") return "Link-HOLE_CUTS"
  if (key === "LinkHotswap") return "Link-MX_HOTSWAP"
  if (key === "Shell") return "Shell"
  if (key === "Keys") return KEYS_LAYER
  if (key === "KeysMass") return KEYS_MASS_LAYER
  return key
}

function outlineIdCandidates(key, model) {
  const layer = layerNameForModel(key, model)
  const base = String(layer || "").split("__")[0]
  const ids = []
  if (key === "TopSwitchPlate") ids.push("Top-SWITCH_PLATE")
  if (key === "TopDots") ids.push("Top-Dots")
  if (key === "TopLed") ids.push(LED_LAYER)
  if (key === "TopBackCut") ids.push("Top-BACK_CUT")
  if (key === "LinkHoleCuts") ids.push("Link-HOLE_CUTS")
  if (key === "LinkHotswap") ids.push("Link-MX_HOTSWAP", "Link-CHOC_HOTSWAP")
  if (key === "Shell") ids.push("Shell")
  if (key === "Keys") ids.push(KEYS_LAYER)
  if (key === "KeysMass") ids.push(KEYS_MASS_LAYER)
  if (base && ids.indexOf(base) < 0) ids.push(base)
  if (/HOTSWAP/i.test(base) || /^Link-CHOC/i.test(base)) {
    if (ids.indexOf("Link-MX_HOTSWAP") < 0) ids.push("Link-MX_HOTSWAP")
    if (ids.indexOf("Link-CHOC_HOTSWAP") < 0) ids.push("Link-CHOC_HOTSWAP")
  }
  return ids
}

function featureForModel(generatorOptions, key, model) {
  const outlines = (generatorOptions && generatorOptions.layerOutlines) || {}
  const ids = outlineIdCandidates(key, model)
  let saved = {}
  let defaults = { op: "cut", opMm: "" }
  for (const id of ids) {
    const row = layerFeatureDefault(id)
    if (row && (row.opMm !== "" || (row.op && row.op !== "cut"))) {
      defaults = row
    }
    if (outlines[id]) {
      saved = { ...saved, ...outlines[id] }
    }
  }
  return { ...featureFromOutline({ ...defaults, ...saved }), showFeature: true }
}

function noteForModel(generatorOptions, key, model) {
  const notes = (generatorOptions && generatorOptions.layerNotes) || {}
  for (const id of outlineIdCandidates(key, model)) {
    const note = noteForLayer(notes, id, id)
    if (note) {
      return note
    }
  }
  return ""
}

export function attachTitleBlock(canvas, generatorOptions) {
  if (!canvas || !canvas.models) {
    return canvas
  }
  const extents = makerjs.measure.modelExtents(canvas)
  if (!extents || !extents.low || !extents.high) {
    return canvas
  }
  const fields = titleBlockFieldsFromOptions(generatorOptions)
  const drafts = []
  let maxH = TITLE_BLOCK_HEIGHT

  for (const [key, model] of Object.entries(canvas.models)) {
    if (!model || String(key).indexOf("TitleBlock") === 0) continue
    const layerName = model.layer || layerNameForModel(key, model)
    const info = drawingInfoForLayer(layerName)
    const feature = featureForModel(generatorOptions, key, model)
    const layerNote = noteForModel(generatorOptions, key, model)
    drafts.push({
      key,
      model,
      layerName,
      feature,
      layerNote,
      info,
    })
    const probe = buildTitleBlock({
      ...fields,
      drawingName: info.drawingName,
      drawingNo: info.drawingNo,
      notes: layerNote,
      op: feature.op,
      opMm: feature.opMm,
      showFeature: true,
    })
    if (probe.height > maxH) maxH = probe.height
  }

  const overallProbe = buildTitleBlock({
    ...fields,
    drawingName: TITLE_BLOCK_FULL_DRAWING_NAME,
    drawingNo: TITLE_BLOCK_FULL_DRAWING_NO,
  })
  if (overallProbe.height > maxH) maxH = overallProbe.height

  const origin = titleBlockOriginFromExtents(extents, TITLE_BLOCK_MARGIN, maxH)
  canvas.titleBlockOrigin = origin.slice()
  canvas.titleBlockFields = fields
  canvas.globalExtents = extents
  canvas.layerFeatures = {}
  canvas.layerTitleNotes = {}

  for (const draft of drafts) {
    canvas.layerFeatures[draft.key] = draft.feature
    canvas.layerTitleNotes[draft.key] = draft.layerNote
    const block = buildTitleBlock({
      ...fields,
      drawingName: draft.info.drawingName,
      drawingNo: draft.info.drawingNo,
      notes: draft.layerNote,
      op: draft.feature.op,
      opMm: draft.feature.opMm,
      showFeature: true,
      minHeight: maxH,
    })
    block.origin = origin.slice()
    applyLayer(block, draft.layerName)
    if (!draft.model.models) {
      draft.model.models = {}
    }
    draft.model.models.TitleBlock = block
  }

  const overall = buildTitleBlock({
    ...fields,
    drawingName: TITLE_BLOCK_FULL_DRAWING_NAME,
    drawingNo: TITLE_BLOCK_FULL_DRAWING_NO,
    minHeight: maxH,
  })
  overall.origin = origin.slice()
  applyLayer(overall, TITLE_BLOCK_LAYER)
  canvas.models.TitleBlock = overall
  return canvas
}

function titleBlockForLayer(parentModel, layerName, key) {
  if (!parentModel || !parentModel.titleBlockOrigin) {
    return null
  }
  const info = drawingInfoForLayer(layerName)
  const base = parentModel.titleBlockFields || {}
  const feature = (parentModel.layerFeatures && (parentModel.layerFeatures[key] || parentModel.layerFeatures[layerName])) || {}
  const layerNote = (parentModel.layerTitleNotes && (parentModel.layerTitleNotes[key] || parentModel.layerTitleNotes[layerName])) || ""
  const block = buildTitleBlock({
    ...base,
    drawingName: info.drawingName,
    drawingNo: info.drawingNo,
    notes: layerNote,
    op: feature.op,
    opMm: feature.opMm,
    showFeature: true,
  })
  block.origin = parentModel.titleBlockOrigin.slice()
  applyLayer(block, layerName)
  return block
}

function withoutEmbeddedTitleBlocks(model) {
  if (!model || !model.models) {
    return model
  }
  const models = {}
  for (const [key, child] of Object.entries(model.models)) {
    if (key === "TitleBlock" || !child) continue
    if (child.models && child.models.TitleBlock) {
      const nested = { ...child.models }
      delete nested.TitleBlock
      models[key] = { ...child, models: nested }
    } else {
      models[key] = child
    }
  }
  return { ...model, models }
}

const previewGroupKeys = {
  top: ["TopSwitchPlate", "TopBackCut", "TopDots", "TopLed"],
  link: ["LinkHotswap", "LinkHoleCuts"],
  shell: ["Shell"],
  keys: ["Keys"],
  mass: ["KeysMass"],
}

/** One preview pane per top-level export model, in export order. */
export function previewLayerPanes(model) {
  if (!model || !model.models) {
    return []
  }
  return Object.keys(model.models).filter(key => String(key).indexOf("TitleBlock") !== 0).map(key => {
    const child = model.models[key]
    const layerName = layerNameForModel(key, child)
    const exported = exportOtherPart({ models: { [key]: child } })
    return {
      title: layerName,
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
  const cleaned = withoutEmbeddedTitleBlocks({ models }).models
  if (model.models.TitleBlock) {
    cleaned.TitleBlock = model.models.TitleBlock
  } else {
    const firstKey = Object.keys(models)[0]
    const first = models[firstKey]
    const block = titleBlockForLayer(model, layerNameForModel(firstKey, first), firstKey)
    if (block) cleaned.TitleBlock = block
  }
  return { models: cleaned }
}

/**
 * Clone a geometry-only assembly, stamp title blocks, and build preview/download strings.
 */
export function decorateAndExport(model, generatorOptions) {
  if (!model) {
    return { ready: false }
  }
  const next = makerjs.model.clone(model)
  attachTitleBlock(next, generatorOptions)
  const exported = exportOtherPart(next)
  const together = exportOtherPart(previewSubset(next, ["top", "link", "shell", "keys", "mass"]))
  const topOnly = exportOtherPart(previewSubset(next, ["top"]))
  const shellOnly = exportOtherPart(previewSubset(next, ["shell"]))
  const keysOnly = exportOtherPart(previewSubset(next, ["keys"]))
  const massOnly = exportOtherPart(previewSubset(next, ["mass"]))
  const topShell = exportOtherPart(previewSubset(next, ["top", "shell", "keys", "mass"]))
  const linkOnly = exportOtherPart(previewSubset(next, ["link"]))
  return {
    ...(exported || {}),
    previewSvg: (together && together.previewSvg) || (exported && exported.previewSvg),
    previewTop: topOnly && topOnly.previewSvg,
    previewShell: shellOnly && shellOnly.previewSvg,
    previewKeys: keysOnly && keysOnly.previewSvg,
    previewKeysMass: massOnly && massOnly.previewSvg,
    previewTopShell: topShell && topShell.previewSvg,
    previewLink: linkOnly && linkOnly.previewSvg,
    previewEach: previewLayerPanes(next),
    ready: !!exported,
  }
}

export function exportOtherPart(model) {
  if (!model) {
    return null
  }

  const previewSvg = makerjs.exporter.toSVG(model, {
    stroke: 'white',
    strokeWidth: '0.5mm',
    svgAttrs: { width: '100%', height: 'auto' },
  })
  const downloadModel = prepareModelForCadExport(model)
  const svg = makerjs.exporter.toSVG(downloadModel, { units: makerjs.unitType.Millimeter })
  const dxf = makerjs.exporter.toDXF(downloadModel, {
    units: makerjs.unitType.Millimeter,
    layerOptions: dxfLayerOptions(downloadModel),
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
