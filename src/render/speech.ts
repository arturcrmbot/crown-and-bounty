import { Bitmap, SHADOW } from './bitmap';
import { hash, shade } from './noise';
import { INK, PARCHMENT, WOOD } from './palette';
import { drawText, textMask } from './text';

/** How wide a bubble's words run before they wrap, the letters' size, and the gap between lines, in pixels. */
const WRAP = 280;
const SIZE = 14;
const LINE = 18;
const PAD = 9;
/** How far the tail hangs below the bubble, and how far in from its right edge the tail's tip is. */
export const TAIL = 14;
export const TIP = 6;

/** Words wrapped to lines no wider than the bubble's. */
function wrap(text: string): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const longer = line ? `${line} ${word}` : word;
    if (line && textMask(longer, SIZE).width > WRAP) {
      lines.push(line);
      line = word;
    } else line = longer;
  }
  return line ? [...lines, line] : lines;
}

/**
 * Words said aloud on the field, as a sprite: parchment in an ink line with the words in it, and a
 * tail down from its bottom right towards whoever says them, below and to the right of it.
 */
export function paintSpeech(text: string): Bitmap {
  const lines = wrap(text);
  const w = Math.max(...lines.map((l) => textMask(l, SIZE).width)) + PAD * 2;
  const h = lines.length * LINE + PAD * 2 - 2;
  const b = new Bitmap(w + 3, h + TAIL + 3);
  const r = 5;
  const inside = (x: number, y: number) => {
    const cx = x < r ? r : x > w - 1 - r ? w - 1 - r : x;
    const cy = y < r ? r : y > h - 1 - r ? h - 1 - r : y;
    return x >= 0 && y >= 0 && x < w && y < h && Math.hypot(x - cx, y - cy) <= r;
  };
  // The tail narrows from the bottom edge to its tip.
  const tail = (x: number, y: number) => {
    if (y < h - 1 || y > h - 1 + TAIL) return false;
    const t = (y - (h - 1)) / TAIL;
    const tip = w - TIP;
    return x >= w - 40 + (tip - (w - 40)) * t && x <= w - 24 + (tip - (w - 24)) * t;
  };
  const solid = (x: number, y: number) => inside(x, y) || tail(x, y);
  for (let y = 0; y < h + TAIL; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      const edge = !solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1);
      b.set(x, y, edge ? INK : shade(PARCHMENT, 0.86 - (Math.min(y, h) / h) * 0.3 + (hash(x, y, 9) - 0.5) * 0.08, x, y));
    }
  }
  for (let y = 0; y < h + TAIL; y++) for (let x = 0; x < w; x++) if (solid(x, y)) b.under(x + 3, y + 3, SHADOW);
  lines.forEach((line, i) => drawText(b, line, PAD, PAD - 3 + i * LINE, WOOD[1], PARCHMENT[3], SIZE));
  return b;
}
