import { useState, useEffect } from "react"
import { Button, Container, Card, Form, Row, Col, Image, Tab, Nav } from 'react-bootstrap'
import { parseKle } from "./KLEParser"
import { buildPlate } from "./PlateBuilder"
import { otherPartsConfig, getDefaultEnabledParts, resolveOtherPartForBuild } from "./otherPartsConfig"
import { buildOtherPart, exportOtherPart } from "./OtherPartsBuilder"
import Decimal from "decimal.js"
import makerjs from 'makerjs'
import fileDownload from 'js-file-download'
import logo from './logo.png'
import { DataHelpPane, SwitchCutoutPane, OtherCutoutPane, AdvancedPane, AboutPane } from './HelpPanes'


function App() {

  const [kleText, setKleText] = useState("")
  const [previewSvg, setPreviewSvg] = useState(null)
  const [plateSvg, setPlateSvg] = useState(null)
  const [plateDxf, setPlateDxf] = useState(null)

  const [switchCutoutType, setSwitchCutoutType] = useState("mx-basic")
  const [stabilizerCutoutType, setStabilizerCutoutType] = useState("mx-basic")
  const [acousticCutoutType, setAcousticCutoutType] = useState("none")

  const [switchRadius, setSwitchRadius] = useState(0.5)
  const [stabilizerRadius, setStabilizerRadius] = useState(0.5)
  const [acousticRadius, setAcousticRadius] = useState(0.5)

  const [unitWidth, setUnitWidth] = useState(19.05)
  const [unitHeight, setUnitHeight] = useState(19.05)
  const [kerf, setKerf] = useState(0)

  // Other plate parts (stamps) — independent of main plate export
  const [enabledOtherParts, setEnabledOtherParts] = useState(() => getDefaultEnabledParts())
  const [otherPartOutputs, setOtherPartOutputs] = useState({})
  // MX Hotswap fit: tight vs better-fit (used when the mx-hotswap group is enabled)
  const defaultMxHotswapVariant = (
    otherPartsConfig.find(p => p.id === 'mx-hotswap')?.defaultVariantId
  ) || 'mx-hotswap-betterfit'
  const [mxHotswapVariant, setMxHotswapVariant] = useState(defaultMxHotswapVariant)

  useEffect(() => {

    const kleReturn = parseKle(kleText)

    if (kleReturn && kleReturn.length > 0) {
      try {
        const plateData = buildPlate(kleReturn, {
          switchCutoutType: switchCutoutType,
          stabilizerCutoutType: stabilizerCutoutType,
          acousticCutoutType: acousticCutoutType,
          switchFilletRadius: new Decimal(switchRadius),
          stabilizerFilletRadius: new Decimal(stabilizerRadius),
          acousticFilletRadius: new Decimal(acousticRadius),
          unitWidth: new Decimal(unitWidth),
          unitHeight: new Decimal(unitHeight),
          kerf: new Decimal(kerf),
        })

        const previewSvgData = makerjs.exporter.toSVG(plateData, { stroke: 'white', strokeWidth: '0.5mm', svgAttrs: { width: '100%', height: '100%' } })
        setPreviewSvg(previewSvgData)
        const svgData = makerjs.exporter.toSVG(plateData, { units: makerjs.unitType.Millimeter })
        setPlateSvg(svgData)
        const dxfData = makerjs.exporter.toDXF(plateData, { units: makerjs.unitType.Millimeter })
        setPlateDxf(dxfData)

      } catch (error) {
        console.log(error)
        setPreviewSvg(null)
        setPlateSvg(null)
        setPlateDxf(null)
      }

    } else {
      setPreviewSvg(null)
      setPlateSvg(null)
      setPlateDxf(null)
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
    kerf
  ])

  // Separate effect: generate enabled other-plate parts without touching main plate logic
  useEffect(() => {
    const kleReturn = parseKle(kleText)
    const generatorOptions = {
      unitWidth: new Decimal(unitWidth),
      unitHeight: new Decimal(unitHeight),
    }

    const nextOutputs = {}

    for (const part of otherPartsConfig) {
      if (!enabledOtherParts[part.id]) {
        continue
      }

      try {
        const variantId = part.id === 'mx-hotswap' ? mxHotswapVariant : null
        const resolved = resolveOtherPartForBuild(part, variantId)
        if (!resolved) {
          continue
        }
        const model = buildOtherPart(resolved, kleReturn, generatorOptions)
        const exported = exportOtherPart(model)
        if (exported) {
          nextOutputs[part.id] = {
            ...exported,
            label: resolved.label,
            description: resolved.description,
            layerName: resolved.layerName,
            downloadId: resolved.variantId || resolved.id,
          }
        }
      } catch (error) {
        console.log(`Other part "${part.id}" failed:`, error)
      }
    }

    setOtherPartOutputs(nextOutputs)
  }, [
    kleText,
    unitWidth,
    unitHeight,
    enabledOtherParts,
    mxHotswapVariant,
  ])


  const downloadData = (fileData, extension, namePrefix = "plate") => {

    const date = new Date(Date.now())
    fileDownload(fileData, namePrefix + "-" + date.toISOString() + extension)

  }

  const toggleOtherPart = (partId, checked) => {
    setEnabledOtherParts(prev => ({
      ...prev,
      [partId]: checked,
    }))
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
                Optional stamp layers for 3D-printed hotswap builds. Each enabled part is exported
                separately from the main plate (its own preview, DXF, and SVG). Registration marks
                are included automatically in the CAD exports for alignment.
              </p>
              <Form className="ms-3 me-3 text-start">
                {otherPartsConfig.map(part => (
                  <div key={part.id} className="mb-3">
                    <Form.Check
                      type="checkbox"
                      id={`other-part-${part.id}`}
                      className="mb-1"
                      checked={!!enabledOtherParts[part.id]}
                      onChange={e => toggleOtherPart(part.id, e.target.checked)}
                      label={
                        <span>
                          <strong>{part.label}</strong>
                          {part.description ? (
                            <span className="text-muted"> — {part.description}</span>
                          ) : null}
                        </span>
                      }
                    />
                    {part.type === 'variant-group' && part.variants && part.variants.length > 0 && (
                      <Form.Group className="ms-4 mt-1" style={{ maxWidth: "280px" }}>
                        <Form.Label className="small mb-1">Fit</Form.Label>
                        <Form.Select
                          size="sm"
                          aria-label={`${part.label} fit`}
                          value={part.id === 'mx-hotswap' ? mxHotswapVariant : part.defaultVariantId}
                          disabled={!enabledOtherParts[part.id]}
                          onChange={e => {
                            if (part.id === 'mx-hotswap') {
                              setMxHotswapVariant(e.target.value)
                            }
                          }}
                        >
                          {part.variants.map(v => (
                            <option key={v.id} value={v.id}>{v.label}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    )}
                  </div>
                ))}
                {otherPartsConfig.length === 0 && (
                  <p className="text-muted small mt-2 mb-0">
                    Add <code>.json</code> stamp files under <code>src/stamps/</code> to list parts here.
                  </p>
                )}
              </Form>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="p-0 rounded shadow bg-dark mb-5 overflow-hidden">
        <Card.Header>
          <h3 className="mt-2 text-white">Preview and Download</h3>

        </Card.Header>
        <Card.Body className="bg-dark p-4" style={{ height: "30vh", minHeight: "250px" }} dangerouslySetInnerHTML={{ __html: previewSvg }}></Card.Body>
        <Card.Footer>
          {plateDxf &&
            <Button variant="light" className="me-3" onClick={() => { downloadData(plateDxf, ".dxf") }}>Download DXF</Button>
          }
          {plateSvg &&
            <Button variant="light" onClick={() => { downloadData(plateSvg, ".svg") }}>Download SVG</Button>
          }
          {!plateDxf &&
            <Button variant="light" className="me-3" disabled>Download DXF</Button>
          }
          {!plateSvg &&
            <Button variant="light" disabled>Download SVG</Button>
          }
        </Card.Footer>
      </Card>

      {otherPartsConfig.filter(part => enabledOtherParts[part.id]).map(part => {
        const output = otherPartOutputs[part.id]
        const title = output?.label || part.label
        const description = output?.description || part.description
        const layerName = output?.layerName || part.layerName
        const downloadId = output?.downloadId || part.id
        return (
          <Card key={part.id} className="p-0 rounded shadow bg-dark mb-5 overflow-hidden">
            <Card.Header>
              <h3 className="mt-2 text-white">{title}</h3>
              <p className="text-white-50 mb-0 small">
                {description}
                {layerName ? ` · layer ${layerName}` : ''}
                {!output ? ' · paste KLE data to generate stamp placement' : ''}
              </p>
            </Card.Header>
            <Card.Body
              className="bg-dark p-4"
              style={{ height: "30vh", minHeight: "250px" }}
              dangerouslySetInnerHTML={{ __html: output ? output.previewSvg : '' }}
            />
            <Card.Footer>
              {output && output.dxf ? (
                <Button
                  variant="light"
                  className="me-3"
                  onClick={() => { downloadData(output.dxf, ".dxf", "plate-" + downloadId) }}
                >
                  Download DXF
                </Button>
              ) : (
                <Button variant="light" className="me-3" disabled>Download DXF</Button>
              )}
              {output && output.svg ? (
                <Button
                  variant="light"
                  onClick={() => { downloadData(output.svg, ".svg", "plate-" + downloadId) }}
                >
                  Download SVG
                </Button>
              ) : (
                <Button variant="light" disabled>Download SVG</Button>
              )}
            </Card.Footer>
          </Card>
        )
      })}



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
