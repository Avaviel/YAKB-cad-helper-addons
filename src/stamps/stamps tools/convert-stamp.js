const fs = require('fs');
const path = require('path');
const DxfParser = require('dxf-parser');

let folder = __dirname;
// Optional: --dir=choc  and/or a filename substring
// e.g. node convert-stamp.js --dir=choc
//      node convert-stamp.js betterfit
let filterArg = null;
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--dir=')) {
    folder = path.resolve(__dirname, arg.slice(6));
  } else {
    filterArg = arg.toLowerCase();
  }
}

const files = fs.readdirSync(folder).filter(f => {
  if (!f.toLowerCase().endsWith('.dxf')) return false;
  if (!filterArg) return true;
  return f.toLowerCase().includes(filterArg);
});

if (files.length === 0) {
  console.log(filterArg ? `No .dxf files matching "${filterArg}".` : 'No .dxf files found.');
  process.exit(0);
}

/**
 * Convert a DXF polyline bulge segment (p1 -> p2) into a stamp line or arc.
 * Bulge = tan(includedAngle / 4). Positive = CCW (left of directed segment).
 * Stamp arcs store angles in radians (same as dxf-parser ARC entities).
 */
function segmentFromBulge(p1, p2, bulge) {
  const x1 = p1.x;
  const y1 = p1.y;
  const x2 = p2.x;
  const y2 = p2.y;

  if (bulge === undefined || bulge === null || Math.abs(bulge) < 1e-12) {
    return {
      type: 'line',
      origin: [x1, y1],
      end: [x2, y2]
    };
  }

  const dx = x2 - x1;
  const dy = y2 - y1;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-12) {
    return null;
  }

  // Included angle (signed), radians
  const theta = 4 * Math.atan(bulge);
  const halfChord = chord / 2;
  const radius = Math.abs(halfChord / Math.sin(theta / 2));

  // Midpoint of chord
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  // Unit normal pointing left of p1->p2 (CCW side)
  const nx = -dy / chord;
  const ny = dx / chord;

  // Distance from midpoint to center
  let d = Math.sqrt(Math.max(0, radius * radius - halfChord * halfChord));
  // For |theta| > 180°, center is on the opposite side of the chord midpoint
  if (Math.abs(theta) > Math.PI) {
    d = -d;
  }
  // Negative bulge: center is to the right of p1->p2
  if (bulge < 0) {
    d = -d;
  }

  const cx = mx + nx * d;
  const cy = my + ny * d;

  let startAngle = Math.atan2(y1 - cy, x1 - cx);
  let endAngle = Math.atan2(y2 - cy, x2 - cx);

  // maker.js arcs are drawn CCW from start to end. For a CW bulge, swap so the
  // stored angles describe the same geometric arc when converted CCW.
  if (bulge < 0) {
    const tmp = startAngle;
    startAngle = endAngle;
    endAngle = tmp;
  }

  return {
    type: 'arc',
    origin: [cx, cy],
    radius,
    startAngle,
    endAngle
  };
}

function addLwPolyline(entity, paths, startIdx) {
  let idx = startIdx;
  const verts = entity.vertices || [];
  if (verts.length < 2) {
    return idx;
  }

  const closed = !!(entity.shape || entity.closed);

  // Fusion often writes a circle as a 2-vertex closed LWPOLYLINE with bulge on
  // only one vertex. The other segment has no bulge and becomes a flat chord.
  if (closed && verts.length === 2) {
    const b0 = verts[0].bulge || 0;
    const b1 = verts[1].bulge || 0;
    const bulge = Math.abs(b0) >= Math.abs(b1) ? b0 : b1;
    if (Math.abs(bulge) > 1e-12) {
      const a = Math.abs(b0) >= Math.abs(b1) ? verts[0] : verts[1];
      const b = Math.abs(b0) >= Math.abs(b1) ? verts[1] : verts[0];
      const seg = segmentFromBulge(a, b, bulge);
      if (seg && seg.type === 'arc') {
        paths[`circle${idx++}`] = {
          type: 'circle',
          origin: seg.origin,
          radius: seg.radius
        };
        return idx;
      }
    }
  }

  const count = closed ? verts.length : verts.length - 1;

  for (let i = 0; i < count; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const bulge = a.bulge || 0;
    const seg = segmentFromBulge(a, b, bulge);
    if (!seg) continue;

    if (seg.type === 'line') {
      paths[`line${idx++}`] = seg;
    } else {
      paths[`arc${idx++}`] = seg;
    }
  }

  return idx;
}

function deBoor(controlPoints, knots, degree, u) {
  const n = controlPoints.length - 1
  let k = degree
  for (let i = degree; i <= n; i++) {
    if (u >= knots[i] && u <= knots[i + 1]) {
      k = i
      break
    }
  }
  const d = []
  for (let j = 0; j <= degree; j++) {
    const p = controlPoints[k - degree + j] || controlPoints[0]
    d.push({ x: p.x, y: p.y })
  }
  for (let r = 1; r <= degree; r++) {
    for (let j = degree; j >= r; j--) {
      const i = k - degree + j
      const denom = knots[i + 1 + degree - r] - knots[i]
      const alpha = denom === 0 ? 0 : (u - knots[i]) / denom
      d[j] = {
        x: (1 - alpha) * d[j - 1].x + alpha * d[j].x,
        y: (1 - alpha) * d[j - 1].y + alpha * d[j].y,
      }
    }
  }
  return d[degree]
}

function addSpline(entity, paths, startIdx) {
  let idx = startIdx
  const ctrl = entity.controlPoints || []
  const knots = entity.knotValues || []
  const degree = entity.degreeOfSplineCurve || 3
  if (ctrl.length < 2 || knots.length < 2) {
    return idx
  }
  const u0 = knots[degree] ?? knots[0]
  const u1 = knots[knots.length - degree - 1] ?? knots[knots.length - 1]
  const steps = 36
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const u = u0 + (u1 - u0) * (i / steps)
    const p = deBoor(ctrl, knots, degree, u)
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      pts.push(p)
    }
  }
  for (let i = 1; i < pts.length; i++) {
    paths[`line${idx++}`] = {
      type: 'line',
      origin: [pts[i - 1].x, pts[i - 1].y],
      end: [pts[i].x, pts[i].y],
    }
  }
  const first = pts[0]
  const last = pts[pts.length - 1]
  if (first && last && Math.hypot(first.x - last.x, first.y - last.y) > 0.05) {
    paths[`line${idx++}`] = {
      type: 'line',
      origin: [last.x, last.y],
      end: [first.x, first.y],
    }
  }
  return idx
}

const parser = new DxfParser();

files.forEach(file => {
  const inputPath = path.join(folder, file);
  const outputName = file.replace(/\.dxf$/i, '.json');
  const outputPath = path.join(folder, outputName);

  try {
    const dxfText = fs.readFileSync(inputPath, 'utf8');
    const dxf = parser.parseSync(dxfText);

    const paths = {};
    let idx = 0;

    (dxf.entities || []).forEach(entity => {
      if (entity.type === 'LINE') {
        paths[`line${idx++}`] = {
          type: 'line',
          origin: [entity.vertices[0].x, entity.vertices[0].y],
          end: [entity.vertices[1].x, entity.vertices[1].y]
        };
      } else if (entity.type === 'CIRCLE') {
        paths[`circle${idx++}`] = {
          type: 'circle',
          origin: [entity.center.x, entity.center.y],
          radius: entity.radius
        };
      } else if (entity.type === 'ARC') {
        paths[`arc${idx++}`] = {
          type: 'arc',
          origin: [entity.center.x, entity.center.y],
          radius: entity.radius,
          startAngle: entity.startAngle,
          endAngle: entity.endAngle
        };
      } else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
        idx = addLwPolyline(entity, paths, idx);
      } else if (entity.type === 'SPLINE') {
        idx = addSpline(entity, paths, idx);
      } else {
        console.warn(`  (skip unsupported entity type: ${entity.type})`);
      }
    });

    const result = {
      source: file,
      pathCount: Object.keys(paths).length,
      paths: paths
    };

    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`✓ ${file} → ${outputName} (${result.pathCount} paths)`);
  } catch (err) {
    console.error(`✗ ${file}: ${err.message}`);
  }
});
