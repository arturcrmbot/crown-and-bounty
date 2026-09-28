import { Bitmap } from './bitmap';

const scratch = document.createElement('canvas');
const context = scratch.getContext('2d', { willReadFrequently: true })!;
const FACE = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';

/** Which pixels a line of text covers: the browser renders it once, and every pixel more than half covered counts. */
export function textMask(text: string, size: number, spacing = 0) {
  const font = `bold ${size}px ${FACE}`;
  context.font = font;
  context.letterSpacing = `${spacing}px`;
  const width = Math.ceil(context.measureText(text).width) + 2;
  const height = size + 6;
  scratch.width = width;
  scratch.height = height;
  context.font = font;
  context.letterSpacing = `${spacing}px`;
  context.fillStyle = '#fff';
  context.textBaseline = 'top';
  context.fillText(text, 1, 2);
  const alpha = context.getImageData(0, 0, width, height).data;
  const solid = (i: number, j: number) => i >= 0 && j >= 0 && i < width && j < height && alpha[(j * width + i) * 4 + 3] > 120;
  return { width, height, solid };
}

/** Draws text as crisp pixels, with a one-pixel shadow down and right. A serif face keeps HoMM2's storybook feel. */
export function drawText(target: Bitmap, text: string, x: number, y: number, color: number, shadow: number, size = 13) {
  const { width, height, solid } = textMask(text, size);
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      if (solid(i, j)) target.set(x + i, y + j, color);
      else if (solid(i - 1, j - 1)) target.set(x + i, y + j, shadow);
    }
  }
  return width;
}

/** Draws text centred on `cx`, with a one-pixel `outline` all the way round, so it reads over anything. */
export function drawOutlined(target: Bitmap, text: string, cx: number, y: number, color: number, outline: number, size = 13) {
  const { width, height, solid } = textMask(text, size);
  const x0 = Math.round(cx - width / 2);
  for (let j = -1; j <= height; j++) {
    for (let i = -1; i <= width; i++) {
      if (solid(i, j)) target.set(x0 + i, y + j, color);
      else if ([-1, 0, 1].some((dj) => [-1, 0, 1].some((di) => solid(i + di, j + dj)))) target.set(x0 + i, y + j, outline);
    }
  }
}
