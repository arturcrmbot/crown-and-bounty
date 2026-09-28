import { SHADOW, type Bitmap } from '../render/bitmap';
import { paletteWords } from '../render/palette';

/**
 * An indexed bitmap as an image for the page, through the game's palette (index 0 is see-through),
 * `zoom` times its size in whole pixels. A sprite's SHADOW pixels become `shadow`, a little-endian
 * RGBA word: see-through unless given.
 */
export function bitmapUrl(bitmap: Bitmap, shadow = 0, zoom = 1): string {
  const [w, h] = [bitmap.width * zoom, bitmap.height * zoom];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(w, h);
  const pixels = new Uint32Array(image.data.buffer);
  const words = paletteWords(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = bitmap.data[Math.floor(y / zoom) * bitmap.width + Math.floor(x / zoom)];
      pixels[y * w + x] = v === SHADOW ? shadow : v ? words[v] : 0;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

/** A soft brown shadow for sprites set on parchment: rgba(42, 26, 8, 0.4). */
export const PARCHMENT_SHADOW = (102 << 24) | (8 << 16) | (26 << 8) | 42;
