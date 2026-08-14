import makerjs from 'makerjs'
import Decimal from 'decimal.js'

import { SwitchMXBasic } from './cutouts/SwitchMXBasic'
import { SwitchAlpsSKCM } from './cutouts/SwitchAlpsSKCM'
import { SwitchAlpsSKCP } from './cutouts/SwitchAlpsSKCP'
import { SwitchChocCPG1232 } from './cutouts/SwitchChocCPG1232'
import { SwitchChocCPG1350 } from './cutouts/SwitchChocCPG1350'
import { SwitchOmronB3G } from './cutouts/SwitchOmronB3G'
import { SwitchHiTek725 } from './cutouts/SwitchHiTek725'
import { SwitchIRocks } from './cutouts/SwitchIRocks'
import { SwitchFutabaMA } from './cutouts/SwitchFutabaMA'

import { StabilizerMXBasic } from './cutouts/StabilizerMXBasic'
import { StabilizerMXSmall } from './cutouts/StabilizerMXSmall'
import { StabilizerMXSpec } from './cutouts/StabilizerMXSpec'
import { StabilizerAlpsAEK } from './cutouts/StabilizerAlpsAEK'
import { StabilizerAlpsAT101 } from './cutouts/StabilizerAlpsAT101'
import { NullGenerator } from './cutouts/NullGenerator'

import { AcousticMXBasic } from './cutouts/AcousticMXBasic'
import { AcousticMXExtreme } from './cutouts/AcousticMXExtreme'


function uniquePoints(pts, eps = 0.02) {
    const out = []
    const lim = eps * eps
    for (const p of pts || []) {
        if (!out.some(q => {
            const dx = p.x - q.x
            const dy = p.y - q.y
            return dx * dx + dy * dy < lim
        })) {
            out.push(p)
        }
    }
    return out
}

function convexHull(pts) {
    pts = uniquePoints(pts)
    if (pts.length <= 2) {
        return pts.slice()
    }
    const sorted = pts.slice().sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
    const build = list => {
        const hull = []
        for (const p of list) {
            while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) < 0) {
                hull.pop()
            }
            hull.push(p)
        }
        return hull
    }
    const lower = build(sorted)
    const upper = build(sorted.slice().reverse())
    lower.pop()
    upper.pop()
    return lower.concat(upper)
}

function pointInPoly(p, poly) {
    let inside = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y
        if (((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / ((yj - yi) || 1e-12) + xi)) {
            inside = !inside
        }
    }
    return inside
}

function concaveHull(pts, maxEdge = 3) {
    const hull = convexHull(pts)
    if (hull.length < 3) {
        return hull
    }
    const pid = p => `${Math.round(p.x * 100)}:${Math.round(p.y * 100)}`
    const used = {}
    hull.forEach(p => { used[pid(p)] = true })
    const interior = pts.filter(p => !used[pid(p)])
    let guard = 0
    while (interior.length && guard++ < pts.length * 5) {
        let bestI = -1
        let bestJ = -1
        let bestScore = Infinity
        for (let i = 0; i < hull.length; i++) {
            const a = hull[i]
            const b = hull[(i + 1) % hull.length]
            const abx = b.x - a.x
            const aby = b.y - a.y
            const elen = Math.hypot(abx, aby)
            if (elen < maxEdge) {
                continue
            }
            for (let j = 0; j < interior.length; j++) {
                const p = interior[j]
                if (!pointInPoly(p, hull)) {
                    continue
                }
                const t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / (elen * elen || 1)
                if (t <= 0.08 || t >= 0.92) {
                    continue
                }
                const qx = a.x + t * abx
                const qy = a.y + t * aby
                const d = Math.hypot(p.x - qx, p.y - qy)
                if (d > elen * 0.7) {
                    continue
                }
                if (d < bestScore) {
                    bestScore = d
                    bestI = i
                    bestJ = j
                }
            }
        }
        if (bestI < 0) {
            break
        }
        hull.splice(bestI + 1, 0, interior[bestJ])
        interior.splice(bestJ, 1)
    }
    return hull
}

function offsetPolygon(pts, dist) {
    if (!dist || pts.length < 2) {
        return pts
    }
    const n = pts.length
    let cx = 0
    let cy = 0
    for (const p of pts) {
        cx += p.x
        cy += p.y
    }
    cx /= n
    cy /= n
    const out = []
    for (let i = 0; i < n; i++) {
        const prev = pts[(i + n - 1) % n]
        const cur = pts[i]
        const next = pts[(i + 1) % n]
        let n1x = cur.y - prev.y
        let n1y = prev.x - cur.x
        let n2x = next.y - cur.y
        let n2y = cur.x - next.x
        const m1x = (prev.x + cur.x) / 2
        const m1y = (prev.y + cur.y) / 2
        if ((m1x - cx) * n1x + (m1y - cy) * n1y < 0) {
            n1x = -n1x
            n1y = -n1y
        }
        const m2x = (cur.x + next.x) / 2
        const m2y = (cur.y + next.y) / 2
        if ((m2x - cx) * n2x + (m2y - cy) * n2y < 0) {
            n2x = -n2x
            n2y = -n2y
        }
        const l1 = Math.hypot(n1x, n1y) || 1
        const l2 = Math.hypot(n2x, n2y) || 1
        n1x /= l1
        n1y /= l1
        n2x /= l2
        n2y /= l2
        let bx = n1x + n2x
        let by = n1y + n2y
        const bl = Math.hypot(bx, by)
        if (bl < 1e-6) {
            out.push({ x: cur.x + n1x * dist, y: cur.y + n1y * dist })
            continue
        }
        bx /= bl
        by /= bl
        const miter = dist / Math.max(0.25, n1x * bx + n1y * by)
        out.push({ x: cur.x + bx * miter, y: cur.y + by * miter })
    }
    return out
}

function toNum(v, fallback = 0) {
    if (v == null || v === "") {
        return fallback
    }
    if (typeof v.toNumber === "function") {
        const n = v.toNumber()
        return Number.isFinite(n) ? n : fallback
    }
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
}

export function zoneOutlineDefaults(outlines) {
    const first = (outlines && outlines[0]) || {}
    return {
        offset: toNum(first.offset, 16),
        fillet: toNum(first.fillet, 6),
    }
}

/**
 * Build island outlines. offset/fillet overrides apply to every zone;
 * otherwise each zone uses its KLE _zones values.
 */
export function buildOutlineModel(outlines, generatorOptions, options = {}) {
    if (!outlines || !outlines.length) {
        return null
    }

    const unitWidth = generatorOptions && generatorOptions.unitWidth
    const unitHeight = generatorOptions && generatorOptions.unitHeight
    const unitNum = toNum(unitWidth, 19.05)
    const heightNum = toNum(unitHeight, 19.05)
    const canvas = { models: {} }
    let drew = false

    for (const outline of outlines) {
        const verts = (outline && outline.vertices) || []
        if (verts.length < 2) {
            continue
        }

        let pts = verts.map(v => ({
            x: toNum(v.centerX != null ? v.centerX : v.x),
            y: toNum(v.centerY != null ? v.centerY : v.y),
        })).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
        if (pts.length < 2) {
            continue
        }
        if (outline.shape !== "path") {
            pts = concaveHull(pts, 3)
        }
        const offsetMm = options.offset != null ? toNum(options.offset, 0) : toNum(outline.offset, 0)
        pts = offsetPolygon(pts, offsetMm / unitNum)

        const points = pts.map(p => [
            new Decimal(p.x).times(unitNum).toNumber(),
            new Decimal(p.y).times(heightNum).times(-1).toNumber(),
        ])
        const paths = {}
        for (let i = 0; i < points.length; i++) {
            paths["edge" + i] = new makerjs.paths.Line(points[i], points[(i + 1) % points.length])
        }
        const fillet = options.fillet != null ? toNum(options.fillet, 0) : toNum(outline.fillet, 0)
        if (fillet > 0 && points.length >= 3) {
            const names = Object.keys(paths)
            for (let i = 0; i < names.length; i++) {
                const a = paths[names[i]]
                const b = paths[names[(i + 1) % names.length]]
                if (makerjs.path.fillet) {
                    const arc = makerjs.path.fillet(a, b, fillet)
                    if (arc) {
                        paths["fillet" + i] = arc
                    }
                }
            }
        }
        canvas.models["OutlineZone" + outline.zone] = { paths }
        drew = true
    }

    return drew ? canvas : null
}

function addZoneOutlines(canvas, generatorOptions) {
    const model = buildOutlineModel(generatorOptions && generatorOptions.outlines, generatorOptions)
    if (!model) {
        return false
    }
    Object.assign(canvas.models, model.models)
    return true
}

export function buildPlate(keysArray, generatorOptions) {


    let canvas = { models: {} }
    let id = 0

    let minX = new Decimal(Number.POSITIVE_INFINITY)
    let minY = new Decimal(Number.POSITIVE_INFINITY)
    let maxX = new Decimal(Number.NEGATIVE_INFINITY)
    let maxY = new Decimal(Number.NEGATIVE_INFINITY)

    let switchGenerator;
    console.log(generatorOptions.switchCutoutType)
    switch (generatorOptions.switchCutoutType) {
        case "mx-basic":
            switchGenerator = new SwitchMXBasic();
            break;
        case "alps-skcm":
            switchGenerator = new SwitchAlpsSKCM();
            break;
        case "choc-cpg1232":
            switchGenerator = new SwitchChocCPG1232();
            break;
        case "choc-cpg1350":
            switchGenerator = new SwitchChocCPG1350();
            break;
        case "omron-b3g":
            switchGenerator = new SwitchOmronB3G();
            break;
        case "alps-skcp":
            switchGenerator = new SwitchAlpsSKCP();
            break;
        case "hitek-725":
            switchGenerator = new SwitchHiTek725();
            break;
        case "i-rocks":
            switchGenerator = new SwitchIRocks();
            break;
        case "futaba-ma":
            switchGenerator = new SwitchFutabaMA();
            break;
        default:
            console.error("Unsupported switch type")
            return null
    }

    let stabilizerGenerator = null
    switch (generatorOptions.stabilizerCutoutType) {
        case "mx-basic":
            stabilizerGenerator = new StabilizerMXBasic();
            break;
        case "mx-small":
            stabilizerGenerator = new StabilizerMXSmall();
            break;
        case "mx-spec":
            stabilizerGenerator = new StabilizerMXSpec();
            break;
        case "alps-aek":
            stabilizerGenerator = new StabilizerAlpsAEK();
            break;
        case "alps-at101":
            stabilizerGenerator = new StabilizerAlpsAT101();
            break;
        case "none":
            stabilizerGenerator = new NullGenerator();
            break;
        default:
            console.error("Unsupported stabilizer type")
            return null
    }

    let acousticGenerator = null
    switch (generatorOptions.acousticCutoutType) {
        case "none":
            acousticGenerator = new NullGenerator();
            break;
        case "mx-basic":
            acousticGenerator = new AcousticMXBasic();
            break;
        case "mx-extreme":
            acousticGenerator = new AcousticMXExtreme();
            break;
        default:
            console.error("Unsupported acoustic cutout type")
            return null
    }




    for (const key of keysArray) {

        let origin = {
            x: key.centerX.times(generatorOptions.unitWidth),
            y: key.centerY.times(generatorOptions.unitHeight)
        }

        const originNum = [origin.x.toNumber(), origin.y.times(-1).toNumber()]

        // Render switch
        let switchCutout = makerjs.model.rotate(switchGenerator.generate(key, generatorOptions), key.angle.plus(key.independentSwitchAngle).times(-1).toNumber())
        switchCutout.origin = originNum
        canvas.models["Switch" + id.toString()] = switchCutout

        // Render stabilizer
        let stabilizerCutout = stabilizerGenerator.generate(key, generatorOptions)
        if (stabilizerCutout) {
            stabilizerCutout.origin = originNum
            stabilizerCutout = makerjs.model.rotate(stabilizerCutout, key.angle.plus(key.stabilizerAngle).times(-1).toNumber(), originNum)
            canvas.models["Stabilizer" + id.toString()] = stabilizerCutout
        }

        // Render acoustic cutouts
        let acousticCutout = acousticGenerator.generate(key, generatorOptions)
        if (acousticCutout) {
            acousticCutout.origin = originNum
            acousticCutout = makerjs.model.rotate(acousticCutout, key.angle.plus(key.stabilizerAngle).times(-1).toNumber(), originNum)
            canvas.models["Acoustic" + id.toString()] = acousticCutout
        }

        // TODO: Render acoustic cutouts

        let tempMinX = origin.x.minus(key.width.times(generatorOptions.unitWidth).times(0.5))
        let tempMaxX = origin.x.plus(key.width.times(generatorOptions.unitWidth).times(0.5))

        let tempMinY = origin.y.minus(key.height.times(generatorOptions.unitHeight).times(0.5))
        let tempMaxY = origin.y.plus(key.height.times(generatorOptions.unitHeight).times(0.5))


        if (tempMinX.lt(minX)) {
            minX = tempMinX
        }
        if (tempMinY.lt(minY)) {
            minY = tempMinY
        }
        if (tempMaxX.gt(maxX)) {
            maxX = tempMaxX
        }
        if (tempMaxY.gt(maxY)) {
            maxY = tempMaxY
        }

        id += 1
    }

    const hasZones = generatorOptions.outlines && generatorOptions.outlines.length
    const drewZones = generatorOptions.skipEmbeddedOutlines
        ? !!hasZones
        : addZoneOutlines(canvas, generatorOptions)
    if (!drewZones) {
        // Fallback: one axis-aligned box around every key
        let upperLeft = [minX.toNumber(), maxY.times(-1).toNumber()]
        let upperRight = [maxX.toNumber(), maxY.times(-1).toNumber()]
        let lowerLeft = [minX.toNumber(), minY.times(-1).toNumber()]
        let lowerRight = [maxX.toNumber(), minY.times(-1).toNumber()]

        var boundingBox = {
            paths: {
                lineTop: new makerjs.paths.Line(upperLeft, upperRight),
                lineBottom: new makerjs.paths.Line(lowerLeft, lowerRight),
                lineLeft: new makerjs.paths.Line(upperLeft, lowerLeft),
                lineRight: new makerjs.paths.Line(upperRight, lowerRight)
            }
        }

        canvas.models["BoundingBox0"] = boundingBox
    }

    // Registration / CONSTRUCTION marks removed — layers are already co-aligned.

    return canvas

}