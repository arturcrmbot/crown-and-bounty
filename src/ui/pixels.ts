import type { Bitmap } from '../render/bitmap';
import { paletteWords } from '../render/palette';

/** An indexed bitmap as an image for the page, through the game's palette (index 0 is see-through). */
export function bitmapUrl(bitmap: Bitmap): string {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(bitmap.width, bitmap.height);
  const pixels = new Uint32Array(image.data.buffer);
  const words = paletteWords(0);
  for (let i = 0; i < bitmap.data.length; i++) pixels[i] = bitmap.data[i] ? words[bitmap.data[i]] : 0;
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}
