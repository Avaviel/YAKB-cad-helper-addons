import makerjs from "makerjs"

export const DOTS_OVERKILL_MM = 0.5

/**
 * AutoCAD-style OVERKILL for circles: if two centres are within tolerance
 * (and radii match), keep the first and delete the rest. Used on Top-Dots
 * so neighbouring keys do not stack four bosses on the same corner.
 */
export function overkillCircles(model, toleranceMm = DOTS_OVERKILL_MM) {
  if (!model) {
    return { removed: 0, kept: 0 }
  }
  const tol = Number(toleranceMm)
  const fuzz = Number.isFinite(tol) && tol > 0 ? tol : DOTS_OVERKILL_MM

  makerjs.model.originate(model)

  const items = []
  makerjs.model.walk(model, {
    onPath: walked => {
      const path = walked.pathContext
      if (!path || path.type !== "circle" || !path.origin) {
        return
      }
      items.push({
        x: path.origin[0],
        y: path.origin[1],
        r: Number(path.radius) || 0,
        parent: walked.modelContext,
        id: walked.pathId,
      })
    },
  })

  const drop = new Set()
  let kept = 0
  for (let i = 0; i < items.length; i++) {
    if (drop.has(i)) continue
    kept += 1
    for (let j = i + 1; j < items.length; j++) {
      if (drop.has(j)) continue
      const dx = items[i].x - items[j].x
      const dy = items[i].y - items[j].y
      const dr = Math.abs(items[i].r - items[j].r)
      if (Math.hypot(dx, dy) <= fuzz && dr <= fuzz) {
        drop.add(j)
      }
    }
  }

  for (const i of drop) {
    const item = items[i]
    if (item.parent && item.parent.paths && item.parent.paths[item.id]) {
      delete item.parent.paths[item.id]
    }
  }

  return { removed: drop.size, kept }
}

/** Radius around each switch that must stay clear of dots (mm). */
export const SWITCH_DOT_KEEPOUT_MM = 11

function toNum(value) {
  if (value == null) return 0
  if (typeof value === "number") return value
  if (typeof value.toNumber === "function") return value.toNumber()
  return Number(value)
}

function keySwitchWorld(key, unitWidth, unitHeight) {
  const ux = toNum(unitWidth) || 19.05
  const uy = toNum(unitHeight) || ux
  let cx
  let cy
  if (key.centerX && typeof key.centerX.times === "function") {
    cx = toNum(key.centerX.times(unitWidth))
    cy = toNum(key.centerY.times(unitHeight)) * -1
  } else {
    cx = toNum(key.centerX) * ux
    cy = toNum(key.centerY) * uy * -1
  }
  let deg = 0
  if (key.angle && typeof key.angle.plus === "function") {
    const extra = key.independentSwitchAngle || 0
    deg = toNum(key.angle.plus(extra).times(-1))
  } else {
    deg = -(toNum(key.angle) + toNum(key.independentSwitchAngle))
  }
  const rad = (deg * Math.PI) / 180
  return { cx, cy, cos: Math.cos(rad), sin: Math.sin(rad) }
}

function circleHitsKeepout(x, y, sw, keepoutR) {
  return Math.hypot(x - sw.cx, y - sw.cy) <= keepoutR
}

/**
 * Delete dots that sit in a circular switch keep-out. A 0.5U stagger puts a
 * neighbour corner on the switch centreline 9.525 mm away — outside the 14 mm
 * hole, but on the MX body so the switch cannot snap in. Own 1U corners sit
 * 13.5 mm out and are kept.
 */
export function cullDotsInSwitchKeepout(model, keysArray, generatorOptions, keepoutHalfMm = SWITCH_DOT_KEEPOUT_MM) {
  if (!model || !keysArray || !keysArray.length) {
    return { removed: 0 }
  }
  const keep = Number(keepoutHalfMm)
  const half = Number.isFinite(keep) && keep > 0 ? keep : SWITCH_DOT_KEEPOUT_MM
  const unitWidth = generatorOptions && generatorOptions.unitWidth
  const unitHeight = generatorOptions && generatorOptions.unitHeight

  makerjs.model.originate(model)

  const switches = keysArray.map(key => keySwitchWorld(key, unitWidth, unitHeight))
  const drop = []
  makerjs.model.walk(model, {
    onPath: walked => {
      const path = walked.pathContext
      if (!path || path.type !== "circle" || !path.origin) return
      const x = path.origin[0]
      const y = path.origin[1]
      for (const sw of switches) {
        if (circleHitsKeepout(x, y, sw, half)) {
          drop.push({ parent: walked.modelContext, id: walked.pathId })
          return
        }
      }
    },
  })

  for (const item of drop) {
    if (item.parent && item.parent.paths && item.parent.paths[item.id]) {
      delete item.parent.paths[item.id]
    }
  }
  return { removed: drop.length }
}
