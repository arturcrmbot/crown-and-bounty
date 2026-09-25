import { Bitmap } from './bitmap';
import { CLIFF, CLIFF_HEIGHT, forestAmount, MAP_HEIGHT, MAP_WIDTH, PATHS, RIVER, type Point } from './lookTestMap';
import { fbm, hash, noise, rng, shade } from './noise';
import { CYCLE_DEEP, CYCLE_FALL, CYCLE_SHALLOW, DIRT, EARTH, GOLD, GRASS, NEUTRAL, RED, ROCK, WATER } from './palette';

export const Ground = { Grass: 0, Water: 1, Bank: 2, Road: 3, Cliff: 4 } as const;

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
      const at = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
      out.push([at(p0[0], p1[0], p2[0], p3[0]), at(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Distance to the nearest of some polylines, distance along it, and which side of it, per pixel. */
export type Field = { d: Float32Array; s: Float32Array; side: Int8Array };

function distanceField(paths: readonly Point[][], radius: number): Field {
  const size = MAP_WIDTH * MAP_HEIGHT;
  const field: Field = { d: new Float32Array(size).fill(1e6), s: new Float32Array(size), side: new Int8Array(size) };
  for (const path of paths) {
    let along = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, ay] = path[i];
      const [bx, by] = path[i + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const length = Math.hypot(dx, dy) || 1e-6;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - radius));
      const x1 = Math.min(MAP_WIDTH - 1, Math.ceil(Math.max(ax, bx) + radius));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by) - radius));
      const y1 = Math.min(MAP_HEIGHT - 1, Math.ceil(Math.max(ay, by) + radius));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (length * length)));
          const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
          const i2 = y * MAP_WIDTH + x;
          if (d < field.d[i2]) {
            field.d[i2] = d;
            field.s[i2] = along + t * length;
            field.side[i2] = Math.sign(dx * (y - ay) - dy * (x - ax));
          }
        }
      }
      along += length;
    }
  }
  return field;
}

/** Height of the cliff line at x, or undefined where there is no cliff. */
function cliffTop(cliff: readonly Point[], x: number): number | undefined {
  for (let i = 0; i < cliff.length - 1; i++) {
    const [ax, ay] = cliff[i];
    const [bx, by] = cliff[i + 1];
    if (x >= ax && x <= bx) return ay + ((x - ax) / (bx - ax)) * (by - ay) + (noise(x / 6, 0, 71) - 0.5) * 5;
  }
  return undefined;
}

const TUFTS = [
  ['.l.l', '.ml.', 'dd..'],
  ['l..', '.m.', 'dd.'],
  ['..l.', 'l.m.', '.dd.'],
  ['.l', 'md'],
];

export type Terrain = { bitmap: Bitmap; ground: Uint8Array; river: Field; paths: Field; riverLine: Point[] };

export function paintTerrain(): Terrain {
  const W = MAP_WIDTH;
  const H = MAP_HEIGHT;
  const bitmap = new Bitmap(W, H);
  const ground = new Uint8Array(W * H);
  const riverLine = smooth(RIVER);
  const cliffLine = smooth(CLIFF, 6);
  const river = distanceField([riverLine], 40);
  const paths = distanceField(PATHS.map((p) => smooth(p)), 20);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const r = { d: river.d[i], s: river.s[i], side: river.side[i] };
      const halfWidth = 10 + (noise(r.s / 60, 0.5, 11) - 0.5) * 6;
      const edge = r.d - halfWidth + (noise(x / 5, y / 5, 12) - 0.5) * 2.4;
      const top = cliffTop(cliffLine, x);
      const face = top === undefined ? -1 : y - top;

      if (face >= 0 && face < CLIFF_HEIGHT) {
        ground[i] = Ground.Cliff;
        if (edge < 1) {
          // The waterfall: white water streaming down the face, cycling downwards.
          bitmap.data[i] = CYCLE_FALL[(Math.floor(y / 2) + Math.floor(hash(x, 0, 72) * 6) + 600) % 6];
        } else {
          const strata = noise(x / 3, y / 7, 73) * 0.4 + noise(x / 9, y / 2.5, 74) * 0.25;
          const level = 0.72 - (face / CLIFF_HEIGHT) * 0.5 + strata - 0.3 + (face < 2 ? 0.2 : 0);
          bitmap.data[i] = shade(ROCK, level, x, y);
        }
        continue;
      }

      if (edge < 0) {
        ground[i] = Ground.Water;
        const depth = Math.min(1, -edge / halfWidth);
        const phase = Math.floor(r.s / 3.4 + fbm(r.s / 18, (r.d * r.side) / 6, 2, 13) * 5) % 6;
        const pool = top !== undefined && face >= CLIFF_HEIGHT && face < CLIFF_HEIGHT + 16;
        if (pool && hash(x, y, 75) < 0.7 - (face - CLIFF_HEIGHT) * 0.04) bitmap.data[i] = hash(x, y, 76) < 0.5 ? WATER[9] : WATER[8];
        else if (edge > -1.5) bitmap.data[i] = hash(x, y, 14) < 0.6 ? WATER[9] : CYCLE_SHALLOW[phase];
        else if (depth > 0.45 + (hash(x, y, 15) - 0.5) * 0.2) bitmap.data[i] = CYCLE_DEEP[phase];
        else bitmap.data[i] = CYCLE_SHALLOW[phase];
        continue;
      }

      if (edge < 3.2) {
        ground[i] = Ground.Bank;
        const lit = r.side > 0 ? 0.62 : 0.3;
        const level = edge < 1.2 ? 0.1 : lit + (noise(x / 3, y / 3, 16) - 0.5) * 0.35;
        bitmap.data[i] = shade(EARTH, level, x, y);
        continue;
      }

      let level = 0.52 + (fbm(x / 90, y / 90, 3, 1) - 0.5) * 0.5 + (noise(x / 7, y / 7, 2) - 0.5) * 0.26;
      level += (hash(x, y, 3) - 0.5) * 0.16;
      if (edge < 10) level -= (10 - edge) * 0.02;
      const forest = forestAmount(x, y);
      if (forest > 0.44) level -= Math.min(0.3, (forest - 0.44) * 1.4);
      if (top !== undefined && face >= CLIFF_HEIGHT && face < CLIFF_HEIGHT + 8) level -= 0.28 - (face - CLIFF_HEIGHT) * 0.03;

      const p = paths.d[i];
      const pathHalf = 3.4 + (noise(paths.s[i] / 25, 3, 21) - 0.5) * 1.6 + (noise(x / 3, y / 3, 22) - 0.5) * 1.2;
      if (p < pathHalf) {
        ground[i] = Ground.Road;
        let dirt = 0.62 + (noise(x / 5, y / 5, 23) - 0.5) * 0.36 + (hash(x, y, 24) - 0.5) * 0.14;
        if (p > pathHalf - 1.1) dirt -= 0.34;
        if (hash(x, y, 25) < 0.03) dirt += 0.3;
        bitmap.data[i] = shade(DIRT, dirt, x, y);
        continue;
      }
      if (p < pathHalf + 1.8) level -= 0.16;

      ground[i] = Ground.Grass;
      bitmap.data[i] = shade(GRASS, level, x, y);
    }
  }

  const random = rng(5);
  const grassAt = (x: number, y: number) => ground[y * W + x] === Ground.Grass;
  for (let n = 0; n < 9000; n++) {
    const x = 2 + Math.floor(random() * (W - 6));
    const y = 2 + Math.floor(random() * (H - 6));
    if (!grassAt(x, y) || !grassAt(x + 3, y + 2)) continue;
    const tuft = TUFTS[Math.floor(random() * TUFTS.length)];
    const tone = GRASS.indexOf(bitmap.data[y * W + x]);
    tuft.forEach((row, dy) =>
      [...row].forEach((ch, dx) => {
        if (ch === '.') return;
        const shift = ch === 'l' ? 2 : ch === 'm' ? 1 : -2;
        bitmap.set(x + dx, y + dy, GRASS[Math.max(0, Math.min(GRASS.length - 1, tone + shift))]);
      }),
    );
  }
  const petals = [GOLD[5], NEUTRAL[7], RED[5], GOLD[6]];
  for (let n = 0; n < 700; n++) {
    const x = 2 + Math.floor(random() * (W - 4));
    const y = 2 + Math.floor(random() * (H - 4));
    if (!grassAt(x, y) || !grassAt(x, y + 1) || forestAmount(x, y) > 0.4) continue;
    bitmap.set(x, y, petals[n % petals.length]);
    bitmap.set(x, y + 1, GRASS[1]);
  }
  return { bitmap, ground, river, paths, riverLine };
}
