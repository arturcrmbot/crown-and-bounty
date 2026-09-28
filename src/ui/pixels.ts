import { SHADOW, type Bitmap } from '../render/bitmap';
import { paletteWords } from '../render/palette';

/**
 * An indexed bitmap as an image for the page, through the game's palette (index 0 is see-through).
 * A sprite's SHADOW pixels become `shadow`, a little-endian RGBA word: see-through unless given.
 */
export function bitmapUrl(bitmap: Bitmap, shadow = 0): string {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(bitmap.width, bitmap.height);
  const pixels = new Uint32Array(image.data.buffer);
  const words = paletteWords(0);
  for (let i = 0; i < bitmap.data.length; i++) {
    const v = bitmap.data[i];
    pixels[i] = v === SHADOW ? shadow : v ? words[v] : 0;
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

/** A soft brown shadow for sprites set on parchment: rgba(42, 26, 8, 0.4). */
export const PARCHMENT_SHADOW = (102 << 24) | (8 << 16) | (26 << 8) | 42;
