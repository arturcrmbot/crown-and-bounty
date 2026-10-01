import { Bitmap, SHADOW } from './bitmap';

/**
 * A sprite turned `degrees` about a pivot in its own pixels, in whole pixels (each new pixel takes
 * the old one under it), leaving out its shadow on the ground: positive turns it the way the clock's
 * hands don't, so a figure turned 90 lies with its head to the left. Returns the turned sprite and
 * where its top left lands, from the pivot.
 */
export function rotateAbout(sprite: Bitmap, degrees: number, pivot: readonly [number, number]): { sprite: Bitmap; x: number; y: number } {
  const a = (degrees * Math.PI) / 180;
  // Whole quarter turns come out exact.
  const [cos, sin] = [Math.round(Math.cos(a) * 1e9) / 1e9, Math.round(Math.sin(a) * 1e9) / 1e9];
  const [px, py] = pivot;
  // Where the corners go, for the size of the turned sprite.
  const turn = (x: number, y: number): [number, number] => [x * cos + y * sin, -x * sin + y * cos];
  const corners = [turn(-px, -py), turn(sprite.width - px, -py), turn(-px, sprite.height - py), turn(sprite.width - px, sprite.height - py)];
  const x0 = Math.floor(Math.min(...corners.map((c) => c[0])));
  const y0 = Math.floor(Math.min(...corners.map((c) => c[1])));
  const x1 = Math.ceil(Math.max(...corners.map((c) => c[0])));
  const y1 = Math.ceil(Math.max(...corners.map((c) => c[1])));
  const out = new Bitmap(x1 - x0, y1 - y0);
  for (let oy = 0; oy < out.height; oy++) {
    for (let ox = 0; ox < out.width; ox++) {
      // The pixel's middle, turned back to find the one it came from.
      const [dx, dy] = [ox + x0 + 0.5, oy + y0 + 0.5];
      const sx = Math.floor(dx * cos - dy * sin + px);
      const sy = Math.floor(dx * sin + dy * cos + py);
      const v = sprite.get(sx, sy);
      if (v && v !== SHADOW) out.set(ox, oy, v);
    }
  }
  return { sprite: out, x: x0, y: y0 };
}

/** The rows and columns a sprite paints, its shadow left out: [left, top, right, bottom], or null if it paints nothing. */
export function paintedBox(sprite: Bitmap): [number, number, number, number] | null {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let y = 0; y < sprite.height; y++) {
    for (let x = 0; x < sprite.width; x++) {
      const v = sprite.data[y * sprite.width + x];
      if (!v || v === SHADOW) continue;
      [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
    }
  }
  return Number.isFinite(x0) ? [x0, y0, x1, y1] : null;
}
