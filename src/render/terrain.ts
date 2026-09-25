import { Bitmap } from './bitmap';
import { MAP_PX, type Point } from './lookTestMap';
import { fbm, hash, noise, rng, shade } from './noise';
import { CYCLE_DEEP, CYCLE_SHALLOW, DIRT, GOLD, GRASS, NEUTRAL, RED, SAND, WATER } from './palette';

export const Ground = { Grass: 0, Water: 1, Bank: 2, Road: 3 } as const;

/** Catmull-Rom curve through the control points. */
export function smooth(points: readonly Point[], steps = 10): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const at = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([at(p0[0], p1[0], p2[0], p3[0]), at(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Distance to a polyline, distance along it at the closest point, and which side the point is on. */
export function closest(path: readonly Point[], x: number, y: number) {
  let d = Infinity;
  let s = 0;
  let side = 0;
  let along = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i];
    const [bx, by] = path[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy);
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (length * length)));
    const distance = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
    if (distance < d) {
      d = distance;
      s = along + t * length;
      side = Math.sign(dx * (y - ay) - dy * (x - ax));
    }
    along += length;
  }
  return { d, s, side };
}

/** Small painted details stamped over grass: tufts of blades and a few flowers. */
const TUFTS = [
  ['.l.l', '.ml.', 'dd..'],
  ['l..', '.m.', 'dd.'],
  ['..l.', 'l.m.', '.dd.'],
  ['.l', 'md'],
];

export type Terrain = { bitmap: Bitmap; ground: Uint8Array };

export function paintTerrain(riverControl: readonly Point[], roadControl: readonly Point[]): Terrain {
  const size = MAP_PX;
  const bitmap = new Bitmap(size, size);
  const ground = new Uint8Array(size * size);
  const river = smooth(riverControl);
  const road = smooth(roadControl);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const r = closest(river, x, y);
      const halfWidth = 11 + (noise(r.s / 50, 0.5, 11) - 0.5) * 7;
      const edge = r.d - halfWidth + (noise(x / 5, y / 5, 12) - 0.5) * 2.6;

      if (edge < 0) {
        ground[i] = Ground.Water;
        const depth = Math.min(1, -edge / halfWidth);
        const wobble = fbm(r.s / 18, (r.d * r.side) / 6, 2, 13) * 5;
        const phase = Math.floor(r.s / 3.4 + wobble) % 6;
        if (edge > -1.4) bitmap.data[i] = hash(x, y, 14) < 0.55 ? WATER[8] : CYCLE_SHALLOW[phase];
        else if (depth > 0.42 + (hash(x, y, 15) - 0.5) * 0.2) bitmap.data[i] = CYCLE_DEEP[phase];
        else bitmap.data[i] = CYCLE_SHALLOW[phase];
        continue;
      }

      if (edge < 3.4) {
        ground[i] = Ground.Bank;
        // Wet and dark right at the water, lit on banks that face the light from the west.
        const lit = r.side > 0 ? 0.62 : 0.3;
        const level = edge < 1.3 ? 0.08 : lit + (noise(x / 3, y / 3, 16) - 0.5) * 0.35;
        bitmap.data[i] = shade(SAND, level, x, y);
        continue;
      }

      let level = 0.56 + (fbm(x / 64, y / 64, 3, 1) - 0.5) * 0.42 + (noise(x / 8, y / 8, 2) - 0.5) * 0.26;
      level += (hash(x, y, 3) - 0.5) * 0.16;
      if (edge < 12) level -= (12 - edge) * 0.022;

      const p = closest(road, x, y);
      const roadHalf = 7.5 + (noise(p.s / 22, 3, 21) - 0.5) * 2.4 + (noise(x / 4, y / 4, 22) - 0.5) * 1.8;
      if (p.d < roadHalf) {
        ground[i] = Ground.Road;
        let dirt = 0.58 + (noise(x / 6, y / 6, 23) - 0.5) * 0.4 + (hash(x, y, 24) - 0.5) * 0.12;
        if (Math.abs(p.d - 3.6) < 0.9) dirt -= 0.22;
        if (p.d > roadHalf - 1.3) dirt -= 0.3;
        if (hash(x, y, 25) < 0.025) dirt += 0.35;
        bitmap.data[i] = shade(DIRT, dirt, x, y);
        continue;
      }
      if (p.d < roadHalf + 2.2) level -= 0.18;

      ground[i] = Ground.Grass;
      bitmap.data[i] = shade(GRASS, level, x, y);
    }
  }

  const random = rng(5);
  const grassAt = (x: number, y: number) => ground[y * size + x] === Ground.Grass;
  for (let n = 0; n < 1500; n++) {
    const x = 2 + Math.floor(random() * (size - 6));
    const y = 2 + Math.floor(random() * (size - 6));
    if (!grassAt(x, y) || !grassAt(x + 3, y + 2)) continue;
    const tuft = TUFTS[Math.floor(random() * TUFTS.length)];
    const base = bitmap.data[y * size + x];
    const tone = GRASS.indexOf(base);
    tuft.forEach((row, dy) =>
      [...row].forEach((ch, dx) => {
        if (ch === '.') return;
        const shift = ch === 'l' ? 2 : ch === 'm' ? 1 : -2;
        bitmap.set(x + dx, y + dy, GRASS[Math.max(0, Math.min(GRASS.length - 1, tone + shift))]);
      }),
    );
  }
  const petals = [GOLD[5], NEUTRAL[7], RED[5], GOLD[6]];
  for (let n = 0; n < 110; n++) {
    const x = 2 + Math.floor(random() * (size - 4));
    const y = 2 + Math.floor(random() * (size - 4));
    if (!grassAt(x, y) || !grassAt(x, y + 1)) continue;
    bitmap.set(x, y, petals[n % petals.length]);
    bitmap.set(x, y + 1, GRASS[1]);
  }
  return { bitmap, ground };
}
