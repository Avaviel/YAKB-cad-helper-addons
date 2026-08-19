import makerjs from "makerjs"

export const DOTS_OVERKILL_MM = 0.5
/** Disks closer than 2 * radius overlap. Collapse those clusters to one peg. */
export const DOTS_CLUSTER_MM = 3

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

/**
 * Merge overlapping pegs (three-in-a-row, stagger stacks, shared H uprights)
 * into one circle at the cluster centroid. Transitive: A-B and B-C become one
 * group even if A-C is just over the threshold.
 */
export function clusterMergeCircles(model, minDistMm = DOTS_CLUSTER_MM) {
  if (!model) {
    return { removed: 0, kept: 0, clusters: 0 }
  }
  const raw = Number(minDistMm)
  const minDist = Number.isFinite(raw) && raw > 0 ? raw : DOTS_CLUSTER_MM

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
        path,
      })
    },
  })

  const n = items.length
  if (n < 2) {
    return { removed: 0, kept: n, clusters: n }
  }

  const parent = items.map((_, i) => i)
  const find = i => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  const unite = (a, b) => {
    const pa = find(a)
    const pb = find(b)
    if (pa !== pb) parent[pb] = pa
  }

  const min2 = minDist * minDist
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = items[i].x - items[j].x
      const dy = items[i].y - items[j].y
      if (dx * dx + dy * dy < min2) {
        unite(i, j)
      }
    }
  }

  const groups = new Map()
  for (let i = 0; i < n; i++) {
    const root = find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(i)
  }

  let removed = 0
  let kept = 0
  for (const members of groups.values()) {
    kept += 1
    let sx = 0
    let sy = 0
    for (const i of members) {
      sx += items[i].x
      sy += items[i].y
    }
    const cx = sx / members.length
    const cy = sy / members.length
    const keep = items[members[0]]
    keep.path.origin = [cx, cy]
    for (let k = 1; k < members.length; k++) {
      const item = items[members[k]]
      if (item.parent && item.parent.paths && item.parent.paths[item.id]) {
        delete item.parent.paths[item.id]
        removed += 1
      }
    }
  }

  return { removed, kept, clusters: groups.size }
}

function toNum(value) {
  if (value == null) return 0
  if (typeof value === "number") return value
  if (typeof value.toNumber === "function") return value.toNumber()
  return Number(value)
}

function sharesColumn(key, other) {
  const myLeft = toNum(key.x)
  const myRight = myLeft + toNum(key.width)
  const myCx = toNum(key.centerX)
  const left = toNum(other.x)
  const right = left + toNum(other.width)
  const cx = toNum(other.centerX)
  return Math.abs(left - myLeft) < 0.1 || Math.abs(right - myRight) < 0.1 || Math.abs(cx - myCx) < 0.1
}

/**
 * True when this key sits on a seam under another row and does not share a
 * left edge, right edge, or centre with any key above (Q under 1/2, Z under A).
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
  return !above.some(other => sharesColumn(key, other))
}

/**
 * True when a row below is on this key's bottom seam and does not line up.
 * Number-row X bottoms land on QWERTY; those keys need this so we drop
 * the bottom pair and keep the ortho tops.
 */
export function isKeyStaggeredBelow(key, keysArray, seamU = 0.2) {
  if (!key || !keysArray || !keysArray.length) {
    return false
  }
  const myBottom = toNum(key.y) + toNum(key.height)
  const below = keysArray.filter(other => {
    if (other === key) return false
    return Math.abs(toNum(other.y) - myBottom) < seamU
  })
  if (!below.length) {
    return false
  }
  return !below.some(other => sharesColumn(key, other))
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
