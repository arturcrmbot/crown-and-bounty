import type { TroopId } from '../content/troops';
import { Bitmap, outline, SHADOW } from './bitmap';
import { BLUE, EARTH, FOG, GOLD, INK, LEAF, NEUTRAL, PLUM, RED, SKIN, STONE, WOOD } from './palette';
import { BLUE4, COAT4, DIRT4, flat, GOLD4, RED4, shadowOval, STONE4, WOOD4 } from './sprites';
import { mirror } from './sprites';
import { battleScale, mapScale } from './scale';

export type Pose = 'idle' | 'step' | 'strike';

const LEAF4 = [LEAF[2], LEAF[4], LEAF[6], LEAF[7]];
const PURPLE4 = [RED[0], RED[1], RED[2], GOLD[4]];
const SKIN4 = [SKIN[1], SKIN[2], SKIN[3], SKIN[4]];
const GOBLIN4 = [LEAF[3], LEAF[5], LEAF[7], LEAF[8]];
const TROLL4 = [FOG[3], FOG[5], FOG[7], FOG[8]];
const PLUM4 = [PLUM[0], PLUM[1], PLUM[2], PLUM[3]];

type Look = {
  body: readonly number[];
  legs: readonly number[];
  head: 'helm' | 'hood' | 'straw' | 'kettle' | 'crown' | 'ears' | 'brute' | 'witchhat';
  weapon: 'sword' | 'bow' | 'fork' | 'crossbow' | 'greatsword' | 'spear' | 'club' | 'ladle';
  shield?: readonly number[];
  plume?: number;
  /** Face and hands, if not plain skin. */
  skin?: readonly number[];
};

const LOOKS: Record<Exclude<TroopId, 'wolves' | 'boars'>, Look> = {
  knights: { body: BLUE4, legs: STONE4, head: 'helm', weapon: 'sword', shield: BLUE4, plume: BLUE[5] },
  archers: { body: LEAF4, legs: WOOD4, head: 'hood', weapon: 'bow' },
  peasants: { body: DIRT4, legs: WOOD4, head: 'straw', weapon: 'fork' },
  swordsmen: { body: RED4, legs: STONE4, head: 'helm', weapon: 'sword', shield: RED4, plume: NEUTRAL[7] },
  crossbowmen: { body: RED4, legs: WOOD4, head: 'kettle', weapon: 'crossbow' },
  baron: { body: PURPLE4, legs: STONE4, head: 'crown', weapon: 'greatsword' },
  goblins: { body: DIRT4, legs: GOBLIN4, head: 'ears', weapon: 'spear', skin: GOBLIN4 },
  trolls: { body: DIRT4, legs: TROLL4, head: 'brute', weapon: 'club', skin: TROLL4 },
  witch: { body: PLUM4, legs: PLUM4, head: 'witchhat', weapon: 'ladle' },
  bramble: { body: GOBLIN4, legs: PLUM4, head: 'witchhat', weapon: 'ladle' },
  poachers: { body: DIRT4, legs: WOOD4, head: 'hood', weapon: 'bow' },
  bandits: { body: COAT4, legs: WOOD4, head: 'kettle', weapon: 'sword' },
};

/**
 * One soldier facing right, HoMM2-chunky and storybook-cute: a big round head with bright eyes and
 * rosy cheeks, a round little body, stubby legs and big boots. Four flat shades, lit from the top
 * left. `pose` bends the legs for a step or swings the weapon for a strike.
 */
function soldier(look: Look, pose: Pose, S: number): Bitmap {
  const w = Math.ceil(38 * S);
  const h = Math.ceil(44 * S);
  const sprite = new Bitmap(w, h);
  /** Faces get their glints, cheeks and smiles only where there are pixels enough for them. */
  const big = S >= 1.2;
  const px = (x: number, y: number, c: number) => sprite.set(Math.round(x * S), Math.round(y * S), c);
  const box = (x0: number, y0: number, x1: number, y1: number, shades: readonly number[], lean = 0) => {
    for (let y = Math.floor(y0 * S); y < y1 * S; y++) {
      for (let x = Math.floor(x0 * S); x < x1 * S; x++) {
        const u = (x / S - x0) / (x1 - x0);
        sprite.set(x + Math.round(((y / S - y0) / (y1 - y0)) * lean * S), y, flat(shades, 0.85 - u * 0.55 - (y / S - y0) * 0.01, x, y));
      }
    }
  };
  /** A lit ellipse; with `clip`, rows below that line (in units) are left out. */
  const ellipse = (cx: number, cy: number, rx: number, ry: number, shades: readonly number[], clip = Infinity) => {
    for (let y = Math.floor((cy - ry) * S); y <= (cy + ry) * S; y++) {
      if (y / S > clip) break;
      for (let x = Math.floor((cx - rx) * S); x <= (cx + rx) * S; x++) {
        const u = (x / S - cx) / rx;
        const v = (y / S - cy) / ry;
        if (u * u + v * v > 1) continue;
        sprite.set(x, y, flat(shades, 0.78 - u * 0.35 - v * 0.25, x, y));
      }
    }
  };
  /** A round dot `r` units across, and at least one pixel. */
  const dot = (x: number, y: number, r: number, c: number) => {
    if (r * S < 0.9) return px(x, y, c);
    for (let j = Math.floor((y - r) * S); j <= (y + r) * S; j++) for (let i = Math.floor((x - r) * S); i <= (x + r) * S; i++) if ((i / S - x) ** 2 + (j / S - y) ** 2 <= r * r) sprite.set(i, j, c);
  };
  const skin = look.skin ?? SKIN4;
  const [hx, hy] = [16.6, 11.8];
  const step = pose === 'step' ? 2 : 0;

  // Stubby legs, and big round boots.
  const BOOT4 = [INK, NEUTRAL[1], NEUTRAL[2], NEUTRAL[3]];
  box(12.5 - step, 30, 15.5 - step, 39, look.legs, -step * 0.5);
  box(17.5 + step, 30, 20.5 + step, 39, look.legs, step * 0.5);
  ellipse(13.4 - step * 1.4, 39.8, 2.8, 1.5, BOOT4);
  ellipse(19.6 + step * 1.4, 39.8, 2.8, 1.5, BOOT4);

  // A round little body in its tabard: shoulders rounded off, a belt, and a gold hem.
  const bodyTop = 18;
  const bodyBottom = 31;
  const halfAt = (t: number) => 5.2 + t * 2 - (t < 0.2 ? (0.2 - t) * 9 : 0);
  for (let y = Math.floor(bodyTop * S); y < bodyBottom * S; y++) {
    const t = (y / S - bodyTop) / (bodyBottom - bodyTop);
    const half = halfAt(t);
    for (let x = Math.floor((16 - half) * S); x <= (16 + half) * S; x++) {
      const u = (x / S - (16 - half)) / (half * 2);
      sprite.set(x, y, flat(look.body, 0.88 - u * 0.55 - t * 0.12, x, y));
    }
  }
  const across = (y: number, c: number) => {
    const half = halfAt((y - bodyTop) / (bodyBottom - bodyTop));
    for (let x = 16 - half; x <= 16 + half; x += 0.5) px(x, y, c);
  };
  across(30.4, GOLD[4]);
  if (look.body === BLUE4 || look.body === RED4) for (let y = 19.5; y < 25.5; y += 0.5) px(16.5, y, GOLD[5]);
  across(26, WOOD[1]);
  dot(16.5, 26, 0.7, GOLD[5]);

  // The weapon arm, forward when striking, with a round mitten of a hand. The weapon is drawn a
  // little lower and further out than the old, lankier figure held it, clear of the big head.
  const reach = pose === 'strike' ? 6 : 0;
  const wpx = (x: number, y: number, c: number) => px(x + 1.5, y + 3, c);
  box(20, 19.5, 25 + reach * 0.5, 22.5, look.skin && look.head !== 'witchhat' ? look.skin : look.body);
  if (look.weapon === 'sword' || look.weapon === 'greatsword') {
    const long = look.weapon === 'greatsword' ? 1.5 : 1;
    const bx = 24 + reach;
    for (let i = 0; i < 12 * long; i += 0.5) {
      const x = pose === 'strike' ? bx + i : bx + i * 0.25;
      const y = pose === 'strike' ? 19 - i * 0.15 : 18 - i;
      const tip = i > 12 * long - 1.5;
      if (pose === 'strike') {
        wpx(x, y - 0.5, i < 1 ? GOLD[4] : STONE[7]);
        if (!tip) wpx(x, y, i < 1 ? GOLD[3] : STONE[5]);
      } else {
        wpx(x - 0.5, y, i < 1 ? GOLD[4] : STONE[7]);
        if (!tip) wpx(x, y, i < 1 ? GOLD[3] : STONE[5]);
      }
    }
    // A crossguard.
    for (let k = -1.5; k <= 1.5; k += 0.5) wpx(pose === 'strike' ? bx + 0.6 : bx + k, pose === 'strike' ? 19 + k : 18.4, GOLD[5]);
  } else if (look.weapon === 'fork') {
    for (let i = -8; i < 14; i++) wpx(24 + reach * 0.4 + i * 0.1, 19 - i, WOOD[3]);
    for (const dx of [-1.5, 0, 1.5]) for (let i = 0; i < 4; i++) wpx(24 + reach * 0.4 - 1.4 + dx, 4 - i, STONE[5]);
  } else if (look.weapon === 'bow') {
    for (let i = -9; i <= 9; i++) wpx(25 + reach * 0.3 + Math.cos((i / 9) * 1.3) * 3, 19 + i, WOOD[4]);
    for (let i = -8; i <= 8; i++) wpx(23 + reach * 0.3, 19 + i, NEUTRAL[6]);
  } else if (look.weapon === 'spear') {
    for (let i = -6; i < 16; i++) wpx(24 + reach * 0.6 + i * 0.12, 20 - i, WOOD[3]);
    for (let i = 0; i < 3; i++) wpx(24 + reach * 0.6 + 16 * 0.12 - i * 0.3, 3 - i, STONE[6]);
  } else if (look.weapon === 'club') {
    const tip = pose === 'strike' ? [31, 18] : [26, 6];
    for (let t = 0; t <= 1; t += 0.05) {
      const x = 24 + (tip[0] - 24) * t;
      const y = 19 + (tip[1] - 19) * t;
      const r = 0.6 + t * 1.8;
      for (let dy = -r; dy <= r; dy += 0.5) for (let dx = -r; dx <= r; dx += 0.5) if (dx * dx + dy * dy <= r * r) wpx(x + dx, y + dy, flat(WOOD4, 0.7 - dx * 0.2, Math.round(x + dx), Math.round(y + dy)));
    }
  } else if (look.weapon === 'ladle') {
    for (let i = 0; i < 12; i++) wpx(24 + reach * 0.5 + i * 0.2, 19 - i, WOOD[4]);
    ellipse(26.5 + reach * 0.5, 7.5, 2.2, 1.6, STONE4);
    if (pose === 'strike') for (const [x, y] of [[30, 4], [32, 6], [31, 2], [33, 3]]) wpx(x, y, PLUM[4]);
  } else {
    box(22, 19.5, 30, 21.5, WOOD4);
    for (let i = -3; i <= 3; i++) wpx(29, 19 + i, STONE[5]);
  }
  dot(25.4 + reach * 0.5, 21.2, 1.5, skin[2]);
  if (look.shield) {
    // A big round shield with a gold boss.
    ellipse(9.8, 23.6, 4.8, 5.6, look.shield);
    for (let a = 0; a < Math.PI * 2; a += 0.2) px(9.8 + Math.cos(a) * 4.3, 23.6 + Math.sin(a) * 5.1, GOLD[3]);
    dot(9.8, 23.6, 1.1, GOLD[5]);
  }
  if (look.head === 'crown') {
    // The royal goose, tucked under the Baron's arm and not happy about it.
    ellipse(8, 23.5, 4.8, 3.4, [NEUTRAL[5], NEUTRAL[6], NEUTRAL[7], NEUTRAL[7]]);
    for (let i = 0; i < 6; i++) px(4.5 - i * 0.2, 22.5 - i, NEUTRAL[7]);
    px(3.5, 16.5, GOLD[5]);
    px(2.8, 16.5, GOLD[5]);
    px(4.2, 16.1, INK);
  }

  // What goes behind the head: goblin ears like sails, the witch's grey hair.
  if (look.head === 'ears') {
    for (let t = 0; t <= 1; t += 0.08) {
      dot(hx - 5.8 - t * 3.6, hy - 1 - t * 3.8, 1.8 - t * 1.4, skin[2]);
      dot(hx + 5.6 + t * 3.2, hy - 1 - t * 3.8, 1.8 - t * 1.4, skin[2]);
    }
  } else if (look.head === 'witchhat') {
    for (let y = hy - 2; y < hy + 9; y += 0.5) {
      px(10 - (y - hy) * 0.1, y, NEUTRAL[5]);
      px(10.8 - (y - hy) * 0.1, y + 0.5, NEUTRAL[4]);
    }
  }

  // The big round head.
  ellipse(hx, hy, 6.3, 6, skin);
  if (look.head === 'brute') ellipse(hx + 0.8, hy + 2.4, 6.4, 4.2, skin);

  /** Two big shining eyes looking ahead, rosy cheeks, and a smile. */
  const face = (eyeY: number, eye = INK, smile = true, r = 1.05) => {
    for (const ex of [18.4, 21.6]) {
      if (!big) {
        px(ex, eyeY, eye === INK ? INK : eye);
        continue;
      }
      // A tall oval, dark (or goblin-yellow with a dark pupil), and a white glint at its top left.
      for (let j = Math.floor((eyeY - r * 1.35) * S); j <= (eyeY + r * 1.35) * S; j++) {
        for (let i = Math.floor((ex - r) * S); i <= (ex + r) * S; i++) {
          if (((i / S - ex) / r) ** 2 + ((j / S - eyeY) / (r * 1.35)) ** 2 <= 1) sprite.set(i, j, eye);
        }
      }
      if (eye !== INK) dot(ex + 0.35, eyeY + 0.2, r * 0.55, INK);
      dot(ex - r * 0.35, eyeY - r * 0.5, Math.max(0.35, r * 0.34), NEUTRAL[7]);
    }
    if (!big) return;
    for (const cx of [16.6, 23.4]) {
      px(cx, eyeY + 2.4, RED[5]);
      px(cx + 0.5, eyeY + 2.4, RED[5]);
    }
    if (smile) for (const [x, y] of [[19.2, 0], [19.8, 0.5], [20.6, 0.5], [21.2, 0]]) px(x, eyeY + 3.4 + y, INK);
  };

  if (look.head === 'helm') {
    face(hy + 1.6);
    // An open helm over the top of the head, with a brim and a plume.
    ellipse(hx - 0.2, hy - 1.8, 6.9, 5.2, STONE4, hy - 1.6);
    for (let x = hx - 7; x <= hx + 7; x += 0.5) px(x, hy - 1.4, STONE[2]);
    if (look.plume !== undefined) for (const [x, y] of [[14.4, 5.2], [13.2, 4.4], [12, 4], [10.8, 4.4], [9.8, 5.2], [12.6, 5]]) dot(x, y, 1.2, look.plume);
  } else if (look.head === 'hood') {
    // A hood round the whole head, with the face in its opening and a point trailing behind.
    ellipse(hx - 0.6, hy - 0.2, 7.2, 7, LEAF4);
    for (const [x, y, r] of [[9.2, 7.6, 1.2], [8.4, 6.6, 0.9], [7.8, 5.8, 0.6]]) dot(x, y, r, LEAF[3]);
    ellipse(hx + 1.2, hy + 1, 4.8, 4.6, skin);
    face(hy + 1.2);
  } else if (look.head === 'straw') {
    face(hy + 1.4);
    for (let x = hx - 8.5; x <= hx + 8.5; x += 0.5) {
      px(x, hy - 3.6, GOLD[Math.floor(x * 2) % 3 === 0 ? 3 : 5]);
      px(x, hy - 3.1, GOLD[3]);
    }
    ellipse(hx, hy - 5.6, 5, 2.6, GOLD4);
  } else if (look.head === 'kettle') {
    face(hy + 1.4);
    ellipse(hx, hy - 4.4, 5.8, 3, STONE4);
    for (let x = hx - 8; x <= hx + 8; x += 0.5) {
      px(x, hy - 2.6, STONE[4]);
      px(x, hy - 2.1, STONE[2]);
    }
  } else if (look.head === 'crown') {
    face(hy + 0.4, INK, false);
    // A great grey beard and moustache, and the crown he stole along with the goose.
    ellipse(hx + 1.4, hy + 4, 5, 3.2, [NEUTRAL[4], NEUTRAL[5], NEUTRAL[6], NEUTRAL[7]]);
    dot(19.4, hy + 2.6, 1.4, NEUTRAL[6]);
    dot(21.8, hy + 2.6, 1.4, NEUTRAL[6]);
    for (const x of [11.8, 14.1, 16.4, 18.7, 21]) for (let y = hy - 9.4; y < hy - 5; y += 0.5) px(x, y, y < hy - 8.8 ? GOLD[6] : GOLD[4]);
    for (let x = 11.2; x <= 21.6; x += 0.5) {
      px(x, hy - 5.2, GOLD[4]);
      px(x, hy - 4.7, GOLD[2]);
    }
    dot(16.4, hy - 6.4, 0.8, RED[4]);
  } else if (look.head === 'ears') {
    // Big yellow goblin eyes, and a grin with two teeth.
    face(hy + 0.2, GOLD[6], false, 1.2);
    if (big) {
      for (let x = 18; x <= 22.5; x += 0.5) px(x, hy + 3.4, INK);
      px(19.2, hy + 3.9, NEUTRAL[7]);
      px(21.4, hy + 3.9, NEUTRAL[7]);
    }
  } else if (look.head === 'brute') {
    // A troll: a heavy brow over small eyes, and two tusks.
    face(hy + 0.4, INK, false, 0.7);
    for (let x = hx - 6; x <= hx + 6.5; x += 0.5) {
      px(x, hy - 1.2, skin[0]);
      px(x, hy - 0.7, skin[0]);
    }
    for (const x of [18.6, 22]) {
      px(x, hy + 5, NEUTRAL[7]);
      px(x, hy + 4.4, NEUTRAL[7]);
    }
  } else if (look.head === 'witchhat') {
    face(hy + 1.4);
    // A long nose, and a tall crooked hat with a buckle.
    dot(23.3, hy + 1.6, 1, skin[2]);
    px(24.3, hy + 2, skin[2]);
    for (let x = hx - 9; x <= hx + 9; x += 0.5) {
      px(x, hy - 3.8, PLUM[1]);
      px(x, hy - 3.3, PLUM[2]);
    }
    for (let y = 0; y < 8; y += 0.5) {
      const half = 4.5 - y * 0.5;
      const lean = -y * 0.55;
      for (let x = hx - half + lean; x <= hx + half + lean; x += 0.5) px(x, hy - 3.8 - y, y > 6 ? PLUM[2] : PLUM[1]);
    }
    for (let x = hx - 4.2; x <= hx + 4.2; x += 0.5) px(x, hy - 4.6, PLUM[3]);
    dot(hx, hy - 4.6, 0.6, GOLD[5]);
  }
  const shaped = outline(sprite, INK);
  shadowOval(shaped, 19 * S, 41 * S, 10 * S, 2.4 * S);
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

/** A wild boar at map size, facing right: bristly back, tusks, and little legs going like pistons. */
function boarSmall(pose: Pose): Bitmap {
  const sprite = new Bitmap(44, 28);
  const lunge = pose === 'strike' ? 3 : 0;
  const leg = pose === 'step' ? 2 : 0;
  const BRISTLE4 = [EARTH[1], EARTH[2], EARTH[4], EARTH[5]];
  const ell = (cx: number, cy: number, rx: number, ry: number, bias: number) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const u = (x + 0.5 - cx) / rx;
        const v = (y + 0.5 - cy) / ry;
        if (u * u + v * v <= 1) sprite.set(x, y, flat(BRISTLE4, bias - v * 0.35 - u * 0.08, x, y));
      }
    }
  };
  for (const [x, dx] of [[12, -leg], [16, leg], [25, leg], [29, -leg]]) for (let y = 19; y < 25; y++) sprite.set(x + (dx * (y - 19)) / 6, y, y > 23 ? INK : EARTH[1]);
  ell(21, 15, 12, 7, 0.55);
  ell(33 + lunge, 15, 6, 5, 0.5);
  ell(38 + lunge, 17, 2.8, 2.4, 0.35);
  for (let x = 10; x < 30; x += 2) sprite.set(x, 8 + (x % 4 === 0 ? 0 : 1), EARTH[0]);
  sprite.set(32 + lunge, 12, INK);
  sprite.set(31 + lunge, 9, EARTH[1]);
  for (const [x, y] of [[38, 15], [39, 14], [40, 13]]) sprite.set(x + lunge, y, NEUTRAL[7]);
  for (let i = 0; i < 4; i++) sprite.set(9 - i, 13 + (i % 2), EARTH[1]);
  const shaped = outline(sprite, INK);
  shadowOval(shaped, 24, 24, 15, 2.2);
  return shaped;
}

/** A wild boar at battle size: drawn at map size and doubled, like the wolf. */
function boar(pose: Pose): Bitmap {
  const small = boarSmall(pose);
  const sprite = new Bitmap(small.width * 2, small.height * 2);
  for (let y = 0; y < sprite.height; y++) for (let x = 0; x < sprite.width; x++) sprite.data[y * sprite.width + x] = small.data[(y >> 1) * small.width + (x >> 1)];
  return sprite;
}

const cache = new Map<string, Bitmap>();

/**
 * A troop's figure at any scale: `battle` size for the battlefield, `map` size for the one creature
 * that stands for a stack on the adventure map. Facing 1 is right.
 */
export function troopFigure(troop: TroopId, facing: 1 | -1, pose: Pose, size: 'battle' | 'map'): Bitmap {
  const key = `${troop}/${facing}/${pose}/${size}`;
  let sprite = cache.get(key);
  if (!sprite) {
    const right =
      troop === 'wolves'
        ? size === 'battle' ? wolf(pose) : wolfSmall(pose)
        : troop === 'boars'
          ? size === 'battle' ? boar(pose) : boarSmall(pose)
          : soldier(LOOKS[troop], pose, size === 'battle' ? battleScale(troop) : mapScale(troop));
    sprite = facing > 0 ? right : mirror(right);
    cache.set(key, sprite);
  }
  return sprite;
}

/** The sprite for a stack on the battlefield: its troop, facing (1 is right), and pose. */
export const troopSprite = (troop: TroopId, facing: 1 | -1, pose: Pose = 'idle') => troopFigure(troop, facing, pose, 'battle');

/** Pixels from the top of a figure to its feet. */
export function figureFoot(troop: TroopId, size: 'battle' | 'map'): number {
  if (troop === 'wolves') return size === 'battle' ? 52 : 26;
  if (troop === 'boars') return size === 'battle' ? 48 : 24;
  return Math.round(41 * (size === 'battle' ? battleScale(troop) : mapScale(troop)));
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

export const FIGHTER_FOOT = (troop: TroopId) => figureFoot(troop, 'battle');
export { BLUE4, RED4 };

const corpses = new Map<string, { sprite: Bitmap; dx: number; dy: number }>();

/**
 * A fallen stack: its figure laid on its back (away from the enemy), dimmed, with no shadow. `dx`
 * and `dy` put its middle and its lowest pixel on a point.
 */
export function corpseSprite(troop: TroopId, facing: 1 | -1): { sprite: Bitmap; dx: number; dy: number } {
  const key = `${troop}/${facing}`;
  let corpse = corpses.get(key);
  if (!corpse) {
    const up = troopSprite(troop, facing, 'idle');
    const out = new Bitmap(up.height, up.width);
    let [x0, x1, y1] = [out.width, 0, 0];
    for (let y = 0; y < up.height; y++) {
      for (let x = 0; x < up.width; x++) {
        const v = up.get(x, y);
        if (!v || v === SHADOW) continue;
        // Head away from the enemy: a stack facing right falls to the left.
        const [nx, ny] = facing > 0 ? [y, up.width - 1 - x] : [up.height - 1 - y, x];
        out.set(nx, ny, v === INK ? INK : DIM[v] ?? v);
        [x0, x1, y1] = [Math.min(x0, nx), Math.max(x1, nx), Math.max(y1, ny)];
      }
    }
    corpse = { sprite: out, dx: Math.round((x0 + x1) / 2), dy: y1 };
    corpses.set(key, corpse);
  }
  return corpse;
}

/** Each colour a few shades down its own ramp, for the fallen. */
const DIM: Record<number, number> = {};
for (const ramp of [BLUE4, RED4, COAT4, DIRT4, GOLD4, STONE4, WOOD4, LEAF4, PURPLE4, SKIN4, GOBLIN4, TROLL4, PLUM4]) {
  for (const [i, c] of ramp.entries()) DIM[c] ??= ramp[Math.max(0, i - 2)];
}
for (const ramp of [BLUE, RED, GOLD, STONE, WOOD, NEUTRAL, SKIN, LEAF, PLUM, FOG, EARTH]) for (const [i, c] of ramp.entries()) DIM[c] ??= ramp[Math.max(0, i - 2)];

export type Standard = { cloth: readonly number[]; emblem: 'goose' | 'moon' | 'skull' | 'star' };

/**
 * A commander's standard on a tall pole, its cloth swallow-tailed and flapping with `phase`, with an
 * emblem on it: the royal star for Aldric, a goose for Grimsby's men, a moon for the fen.
 */
export function standard({ cloth, emblem }: Standard, phase: number, facing: 1 | -1): Bitmap {
  const w = 58;
  const h = 118;
  const s = new Bitmap(w, h);
  const pole = 6;
  for (let y = 4; y < h - 4; y++) for (const dx of [0, 1]) s.set(pole + dx, y, dx ? WOOD[1] : WOOD[3]);
  for (let y = 0; y < 5; y++) for (let x = pole - 2; x <= pole + 3; x++) if (Math.hypot(x - pole - 0.5, y - 2.5) < 2.6) s.set(x, y, y < 2 ? GOLD[6] : GOLD[4]);
  const top = 8;
  const deep = 34;
  for (let i = 0; i < w - pole - 4; i++) {
    const wave = Math.sin(i / 7 - phase * Math.PI * 2) * (1 + i / 16);
    const tail = i > w - pole - 18;
    for (let j = 0; j < deep; j++) {
      // Swallowtail: a notch cut into the flying end.
      if (tail && Math.abs(j - deep / 2) < (i - (w - pole - 18)) * 0.9) continue;
      const x = pole + 2 + i;
      const y = Math.round(top + j + wave);
      const u = i - 18;
      const v = j - deep / 2;
      let c = flat(cloth, j === 0 || j === deep - 1 ? 0.95 : 0.6 - Math.cos(i / 7 - phase * Math.PI * 2) * 0.2, x, y);
      if (j < 2 || j > deep - 3) c = GOLD[4];
      else if (emblem === 'goose' && (Math.hypot(u * 0.8, v - 1) < 6 || Math.hypot(u - 5, v + 5) < 2.6 || (u > 6 && u < 10 && Math.abs(v + 5) < 1))) c = u > 7 && v < -3 ? GOLD[5] : NEUTRAL[7];
      else if (emblem === 'moon' && Math.hypot(u, v) < 8 && Math.hypot(u + 4, v - 2) > 7) c = NEUTRAL[6];
      else if (emblem === 'skull' && ((Math.hypot(u, v - 2) < 6.5 && !(Math.hypot(u - 2.5, v - 2) < 1.8 || Math.hypot(u + 2.5, v - 2) < 1.8)) || (Math.abs(u) < 3.5 && v > 5 && v < 9 && Math.round(u) % 2 !== 0))) c = NEUTRAL[7];
      else if (emblem === 'star' && Math.hypot(u, v) < 3 + 3 * Math.pow(Math.abs(Math.cos(Math.atan2(v, u) * 2.5)), 6)) c = GOLD[5];
      s.set(x, y, c);
    }
  }
  const shaped = outline(s, INK);
  shadowOval(shaped, pole + 1, h - 4, 7, 2);
  return facing > 0 ? shaped : mirror(shaped);
}
