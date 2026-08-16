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

test("yakb plate settings write back and survive a second key row", () => {
  const written = writeKleLayerState(compactDeskHead, {
    notes: {},
    outlines: {},
    name: "CAD desk (split islands)",
    yakb: {
      switchCutoutType: "choc-cpg1350",
      stabilizerCutoutType: "mx-spec",
      unitWidth: 18,
      unitHeight: 17,
      chocSpacingId: "18x17",
      stampSwitchFamily: "choc",
      stampFit: "standard",
    },
  })
  expect(written).toContain("_yakb")
  expect(written).toContain("choc-cpg1350")
  expect(written).toContain("Napping")
  const state = readKleLayerState(written)
  expect(state.yakb.switchCutoutType).toBe("choc-cpg1350")
  expect(state.yakb.unitWidth).toBe(18)
  expect(state.yakb.chocSpacingId).toBe("18x17")
  const withExtraKey = written.replace('"Napping"', '"Napping"],\n  [{w:1},"Esc"')
  const again = writeKleLayerState(withExtraKey, {
    notes: {},
    outlines: {},
    name: "CAD desk (split islands)",
    yakb: state.yakb,
  })
  expect(again).toContain("Esc")
  expect(readKleLayerState(again).yakb.switchCutoutType).toBe("choc-cpg1350")
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
