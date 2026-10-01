// How far apart Aldmoor's things worth stopping for are (#124): for each land and along the roads, the
// longest ride between two of them, in days. npm run rides [-- --before] [-- --png out.png]
// --before leaves out the small finds (#124), to compare; --png draws the map, each spot a player rides
// coloured by the ride to the nearest thing (green: close; yellow: a quarter of a day; red: half a day or more).
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { createServer } from 'vite';

const before = process.argv.includes('--before');
const pngAt = process.argv.indexOf('--png');
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { ALDMOOR, LANDS, landOf } = await server.ssrLoadModule('/src/content/aldmoor.ts');
  const { FINDS } = await server.ssrLoadModule('/src/content/aldmoorFinds.ts');
  const { buildMap, Terrain, CELL } = await server.ssrLoadModule('/src/rules/map/model.ts');
  const { measureRides, worthStopping } = await server.ssrLoadModule('/src/rules/map/rides.ts');
  const { MOVEMENT_PER_DAY } = await server.ssrLoadModule('/src/rules/state.ts');
  const map = buildMap(ALDMOOR);
  const finds = new Set(FINDS.map((f) => f.id));
  const things = ALDMOOR.locations.filter((l) => worthStopping(l) && !(before && finds.has(l.id)));
  const t = performance.now();
  const rides = measureRides(map, things);
  const name = Object.fromEntries(ALDMOOR.locations.map((l) => [l.id, l.name]));
  const line = (label, gap) => `  ${label.padEnd(18)} ${gap ? `${((2 * gap.cost) / MOVEMENT_PER_DAY).toFixed(2)} day   at ${gap.at.join(', ')}, nearest ${name[gap.nearest]}` : '-'}`;
  console.log(`${ALDMOOR.name}${before ? ', before its small finds' : ''}: the longest ride between two things worth stopping for`);
  console.log(line('the roads', rides.gap((_, road) => road)));
  for (const [land, label] of Object.entries(LANDS)) console.log(line(label, rides.gap((at) => landOf(at) === land)));
  console.log(`  (${things.length} things, measured in ${Math.round(performance.now() - t)} ms)`);

  if (pngAt > 0) {
    const out = process.argv[pngAt + 1];
    const colour = (k) => {
      const i = map.terrain[k];
      if (i === Terrain.Water) return [60, 90, 160];
      if (i === Terrain.Forest) return [25, 60, 35];
      if (i === Terrain.Rock || i === Terrain.Cliff) return [110, 105, 100];
      if (i === Terrain.Building) return [90, 50, 30];
      if (!Number.isFinite(rides.near[k])) return [40, 40, 40];
      const stops = [[60, 170, 70], [230, 220, 60], [210, 40, 40]];
      const f = Math.min(1, rides.near[k] / (MOVEMENT_PER_DAY / 2)) * 2;
      const [a, b] = [stops[Math.min(1, Math.floor(f))], stops[Math.min(2, Math.floor(f) + 1)]];
      const heat = a.map((c, j) => Math.round(c + (b[j] - c) * (f - Math.min(1, Math.floor(f)))));
      return rides.ridden[k] ? heat : heat.map((c) => Math.round(c * 0.4 + 150 * 0.6));
    };
    const [w, h] = [map.width, map.height];
    const rgb = Buffer.alloc(w * h * 3);
    for (let k = 0; k < w * h; k++) rgb.set(colour(k), k * 3);
    for (const thing of things) {
      const [x, y] = [Math.floor(thing.at[0] / CELL), Math.floor(thing.at[1] / CELL)];
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2 && x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < h) rgb.set(finds.has(thing.id) ? [80, 200, 255] : [255, 255, 255], ((y + dy) * w + x + dx) * 3);
    }
    writeFileSync(out, png(w, h, rgb));
    console.log(`  drew ${out}`);
  }
} finally {
  await server.close();
}

/** A 24-bit PNG of `rgb`, `w` by `h`. */
function png(w, h, rgb) {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (bytes) => {
    let c = 0xffffffff;
    for (const b of bytes) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const head = Buffer.alloc(4);
    head.writeUInt32BE(data.length);
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc(body));
    return Buffer.concat([head, body, tail]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header[8] = 8;
  header[9] = 2;
  const rows = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) rgb.copy(rows, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
