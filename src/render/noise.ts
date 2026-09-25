export { fbm, hash, noise, rng } from '../rules/noise';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** 4x4 ordered-dither threshold in (0, 1). */
export const bayer = (x: number, y: number) => (BAYER[(x & 3) + ((y & 3) << 2)] + 0.5) / 16;

/** Picks a ramp colour for a light level in [0, 1], dithering between neighbouring shades. */
export function shade(ramp: readonly number[], level: number, x: number, y: number): number {
  const v = Math.min(Math.max(level, 0), 1) * (ramp.length - 1);
  const base = Math.floor(v);
  return ramp[Math.min(ramp.length - 1, base + (v - base > bayer(x, y) ? 1 : 0))];
}
