import { lineAt, type Point } from '../rules/map/geometry';
import { forestAmount, pathHalfWidth, poolDistance, riverHalfWidth, shoreWobble, type MapModel } from '../rules/map/model';
import { Bitmap } from './bitmap';
import { ground as groundArt } from './mapArt';
import type { GroundName } from './mapPieces';
import { fbm, hash, noise, rng, shade } from './noise';
import { CYCLE_BOG, CYCLE_DEEP, CYCLE_FALL, CYCLE_SHALLOW, DIRT, EARTH, GOLD, GRASS, LEAF, LIGHT_LUT, NEUTRAL, PLUM, RED, REED, ROCK, SAND, SHADOW_LUT, WATER } from './palette';
import type { Region } from '../content/types';

/** What each painted pixel is, for placing details. The rules keep their own, coarser map. */
export const Ground = { Grass: 0, Water: 1, Bank: 2, Road: 3, Cliff: 4, Field: 5, Hedge: 6, Rough: 7 } as const;

/** Seeds for each kind of region's ragged edge. */
const EDGES: Record<Region['kind'], number> = { fields: 101, heath: 102, downs: 103 };

/** Fields are about this many pixels across: a patchwork cut from a jittered grid. */
const FIELD = 84;
/** How far round a ford the river runs shallow and stony. */
const FORD_WATER = 34;

/** What grows in a field, painted from its light, where it is, and whether it's on a furrow. */
type Crop = (light: number, x: number, y: number, furrow: boolean) => number;
const CROPS: [number, Crop][] = [
  // Wheat, ripening in rows.
  [0.22, (l, x, y, f) => shade(SAND, 0.56 + l + (f ? 0.07 : -0.05), x, y)],
  // Barley, or hay: straw.
  [0.12, (l, x, y, f) => shade(DIRT, 0.66 + l + (f ? 0.05 : -0.04), x, y)],
  // Pasture: short grass, a shade brighter than the meadow.
  [0.28, (l, x, y) => shade(GRASS, 0.57 + l, x, y)],
  // Ploughed: brown furrows.
  [0.14, (l, x, y, f) => shade(EARTH, 0.64 + l + (f ? 0.08 : -0.08), x, y)],
  // Young crops: green rows in the earth.
  [0.14, (l, x, y, f) => (f ? shade(GRASS, 0.56 + l, x, y) : shade(EARTH, 0.62 + l, x, y))],
  // Fallow: rough grass going to seed.
  [0.1, (l, x, y) => (hash(x, y, 86) < 0.3 ? shade(REED, 0.56 + l, x, y) : shade(GRASS, 0.5 + l, x, y))],
];
/** Which painted ground each crop is, on Aldmoor's painted map. */
const CROP_GROUND: GroundName[] = ['wheat', 'grass', 'grass', 'plough', 'grass', 'grass'];
/** On the painted map only one field in this many is worked: HoMM2's land is meadow, with a field or two by a village. */
const WORKED = 0.4;
const FURROWS = [0, Math.PI / 2, Math.PI / 4, (Math.PI * 3) / 4].map((a) => [Math.cos(a), Math.sin(a)] as const);

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
  /** The province's regions by kind. */
  private readonly regions: Record<Region['kind'], Region['at'][]>;
  private readonly fords: readonly Point[];
  /** The patchwork: each field's centre, whether it lies in the fields, and its crop and furrows. */
  private readonly fields: { cols: number; rows: number; x: Float32Array; y: Float32Array; farmed: Uint8Array; crop: Uint8Array; furrow: Uint8Array } | null;

  /** Aldmoor's painted ground (#178), when it has loaded: each kind of land a seamless square. */
  private readonly painted: Record<GroundName, Bitmap> | null;

  constructor(map: MapModel) {
    this.map = map;
    const names: GroundName[] = ['grass', 'dirt', 'heath', 'heather', 'wheat', 'plough', 'water'];
    const art = names.map((n) => groundArt(n));
    this.painted = map.province.id === 'aldmoor' && art.every(Boolean) ? (Object.fromEntries(names.map((n, i) => [n, art[i]!])) as Record<GroundName, Bitmap>) : null;
    this.width = map.province.width;
    this.height = map.province.height;
    this.river = segments([map.river], 40);
    this.paths = segments(joined(map.paths), 20);
    this.cliffTops = new Float32Array(this.width).fill(NaN);
    if (map.cliff) {
      for (let x = 0; x < this.width; x++) {
        const y = lineAt(map.cliff, x);
        if (y !== undefined) this.cliffTops[x] = y + (noise(x / 6, 0, 71) - 0.5) * 5;
      }
    }
    this.fords = map.province.fords ?? [];
    const regions = map.province.regions ?? [];
    this.regions = { fields: [], heath: [], downs: [] };
    for (const r of regions) this.regions[r.kind].push(r.at);
    this.fields = null;
    if (this.regions.fields.length) {
      const cols = Math.ceil(this.width / FIELD) + 1;
      const rows = Math.ceil(this.height / FIELD) + 1;
      const greens: Point[] = [...map.province.locations.map((l) => l.at), ...map.province.decor.map((d) => d.at), map.province.hero];
      const fields = { cols, rows, x: new Float32Array(cols * rows), y: new Float32Array(cols * rows), farmed: new Uint8Array(cols * rows), crop: new Uint8Array(cols * rows), furrow: new Uint8Array(cols * rows) };
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const k = j * cols + i;
          fields.x[k] = (i + 0.15 + 0.7 * hash(i, j, 81)) * FIELD;
          fields.y[k] = (j + 0.15 + 0.7 * hash(i, j, 82)) * FIELD;
          // Places stand on a green of their own, not in a crop.
          const green = greens.some(([gx, gy]) => Math.hypot(gx - fields.x[k], gy - fields.y[k]) < 76);
          fields.farmed[k] = !green && this.within('fields', fields.x[k], fields.y[k]) > 0 ? 1 : 0;
          let pick = hash(i, j, 83);
          let crop = 0;
          while (crop < CROPS.length - 1 && pick >= CROPS[crop][0]) pick -= CROPS[crop++][0];
          fields.crop[k] = crop;
          fields.furrow[k] = Math.floor(hash(i, j, 84) * FURROWS.length);
        }
      }
      if (this.painted) {
        // On the painted map a field is worked only if nothing crosses it: no road, no river, and
        // nothing built in it. A field is the land nearer its centre than any other's, so a field is
        // spoilt by any road, river or place whose ground is nearest its centre.
        const owner = (x: number, y: number) => {
          const ci = Math.floor(x / FIELD);
          const cj = Math.floor(y / FIELD);
          let best = -1;
          let bestD = Infinity;
          for (let j = Math.max(0, cj - 1); j <= Math.min(rows - 1, cj + 1); j++) {
            for (let i = Math.max(0, ci - 1); i <= Math.min(cols - 1, ci + 1); i++) {
              const k = j * cols + i;
              const d = (x - fields.x[k]) ** 2 + (y - fields.y[k]) ** 2;
              if (d < bestD) [best, bestD] = [k, d];
            }
          }
          return best;
        };
        const spoil = (x: number, y: number, r: number) => {
          for (let dy = -r; dy <= r; dy += 4) for (let dx = -r; dx <= r; dx += 4) if (dx * dx + dy * dy <= r * r) {
            const k = owner(x + dx, y + dy);
            if (k >= 0) fields.farmed[k] = 0;
          }
        };
        const along = (line: readonly Point[], r: number) => {
          for (let n = 1; n < line.length; n++) {
            const [ax, ay] = line[n - 1];
            const [bx, by] = line[n];
            const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 4);
            for (let t = 0; t <= steps; t++) spoil(ax + ((bx - ax) * t) / steps, ay + ((by - ay) * t) / steps, r);
          }
        };
        for (const line of map.paths) along(line, 12);
        along(map.river, 28);
        for (const [x, y] of [...map.province.locations.map((l) => l.at), ...map.province.decor.map((d) => d.at)]) spoil(x, y, 44);
      }
      this.fields = fields;
    }
  }

  /**
   * A pixel of one of the painted grounds, its square mirrored at random from one square to the next
   * so the land doesn't repeat, and darkened or lit (dithered) by the land's light at that point.
   */
  private texel(name: GroundName, x: number, y: number, level = 0.52): number {
    const t = this.painted![name];
    const cx = Math.floor(x / t.width);
    const cy = Math.floor(y / t.height);
    let u = x - cx * t.width;
    let v = y - cy * t.height;
    if (hash(cx, cy, 401) < 0.5) u = t.width - 1 - u;
    if (hash(cx, cy, 402) < 0.5) v = t.height - 1 - v;
    const c = t.data[v * t.width + u];
    // Only real shade (under woods, at a bank) darkens it: the land's broad light is left to the texture, which has its own.
    const d = level - 0.52;
    if (d < -0.24) return SHADOW_LUT[c];
    if (d > 0.3) return LIGHT_LUT[c];
    return c;
  }

  /** Open land on Aldmoor's painted map: the same lands as `land`, each its own painted ground. */
  private paintedLand(x: number, y: number, level: number): { colour: number; ground: number } {
    const fields = this.fields;
    if (fields) {
      const ci = Math.floor(x / FIELD);
      const cj = Math.floor(y / FIELD);
      let a = -1;
      let b = -1;
      let da = Infinity;
      let db = Infinity;
      for (let j = Math.max(0, cj - 1); j <= Math.min(fields.rows - 1, cj + 1); j++) {
        for (let i = Math.max(0, ci - 1); i <= Math.min(fields.cols - 1, ci + 1); i++) {
          const k = j * fields.cols + i;
          const d = (x - fields.x[k]) ** 2 + (y - fields.y[k]) ** 2;
          if (d < da) {
            [b, db] = [a, da];
            [a, da] = [k, d];
          } else if (d < db) [b, db] = [k, d];
        }
      }
      if (fields.farmed[a] || fields.farmed[b]) {
        const hedge = (db - da) / (2 * Math.hypot(fields.x[a] - fields.x[b], fields.y[a] - fields.y[b]));
        const hedged = hash(Math.min(a, b), Math.max(a, b), 85) > 0.25 && noise(x / 9, y / 9, 86) > 0.22;
        // Hedges are a soft band of darker grass, not a line.
        const tilled = (k: number) => fields.farmed[k] === 1 && forestAmount(this.map.province, fields.x[k], fields.y[k]) < 0.2 && hash(k, 0, 404) < WORKED && CROP_GROUND[fields.crop[k]] !== 'grass';
        const worked = tilled(a) || tilled(b);
        if (worked && hedged && hedge < 1.2) return { colour: SHADOW_LUT[this.texel('grass', x, y, level)], ground: Ground.Hedge };
        const crop = hash(a, 0, 404) < WORKED ? CROP_GROUND[fields.crop[a]] : 'grass';
        // A field fades into the grass round it over a few pixels, ragged, as HoMM2's ground meets.
        if (tilled(a) && crop !== 'grass' && hedge > 1.2 && forestAmount(this.map.province, x, y) < 0.4) return { colour: this.texel(crop, x, y, level - 0.08), ground: Ground.Field };
      }
    }
    if (this.regions.downs.length && this.within('downs', x, y) > 0) {
      // The downs: the same grass, a touch brighter on the open slopes.
      return { colour: this.texel('grass', x, y, Math.min(0.6, level + 0.06)), ground: Ground.Grass };
    }
    if (this.regions.heath.length && this.within('heath', x, y) > 0) {
      // Dry grass, with clumps of heather where the noise rises: soft-edged, never in a grid.
      const heather = fbm(x / 26, y / 20, 2, 88) + (noise(x / 5, y / 5, 89) - 0.5) * 0.18;
      return { colour: this.texel(heather > 0.6 ? 'heather' : 'heath', x, y, level), ground: Ground.Rough };
    }
    return { colour: this.texel('grass', x, y, level), ground: Ground.Grass };
  }

  /** How far inside a region of this kind a point lies: above zero inside, with a ragged edge. */
  private within(kind: Region['kind'], x: number, y: number): number {
    let most = -1;
    for (const [cx, cy, rx, ry] of this.regions[kind]) {
      if (Math.abs(x - cx) > rx * 1.4 || Math.abs(y - cy) > ry * 1.4) continue;
      most = Math.max(most, 1 - Math.hypot((x - cx) / rx, (y - cy) / ry));
    }
    return most < -0.4 ? most : most + (fbm(x / 70, y / 70, 2, EDGES[kind]) - 0.5) * 0.4;
  }

  /**
   * The colour of open land at a point, from its light: a field or the hedge round it, heather, the
   * downs, or meadow. Says what sort of ground it is: tufts and petals only grow on grass. Seen from
   * `far` off, the odd sprig in flower is lost among the rest.
   */
  private land(x: number, y: number, level: number, fen: boolean, far = false): { colour: number; ground: number } {
    if (this.painted) return this.paintedLand(x, y, level);
    const light = (level - 0.52) * 0.45;
    const fields = this.fields;
    if (fields) {
      // The two nearest field centres: the pixel is in the nearer one's field, and on a hedge where the two meet.
      const ci = Math.floor(x / FIELD);
      const cj = Math.floor(y / FIELD);
      let a = -1;
      let b = -1;
      let da = Infinity;
      let db = Infinity;
      for (let j = Math.max(0, cj - 1); j <= Math.min(fields.rows - 1, cj + 1); j++) {
        for (let i = Math.max(0, ci - 1); i <= Math.min(fields.cols - 1, ci + 1); i++) {
          const k = j * fields.cols + i;
          const d = (x - fields.x[k]) ** 2 + (y - fields.y[k]) ** 2;
          if (d < da) {
            [b, db] = [a, da];
            [a, da] = [k, d];
          } else if (d < db) [b, db] = [k, d];
        }
      }
      if (fields.farmed[a] || fields.farmed[b]) {
        const hedge = (db - da) / (2 * Math.hypot(fields.x[a] - fields.x[b], fields.y[a] - fields.y[b]));
        // Most fields are hedged; some just meet, or have a gap.
        const hedged = hash(Math.min(a, b), Math.max(a, b), 85) > 0.25 && noise(x / 9, y / 9, 86) > 0.22;
        if (hedged && hedge < 1) return { colour: shade(LEAF, 0.34 + (noise(x / 2.5, y / 2.5, 87) - 0.5) * 0.4 + light, x, y), ground: Ground.Hedge };
        if (fields.farmed[a]) {
          const [fx, fy] = FURROWS[fields.furrow[a]];
          const furrow = Math.floor((x * fx + y * fy + 4000) / 2.5) % 2 === 0;
          const texture = (noise(x / 5, y / 5, 88) - 0.5) * 0.12 - (hedged && hedge < 2.5 ? 0.08 : 0);
          return { colour: CROPS[fields.crop[a]][1](light + texture, x, y, furrow), ground: Ground.Field };
        }
      }
    }
    if (this.regions.downs.length && this.within('downs', x, y) > 0) {
      // The downs roll: slopes lit from the north-west, pale grass, a chalky scar here and there.
      const slope = fbm((x - 5) / 240, (y - 5) / 170, 2, 95) - fbm((x + 5) / 240, (y + 5) / 170, 2, 95);
      const chalk = fbm(x / 22, y / 22, 2, 96) + (noise(x / 5, y / 5, 97) - 0.5) * 0.2 > 0.8;
      if (chalk) return { colour: shade(SAND, 0.56 + light, x, y), ground: Ground.Rough };
      // Never the brightest greens, which would glare through the mist.
      return { colour: shade(GRASS, Math.min(0.74, 0.56 + light * 1.3 + slope * 5), x, y), ground: Ground.Grass };
    }
    if (this.regions.heath.length && this.within('heath', x, y) > 0) {
      // The heath: clumps of heather, sprigs of it in flower, gorse, and dry grass between.
      const heather = fbm(x / 20, y / 15, 2, 88) + (noise(x / 4, y / 4, 89) - 0.5) * 0.3;
      if (heather > 0.64) {
        // A clump of heather: brown stems, mauve flowers on top, thicker in the middle.
        const bloom = hash(x, y, 90) < 0.3 + (heather - 0.64) * 3;
        return { colour: bloom ? (hash(x, y, 92) < 0.3 ? PLUM[3] : PLUM[2]) : shade(EARTH, 0.45 + light + (noise(x / 2, y / 2, 96) - 0.5) * 0.3, x, y), ground: Ground.Rough };
      }
      if (!far && hash(x, y, 91) < 0.01) return { colour: PLUM[3], ground: Ground.Rough };
      if (!far && hash(x, y, 93) < 0.002) return { colour: GOLD[5], ground: Ground.Rough };
      // Between the heather, dry grass, with wiry green in the hollows.
      const green = fbm(x / 24, y / 24, 2, 94) < 0.44;
      return { colour: green ? shade(GRASS, level - 0.1, x, y) : shade(REED, 0.5 + light + (noise(x / 4, y / 4, 97) - 0.5) * 0.16, x, y), ground: Ground.Grass };
    }
    // Fen country: tussocks of straw-coloured sedge through the grass.
    const sedge = fen && fbm(x / 34, y / 34, 2, 98) + (noise(x / 5, y / 5, 99) - 0.5) * 0.3 > 0.56;
    return { colour: sedge ? shade(REED, level + 0.08, x, y) : shade(GRASS, level, x, y), ground: Ground.Grass };
  }

  /**
   * The colour of open land at a point seen from far off, for the minimap: its field, heather, downs
   * or meadow, in the land's broad light but none of its close detail. It looks where the ordered
   * dither sits at one half, so each shade is rounded rather than patterned.
   */
  overview(x: number, y: number): number {
    const fen = Boolean(this.map.province.fen);
    const [px, py] = [Math.floor(x / 4) * 4 + 1, Math.floor(y / 4) * 4];
    return this.land(px, py, 0.52 + (fbm(px / 90, py / 90, 3, 1) - 0.5) * 0.5 - (fen ? 0.06 : 0), fen, true).colour;
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
        const p = paths.d[i];
        const pathHalf = pathHalfWidth(paths.s[i]) + (noise(x / 3, y / 3, 22) - 0.5) * 1.2;
        const ford = this.fords.some(([fx, fy]) => Math.abs(x - fx) < FORD_WATER && Math.abs(y - fy) < FORD_WATER && Math.hypot(x - fx, y - fy) < FORD_WATER);

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

        if (edge < 0 && ford) {
          // The ford: shallows over gravel, and stepping stones where the road wades across.
          ground[i] = Ground.Water;
          const phase = Math.floor(r.s / 3.4 + fbm(r.s / 18, (r.d * r.side) / 6, 2, 13) * 5) % 6;
          // Stepping stones on a rough grid along the road, lit from above, the water breaking white below them.
          const sx = Math.floor(x / 7);
          const sy = Math.floor(y / 6);
          const cx = sx * 7 + 3.5 + (hash(sx, sy, 97) - 0.5) * 2;
          const cy = sy * 6 + 3 + (hash(sx, sy, 99) - 0.5) * 1.5;
          const d = Math.hypot((x - cx) / 2.8, (y - cy) / 2.1);
          const onStone = p < pathHalf + 1.5 && hash(sx, sy, 98) < 0.8;
          if (onStone && d < 1) bitmap.data[i] = shade(ROCK, 0.86 - (y - cy + 2) * 0.12, x, y);
          else if (onStone && d < 1.45 && y > cy) bitmap.data[i] = WATER[9];
          else if (hash(x, y, 96) < 0.06) bitmap.data[i] = shade(ROCK, 0.45, x, y);
          else bitmap.data[i] = hash(x, y, 14) < 0.45 ? WATER[8] : CYCLE_SHALLOW[(phase + 3) % 6];
          continue;
        }

        if (edge < 0) {
          ground[i] = Ground.Water;
          const depth = Math.min(1, -edge / halfWidth);
          const phase = Math.floor(r.s / 3.4 + fbm(r.s / 18, (r.d * r.side) / 6, 2, 13) * 5) % 6;
          const pool = !Number.isNaN(top) && face >= CLIFF_HEIGHT && face < CLIFF_HEIGHT + 16;
          if (pool && hash(x, y, 75) < 0.7 - (face - CLIFF_HEIGHT) * 0.04) bitmap.data[i] = hash(x, y, 76) < 0.5 ? WATER[9] : WATER[8];
          else if (this.painted) {
            // The painted river: its own water, a light rim at the bank, and a glint here and there that still turns with the clock.
            if (edge > -1.5) bitmap.data[i] = hash(x, y, 14) < 0.5 ? LIGHT_LUT[this.texel('water', x, y)] : CYCLE_SHALLOW[phase];
            else if (hash(x, y, 17) < 0.04) bitmap.data[i] = CYCLE_SHALLOW[phase];
            else bitmap.data[i] = this.texel('water', x, Math.round(y - r.s * 0.3), 0.52 - depth * 0.1);
          } else if (edge > -1.5) bitmap.data[i] = hash(x, y, 14) < 0.6 ? WATER[9] : CYCLE_SHALLOW[phase];
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
          bitmap.data[i] = this.painted ? (edge < 1.2 ? SHADOW_LUT[SHADOW_LUT[this.texel('dirt', x, y)]] : this.texel('dirt', x, y, level + 0.2)) : shade(EARTH, level, x, y);
          if (ford && p < pathHalf + 1) {
            // The road runs down the bank into the ford, churned to mud.
            ground[i] = Ground.Road;
            wild.data[i] = bitmap.data[i];
            bitmap.data[i] = shade(DIRT, 0.42 + (noise(x / 3, y / 3, 23) - 0.5) * 0.3, x, y);
          }
          continue;
        }

        let level = 0.52 + (fbm(x / 90, y / 90, 3, 1) - 0.5) * 0.5 + (noise(x / 7, y / 7, 2) - 0.5) * 0.26;
        level += (hash(x, y, 3) - 0.5) * 0.16;
        if (edge < 10) level -= (10 - edge) * 0.02;
        if (shore < 16) level -= (16 - shore) * 0.012;
        const forest = forestAmount(province, x, y);
        if (forest > 0.44) level -= Math.min(0.3, (forest - 0.44) * 1.4);
        if (!Number.isNaN(top) && face >= CLIFF_HEIGHT && face < CLIFF_HEIGHT + 8) level -= 0.28 - (face - CLIFF_HEIGHT) * 0.03;

        if (province.fen) level -= 0.06;
        // The painted ground has its own light: only woods, banks and the cliff's foot shade it, never the land's broad noise.
        if (this.painted) {
          level = 0.52;
          if (edge < 10) level -= (10 - edge) * 0.02;
          if (forest > 0.56) level -= Math.min(0.3, (forest - 0.56) * 1.4);
          if (!Number.isNaN(top) && face >= CLIFF_HEIGHT && face < CLIFF_HEIGHT + 8) level -= 0.3;
        }
        const land = this.land(x, y, level, Boolean(province.fen));
        wild.data[i] = land.colour;
        if (p < pathHalf) {
          ground[i] = Ground.Road;
          if (this.painted) {
            bitmap.data[i] = this.texel('dirt', x, y, 0.56);
            continue;
          }
          let dirt = 0.62 + (noise(x / 5, y / 5, 23) - 0.5) * 0.36 + (hash(x, y, 24) - 0.5) * 0.14;
          if (p > pathHalf - 1.1) dirt -= 0.34;
          if (hash(x, y, 25) < 0.03) dirt += 0.3;
          bitmap.data[i] = shade(DIRT, dirt, x, y);
          continue;
        }
        // On the painted map the road is wider than the rules' track: its worn verge is road too, frayed at the edge.
        if (this.painted && p < pathHalf * 2.1) {
          ground[i] = Ground.Road;
          bitmap.data[i] = this.texel('dirt', x, y, p > pathHalf * 1.8 ? 0.4 : 0.56);
          continue;
        }
        ground[i] = land.ground;
        bitmap.data[i] = p < pathHalf + 1.8 ? this.land(x, y, level - 0.16, Boolean(province.fen)).colour : land.colour;
      }
    }

    // Water, banks and cliffs look the same with or without roads; the open land under the fog has none.
    for (let i = 0; i < w * h; i++) if (ground[i] === Ground.Water || ground[i] === Ground.Bank || ground[i] === Ground.Cliff) wild.data[i] = bitmap.data[i];

    // Details, from this tile's own dice, placed where they fit inside it.
    if (this.painted) return { x: X0, y: Y0, bitmap, wild };
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

/**
 * The roads, each end that stops just short of another road (at a signpost, a fork) carried on to
 * meet it, so every junction on the map is joined. Ends further off are where a road reaches a place.
 */
function joined(lines: readonly Point[][]): Point[][] {
  const nearestOn = ([px, py]: Point, line: readonly Point[]): { at: Point; d: number } => {
    let best = { at: line[0], d: Infinity };
    for (let n = 1; n < line.length; n++) {
      const [ax, ay] = line[n - 1];
      const [bx, by] = line[n];
      const [dx, dy] = [bx - ax, by - ay];
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
      const at: Point = [ax + t * dx, ay + t * dy];
      const d = Math.hypot(px - at[0], py - at[1]);
      if (d < best.d) best = { at, d };
    }
    return best;
  };
  return lines.map((line, i) => {
    const out = [...line];
    for (const end of [0, 1]) {
      const p = end ? out[out.length - 1] : out[0];
      let best = { at: p, d: Infinity };
      lines.forEach((other, k) => {
        if (k === i) return;
        const hit = nearestOn(p, other);
        if (hit.d < best.d) best = hit;
      });
      if (best.d > 0.5 && best.d < 40) {
        if (end) out.push(best.at);
        else out.unshift(best.at);
      }
    }
    return out;
  });
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
