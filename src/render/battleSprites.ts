import type { TroopId } from '../content/troops';
import { Bitmap, outline, SHADOW } from './bitmap';
import { BLUE, GOLD, INK, LEAF, NEUTRAL, RED, SKIN, STONE, WOOD } from './palette';
import { BLUE4, COAT4, DIRT4, flat, GOLD4, RED4, shadowOval, STONE4, WOOD4 } from './sprites';
import { mirror } from './sprites';

export type Pose = 'idle' | 'step' | 'strike';

const LEAF4 = [LEAF[2], LEAF[4], LEAF[6], LEAF[7]];
const PURPLE4 = [RED[0], RED[1], RED[2], GOLD[4]];

type Look = {
  body: readonly number[];
  legs: readonly number[];
  head: 'helm' | 'hood' | 'straw' | 'kettle' | 'crown';
  weapon: 'sword' | 'bow' | 'fork' | 'crossbow' | 'greatsword';
  shield?: readonly number[];
  plume?: number;
  scale: number;
};

const LOOKS: Record<Exclude<TroopId, 'wolves'>, Look> = {
  knights: { body: BLUE4, legs: STONE4, head: 'helm', weapon: 'sword', shield: BLUE4, plume: BLUE[5], scale: 1.45 },
  archers: { body: LEAF4, legs: WOOD4, head: 'hood', weapon: 'bow', scale: 1.3 },
  peasants: { body: DIRT4, legs: WOOD4, head: 'straw', weapon: 'fork', scale: 1.24 },
  swordsmen: { body: RED4, legs: STONE4, head: 'helm', weapon: 'sword', shield: RED4, plume: NEUTRAL[7], scale: 1.36 },
  crossbowmen: { body: RED4, legs: WOOD4, head: 'kettle', weapon: 'crossbow', scale: 1.3 },
  baron: { body: PURPLE4, legs: STONE4, head: 'crown', weapon: 'greatsword', scale: 1.75 },
};

/**
 * One soldier facing right, drawn from simple shapes with four flat shades, lit from the top left.
 * `pose` bends the legs for a step or swings the weapon for a strike.
 */
function soldier(look: Look, pose: Pose): Bitmap {
  const S = look.scale;
  const w = Math.ceil(34 * S);
  const h = Math.ceil(44 * S);
  const sprite = new Bitmap(w, h);
  const px = (x: number, y: number, c: number) => sprite.set(Math.round(x * S), Math.round(y * S), c);
  const box = (x0: number, y0: number, x1: number, y1: number, shades: readonly number[], lean = 0) => {
    for (let y = Math.floor(y0 * S); y < y1 * S; y++) {
      for (let x = Math.floor(x0 * S); x < x1 * S; x++) {
        const u = (x / S - x0) / (x1 - x0);
        sprite.set(x + Math.round(((y / S - y0) / (y1 - y0)) * lean * S), y, flat(shades, 0.85 - u * 0.55 - (y / S - y0) * 0.01, x, y));
      }
    }
  };
  const ellipse = (cx: number, cy: number, rx: number, ry: number, shades: readonly number[]) => {
    for (let y = Math.floor((cy - ry) * S); y <= (cy + ry) * S; y++) {
      for (let x = Math.floor((cx - rx) * S); x <= (cx + rx) * S; x++) {
        const u = (x / S - cx) / rx;
        const v = (y / S - cy) / ry;
        if (u * u + v * v > 1) continue;
        sprite.set(x, y, flat(shades, 0.75 - u * 0.35 - v * 0.25, x, y));
      }
    }
  };
  const step = pose === 'step' ? 2 : 0;
  // Legs and boots.
  box(12 - step, 30, 15 - step, 40, look.legs, -step * 0.5);
  box(17 + step, 30, 20 + step, 40, look.legs, step * 0.5);
  box(11 - step, 39, 15 - step, 41, [INK, NEUTRAL[1], NEUTRAL[2], NEUTRAL[3]]);
  box(17 + step, 39, 21 + step, 41, [INK, NEUTRAL[1], NEUTRAL[2], NEUTRAL[3]]);
  // Body: tabard with a gold hem.
  box(10, 17, 22, 31, look.body);
  for (let x = 10; x < 22; x++) px(x, 30.5, GOLD[4]);
  if (look.body === BLUE4 || look.body === RED4) for (let y = 20; y < 28; y++) px(16, y, GOLD[5]);
  // Head.
  ellipse(16, 12, 4.2, 4.6, [SKIN[1], SKIN[2], SKIN[3], SKIN[4]]);
  if (look.head === 'helm') {
    ellipse(16, 10.5, 4.6, 4.2, STONE4);
    for (let x = 16; x < 21; x++) px(x, 12, INK);
    if (look.plume !== undefined) for (const [x, y] of [[14, 5], [13, 4], [12, 4], [11, 5], [15, 5], [12, 5]]) px(x, y, look.plume);
  } else if (look.head === 'hood') {
    ellipse(15.5, 11, 5, 5.2, LEAF4);
    ellipse(17.5, 12.5, 2.6, 2.8, [SKIN[1], SKIN[2], SKIN[3], SKIN[4]]);
  } else if (look.head === 'straw') {
    for (let x = 9; x < 24; x++) px(x, 8, GOLD[x % 3 === 0 ? 3 : 5]);
    ellipse(16, 6.5, 4.5, 2.4, GOLD4);
  } else if (look.head === 'kettle') {
    for (let x = 10; x < 23; x++) px(x, 9, STONE[4]);
    ellipse(16, 8, 4, 2.6, STONE4);
  } else {
    ellipse(16, 13.5, 3.8, 3.2, [NEUTRAL[4], NEUTRAL[5], NEUTRAL[6], NEUTRAL[7]]);
    for (const x of [12, 14, 16, 18, 20]) for (let y = 4; y < 8; y++) px(x, y, y === 4 ? GOLD[6] : GOLD[4]);
    for (let x = 12; x < 21; x++) px(x, 7.5, GOLD[3]);
  }
  px(18.5, 11.5, INK);
  // Weapon arm, forward when striking.
  const reach = pose === 'strike' ? 6 : 0;
  box(20, 18, 24 + reach * 0.5, 21, look.body);
  if (look.weapon === 'sword' || look.weapon === 'greatsword') {
    const long = look.weapon === 'greatsword' ? 1.5 : 1;
    const bx = 24 + reach;
    for (let i = 0; i < 12 * long; i++) {
      const x = pose === 'strike' ? bx + i : bx + i * 0.25;
      const y = pose === 'strike' ? 19 - i * 0.15 : 18 - i;
      px(x, y, i === 0 ? GOLD[4] : STONE[6]);
      px(x + 0.8, y, i === 0 ? GOLD[3] : STONE[4]);
    }
  } else if (look.weapon === 'fork') {
    for (let i = -8; i < 14; i++) px(24 + reach * 0.4 + i * 0.1, 19 - i, WOOD[3]);
    for (const dx of [-1.5, 0, 1.5]) for (let i = 0; i < 4; i++) px(24 + reach * 0.4 - 1.4 + dx, 4 - i, STONE[5]);
  } else if (look.weapon === 'bow') {
    for (let i = -9; i <= 9; i++) px(25 + reach * 0.3 + Math.cos((i / 9) * 1.3) * 3, 19 + i, WOOD[4]);
    for (let i = -8; i <= 8; i++) px(23 + reach * 0.3, 19 + i, NEUTRAL[6]);
  } else {
    box(22, 18, 30, 20, WOOD4);
    for (let i = -3; i <= 3; i++) px(29, 19 + i, STONE[5]);
  }
  if (look.shield) {
    ellipse(9.5, 22, 4.2, 5.4, look.shield);
    px(9, 22, GOLD[5]);
    px(9, 21, GOLD[5]);
  }
  if (look.head === 'crown') {
    // The royal goose, tucked under the Baron's arm and not happy about it.
    ellipse(8, 22, 4.8, 3.4, [NEUTRAL[5], NEUTRAL[6], NEUTRAL[7], NEUTRAL[7]]);
    for (let i = 0; i < 6; i++) px(4.5 - i * 0.2, 21 - i, NEUTRAL[7]);
    px(3.5, 15, GOLD[5]);
    px(2.8, 15, GOLD[5]);
    px(4.2, 14.6, INK);
  }
  const shaped = outline(sprite, INK);
  shadowOval(shaped, w / 2 + 3, 41 * S, 10 * S, 2.4 * S);
  return shaped;
}

/** A grey wolf at battle size, facing right. */
function wolf(pose: Pose): Bitmap {
  const small = wolfSmall(pose);
  // Drawn at 1x and doubled: the wolf's shapes are simple enough to take a clean 2x.
  const sprite = new Bitmap(small.width * 2, small.height * 2);
  for (let y = 0; y < sprite.height; y++) for (let x = 0; x < sprite.width; x++) sprite.data[y * sprite.width + x] = small.data[(y >> 1) * small.width + (x >> 1)];
  return sprite;
}

function wolfSmall(pose: Pose): Bitmap {
  const sprite = new Bitmap(46, 30);
  const lunge = pose === 'strike' ? 4 : 0;
  const leg = pose === 'step' ? 2 : 0;
  const ell = (cx: number, cy: number, rx: number, ry: number, bias: number) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const u = (x + 0.5 - cx) / rx;
        const v = (y + 0.5 - cy) / ry;
        if (u * u + v * v <= 1) sprite.set(x, y, flat(COAT4, bias - v * 0.3 - u * 0.1, x, y));
      }
    }
  };
  for (const [x, dx] of [[12, -leg], [16, leg], [26, leg], [30, -leg]]) for (let y = 18; y < 26; y++) sprite.set(x + (dx * (y - 18)) / 8, y, y > 24 ? INK : NEUTRAL[3]);
  ell(22, 15, 12, 6, 0.55);
  ell(35 + lunge, 11, 6, 4.5, 0.62);
  ell(40 + lunge, 13, 3.5, 2, 0.5);
  for (const [x, y] of [[33, 6], [34, 5], [36, 6], [37, 5]]) sprite.set(x + lunge, y, NEUTRAL[4]);
  sprite.set(37 + lunge, 10, GOLD[5]);
  sprite.set(42 + lunge, 12, INK);
  for (let i = 0; i < 8; i++) sprite.set(9 - i, 12 - Math.round(i * 0.5), NEUTRAL[4]);
  if (pose === 'strike') for (let x = 38; x < 44; x++) sprite.set(x + lunge, 15, NEUTRAL[7]);
  const shaped = outline(sprite, INK);
  shadowOval(shaped, 25, 26, 16, 2.4);
  return shaped;
}

const cache = new Map<string, Bitmap>();

/** The sprite for a stack: its troop, facing (1 is right), and pose. */
export function troopSprite(troop: TroopId, facing: 1 | -1, pose: Pose = 'idle'): Bitmap {
  const key = `${troop}/${facing}/${pose}`;
  let sprite = cache.get(key);
  if (!sprite) {
    const right = troop === 'wolves' ? wolf(pose) : soldier(LOOKS[troop], pose);
    sprite = facing > 0 ? right : mirror(right);
    cache.set(key, sprite);
  }
  return sprite;
}

/** The same sprite flashed pale, for the moment a stack is hit. */
export function flashSprite(sprite: Bitmap): Bitmap {
  const out = new Bitmap(sprite.width, sprite.height);
  for (let i = 0; i < sprite.data.length; i++) {
    const v = sprite.data[i];
    out.data[i] = v === 0 || v === SHADOW ? v : v === INK ? RED[2] : NEUTRAL[7];
  }
  return out;
}

export const FIGHTER_FOOT = (troop: TroopId) => (troop === 'wolves' ? 52 : Math.round(41 * LOOKS[troop].scale));
export { BLUE4, RED4 };
