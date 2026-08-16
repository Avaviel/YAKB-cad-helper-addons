import { useState, useEffect, useMemo } from "react"
import { Button, Container, Card, Form, Row, Col, Image, Tab, Nav, Alert } from 'react-bootstrap'
import { parseKle, readKleLayerState, writeKleLayerState } from "./KLEParser"
import { buildPlate, zoneOutlineDefaults } from "./PlateBuilder"
import {
  switchFamilies,
  defaultSwitchFamilyId,
  defaultFitId,
  getExportAssembly,
  getExportSummary,
  defaultShellFromPlate,
  defaultShellFromSelf,
  chocSpacingPresets,
  supportedCutoutTypes,
  familyForCutoutType,
} from "./otherPartsConfig"
import { backCutDefaultsForFamily } from "./BackCutBuilder"
import {
  buildExportAssembly,
  exportOtherPart,
  previewSubset,
  previewLayerPanes,
  makeDownloadFilename,
  sanitizeFilenamePart,
} from "./OtherPartsBuilder"
import { annotatedLayerName } from "./strokeText"
import Decimal from "decimal.js"
import fileDownload from 'js-file-download'
import logo from './logo.png'
import './App.css'
import { DataHelpPane, SwitchCutoutPane, OtherCutoutPane, AdvancedPane, RegistrationHelpPane, CompanionPane, AboutPane } from './HelpPanes'


function App() {

  const [kleText, setKleText] = useState("")
  // Keyboard title used in download filenames (e.g. Macropad.lm9k2a.dxf)
  const [keyboardTitle, setKeyboardTitle] = useState("Keyboard")
  const [layerNotes, setLayerNotes] = useState({})
  const [layerOutlines, setLayerOutlines] = useState({})

  const [switchCutoutType, setSwitchCutoutType] = useState("mx-basic")
  const [stabilizerCutoutType, setStabilizerCutoutType] = useState("mx-basic")
  const [acousticCutoutType, setAcousticCutoutType] = useState("none")

  const [switchRadius, setSwitchRadius] = useState(0.5)
  const [stabilizerRadius, setStabilizerRadius] = useState(0.5)
  const [acousticRadius, setAcousticRadius] = useState(0.5)

  const [unitWidth, setUnitWidth] = useState(19.05)
  const [unitHeight, setUnitHeight] = useState(19.05)
  const [kerf, setKerf] = useState(0)

  // Stamp options: switch family + fit; one multi-layer export
  const [stampSwitchFamily, setStampSwitchFamily] = useState(defaultSwitchFamilyId)
  const [stampFit, setStampFit] = useState(defaultFitId)
  // Left-right mirror of stamp geometry only
  const [mirrorStamps, setMirrorStamps] = useState(false)
  // Single full export (preview + dxf + svg)
  const [exportOutput, setExportOutput] = useState(null)
  const [previewMode, setPreviewMode] = useState("together")
  const [previewLayout, setPreviewLayout] = useState("landscape")
  const [chocSpacingId, setChocSpacingId] = useState("18x17")

  const selectedFamily = switchFamilies.find(f => f.id === stampSwitchFamily) || switchFamilies[0]
  const exportSummary = getExportSummary(stampSwitchFamily, stampFit)
  const exportAssembly = getExportAssembly(stampSwitchFamily, stampFit)
  const zoneDefaults = useMemo(() => {
    const parsed = parseKle(kleText)
    return zoneOutlineDefaults((parsed && parsed.outlines) || [])
  }, [kleText])

  const outlineField = (id, field, fallback) => {
    const saved = layerOutlines[id]
    if (saved && saved[field] != null && saved[field] !== "") {
      return saved[field]
    }
    return fallback
  }

  // Build one multi-layer DXF/SVG: Top + Link layers (no registration)
  useEffect(() => {
    const parsed = parseKle(kleText)
    const kleReturn = parsed && parsed.keys ? parsed.keys : parsed
    const outlines = (parsed && parsed.outlines) || []
    const generatorOptions = {
      switchCutoutType: switchCutoutType,
      stabilizerCutoutType: stabilizerCutoutType,
      acousticCutoutType: acousticCutoutType,
      switchFilletRadius: new Decimal(switchRadius),
      stabilizerFilletRadius: new Decimal(stabilizerRadius),
      acousticFilletRadius: new Decimal(acousticRadius),
      unitWidth: new Decimal(String(unitWidth).trim() || "invalid"),
      unitHeight: new Decimal(String(unitHeight).trim() || "invalid"),
      kerf: new Decimal(kerf),
      mirrorStamps: !!mirrorStamps,
      outlines,
      layerNotes,
      layerOutlines,
      keyboardTitle,
      stampFamilyId: stampSwitchFamily,
      skipEmbeddedOutlines: true,
    }

    const assembly = getExportAssembly(stampSwitchFamily, stampFit)

    if (!kleReturn || kleReturn.length === 0) {
      setExportOutput({
        id: assembly.id,
        label: assembly.label,
        description: assembly.description,
        layerSummary: assembly.layerSummary,
        ready: false,
      })
      return
    }

    try {
      const mainPlateModel = buildPlate(kleReturn, generatorOptions)
      const model = buildExportAssembly(assembly, kleReturn, generatorOptions, mainPlateModel)
      const exported = exportOtherPart(model)
      const topOnly = exportOtherPart(previewSubset(model, ["top"]))
      const shellOnly = exportOtherPart(previewSubset(model, ["shell"]))
      const topShell = exportOtherPart(previewSubset(model, ["top", "shell"]))
      const linkOnly = exportOtherPart(previewSubset(model, ["link"]))
      setExportOutput({
        id: assembly.id,
        label: assembly.label,
        description: assembly.description,
        layerSummary: assembly.layerSummary,
        ...(exported || {}),
        previewTop: topOnly && topOnly.previewSvg,
        previewShell: shellOnly && shellOnly.previewSvg,
        previewTopShell: topShell && topShell.previewSvg,
        previewLink: linkOnly && linkOnly.previewSvg,
        previewEach: previewLayerPanes(model),
        ready: !!exported,
      })
    } catch (error) {
      console.log('Export build failed:', error)
      setExportOutput({
        id: assembly.id,
        label: assembly.label,
        description: assembly.description,
        layerSummary: assembly.layerSummary,
        ready: false,
      })
    }
  }, [
    kleText,
    switchCutoutType,
    stabilizerCutoutType,
    acousticCutoutType,
    switchRadius,
    stabilizerRadius,
    acousticRadius,
    unitWidth,
    unitHeight,
    kerf,
    stampSwitchFamily,
    stampFit,
    mirrorStamps,
    layerNotes,
    layerOutlines,
    keyboardTitle,
  ])


  const downloadExport = (fileData, extension) => {
    const filename = makeDownloadFilename(keyboardTitle, extension)
    fileDownload(fileData, filename)
  }

  const persistLayerState = (notes, outlines, title) => {
    const written = writeKleLayerState(kleText, {
      notes,
      outlines,
      name: title != null ? title : keyboardTitle,
    })
    if (written != null) {
      setKleText(written)
    }
  }

  const handleTitleChange = (value) => {
    setKeyboardTitle(value)
    persistLayerState(layerNotes, layerOutlines, value)
  }

  const handleKleTextChange = (text) => {
    const parsed = readKleLayerState(text)
    if (!parsed) {
      setKleText(text)
      return
    }
    if (parsed.name) {
      setKeyboardTitle(parsed.name)
    }
    const hasNotes = Object.keys(parsed.notes).length
    const hasOutlines = Object.keys(parsed.outlines).length
    if (hasNotes || hasOutlines) {
      if (hasNotes) {
        setLayerNotes(parsed.notes)
      }
      if (hasOutlines) {
        setLayerOutlines(parsed.outlines)
      }
      setKleText(text)
      return
    }
    if (Object.keys(layerNotes).length || Object.keys(layerOutlines).length) {
      const written = writeKleLayerState(text, {
        notes: layerNotes,
        outlines: layerOutlines,
        name: parsed.name || keyboardTitle,
      })
      setKleText(written != null ? written : text)
      return
    }
    setLayerNotes({})
    setLayerOutlines({})
    setKleText(text)
  }

  const handleLayerNoteChange = (id, value) => {
    const next = { ...layerNotes }
    if (String(value).trim()) {
      next[id] = value
    } else {
      delete next[id]
    }
    setLayerNotes(next)
    persistLayerState(next, layerOutlines)
  }

  const handleLayerOutlineChange = (id, field, value) => {
    const next = {
      ...layerOutlines,
      [id]: {
        ...(layerOutlines[id] || {}),
        [field]: value,
      },
    }
    setLayerOutlines(next)
    persistLayerState(layerNotes, next)
  }

  const handleStampFamilyChange = (familyId) => {
    setStampSwitchFamily(familyId)
    const family = switchFamilies.find(f => f.id === familyId)
    if (family?.defaultFitId) {
      setStampFit(family.defaultFitId)
    } else if (family?.fits?.length) {
      setStampFit(family.fits[0].id)
    }
    if (family?.cutoutType && family.cutoutType !== switchCutoutType) {
      setSwitchCutoutType(family.cutoutType)
    }
    if (family?.defaultUnitWidth != null) {
      setUnitWidth(family.defaultUnitWidth)
    }
    if (family?.defaultUnitHeight != null) {
      setUnitHeight(family.defaultUnitHeight)
    }
    if (familyId === "choc") {
      setChocSpacingId("18x17")
    }
  }

  const handleSwitchCutoutChange = (value) => {
    setSwitchCutoutType(value)
    const family = familyForCutoutType(value)
    if (family) {
      handleStampFamilyChange(family.id)
    }
  }

  const handleChocSpacing = (id) => {
    setChocSpacingId(id)
    if (id === "custom") {
      setUnitWidth("")
      setUnitHeight("")
      return
    }
    const preset = chocSpacingPresets.find(p => p.id === id)
    if (preset) {
      setUnitWidth(preset.width)
      setUnitHeight(preset.height)
    }
  }

  const handleUnitSizeChange = (axis, value) => {
    if (axis === "width") {
      setUnitWidth(value)
    } else {
      setUnitHeight(value)
    }
    const nextWidth = axis === "width" ? value : unitWidth
    const nextHeight = axis === "height" ? value : unitHeight
    const match = chocSpacingPresets.find(
      p => Number(p.width) === Number(nextWidth) && Number(p.height) === Number(nextHeight)
    )
    setChocSpacingId(match ? match.id : "custom")
  }

  const isSupportedWorkflow = supportedCutoutTypes.includes(switchCutoutType)
  const isChocWorkflow = switchCutoutType === "choc-cpg1350"


  return (
    <Container className="App justify-content-center" style={{ textAlign: "center" }}>

      <div className="pt-4 pb-4">
        <a href="https://ai03.com/" target="_blank" rel="noopener noreferrer">
          <Image fluid={true} src={logo} className="m-4" style={{ maxHeight: "100px" }} />
        </a>

        <h1 style={{ textTransform: "none" }}>YAKB CAD Helper</h1>
        <h5 className="pb-2">Plate tools for 3D-printed keyboards</h5>
        <p className="mb-2" style={{ maxWidth: "720px", margin: "0 auto" }}>
          Built to make it easier to generate plates and helper layers for <strong>3D-printed keyboards</strong> that use
          {' '}<strong>hotswap sockets</strong>. Based on the ai03 Plate Generator (YAKB) for accurate MX cutouts,
          with extra stamp layers aimed at printed builds.
        </p>
        <p className="text-muted mb-0" style={{ maxWidth: "720px", margin: "0 auto" }}>
          <strong>MX</strong> and <strong>Kailh Choc PG1350</strong> hotswap workflows are available now.
        </p>
      </div>

      <Card className="rounded shadow overflow-hidden mb-5">
        <Card.Body className="p-0">
          <Row>
            <Col xl={5} className="pt-3 pb-0 ps-4 pe-4">
              <h3>KLE Data</h3>
              <p>Please see the info block at the bottom for features such as rotating stabilizers.</p>
              <Form className="mt-3 mb-3 text-start">
                <Form.Label>Keyboard title</Form.Label>
                <Form.Control
                  type="text"
                  value={keyboardTitle}
                  placeholder="e.g. Macropad"
                  onChange={e => handleTitleChange(e.target.value)}
                  aria-label="keyboard-title"
                />
                <Form.Text className="text-muted">
                  Saved as KLE <code>name</code>, drawn on each layer, and used in download names.
                </Form.Text>
              </Form>
            </Col>
            <Col xl={7}>
              <Form>
                <Form.Control
                  as="textarea"
                  type="text"
                  style={{ fontFamily: 'monospace', height: '20vh', minHeight: "225px" }}
                  spellCheck="false"
                  placeholder="Paste KLE raw data or JSON here"
                  value={kleText}
                  onChange={e => handleKleTextChange(e.target.value)} />
              </Form>
            </Col>
          </Row>

        </Card.Body>
      </Card>

      {!isSupportedWorkflow && (
        <Alert variant="warning" className="text-start">
          This switch type is not part of the MX / Choc PG1350 stamp workflow yet.
          Plate cutouts may still generate, but hotswap and helper layers are not provided.
          If you want it added,{' '}
          <a href="https://github.com/Avaviel/YAKB-cad-helper-addons" target="_blank" rel="noreferrer">clone the repository</a>
          {' '}and add stamps, or{' '}
          <a href="https://github.com/Avaviel/YAKB-cad-helper-addons/issues" target="_blank" rel="noreferrer">raise an issue</a>.
        </Alert>
      )}

      <Card className="rounded shadow overflow-hidden mb-5">
        {/* <Card.Header>
          KLE Data
        </Card.Header> */}
        <Card.Body>
          <Row>
            <Col lg={4}>
              <h3>Cutouts</h3>
              <p>Default values are recommended.</p>
              <br />
              <Form className="ms-3 me-3">
                <Form.Label>Switch Cutout Type</Form.Label>
                <Form.Select aria-label="switch-cutout-type"
                  value={switchCutoutType}
                  className="mb-4"
                  onChange={e => handleSwitchCutoutChange(e.target.value)}
                >
                  <option value="mx-basic">★ Cherry MX Basic</option>
                  <option value="choc-cpg1350">★ Kailh Choc CPG1350</option>
                  <option value="choc-cpg1232">Kailh Mini Choc CPG1232</option>
                  <option value="alps-skcm">Alps SKCM/L</option>
                  <option value="omron-b3g">Omron B3G/B3G-S</option>
                  <option value="alps-skcp">Alps SKCP</option>
                  <option value="hitek-725">Hi-Tek 725</option>
                  <option value="i-rocks">i-Rocks</option>
                  <option value="futaba-ma">Futaba MA</option>
                </Form.Select>
                <Form.Label>Stabilizer Cutout Type</Form.Label>
                <Form.Select aria-label="stabilizer-cutout-type"
                  selected="mx-basic"
                  className="mb-4"
                  onChange={e => setStabilizerCutoutType(e.target.value)}
                >
                  <option value="mx-basic">Cherry MX Basic</option>
                  <option value="mx-small">Cherry MX Tight Fit</option>
                  <option value="mx-spec">Cherry MX Spec</option>
                  <option value="alps-aek">Alps AEK</option>
                  <option value="alps-at101">Alps AT101</option>
                  <option value="none">None</option>

                </Form.Select>
                <Form.Label>Acoustic Cutout Type</Form.Label>
                <Form.Select aria-label="acoustic-cutout-type"
                  selected="none"
                  className="mb-4"
                  onChange={e => setAcousticCutoutType(e.target.value)}
                >
                  <option value="none">None</option>
                  <option value="mx-basic">Cherry MX Basic</option>
                  <option value="mx-extreme">Cherry MX Extreme</option>
                </Form.Select>
              </Form>
            </Col>

            <Col lg={4}>
              <h3>Filleting</h3>
              <p>Recommended 0.5mm; larger radii can cause issues with part fitment.</p>
              <Form className="ms-3 me-3">
                <Form.Label>Switch Cutout Fillet Radius</Form.Label>
                <Form.Control
                  type="number"
                  required
                  step=".001"
                  min="0"
                  max="100"
                  defaultValue="0.5"
                  id="switch-cutout-fillet-radius"
                  className="mb-4"
                  onChange={e => setSwitchRadius(e.target.value)}
                />
                <Form.Label>Stabilizer Cutout Fillet Radius</Form.Label>
                <Form.Control
                  type="number"
                  required
                  step=".001"
                  min="0"
                  max="100"
                  defaultValue="0.5"
                  id="stabilizer-cutout-fillet-radius"
                  className="mb-4"
                  onChange={e => setStabilizerRadius(e.target.value)}
                />
                <Form.Label>Acoustic Cutout Fillet Radius</Form.Label>
                <Form.Control
                  type="number"
                  required
                  step=".001"
                  min="0"
                  max="100"
                  defaultValue="0.5"
                  id="acoustic-cutout-fillet-radius"
                  className="mb-4"
                  onChange={e => setAcousticRadius(e.target.value)}
                />
              </Form>
            </Col>

            <Col lg={4}>
              <h3>Advanced</h3>
              <p>Best leave these alone unless you know what you are doing.</p>
              <Form className="ms-3 me-3">
                {isChocWorkflow && (
                  <>
                    <Form.Label>Choc unit size</Form.Label>
                    <Form.Select
                      aria-label="choc-unit-size"
                      value={chocSpacingId}
                      className="mb-2"
                      onChange={e => handleChocSpacing(e.target.value)}
                    >
                      {chocSpacingPresets.map(preset => (
                        <option key={preset.id} value={preset.id}>{preset.label}</option>
                      ))}
                      <option value="custom">Custom</option>
                    </Form.Select>
                    <Form.Text className="text-muted d-block mb-4">
                      Standard Choc is 18×17 mm (not 19.05 MX). Custom clears the boxes so you can type your own.
                    </Form.Text>
                  </>
                )}
                <Form.Label>Unit Width</Form.Label>
                <Form.Control
                  type="number"
                  required
                  step=".001"
                  min="0"
                  max="100"
                  value={unitWidth}
                  id="unit-width"
                  className="mb-4"
                  placeholder={isChocWorkflow ? "Width mm" : undefined}
                  onChange={e => handleUnitSizeChange("width", e.target.value)}
                />
                <Form.Label>Unit Height</Form.Label>
                <Form.Control
                  type="number"
                  required
                  step=".001"
                  min="0"
                  max="100"
                  value={unitHeight}
                  id="unit-height"
                  className="mb-4"
                  placeholder={isChocWorkflow ? "Height mm" : undefined}
                  onChange={e => handleUnitSizeChange("height", e.target.value)}
                />
                <Form.Label>Kerf</Form.Label>
                <Form.Control
                  type="number"
                  required
                  step=".001"
                  min="0"
                  max="100"
                  defaultValue="0"
                  id="kerf"
                  className="mb-4"
                  onChange={e => setKerf(e.target.value)}
                />
              </Form>
            </Col>


          </Row>

        </Card.Body>
      </Card>

      <Card className="p-0 rounded shadow bg-dark mb-5 overflow-hidden">
        <Card.Header className="d-flex flex-wrap align-items-start justify-content-between gap-2">
          <div>
            <h3 className="mt-2 text-white">{exportOutput?.label || 'Plate export'}</h3>
            <p className="text-white-50 mb-0 small">
              {exportOutput?.description || ''}
              {exportOutput?.layerSummary ? ` · ${exportOutput.layerSummary}` : ''}
              {exportOutput && !exportOutput.ready ? ' · paste KLE data to generate' : ''}
            </p>
          </div>
          <div className="d-flex flex-wrap gap-2 mt-2">
            <div className="btn-group" role="group" aria-label="Preview mode">
              {[
                { id: "together", label: "Together" },
                { id: "split", label: "Split" },
                { id: "layers", label: "Layers" },
                { id: "each", label: "Each" },
              ].map(mode => (
                <Button
                  key={mode.id}
                  variant={previewMode === mode.id ? "light" : "outline-light"}
                  size="sm"
                  onClick={() => setPreviewMode(mode.id)}
                >
                  {mode.label}
                </Button>
              ))}
            </div>
            <div className="btn-group" role="group" aria-label="Preview layout">
              {[
                { id: "portrait", label: "Portrait" },
                { id: "landscape", label: "Landscape" },
              ].map(layout => (
                <Button
                  key={layout.id}
                  variant={previewLayout === layout.id ? "light" : "outline-light"}
                  size="sm"
                  onClick={() => setPreviewLayout(layout.id)}
                >
                  {layout.label}
                </Button>
              ))}
            </div>
          </div>
        </Card.Header>
        {previewMode === "together" ? (
          <Card.Body
            className={`bg-dark plate-preview py-2 px-3 preview-layout-${previewLayout}`}
            dangerouslySetInnerHTML={{ __html: exportOutput?.ready ? exportOutput.previewSvg : '' }}
          />
        ) : (
          <Card.Body className={`bg-dark py-2 px-3 preview-panes preview-layout-${previewLayout}`}>
            {(previewMode === "split"
              ? [
                  { title: "Top + Shell", svg: exportOutput?.previewTopShell },
                  { title: "Link", svg: exportOutput?.previewLink },
                ]
              : previewMode === "layers"
              ? [
                  { title: "Top", svg: exportOutput?.previewTop },
                  { title: "Link", svg: exportOutput?.previewLink },
                  { title: "Shell", svg: exportOutput?.previewShell },
                ]
              : (exportOutput?.previewEach || [])
            ).map(pane => (
              <div key={pane.title} className="preview-pane">
                <div className="text-white-50 small mb-1">{pane.title}</div>
                <div
                  className="plate-preview"
                  dangerouslySetInnerHTML={{ __html: exportOutput?.ready ? (pane.svg || '') : '' }}
                />
              </div>
            ))}
          </Card.Body>
        )}
        <Card.Footer>
          {exportOutput?.ready && exportOutput.dxf ? (
            <Button
              variant="light"
              className="me-3"
              onClick={() => { downloadExport(exportOutput.dxf, ".dxf") }}
            >
              Download DXF
            </Button>
          ) : (
            <Button variant="light" className="me-3" disabled>Download DXF</Button>
          )}
          {exportOutput?.ready && exportOutput.svg ? (
            <Button
              variant="light"
              onClick={() => { downloadExport(exportOutput.svg, ".svg") }}
            >
              Download SVG
            </Button>
          ) : (
            <Button variant="light" disabled>Download SVG</Button>
          )}
        </Card.Footer>
      </Card>

      <Card className="rounded shadow overflow-hidden mb-5">
        <Card.Body>
          <Row>
            <Col lg={12}>
              <h3>Other plate parts</h3>
              <p className="mb-3">
                One multi-layer DXF/SVG with all drawings on separate layers.
                <strong> Top-*</strong> = switch plate, dots, back cut;
                <strong> Link-*</strong> = hotswap and hole cuts;
                <strong> Shell</strong> = case outline (offset from the plate, then from itself).
              </p>
              <Form className="ms-3 me-3 text-start">
                <Row>
                  <Col md={6} className="mb-3">
                    <Form.Label>Switch type</Form.Label>
                    <Form.Select
                      aria-label="stamp-switch-type"
                      value={stampSwitchFamily}
                      onChange={e => handleStampFamilyChange(e.target.value)}
                    >
                      {switchFamilies.map(family => (
                        <option key={family.id} value={family.id} disabled={!!family.disabled}>
                          {family.label}{family.disabled ? ' (coming soon)' : ''}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Text className="text-muted">
                      ★ MX and ★ Choc PG1350 include stamp layers. Other cutout types can still generate a plate.
                    </Form.Text>
                  </Col>
                  <Col md={6} className="mb-3">
                    <Form.Label>Hotswap fit</Form.Label>
                    <Form.Select
                      aria-label="stamp-hotswap-fit"
                      value={stampFit}
                      onChange={e => setStampFit(e.target.value)}
                      disabled={!selectedFamily?.fits?.length}
                    >
                      {(selectedFamily?.fits || []).map(fit => (
                        <option key={fit.id} value={fit.id}>{fit.label}</option>
                      ))}
                    </Form.Select>
                    <Form.Text className="text-muted">
                      {stampSwitchFamily === "choc"
                        ? "Choc PG1350 uses the Choc hotswap stamp."
                        : "Clearance for the MX hotswap socket stamp only."}
                    </Form.Text>
                  </Col>
                </Row>
                <Row>
                  <Col md={12} className="mb-3">
                    <Form.Check
                      type="checkbox"
                      id="mirror-stamps"
                      checked={mirrorStamps}
                      onChange={e => setMirrorStamps(e.target.checked)}
                      label={
                        <span>
                          <strong>Mirror stamps</strong>
                          <span className="text-muted">
                            {' '}— left-right flip of stamp geometry (hotswap, hole cuts, back cut, dots).
                          </span>
                        </span>
                      }
                    />
                  </Col>
                </Row>
                <div className="mt-3 mb-2">
                  <h5 style={{ textTransform: "none" }}>Outlines and layer notes</h5>
                  <p className="text-muted small">
                    Grouped the same way as the DXF layer names. Only one layer per part gets an outline
                    (Top-SWITCH_PLATE and Link-HOLE_CUTS). Offset and rounding are in mm.
                    Shell starts <strong>{defaultShellFromPlate} mm</strong> out from the plate outline, then
                    another <strong>{defaultShellFromSelf} mm</strong> from itself (inner + outer).
                    The note box is optional (<code>cut 1.5mm</code>, <code>extrude 2mm</code>); when filled it is
                    saved in the KLE data, drawn at the bottom-left of that layer, and appended to the layer name.
                  </p>
                  {(exportAssembly.layerGroups || []).map(group => (
                    <div key={group.group} className="mb-4">
                      <div className="fw-bold mb-2">{group.group}</div>
                      {group.layers.map(layer => (
                        <div key={layer.id} className="border rounded p-2 mb-2">
                          <div
                            className="mb-2"
                            style={{ color: "#212529", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontWeight: 600 }}
                          >
                            {annotatedLayerName(layer.label, layerNotes[layer.id])}
                          </div>
                          {layer.outlineKind === "shell" ? (
                            <Row className="g-2 mb-2">
                              <Col md={4}>
                                <Form.Label className="mb-1">Offset from plate (mm)</Form.Label>
                                <Form.Control
                                  type="number"
                                  step="0.1"
                                  value={outlineField(layer.id, "fromPlate", defaultShellFromPlate)}
                                  onChange={e => handleLayerOutlineChange(layer.id, "fromPlate", e.target.value)}
                                  aria-label={`${layer.id}-from-plate`}
                                />
                              </Col>
                              <Col md={4}>
                                <Form.Label className="mb-1">Offset from self (mm)</Form.Label>
                                <Form.Control
                                  type="number"
                                  step="0.1"
                                  value={outlineField(layer.id, "fromSelf", defaultShellFromSelf)}
                                  onChange={e => handleLayerOutlineChange(layer.id, "fromSelf", e.target.value)}
                                  aria-label={`${layer.id}-from-self`}
                                />
                              </Col>
                              <Col md={4}>
                                <Form.Label className="mb-1">Rounding (mm)</Form.Label>
                                <Form.Control
                                  type="number"
                                  step="0.1"
                                  value={outlineField(layer.id, "fillet", zoneDefaults.fillet)}
                                  onChange={e => handleLayerOutlineChange(layer.id, "fillet", e.target.value)}
                                  aria-label={`${layer.id}-fillet`}
                                />
                              </Col>
                            </Row>
                          ) : layer.outlineKind === "backcut" ? (
                            <>
                            <Row className="g-2 mb-2">
                              <Col md={stampSwitchFamily === "choc" ? 12 : 4}>
                                <Form.Label className="mb-1">Offset from switch + stabs (mm)</Form.Label>
                                <Form.Control
                                  type="number"
                                  step="0.1"
                                  value={outlineField(layer.id, "offset", backCutDefaultsForFamily(stampSwitchFamily).offset)}
                                  onChange={e => handleLayerOutlineChange(layer.id, "offset", e.target.value)}
                                  aria-label={`${layer.id}-offset`}
                                />
                              </Col>
                              {stampSwitchFamily !== "choc" && (
                                <>
                                  <Col md={4}>
                                    <Form.Label className="mb-1">Bump out (mm)</Form.Label>
                                    <Form.Control
                                      type="number"
                                      step="0.1"
                                      value={outlineField(layer.id, "bump", backCutDefaultsForFamily(stampSwitchFamily).bump)}
                                      onChange={e => handleLayerOutlineChange(layer.id, "bump", e.target.value)}
                                      aria-label={`${layer.id}-bump`}
                                    />
                                  </Col>
                                  <Col md={4}>
                                    <Form.Label className="mb-1">Blend / notch (mm)</Form.Label>
                                    <Form.Control
                                      type="number"
                                      step="0.1"
                                      value={outlineField(layer.id, "notch", backCutDefaultsForFamily(stampSwitchFamily).notch)}
                                      onChange={e => handleLayerOutlineChange(layer.id, "notch", e.target.value)}
                                      aria-label={`${layer.id}-notch`}
                                    />
                                  </Col>
                                </>
                              )}
                            </Row>
                            <Form.Text className="text-muted d-block mb-2">
                              MX Basic / Small / Alps: two housings are connected, merged with the switch, then offset, with bobbles on all four sides.
                              MX Spec already includes the bar, so that outline is expanded as-is and only the switch top and bottom get bobbles.
                              New corners use the stabilizer cutout fillet radius.
                            </Form.Text>
                            </>
                          ) : layer.outlineKind === "plate" ? (
                            <Row className="g-2 mb-2">
                              <Col md={6}>
                                <Form.Label className="mb-1">Offset (mm)</Form.Label>
                                <Form.Control
                                  type="number"
                                  step="0.1"
                                  value={outlineField(layer.id, "offset", zoneDefaults.offset)}
                                  onChange={e => handleLayerOutlineChange(layer.id, "offset", e.target.value)}
                                  aria-label={`${layer.id}-offset`}
                                />
                              </Col>
                              <Col md={6}>
                                <Form.Label className="mb-1">Rounding (mm)</Form.Label>
                                <Form.Control
                                  type="number"
                                  step="0.1"
                                  value={outlineField(layer.id, "fillet", zoneDefaults.fillet)}
                                  onChange={e => handleLayerOutlineChange(layer.id, "fillet", e.target.value)}
                                  aria-label={`${layer.id}-fillet`}
                                />
                              </Col>
                            </Row>
                          ) : null}
                          <Form.Label className="mb-1">Note</Form.Label>
                          <Form.Control
                            type="text"
                            value={layerNotes[layer.id] || ""}
                            placeholder="e.g. extrude 2mm"
                            onChange={e => handleLayerNoteChange(layer.id, e.target.value)}
                            aria-label={`layer-note-${layer.id}`}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <p className="text-muted small mb-0">
                  Layers: {exportSummary || '—'}
                  {' '}· one file like{' '}
                  <code>{sanitizeFilenamePart(keyboardTitle || 'Keyboard')}.abc123.dxf</code>
                </p>
              </Form>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="rounded shadow overflow-hidden mb-5" >

        <Tab.Container id="left-tabs-example" defaultActiveKey="data">
          <Row>
            <Col lg={4} as={Card.Header}>
              <Nav variant="pills" className="flex-column">
                <Nav.Item className="me-0">
                  <Nav.Link eventKey="data">Custom flags</Nav.Link>
                </Nav.Item>
                <Nav.Item className="me-0">
                  <Nav.Link eventKey="switch-cutout">Switch Cutout Types</Nav.Link>
                </Nav.Item>
                <Nav.Item className="me-0">
                  <Nav.Link eventKey="other-cutout">Other Cutout Types</Nav.Link>
                </Nav.Item>
                <Nav.Item className="me-0">
                  <Nav.Link eventKey="advanced">Advanced</Nav.Link>
                </Nav.Item>
                <Nav.Item className="me-0">
                  <Nav.Link eventKey="registration">Registration marks</Nav.Link>
                </Nav.Item>
                <Nav.Item className="me-0">
                  <Nav.Link eventKey="companion">KLE CAD</Nav.Link>
                </Nav.Item>
                <Nav.Item className="me-0">
                  <Nav.Link eventKey="about">About</Nav.Link>
                </Nav.Item>
              </Nav>
            </Col>
            <Col lg={8} as={Card.Body} className="p-4">
              <Tab.Content>
                <Tab.Pane eventKey="data" style={{ textAlign: "left" }}>
                  <DataHelpPane />
                </Tab.Pane>
                <Tab.Pane eventKey="switch-cutout" style={{ textAlign: "left" }}>
                  <SwitchCutoutPane />
                </Tab.Pane>
                <Tab.Pane eventKey="other-cutout" style={{ textAlign: "left" }}>
                  <OtherCutoutPane />
                </Tab.Pane>
                <Tab.Pane eventKey="advanced" style={{ textAlign: "left" }}>
                  <AdvancedPane />
                </Tab.Pane>
                <Tab.Pane eventKey="registration" style={{ textAlign: "left" }}>
                  <RegistrationHelpPane />
                </Tab.Pane>
                <Tab.Pane eventKey="companion" style={{ textAlign: "left" }}>
                  <CompanionPane />
                </Tab.Pane>
                <Tab.Pane eventKey="about" style={{ textAlign: "left" }}>
                  <AboutPane />
                </Tab.Pane>
              </Tab.Content>
            </Col>

          </Row>

        </Tab.Container>

      </Card>

      <br />



    </Container>
  );
}

export default App;
