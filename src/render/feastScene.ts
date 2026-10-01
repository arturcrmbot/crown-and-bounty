import type { GameState } from '../rules/game';
import { Bitmap, blit, SHADOW } from './bitmap';
import { FEAST_FIRE, FEAST_FLAME, FEAST_HORIZON, FEAST_MOON, feastLayout, type FeastSpot } from './feastLayout';
import { MAP_VIEW, paintFrame, SCREEN } from './frame';
import { paintHud } from './hud';
import { feastPiece, ground, paintedFigure, piece } from './mapArt';
import { fbm, hash, noise, rng } from './noise';
import { COLORS, CYCLING, GOLD, INK, LEAF, NEUTRAL, PARCHMENT, RED, SHADOW_LUT, SILHOUETTE } from './palette';
import { bigLettering, drawOutlined, lettered, textMask } from './text';

/**
 * The payday feast (#191): Aldric's camp celebrating payday, at night, round a fire with a pig on the spit. The sky,
 * the trees, the ground, the flames, the sparks and the smoke are drawn here; the people and the camp's things are the
 * feast's pieces (`npm run mapart`), placed by `feastLayout`. The fire lights them as the night lights the map: through
 * tables from each palette colour to the same colour in the fire's light, by how near the fire it is, and the light
 * flickers with the flames.
 */

const W = MAP_VIEW.width;
const H = MAP_VIEW.height;
const N = W * H;

const clampByte = (v: number) => Math.max(0, Math.min(255, v));

/** The palette's colours a picture may use: not the ones that turn with the clock. */
const STEADY = COLORS.map((_, i) => i).filter((i) => i > 0 && !CYCLING.has(i) && i !== SILHOUETTE);
const nearestCache = new Map<number, number>();
/** The palette colour nearest an RGB colour, weighted as the palette's own tables weigh it. */
function nearest(r: number, g: number, b: number): number {
  const [cr, cg, cb] = [clampByte(r) & ~3, clampByte(g) & ~3, clampByte(b) & ~3];
  const key = (cr << 16) | (cg << 8) | cb;
  const known = nearestCache.get(key);
  if (known !== undefined) return known;
  let best = STEADY[0];
  let bestDistance = Infinity;
  for (const i of STEADY) {
    const [pr, pg, pb] = COLORS[i];
    const distance = 2 * (pr - cr) ** 2 + 4 * (pg - cg) ** 2 + 3 * (pb - cb) ** 2;
    if (distance < bestDistance) [best, bestDistance] = [i, distance];
  }
  nearestCache.set(key, best);
  return best;
}

/** How many steps of firelight the tables hold, and the brightest. */
const LEVELS = 24;
const TOP = 1.6;
const STEP = (LEVELS - 1) / TOP;
/** The moon's light, everywhere, and the fire's, as much again as it is near. */
const MOON = [0.13, 0.165, 0.31] as const;
const FIRE = [1.28, 0.9, 0.55] as const;

type Rgb = readonly [number, number, number];
function table(light: (rgb: Rgb, level: number) => Rgb): Uint8Array {
  const out = new Uint8Array(LEVELS * 256);
  for (let k = 0; k < LEVELS; k++) {
    const level = k / STEP;
    for (let c = 0; c < 256; c++) out[k * 256 + c] = c === 0 || c >= COLORS.length ? c : nearest(...light(COLORS[c], level));
  }
  return out;
}
/** Night and firelight on a colour: grey and blue in the moonlight, its own colour as the fire nears. The ground's goes greyer. */
const firelit =
  (grey: number) =>
  ([r, g, b]: Rgb, level: number): Rgb => {
    const flat = (r + g + b) / 3;
    const [dr, dg, db] = [r + (flat - r) * grey, g + (flat - g) * grey, b + (flat - b) * grey];
    const dull = (dr + dg + db) / 3;
    const own = Math.min(1, level);
    const lit = (c: number, k: number) => ((c * 0.55 + dull * 0.45) * (1 - own) + c * own) * (MOON[k] + FIRE[k] * level);
    return [lit(dr, 0), lit(dg, 1), lit(db, 2)];
  };
/** The trees' dark, warmed a little by the fire. */
const warmed = ([r, g, b]: Rgb, level: number): Rgb => [r + 70 * level, g + 34 * level, b + 10 * level];
let tables: { ground: Uint8Array; things: Uint8Array; trees: Uint8Array } | null = null;
const lightTables = () => (tables ??= { ground: table(firelit(0.3)), things: table(firelit(0)), trees: table(warmed) });

/** What a pixel of the picture is, for its light: painted as it is (the sky), the ground, a thing standing on it, or a tree. */
const SKY = 0;
const GROUND = 1;
const THING = 2;
const TREE = 3;

/** How brightly the fire burns, a moment at a time. */
const flicker = (t: number) => 1 + 0.07 * Math.sin(2 * Math.PI * 2.1 * t) + 0.05 * Math.sin(2 * Math.PI * 4.9 * t + 0.3) + 0.03 * Math.sin(2 * Math.PI * 7.6 * t + 0.6);
/** The fire's light on a thing standing `d` pixels from it. */
const reach = (d: number) => Math.max(0, 1 - d / 320) ** 1.9 * 1.3;

/** The flames' colours, from the white heart out to the dark red tips, and the heat each starts at. */
const FLAMES: [number, number][] = [
  [0.86, PARCHMENT[6]],
  [0.64, GOLD[6]],
  [0.42, GOLD[5]],
  [0.24, GOLD[4]],
  [0.11, RED[4]],
  [0.04, RED[2]],
];

/** A sprite pixel, flipped or not. */
const at = (sprite: Bitmap, x: number, y: number, flip: boolean) => sprite.data[y * sprite.width + (flip ? sprite.width - 1 - x : x)];

export class FeastScene {
  readonly screen = new Bitmap(SCREEN.width, SCREEN.height);
  private readonly frame: Uint8Array;
  private readonly overlay: Bitmap;
  /** The picture's colours before the light, what each pixel is, and how much of the fire's light reaches it. */
  private readonly base = new Uint8Array(N);
  private readonly kind = new Uint8Array(N);
  private readonly light = new Float32Array(N);
  /** A little noise on the light, so its steps dither into each other. */
  private readonly grain = new Float32Array(N);
  private readonly stars: { x: number; y: number; bright: number; twinkles: boolean; phase: number }[] = [];
  /** The line under the fire, and the gold in the King's chest that catches the light. */
  private readonly words = new Bitmap(W, H);
  private readonly glints: number[] = [];
  /** Where the fire stands, its logs (which hide the flames behind them), the roast over it, and whoever dances. */
  private readonly fire: { x: number; y: number; sprite: Bitmap } | null;
  private readonly spit: { x: number; y: number; sprite: Bitmap } | null;
  private dancer: { x: number; y: number; sprite: Bitmap } | null = null;
  private readonly smoke: number;
  private readonly glow: number;

  /** `gold` is what the map's bar shows: payday's pay flies to it once the feast is over. */
  constructor(state: GameState, line: string, gold = state.gold) {
    const { frame, overlay } = paintFrame();
    paintHud(frame, state, null, { gold });
    this.frame = frame.data.slice();
    this.overlay = overlay;
    this.smoke = nearest(118, 122, 156);
    this.glow = nearest(120, 150, 60);
    for (let i = 0; i < N; i++) this.grain[i] = (hash(i % W, Math.floor(i / W), 99) - 0.5) * 0.08;
    const trees = this.sky();
    this.meadow(trees);
    const spots = feastLayout(state.hero.background, state.army);
    this.shadows(spots);
    const fire = spots.find((s) => 'feast' in s && s.feast === 'fire');
    const fireSprite = feastPiece('fire');
    this.fire = fire && fireSprite ? { x: Math.round(fire.x - fireSprite.width / 2), y: fire.y - fireSprite.height, sprite: fireSprite } : null;
    const spit = feastPiece('spit');
    this.spit = spit ? { x: Math.round(FEAST_FIRE.x - spit.width / 2), y: FEAST_FIRE.y - 8 - spit.height, sprite: spit } : null;
    const owner = new Int16Array(N).fill(-1);
    spots.forEach((spot, i) => {
      if ('feast' in spot && spot.dances) {
        const sprite = feastPiece(spot.feast);
        if (sprite) this.dancer = { x: spot.x, y: spot.y, sprite };
        return;
      }
      this.place(spot, i, owner);
    });
    this.lights(spots, owner);
    this.foreground();
    this.write(line);
  }

  /** The night sky, the moon in its haze, thin cloud, a far ridge and the trees against it. Returns which pixels are trees. */
  private sky(): Uint8Array {
    const { base, kind } = this;
    const moon = FEAST_MOON;
    for (let y = 0; y < FEAST_HORIZON + 12; y++) {
      for (let x = 0; x < W; x++) {
        const t = Math.min(1, y / FEAST_HORIZON);
        const [r0, g0, b0] = t < 0.6 ? [5 + 7 * (t / 0.6), 7 + 8 * (t / 0.6), 22 + 18 * (t / 0.6)] : [12 + 16 * ((t - 0.6) / 0.4), 15 + 13 * ((t - 0.6) / 0.4), 40 + 14 * ((t - 0.6) / 0.4)];
        const d = Math.hypot(x - moon.x, y - moon.y);
        const halo = Math.exp(-((d / 52) ** 2));
        let [r, g, b] = [r0 + 22 * halo, g0 + 24 * halo, b0 + 36 * halo];
        const cloud = y < 150 && fbm(x / 90, y / 14, 4, 21) - 0.18 * Math.abs((y - 100) / 40) > 0.56;
        if (cloud) {
          const near = Math.exp(-((d / 140) ** 2));
          [r, g, b] = [24 + 64 * near, 26 + 64 * near, 48 + 74 * near];
        }
        if (d < 13) {
          const lit = Math.max(0.25, Math.min(1, (x - moon.x + 4) / 16 + 0.6));
          [r, g, b] = [232 * lit, 228 * lit, 196 * lit];
        } else if (d < 14.2) [r, g, b] = [120, 122, 150];
        const n = (hash(x, y, 3) - 0.5) * 6;
        const i = y * W + x;
        base[i] = nearest(r + n, g + n, b + n);
        kind[i] = SKY;
      }
    }
    for (let k = 0; k < 260; k++) {
      const x = Math.floor(hash(k, 1, 7) * W);
      const y = Math.floor(hash(k, 2, 7) ** 1.5 * (FEAST_HORIZON - 30));
      if (Math.hypot(x - moon.x, y - moon.y) < 40) continue;
      this.stars.push({ x, y, bright: 0.35 + 0.65 * hash(k, 3, 7), twinkles: hash(k, 4, 7) < 0.3, phase: hash(k, 5, 7) });
    }
    // The far ridge, its crest catching the moon.
    for (let x = 0; x < W; x++) {
      const crest = FEAST_HORIZON - 34 - 22 * fbm(x / 150, 0.5, 4, 5);
      for (let y = Math.max(0, Math.floor(crest)); y < FEAST_HORIZON + 12; y++) base[y * W + x] = y < crest + 1.5 ? nearest(36, 40, 66) : nearest(16, 18, 34);
    }
    // Pines and round crowns, tall at the sides and low behind the camp, rimmed with moonlight on the moon's side.
    const trees = new Uint8Array(N);
    const random = rng(11);
    const between = (a: number, b: number) => a + (b - a) * random();
    const spots: [number, number, number, boolean][] = [];
    for (let k = 0; k < 40; k++) {
      const x = -20 + ((W + 40) * k) / 39 + between(-14, 14);
      const middle = Math.abs(x - W / 2) < 250;
      const h = middle ? between(34, 62) : between(92, 158);
      spots.push([x, FEAST_HORIZON + (middle ? between(-4, 4) : between(6, 34)), h, random() < 0.75]);
    }
    for (let k = 0; k < 34; k++) spots.push([(W * k) / 33 + between(-10, 10), FEAST_HORIZON - 2, between(22, 40), true]);
    for (const [cx, foot, h, pine] of spots) {
      for (let y = Math.max(0, Math.floor(foot - h)); y < Math.min(H, foot); y++) {
        for (let x = Math.max(0, Math.floor(cx - h * 0.45)); x < Math.min(W, cx + h * 0.45); x++) {
          let inside: boolean;
          if (pine) {
            const p = (y - (foot - h)) / h;
            const tier = (p * 5.5) % 1;
            const half = h * 0.27 * (0.18 + 0.82 * p) * (0.5 + 0.5 * tier) + (noise(x / 2.2, y / 2.2, Math.floor(cx) + 5) - 0.5) * 3;
            inside = (y < foot - h * 0.06 && Math.abs(x - cx) < half) || (y >= foot - h * 0.1 && Math.abs(x - cx) < Math.max(1.5, h * 0.025));
          } else {
            const cy = foot - h * 0.6;
            const d = Math.hypot((x - cx) / 1.1, y - cy) / (h * 0.36) + (fbm(x / 6, y / 6, 3, Math.floor(cx)) - 0.5) * 0.55;
            inside = d < 1 || (Math.abs(x - cx) < 2.5 && y >= cy);
          }
          if (inside) trees[y * W + x] = 1;
        }
      }
    }
    const isTree = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && trees[y * W + x] === 1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!trees[i]) continue;
        const side = x < moon.x ? 2 : -2;
        const rim = (!isTree(x + side, y) || !isTree(x, y - 2)) && hash(x, y, 5) < 0.75;
        const n = (fbm(x / 6, y / 6, 3, 8) - 0.5) * 10;
        base[i] = rim ? nearest(40, 54, 80) : nearest(9 + n, 16 + n, 24 + n);
        kind[i] = TREE;
      }
    }
    return trees;
  }

  /** The meadow under the stars, worn to earth round the fire. */
  private meadow(trees: Uint8Array) {
    const grass = ground('grass');
    const dirt = ground('dirt');
    for (let x = 0; x < W; x++) {
      const edge = FEAST_HORIZON + 6 * fbm(x / 60, 0, 2, 31);
      for (let y = Math.max(0, Math.floor(edge)); y < H; y++) {
        const i = y * W + x;
        if (trees[i] && y < edge + 2) continue;
        const worn = Math.hypot((x - FEAST_FIRE.x) / 92, (y - FEAST_FIRE.y + 6) / 32) + (fbm(x / 7, y / 7, 3, 4) - 0.5) * 0.9 < 1;
        const tile = worn ? dirt : grass;
        this.base[i] = tile ? tile.data[(y % tile.height) * tile.width + (x % tile.width)] : worn ? nearest(126, 95, 56) : nearest(76, 99, 26);
        this.kind[i] = GROUND;
      }
    }
  }

  /** A dark pool under everything standing, and its shadow cast away from the fire. */
  private shadows(spots: FeastSpot[]) {
    const { base, kind } = this;
    const shade = (x: number, y: number, share: number) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = y * W + x;
      if (kind[i] === GROUND && hash(x, y, 7) < share) base[i] = SHADOW_LUT[base[i]];
    };
    for (const spot of spots) {
      if ('map' in spot || ('feast' in spot && spot.feast === 'fire')) continue;
      const sprite = 'feast' in spot ? feastPiece(spot.feast) : paintedFigure(spot.battle, 'battle');
      if (!sprite) continue;
      const half = sprite.width * 0.45;
      for (let y = spot.y - 6; y <= spot.y + 4; y++) for (let x = Math.floor(spot.x - half); x <= spot.x + half; x++) if (Math.hypot((x - spot.x) / half, (y - spot.y + 2) / 6) < 1) shade(x, y, 1);
      const [vx, vy] = [spot.x - FEAST_FLAME.x, (spot.y - FEAST_FIRE.y) * 2 + 0.001];
      const n = Math.hypot(vx, vy);
      if (n >= 400) continue;
      const [ux, uy] = [vx / n, vy / n];
      const length = 40 + 50 * (1 - n / 400);
      for (let y = Math.floor(spot.y - length); y <= spot.y + length; y++) {
        for (let x = Math.floor(spot.x - length); x <= spot.x + length; x++) {
          const along = (x - spot.x) * ux + (y - spot.y) * uy;
          const across = -(x - spot.x) * uy + (y - spot.y) * ux;
          if (along > 0 && along < length && Math.abs(across) < sprite.width * 0.32 * (1 - (along / length) * 0.5)) shade(x, y, (0.4 - 0.4 * (along / length)) / 0.45);
        }
      }
    }
  }

  /** Puts a piece, a map piece or a troop's battle figure into the picture, feet at its spot. */
  private place(spot: FeastSpot, index: number, owner: Int16Array) {
    const sprite = 'feast' in spot ? feastPiece(spot.feast) : 'map' in spot ? (piece(spot.map)?.sprite ?? null) : paintedFigure(spot.battle, 'battle');
    if (!sprite) return;
    const flip = 'flip' in spot && Boolean(spot.flip);
    const x0 = Math.round(spot.x - sprite.width / 2);
    const y0 = spot.y - sprite.height;
    const gold = 'feast' in spot && spot.feast === 'chest';
    for (let j = 0; j < sprite.height; j++) {
      const y = y0 + j;
      if (y < 0 || y >= H) continue;
      for (let i = 0; i < sprite.width; i++) {
        const x = x0 + i;
        const v = at(sprite, i, j, flip);
        if (v === 0 || x < 0 || x >= W) continue;
        const p = y * W + x;
        if (v === SHADOW) {
          this.base[p] = SHADOW_LUT[this.base[p]];
          continue;
        }
        this.base[p] = v;
        this.kind[p] = THING;
        owner[p] = index;
        const [r, g, b] = COLORS[v];
        if (gold && r > 200 && g > 150 && b < 120) this.glints.push(p);
      }
    }
  }

  /** How much of the fire's light reaches each pixel, with the edges that face it lit a little more. */
  private lights(spots: FeastSpot[], owner: Int16Array) {
    const { kind, light } = this;
    const fireIndex = spots.findIndex((s) => 'feast' in s && s.feast === 'fire');
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const [dx, dy] = [x - FEAST_FLAME.x, y - FEAST_FLAME.y];
        if (kind[i] === GROUND) light[i] = reach(Math.hypot(dx, dy * 1.9));
        else if (kind[i] === TREE) light[i] = Math.max(0, 1 - Math.hypot(dx, dy * 1.2) / 260) ** 2 * 0.9;
        else if (kind[i] === THING) {
          const d = Math.hypot(dx, dy);
          const me = owner[i];
          let rim = 0;
          if (me !== fireIndex) {
            const side = spots[me].x < FEAST_FLAME.x ? 1 : -1;
            const other = (ox: number, oy: number) => {
              const xx = x + ox;
              const yy = y + oy;
              return xx < 0 || yy < 0 || xx >= W || yy >= H || owner[yy * W + xx] !== me;
            };
            if (other(side, 0)) rim += 1;
            else if (other(side * 2, 0)) rim += 0.6;
            if (Math.abs(spots[me].x - FEAST_FLAME.x) < 90 && other(0, -2)) rim += 0.5;
          }
          light[i] = reach(d) + 0.75 * rim * Math.max(0, 1 - d / 200);
        }
      }
    }
  }

  /** Long grass along the bottom, black against the firelight. */
  private foreground() {
    const ink = nearest(6, 8, 14);
    for (let x = 0; x < W; x++) {
      const bank = Math.floor(H - 16 + 10 * fbm(x / 50, 7.5, 3, 30));
      const put = (xx: number, y: number) => {
        if (xx < 0 || xx >= W || y < 0 || y >= H) return;
        this.base[y * W + xx] = ink;
        this.kind[y * W + xx] = SKY;
      };
      for (let y = bank; y < H; y++) put(x, y);
      if (hash(x, 0, 32) < 0.55) {
        const tall = 3 + Math.floor(hash(x, 1, 32) * 10);
        for (let k = 0; k < tall; k++) put(x + Math.round(k * (hash(x, 2, 32) - 0.5) * 0.7), bank - k);
      }
    }
  }

  /**
   * The line about the feast, right of the payday card (which is bigger by touch). One row sits under the fire; a line
   * that needs more goes up into the sky, where the rows cover nobody. It breaks at a comma if it can.
   */
  private write(line: string) {
    const touching = bigLettering();
    const size = lettered(16);
    const [centre, room] = touching ? [690, 440] : [626, 604];
    const width = (text: string) => textMask(text, size).width;
    const fits = (rows: string[]) => rows.every((row) => width(row) <= room);
    let rows = [line];
    if (!fits(rows)) {
      const atCommas = [...line.matchAll(/, /g)].map((m) => [line.slice(0, m.index! + 1), line.slice(m.index! + 2)]).filter(fits);
      const widest = (r: string[]) => Math.max(...r.map(width));
      rows = atCommas.length ? atCommas.reduce((a, b) => (widest(a) <= widest(b) ? a : b)) : [];
      if (!rows.length) {
        for (const word of line.split(' ')) {
          const last = rows.at(-1);
          if (last && width(`${last} ${word}`) <= room) rows[rows.length - 1] = `${last} ${word}`;
          else rows.push(word);
        }
      }
    }
    const top = rows.length === 1 ? H - 24 - (size - 16) : 14;
    rows.forEach((row, k) => drawOutlined(this.words, row, centre, top + k * (size + 4), PARCHMENT[6], INK, size));
  }

  /** The feast at `time` seconds. */
  draw(time: number): Bitmap {
    const out = this.screen.data;
    out.set(this.frame);
    const { base, kind, light, grain } = this;
    const { ground: onGround, things: onThings, trees: onTrees } = lightTables();
    const f = flicker(time);
    for (let y = 0; y < H; y++) {
      let o = (MAP_VIEW.y + y) * SCREEN.width + MAP_VIEW.x;
      for (let x = 0, i = y * W; x < W; x++, i++, o++) {
        const k = kind[i];
        if (k === SKY) {
          out[o] = base[i];
          continue;
        }
        let level = Math.round((light[i] * f + grain[i]) * STEP);
        if (level < 0) level = 0;
        else if (level >= LEVELS) level = LEVELS - 1;
        out[o] = (k === GROUND ? onGround : k === THING ? onThings : onTrees)[level * 256 + base[i]];
      }
    }
    const set = (x: number, y: number, c: number) => {
      if (x >= 0 && y >= 0 && x < W && y < H) out[(MAP_VIEW.y + y) * SCREEN.width + MAP_VIEW.x + x] = c;
    };
    this.drawSky(time, set);
    this.drawSmoke(time, set);
    this.drawFlames(time, f, set);
    if (this.spit) this.drawLit(this.spit.sprite, this.spit.x, this.spit.y, false, f, set);
    if (this.dancer) {
      const { sprite, x, y } = this.dancer;
      const jig = Math.floor(time / 0.36) % 2 === 1;
      this.drawLit(sprite, Math.round(x - sprite.width / 2), y - sprite.height - (jig ? 2 : 0), jig, f, set);
    }
    this.drawSparks(time, set);
    // The King's gold catches the firelight.
    const beat = Math.floor(time * 11);
    this.glints.forEach((p, k) => {
      if (hash(k, beat, 404) >= 0.05) return;
      const [x, y] = [p % W, Math.floor(p / W)];
      set(x, y, PARCHMENT[6]);
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) set(x + ox, y + oy, GOLD[6]);
    });
    const words = this.words.data;
    for (let i = 0; i < N; i++) if (words[i]) set(i % W, Math.floor(i / W), words[i]);
    blit(this.screen, this.overlay, 0, 0);
    return this.screen;
  }

  /** Stars that twinkle, and fireflies at the edge of the wood. */
  private drawSky(time: number, set: (x: number, y: number, c: number) => void) {
    for (const star of this.stars) {
      if (this.kind[star.y * W + star.x] !== SKY) continue;
      const bright = star.twinkles ? star.bright * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (0.7 * time + star.phase)))) : star.bright;
      if (bright < 0.3) continue;
      set(star.x, star.y, bright > 0.8 ? NEUTRAL[7] : bright > 0.55 ? NEUTRAL[5] : NEUTRAL[3]);
      if (bright > 0.85 && !star.twinkles) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) set(star.x + ox, star.y + oy, NEUTRAL[2]);
    }
    for (let k = 0; k < 22; k++) {
      const x = Math.floor(40 + hash(k, 1, 81) * (W - 80));
      if (Math.abs(x - FEAST_FLAME.x) < 150) continue;
      const y = Math.floor(FEAST_HORIZON + 4 + hash(k, 2, 81) * 90 + 3 * Math.sin(2 * Math.PI * (0.5 * time + hash(k, 3, 81))));
      if ((0.5 * time + hash(k, 4, 81)) % 1 >= 0.45) continue;
      set(x, y, LEAF[8]);
      set(x + 1, y, this.glow);
    }
  }

  /** Smoke rising from the fire and drifting off to the right, thinning as it goes. */
  private drawSmoke(time: number, set: (x: number, y: number, c: number) => void) {
    const top = FEAST_FLAME.y - 30;
    for (let rise = 1; rise < 190; rise++) {
      const y = top - rise;
      const cx = FEAST_FLAME.x + 0.0022 * rise * rise + 0.12 * rise + 4 * Math.sin((y + 22 * time) / 13);
      const half = 5 + 0.16 * rise;
      const share = 0.3 * (1 - rise / 190);
      for (let x = Math.floor(cx - half); x <= cx + half; x++) {
        if (hash(x, y, 61) >= share) continue;
        if (fbm(x / 9, (y + 22 * time) / 9, 3, 61) > 0.5) set(x, y, this.smoke);
      }
    }
  }

  /** The flames: a heat field that licks upward, drawn behind the logs, white at the heart and red at the tips. */
  private drawFlames(time: number, f: number, set: (x: number, y: number, c: number) => void) {
    if (!this.fire) return;
    const { sprite, x: fx, y: fy } = this.fire;
    const t = time / 1.44;
    const phase = 2 * Math.PI * t;
    const foot = FEAST_FIRE.y - 22;
    for (let y = foot - 62; y < FEAST_FIRE.y; y++) {
      const above = foot - y;
      for (let x = FEAST_FIRE.x - 34; x <= FEAST_FIRE.x + 34; x++) {
        const [u, v] = [x - fx, y - fy];
        if (u >= 0 && v >= 0 && u < sprite.width && v < sprite.height && sprite.data[v * sprite.width + u]) continue;
        const across = x - FEAST_FIRE.x;
        const height = 58 * Math.max(0, 1 - (across / 19) ** 2) ** 0.6 * (0.82 + 0.22 * (0.5 * Math.sin(across / 3 + phase * 2) + 0.5 * Math.sin(across / 5.3 - phase * 3)));
        if (height <= 0 || above < -2) continue;
        const heat = ((height - above) / Math.max(1, height) * 1.08 + (noise(x / 3.2, (y + 46 * t) / 3.6, 70) - 0.5) * 0.55) * f;
        const jitter = (hash(x, y, 71) - 0.5) * 0.06;
        const flame = FLAMES.find(([from]) => heat > from + jitter);
        if (flame) set(x, y, flame[1]);
      }
    }
  }

  /** A sprite in the fire's light, worked out as it's drawn (the roast over the flames, the dancer). */
  private drawLit(sprite: Bitmap, x0: number, y0: number, flip: boolean, f: number, set: (x: number, y: number, c: number) => void) {
    const { things } = lightTables();
    for (let j = 0; j < sprite.height; j++) {
      for (let i = 0; i < sprite.width; i++) {
        const v = at(sprite, i, j, flip);
        if (v === 0 || v === SHADOW) continue;
        const [x, y] = [x0 + i, y0 + j];
        let level = Math.round((reach(Math.hypot(x - FEAST_FLAME.x, y - FEAST_FLAME.y)) * f + this.grain[Math.max(0, Math.min(N - 1, y * W + x))]) * STEP);
        level = Math.max(0, Math.min(LEVELS - 1, level));
        set(x, y, things[level * 256 + v]);
      }
    }
  }

  /** Sparks flying up off the fire and going out. */
  private drawSparks(time: number, set: (x: number, y: number, c: number) => void) {
    for (let k = 0; k < 16; k++) {
      const phase = hash(k, 1, 41);
      const life = (time * 0.7 * (1 + (k % 2)) + phase) % 1;
      if (life >= 0.85) continue;
      const y = FEAST_FLAME.y - 18 - life * (80 + 40 * hash(k, 2, 41));
      const x = FEAST_FLAME.x + (hash(k, 3, 41) - 0.5) * 22 + Math.sin(2 * Math.PI * (life * 1.5 + phase)) * 4 + life * 16;
      set(Math.floor(x), Math.floor(y), life < 0.4 ? GOLD[6] : RED[5]);
    }
  }
}
