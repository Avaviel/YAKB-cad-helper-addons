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

function toNum(value) {
  if (value == null) return 0
  if (typeof value === "number") return value
  if (typeof value.toNumber === "function") return value.toNumber()
  return Number(value)
}

/**
 * True when this key sits on a seam under another row and does not share a
 * left edge, right edge, or centre with any key above. Those are the
 * staggered keys whose top bosses land on the switch above.
 */
export function isKeyStaggered(key, keysArray, seamU = 0.2) {
  if (!key || !keysArray || !keysArray.length) {
    return false
  }
  const myTop = toNum(key.y)
  const above = keysArray.filter(other => {
    if (other === key) return false
    const bottom = toNum(other.y) + toNum(other.height)
    return Math.abs(bottom - myTop) < seamU
  })
  if (!above.length) {
    return false
  }
  const myLeft = toNum(key.x)
  const myRight = myLeft + toNum(key.width)
  const myCx = toNum(key.centerX)
  const linedUp = above.some(other => {
    const left = toNum(other.x)
    const right = left + toNum(other.width)
    const cx = toNum(other.centerX)
    return Math.abs(left - myLeft) < 0.1 || Math.abs(right - myRight) < 0.1 || Math.abs(cx - myCx) < 0.1
  })
  return !linedUp
}

/** Remove stamp circles on the key-local top (+Y) before rotation. */
export function stripTopStampCircles(model) {
  if (!model || !model.paths) {
    return 0
  }
  let removed = 0
  for (const [id, path] of Object.entries(model.paths)) {
    if (path && path.type === "circle" && path.origin && path.origin[1] > 0.1) {
      delete model.paths[id]
      removed += 1
    }
  }
  return removed
}
