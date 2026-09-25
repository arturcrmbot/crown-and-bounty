import { SHADOW_LUT } from './palette';

/** Marks a sprite pixel that darkens whatever is underneath instead of drawing a colour. */
export const SHADOW = 255;

/** An 8-bit indexed image. In sprites, 0 is transparent and SHADOW darkens the pixel below. */
export class Bitmap {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height);
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    return this.data[y * this.width + x];
  }

  set(x: number, y: number, index: number) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.data[y * this.width + x] = index;
  }

  /** Sets a pixel only if nothing is there yet (for shadows and backgrounds). */
  under(x: number, y: number, index: number) {
    if (this.get(x, y) === 0) this.set(x, y, index);
  }

  fill(x: number, y: number, width: number, height: number, index: number) {
    for (let j = y; j < y + height; j++) for (let i = x; i < x + width; i++) this.set(i, j, index);
  }
}

/** Draws `src` onto `dst` with its top-left at (x, y), optionally clipped to a rectangle of `dst`. */
export function blit(
  dst: Bitmap,
  src: Bitmap,
  x: number,
  y: number,
  clip = { x: 0, y: 0, width: dst.width, height: dst.height },
) {
  const x0 = Math.max(x, clip.x);
  const y0 = Math.max(y, clip.y);
  const x1 = Math.min(x + src.width, clip.x + clip.width);
  const y1 = Math.min(y + src.height, clip.y + clip.height);
  for (let j = y0; j < y1; j++) {
    let s = (j - y) * src.width + (x0 - x);
    let d = j * dst.width + x0;
    for (let i = x0; i < x1; i++, s++, d++) {
      const v = src.data[s];
      if (v === 0) continue;
      dst.data[d] = v === SHADOW ? SHADOW_LUT[dst.data[d]] : v;
    }
  }
}

/** Adds a 1-pixel outline in `ink` around every opaque pixel of a sprite (not around shadows). */
export function outline(sprite: Bitmap, ink: number): Bitmap {
  const out = new Bitmap(sprite.width, sprite.height);
  out.data.set(sprite.data);
  for (let y = 0; y < sprite.height; y++) {
    for (let x = 0; x < sprite.width; x++) {
      const v = sprite.get(x, y);
      if (v !== 0 && v !== SHADOW) continue;
      const solid = (dx: number, dy: number) => {
        const n = sprite.get(x + dx, y + dy);
        return n !== 0 && n !== SHADOW;
      };
      if (solid(1, 0) || solid(-1, 0) || solid(0, 1) || solid(0, -1)) out.set(x, y, ink);
    }
  }
  return out;
}
