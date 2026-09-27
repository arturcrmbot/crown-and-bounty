/**
 * Portraits for cards: busts drawn in code, one recipe per character. A bust is shoulders and
 * clothes, a lit face with eyes, brows, nose and mouth, and whatever hair, beard and hat make the
 * character: the King's crown and great white beard, Grimsby's moustache and the goose, a witch's
 * crooked hat.
 */
import { Bitmap, outline } from './bitmap';
import { hash, shade } from './noise';
import { BLUE, EARTH, FOG, GOLD, INK, LEAF, NEUTRAL, PLUM, RED, SKIN, SLATE, STONE } from './palette';

import type { PortraitId } from '../content/portraits';

export type { PortraitId };

export const PORTRAIT_SIZE = 64;

type Hat = 'crown' | 'helm' | 'wizard' | 'hood' | 'feathercap' | 'witch' | 'coif' | 'none' | 'kettle';
type Recipe = {
  skin: readonly number[];
  hair?: readonly number[];
  beard?: 'full' | 'moustache' | 'stubble' | 'goatee';
  beardColour?: readonly number[];
  hat: Hat;
  hatColour?: readonly number[];
  clothes: readonly number[];
  collar?: 'ermine' | 'mail' | 'ruff' | 'none';
  eyes: number;
  mood?: 'smile' | 'stern' | 'sly' | 'cackle';
  wart?: boolean;
  goose?: boolean;
};

const WHITE = [NEUTRAL[3], NEUTRAL[5], NEUTRAL[6], NEUTRAL[7]];
const BROWN = [EARTH[1], EARTH[2], EARTH[4], EARTH[5]];
const DARK = [SLATE[0], SLATE[1], SLATE[3], SLATE[4]];
const GINGER = [RED[1], RED[3], RED[4], GOLD[4]];
const GREENSKIN = [LEAF[1], LEAF[3], LEAF[5], LEAF[6], LEAF[7]];
const GREY = [FOG[3], FOG[5], FOG[7], FOG[8]];

const RECIPES: Record<PortraitId, Recipe> = {
  king: { skin: SKIN, hair: WHITE, beard: 'full', beardColour: WHITE, hat: 'crown', clothes: [RED[1], RED[2], RED[3], RED[4]], collar: 'ermine', eyes: BLUE[4], mood: 'smile' },
  knight: { skin: SKIN, hair: BROWN, beard: 'stubble', beardColour: BROWN, hat: 'helm', hatColour: [STONE[2], STONE[4], STONE[5], STONE[6]], clothes: [BLUE[1], BLUE[2], BLUE[3], BLUE[4]], collar: 'mail', eyes: BLUE[5], mood: 'stern' },
  wizard: { skin: SKIN, hair: WHITE, beard: 'full', beardColour: WHITE, hat: 'wizard', hatColour: [BLUE[0], BLUE[1], BLUE[2], BLUE[3]], clothes: [BLUE[0], BLUE[1], BLUE[2], BLUE[3]], eyes: GOLD[5], mood: 'smile' },
  ranger: { skin: SKIN, hair: GINGER, beard: 'goatee', beardColour: [EARTH[1], EARTH[2], EARTH[3], RED[2]], hat: 'hood', hatColour: [LEAF[1], LEAF[2], LEAF[4], LEAF[5]], clothes: [LEAF[1], LEAF[2], LEAF[3], LEAF[4]], eyes: LEAF[6], mood: 'sly' },
  courtier: { skin: SKIN, hair: DARK, beard: 'moustache', beardColour: DARK, hat: 'feathercap', hatColour: [PLUM[1], PLUM[2], PLUM[3], PLUM[4]], clothes: [PLUM[1], PLUM[2], PLUM[3], PLUM[4]], collar: 'ruff', eyes: EARTH[3], mood: 'smile' },
  grimsby: { skin: SKIN, hair: GINGER, beard: 'moustache', beardColour: GINGER, hat: 'kettle', hatColour: [PLUM[0], PLUM[1], PLUM[2], GOLD[4]], clothes: [PLUM[0], PLUM[1], PLUM[2], PLUM[3]], collar: 'ruff', eyes: EARTH[2], mood: 'sly', goose: true },
  mirrow: { skin: GREENSKIN, hair: GREY, hat: 'witch', hatColour: [PLUM[0], PLUM[0], PLUM[1], PLUM[2]], clothes: [PLUM[0], PLUM[1], PLUM[2], PLUM[3]], eyes: GOLD[6], mood: 'cackle', wart: true },
  bramble: { skin: GREENSKIN, hair: WHITE, hat: 'witch', hatColour: [INK, SLATE[0], SLATE[1], SLATE[2]], clothes: [LEAF[1], LEAF[2], LEAF[3], LEAF[4]], eyes: RED[5], mood: 'stern', wart: true },
  anselm: { skin: SKIN, hair: WHITE, beard: 'stubble', beardColour: WHITE, hat: 'coif', hatColour: BROWN, clothes: BROWN, eyes: BLUE[4], mood: 'smile' },
  sergeant: { skin: SKIN, hair: DARK, beard: 'moustache', beardColour: DARK, hat: 'kettle', hatColour: [STONE[2], STONE[3], STONE[5], STONE[6]], clothes: [RED[1], RED[2], RED[3], RED[4]], collar: 'mail', eyes: EARTH[2], mood: 'stern' },
};

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
/** Light from the top left: brighter up and to the left of a shape's centre. */
const lit = (x: number, y: number, cx: number, cy: number, r: number) => 0.62 - ((x - cx) / r) * 0.28 - ((y - cy) / r) * 0.22;

export function portrait(id: PortraitId): Bitmap {
  const p = RECIPES[id];
  const b = new Bitmap(PORTRAIT_SIZE, PORTRAIT_SIZE);
  const fill = (test: (x: number, y: number) => boolean, colour: (x: number, y: number) => number, y0 = 0, y1 = PORTRAIT_SIZE, x0 = 0, x1 = PORTRAIT_SIZE) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (test(x, y)) b.set(x, y, colour(x, y));
  };
  const [cx, cy] = [32, 30];

  // Shoulders and clothes.
  fill((x, y) => inEllipse(x, y, cx, 66, 29, 20), (x, y) => shade(p.clothes, lit(x, y, cx, 58, 26) - 0.05, x, y), 44);
  // Neck.
  fill((x, y) => Math.abs(x - cx) < 6 && y > 40 && y < 50, (x, y) => shade(p.skin, 0.4 - (x - cx) * 0.03, x, y));
  if (p.collar === 'ermine') fill((x, y) => inEllipse(x, y, cx, 50, 22, 6), (x, y) => ((x * 7 + y * 3) % 17 === 0 ? INK : x < cx ? NEUTRAL[7] : NEUTRAL[6]), 44);
  if (p.collar === 'mail') fill((x, y) => inEllipse(x, y, cx, 49, 16, 5), (x, y) => ((x + y) % 2 === 0 ? STONE[5] : STONE[3]), 44);
  if (p.collar === 'ruff') fill((x, y) => inEllipse(x, y, cx, 48, 14, 4), (x) => (x % 3 === 0 ? NEUTRAL[5] : NEUTRAL[7]), 43);
  if (p.hat === 'wizard' || p.hat === 'hood') {
    // Robes: a V at the neck.
    fill((x, y) => y > 46 && Math.abs(x - cx) < (y - 44) * 0.8 && Math.abs(x - cx) > (y - 44) * 0.8 - 2, () => GOLD[4], 44);
  }

  // Hair at the back, behind the face.
  if (p.hair && p.hat !== 'helm' && p.hat !== 'hood' && p.hat !== 'coif') fill((x, y) => inEllipse(x, y, cx, cy + 1, 15, 17) && y < cy + 10, (x, y) => shade(p.hair!, lit(x, y, cx, cy, 16) - 0.1, x, y));
  if (p.hat === 'witch' && p.hair) fill((x, y) => inEllipse(x, y, cx, cy + 8, 17, 16) && y > cy - 4 && !inEllipse(x, y, cx, cy + 2, 12, 15), (x, y) => shade(p.hair!, 0.4 + hash(x, y, 3) * 0.3, x, y));

  // The face, lit from the top left, and ears.
  for (const ex of [cx - 13, cx + 13]) fill((x, y) => inEllipse(x, y, ex, cy + 2, 2.5, 4), (x, y) => shade(p.skin, ex < cx ? 0.55 : 0.35, x, y));
  fill((x, y) => inEllipse(x, y, cx, cy + 2, 12, 15), (x, y) => shade(p.skin, lit(x, y, cx, cy, 13) + 0.05, x, y));

  // Eyes, brows, nose and mouth.
  const moodBrow = p.mood === 'stern' ? 1 : p.mood === 'sly' ? -1 : 0;
  for (const side of [-1, 1]) {
    const ex = cx + side * 5;
    b.set(ex - 1, cy, NEUTRAL[7]);
    b.set(ex, cy, NEUTRAL[7]);
    b.set(ex + 1, cy, NEUTRAL[7]);
    b.set(ex + (side > 0 ? 0 : 0), cy, p.eyes);
    b.set(ex, cy + 1, INK);
    b.set(ex + side, cy, INK);
    const brow = p.hair ?? p.beardColour ?? BROWN;
    for (let k = -2; k <= 2; k++) b.set(ex + k, cy - 3 + (side * k * moodBrow > 0 ? 1 : 0) + (p.mood === 'sly' && side > 0 ? -1 : 0), brow[1]);
  }
  for (let y = cy + 1; y < cy + 7; y++) b.set(cx + 1, y, shade(p.skin, 0.25, cx, y));
  b.set(cx, cy + 7, shade(p.skin, 0.2, cx, cy));
  b.set(cx + 2, cy + 7, shade(p.skin, 0.2, cx, cy));
  const mouthY = cy + 10;
  if (p.mood === 'cackle') {
    for (let x = cx - 4; x <= cx + 4; x++) b.set(x, mouthY, INK);
    for (let x = cx - 3; x <= cx + 3; x++) b.set(x, mouthY + 1, x % 2 === 0 ? NEUTRAL[7] : RED[1]);
    for (let x = cx - 2; x <= cx + 2; x++) b.set(x, mouthY + 2, INK);
  } else {
    const curve = p.mood === 'smile' ? 1 : p.mood === 'stern' ? -1 : 0;
    for (let x = cx - 3; x <= cx + 3; x++) b.set(x, mouthY - (Math.abs(x - cx) === 3 ? curve : 0) + (p.mood === 'sly' && x > cx ? -1 : 0), RED[2]);
  }
  if (p.wart) {
    b.set(cx + 5, cy + 6, LEAF[2]);
    b.set(cx + 6, cy + 6, LEAF[1]);
  }
  // A long witch's nose.
  if (p.hat === 'witch') for (let y = cy + 2; y < cy + 9; y++) for (let x = cx; x <= cx + 2 + Math.floor((y - cy) / 3); x++) b.set(x, y, shade(p.skin, 0.45 - (x - cx) * 0.06, x, y));

  // Beards and moustaches.
  const beard = p.beardColour ?? p.hair ?? BROWN;
  if (p.beard === 'full') fill((x, y) => inEllipse(x, y, cx, cy + 14, 11 - Math.max(0, y - cy - 18) * 0.4, 12) && y > cy + 6 && !(Math.abs(x - cx) < 3 && y < mouthY + 1), (x, y) => shade(beard, lit(x, y, cx, cy + 14, 12) + (hash(x, y >> 1, 9) - 0.5) * 0.25, x, y));
  if (p.beard === 'goatee') fill((x, y) => inEllipse(x, y, cx, mouthY + 4, 2.6, 3.4) && y > mouthY + 1, (x, y) => shade(beard, 0.45 - (x - cx) * 0.05, x, y));
  if (p.beard === 'stubble') fill((x, y) => inEllipse(x, y, cx, cy + 10, 11, 7) && y > cy + 6 && (x + y) % 2 === 0 && !(Math.abs(x - cx) < 4 && Math.abs(y - mouthY) < 1), (x, y) => shade(beard, 0.3, x, y));
  if (p.beard === 'moustache' || p.beard === 'full' || p.beard === 'goatee') {
    for (let x = cx - 5; x <= cx + 5; x++) {
      const droop = Math.abs(x - cx) > 3 ? 1 : 0;
      b.set(x, mouthY - 2 + droop, beard[p.beard === 'full' ? 3 : 1]);
      b.set(x, mouthY - 1 + droop, beard[p.beard === 'full' ? 2 : 0]);
    }
    if (id === 'grimsby') for (const x of [cx - 7, cx - 6, cx + 6, cx + 7]) b.set(x, mouthY - 3, beard[1]); // curled ends
  }

  // Hats.
  const hat = p.hatColour ?? BROWN;
  switch (p.hat) {
    case 'crown': {
      fill((x, y) => y >= 10 && y < 18 && Math.abs(x - cx) <= 13, (x, y) => shade([GOLD[2], GOLD[3], GOLD[5], GOLD[6]], lit(x, y, cx, 14, 13), x, y));
      for (const px of [cx - 12, cx - 6, cx, cx + 6, cx + 12]) fill((x, y) => y >= 3 && y < 10 && Math.abs(x - px) <= (y - 3) * 0.45, (x, y) => shade([GOLD[2], GOLD[3], GOLD[5], GOLD[6]], lit(x, y, px, 7, 4), x, y));
      for (const [jx, jc] of [[cx - 6, BLUE[5]], [cx, RED[5]], [cx + 6, LEAF[6]]] as const) {
        b.set(jx, 14, jc);
        b.set(jx, 13, NEUTRAL[7]);
      }
      break;
    }
    case 'helm': {
      fill((x, y) => inEllipse(x, y, cx, cy - 2, 15, 16) && (y < cy - 3 || Math.abs(x - cx) > 10), (x, y) => shade(hat, lit(x, y, cx, cy - 6, 15) + 0.1, x, y));
      for (let x = cx - 10; x <= cx + 10; x++) b.set(x, cy - 3, INK);
      for (let y = cy - 18; y < cy - 8; y++) for (let x = cx - 1; x <= cx + 1; x++) b.set(x, y, shade(hat, 0.85, x, y));
      // A plume.
      fill((x, y) => inEllipse(x, y, cx + 6, cy - 22, 7, 4), (x, y) => shade([BLUE[2], BLUE[3], BLUE[5], BLUE[6]], lit(x, y, cx + 6, cy - 22, 7), x, y));
      break;
    }
    case 'wizard': {
      fill((x, y) => y >= 13 && y < 18 && Math.abs(x - cx) <= 18, (x, y) => shade(hat, lit(x, y, cx, 15, 18) + 0.1, x, y));
      fill((x, y) => y >= 0 && y < 14 && Math.abs(x - cx - (13 - y) * 0.35) <= (y + 1) * 0.75, (x, y) => shade(hat, lit(x, y, cx + 3, 6, 10) + 0.1, x, y));
      for (const [sx, sy] of [[cx - 3, 10], [cx + 4, 6], [cx - 8, 15]]) b.set(sx, sy, GOLD[6]);
      break;
    }
    case 'hood': {
      fill((x, y) => inEllipse(x, y, cx, cy + 1, 17, 20) && !inEllipse(x, y, cx, cy + 4, 11, 15) && y < 52, (x, y) => shade(hat, lit(x, y, cx, cy, 17), x, y));
      fill((x, y) => inEllipse(x, y, cx, cy - 12, 13, 8), (x, y) => shade(hat, lit(x, y, cx, cy - 12, 13) + 0.05, x, y));
      break;
    }
    case 'feathercap': {
      fill((x, y) => inEllipse(x, y, cx - 1, 15, 16, 6), (x, y) => shade(hat, lit(x, y, cx, 15, 16), x, y));
      for (let x = cx - 16; x <= cx + 14; x++) b.set(x, 19, shade(hat, 0.2, x, 19));
      // A long white feather, sweeping back.
      for (let k = 0; k < 20; k++) {
        const x = cx + 8 + k;
        const y = 12 - Math.round(Math.sin((k / 20) * Math.PI) * 9);
        b.set(x, y, NEUTRAL[7]);
        b.set(x, y + 1, NEUTRAL[5]);
      }
      break;
    }
    case 'kettle': {
      fill((x, y) => inEllipse(x, y, cx, 17, 14, 7) && y <= 18, (x, y) => shade(hat, lit(x, y, cx, 14, 14) + 0.1, x, y));
      for (let x = cx - 19; x <= cx + 19; x++) for (let y = 18; y < 21; y++) b.set(x, y, shade(hat, y === 18 ? 0.8 : 0.35, x, y));
      if (id === 'grimsby') for (let k = 0; k < 10; k++) b.set(cx - 12 - Math.round(k * 0.5), 14 - k, k < 2 ? GOLD[5] : NEUTRAL[7]); // a goose feather
      break;
    }
    case 'witch': {
      const brimY = id === 'bramble' ? 17 : 18;
      for (let x = cx - 22; x <= cx + 22; x++) for (let y = brimY; y < brimY + 3; y++) b.set(x, y + Math.round(Math.abs(x - cx) * 0.06), shade(hat, y === brimY ? 0.8 : 0.4, x, y));
      const tall = id === 'bramble' ? 20 : 16;
      fill((x, y) => y >= brimY - tall && y < brimY && Math.abs(x - cx + (brimY - y) * 0.45 - (brimY - y > tall * 0.7 ? (brimY - y - tall * 0.7) * 1.2 : 0)) <= (y - (brimY - tall)) * 0.5 + 1, (x, y) => shade(hat, lit(x, y, cx, brimY - tall / 2, 12) + 0.15, x, y));
      for (let x = cx - 8; x <= cx + 8; x++) b.set(x, brimY - 2, GOLD[4]);
      break;
    }
    case 'coif': {
      fill((x, y) => inEllipse(x, y, cx, cy + 1, 15, 18) && !inEllipse(x, y, cx, cy + 4, 11, 15) && y < 50, (x, y) => shade(hat, lit(x, y, cx, cy, 15), x, y));
      fill((x, y) => inEllipse(x, y, cx, cy - 12, 8, 5), (x, y) => shade(SKIN, 0.7, x, y)); // tonsure
      break;
    }
    case 'none':
      break;
  }

  // Grimsby's goose, peering over his shoulder.
  if (p.goose) {
    fill((x, y) => inEllipse(x, y, 52, 48, 8, 7), (x, y) => shade(WHITE, lit(x, y, 52, 48, 8) + 0.1, x, y), 38);
    fill((x, y) => inEllipse(x, y, 54, 34, 4, 4) || (Math.abs(x - 53) < 2 && y > 34 && y < 44), (x) => (x < 53 ? NEUTRAL[7] : NEUTRAL[6]), 28);
    for (const [x, y] of [[58, 34], [59, 34], [58, 35], [60, 35]]) b.set(x, y, RED[5]);
    b.set(55, 33, INK);
  }
  return outline(b, INK);
}

/** Every portrait, drawn once. */
const drawn = new Map<PortraitId, Bitmap>();
export function portraitOf(id: PortraitId): Bitmap {
  let p = drawn.get(id);
  if (!p) {
    p = portrait(id);
    drawn.set(id, p);
  }
  return p;
}

