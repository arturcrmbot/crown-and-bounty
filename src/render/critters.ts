import { Bitmap, outline, SHADOW } from './bitmap';
import { GOLD, INK, LEAF, RED } from './palette';

/** Small creatures a stack is turned into by a spell (see `look` on a status), drawn in code. */
export type Critter = 'newt' | 'frog';

const cache = new Map<string, Bitmap>();

/**
 * A great crested newt, side on: a long dark body with a jagged crest, an orange belly, a round
 * head with a gold eye, four splayed legs and a tail that sways with `phase` (0 to 1). Facing 1 is right.
 */
function newt(phase: number, facing: 1 | -1): Bitmap {
  const w = 42;
  const h = 19;
  const s = new Bitmap(w, h);
  const put = (x: number, y: number, c: number) => s.set(facing > 0 ? x : w - 1 - x, y, c);
  const mid = 11;
  for (let x = 1; x < w - 1; x++) {
    const u = x / (w - 1);
    // Thin at the tail's tip, fat in the body, a neck, then a round head.
    const half = u < 0.45 ? 0.4 + u * 5 : u < 0.78 ? 2.7 : u < 0.83 ? 2.1 : 2.9 - (u - 0.83) * 12;
    const sway = u < 0.45 ? Math.sin(phase * Math.PI * 2 + u * 7) * (0.45 - u) * 7 : 0;
    const cy = mid + sway;
    // The crest: a saw-edged ridge along the back and down the tail.
    const crest = u > 0.12 && u < 0.76 ? (x % 3 === 0 ? 2.6 : x % 3 === 1 ? 1.6 : 0.8) * Math.min(1, (0.76 - u) * 6) : 0;
    for (let y = 0; y < h - 1; y++) {
      const d = y + 0.5 - cy;
      if (d < -half - crest - 0.25 || d > half + 0.25) continue;
      const colour = d < -half ? LEAF[2] : d > half * 0.2 && u > 0.4 && u < 0.8 ? ((x + y) % 5 === 0 ? INK : RED[4]) : d < -half * 0.3 ? LEAF[1] : (x * 5 + y * 3) % 13 === 0 ? INK : LEAF[3];
      put(x, y, colour);
    }
    if (u > 0.4 && u < 0.82) put(x, h - 1, SHADOW);
  }
  // Legs, splayed out front and back.
  for (const [lx, dir] of [[19, -1], [30, 1]] as const) {
    for (const [dx, dy] of [[0, 3], [dir, 4], [dir * 2, 5], [dir * 3, 5]]) put(lx + dx, mid + dy, LEAF[2]);
  }
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) put(w - 6 + dx, mid - 2 + dy, GOLD[6]);
  put(w - 5, mid - 1, INK);
  return outline(s, INK);
}

/** A frog, crouched: a squat green body with a pale belly, two bulging gold eyes and folded legs. */
function frog(facing: 1 | -1): Bitmap {
  const w = 26;
  const h = 21;
  const s = new Bitmap(w, h);
  const put = (x: number, y: number, c: number) => s.set(facing > 0 ? x : w - 1 - x, y, c);
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w; x++) {
      const body = ((x - 12.5) / 10) ** 2 + ((y - 13) / 6) ** 2;
      const leg = ((x - 5) / 4.5) ** 2 + ((y - 16) / 3.4) ** 2;
      if (body <= 1) put(x, y, y > 15 && x > 7 && x < 21 ? GOLD[5] : (x * 7 + y * 3) % 11 === 0 ? LEAF[2] : y < 10 ? LEAF[6] : LEAF[5]);
      else if (leg <= 1) put(x, y, LEAF[3]);
    }
  }
  for (const ex of [13, 19]) {
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) if (dx + dy !== 0 && dx + dy !== 4) put(ex + dx, 5 + dy, GOLD[6]);
    put(ex + 2, 6, INK);
  }
  for (let x = 14; x < 23; x++) put(x, 12, LEAF[1]);
  for (let x = 5; x < 22; x++) put(x, h - 1, SHADOW);
  return outline(s, INK);
}

/** One creature, cached by its frame. */
export function critterSprite(kind: Critter, facing: 1 | -1, phase: number): Bitmap {
  const frame = kind === 'newt' ? Math.floor(phase * 6) % 6 : 0;
  const key = `${kind}/${facing}/${frame}`;
  let sprite = cache.get(key);
  if (!sprite) cache.set(key, (sprite = kind === 'newt' ? newt(frame / 6, facing) : frog(facing)));
  return sprite;
}

/**
 * Where the creatures a stack has become stand on its hex, from its foot: three of them for a
 * stack, one for someone one of a kind. Each moves in its own time: newts wriggle, frogs hop.
 */
export function critters(kind: Critter, many: boolean, time: number, seed: number): { dx: number; dy: number; phase: number }[] {
  const spots = many ? [[-6, -16], [14, -5], [-10, 5]] : [[0, 0]];
  return spots.map(([dx, dy], i) => {
    const t = time * (kind === 'newt' ? 1.3 : 1) + i * 0.37 + seed * 0.61;
    const hop = kind === 'frog' ? Math.max(0, Math.sin(t * Math.PI * 1.4)) ** 6 * 8 : 0;
    return { dx, dy: dy - hop, phase: t % 1 };
  });
}
