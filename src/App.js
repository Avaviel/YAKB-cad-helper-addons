import { useState, useEffect } from "react"
import { Button, Container, Card, Form, Row, Col, Image, Tab, Nav } from 'react-bootstrap'
import { parseKle } from "./KLEParser"
import { buildPlate } from "./PlateBuilder"
import {
  switchFamilies,
  defaultSwitchFamilyId,
  defaultFitId,
  getExportAssembly,
  getExportSummary,
} from "./otherPartsConfig"
import {
  buildExportAssembly,
  exportOtherPart,
  makeDownloadFilename,
  sanitizeFilenamePart,
} from "./OtherPartsBuilder"
import Decimal from "decimal.js"
import fileDownload from 'js-file-download'
import logo from './logo.png'
import { DataHelpPane, SwitchCutoutPane, OtherCutoutPane, AdvancedPane, RegistrationHelpPane, AboutPane } from './HelpPanes'


function App() {

  const [kleText, setKleText] = useState("")
  // Keyboard title used in download filenames (e.g. Macropad.lm9k2a.dxf)
  const [keyboardTitle, setKeyboardTitle] = useState("Keyboard")

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
  // Left-right mirror of stamp geometry only (registration stays at absolute X/Y)
  const [mirrorStamps, setMirrorStamps] = useState(false)
  // Single full export (preview + dxf + svg)
  const [exportOutput, setExportOutput] = useState(null)
  // Registration mark center in millimeters (strings so users can type "-" / intermediate values)
  const [registrationX, setRegistrationX] = useState('-100')
  const [registrationY, setRegistrationY] = useState('-100')

  const selectedFamily = switchFamilies.find(f => f.id === stampSwitchFamily) || switchFamilies[0]
  const exportSummary = getExportSummary(stampSwitchFamily, stampFit)

  const parseRegCoord = (raw, fallback = -100) => {
    if (raw === '' || raw === '-' || raw === '.' || raw === '-.') {
      return fallback
    }
    const n = Number(raw)
    return Number.isFinite(n) ? n : fallback
  }

  // Build one multi-layer DXF/SVG: Top + Link layers + CONSTRUCTION
  useEffect(() => {
    const kleReturn = parseKle(kleText)
    const generatorOptions = {
      switchCutoutType: switchCutoutType,
      stabilizerCutoutType: stabilizerCutoutType,
      acousticCutoutType: acousticCutoutType,
      switchFilletRadius: new Decimal(switchRadius),
      stabilizerFilletRadius: new Decimal(stabilizerRadius),
      acousticFilletRadius: new Decimal(acousticRadius),
      unitWidth: new Decimal(unitWidth),
      unitHeight: new Decimal(unitHeight),
      kerf: new Decimal(kerf),
      registrationX: new Decimal(parseRegCoord(registrationX)),
      registrationY: new Decimal(parseRegCoord(registrationY)),
      mirrorStamps: !!mirrorStamps,
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
      setExportOutput({
        id: assembly.id,
        label: assembly.label,
        description: assembly.description,
        layerSummary: assembly.layerSummary,
        ...(exported || {}),
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
    registrationX,
    registrationY,
  ])


  const downloadExport = (fileData, extension) => {
    const filename = makeDownloadFilename(keyboardTitle, extension)
    fileDownload(fileData, filename)
  }

  const handleStampFamilyChange = (familyId) => {
    setStampSwitchFamily(familyId)
    const family = switchFamilies.find(f => f.id === familyId)
    if (family?.defaultFitId) {
      setStampFit(family.defaultFitId)
    } else if (family?.fits?.length) {
      setStampFit(family.fits[0].id)
    }
  }


  return (
    <Container className="App justify-content-center" style={{ textAlign: "center" }}>

      <div className="pt-4 pb-4">
        <a href="https://ai03.com/">
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
          <strong>MX</strong> hotswap support is available now. <strong>Kailh Choc</strong> support is planned for a future update.
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
                  onChange={e => setKeyboardTitle(e.target.value)}
                  aria-label="keyboard-title"
                />
                <Form.Text className="text-muted">
                  Used in download names: <code>Title.unique.dxf</code>
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
                  onChange={text => setKleText(text.target.value)} />
              </Form>
            </Col>
          </Row>

        </Card.Body>
      </Card>

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
                  selected="mx-basic"
                  className="mb-4"
                  onChange={e => setSwitchCutoutType(e.target.value)}
                >
                  <option value="mx-basic">Cherry MX Basic</option>
                  <option value="alps-skcm">Alps SKCM/L</option>
                  <option value="choc-cpg1350">Kailh Choc CPG1350</option>
                  <option value="choc-cpg1232">Kailh Mini Choc CPG1232</option>
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
                <Form.Label>Unit Width</Form.Label>
                <Form.Control
                  type="number"
                  required
                  step=".001"
                  min="0"
                  max="100"
                  defaultValue="19.05"
                  id="unit-width"
                  className="mb-4"
                  onChange={e => setUnitWidth(e.target.value)}
                />
                <Form.Label>Unit Height</Form.Label>
                <Form.Control
                  type="number"
                  required
                  step=".001"
                  min="0"
                  max="100"
                  defaultValue="19.05"
                  id="unit-height"
                  className="mb-4"
                  onChange={e => setUnitHeight(e.target.value)}
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

      <Card className="rounded shadow overflow-hidden mb-5">
        <Card.Body>
          <Row>
            <Col lg={12}>
              <h3>Other plate parts</h3>
              <p className="mb-3">
                One multi-layer DXF/SVG with all drawings on separate layers.
                <strong> Top-*</strong> = switch plate related;
                <strong> Link-*</strong> = secondary plate (MX now; Choc later).
                Registration stays on <code>CONSTRUCTION</code>.
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
                      MX is available now. Kailh Choc is planned for a future update.
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
                      Clearance for the MX hotswap socket stamp only.
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
                            {' '}— left-right flip of stamp geometry (hotswap, hole cuts, etc.).
                            Registration marks stay at the X/Y below so layers still align.
                          </span>
                        </span>
                      }
                    />
                  </Col>
                </Row>
                <Row>
                  <Col md={12} className="mb-2">
                    <Form.Label className="mb-1">Registration mark location (mm)</Form.Label>
                    <Form.Text className="d-block text-muted mb-2">
                      Alignment X on the CONSTRUCTION layer in the single export.
                      Default (−100, −100) sits outside a typical plate.
                    </Form.Text>
                  </Col>
                  <Col md={6} className="mb-3">
                    <Form.Label>X</Form.Label>
                    <Form.Control
                      type="text"
                      inputMode="decimal"
                      value={registrationX}
                      onChange={e => {
                        const v = e.target.value
                        // Allow empty, minus, digits, and one decimal point while typing
                        if (v === '' || /^-?\d*\.?\d*$/.test(v)) {
                          setRegistrationX(v)
                        }
                      }}
                      aria-label="registration-x"
                    />
                  </Col>
                  <Col md={6} className="mb-3">
                    <Form.Label>Y</Form.Label>
                    <Form.Control
                      type="text"
                      inputMode="decimal"
                      value={registrationY}
                      onChange={e => {
                        const v = e.target.value
                        if (v === '' || /^-?\d*\.?\d*$/.test(v)) {
                          setRegistrationY(v)
                        }
                      }}
                      aria-label="registration-y"
                    />
                  </Col>
                </Row>
                <p className="text-muted small mb-0">
                  Layers: {exportSummary || '—'}
                  {' '}· file like{' '}
                  <code>{sanitizeFilenamePart(keyboardTitle || 'Keyboard')}.abc123.dxf</code>
                </p>
              </Form>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="p-0 rounded shadow bg-dark mb-5 overflow-hidden">
        <Card.Header>
          <h3 className="mt-2 text-white">{exportOutput?.label || 'Plate export'}</h3>
          <p className="text-white-50 mb-0 small">
            {exportOutput?.description || ''}
            {exportOutput?.layerSummary ? ` · ${exportOutput.layerSummary}` : ''}
            {exportOutput && !exportOutput.ready ? ' · paste KLE data to generate' : ''}
          </p>
        </Card.Header>
        <Card.Body
          className="bg-dark p-4"
          style={{ height: "30vh", minHeight: "250px" }}
          dangerouslySetInnerHTML={{ __html: exportOutput?.ready ? exportOutput.previewSvg : '' }}
        />
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
