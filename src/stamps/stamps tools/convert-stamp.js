const fs = require('fs');
const path = require('path');
const DxfParser = require('dxf-parser');

const folder = __dirname;
const files = fs.readdirSync(folder).filter(f => f.toLowerCase().endsWith('.dxf'));

if (files.length === 0) {
  console.log('No .dxf files found.');
  process.exit(0);
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

    dxf.entities.forEach(entity => {
      if (entity.type === 'LINE') {
        paths[`line${idx++}`] = {
          type: 'line',
          origin: [entity.vertices[0].x, entity.vertices[0].y],
          end: [entity.vertices[1].x, entity.vertices[1].y]
        };
      }
      else if (entity.type === 'CIRCLE') {
        paths[`circle${idx++}`] = {
          type: 'circle',
          origin: [entity.center.x, entity.center.y],
          radius: entity.radius
        };
      }
      else if (entity.type === 'ARC') {
        paths[`arc${idx++}`] = {
          type: 'arc',
          origin: [entity.center.x, entity.center.y],
          radius: entity.radius,
          startAngle: entity.startAngle,
          endAngle: entity.endAngle
        };
      }
    });

    const result = {
      source: file,
      pathCount: Object.keys(paths).length,
      paths: paths
    };

    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`✓ ${file} → ${outputName}`);
  } catch (err) {
    console.error(`✗ ${file}: ${err.message}`);
  }
});
