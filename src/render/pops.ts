import { Bitmap } from './bitmap';
import { popRise, popScale, popShown } from './juice';
import { bayer } from './noise';
import { INK, NEUTRAL } from './palette';
import { textMask } from './text';

/**
 * A number popping out of a stack's badge (#190): how many fell, with a little skull, or the
 * damage when nobody did. Gold for their losses and red for yours, outlined all round in ink so
 * it reads over the grass whoever looks, red-green colour-blind players included.
 */
export type Pop = { fighter: number; words: string; colour: number; skull: boolean; age: number };

/** The size of type of a kill, and of a wound. */
export const KILL_SIZE = 22;
export const WOUND_SIZE = 15;

const SKULL = ['..#####..', '.#######.', '#########', '#..###..#', '#..###..#', '####.####', '.#######.', '..#.#.#..', '..#####..'];

const sprites = new Map<string, Bitmap>();

/** The pop's picture with its type `size` pixels tall: a little skull before a kill, its words in bold, and an ink line all round. */
export function popSprite(words: string, colour: number, size: number, skull: boolean): Bitmap {
  const key = `${words}|${colour}|${size}|${skull}`;
  let made = sprites.get(key);
  if (made) return made;
  const mask = textMask(words, size);
  // The skull grows with the type: nine pixels at a kill's own size.
  const k = size / KILL_SIZE;
  const side = skull ? Math.max(5, Math.round(SKULL.length * k)) : 0;
  const gap = skull ? Math.max(2, Math.round(3 * k)) : 0;
  const width = side + gap + mask.width;
  const height = mask.height;
  const solid = new Bitmap(width, height);
  if (skull) {
    const top = Math.round((height - side) / 2);
    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) {
        if (SKULL[Math.floor((y * SKULL.length) / side)][Math.floor((x * SKULL.length) / side)] === '#') solid.set(x, top + y, NEUTRAL[7]);
      }
    }
  }
  for (let j = 0; j < height; j++) for (let i = 0; i < mask.width; i++) if (mask.solid(i, j)) solid.set(side + gap + i, j, colour);
  made = new Bitmap(width + 2, height + 2);
  for (let y = -1; y <= height; y++) {
    for (let x = -1; x <= width; x++) {
      const v = solid.get(x, y);
      if (v) made.set(x + 1, y + 1, v);
      else if ([-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => solid.get(x + dx, y + dy)))) made.set(x + 1, y + 1, INK);
    }
  }
  sprites.set(key, made);
  return made;
}

/**
 * Draws a stack's pops over its badge, whose middle is at `cx` and top at `top`: the newest at the
 * badge, the older ones above it, each popping in large, holding, rising a little and dithering away.
 */
export function drawPops(screen: Bitmap, pops: readonly Pop[], cx: number, top: number, clip: { x: number; y: number; width: number; height: number }) {
  // Newest first, so it sits at the badge and the older ones make room above it.
  let above = 0;
  for (const p of [...pops].sort((a, b) => a.age - b.age)) {
    const scale = popScale(p.age);
    const sprite = popSprite(p.words, p.colour, Math.round((p.skull ? KILL_SIZE : WOUND_SIZE) * scale), p.skull);
    const settled = popSprite(p.words, p.colour, p.skull ? KILL_SIZE : WOUND_SIZE, p.skull);
    const shown = popShown(p.age);
    const x0 = Math.round(Math.min(Math.max(cx - sprite.width / 2, clip.x + 2), clip.x + clip.width - sprite.width - 2));
    // Its foot stays on the badge as it pops, whatever its size.
    const y0 = Math.round(top + 3 - sprite.height - popRise(p.age) - above);
    above += settled.height - 4;
    for (let j = 0; j < sprite.height; j++) {
      const y = y0 + j;
      if (y < clip.y || y >= clip.y + clip.height) continue;
      for (let i = 0; i < sprite.width; i++) {
        const v = sprite.data[j * sprite.width + i];
        const x = x0 + i;
        if (!v || x < clip.x || x >= clip.x + clip.width) continue;
        if (shown < 1 && bayer(x, y) >= shown) continue;
        screen.set(x, y, v);
      }
    }
  }
}
