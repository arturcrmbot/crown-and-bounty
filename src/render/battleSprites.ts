import { Bitmap, outline, SHADOW } from './bitmap';
import { COLORS, GOLD, INK, NEUTRAL, WOOD } from './palette';
import { flat, mirror, shadowOval } from './sprites';
import { unitLift, unitScale, type Size } from './scale';
import { ART, type ArtId, type Frame } from './units';
import { nearestTint, unitBitmap, unitImage, type Team } from './wesnoth';
import { paintedFigure } from './mapArt';

/** What a stack is doing, and how far into it: a Wesnoth animation and the milliseconds since it began. */
export type AnimName = 'stand' | 'idle' | 'move' | 'melee' | 'charge' | 'cast' | 'ranged' | 'defend' | 'defendRanged' | 'death';
export type Pose = { anim: AnimName; ms: number };
export const STAND: Pose = { anim: 'stand', ms: 0 };

/** The frames of one of a troop's animations; a missing one falls back to the nearest it has. */
export function animFrames(troop: ArtId, anim: AnimName): Frame[] {
  const art = ART[troop];
  const still = (image: string): Frame[] => [{ image, ms: 100 }];
  switch (anim) {
    case 'idle':
      return art.idle ?? still(art.stand);
    case 'move':
      return art.move ?? still(art.stand);
    case 'melee':
      return art.melee.frames;
    case 'charge':
      return (art.charge ?? art.melee).frames;
    case 'cast':
      return art.cast ?? still(art.stand);
    case 'ranged':
      return (art.ranged ?? art.melee).frames;
    case 'defend':
      return still(art.defend);
    case 'defendRanged':
      return still(art.defendRanged ?? art.defend);
    case 'death':
      return art.death ?? still(art.defend);
    case 'stand':
      return still(art.stand);
  }
}

/** How long an animation runs, in milliseconds. */
export const animLength = (troop: ArtId, anim: AnimName) => animFrames(troop, anim).reduce((t, f) => t + f.ms, 0);

/** When an attack's blow lands (or its shot or spell arrives), in milliseconds from its start. */
export function hitTime(troop: ArtId, anim: 'melee' | 'charge' | 'ranged'): number {
  const art = ART[troop];
  return (anim === 'charge' ? (art.charge ?? art.melee) : anim === 'ranged' ? (art.ranged ?? art.melee) : art.melee).hit;
}

/** The image an animation shows at `ms`: moves and fidgets loop, everything else holds its last frame. */
export function imageAt(troop: ArtId, { anim, ms }: Pose): string {
  const list = animFrames(troop, anim);
  const total = list.reduce((t, f) => t + f.ms, 0);
  let t = anim === 'move' || anim === 'idle' ? ms % total : Math.min(ms, total - 1);
  for (const f of list) {
    if (t < f.ms) return f.image;
    t -= f.ms;
  }
  return list[list.length - 1].image;
}

/** A frame, and where its top left goes from the point where the troop stands. */
export type Figure = { sprite: Bitmap; x: number; y: number };

/** How far below its image's centre a unit's feet are, and how far above them its head: from its standing frame. */
const metrics = new Map<ArtId, { foot: number; head: number }>();
function measure(troop: ArtId) {
  let m = metrics.get(troop);
  if (!m) {
    const { width, height, data } = unitImage(ART[troop].stand);
    let [top, bottom] = [height, 0];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] < 250) continue;
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    m = { foot: bottom + 1 - height / 2, head: bottom + 1 - top };
    metrics.set(troop, m);
  }
  return m;
}

/** The rows a sprite paints, top and bottom. */
function rows(sprite: Bitmap): [number, number] {
  let [top, bottom] = [sprite.height, 0];
  for (let y = 0; y < sprite.height; y++) {
    for (let x = 0; x < sprite.width; x++) {
      const v = sprite.data[y * sprite.width + x];
      if (v === 0 || v === SHADOW) continue;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return [top, bottom];
}

/** Pixels from a troop's feet to the top of its head, at a size. */
export function bodyHeight(troop: ArtId, size: Size): number {
  const painted = paintedFigure(troop, size);
  if (painted) {
    const [top, bottom] = rows(painted);
    return bottom + 1 - top;
  }
  return Math.round(measure(troop).head * unitScale(size, troop));
}

const paintedSprites = new Map<string, { sprite: Bitmap; foot: number }>();
/**
 * A troop's painted figure (#178) doing `pose`: one picture, which the game moves itself, as the 90s
 * games did. It breathes as it waits, bobs as it walks, lunges into a blow, rocks back from a shot or
 * a spell, and flinches when hit. Its colours are its own, whichever side it's on.
 */
function paintedPose(troop: ArtId, facing: 1 | -1, { anim, ms }: Pose, size: Size): Figure | null {
  const base = paintedFigure(troop, size);
  if (!base) return null;
  const key = `${troop}|${facing}|${size}`;
  let made = paintedSprites.get(key);
  if (!made) {
    // A few clear rows over the head, as Wesnoth's frames have, so a bob or a lift never clips it.
    const HEADROOM = 6;
    const padded = new Bitmap(base.width + 2, base.height + HEADROOM);
    for (let y = 0; y < base.height; y++) padded.data.set(base.data.subarray(y * base.width, (y + 1) * base.width), (y + HEADROOM) * padded.width + 1);
    let sprite = size === 'map' ? outline(padded, INK) : padded;
    if (facing < 0) sprite = mirror(sprite);
    made = { sprite, foot: rows(sprite)[1] + 1 };
    paintedSprites.set(key, made);
  }
  const reach = size === 'battle' ? 10 : 4;
  let [dx, dy] = [0, 0];
  if (anim === 'idle') dy = Math.floor(ms / 400) % 2 ? -1 : 0;
  else if (anim === 'move') dy = -Math.round(Math.abs(Math.sin(ms / 110)) * (size === 'battle' ? 3 : 2));
  else if (anim === 'melee' || anim === 'charge' || anim === 'ranged' || anim === 'cast') {
    const hit = Math.max(1, hitTime(troop, anim === 'cast' ? 'ranged' : anim));
    const swing = ms < hit ? ms / hit : Math.max(0, 1 - (ms - hit) / 220);
    // A blow carries him forward into it; a shot or a spell rocks him back a little.
    dx = Math.round(facing * swing * (anim === 'melee' || anim === 'charge' ? reach * (anim === 'charge' ? 1.6 : 1) : -reach * 0.3));
    dy = anim === 'melee' || anim === 'charge' ? -Math.round(swing * 2) : 0;
  } else if (anim === 'defend' || anim === 'defendRanged' || anim === 'death') dx = -facing * (size === 'battle' ? 4 : 2);
  return { sprite: made.sprite, x: -Math.round(made.sprite.width / 2) + dx, y: -made.foot + dy };
}

const sprites = new Map<string, Bitmap>();
function frameBitmap(troop: ArtId, image: string, team: Team, facing: 1 | -1, size: Size): Bitmap {
  const scale = unitScale(size, troop);
  const key = `${image}|${team}|${facing}|${size}|${scale}`;
  let sprite = sprites.get(key);
  if (!sprite) {
    sprite = unitBitmap(image, team, scale, unitLift(size));
    // On the map, an ink line round the figure, as every map sprite has: it keeps a small figure
    // clear of the grass.
    if (size === 'map') sprite = outline(sprite, INK);
    if (facing < 0) sprite = mirror(sprite);
    sprites.set(key, sprite);
  }
  return sprite;
}

/**
 * A troop as Wesnoth drew it, doing `pose`, for the battlefield or the one creature that stands for
 * a stack on the map. Facing 1 is right. Every frame is centred where the standing frame is, as in
 * Wesnoth, so the feet stay put whatever the frame's size.
 */
export function troopFigure(troop: ArtId, team: Team, facing: 1 | -1, pose: Pose, size: Size): Figure {
  const painted = paintedPose(troop, facing, pose, size);
  if (painted) return painted;
  return place(troop, frameBitmap(troop, imageAt(troop, pose), team, facing, size), size);
}

function place(troop: ArtId, sprite: Bitmap, size: Size): Figure {
  const foot = measure(troop).foot * unitScale(size, troop);
  return { sprite, x: -Math.round(sprite.width / 2), y: -Math.round(sprite.height / 2 + foot) };
}

/** An animation's frames taken every `step` ms, for clocks that turn at a steady rate. */
export function everyFrame(troop: ArtId, anim: AnimName, team: Team, facing: 1 | -1, size: Size, step: number): Bitmap[] {
  const count = Math.max(1, Math.round(animLength(troop, anim) / step));
  return Array.from({ length: count }, (_, i) => troopFigure(troop, team, facing, { anim, ms: i * step }, size).sprite);
}

/** A lookup from each colour to another, worked out once. */
function tint(mix: (rgb: readonly [number, number, number]) => [number, number, number]): Uint8Array {
  return Uint8Array.from({ length: 256 }, (_, i) => (i === 0 || i === SHADOW || i >= COLORS.length ? i : nearestTint(...mix(COLORS[i]))));
}
let hurt: Uint8Array | null = null;
let dim: Uint8Array | null = null;

/** The same sprite blended half with red, as Wesnoth flashes a unit that is hit. */
export function hurtSprite(sprite: Bitmap): Bitmap {
  hurt ??= tint(([r, g, b]) => [Math.round(r * 0.5 + 127), Math.round(g * 0.5), Math.round(b * 0.5)]);
  const out = new Bitmap(sprite.width, sprite.height);
  for (let i = 0; i < sprite.data.length; i++) out.data[i] = hurt[sprite.data[i]];
  return out;
}

const corpses = new Map<string, Figure>();

/**
 * A fallen stack: the last frame of its death where Wesnoth drew one, otherwise its flinch laid on
 * its back (head away from the enemy). Dimmed, and with no shadow when laid down.
 */
export function corpseSprite(troop: ArtId, team: Team, facing: 1 | -1): Figure {
  const key = `${troop}/${team}/${facing}`;
  let corpse = corpses.get(key);
  if (!corpse) {
    dim ??= tint(([r, g, b]) => [Math.round(r * 0.7), Math.round(g * 0.7), Math.round(b * 0.76)]);
    const shade = (v: number) => (v === SHADOW ? SHADOW : dim![v]);
    const painted = paintedPose(troop, facing, STAND, 'battle');
    if (!painted && ART[troop].death) {
      const last = troopFigure(troop, team, facing, { anim: 'death', ms: animLength(troop, 'death') }, 'battle');
      const sprite = new Bitmap(last.sprite.width, last.sprite.height);
      for (let i = 0; i < sprite.data.length; i++) sprite.data[i] = shade(last.sprite.data[i]);
      corpse = { sprite, x: last.x, y: last.y };
    } else {
      const up = painted?.sprite ?? frameBitmap(troop, ART[troop].defend, team, facing, 'battle');
      const out = new Bitmap(up.height, up.width);
      let [x0, x1, y1] = [out.width, 0, 0];
      for (let y = 0; y < up.height; y++) {
        for (let x = 0; x < up.width; x++) {
          const v = up.get(x, y);
          if (!v || v === SHADOW) continue;
          // A stack facing right falls to the left.
          const [nx, ny] = facing > 0 ? [y, up.width - 1 - x] : [up.height - 1 - y, x];
          out.set(nx, ny, shade(v));
          [x0, x1, y1] = [Math.min(x0, nx), Math.max(x1, nx), Math.max(y1, ny)];
        }
      }
      corpse = { sprite: out, x: -Math.round((x0 + x1) / 2), y: -y1 };
    }
    corpses.set(key, corpse);
  }
  return corpse;
}

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

/** A troop's figure standing, for the cards and the hero screen: painted if it's loaded, else Wesnoth's at `scale`. */
export function standingFigure(troop: ArtId, team: Team, scale: number): Bitmap {
  const painted = paintedFigure(troop, scale >= 1 ? 'battle' : 'map');
  return painted ?? unitBitmap(ART[troop].stand, team, scale);
}
