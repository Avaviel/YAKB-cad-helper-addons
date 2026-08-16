import { parseKle, readKleLayerState, writeKleLayerState } from "./KLEParser"

const compactDeskHead = `{name:"CAD desk (split islands)",_zones:{1:{offset:16,fillet:6,shape:"convex"},2:{offset:16,fillet:6,shape:"convex"}}},
[{y:0.25,x:1,w:2},"Napping"]`

test("compact raw data with bare numeric _zones keys still parses", () => {
  const parsed = parseKle(compactDeskHead)
  expect(parsed).toBeTruthy()
  expect(parsed.name).toBe("CAD desk (split islands)")
  expect(parsed.zoneSettings[1].offset).toBe(16)
  expect(parsed.zoneSettings[2].fillet).toBe(6)
  expect(parsed.keys.length).toBeGreaterThan(0)
})

test("title block writes back into KLE meta and reads out again", () => {
  const written = writeKleLayerState(compactDeskHead, {
    notes: {},
    outlines: {},
    name: "CAD desk (split islands)",
    titleBlock: { date: "2026-08-16", designer: "Avaviel", jobNo: "J-1", notes: "cut 2mm" },
  })
  expect(written).toContain("_titleBlock")
  const state = readKleLayerState(written)
  expect(state.titleBlock.designer).toBe("Avaviel")
  expect(state.titleBlock.jobNo).toBe("J-1")
  expect(state.name).toBe("CAD desk (split islands)")
})
