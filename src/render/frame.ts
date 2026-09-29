import { Bitmap } from './bitmap';
import { hash, noise, shade } from './noise';
import { GOLD, INK, PARCHMENT, SLATE, WOOD } from './palette';

export type Rect = { x: number; y: number; width: number; height: number };

export const SCREEN = { width: 960, height: 540 };
/** The picture, in its frame: the adventure map's view, the battlefield, the court, the title. */
export const MAP_VIEW: Rect = { x: 16, y: 16, width: 928, height: 464 };
export const BAR: Rect = { x: 16, y: 498, width: 928, height: 28 };

/**
 * The minimap, over the top right corner of the map's view, under the sound buttons: small, so the
 * land keeps the screen. Tab, or the button in its corner, folds it away (see `minimap.ts`).
 */
export const MINIMAP: Rect = { x: 770, y: 38, width: 160, height: 120 };

/** A carved gold moulding just outside a rectangle, lit from the top left. */
export function trim(screen: Bitmap, { x, y, width, height }: Rect, inset = 0) {
  const ring = (d: number, light: number, dark: number) => {
    for (let i = x - d; i < x + width + d; i++) {
      screen.set(i, y - d, light);
      screen.set(i, y + height - 1 + d, dark);
    }
    for (let j = y - d; j < y + height + d; j++) {
      screen.set(x - d, j, light);
      screen.set(x + width - 1 + d, j, dark);
    }
  };
  ring(1 + inset, INK, INK);
  ring(2 + inset, GOLD[2], GOLD[5]);
  ring(3 + inset, GOLD[4], GOLD[3]);
  ring(4 + inset, GOLD[6], GOLD[1]);
  ring(5 + inset, INK, INK);
}

/**
 * The static interface: dark slate around everything, a parchment band round the picture (`view`)
 * with a torn inner edge, gold trims and the bottom bar. Returns the frame and an overlay with the
 * torn parchment that is drawn over the picture every frame. `dividers` split the bar into sections;
 * a bar with one line across it, like the title's, has none.
 */
export function paintFrame(dividers: readonly number[] = BAR_DIVIDERS, view: Rect = MAP_VIEW): { frame: Bitmap; overlay: Bitmap } {
  const { width, height } = SCREEN;
  const frame = new Bitmap(width, height);
  const overlay = new Bitmap(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const grain = noise(x / 3, y / 3, 51) * 0.5 + noise(x / 11, y / 11, 52) * 0.5;
      frame.set(x, y, shade(SLATE, 0.18 + grain * 0.4, x, y));
    }
  }
  // Parchment: a band outside the picture, plus a torn fringe reaching into it.
  const band = 7;
  const v = view;
  for (let y = v.y - band; y < v.y + v.height + band; y++) {
    for (let x = v.x - band; x < v.x + v.width + band; x++) {
      const inside = Math.min(x - v.x, y - v.y, v.x + v.width - 1 - x, v.y + v.height - 1 - y);
      const along = x - v.x < 12 || v.x + v.width - x < 12 ? y : x;
      const tear = 2 + noise(along / 7, inside < 0 ? 1 : 2, 53) * 4 + (hash(along, 0, 54) < 0.12 ? 2 : 0);
      if (inside >= tear) continue;
      const depth = inside + band;
      const stain = noise(x / 9, y / 9, 55) * 0.35 + noise(x / 2, y / 2, 56) * 0.18;
      let level = 0.35 + stain + depth * 0.02;
      if (inside >= tear - 1) level -= 0.35;
      const color = shade(PARCHMENT, level, x, y);
      if (inside >= 0) overlay.set(x, y, inside >= tear - 1 ? PARCHMENT[1] : color);
      else frame.set(x, y, color);
    }
  }
  trim(frame, { x: v.x - band, y: v.y - band, width: v.width + band * 2, height: v.height + band * 2 });
  trim(frame, BAR);
  paintBarBackground(frame, dividers);
  return { frame, overlay };
}

/** Where the dividers of the bottom bar sit, from the bar's left edge. */
export const BAR_DIVIDERS = [470, 760];

export function paintBarBackground(frame: Bitmap, dividers: readonly number[] = BAR_DIVIDERS) {
  for (let y = BAR.y; y < BAR.y + BAR.height; y++) {
    for (let x = BAR.x; x < BAR.x + BAR.width; x++) {
      frame.set(x, y, shade(SLATE, 0.32 + (noise(x / 4, y / 4, 57) - 0.5) * 0.2 - (y - BAR.y) * 0.008, x, y));
    }
  }
  for (const divider of dividers) {
    for (let y = BAR.y + 3; y < BAR.y + BAR.height - 3; y++) {
      frame.set(BAR.x + divider, y, WOOD[0]);
      frame.set(BAR.x + divider + 1, y, GOLD[2]);
    }
  }
}
