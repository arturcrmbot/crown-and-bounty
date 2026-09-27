import { Bitmap, SHADOW } from './bitmap';
import { bayer, hash, shade } from './noise';
import { INK, PARCHMENT, RED, SHADOW_LUT, WOOD } from './palette';
import { textMask } from './text';

/** How long a province's name stays across the sky, in seconds, fades included. */
export const BANNER_TIME = 4.2;

/** A parchment ribbon with swallowtail ends and a province's name on it, as a sprite. */
export function paintBanner(title: string, subtitle: string): Bitmap {
  const big = textMask(title, 40, 5);
  const small = textMask(subtitle, 15, 1);
  const width = Math.max(big.width, small.width) + 150;
  const height = 84;
  const b = new Bitmap(width, height + 4);
  const tail = 26;
  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    // The ends are cut into a V, and hang a little lower than the middle.
    const notch = tail * (1 - Math.abs(v - 0.5) * 2);
    for (let x = 0; x < width; x++) {
      const fromEnd = Math.min(x, width - 1 - x);
      if (fromEnd < notch) continue;
      const edge = fromEnd < notch + 2 || y < 2 || y > height - 3;
      const fold = fromEnd < tail + 14 ? -0.16 : 0;
      b.set(x, y, edge ? INK : shade(PARCHMENT, 0.72 - Math.abs(v - 0.42) * 0.5 + fold + (hash(x, y, 5) - 0.5) * 0.1, x, y));
    }
  }
  for (let x = 3; x < width - 3; x++) if (b.get(x, height - 1)) b.set(x + 3, height + 2, SHADOW);
  const stamp = (mask: ReturnType<typeof textMask>, x0: number, y0: number, face: readonly number[]) => {
    for (let j = 0; j < mask.height; j++) {
      for (let i = 0; i < mask.width; i++) {
        if (mask.solid(i, j)) b.set(x0 + i, y0 + j, shade(face, 0.72 - (j / mask.height) * 0.5, x0 + i, y0 + j));
        else if (mask.solid(i - 1, j - 1)) b.set(x0 + i, y0 + j, SHADOW_LUT[b.get(x0 + i, y0 + j)]);
      }
    }
  };
  stamp(big, Math.round((width - big.width) / 2), 10, RED);
  stamp(small, Math.round((width - small.width) / 2), 56, WOOD);
  return b;
}

/** Lays the banner over `screen`, `age` seconds after it appeared: it dithers in, holds, and dithers away. */
export function drawBanner(screen: Bitmap, banner: Bitmap, cx: number, y: number, age: number) {
  const alpha = Math.min(1, age / 0.35, Math.max(0, (BANNER_TIME - age) / 0.7));
  if (alpha <= 0) return;
  const x0 = Math.round(cx - banner.width / 2);
  const lift = Math.round((1 - Math.min(1, age / 0.35)) * 8);
  for (let j = 0; j < banner.height; j++) {
    for (let i = 0; i < banner.width; i++) {
      const v = banner.data[j * banner.width + i];
      if (!v || bayer(i, j) >= alpha) continue;
      const x = x0 + i;
      const yy = y + j - lift;
      screen.set(x, yy, v === SHADOW ? SHADOW_LUT[screen.get(x, yy)] : v);
    }
  }
}
