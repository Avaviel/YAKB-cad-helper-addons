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


function rotatePoint(x, y, ox, oy, deg) {
    if (!deg) {
        return { x, y }
    }
    const rad = (deg * Math.PI) / 180
    const dx = x - ox
    const dy = y - oy
    return {
        x: ox + dx * Math.cos(rad) - dy * Math.sin(rad),
        y: oy + dx * Math.sin(rad) + dy * Math.cos(rad),
    }
}

function vertexBoxCorners(vert) {
    const x = Number(vert.x)
    const y = Number(vert.y)
    const w = Number(vert.width || 0.5)
    const h = Number(vert.height || 0.5)
    const ox = Number(vert.rotx || 0)
    const oy = Number(vert.roty || 0)
    const ang = Number(vert.angle || 0)
    return [
        rotatePoint(x, y, ox, oy, ang),
        rotatePoint(x + w, y, ox, oy, ang),
        rotatePoint(x + w, y + h, ox, oy, ang),
        rotatePoint(x, y + h, ox, oy, ang),
    ]
}

function farthestFrom(pts, cx, cy) {
    let best = pts[0]
    let bestD = -1
    for (const p of pts) {
        const d = (p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy)
        if (d > bestD) {
            bestD = d
            best = p
        }
    }
    return best
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

function addZoneOutlines(canvas, generatorOptions) {
    const outlines = generatorOptions && generatorOptions.outlines
    if (!outlines || !outlines.length) {
        return false
    }

    const unitWidth = generatorOptions.unitWidth
    const unitHeight = generatorOptions.unitHeight
    let drew = false

    for (const outline of outlines) {
        const verts = (outline && outline.vertices) || []
        if (verts.length < 2) {
            continue
        }

        let cx = 0
        let cy = 0
        let count = 0
        const boxed = verts.map(v => {
            const corners = vertexBoxCorners(v)
            for (const c of corners) {
                cx += c.x
                cy += c.y
                count++
            }
            return corners
        })
        cx /= count
        cy /= count

        let pts = boxed.map(corners => farthestFrom(corners, cx, cy))
        const offsetMm = Number(outline.offset) || 0
        const unitNum = (unitWidth && typeof unitWidth.toNumber === "function")
            ? unitWidth.toNumber()
            : (Number(unitWidth) || 19.05)
        pts = offsetPolygon(pts, offsetMm / unitNum)

        const points = pts.map(p => [
            new Decimal(p.x).times(unitWidth).toNumber(),
            new Decimal(p.y).times(unitHeight).times(-1).toNumber(),
        ])
        const paths = {}
        for (let i = 0; i < points.length; i++) {
            paths["edge" + i] = new makerjs.paths.Line(points[i], points[(i + 1) % points.length])
        }
        canvas.models["OutlineZone" + outline.zone] = { paths }
        drew = true
    }

    return drew
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

    const drewZones = addZoneOutlines(canvas, generatorOptions)
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