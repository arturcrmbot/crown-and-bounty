import { Bitmap, SHADOW } from './bitmap';
import { GOLD, INK } from './palette';

/** How far the ring round a lit place reaches out from it, in pixels: two of gold, then one of ink. */
export const LIT_REACH = 3;
const LAYERS = [GOLD[6], GOLD[5], INK] as const;

const rings = new WeakMap<Bitmap, Bitmap>();

/**
 * The ring round a sprite's outside, for the place under the pointer (#256). It goes round whatever can
 * be reached from the edge without crossing the sprite, so a gap inside it (the yard in a sheepfold)
 * stays as it was, and the sprite's shadow counts as open ground. The ring is `LIT_REACH` bigger than
 * the sprite on every side, and holds nothing but the ring.
 */
export function ringOf(sprite: Bitmap): Bitmap {
  const known = rings.get(sprite);
  if (known) return known;
  const P = LIT_REACH;
  const [W, H] = [sprite.width + P * 2, sprite.height + P * 2];
  const solid = (x: number, y: number) => {
    const v = sprite.get(x - P, y - P);
    return v !== 0 && v !== SHADOW;
  };
  // What's outside: every open pixel reachable from the edge.
  const outside = new Uint8Array(W * H);
  const stack: number[] = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const i = stack.pop()!;
    const [x, y] = [i % W, Math.floor(i / W)];
    if (outside[i] || solid(x, y)) continue;
    outside[i] = 1;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - W);
    if (y < H - 1) stack.push(i + W);
  }
  // Each layer of the ring is the outside pixels touching what's inside it, the layer before included.
  const ring = new Bitmap(W, H);
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !outside[y * W + x];
  for (const colour of LAYERS) {
    const layer: number[] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (outside[y * W + x] && (inside(x + 1, y) || inside(x - 1, y) || inside(x, y + 1) || inside(x, y - 1))) layer.push(y * W + x);
      }
    }
    for (const i of layer) {
      ring.data[i] = colour;
      outside[i] = 0;
    }
  }
  rings.set(sprite, ring);
  return ring;
}
