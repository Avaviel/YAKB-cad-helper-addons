import { buildOutlineModel, orderRing } from './PlateBuilder'

const Z4_CLICKED = [
    { x: 35, y: 7.75, zi: 0 },
    { x: 35, y: 3.25, zi: 1 },
    { x: 38.5, y: 3.25, zi: 2 },
    { x: 38.5, y: 7.75, zi: 3 },
    { x: 35.5, y: 5.5, zi: 4 },
]

function outlineOrigins(zone, vertices, options) {
    const model = buildOutlineModel(
        [{ zone, fillet: 0, offset: 0, shape: 'convex', vertices }],
        { unitWidth: 1, unitHeight: 1 },
        options,
    )
    const paths = model.models['OutlineZone' + zone].paths
    return Object.keys(paths)
        .filter((name) => name.startsWith('edge'))
        .sort()
        .map((name) => paths[name].origin)
}

describe('zone outline ring order', () => {
    test('orderRing sorts click order into a perimeter ring', () => {
        expect(orderRing(Z4_CLICKED).map((p) => p.zi)).toEqual([1, 2, 3, 0, 4])
    })

    test('buildOutlineModel follows the larger-area ring, not click order', () => {
        const origins = outlineOrigins(
            4,
            Z4_CLICKED.map((p) => ({ centerX: p.x, centerY: p.y })),
        )
        expect(origins).toHaveLength(5)
        // CAD space negates y; map each edge origin back to its input corner.
        const seq = origins.map(([x, y]) =>
            Z4_CLICKED.findIndex((p) => p.x === x && p.y === -y),
        )
        expect(seq.every((i) => i >= 0)).toBe(true)
        // Indent corner 4 sits between the two left corners, not slashed
        // across the bottom between BR and BL.
        const mid = seq.indexOf(4)
        const neighbours = new Set([seq[(mid + 4) % 5], seq[(mid + 1) % 5]])
        expect(neighbours).toEqual(new Set([0, 1]))
    })

    test('buildOutlineModel keeps every corner of a self-crossing click order', () => {
        const corners = [
            [0, 0],
            [10, 10],
            [10, 0],
            [0, 10],
        ]
        const origins = outlineOrigins(
            1,
            corners.map(([x, y]) => ({ centerX: x, centerY: y })),
        )
        expect(origins).toHaveLength(4)
        const coords = new Set(origins.map(([x, y]) => `${x},${-y}`))
        expect(coords).toEqual(new Set(['0,0', '10,10', '10,0', '0,10']))
    })

    test('buildOutlineModel keeps a tight notch instead of sliding it sideways', () => {
        // 2U-mouth notch in click order: hull insertion parks the notch
        // corners on the far side edges, the ring keeps them in place.
        const corners = [
            [0, 0],
            [1, 0],
            [1, 1],
            [3, 1],
            [3, 0],
            [4, 0],
            [4, 4],
            [0, 4],
        ]
        const origins = outlineOrigins(
            1,
            corners.map(([x, y]) => ({ centerX: x, centerY: y })),
        )
        expect(origins).toHaveLength(8)
        const seq = origins.map(([x, y]) => `${x},${-y}`).join(' ')
        expect(seq).toMatch(/(1,0 1,1 3,1 3,0|3,0 3,1 1,1 1,0)/)
    })

    test('buildOutlineModel caps needle miters at 2x the offset', () => {
        const origins = outlineOrigins(
            1,
            [
                { centerX: 0, centerY: 0 },
                { centerX: 1, centerY: 0 },
                { centerX: 0.5, centerY: 3 },
            ],
            { offset: 1, fillet: 0 },
        )
        expect(origins).toHaveLength(3)
        // CAD space negates y: apex miter lands exactly 2 units out.
        expect(origins).toContainEqual([0.5, -5])
    })

    test('buildOutlineModel survives degenerate collinear corners via the hull', () => {
        const corners = [
            [0, 0],
            [10, 0],
            [5, 0],
            [7, 0],
        ]
        const origins = outlineOrigins(
            1,
            corners.map(([x, y]) => ({ centerX: x, centerY: y })),
        )
        expect(origins.length).toBeGreaterThanOrEqual(2)
        const known = new Set(corners.map(([x, y]) => `${x},${y}`))
        for (const [x, y] of origins) {
            expect(known.has(`${x},${-y}`)).toBe(true)
        }
    })
})
