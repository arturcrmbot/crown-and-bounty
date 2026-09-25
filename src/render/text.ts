import { Bitmap } from './bitmap';

const scratch = document.createElement('canvas');
const context = scratch.getContext('2d', { willReadFrequently: true })!;

/**
 * Draws text as crisp pixels: the browser renders it once, and every pixel more than half covered
 * becomes solid. A serif face keeps HoMM2's storybook feel.
 */
export function drawText(target: Bitmap, text: string, x: number, y: number, color: number, shadow: number, size = 13) {
  const font = `bold ${size}px "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif`;
  context.font = font;
  const width = Math.ceil(context.measureText(text).width) + 2;
  const height = size + 6;
  scratch.width = width;
  scratch.height = height;
  context.font = font;
  context.fillStyle = '#fff';
  context.textBaseline = 'top';
  context.fillText(text, 1, 2);
  const alpha = context.getImageData(0, 0, width, height).data;
  const solid = (i: number, j: number) => i >= 0 && j >= 0 && i < width && j < height && alpha[(j * width + i) * 4 + 3] > 120;
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      if (solid(i, j)) target.set(x + i, y + j, color);
      else if (solid(i - 1, j - 1)) target.set(x + i, y + j, shadow);
    }
  }
  return width;
}
