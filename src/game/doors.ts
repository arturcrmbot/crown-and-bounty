import { SHADOW, type Bitmap } from '../render/bitmap';
import type { Point } from '../rules/map/geometry';

/** A box on the map, in map pixels: a place's, as it's drawn and clicked. */
export type Box = { x0: number; y0: number; x1: number; y1: number };

/** How far a figure reaches from its feet, in map pixels: left, right, up and down. */
export type Reach = { left: number; right: number; up: number; down: number };

/** Past this share of a place hidden behind him, the hero waits beside it rather than in front of it. */
export const HIDES = 0.3;

/** How far the hero's figure (his frame on the map, with his feet `foot` below its top) reaches from his feet. */
export function reachOf(sprite: Bitmap, foot: number): Reach {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let y = 0; y < sprite.height; y++) {
    for (let x = 0; x < sprite.width; x++) {
      const v = sprite.data[y * sprite.width + x];
      if (v === 0 || v === SHADOW) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x + 1);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y + 1);
    }
  }
  const middle = sprite.width / 2;
  return x1 < 0 ? { left: 0, right: 0, up: 0, down: 0 } : { left: middle - x0, right: x1 - middle, up: foot - y0, down: y1 - foot };
}

/** The share of a place's box the hero hides, standing with his feet at `feet`: 0 for none of it, 1 for all of it. */
export function hiddenShare(place: Box, figure: Reach, [x, y]: Point): number {
  const w = Math.min(place.x1, x + figure.right) - Math.max(place.x0, x - figure.left);
  const h = Math.min(place.y1, y + figure.down) - Math.max(place.y0, y - figure.up);
  const area = (place.x1 - place.x0) * (place.y1 - place.y0);
  return w > 0 && h > 0 && area > 0 ? (w * h) / area : 0;
}

/**
 * Where the hero can wait beside a place, as HoMM2's heroes wait at a door: left of it and right of
 * it, level with its foot, clear of it but for a lance tip, whichever way he faces.
 */
export function doorsOf(place: Box, foot: number, figure: Reach): Point[] {
  const reach = Math.max(figure.left, figure.right) - 4;
  return [[place.x0 - reach, foot], [place.x1 + reach, foot]];
}
