import { lineAt, type Point } from '../rules/map/geometry';
import { forestAmount, pathHalfWidth, poolDistance, riverHalfWidth, shoreWobble, type MapModel } from '../rules/map/model';
import { Bitmap } from './bitmap';
import { fbm, hash, noise, rng, shade } from './noise';
import { CYCLE_BOG, CYCLE_DEEP, CYCLE_FALL, CYCLE_SHALLOW, DIRT, EARTH, GOLD, GRASS, LEAF, NEUTRAL, RED, REED, ROCK, WATER } from './palette';

/** What each painted pixel is, for placing details. The rules keep their own, coarser map. */
export const Ground = { Grass: 0, Water: 1, Bank: 2, Road: 3, Cliff: 4 } as const;

/** The land is painted in squares this many pixels across, as they come into view. */
export const TILE = 128;

/** Distance to the nearest of some polylines, distance along it, and which side of it, per pixel of a tile. */
type Field = { d: Float32Array; s: Float32Array; side: Int8Array };

/** One straight stretch of a polyline, with how far along the line it starts. */
type Segment = { ax: number; ay: number; dx: number; dy: number; length: number; along: number; x0: number; y0: number; x1: number; y1: number };

/** Details sprinkled over the land, as many per pixel as the first 40 by 30 tile provinces had. */
const PER_PIXEL = 1 / (1280 * 960);
const TUFTS_PER_PIXEL = 9000 * PER_PIXEL;
const REEDS_PER_PIXEL = 14000 * PER_PIXEL;
const LILIES_PER_PIXEL = 500 * PER_PIXEL;
const PETALS_PER_PIXEL = 700 * PER_PIXEL;

const TUFTS = [
  ['.l.l', '.ml.', 'dd..'],
  ['l..', '.m.', 'dd.'],
  ['..l.', 'l.m.', '.dd.'],
  ['.l', 'md'],
];

/** One painted tile: the land as seen, and `wild`, the same land with no roads, shown under the fog of war. */
export type TerrainTile = { x: number; y: number; bitmap: Bitmap; wild: Bitmap };

/**
 * Paints the land of a province pixel by pixel, from the same geometry the rules use, one tile at a
 * time: a province six times the size of the first ones would take seconds to paint at once.
 */
export class TerrainPainter {
  readonly width: number;
  readonly height: number;
  private readonly map: MapModel;
  private readonly river: Segment[];
  private readonly paths: Segment[];
  /** The top of the cliff's face in each column, with its painted wobble, or NaN where there is none. */
  private readonly cliffTops: Float32Array;

  constructor(map: MapModel) {
    this.map = map;
    this.width = map.province.width;
    this.height = map.province.height;
    this.river = segments([map.river], 40);
    this.paths = segments(map.paths, 20);
    this.cliffTops = new Float32Array(this.width).fill(NaN);
    if (map.cliff) {
      for (let x = 0; x < this.width; x++) {
        const y = lineAt(map.cliff, x);
        if (y !== undefined) this.cliffTops[x] = y + (noise(x / 6, 0, 71) - 0.5) * 5;
      }
    }
  }

  /** Paints the tile at (tx, ty), counted in tiles. Tiles at the right and bottom edges may be smaller. */
  paint(tx: number, ty: number): TerrainTile {
    const { province } = this.map;
    const X0 = tx * TILE;
    const Y0 = ty * TILE;
    const w = Math.min(TILE, this.width - X0);
    const h = Math.min(TILE, this.height - Y0);
    const bitmap = new Bitmap(w, h);
    const wild = new Bitmap(w, h);
    const ground = new Uint8Array(w * h);
    const CLIFF_HEIGHT = province.cliff?.height ?? 0;
    const river = field(this.river, X0, Y0, w, h);
    const paths = field(this.paths, X0, Y0, w, h);
    // Distance outside the nearest pool, only worked out near the pools.
    const pools = new Float32Array(w * h).fill(1e6);
    for (const [cx, cy, rx, ry] of province.pools ?? []) {
      for (let y = Math.max(Y0, Math.floor(cy - ry - 30)); y < Math.min(Y0 + h, cy + ry + 30); y++) {
        for (let x = Math.max(X0, Math.floor(cx - rx - 30)); x < Math.min(X0 + w, cx + rx + 30); x++) {
          const i = (y - Y0) * w + (x - X0);
          if (pools[i] < 1e5) continue;
          pools[i] = poolDistance(province, x, y) + shoreWobble(x, y) + (noise(x / 4, y / 4, 93) - 0.5) * 2;
        }
      }
    }

    for (let y = Y0; y < Y0 + h; y++) {
      for (let x = X0; x < X0 + w; x++) {
        const i = (y - Y0) * w + (x - X0);
        const r = { d: river.d[i], s: river.s[i], side: river.side[i] };
        const halfWidth = riverHalfWidth(r.s);
        const edge = r.d - halfWidth + (noise(x / 5, y / 5, 12) - 0.5) * 2.4;
        const top = this.cliffTops[x];
        const face = Number.isNaN(top) ? -1 : y - top;

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

        const shore = pools[i];
        if (shore < 0 && edge >= 0) {
          // Fen pools: dark peaty water with a slow green glint, a shelf of mud at the edge.
          ground[i] = Ground.Water;
          const phase = Math.floor(fbm(x / 22, y / 16, 2, 94) * 9 + (x + y * 0.4) / 30) % 6;
          if (shore > -1.6) bitmap.data[i] = hash(x, y, 95) < 0.5 ? EARTH[1] : REED[0];
          else if (hash(x, y, 96) < 0.006) bitmap.data[i] = WATER[8];
          else bitmap.data[i] = CYCLE_BOG[phase];
          continue;
        }

        if (edge < 0) {
          ground[i] = Ground.Water;
          const depth = Math.min(1, -edge / halfWidth);
          const phase = Math.floor(r.s / 3.4 + fbm(r.s / 18, (r.d * r.side) / 6, 2, 13) * 5) % 6;
          const pool = !Number.isNaN(top) && face >= CLIFF_HEIGHT && face < CLIFF_HEIGHT + 16;
          if (pool && hash(x, y, 75) < 0.7 - (face - CLIFF_HEIGHT) * 0.04) bitmap.data[i] = hash(x, y, 76) < 0.5 ? WATER[9] : WATER[8];
          else if (edge > -1.5) bitmap.data[i] = hash(x, y, 14) < 0.6 ? WATER[9] : CYCLE_SHALLOW[phase];
          else if (depth > 0.45 + (hash(x, y, 15) - 0.5) * 0.2) bitmap.data[i] = CYCLE_DEEP[phase];
          else bitmap.data[i] = CYCLE_SHALLOW[phase];
          continue;
        }

        if (shore < 2.6 && edge >= 3.2) {
          ground[i] = Ground.Bank;
          bitmap.data[i] = shade(EARTH, 0.28 + (noise(x / 3, y / 3, 97) - 0.5) * 0.35, x, y);
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
        if (shore < 16) level -= (16 - shore) * 0.012;
        const forest = forestAmount(province, x, y);
        if (forest > 0.44) level -= Math.min(0.3, (forest - 0.44) * 1.4);
        if (!Number.isNaN(top) && face >= CLIFF_HEIGHT && face < CLIFF_HEIGHT + 8) level -= 0.28 - (face - CLIFF_HEIGHT) * 0.03;

        // Fen country: tussocks of straw-coloured sedge through the grass.
        const sedge = province.fen && fbm(x / 34, y / 34, 2, 98) + (noise(x / 5, y / 5, 99) - 0.5) * 0.3 > 0.56;
        if (province.fen) level -= 0.06;
        wild.data[i] = sedge ? shade(REED, level + 0.08, x, y) : shade(GRASS, level, x, y);
        const p = paths.d[i];
        const pathHalf = pathHalfWidth(paths.s[i]) + (noise(x / 3, y / 3, 22) - 0.5) * 1.2;
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
        bitmap.data[i] = sedge ? shade(REED, level + 0.08, x, y) : shade(GRASS, level, x, y);
      }
    }

    for (let i = 0; i < w * h; i++) if (ground[i] !== Ground.Grass && ground[i] !== Ground.Road) wild.data[i] = bitmap.data[i];

    // Details, from this tile's own dice, placed where they fit inside it.
    const random = rng((Math.imul(tx + 1, 73856093) ^ Math.imul(ty + 1, 19349663) ^ 5) >>> 0);
    const count = (perPixel: number) => Math.floor(perPixel * w * h + random());
    const within = (lo: number, span: number) => lo + Math.floor(random() * Math.max(1, span));
    const grassAt = (x: number, y: number) => ground[y * w + x] === Ground.Grass;
    const wildGrassAt = (x: number, y: number) => ground[y * w + x] === Ground.Grass || ground[y * w + x] === Ground.Road;
    for (let n = count(TUFTS_PER_PIXEL); n > 0; n--) {
      const x = within(0, w - 4);
      const y = within(0, h - 3);
      const tuft = TUFTS[Math.floor(random() * TUFTS.length)];
      for (const [layer, ok] of [[bitmap, grassAt], [wild, wildGrassAt]] as const) {
        if (!ok(x, y) || !ok(x + 3, y + 2)) continue;
        const tone = GRASS.indexOf(layer.data[y * w + x]);
        tuft.forEach((row, dy) =>
          [...row].forEach((ch, dx) => {
            if (ch === '.') return;
            const shift = ch === 'l' ? 2 : ch === 'm' ? 1 : -2;
            layer.set(x + dx, y + dy, GRASS[Math.max(0, Math.min(GRASS.length - 1, tone + shift))]);
          }),
        );
      }
    }
    if (province.pools?.length) {
      // Reeds along the pool shores and out into the shallows, some with brown cattail heads.
      const reedAt = (x: number, y: number) => {
        const v = pools[y * w + x];
        return v > -5 && v < 9 && paths.d[y * w + x] > 7;
      };
      for (let n = count(REEDS_PER_PIXEL); n > 0; n--) {
        const x = within(8, w - 16);
        const y = within(12, h - 12);
        if (!reedAt(x, y)) continue;
        const stems = 2 + Math.floor(random() * 4);
        for (let k = 0; k < stems; k++) {
          const sx = x + k * 2 - stems + Math.round((random() - 0.5) * 2);
          const tall = 4 + Math.floor(random() * 6);
          const lean = random() < 0.5 ? -1 : 1;
          for (let j = 0; j < tall; j++) {
            const px = sx + (j > tall * 0.6 ? lean : 0);
            const colour = j === 0 ? REED[0] : j < tall * 0.4 ? REED[2] : k % 2 === 0 ? REED[4] : REED[3];
            for (const layer of [bitmap, wild]) layer.set(px, y - j, colour);
          }
          if (random() < 0.3) {
            for (const layer of [bitmap, wild]) {
              layer.set(sx, y - tall, EARTH[2]);
              layer.set(sx, y - tall - 1, EARTH[3]);
            }
          }
        }
      }
      // Lily pads on the open water.
      for (let n = count(LILIES_PER_PIXEL); n > 0; n--) {
        const x = within(1, w - 4);
        const y = within(1, h - 2);
        if (pools[y * w + x] > -5) continue;
        for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [-1, 0], [0, 1], [1, 1], [0, -1]]) bitmap.set(x + dx, y + dy, dx === 2 ? LEAF[3] : LEAF[5]);
        if (random() < 0.2) bitmap.set(x, y - 1, NEUTRAL[7]);
      }
    }
    const petals = [GOLD[5], NEUTRAL[7], RED[5], GOLD[6]];
    for (let n = count(PETALS_PER_PIXEL), k = 0; n > 0; n--, k++) {
      const x = within(0, w);
      const y = within(0, h - 1);
      if (!grassAt(x, y) || !grassAt(x, y + 1) || forestAmount(province, X0 + x, Y0 + y) > 0.4) continue;
      bitmap.set(x, y, petals[(k + tx + ty) % petals.length]);
      bitmap.set(x, y + 1, GRASS[1]);
    }
    return { x: X0, y: Y0, bitmap, wild };
  }
}

/** The stretches of some polylines, each with the box round it that `radius` reaches. */
function segments(lines: readonly Point[][], radius: number): Segment[] {
  const out: Segment[] = [];
  for (const path of lines) {
    let along = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, ay] = path[i];
      const [bx, by] = path[i + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const length = Math.hypot(dx, dy) || 1e-6;
      out.push({
        ax, ay, dx, dy, length, along,
        x0: Math.floor(Math.min(ax, bx) - radius),
        x1: Math.ceil(Math.max(ax, bx) + radius),
        y0: Math.floor(Math.min(ay, by) - radius),
        y1: Math.ceil(Math.max(ay, by) + radius),
      });
      along += length;
    }
  }
  return out;
}

/** Distance to the nearest stretch, distance along its line, and which side, for each pixel of a tile. */
function field(stretches: readonly Segment[], X0: number, Y0: number, w: number, h: number): Field {
  const out: Field = { d: new Float32Array(w * h).fill(1e6), s: new Float32Array(w * h), side: new Int8Array(w * h) };
  for (const { ax, ay, dx, dy, length, along, x0, y0, x1, y1 } of stretches) {
    const xa = Math.max(X0, x0);
    const xb = Math.min(X0 + w - 1, x1);
    const ya = Math.max(Y0, y0);
    const yb = Math.min(Y0 + h - 1, y1);
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (length * length)));
        const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
        const i = (y - Y0) * w + (x - X0);
        if (d < out.d[i]) {
          out.d[i] = d;
          out.s[i] = along + t * length;
          out.side[i] = Math.sign(dx * (y - ay) - dy * (x - ax));
        }
      }
    }
  }
  return out;
}
