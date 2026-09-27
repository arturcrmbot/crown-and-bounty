import { Bitmap, blit, SHADOW } from './bitmap';
import { BAR, MAP_VIEW, paintFrame, SCREEN } from './frame';
import { fbm, hash, noise, shade } from './noise';
import { BLUE, DIRT, GOLD, GRASS, INK, LEAF, PARCHMENT, PINE, PLUM, RED, REED, STONE, WOOD } from './palette';
import { castle, hero, oak, pine } from './sprites';
import { drawText, textMask } from './text';

const W = MAP_VIEW.width;
const H = MAP_VIEW.height;
/** Where the far land meets the sky, and the setting sun just above it, in painting pixels. */
const HORIZON = 262;
const SUN = { x: 176, y: 226, r: 19 };

/** Sunset, from the deep blue overhead down to the gold at the horizon. */
const SKY = [BLUE[0], BLUE[1], BLUE[2], PLUM[2], PLUM[3], PLUM[4], RED[5], RED[6], GOLD[5], GOLD[6]];
const CLOUD = [PLUM[0], PLUM[1], PLUM[2], PLUM[3], PLUM[4], RED[5], RED[6], GOLD[5], GOLD[6]];
const HAZE = [PLUM[1], PLUM[2], PLUM[3], PLUM[4], RED[5]];
const WATER_GLOW = [PLUM[1], PLUM[2], PLUM[3], PLUM[4], RED[5], RED[6], GOLD[5], GOLD[6]];

const smooth = (t: number) => t * t * (3 - 2 * t);
const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** How much the setting sun lights a point of sky: 1 at the sun, fading out across the sky. */
const glowAt = (x: number, y: number) => Math.exp(-((Math.hypot(x - SUN.x, (y - SUN.y) * 1.7) / 300) ** 2));
const skyLevel = (x: number, y: number) => 0.14 + 0.42 * (Math.max(0, y) / HORIZON) ** 1.6 + 0.5 * glowAt(x, y);
/** Water holds the sky above the far bank: gold under the sun, rose and lilac further off. */
const waterLevel = (x: number, y: number) => 0.2 + skyLevel(x, HORIZON - (y - HORIZON) * 0.8) * 0.8;

/** Value noise that wraps every `period` cells across, so a band of cloud can drift forever. */
function wrapNoise(x: number, y: number, period: number, seed: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const sx = smooth(x - ix);
  const sy = smooth(y - iy);
  const a = ((ix % period) + period) % period;
  const b = (a + 1) % period;
  const top = hash(a, iy, seed) + (hash(b, iy, seed) - hash(a, iy, seed)) * sx;
  const bottom = hash(a, iy + 1, seed) + (hash(b, iy + 1, seed) - hash(a, iy + 1, seed)) * sx;
  return top + (bottom - top) * sy;
}

const CLOUD_WIDTH = 1920;

/** A band of long sunset clouds. Each pixel keeps how lit it is (by its underside and sun side), or -1 for clear sky. */
type Clouds = { top: number; rows: number; speed: number; lit: Float32Array };

function clouds(top: number, bottom: number, seed: number, cover: number, speed: number): Clouds {
  const rows = bottom - top;
  const inside = new Uint8Array(CLOUD_WIDTH * rows);
  for (let j = 0; j < rows; j++) {
    const band = ((j - rows / 2) / (rows / 2)) ** 2;
    for (let x = 0; x < CLOUD_WIDTH; x++) {
      let v = 0;
      let amp = 0.5;
      for (let o = 0; o < 4; o++) {
        v += amp * wrapNoise(x / (160 >> o), (top + j) / (18 / 2 ** o), 12 << o, seed + o);
        amp /= 2;
      }
      if (v / 0.9375 + cover - 1 - 0.3 * band > 0) inside[j * CLOUD_WIDTH + x] = 1;
    }
  }
  const lit = new Float32Array(CLOUD_WIDTH * rows).fill(-1);
  // The sun is low: clouds catch it on their undersides, and a little on the side facing it.
  for (let x = 0; x < CLOUD_WIDTH; x++) {
    let run = 99;
    for (let j = rows - 1; j >= 0; j--) {
      const i = j * CLOUD_WIDTH + x;
      if (!inside[i]) {
        run = -1;
        continue;
      }
      run++;
      lit[i] = Math.max(0, 1 - run / 5);
    }
  }
  for (let j = 0; j < rows; j++) {
    let run = 99;
    for (let x = 0; x < CLOUD_WIDTH; x++) {
      const i = j * CLOUD_WIDTH + x;
      if (!inside[i]) {
        run = -1;
        continue;
      }
      run++;
      lit[i] = Math.max(lit[i], 0.7 * Math.max(0, 1 - run / 4));
    }
  }
  return { top, rows, speed, lit };
}

/** One row of hills or mountains across the painting: the height of its crest at every column. */
function ridge(seed: number, base: number, rise: number, scale: number, sharp: boolean): Float32Array {
  const crest = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const v = fbm(x / scale, 0.5, 4, seed);
    const shape = sharp ? (1 - Math.abs(v * 2 - 1)) ** 1.6 : v;
    crest[x] = base - rise * shape;
  }
  return crest;
}

/** Where the road runs, from the castle gate down to the bottom of the painting: its middle and half-width at a row. */
const ROAD_TOP = 318;
const roadAt = (y: number) => {
  const t = (y - ROAD_TOP) / (H - ROAD_TOP);
  return { x: 648 - t * 190 + Math.sin(t * 5.2) * 38 * t, half: 2 + t * 26 };
};

/** The river, from far off under the sun, across the valley and under the road: points along its middle. */
const RIVER: [number, number][] = [[118, 298], [190, 304], [280, 318], [380, 340], [480, 356], [590, 352], [700, 338], [800, 342], [880, 358], [960, 380]];

/** A point along the river (t from 0 to 1), smoothed through its points, and its half-width there. */
function riverAt(t: number) {
  const n = RIVER.length - 1;
  const k = Math.min(n - 1, Math.floor(t * n));
  const u = t * n - k;
  const p = (i: number) => RIVER[Math.max(0, Math.min(n, i))];
  const [p0, p1, p2, p3] = [p(k - 1), p(k), p(k + 1), p(k + 2)];
  const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u);
  const y = cr(p0[1], p1[1], p2[1], p3[1]);
  return { x: cr(p0[0], p1[0], p2[0], p3[0]), y, half: 1 + (y - 296) * 0.2 };
}

/**
 * A tree close to the viewer, with the sun low behind it: dark leaves in lumpy clumps, a trunk and
 * two boughs, and gold on the edges that face the sun.
 */
function bigTree(set: (x: number, y: number, c: number) => void, foot: number, ground: number, width: number, height: number, seed: number) {
  const top = ground - height;
  const blobs = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2 + hash(i, 0, seed) * 0.7;
    const spread = i === 0 ? 0 : 0.5 + hash(i, 1, seed) * 0.4;
    return { x: foot + Math.cos(a) * width * 0.34 * spread, y: top + height * 0.28 + Math.sin(a) * height * 0.16 * spread, r: width * (0.2 + hash(i, 2, seed) * 0.1) };
  });
  const leafy = (x: number, y: number) => {
    let best = 0;
    for (const b of blobs) best = Math.max(best, 1 - Math.hypot(x - b.x, (y - b.y) * 1.15) / b.r);
    return best + (noise(x / 9, y / 8, seed) - 0.5) * 0.5 + (noise(x / 3.5, y / 3, seed + 1) - 0.5) * 0.22;
  };
  // Trunk and boughs first; the leaves go over them.
  const trunkTop = top + height * 0.36;
  for (let y = Math.floor(trunkTop); y < ground; y++) {
    const t = (y - trunkTop) / (ground - trunkTop);
    const half = 6 + t * 5 + (t > 0.85 ? (t - 0.85) * 60 : 0);
    const cx = foot + Math.sin(t * 2.4 + seed) * 5;
    for (let x = Math.floor(cx - half); x <= cx + half; x++) {
      const u = (x - cx) / half;
      set(x, y, u < -0.8 ? GOLD[2] : shade(WOOD, 0.34 - u * 0.2 + (noise(x / 2, y / 7, seed + 2) - 0.5) * 0.3, x, y));
    }
  }
  for (const side of [-1, 1]) {
    for (let k = 0; k < 60; k++) {
      const t = k / 60;
      const x = foot + side * t * width * 0.36;
      const y = trunkTop + 30 - t * 44 + t * t * 14;
      const r = 4 - t * 2.5;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) set(Math.round(x + dx), Math.round(y + dy), shade(WOOD, 0.3 - dy * 0.03, x + dx, y + dy));
    }
  }
  for (let y = Math.floor(top - 10); y < trunkTop + 40; y++) {
    for (let x = Math.floor(foot - width * 0.75); x <= foot + width * 0.75; x++) {
      const v = leafy(x, y);
      if (v <= 0.05) continue;
      // Lit from the sun's side, on the edges and the tops of the clumps.
      const rim = leafy(x - 2, y - 1) <= 0.05 && leafy(x + 2, y) > 0.05;
      const clumpTop = leafy(x - 1, y - 2) < v - 0.1;
      set(x, y, rim ? (hash(x, y, seed) < 0.6 ? GOLD[4] : REED[4]) : shade(LEAF, 0.06 + v * 0.2 + (clumpTop ? 0.16 : 0) + (hash(x, y, seed + 4) - 0.5) * 0.1, x, y));
    }
  }
}

/**
 * The title painting: a sunset over the King's country. Far lilac mountains, the castle on its
 * hill, a patchwork of fields with a road and a river through them, and the hero setting out.
 */
export class TitleScreen {
  readonly screen = new Bitmap(SCREEN.width, SCREEN.height);
  private readonly base: Bitmap;
  private readonly overlay: Bitmap;
  private readonly sky = new Uint8Array(W * H);
  private readonly glow = new Float32Array(W * HORIZON);
  private readonly layers = [clouds(34, 124, 7, 0.4, 1.2), clouds(118, 236, 19, 0.44, 2.6)];
  private water: number[] = [];
  private readonly castles = Array.from({ length: 8 }, (_, i) => castle(i / 8));
  private readonly heroes = Array.from({ length: 8 }, (_, i) => hero((i / 8) * Math.PI, false, false));
  private readonly logo: Bitmap;

  constructor() {
    const { frame, overlay } = paintFrame();
    this.overlay = overlay;
    const b = new Bitmap(SCREEN.width, SCREEN.height);
    b.data.set(frame.data);
    const set = (x: number, y: number, c: number) => {
      if (x >= 0 && y >= 0 && x < W && y < H) b.set(MAP_VIEW.x + x, MAP_VIEW.y + y, c);
    };

    // Sky and sun.
    for (let y = 0; y < HORIZON + 40; y++) {
      for (let x = 0; x < W; x++) {
        if (y < HORIZON) this.glow[y * W + x] = glowAt(x, y);
        const d = Math.hypot(x - SUN.x, y - SUN.y);
        set(x, y, d < SUN.r ? (d < SUN.r - 3 ? GOLD[6] : GOLD[5]) : shade(SKY, skyLevel(x, y), x, y));
        this.sky[y * W + x] = 1;
      }
    }

    // Far mountains in the haze, lit from the sun's side.
    const far = ridge(3, HORIZON + 4, 74, 150, true);
    for (let x = 0; x < W; x++) far[x] = Math.max(far[x], far[x] + 46 * Math.exp(-(((x - SUN.x) / 70) ** 2)));
    for (let x = 0; x < W; x++) far[x] = Math.min(far[x], HORIZON - 6 + 10 * Math.exp(-(((x - SUN.x) / 60) ** 2)));
    for (let x = 0; x < W; x++) {
      const light = clamp01(0.5 + (far[Math.max(0, x - 10)] - far[Math.min(W - 1, x + 10)]) * 0.03);
      for (let y = Math.floor(far[x]); y < HORIZON + 40; y++) {
        const depth = (y - far[x]) / (HORIZON + 40 - far[x]);
        set(x, y, shade(HAZE, 0.32 + light * 0.2 + depth * 0.25 + glowAt(x, y) * 0.38 + (noise(x / 14, y / 6, 13) - 0.5) * 0.1, x, y));
        this.sky[y * W + x] = 0;
      }
    }

    // Nearer hills, one of them for the castle.
    const hills = ridge(11, HORIZON + 34, 34, 120, false);
    for (let x = 0; x < W; x++) hills[x] -= 30 * Math.exp(-(((x - 648) / 96) ** 2));
    for (let x = 0; x < W; x++) {
      const light = clamp01(0.5 + (hills[Math.max(0, x - 2)] - hills[Math.min(W - 1, x + 2)]) * 0.25);
      for (let y = Math.floor(hills[x]); y < H; y++) {
        const depth = clamp01((y - hills[x]) / 40);
        set(x, y, shade(PINE, 0.28 + light * 0.34 + (1 - depth) * 0.12 + glowAt(x, y) * 0.3 + (noise(x / 5, y / 3, 12) - 0.5) * 0.12, x, y));
        this.sky[y * W + x] = 0;
      }
    }

    // A patchwork of fields in perspective, with hedges between them.
    const FIELDS_TOP = 306;
    const fieldColour = (x: number, y: number) => {
      const z = 900 / (y - HORIZON + 6);
      const gx = ((x - W / 2) * z) / 380 + 40;
      const cx = Math.floor(gx / 3.2 + hash(Math.floor(z / 2.4), 0, 5) * 3);
      const cz = Math.floor(z / 2.4);
      const fx = gx / 3.2 + hash(cz, 0, 5) * 3 - cx;
      const fz = z / 2.4 - cz;
      const hedgeX = Math.min(fx, 1 - fx) * ((3.2 * 380) / z);
      const hedgeZ = Math.min(fz, 1 - fz) * ((2.4 * 900) / (z * z)) * 2.4;
      const lit = 0.52 + glowAt(x, y - 60) * 0.3 + (noise(x / 7, y / 4, 21) - 0.5) * 0.12;
      if (hedgeX < 1.2 || hedgeZ < 0.9) return shade(LEAF, lit * 0.55, x, y);
      const kind = hash(cx, cz, 9);
      if (kind < 0.42) return shade(GRASS, lit, x, y);
      if (kind < 0.66) return shade(REED, lit + 0.1, x, y);
      if (kind < 0.8) return shade(DIRT, lit * 0.9 + (Math.floor(fx * 9) % 2) * 0.08, x, y);
      return shade(GRASS, lit - 0.2, x, y);
    };
    const land = new Float32Array(W);
    for (let x = 0; x < W; x++) land[x] = FIELDS_TOP + 6 * fbm(x / 90, 3.5, 3, 4);
    for (let x = 0; x < W; x++) for (let y = Math.floor(land[x]); y < H; y++) set(x, y, fieldColour(x, y));

    // The road, down from the castle gate.
    for (let y = ROAD_TOP; y < H; y++) {
      const { x: rx, half } = roadAt(y);
      for (let x = Math.floor(rx - half - 1); x <= rx + half + 1; x++) {
        const u = (x - rx) / half;
        if (Math.abs(u) > 1.05) continue;
        const rut = Math.abs(Math.abs(u) - 0.45) < 0.08 && half > 8 ? -0.12 : 0;
        set(x, y, Math.abs(u) > 0.92 ? DIRT[2] : shade(DIRT, 0.62 - u * 0.12 + rut + (hash(x, y, 3) - 0.5) * 0.1 + glowAt(x, y - 80) * 0.15, x, y));
      }
    }

    // The river: it holds the sky, so it's gold on the sun's side. Its pixels are kept, to shimmer.
    const wet = new Uint8Array(W * H);
    for (let k = 0; k <= 4000; k++) {
      const { x: rx, y: ry, half } = riverAt(k / 4000);
      for (let y = Math.floor(ry - half * 0.5 - 2); y <= ry + half * 0.5 + 2; y++) {
        for (let x = Math.floor(rx - half * 1.6 - 2); x <= rx + half * 1.6 + 2; x++) {
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          if (inEllipse(x, y, rx, ry, half * 1.6, half * 0.5)) wet[y * W + x] = 2;
          else if (!wet[y * W + x] && inEllipse(x, y, rx, ry + 1, half * 1.6 + 1.5, half * 0.5 + 1.5)) wet[y * W + x] = 1;
        }
      }
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const w = wet[y * W + x];
        if (w === 1) set(x, y, shade(DIRT, 0.28, x, y));
        else if (w === 2) this.water.push(MAP_VIEW.x + x + (MAP_VIEW.y + y) * SCREEN.width);
      }
    }
    for (const i of this.water) {
      const x = (i % SCREEN.width) - MAP_VIEW.x;
      const y = Math.floor(i / SCREEN.width) - MAP_VIEW.y;
      const farBank = wet[(y - 1) * W + x] !== 2;
      b.data[i] = farBank ? GOLD[5] : shade(WATER_GLOW, waterLevel(x, y), x, y);
    }
    // A stone bridge carries the road over it.
    const bridged = new Set<number>();
    for (let y = ROAD_TOP; y < H; y++) {
      const road = roadAt(y);
      for (let x = Math.floor(road.x - road.half - 3); x <= road.x + road.half + 3; x++) {
        if (x < 0 || x >= W) continue;
        const near = [0, -3, 3, -6, 6].some((d) => wet[(y + d) * W + x] === 2);
        if (!near) continue;
        const edge = Math.abs(x - road.x) > road.half;
        set(x, y, edge ? shade(STONE, 0.72 - (x - road.x) / 60, x, y) : shade(DIRT, 0.6 + (hash(x, y, 4) - 0.5) * 0.1, x, y));
        bridged.add(y * W + x);
      }
    }
    for (const k of bridged) {
      const x = k % W;
      const y = Math.floor(k / W);
      if (!bridged.has(k + W) && wet[k + W]) {
        set(x, y + 1, STONE[1]);
        set(x, y + 2, INK);
      }
    }
    this.water = this.water.filter((i) => !bridged.has((i % SCREEN.width) - MAP_VIEW.x + (Math.floor(i / SCREEN.width) - MAP_VIEW.y) * W));

    // Trees along the hedges and the far hills, smaller with distance.
    const trees: { x: number; y: number; sprite: Bitmap }[] = [];
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(hash(i, 1, 41) * W);
      const y = Math.floor(FIELDS_TOP - 4 + hash(i, 2, 41) ** 1.6 * 120);
      if (Math.abs(x - roadAt(y).x) < roadAt(y).half + 10 || wet[Math.min(H - 1, y + 2) * W + x] || wet[y * W + x]) continue;
      if (Math.abs(x - 648) < 90 && y < 330) continue;
      const size = Math.round(10 + ((y - FIELDS_TOP) / 120) * 18);
      trees.push({ x, y, sprite: hash(i, 3, 41) < 0.35 ? pine(i, size + 4) : oak(i, size) });
    }
    trees.sort((a, c) => a.y - c.y);
    for (const t of trees) blit(b, t.sprite, MAP_VIEW.x + t.x - t.sprite.width / 2, MAP_VIEW.y + t.y - t.sprite.height + 6);

    // Foreground: a dark bank of long grass along the bottom, catching the last light on its tips.
    for (let x = 0; x < W; x++) {
      const bank = H - 34 + 16 * fbm(x / 70, 8.5, 3, 30) - (x < 170 ? (170 - x) * 0.35 : 0) - (x > 780 ? (x - 780) * 0.3 : 0);
      for (let y = Math.floor(bank); y < H; y++) {
        const road2 = roadAt(y);
        if (Math.abs(x - road2.x) < road2.half - 4) continue;
        set(x, y, shade(LEAF, 0.18 + (noise(x / 3, y / 9, 31) - 0.5) * 0.3 - (y - bank) * 0.004, x, y));
      }
      if (hash(x, 0, 32) < 0.5) {
        const tall = 3 + Math.floor(hash(x, 1, 32) * 7);
        for (let k = 0; k < tall; k++) set(x + Math.round(k * (hash(x, 2, 32) - 0.5) * 0.6), Math.floor(bank) - k, k === tall - 1 ? GOLD[4] : shade(LEAF, 0.35 + k * 0.04, x, bank - k));
      }
    }

    // Big trees at the edges frame the view.
    bigTree(set, 26, H + 4, 150, 230, 5);
    bigTree(set, 918, H + 4, 132, 250, 8);

    this.logo = this.paintLogo(textMask('KING\u2019S COMMISSION', 58, 3));
    drawText(b, 'A tribute to King\u2019s Bounty (1990) and Heroes of Might and Magic II \u00b7 every picture and note made in code', BAR.x + 12, BAR.y + 5, PARCHMENT[6], INK);
    this.base = b;
  }

  /** The name, in beaten gold with a dark rim and a long shadow, as a sprite to lay over the clouds. */
  private paintLogo(mask: ReturnType<typeof textMask>): Bitmap {
    const { width, height, solid } = mask;
    const pad = 3;
    const sprite = new Bitmap(width + pad * 2 + 5, height + pad * 2 + 5);
    const near = (i: number, j: number, r: number) => {
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (Math.abs(di) + Math.abs(dj) <= r + 1 && solid(i + di, j + dj)) return true;
      return false;
    };
    for (let j = -pad; j < height + pad + 5; j++) {
      for (let i = -pad; i < width + pad + 5; i++) {
        const x = i + pad;
        const y = j + pad;
        if (solid(i, j)) {
          const top = !solid(i, j - 1) || !solid(i, j - 2);
          const level = top ? 1 : 0.95 - (j / height) * 0.75 + (solid(i - 1, j - 1) ? 0 : 0.1);
          sprite.set(x, y, shade(GOLD, level, x, y));
        } else if (near(i, j, 2)) sprite.set(x, y, near(i, j, 1) ? WOOD[0] : INK);
        else if (near(i - 4, j - 4, 2)) sprite.set(x, y, SHADOW);
      }
    }
    return sprite;
  }

  draw(time: number): Bitmap {
    const s = this.screen;
    s.data.set(this.base.data);
    // Clouds drift over the sky (never over the land or the name).
    for (const layer of this.layers) {
      const offset = Math.floor(time * layer.speed);
      for (let j = 0; j < layer.rows; j++) {
        const y = layer.top + j;
        const row = j * CLOUD_WIDTH;
        for (let x = 0; x < W; x++) {
          if (!this.sky[y * W + x]) continue;
          const lit = layer.lit[row + ((((x - offset) % CLOUD_WIDTH) + CLOUD_WIDTH) % CLOUD_WIDTH)];
          if (lit < 0) continue;
          const glow = this.glow[y * W + x];
          const i = MAP_VIEW.x + x + (MAP_VIEW.y + y) * SCREEN.width;
          s.data[i] = shade(CLOUD, 0.16 + glow * 0.34 + (y / HORIZON) * 0.14 + lit * (0.22 + glow * 0.4), x, y);
        }
      }
    }
    // Rooks on their way home.
    for (let k = 0; k < 5; k++) {
      const x = Math.floor(((time * (9 + k * 2) + k * 211) % (W + 80)) - 40);
      const y = Math.floor(150 + k * 13 + Math.sin(time * 0.7 + k) * 5);
      const up = Math.sin(time * 9 + k * 2) > 0;
      for (const [dx, dy] of up ? [[-2, -1], [-1, 0], [0, 0], [1, 0], [2, -1]] : [[-2, 1], [-1, 0], [0, 0], [1, 0], [2, 1]]) s.set(MAP_VIEW.x + x + dx, MAP_VIEW.y + y + dy, PLUM[0]);
    }
    // The river shimmers with the sunset.
    for (const i of this.water) {
      const x = (i % SCREEN.width) - MAP_VIEW.x;
      const y = Math.floor(i / SCREEN.width) - MAP_VIEW.y;
      const dash = hash(Math.floor((x + time * (y % 2 ? 7 : -5)) / 5), y, 17);
      if (dash > 0.86 && s.data[i] !== GOLD[5]) s.data[i] = shade(WATER_GLOW, waterLevel(x, y) + 0.24, x, y);
    }
    const phase = Math.floor(time * 6) % 8;
    const keep = this.castles[phase];
    blit(s, keep, MAP_VIEW.x + 648 - keep.width / 2, MAP_VIEW.y + ROAD_TOP - keep.height + 16);
    const rider = this.heroes[Math.floor(time * 3) % 8];
    const at = roadAt(H - 40);
    blit(s, rider, MAP_VIEW.x + Math.round(at.x) - rider.width / 2, MAP_VIEW.y + H - 40 - rider.height + 8);
    blit(s, this.logo, MAP_VIEW.x + Math.round((W - this.logo.width) / 2), MAP_VIEW.y + 18);
    blit(s, this.overlay, 0, 0);
    return s;
  }
}
