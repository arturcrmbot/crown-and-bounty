import type { Bitmap } from './bitmap';
import { SCREEN, type Rect } from './frame';
import { hash } from './noise';
import { EVENING_LUT, GOLD, LEAF, MIST_LUT, MORNING_LUT, NEUTRAL, NIGHT_LUT, PLUM, RAIN_LUT, SHADOW_LUT, STONE, WATER } from './palette';
import type { Point } from '../rules/map/geometry';

/** What the sky is doing over the map right now. Everything here comes from the clock and the state, never dice, so a frozen screenshot is always the same. */
export type Sky = {
  /** How far through the day the hero is: 0 fresh in the morning, 1 with his movement spent. */
  day: number;
  /** Seconds of clock, stopped when frozen. */
  time: number;
  /** How far night has come, 0 to 1: fireflies come out. */
  night: number;
  /** Mist over the fen, 0 to 1. */
  mist: number;
  /** A passing shower, 0 to 1. */
  rain: number;
  /** Wind in the heather, 0 to 1: petals and leaves blown across. */
  wind: number;
};

export const CLEAR: Sky = { day: 0.4, time: 0, night: 0, mist: 0, rain: 0, wind: 0 };

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How much of the map the night's blue covers when the day's riding is done. */
const NIGHT = 0.55;

/**
 * How much of the map each of the day's lights covers, by how far through the day the hero is: a
 * fresh morning that clears as he rides, then nothing but the day itself, a golden evening as his
 * movement runs out, and a blue night when it's spent.
 */
export function daylight(day: number): { morning: number; evening: number; night: number } {
  const morning = day < 0.12 ? (1 - day / 0.12) * 0.3 : 0;
  const evening = day < 0.5 ? 0 : day < 0.82 ? smooth(0.5, 0.82, day) * 0.34 : 0.34 * (1 - smooth(0.82, 1, day));
  const night = day < 0.82 ? 0 : smooth(0.82, 1, day) * NIGHT;
  return { morning, evening, night };
}

/** A mist that tiles: long, soft bands from a handful of waves, made once. */
const MIST_W = 512;
const MIST_H = 256;
let mistField: Float32Array | null = null;
function mistAt(x: number, y: number): number {
  if (!mistField) {
    mistField = new Float32Array(MIST_W * MIST_H);
    const waves = [
      [1, 1, 0.26, 0.2], [2, -1, 0.2, 1.7], [3, 2, 0.14, 4.1], [-2, 3, 0.12, 2.3], [5, -3, 0.08, 5.5], [9, 5, 0.05, 0.9], [13, -7, 0.03, 3.3],
    ];
    for (let j = 0; j < MIST_H; j++) {
      for (let i = 0; i < MIST_W; i++) {
        let v = 0;
        for (const [fx, fy, a, p] of waves) v += a * Math.sin(2 * Math.PI * ((fx * i) / MIST_W + (fy * j) / MIST_H) + p);
        mistField[j * MIST_W + i] = 0.5 + v;
      }
    }
  }
  return mistField[(((y % MIST_H) + MIST_H) % MIST_H) * MIST_W + (((x % MIST_W) + MIST_W) % MIST_W)];
}

const frac = (v: number) => v - Math.floor(v);

/**
 * The weather over the map, drawn in three layers: smoke that rises from chimneys into the world,
 * the light of the day and the fen's mist over all of it, and what falls or flies in front: rain,
 * petals on the wind and fireflies, which glow in their own light.
 */
export class Weather {
  private readonly chimneys: Point[];
  private readonly glades: Point[];

  /** `chimneys` smoke all day; fireflies come out at night over `glades`. */
  constructor(chimneys: Point[], glades: Point[]) {
    this.chimneys = chimneys;
    this.glades = glades;
  }

  /** Smoke from the chimneys, in the world: `ox, oy` is where map point (0, 0) lands on screen. */
  drawSmoke(screen: Bitmap, ox: number, oy: number, clip: Rect, sky: Sky, visible: (x: number, y: number) => boolean) {
    const drift = 8 + sky.wind * 14;
    this.chimneys.forEach(([cx, cy], c) => {
      if (!visible(cx, cy)) return;
      for (let k = 0; k < 7; k++) {
        const age = frac(sky.time * 0.11 + k / 7 + hash(c, 3, 71));
        const px = ox + cx + age * drift + Math.sin(age * 5 + c) * 2;
        const py = oy + cy - age * 34;
        const r = 1 + age * 3.4;
        for (let y = Math.floor(py - r); y <= py + r; y++) {
          for (let x = Math.floor(px - r); x <= px + r; x++) {
            if (x < clip.x || y < clip.y || x >= clip.x + clip.width || y >= clip.y + clip.height) continue;
            const d = Math.hypot(x - px, (y - py) * 1.15) / r;
            if (d > 1 || BAYER[(x & 3) + ((y & 3) << 2)] < age * 0.95) continue;
            screen.data[y * SCREEN.width + x] = d > 0.55 ? STONE[4] : NEUTRAL[5 + (k & 1)];
          }
        }
      }
    });
  }

  /**
   * The day's light, a shower's grey and the fen's mist, laid over the map's `view`. `camera` is where
   * the view looks on the map. The light falls on the land the hero knows and on whatever stands on
   * it, never on the fog: `veil` holds, for each screen pixel, the fog's colour there plus one (0
   * where there's no fog), and a pixel still that colour is fog, whatever the hour.
   */
  light(screen: Bitmap, sky: Sky, camera: { x: number; y: number }, view: Rect, veil?: Uint16Array) {
    const { morning, evening, night } = daylight(sky.day);
    const rain = sky.rain * 0.4;
    const mist = sky.mist;
    if (morning + evening + night + rain + mist <= 0) return;
    const data = screen.data;
    // The mist drifts slowly, and a little apart from the land under it.
    const mx = Math.round(camera.x * 0.85 + sky.time * 4);
    const my = Math.round(camera.y * 0.85);
    for (let y = view.y; y < view.y + view.height; y++) {
      const row = (y & 3) << 2;
      const rowRain = ((y + 1) & 3) << 2;
      let o = y * SCREEN.width + view.x;
      for (let x = view.x; x < view.x + view.width; x++, o++) {
        let c = data[o];
        const d = BAYER[(x & 3) + row];
        if (veil && veil[o] === c + 1) {
          // The fog takes no colour from the day, and darkens as night falls, so the land he knows is always the lit part.
          if (d < night / NIGHT) data[o] = SHADOW_LUT[c];
          continue;
        }
        if (d < night) c = NIGHT_LUT[c];
        else if (d < night + evening) c = EVENING_LUT[c];
        else if (d < morning) c = MORNING_LUT[c];
        if (rain > 0 && BAYER[((x + 2) & 3) + rowRain] < rain) c = RAIN_LUT[c];
        if (mist > 0 && BAYER[((x + 1) & 3) + (((y + 2) & 3) << 2)] < smooth(0.3, 1, mistAt(x + mx, y + my)) * mist) c = MIST_LUT[c];
        data[o] = c;
      }
    }
  }

  /** In front of it all, in their own light: rain across the view, petals on the wind, and fireflies at night. */
  drawAir(screen: Bitmap, ox: number, oy: number, clip: Rect, sky: Sky, visible: (x: number, y: number) => boolean) {
    const put = (x: number, y: number, c: number) => {
      if (x >= clip.x && y >= clip.y && x < clip.x + clip.width && y < clip.y + clip.height) screen.data[y * SCREEN.width + x] = c;
    };
    if (sky.rain > 0) {
      const drops = Math.round(sky.rain * 150);
      for (let i = 0; i < drops; i++) {
        const fall = frac(hash(i, 1, 83) + sky.time * (1.2 + hash(i, 2, 83) * 0.5));
        const y = clip.y - 8 + fall * (clip.height + 16);
        const x = clip.x - 40 + hash(i, 0, 83) * (clip.width + 60) + (y - clip.y) * 0.22;
        for (let k = 0; k < 5; k++) put(Math.round(x + k * 0.22), Math.round(y + k), k < 2 ? WATER[8] : NEUTRAL[6]);
      }
    }
    if (sky.wind > 0 && sky.night < 0.5) {
      const petals = Math.round(sky.wind * 12);
      for (let i = 0; i < petals; i++) {
        const along = frac(hash(i, 4, 89) + sky.time * (0.05 + hash(i, 5, 89) * 0.04));
        const x = clip.x + along * clip.width;
        const y = clip.y + hash(i, 6, 89) * clip.height + Math.sin(sky.time * 1.4 + i * 2.1) * 7;
        const colour = i % 3 === 0 ? LEAF[7] : i % 3 === 1 ? PLUM[4] : PLUM[3];
        put(Math.round(x), Math.round(y), colour);
        if (Math.sin(sky.time * 6 + i) > 0) put(Math.round(x) + 1, Math.round(y), colour);
      }
    }
    if (sky.night > 0.3) {
      const count = Math.round(((sky.night - 0.3) / 0.7) * 2 + 0.5);
      this.glades.forEach(([gx, gy], g) => {
        const sx = ox + gx;
        const sy = oy + gy;
        if (sx < clip.x - 30 || sy < clip.y - 30 || sx > clip.x + clip.width + 30 || sy > clip.y + clip.height + 30 || !visible(gx, gy)) return;
        for (let k = 0; k < count; k++) {
          const seed = g * 3 + k;
          const blink = Math.sin(sky.time * (1.6 + hash(seed, 7, 97)) + hash(seed, 8, 97) * 6.3);
          if (blink < 0.25) continue;
          const x = Math.round(sx + Math.sin(sky.time * 0.5 + seed) * 16 + (hash(seed, 9, 97) - 0.5) * 20);
          const y = Math.round(sy - 6 + Math.cos(sky.time * 0.37 + seed * 1.7) * 9);
          put(x, y, GOLD[6]);
          if (blink > 0.7) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(x + dx, y + dy, LEAF[8]);
        }
      });
    }
  }
}
