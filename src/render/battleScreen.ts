import { abilitiesOf, TROOPS, type TroopId } from '../content/troops';
import { SPELLS, STATUSES, type SpellId } from '../content/spells';
import { canCast, hasTurn, isLeader, lookOf, luckOf, moraleOf, speedOf, statsOf, unitOf, type BattleState, type Fighter } from '../rules/battle/battle';
import { capital, roman } from '../rules/state';
import { HEXES, hexIndex, ROWS } from '../rules/battle/hex';
import { FIELD_W, HALF_H, HEX_W, hexAt, hexCentre, insideHex, ROW_H, sideAt, X0, Y0 } from './battleHexes';
import { Bitmap, blit, SHADOW } from './bitmap';
import { critters, critterSprite, type Critter } from './critters';
import { animLength, bodyHeight, corpseSprite, hurtSprite, standard, STAND, toppledFigure, troopFigure, whiteSprite, type Pose, type Standard } from './battleSprites';
import { upcomingFighters } from './battleOrder';
import { ART } from './units';
import { drawBanner } from './banner';
import { TIP } from './speech';
import { BAR, MAP_VIEW, paintBarBackground, paintFrame, SCREEN, type Rect } from './frame';
import { bayer, fbm, hash, noise, shade } from './noise';
import { CUE_PING, FRAME, rolled } from './juice';
import { rotateAbout } from './rotate';
import { drawPops, type Pop } from './pops';
import { ground, piece } from './mapArt';
import type { PieceName } from './mapPieces';
import { BLUE, CYCLE_BOG, DANGER_LUT, EARTH, GOLD, GRASS, INK, LEAF, LIGHT_LUT, NEUTRAL, PARCHMENT, PLUM, RED, REED, SHADOW_LUT, STONE, WOOD } from './palette';
import { boulder, mirror, oak, pine, willow } from './sprites';
import { bigLettering, drawText, lettered, textMask } from './text';

/** The King's blue with his gold star, over Aldric's side. */
const ROYAL: Standard = { cloth: [BLUE[1], BLUE[2], BLUE[3], BLUE[4]], emblem: 'star' };

/** Aldric, or a villain: one of a kind, a name rather than a number. */
const oneOfAKind = (f: Fighter) => TROOPS[f.troop].name === TROOPS[f.troop].one;
/** A leader's figure is drawn inside this box round where he stands, for pointing at him. */
const LEADER_BOX = { half: 34, above: 96, below: 14 };

/** Whose standard flies over the enemy: Grimsby's goose (over his huntsman's wolves too), the fen's moon, a skull for outlaws; beasts carry none. */
function standardOf(troops: TroopId[]): Standard | null {
  const has = (...ids: TroopId[]) => troops.some((t) => ids.includes(t));
  if (has('baron', 'rook', 'swordsmen', 'crossbowmen', 'pikemen', 'menAtArms', 'sergeant', 'pike', 'foreman', 'picketCaptain')) return { cloth: [RED[1], RED[2], RED[3], RED[4]], emblem: 'goose' };
  if (has('witch', 'bramble', 'goblins', 'trolls')) return { cloth: [PLUM[1], PLUM[2], PLUM[3], PLUM[4]], emblem: 'moon' };
  if (has('bandits', 'poachers', 'cutpurses', 'cutpurseCaptain', 'highwaymanCaptain', 'poacherCaptain')) return { cloth: [LEAF[0], LEAF[1], LEAF[2], LEAF[3]], emblem: 'skull' };
  return null;
}

/** Now and then a stack that waits fidgets, as its Wesnoth unit does, each on its own clock. */
function fidget(troop: TroopId, id: number, time: number): Pose {
  if (!ART[troop].idle || time === 0) return STAND;
  const period = 6 + ((id * 2.3) % 5);
  const ms = (((time + id * 1.7) % period) - (period - animLength(troop, 'idle') / 1000)) * 1000;
  return ms >= 0 ? { anim: 'idle', ms } : STAND;
}

/** The rows a side's leaders stand level with, behind its line: the first in the middle, any more below and above. */
const LEADER_ROWS = [4, 7, 1];

/**
 * Where a fighter stands on screen: its hex's centre, or, for a leader, his place behind his side's
 * line, off the field beside his standard.
 */
export function spotOf(b: BattleState, f: Fighter): [number, number] {
  if (!isLeader(f)) return hexCentre(f.at);
  const k = b.fighters.filter((o) => o.side === f.side && isLeader(o)).findIndex((o) => o.id === f.id);
  const [, y] = hexCentre(hexIndex(0, LEADER_ROWS[k % LEADER_ROWS.length]));
  return [f.side === 'player' ? X0 - 52 : X0 + FIELD_W + 52, y];
}

/** The leader whose figure is under the point, if any. */
export function leaderAt(b: BattleState, x: number, y: number): Fighter | null {
  return b.fighters.find((f) => {
    if (f.count <= 0 || !isLeader(f)) return false;
    const [cx, cy] = spotOf(b, f);
    return Math.abs(x - cx) <= LEADER_BOX.half && y >= cy - LEADER_BOX.above && y <= cy + LEADER_BOX.below;
  }) ?? null;
}

export type Floater = { x: number; y: number; text: string; color: number; age: number };
/** How far a floater rises over its one-second life. */
export const FLOAT_RISE = 30;
/** How long a floater lasts, and how long it takes to dither away at the end. */
export const FLOAT_LIFE = 1;
const FLOAT_FADE = 0.25;
/** The message ribbon across the top of the field. */
const LOG_TOP = MAP_VIEW.y + 6;
export const LOG_BOTTOM = LOG_TOP + 18;
/** The bottom of the strip of next turns under the ribbon: words over the field stay under it (#211). */
export const stripBottom = () => LOG_BOTTOM + 2 + (bigLettering() ? 24 : 20);
/**
 * A missile, a spell or a burst. A spark's `size` scales it, and its `heading` (radians) is the way
 * the blow went, for the chips it flings; dust's `size` is how wide it spreads along the ground. An
 * arrow's `arc` is how high it flies. A burst that runs by itself goes `rate` of its life a second.
 */
export type Shot = {
  from: [number, number];
  to: [number, number];
  t: number;
  kind: 'arrow' | 'quarrel' | 'hex' | 'magic' | 'gather' | 'bolt' | 'fire' | 'sparkle' | 'spark' | 'blood' | 'poof' | 'dust' | 'rainbow' | 'ring' | 'cloud' | 'motes' | 'smoke';
  color?: number;
  size?: number;
  heading?: number;
  arc?: number;
  rate?: number;
};
/** How much of a fireball's flight is the fall from the sky; it bursts after that. */
export const FIRE_FALL = 0.35;

const turnIcons = new Map<string, Bitmap>();

function turnIcon(troop: Fighter['troop'], side: Fighter['side']) {
  const team = side === 'player' ? 'blue' : 'red';
  const key = `${troop}|${team}`;
  let icon = turnIcons.get(key);
  if (!icon) {
    const figure = troopFigure(troop, team, side === 'player' ? 1 : -1, STAND, 'map').sprite;
    const scale = Math.min(16 / figure.width, 16 / figure.height, 1);
    icon = new Bitmap(Math.max(1, Math.round(figure.width * scale)), Math.max(1, Math.round(figure.height * scale)));
    for (let y = 0; y < icon.height; y++) {
      for (let x = 0; x < icon.width; x++) icon.set(x, y, figure.get(Math.floor(x / scale), Math.floor(y / scale)));
    }
    turnIcons.set(key, icon);
  }
  return icon;
}

/** What the battle controller wants drawn this frame, on top of the rules state. */
export type BattleView = {
  /** Where a stack is drawn while it walks, instead of its hex. */
  positions: Map<number, [number, number]>;
  /** A lunge or a reel: the figure moves, its count stays on its hex. */
  offsets: Map<number, [number, number]>;
  /** Which way a stack looks while it fights or walks against its side's way. */
  facings: Map<number, 1 | -1>;
  /** What a stack's badge says while blows play out: its count from before the action, until each hit lands. */
  counts: Map<number, number>;
  /** The same for the top troop's health, for the bar: it drops as each blow lands. */
  health: Map<number, number>;
  poses: Map<number, Pose>;
  flashing: Set<number>;
  /** Stacks shown as a white shape: the frame a blow lands on them (#190). */
  whites: Set<number>;
  /** Fighters still drawn although the rules have them dead, until their hit plays out. */
  dying: Set<number>;
  /** The last of a stack falling over (#190), and how far it has tipped, in degrees. */
  topple: Map<number, number>;
  /** Which way each fallen stack was facing as it fell, so its corpse lies the way it fell. */
  fallen: Map<number, 1 | -1>;
  /** Leaders lifted off the ground (a hop for joy) or sunk into it (they sag), in pixels, as a stack falls (#190). */
  lifts: Map<number, number>;
  /** A stack drawn just in front of another while a blow lands on it (#190): the one it's in front of, so a rider never hides his target. */
  front: Map<number, number>;
  /**
   * The standards at the end (#190): the King's star flapping `fast` at a victory, or dipped
   * `dip` degrees in a defeat, and the enemy's tipped over `fall` degrees. `dusk` darkens the
   * field a shade (0 to 1) as a defeat sinks in.
   */
  ending: { fast: boolean; dip: number; fall: number; dusk: number };
  /** The whole field lit up as Lightning strikes (#190), for this many more seconds. */
  flash: number;
  /** Ground lit round a Fireball as it bursts (#190): where, how far, and how strongly (0 to 1). */
  light: { x: number; y: number; radius: number; strength: number } | null;
  /** One of your stacks is ready for orders (#190): its hex pings and it bounces, `age` seconds in. */
  cue: { fighter: number; age: number } | null;
  /** Stacks the rules have on the field that haven't got there yet: one a bard's gold bought over, till it comes in. */
  hidden: Set<number>;
  /** What a stack looks like while a change plays out (newts, or null for itself), instead of what its statuses say. */
  looks: Map<number, Critter | null>;
  reach: Set<number>;
  /** What a click on the hex under the pointer would do, and for a blow, the hex it is struck from. */
  hover: { hex: number; kind: 'move' | 'melee' | 'shoot' | 'spell' | 'bard'; from?: number } | null;
  /** The stacks that click would reach, lit: `target` for those it's aimed at, `danger` for your own it would hurt too. */
  lit: ReadonlyMap<number, 'target' | 'danger'>;
  floaters: Floater[];
  /** Kills and wounds popping out of the stacks' badges (#190). */
  pops: Pop[];
  /** Badges rolling down to their new count, `age` seconds in (#190). */
  rolls: Map<number, { from: number; to: number; age: number }>;
  shots: Shot[];
  log: string;
  /** Whose turn it is, for the bar. */
  active: number | null;
  /** A stack (or a leader) under the pointer: the bar shows it instead of the acting one. */
  inspect: number | null;
  /** What the pointed-at action would do, shown instead of the log. */
  preview: string | null;
  targeting: string | null;
  /** A bard is taking his turn: the Defend button sings instead. */
  bard: boolean;
  /** Seconds since the battle opened, for breathing and flags. */
  time: number;
  /** How hard the field shakes this frame, in pixels, every way at random. */
  shake: number;
  /** How far the field is kicked this frame, the way the last blow went (#190), in pixels. */
  kick: [number, number];
  /** VICTORY or DEFEAT across the field at the end. */
  banner: { sprite: Bitmap; age: number; life: number } | null;
  /** A leader's last words, in a bubble over his head (`render/speech.ts`), for `life` seconds. */
  speech: { fighter: number; bubble: Bitmap; age: number; life: number } | null;
  /** The safe-finish offer replaces Auto in the bar while the player can accept it. */
  finishOffer: boolean;
  /** Played by touch: there's no Esc to cancel a spell, but the rail's Cancel. */
  touch?: boolean;
};

export const BUTTONS: { id: 'spells' | 'wait' | 'defend' | 'auto' | 'retreat'; label: string; rect: Rect }[] = ['spells', 'wait', 'defend', 'auto', 'retreat'].map((id, i) => ({
  id: id as 'spells',
  label: { spells: 'Spells', wait: 'Wait', defend: 'Defend', auto: 'Auto', retreat: 'Retreat' }[id]!,
  rect: { x: BAR.x + BAR.width - 5 * 66 - 6 + i * 66, y: BAR.y + 3, width: 62, height: BAR.height - 6 },
}));

/**
 * The field on Aldmoor's painted ground (#178), as HoMM2's grass battlefield is: the map's own grass
 * rolling in long swells of light, worn paths curling across it, tufts and flowers, a wall of big trees
 * along the top and in the corners, and the battle's own rocks, trees and brambles for the obstacles.
 */
const OBSTACLES: PieceName[] = ['bRock', 'bOak', 'bRock2', 'bFir', 'bBramble', 'bRock3', 'bOak2', 'bStump', 'bRock4', 'bOak3', 'bFir2', 'bRock5', 'bOak4', 'bPond'];
const EDGE_TREES: PieceName[] = ['bOak', 'bFir', 'bOak2', 'bOak3', 'bFir2', 'bOak4'];
const SPRIGS: PieceName[] = ['decor12', 'decor13', 'decor14', 'decor15', 'decor16', 'decor6', 'decor7', 'decor8', 'decor9', 'decor10', 'decor11'];
const BEDS: PieceName[] = ['bedYellow', 'bedYellow2', 'bedRed', 'bedRed2', 'bedRed3', 'bedPink', 'bedPurple'];

function paintedField(obstacles: number[], seed: number): Bitmap | null {
  const grass = ground('grass');
  const dirt = ground('dirt');
  const art = (names: readonly PieceName[]) => names.map((n) => piece(n)).filter((p): p is { sprite: Bitmap; foot: number } => Boolean(p));
  const rocks = art(OBSTACLES);
  const edge = art(EDGE_TREES);
  const sprigs = art(SPRIGS);
  const beds = art(BEDS);
  if (!grass || !dirt || rocks.length < OBSTACLES.length || edge.length < EDGE_TREES.length) return null;
  const field = new Bitmap(SCREEN.width, SCREEN.height);
  const sx = seed * 3;
  const fy = Y0 + (ROWS - 1) * ROW_H + HALF_H * 2;
  for (let y = MAP_VIEW.y; y < MAP_VIEW.y + MAP_VIEW.height; y++) {
    for (let x = MAP_VIEW.x; x < MAP_VIEW.x + MAP_VIEW.width; x++) {
      const [gx, gy] = [x + sx, y + seed];
      let c = grass.data[(gy % grass.height) * grass.width + (gx % grass.width)];
      // Worn paths curling across the grass, where the troops have trodden: a band of earth with a ragged edge.
      const worn = Math.abs(fbm(gx / 230, gy / 150, 2, 610) - 0.5) + (noise(gx / 6, gy / 6, 611) - 0.5) * 0.02;
      if (worn < 0.009) c = dirt.data[(gy % dirt.height) * dirt.width + (gx % dirt.width)];
      else if (worn < 0.022 && hash(gx, gy, 612) < 0.45) c = LIGHT_LUT[c];
      // The swells: slopes towards the light (top left) a shade brighter, those away a shade darker, stippled.
      const n = (px: number, py: number) => fbm(px / 120, py / 80, 2, 613);
      const slope = (n(gx - 8, gy - 8) - n(gx + 8, gy + 8)) * 9;
      const r = hash(gx, gy, 614);
      if (slope > 0.1 && r < Math.min(0.5, (slope - 0.1) * 0.8)) c = LIGHT_LUT[c];
      else if (slope < -0.1 && r < Math.min(0.45, (-slope - 0.1) * 0.7)) c = SHADOW_LUT[c];
      // Beyond the hexes the land falls into shade, softly.
      const out = Math.max(X0 - 6 - x, x - (X0 + FIELD_W + 6), Y0 - 2 - y, y - fy - 4);
      if (out > 0 && r < Math.min(0.85, out / 18)) c = SHADOW_LUT[c];
      field.set(x, y, c);
    }
  }
  const stand = (p: { sprite: Bitmap; foot: number }, x: number, y: number, flip = false) => blit(field, flip ? mirror(p.sprite) : p.sprite, Math.round(x - p.sprite.width / 2), Math.round(y - p.foot), MAP_VIEW);
  // Tufts and flowers, at twice their size on the map, and beds of flowers here and there.
  const twice = sprigs.map((p) => ({ sprite: doubled(p.sprite), foot: p.foot * 2 }));
  for (let i = 0; i < 48; i++) {
    const x = MAP_VIEW.x + 10 + hash(i, seed, 615) * (MAP_VIEW.width - 20);
    const y = MAP_VIEW.y + 44 + hash(i, seed, 616) * (MAP_VIEW.height - 50);
    stand(twice[Math.floor(hash(i, seed, 617) * twice.length)], x, y, hash(i, seed, 618) < 0.5);
  }
  for (let i = 0; i < 7; i++) {
    const x = MAP_VIEW.x + 20 + hash(i, seed, 619) * (MAP_VIEW.width - 40);
    const y = MAP_VIEW.y + 60 + hash(i, seed, 620) * (MAP_VIEW.height - 70);
    stand(beds[Math.floor(hash(i, seed, 621) * beds.length)], x, y, hash(i, seed, 622) < 0.5);
  }
  for (let i = 0; i < HEXES; i++) {
    const [cx, cy] = hexCentre(i);
    for (let y = Math.floor(cy - HALF_H); y <= cy + HALF_H; y++) {
      for (let x = Math.floor(cx - HEX_W / 2); x <= cx + HEX_W / 2; x++) {
        if (!insideHex(x, y, cx, cy)) continue;
        const edge = !insideHex(x + 1, y, cx, cy) || !insideHex(x, y + 1, cx, cy) || !insideHex(x - 1, y, cx, cy) || !insideHex(x, y - 1, cx, cy);
        if (edge && (x + y) % 2 === 0) field.set(x, y, SHADOW_LUT[field.get(x, y)]);
      }
    }
  }
  // A wall of trees along the top, their crowns cut by the frame, and clumps in the corners below the standards and at the foot.
  for (let x = MAP_VIEW.x - 20, i = 0; x < MAP_VIEW.x + MAP_VIEW.width + 30; i++) {
    const t = edge[Math.floor(hash(i, seed, 623) * edge.length)];
    stand(t, x, MAP_VIEW.y + 40 + hash(i, seed, 624) * 14, hash(i, seed, 625) < 0.5);
    x += t.sprite.width * (0.45 + hash(i, seed, 626) * 0.25);
  }
  for (const [x, y] of [[MAP_VIEW.x + 18, fy + 22], [MAP_VIEW.x + 70, fy + 30], [MAP_VIEW.x + MAP_VIEW.width - 18, fy + 22], [MAP_VIEW.x + MAP_VIEW.width - 70, fy + 30], [MAP_VIEW.x + 360, fy + 34], [MAP_VIEW.x + 560, fy + 36]] as const) {
    const t = edge[Math.floor(hash(x, y, 627) * edge.length)];
    stand(t, x, y, hash(x, y, 628) < 0.5);
  }
  for (const [n, i] of obstacles.entries()) {
    const [cx, cy] = hexCentre(i);
    const o = rocks[(n * 5 + seed) % rocks.length];
    stand(o, cx, cy + 14, hash(n, seed, 629) < 0.5);
  }
  return field;
}

/** A small picture at twice its size, pixel for pixel. */
function doubled(b: Bitmap): Bitmap {
  const out = new Bitmap(b.width * 2, b.height * 2);
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) out.data[y * out.width + x] = b.data[(y >> 1) * b.width + (x >> 1)];
  return out;
}

function paintField(obstacles: number[], seed: number, fen: boolean): Bitmap {
  const painted = fen ? null : paintedField(obstacles, seed);
  if (painted) return painted;
  const field = new Bitmap(SCREEN.width, SCREEN.height);
  for (let y = MAP_VIEW.y; y < MAP_VIEW.y + MAP_VIEW.height; y++) {
    for (let x = MAP_VIEW.x; x < MAP_VIEW.x + MAP_VIEW.width; x++) {
      const inField = x > X0 - 10 && x < X0 + FIELD_W + 10 && y > Y0 - 4 && y < Y0 + (ROWS - 1) * ROW_H + HALF_H * 2 + 6;
      let level = 0.56 + (noise(x / 40, y / 40, seed) - 0.5) * 0.35 + (noise(x / 7, y / 7, seed + 1) - 0.5) * 0.24 + (hash(x, y, seed + 2) - 0.5) * 0.15;
      if (!inField) level -= 0.18;
      // The fen: sedge through the grass, and puddles out beyond the field.
      const sedge = fen && noise(x / 30, y / 30, seed + 3) + (noise(x / 5, y / 5, seed + 4) - 0.5) * 0.3 > 0.62;
      const puddle = fen && !inField && noise(x / 26, y / 18, seed + 5) > 0.66;
      field.set(x, y, puddle ? CYCLE_BOG[Math.floor(noise(x / 9, y / 9, seed + 6) * 12) % 6] : sedge ? shade(REED, level + 0.05, x, y) : shade(GRASS, level - (fen ? 0.06 : 0), x, y));
    }
  }
  for (let n = 0; n < 900; n++) {
    const x = MAP_VIEW.x + Math.floor(hash(n, 1, seed) * MAP_VIEW.width);
    const y = MAP_VIEW.y + Math.floor(hash(n, 2, seed) * MAP_VIEW.height);
    const tone = GRASS.indexOf(field.get(x, y));
    if (tone < 0) continue;
    field.set(x, y, GRASS[Math.min(GRASS.length - 1, tone + 2)]);
    field.set(x, y + 1, GRASS[Math.max(0, tone - 2)]);
  }
  // A few trees along the top and sides frame the field.
  for (let i = 0; i < 16; i++) {
    const t = fen ? (i % 3 === 0 ? pine(930 + i, 30) : willow(960 + i, 26)) : i % 3 === 0 ? oak(900 + i, 26) : pine(930 + i, 30);
    const x = MAP_VIEW.x + 10 + ((i * 61 + 13) % (MAP_VIEW.width - 40));
    const top = i % 2 === 0;
    const y = top ? MAP_VIEW.y - t.height + 26 + (i % 3) * 3 : MAP_VIEW.y + MAP_VIEW.height - 18;
    if (!top && x > X0 && x < X0 + FIELD_W - 20) continue;
    blit(field, t, x, y, MAP_VIEW);
  }
  // Tufts, flowers and pebbles, so the grass isn't a carpet.
  for (let n = 0; n < 420; n++) {
    const x = MAP_VIEW.x + Math.floor(hash(n, 7, seed) * MAP_VIEW.width);
    const y = MAP_VIEW.y + 20 + Math.floor(hash(n, 8, seed) * (MAP_VIEW.height - 30));
    const kind = hash(n, 9, seed);
    if (kind < 0.6) {
      const tall = 2 + Math.floor(hash(n, 10, seed) * 4);
      for (let k = 0; k < tall; k++) for (const dx of [-1, 1]) field.set(x + (k > 1 ? dx : 0) * (k - 1 > 0 ? 1 : 0) + dx * (k > 2 ? 1 : 0), y - k, fen ? REED[2 + (k % 3)] : GRASS[Math.min(GRASS.length - 1, 5 + k)]);
    } else if (kind < 0.85 && !fen) {
      const petal = [NEUTRAL[7], GOLD[6], RED[5], BLUE[6]][Math.floor(hash(n, 11, seed) * 4)];
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, -1], [0, 1]]) field.set(x + dx, y + dy, dx || dy ? petal : GOLD[4]);
    } else {
      field.set(x, y, STONE[5]);
      field.set(x + 1, y, STONE[3]);
      field.set(x, y + 1, STONE[2]);
    }
  }
  // Hex outlines: a darker line where hexes meet.
  for (let i = 0; i < HEXES; i++) {
    const [cx, cy] = hexCentre(i);
    for (let y = Math.floor(cy - HALF_H); y <= cy + HALF_H; y++) {
      for (let x = Math.floor(cx - HEX_W / 2); x <= cx + HEX_W / 2; x++) {
        if (!insideHex(x, y, cx, cy)) continue;
        const edge = !insideHex(x + 1, y, cx, cy) || !insideHex(x, y + 1, cx, cy) || !insideHex(x - 1, y, cx, cy) || !insideHex(x, y - 1, cx, cy);
        if (edge && (x + y) % 2 === 0) field.set(x, y, SHADOW_LUT[field.get(x, y)]);
      }
    }
  }
  for (const [n, i] of obstacles.entries()) {
    const [cx, cy] = hexCentre(i);
    if (fen && n % 2 === 0) {
      bogHole(field, cx, cy);
      continue;
    }
    const rock = fen ? pine(640 + n, 34) : n % 2 === 0 ? boulder(600 + n, 22) : oak(620 + n, 30);
    blit(field, rock, Math.round(cx - rock.width / 2), Math.round(cy + 10 - rock.height + (n % 2 === 0 ? 4 : 6)));
  }
  return field;
}

/** A hex of black bog water with a reed fringe: nobody stands there. */
function bogHole(field: Bitmap, cx: number, cy: number) {
  for (let y = Math.floor(cy - 13); y <= cy + 13; y++) {
    for (let x = Math.floor(cx - 21); x <= cx + 21; x++) {
      const d = Math.hypot((x - cx) / 20, (y - cy) / 12) + (noise(x / 4, y / 4, 81) - 0.5) * 0.25;
      if (d < 0.86) field.set(x, y, CYCLE_BOG[(Math.floor(x / 5) + Math.floor(y / 3)) % 6]);
      else if (d < 1) field.set(x, y, EARTH[1]);
    }
  }
  for (let k = 0; k < 11; k++) {
    const x = Math.round(cx - 20 + k * 4 + (hash(k, 1, 82) - 0.5) * 3);
    const top = Math.round(cy + (k % 2 === 0 ? -10 : 9) - 3 - hash(k, 2, 82) * 5);
    for (let y = top; y < top + 7; y++) field.set(x, y, y === top ? EARTH[2] : REED[3]);
  }
}

const glows = new WeakMap<Bitmap, Map<string, Bitmap>>();

/**
 * A figure's shape grown by three pixels, as a ring in `colour` two pixels thick with a darker `edge`
 * outside it: drawn just before the figure, it lights it up. The figure's shadow on the ground isn't
 * part of its shape.
 */
function glowOf(sprite: Bitmap, colour: number, edge: number): Bitmap {
  let made = glows.get(sprite);
  if (!made) glows.set(sprite, (made = new Map()));
  const key = `${colour}/${edge}`;
  let glow = made.get(key);
  if (!glow) {
    glow = new Bitmap(sprite.width + 6, sprite.height + 6);
    const solid = (x: number, y: number) => {
      const v = sprite.get(x, y);
      return v !== 0 && v !== SHADOW;
    };
    for (let y = -3; y < sprite.height + 3; y++) {
      for (let x = -3; x < sprite.width + 3; x++) {
        if (solid(x, y)) continue;
        let near = 4;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (Math.abs(dx) + Math.abs(dy) < near && solid(x + dx, y + dy)) near = Math.abs(dx) + Math.abs(dy);
        if (near < 4) glow.set(x + 3, y + 3, near < 3 ? colour : edge);
      }
    }
    made.set(key, glow);
  }
  return glow;
}

function fillHex(screen: Bitmap, i: number, lut: Uint8Array, every: number) {
  const [cx, cy] = hexCentre(i);
  for (let y = Math.floor(cy - HALF_H + 2); y <= cy + HALF_H - 2; y++) {
    for (let x = Math.floor(cx - HEX_W / 2 + 2); x <= cx + HEX_W / 2 - 2; x++) {
      if (insideHex(x, y, cx, cy) && (x + y) % every === 0) screen.set(x, y, lut[screen.get(x, y)]);
    }
  }
}

function outlineHex(screen: Bitmap, i: number, color: number) {
  const [cx, cy] = hexCentre(i);
  for (let y = Math.floor(cy - HALF_H); y <= cy + HALF_H; y++) {
    for (let x = Math.floor(cx - HEX_W / 2); x <= cx + HEX_W / 2; x++) {
      if (!insideHex(x, y, cx, cy)) continue;
      if (!insideHex(x + 1, y, cx, cy) || !insideHex(x - 1, y, cx, cy) || !insideHex(x, y + 1, cx, cy) || !insideHex(x, y - 1, cx, cy)) screen.set(x, y, color);
    }
  }
}

/** The battle screen: a painted field, the stacks, their numbers, and the bar with the buttons. */
export class BattleScreen {
  readonly screen = new Bitmap(SCREEN.width, SCREEN.height);
  private readonly frame: Bitmap;
  private readonly overlay: Bitmap;
  private readonly field: Bitmap;

  /**
   * The King's star at the top left, over Aldric's side, where he leads from, and the enemy's
   * standard at the top right (beasts have none).
   */
  private readonly ours = Array.from({ length: 8 }, (_, i) => standard(ROYAL, i / 8, 1));
  private readonly standard: Bitmap[] | null;

  constructor(battle: BattleState) {
    const { frame, overlay } = paintFrame();
    this.frame = frame;
    this.overlay = overlay;
    this.field = paintField(battle.obstacles, (battle.seed >>> 8) & 1023, battle.ground === 'fen');
    const theirs = standardOf(battle.fighters.filter((f) => f.side === 'enemy').map((f) => f.troop));
    this.standard = theirs && Array.from({ length: 8 }, (_, i) => standard(theirs, i / 8, -1));
  }

  draw(b: BattleState, view: BattleView): Bitmap {
    const { screen } = this;
    screen.data.set(this.frame.data);
    for (let y = MAP_VIEW.y; y < MAP_VIEW.y + MAP_VIEW.height; y++) {
      const row = y * SCREEN.width;
      screen.data.set(this.field.data.subarray(row + MAP_VIEW.x, row + MAP_VIEW.x + MAP_VIEW.width), row + MAP_VIEW.x);
    }
    // A Fireball's light on the ground round it (#190), dithered thinner towards its edge.
    if (view.light && view.light.strength > 0) {
      const { x: lx, y: ly, radius, strength } = view.light;
      for (let y = Math.max(MAP_VIEW.y, Math.floor(ly - radius * 0.55)); y <= Math.min(MAP_VIEW.y + MAP_VIEW.height - 1, ly + radius * 0.55); y++) {
        for (let x = Math.max(MAP_VIEW.x, Math.floor(lx - radius)); x <= Math.min(MAP_VIEW.x + MAP_VIEW.width - 1, lx + radius); x++) {
          const d = Math.hypot((x - lx) / radius, (y - ly) / (radius * 0.55));
          if (d < 1 && bayer(x, y) < (1 - d) * strength * 1.4) screen.set(x, y, LIGHT_LUT[screen.get(x, y)]);
        }
      }
    }
    for (const i of view.reach) fillHex(screen, i, LIGHT_LUT, 2);
    const active = view.active === null ? null : b.fighters.find((f) => f.id === view.active);
    // The stack whose turn it is stands on a lit hex; a leader has his ring behind the line instead.
    if (active && active.count > 0 && !isLeader(active)) {
      fillHex(screen, active.at, LIGHT_LUT, 1);
      outlineHex(screen, active.at, GOLD[5]);
      // Its turn has just come (#190): a gold ring pings out from its hex once.
      if (view.cue?.fighter === active.id && view.cue.age < CUE_PING) this.ping(active.at, view.cue.age / CUE_PING);
    }
    // Where a click would take the stack: the hex it would move to, or the one it would strike from.
    const going = view.hover?.kind === 'move' ? view.hover.hex : view.hover?.from !== undefined && view.hover.from !== active?.at ? view.hover.from : null;
    if (going !== null) {
      fillHex(screen, going, LIGHT_LUT, 1);
      outlineHex(screen, going, GOLD[6]);
    }
    // What it would land on, lit gold, and your own it would hurt too, in red.
    for (const [id, how] of view.lit) {
      const f = b.fighters.find((x) => x.id === id);
      if (!f || f.count <= 0 || isLeader(f)) continue;
      fillHex(screen, f.at, how === 'danger' ? DANGER_LUT : LIGHT_LUT, how === 'danger' ? 2 : 1);
      outlineHex(screen, f.at, how === 'danger' ? RED[5] : GOLD[6]);
    }
    if (view.hover && !view.lit.size && view.hover.kind !== 'move') outlineHex(screen, view.hover.hex, view.hover.kind === 'bard' ? GOLD[6] : view.hover.kind === 'spell' ? BLUE[6] : RED[5]);

    // The fallen stay where they fell, under everyone still standing. Those paid off walked away.
    for (const f of b.fighters) {
      if (f.count > 0 || view.dying.has(f.id) || isLeader(f) || f.left) continue;
      const [cx, cy] = hexCentre(f.at);
      const { sprite, x, y } = corpseSprite(f.troop, f.side === 'player' ? 'blue' : 'red', view.fallen.get(f.id) ?? (f.side === 'player' ? 1 : -1));
      blit(screen, sprite, Math.round(cx + x), Math.round(cy + 12 + y), MAP_VIEW);
    }
    const { ending } = view;
    const flap = Math.floor(view.time * (ending.fast ? 12 : 5)) % 8;
    const star = this.ours[flap];
    this.flag(star, MAP_VIEW.x + 18, Y0 + 100 - star.height, 7, -ending.dip);
    if (this.standard) {
      const flag = this.standard[flap];
      // It falls in towards the field, so it stays in sight.
      this.flag(flag, MAP_VIEW.x + MAP_VIEW.width - flag.width - 18, Y0 + 100 - flag.height, flag.width - 7, ending.fall);
    }

    const shown = b.fighters.filter((f) => (f.count > 0 || view.dying.has(f.id)) && !view.hidden.has(f.id));
    // Where a fighter stands: its hex (a leader's place behind the line), or wherever it has got to
    // on a walk or a ride. Lunges and reels move only the figure, so its count stays put on its hex.
    const place = (f: Fighter) => view.positions.get(f.id) ?? spotOf(b, f);
    // Leaders stand in a ring, as on the map: Aldric's gold, the enemy's red. It stays behind the line when he rides out.
    for (const f of shown) {
      if (!isLeader(f)) continue;
      const [px, py] = spotOf(b, f);
      this.ring(Math.round(px), Math.round(py + 12), f.side === 'player');
    }
    // Each in front of what stands behind it; a stack taking a blow just in front of whoever strikes it (#190).
    const depth = (f: Fighter) => {
      const by = view.front.get(f.id);
      const attacker = by === undefined ? null : shown.find((o) => o.id === by);
      return attacker ? Math.max(place(f)[1], place(attacker)[1]) + 0.5 : place(f)[1];
    };
    shown.sort((x, y) => depth(x) - depth(y));
    for (const f of shown) {
      const [px, py] = place(f);
      const [ox, oy] = view.offsets.get(f.id) ?? [0, 0];
      const facing = view.facings.get(f.id) ?? (f.side === 'player' ? 1 : -1);
      // Turned into newts or frogs, a stack is those creatures till the spell wears off.
      const look = view.looks.has(f.id) ? view.looks.get(f.id)! : lookOf(f);
      if (look) {
        for (const c of critters(look, !oneOfAKind(f), view.time, f.id)) {
          const sprite = critterSprite(look, facing, c.phase);
          const shown = view.whites.has(f.id) ? whiteSprite(sprite) : view.flashing.has(f.id) ? hurtSprite(sprite) : sprite;
          const [x, y] = [Math.round(px + ox + c.dx - sprite.width / 2), Math.round(py + oy + 12 + c.dy - sprite.height)];
          if (view.lit.has(f.id)) this.glow(sprite, x, y, view.lit.get(f.id)!, view.time);
          blit(screen, shown, x, y, MAP_VIEW);
        }
        continue;
      }
      const angle = view.topple.get(f.id);
      if (angle !== undefined) {
        // The last of the stack falling over, away from the blow (#190).
        const fell = toppledFigure(f.troop, f.side === 'player' ? 'blue' : 'red', view.fallen.get(f.id) ?? facing, angle);
        blit(screen, view.flashing.has(f.id) ? hurtSprite(fell.sprite) : fell.sprite, Math.round(px + fell.x), Math.round(py + 12 + fell.y), MAP_VIEW);
        continue;
      }
      const pose = view.poses.get(f.id) ?? (view.positions.has(f.id) ? STAND : fidget(f.troop, f.id, view.time));
      const figure = troopFigure(f.troop, f.side === 'player' ? 'blue' : 'red', facing, pose, 'battle');
      const sprite = view.whites.has(f.id) ? whiteSprite(figure.sprite) : view.flashing.has(f.id) ? hurtSprite(figure.sprite) : figure.sprite;
      // Standing about, everyone breathes: a pixel up and down, each stack in its own time.
      const breath = pose.anim === 'stand' && !view.positions.has(f.id) && !view.offsets.has(f.id) && Math.sin(view.time * 2.4 + f.id * 1.9) > 0.35 ? 1 : 0;
      const lift = view.positions.has(f.id) ? 0 : (view.lifts.get(f.id) ?? 0);
      const [x, y] = [Math.round(px + ox + figure.x), Math.round(py + oy + 12 + figure.y) - breath - lift];
      if (view.lit.has(f.id)) this.glow(figure.sprite, x, y, view.lit.get(f.id)!, view.time);
      blit(screen, sprite, x, y, MAP_VIEW);
    }
    // A blow's way in: an arrow on the edge from the hex it is struck from into the stack it lands on.
    if (view.hover?.kind === 'melee' && view.hover.from !== undefined) this.arrow(hexCentre(view.hover.from), hexCentre(view.hover.hex));
    // Counts go on last, so a troll never hides the goblins behind him. A leader has none: he's one
    // of a kind, and nothing can hurt him.
    // A count that has just changed rolls down to its new number, its badge white for the first frame (#190).
    for (const f of shown) {
      const roll = view.rolls.get(f.id);
      const count = roll ? rolled(roll.from, roll.to, roll.age) : (view.counts.get(f.id) ?? f.count);
      if (count <= 0 || isLeader(f)) continue;
      const [cx, cy] = place(f);
      this.badge(Math.round(cx + (f.side === 'player' ? 14 : -14)), Math.round(cy + 8), count, f.side === 'player', !!roll && roll.age < FRAME);
    }
    // Lightning lights the whole field for a moment, figures and all (#190): two shades up, never white.
    if (view.flash > 0) {
      for (let y = MAP_VIEW.y; y < MAP_VIEW.y + MAP_VIEW.height; y++) {
        const row = y * SCREEN.width;
        for (let x = MAP_VIEW.x; x < MAP_VIEW.x + MAP_VIEW.width; x++) screen.data[row + x] = LIGHT_LUT[LIGHT_LUT[screen.data[row + x]]];
      }
    }
    for (const s of view.shots) this.shot(s);
    this.pops(b, view);
    for (const t of view.floaters) this.words(t.text, Math.round(t.x), Math.round(t.y - t.age * FLOAT_RISE), t.color, (FLOAT_LIFE - t.age) / FLOAT_FADE);
    // A defeat sinks in: the field darkens a shade (#190).
    if (ending.dusk > 0) {
      for (let y = MAP_VIEW.y; y < MAP_VIEW.y + MAP_VIEW.height; y++) {
        for (let x = MAP_VIEW.x; x < MAP_VIEW.x + MAP_VIEW.width; x++) if (bayer(x, y) < ending.dusk * 0.3) screen.set(x, y, SHADOW_LUT[screen.get(x, y)]);
      }
    }
    if (view.speech) this.speech(b, view.speech);
    if (view.banner) drawBanner(screen, view.banner.sprite, MAP_VIEW.x + MAP_VIEW.width / 2, MAP_VIEW.y + 150, view.banner.age, view.banner.life);
    // The field jolts: kicked the way the last blow went, and shaken every way for the biggest moments.
    const jitter = view.shake > 0.5 ? view.shake : 0;
    const dx = Math.round(view.kick[0] + (jitter ? (hash(Math.floor(view.time * 60), 1, 3) - 0.5) * 2 * jitter : 0));
    const dy = Math.round(view.kick[1] + (jitter ? (hash(Math.floor(view.time * 60), 2, 3) - 0.5) * 2 * jitter : 0));
    if (dx || dy) this.jolt(dx, dy);
    this.logLine(view.preview ?? view.log);
    this.turnStrip(b);
    this.bar(b, view);
    blit(screen, this.overlay, 0, 0);
    return screen;
  }

  /** A leader's words in a bubble to the upper left of him, its tail's tip just over his head, as it rises and fades. */
  private speech(b: BattleState, speech: NonNullable<BattleView['speech']>) {
    const f = b.fighters.find((x) => x.id === speech.fighter);
    if (!f) return;
    const [px, py] = spotOf(b, f);
    const head = py + 12 - bodyHeight(f.troop, 'battle');
    const { bubble } = speech;
    const x0 = Math.max(MAP_VIEW.x + 4, Math.min(MAP_VIEW.x + MAP_VIEW.width - bubble.width - 4, px - (bubble.width - 3 - TIP)));
    const y0 = Math.max(LOG_BOTTOM + 6, head - 4 - (bubble.height - 3));
    drawBanner(this.screen, bubble, x0 + bubble.width / 2, y0, speech.age, speech.life);
  }

  /**
   * An arrow that missed, stuck in the ground where it came down (#190): drawn into the field itself,
   * under everyone, so it stays there till the fight ends. It flew from `from` to `to` on an `arc`.
   */
  markArrow(from: [number, number], to: [number, number], arc: number, bolt = false) {
    const [ax, ay] = from;
    const [bx, by] = to;
    // The way it was going as it came down.
    const vx = bx - ax;
    const vy = by - ay + Math.PI * arc;
    const n = Math.hypot(vx, vy) || 1;
    const [ux, uy] = [vx / n, vy / n];
    const length = bolt ? 9 : 13;
    // Its head and a little of the shaft are in the ground.
    for (let k = 3; k <= length; k++) {
      const px = Math.round(bx - ux * k);
      const py = Math.round(by - uy * k);
      const feather = k > length - 3;
      if (!feather) this.field.set(Math.round(px - uy * 2), Math.round(py + ux * 2), SHADOW_LUT[this.field.get(Math.round(px - uy * 2), Math.round(py + ux * 2))]);
      this.field.set(px, py, feather ? (bolt ? RED[4] : NEUTRAL[7]) : bolt ? EARTH[3] : WOOD[5]);
      this.field.set(Math.round(px - uy), Math.round(py + ux), feather ? (bolt ? RED[2] : NEUTRAL[5]) : bolt ? EARTH[1] : WOOD[2]);
    }
    // A little scuffed earth where it went in.
    this.field.set(bx, by, EARTH[2]);
    this.field.set(bx + 1, by, EARTH[3]);
  }

  /** Jolts the field (not the frame round it) by (dx, dy) pixels, for a blow. */
  private jolt(dx: number, dy: number) {
    const { screen } = this;
    const copy = screen.data.slice();
    for (let y = MAP_VIEW.y; y < MAP_VIEW.y + MAP_VIEW.height; y++) {
      const sy = Math.min(MAP_VIEW.y + MAP_VIEW.height - 1, Math.max(MAP_VIEW.y, y - dy));
      for (let x = MAP_VIEW.x; x < MAP_VIEW.x + MAP_VIEW.width; x++) {
        const sx = Math.min(MAP_VIEW.x + MAP_VIEW.width - 1, Math.max(MAP_VIEW.x, x - dx));
        screen.data[y * SCREEN.width + x] = copy[sy * SCREEN.width + sx];
      }
    }
  }

  /** A gold ring growing out from a hex and thinning away, `t` from 0 to 1 (#190). */
  private ping(i: number, t: number) {
    const [cx, cy] = hexCentre(i);
    const grow = 1 + t * 0.35;
    for (let y = Math.floor(cy - HALF_H * grow - 1); y <= cy + HALF_H * grow + 1; y++) {
      for (let x = Math.floor(cx - (HEX_W / 2) * grow - 1); x <= cx + (HEX_W / 2) * grow + 1; x++) {
        const [u, v] = [cx + (x - cx) / grow, cy + (y - cy) / grow];
        if (!insideHex(u, v, cx, cy)) continue;
        const edge = !insideHex(cx + (x + 1 - cx) / grow, v, cx, cy) || !insideHex(cx + (x - 1 - cx) / grow, v, cx, cy) || !insideHex(u, cy + (y + 1 - cy) / grow, cx, cy) || !insideHex(u, cy + (y - 1 - cy) / grow, cx, cy);
        if (edge && bayer(x, y) >= t) this.screen.set(x, y, t < 0.4 ? NEUTRAL[7] : GOLD[6]);
      }
    }
  }

  /** How many blood marks each hex has had, so a long fight never paints a hex red. */
  private readonly bloodied = new Map<number, number>();

  /**
   * Blood on the grass at a stack's feet where a blow hurt it (#190), drawn into the field itself: a
   * few small dark drops, never more than four times on one hex.
   */
  markBlood(hex: number, seed: number) {
    const n = this.bloodied.get(hex) ?? 0;
    if (n >= 4) return;
    this.bloodied.set(hex, n + 1);
    const [cx, cy] = hexCentre(hex);
    for (let k = 0; k < 5; k++) {
      const x = Math.round(cx + (hash(k, seed, 61) - 0.5) * 34);
      const y = Math.round(cy + 6 + (hash(k, seed, 62) - 0.5) * 16);
      this.field.set(x, y, k % 2 ? RED[1] : RED[2]);
      if (k % 3 === 0) this.field.set(x + 1, y, RED[1]);
    }
  }

  /**
   * Something dropped where a stack fell (#190), in the grass beside its corpse: a helmet for those
   * who wore steel, a round shield in their side's colour for other folk, and nothing for beasts.
   */
  markDropped(hex: number, what: 'helmet' | 'shield', player: boolean, side: 1 | -1) {
    const [cx, cy] = hexCentre(hex);
    const [x0, y0] = [Math.round(cx + side * 24), Math.round(cy + 15)];
    const rows = what === 'helmet' ? ['..###..', '.#####.', '#######', '#######', 'r#####r'] : ['..###..', '.#####.', '#######', '###o###', '#######', '.#####.', '..###..'];
    rows.forEach((row, j) =>
      [...row].forEach((ch, i) => {
        if (ch === '.') return;
        const c = ch === 'o' ? GOLD[5] : ch === 'r' ? STONE[2] : what === 'helmet' ? (j === 0 ? STONE[6] : STONE[4]) : player ? (j < 2 ? BLUE[4] : BLUE[3]) : j < 2 ? RED[4] : RED[3];
        this.field.set(x0 + i, y0 + j, c);
      }),
    );
    // Its shadow on the grass, down and to the right.
    for (let i = 1; i <= rows[0].length; i++) this.field.set(x0 + i, y0 + rows.length, SHADOW_LUT[this.field.get(x0 + i, y0 + rows.length)]);
  }

  /** A burnt patch where a spell struck (#190), drawn into the field: a scorched ring for a Fireball, a smaller blot for Lightning. */
  markScorch(x: number, y: number, ring: boolean) {
    const [rx, ry] = ring ? [34, 15] : [16, 7];
    for (let j = -ry - 1; j <= ry + 1; j++) {
      for (let i = -rx - 1; i <= rx + 1; i++) {
        const d = Math.hypot(i / rx, j / ry) + (hash(i, j, 63) - 0.5) * 0.2;
        if (d > 1) continue;
        const [px, py] = [Math.round(x + i), Math.round(y + j)];
        // A ring is darkest at its rim, where the flames licked; a blot at its heart.
        const burn = ring ? 1 - Math.abs(d - 0.75) * 2.4 : 1 - d;
        if (bayer(px, py) >= burn * 0.9) continue;
        this.field.set(px, py, burn > 0.6 ? EARTH[1] : SHADOW_LUT[this.field.get(px, py)]);
      }
    }
  }

  /** A standard at (x, y), turned `degrees` about the foot of its pole, `pole` pixels in from its left edge (#190). */
  private flag(sprite: Bitmap, x: number, y: number, pole: number, degrees: number) {
    if (!degrees) return blit(this.screen, sprite, x, y, MAP_VIEW);
    const foot: [number, number] = [pole, sprite.height - 4];
    const turned = rotateAbout(sprite, degrees, foot);
    blit(this.screen, turned.sprite, x + foot[0] + turned.x, y + foot[1] + turned.y, MAP_VIEW);
  }

  /** The kills and wounds popping out of each stack's badge (#190), over the stack's own hex wherever it fell. */
  private pops(b: BattleState, view: BattleView) {
    if (!view.pops.length) return;
    const by = new Map<number, Pop[]>();
    for (const p of view.pops) by.set(p.fighter, [...(by.get(p.fighter) ?? []), p]);
    for (const [id, list] of by) {
      const f = b.fighters.find((x) => x.id === id);
      if (!f || isLeader(f)) continue;
      const [cx, cy] = view.positions.get(id) ?? spotOf(b, f);
      drawPops(this.screen, list, Math.round(cx + (f.side === 'player' ? 14 : -14)), Math.round(cy + 8), MAP_VIEW, stripBottom() + 2);
    }
  }

  /** Words rising off a stack, centred on `cx`, outlined all round so they read over the grass, dithering away as `shown` falls below 1. */
  private words(text: string, cx: number, y: number, colour: number, shown: number) {
    const { width, height, solid } = textMask(text, 15);
    const x0 = Math.round(cx - width / 2);
    for (let j = -1; j <= height; j++) {
      for (let i = -1; i <= width; i++) {
        const [x, yy] = [x0 + i, y + j];
        if (shown < 1 && bayer(x, yy) >= shown) continue;
        if (yy < MAP_VIEW.y || yy >= MAP_VIEW.y + MAP_VIEW.height) continue;
        if (solid(i, j)) this.screen.set(x, yy, colour);
        else if ([-1, 0, 1].some((dj) => [-1, 0, 1].some((di) => solid(i + di, j + dj)))) this.screen.set(x, yy, INK);
      }
    }
  }

  /** The ring on the ground round a leader's feet, bright with a dark edge, as on the map: Aldric's gold, the enemy's red. */
  private ring(cx: number, cy: number, ours: boolean) {
    const [rx, ry] = [26, 8];
    const [dark, bright] = ours ? [GOLD[3], GOLD[6]] : [RED[2], RED[5]];
    for (const [grow, colour] of [[1, INK], [-1, dark], [0, bright]] as const) {
      for (let a = 0; a < Math.PI * 2; a += 0.004) {
        const x = Math.round(cx + Math.cos(a) * (rx + grow));
        const y = Math.round(cy + Math.sin(a) * (ry + grow * 0.6));
        if (y >= MAP_VIEW.y && y < MAP_VIEW.y + MAP_VIEW.height) this.screen.set(x, y, colour);
      }
    }
  }

  /**
   * A figure lit up, drawn just before the figure itself: a ring round its shape, gold for a stack a
   * click would land on and red for your own it would hurt, shimmering between two shades.
   */
  private glow(sprite: Bitmap, x: number, y: number, how: 'target' | 'danger', time: number) {
    const bright = Math.sin(time * 7) > -0.3;
    const colour = how === 'danger' ? (bright ? RED[5] : RED[4]) : bright ? GOLD[6] : GOLD[5];
    blit(this.screen, glowOf(sprite, colour, how === 'danger' ? RED[1] : GOLD[2]), x - 3, y - 3, MAP_VIEW);
  }

  /** A gold arrowhead on the edge between two hexes, pointing the way a blow goes in. */
  private arrow([ax, ay]: [number, number], [bx, by]: [number, number]) {
    const length = Math.hypot(bx - ax, by - ay) || 1;
    const [ux, uy] = [(bx - ax) / length, (by - ay) / length];
    const [mx, my] = [(ax + bx) / 2, (ay + by) / 2];
    const corners: [number, number][] = [
      [mx + ux * 8, my + uy * 8],
      [mx - ux * 6 - uy * 8, my - uy * 6 + ux * 8],
      [mx - ux * 6 + uy * 8, my - uy * 6 - ux * 8],
    ];
    const side = (p: [number, number], q: [number, number], x: number, y: number) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
    const turn = Math.sign(side(corners[0], corners[1], corners[2][0], corners[2][1]));
    const inside = (x: number, y: number) => [0, 1, 2].every((k) => side(corners[k], corners[(k + 1) % 3], x, y) * turn >= 0);
    for (let y = Math.floor(my - 10); y <= my + 10; y++) {
      for (let x = Math.floor(mx - 10); x <= mx + 10; x++) {
        if (!inside(x, y)) continue;
        const rim = !inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1);
        // Lit from the top left, as everything is: the far half of the head a shade darker.
        this.screen.set(x, y, rim ? INK : (x - mx) * uy - (y - my) * ux > 0 ? GOLD[5] : GOLD[6]);
      }
    }
  }

  /** A stack's count on its hex; `flash` draws it white, the frame its count changes. */
  private badge(cx: number, y: number, count: number, player: boolean, flash = false) {
    const text = String(count);
    // By touch the count is bigger, and its badge with it, from the same top.
    const size = lettered(11);
    const w = bigLettering() ? textMask(text, size).width + 6 : text.length * 7 + 7;
    const h = size + 2;
    const x = cx - Math.floor(w / 2);
    const fill = flash ? NEUTRAL[7] : player ? BLUE[2] : RED[2];
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1;
        this.screen.set(x + i, y + j, edge ? (flash ? GOLD[6] : GOLD[3]) : fill);
      }
    }
    drawText(this.screen, text, x + 3, y - 2, flash ? (player ? BLUE[2] : RED[2]) : NEUTRAL[7], flash ? NEUTRAL[7] : INK, size);
  }

  /** The next turns, as small versions of the figures on the field. */
  private turnStrip(b: BattleState) {
    const next = b.result ? [] : upcomingFighters(b);
    if (!next.length) return;
    const { screen } = this;
    const big = bigLettering();
    const size = lettered(9);
    const labelWidth = big ? 46 : 34;
    const cellWidth = big ? 48 : 38;
    const width = labelWidth + next.length * cellWidth + 6;
    const y0 = LOG_BOTTOM + 2;
    const height = stripBottom() - y0;
    const words = big ? 4 : 5;
    const x0 = MAP_VIEW.x + Math.floor((MAP_VIEW.width - width) / 2);
    screen.fill(x0, y0, width, height, WOOD[1]);
    for (let x = x0; x < x0 + width; x++) {
      screen.set(x, y0, GOLD[4]);
      screen.set(x, y0 + height - 1, INK);
    }
    for (let y = y0; y < y0 + height; y++) {
      screen.set(x0, y, GOLD[4]);
      screen.set(x0 + width - 1, y, INK);
    }
    drawText(screen, 'NEXT', x0 + 4, y0 + words, GOLD[6], INK, size);

    next.forEach((fighter, i) => {
      const x = x0 + labelWidth + i * cellWidth;
      const border = i === 0 ? GOLD[6] : fighter.side === 'player' ? BLUE[4] : RED[4];
      for (let dx = 0; dx < cellWidth - 2; dx++) {
        screen.set(x + dx, y0 + 2, border);
        screen.set(x + dx, y0 + height - 3, INK);
      }
      for (let dy = 2; dy < height - 2; dy++) {
        screen.set(x, y0 + dy, border);
        screen.set(x + cellWidth - 3, y0 + dy, INK);
      }
      const icon = turnIcon(fighter.troop, fighter.side);
      const iconX = x + 2;
      const iconY = y0 + Math.floor((height - icon.height) / 2);
      const leader = isLeader(fighter);
      if (leader) this.smallRing(iconX + Math.floor(icon.width / 2), y0 + height / 2, fighter.side === 'player');
      blit(screen, icon, iconX, iconY);
      if (!leader) {
        drawText(screen, String(fighter.count), x + 20, y0 + words, PARCHMENT[6], INK, size);
      }
    });
  }

  private smallRing(cx: number, cy: number, ours: boolean) {
    for (const [rx, ry, color] of [[9, 8, INK], [8, 7, ours ? GOLD[4] : RED[3]], [7, 6, ours ? GOLD[6] : RED[5]]] as const) {
      for (let a = 0; a < Math.PI * 2; a += 0.08) {
        this.screen.set(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), color);
      }
    }
  }

  private shot(s: Shot) {
    const [ax, ay] = s.from;
    const [bx, by] = s.to;
    if (s.kind === 'arrow' || s.kind === 'quarrel') {
      // An arrow arcs high; a crossbow bolt flies flatter, shorter and thicker. Either points along
      // its flight, with a steel head and pale fletching, big enough to follow across the field.
      const bolt = s.kind === 'quarrel';
      const arc = s.arc ?? (bolt ? 14 : 44);
      const t = Math.min(1, s.t);
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t - Math.sin(t * Math.PI) * arc;
      const vx = bx - ax;
      const vy = by - ay - Math.PI * arc * Math.cos(t * Math.PI);
      const n = Math.hypot(vx, vy) || 1;
      const [ux, uy] = [vx / n, vy / n];
      const length = bolt ? 11 : 16;
      for (let k = 0; k <= length; k++) {
        const px = x - ux * k;
        const py = y - uy * k;
        const head = k < 3;
        const feather = k > length - 4;
        const colour = head ? STONE[7] : feather ? (bolt ? RED[4] : NEUTRAL[7]) : bolt ? EARTH[3] : WOOD[5];
        // Ink under the shaft first, so it reads against the grass as the figures do.
        if (!feather) this.screen.set(Math.round(px - uy * 2), Math.round(py + ux * 2), INK);
        this.screen.set(Math.round(px), Math.round(py), colour);
        // A second row, darker, for body: the shaft, and fletching that splays both ways.
        this.screen.set(Math.round(px - uy), Math.round(py + ux), head ? STONE[5] : feather ? (bolt ? RED[2] : NEUTRAL[5]) : bolt ? EARTH[1] : WOOD[2]);
        if (feather) this.screen.set(Math.round(px + uy), Math.round(py - ux), bolt ? RED[3] : NEUTRAL[6]);
      }
    } else if (s.kind === 'hex' || s.kind === 'magic') {
      // A witch's hex: a sickly green orb in a plum glow that wobbles across, shedding sparks. A
      // wizard's bolt is the same shape in white and gold, in a blue glow, and flies straight.
      const magic = s.kind === 'magic';
      const [core, inner, outer, edge] = magic ? [NEUTRAL[7], GOLD[6], BLUE[5], BLUE[3]] : [NEUTRAL[7], LEAF[8], PLUM[4], PLUM[2]];
      const t = Math.min(1, s.t);
      const at = (k: number) => [ax + (bx - ax) * k, ay + (by - ay) * k - Math.sin(k * Math.PI) * (magic ? 10 : 26) + (magic ? 0 : Math.sin(k * 17) * 4)] as const;
      const [x, y] = at(t);
      for (let k = 1; k < 14; k++) {
        const [sx, sy] = at(Math.max(0, t - k * 0.03));
        const jx = sx + (hash(k, Math.floor(s.t * 40), 17) - 0.5) * 12;
        const jy = sy + (hash(k, Math.floor(s.t * 40), 18) - 0.5) * 12;
        const c = k % 3 === 0 ? NEUTRAL[7] : k % 2 ? outer : inner;
        for (const [dx, dy] of k < 8 ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0]]) this.screen.set(Math.round(jx) + dx, Math.round(jy) + dy, c);
      }
      const pulse = 1 + Math.sin(s.t * 40) * 0.8;
      for (let j = -11; j <= 11; j++) {
        for (let i = -11; i <= 11; i++) {
          const d = Math.hypot(i, j);
          if (d > 8 + pulse) continue;
          const glow = d > 6;
          if (glow && bayer(Math.round(x + i), Math.round(y + j)) > 0.5) continue;
          this.screen.set(Math.round(x + i), Math.round(y + j), d < 2.2 ? core : d < 4.2 ? inner : d < 6 ? outer : edge);
        }
      }
    } else if (s.kind === 'bolt') {
      // Lightning (#190): a solid bolt out of the sky onto the stack, forking half way, that holds for
      // a tenth of a second at full strength, strikes once more, and thins away.
      const strike = s.t < 0.45 ? 0 : 1;
      const shown = s.t < 0.3 ? 1 : s.t < 0.45 ? 0.6 : Math.max(0, 1 - (s.t - 0.45) / 0.35);
      if (shown > 0) {
        const seed = Math.round(bx) * 7 + strike;
        const path: [number, number][] = [];
        let x = bx + 34;
        for (let y = MAP_VIEW.y + 4; y < by; y++) {
          if (y % 3 === 0) x += (hash(y, seed, 5) - 0.5) * 12;
          x += (bx - x) * 0.05;
          path.push([x, y]);
        }
        const fork: [number, number][] = [];
        const [fx0, fy0] = path[Math.floor(path.length / 2)] ?? [bx, by];
        let f = fx0;
        for (let y = Math.round(fy0); y < fy0 + (by - fy0) * 0.7; y++) {
          if (y % 3 === 0) f += (hash(y, seed, 6) - 0.5) * 10;
          f += 0.6 + (hash(y, seed, 7) - 0.3) * 0.4;
          fork.push([f, y]);
        }
        const wide = s.t < 0.3 ? 2 : 1;
        for (const [px, py] of path) {
          for (let dx = -wide - 1; dx <= wide + 1; dx++) {
            const X = Math.round(px + dx);
            if (shown < 1 && bayer(X, py) >= shown) continue;
            this.screen.set(X, py, Math.abs(dx) <= wide - 1 ? NEUTRAL[7] : Math.abs(dx) <= wide ? GOLD[6] : GOLD[4]);
          }
        }
        for (const [px, py] of fork) {
          for (const dx of [0, 1]) {
            const X = Math.round(px + dx);
            if (shown < 1 && bayer(X, py) >= shown) continue;
            this.screen.set(X, py, dx ? GOLD[5] : NEUTRAL[7]);
          }
        }
      }
    } else if (s.kind === 'fire') {
      if (s.t < FIRE_FALL) {
        // A ball of fire drops out of the sky onto the stack, trailing sparks.
        const k = s.t / FIRE_FALL;
        const x = bx + 70 * (1 - k);
        const y = MAP_VIEW.y + 10 + (by - 20 - MAP_VIEW.y) * k;
        for (let n = 1; n < 9; n++) this.screen.set(Math.round(x + n * 5), Math.round(y - n * 6), n % 2 ? GOLD[5] : RED[4]);
        for (let j = -8; j <= 8; j++) {
          for (let i = -8; i <= 8; i++) {
            const d = Math.hypot(i, j);
            if (d <= 8) this.screen.set(Math.round(x + i), Math.round(y + j), d < 3 ? NEUTRAL[7] : d < 5.5 ? GOLD[6] : RED[5]);
          }
        }
      } else {
        // It bursts over the stack and everyone beside it: a sheet of flame that swells, then gutters out.
        const k = (s.t - FIRE_FALL) / (1 - FIRE_FALL);
        const rx = 22 + k * 50;
        const ry = rx * 0.6;
        const flicker = Math.floor(s.t * 30);
        for (let y = Math.floor(by - ry - 26); y <= by + ry + 6; y++) {
          for (let x = Math.floor(bx - rx); x <= bx + rx; x++) {
            const dx = (x - bx) / rx;
            const dy = (y - by - 2) / ry;
            // Flames lick upwards: the top of the sheet is ragged and taller.
            const lick = dy < 0 ? (hash(Math.floor(x / 3), flicker, 71) * 0.8 + 0.2) * (1 - k) * 1.6 : 0;
            const d = Math.hypot(dx, dy < 0 ? dy / (1 + lick) : dy);
            if (d > 1) continue;
            if (bayer(x, y) < k * k * 1.1 - (1 - d) * 0.25) continue;
            const hot = (1 - d) * (1 - k * 0.7);
            this.screen.set(x, y, hot > 0.55 ? NEUTRAL[7] : hot > 0.3 ? GOLD[6] : hot > 0.12 ? RED[5] : RED[3]);
          }
        }
      }
    } else if (s.kind === 'spark') {
      // A star of white and gold where the blow lands: a hard flash at the heart, then streaks out,
      // as big as the blow (`size`), with chips flung on the way it went (#190).
      const size = s.size ?? 1;
      const core = (4 - s.t * 8) * size;
      const reach = Math.ceil(4 * size);
      if (s.t < 0.3) for (let j = -reach; j <= reach; j++) for (let i = -reach; i <= reach; i++) if (Math.abs(i) + Math.abs(j) <= core) this.screen.set(Math.round(bx + i), Math.round(by + j), NEUTRAL[7]);
      for (let k = 0; k < 12; k++) {
        const a = k * 0.52 + (hash(k, Math.round(bx), 9) - 0.5) * 0.4;
        const r0 = 3 + s.t * 16 * size;
        const r1 = r0 + 10 * size * (1 - s.t) * (k % 2 ? 0.7 : 1.2);
        for (let r = r0; r < r1; r++) if (s.t < 0.6 || (Math.round(r) + k) % 2 === 0) this.screen.set(Math.round(bx + Math.cos(a) * r), Math.round(by + Math.sin(a) * r * 0.7), r < r0 + 3 ? NEUTRAL[7] : GOLD[5]);
      }
      if (s.heading !== undefined) {
        for (let k = 0; k < 8; k++) {
          const a = s.heading + (hash(k, Math.round(by), 31) - 0.5) * 1.5;
          const d = 5 + s.t * (14 + hash(k, 2, 31) * 14) * size;
          const x = Math.round(bx + Math.cos(a) * d);
          const y = Math.round(by + Math.sin(a) * d * 0.7 + s.t * s.t * 16);
          const c = [NEUTRAL[7], GOLD[6], EARTH[5], RED[4]][k % 4];
          this.screen.set(x, y, c);
          if (s.t < 0.7) this.screen.set(x + 1, y, c);
        }
      }
    } else if (s.kind === 'blood') {
      // A spray of red droplets that arc up and fall.
      for (let k = 0; k < 10; k++) {
        const side = hash(k, Math.round(by), 13) < 0.5 ? -1 : 1;
        const vx = side * (8 + hash(k, 1, 13) * 22);
        const vy = -14 - hash(k, 2, 13) * 16;
        const x = bx + vx * s.t;
        const y = by + vy * s.t + 44 * s.t * s.t;
        const c = k % 3 === 0 ? RED[5] : RED[3];
        this.screen.set(Math.round(x), Math.round(y), c);
        if (k % 2 === 0) this.screen.set(Math.round(x), Math.round(y) + 1, RED[2]);
      }
    } else if (s.kind === 'gather') {
      // Magic gathering at Aldric's hands as he casts: bright motes spiral in, and flare at the end.
      const colour = s.color ?? GOLD[6];
      for (let k = 0; k < 18; k++) {
        const a = k * 0.698 + s.t * 5 + (k % 2) * 0.4;
        const r = (1 - s.t) * (20 + (k % 4) * 6) + 4;
        const x = Math.round(bx + Math.cos(a) * r);
        const y = Math.round(by + Math.sin(a) * r * 0.7);
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) this.screen.set(x + dx, y + dy, k % 3 === 0 ? GOLD[6] : colour);
        this.screen.set(x, y, NEUTRAL[7]);
      }
      if (s.t > 0.6) {
        const flare = (s.t - 0.6) / 0.4;
        for (let j = -7; j <= 7; j++) for (let i = -7; i <= 7; i++) if (Math.abs(i) + Math.abs(j) <= 2 + flare * 5) this.screen.set(Math.round(bx + i), Math.round(by + j), Math.abs(i) + Math.abs(j) <= 1 + flare * 2 ? NEUTRAL[7] : colour);
      }
    } else if (s.kind === 'rainbow') {
      // Good luck, as HoMM2 shows it: a rainbow arcs down out of the sky onto the lucky stack (#190),
      // drawn from the sky end as it comes, then thinning away.
      const [sx, sy] = s.from;
      const [ex, ey] = s.to;
      const [cx, cy] = [(sx * 0.35 + ex * 0.65), Math.min(sy, ey) - 50];
      const grow = Math.min(1, s.t / 0.45);
      const shown = s.t < 0.7 ? 1 : (1 - s.t) / 0.3;
      const bands = [RED[5], GOLD[6], LEAF[6], BLUE[5], PLUM[4]];
      const steps = Math.ceil(Math.hypot(ex - sx, ey - sy) * 1.4);
      for (let i = 0; i <= steps * grow; i++) {
        const u = i / steps;
        const x = (1 - u) ** 2 * sx + 2 * (1 - u) * u * cx + u * u * ex;
        const y = (1 - u) ** 2 * sy + 2 * (1 - u) * u * cy + u * u * ey;
        const [tx, ty] = [2 * (1 - u) * (cx - sx) + 2 * u * (ex - cx), 2 * (1 - u) * (cy - sy) + 2 * u * (ey - cy)];
        const n = Math.hypot(tx, ty) || 1;
        const [nx, ny] = [-ty / n, tx / n];
        for (let b = 0; b < 10; b++) {
          const [px, py] = [Math.round(x + nx * (b - 5)), Math.round(y + ny * (b - 5))];
          if (shown < 1 && bayer(px, py) >= shown) continue;
          if (py >= MAP_VIEW.y && py < MAP_VIEW.y + MAP_VIEW.height) this.screen.set(px, py, bands[b >> 1]);
        }
      }
    } else if (s.kind === 'ring') {
      // Good spirits: a gold ring swelling out from the stack's feet, and rays going up, as a level-up glows on the map (#190).
      const t = s.t;
      const r = 6 + t * 40;
      for (let a = 0; a < Math.PI * 2; a += 0.015) {
        for (const grow of [0, 1]) {
          const x = Math.round(bx + Math.cos(a) * (r + grow));
          const y = Math.round(by + Math.sin(a) * (r + grow) * 0.4);
          if (bayer(x, y) >= t) this.screen.set(x, y, grow ? GOLD[4] : t < 0.5 ? GOLD[6] : GOLD[5]);
        }
      }
      for (let k = 0; k < 8; k++) {
        const x = Math.round(bx + (k - 3.5) * 7);
        const top = by - 18 - t * 56 - (k % 3) * 7;
        for (let y = Math.floor(top); y < top + 9 * (1 - t); y++) if (bayer(x, y) >= t * 0.8) this.screen.set(x, y, k % 2 ? GOLD[6] : NEUTRAL[7]);
      }
    } else if (s.kind === 'cloud') {
      // Low spirits: a little grey cloud over the stack, drizzling on it (#190).
      const shown = Math.min(1, s.t / 0.15, (1 - s.t) / 0.3);
      const cx = bx + Math.sin(s.t * 3) * 3;
      for (const [dx, dy, r] of [[-12, 2, 8], [0, -3, 10], [12, 1, 8], [5, 5, 8], [-5, 5, 8]] as const) {
        for (let y = Math.floor(by + dy - r); y <= by + dy + r; y++) {
          for (let x = Math.floor(cx + dx - r); x <= cx + dx + r; x++) {
            const d = Math.hypot(x - cx - dx, (y - by - dy) * 1.3) / r;
            if (d > 1 || bayer(x, y) >= shown) continue;
            this.screen.set(x, y, d > 0.8 ? STONE[2] : y < by + dy - r * 0.3 ? STONE[5] : STONE[4]);
          }
        }
      }
      for (let k = 0; k < 9; k++) {
        const x = Math.round(cx - 14 + k * 3.5);
        const y = Math.round(by + 11 + ((s.t * 60 + k * 5) % 16));
        if (bayer(x, y) < shown) for (const dy of [0, 1]) this.screen.set(x, y + dy, BLUE[4]);
      }
    } else if (s.kind === 'motes') {
      // A victory: gold motes drifting up over the whole field (#190).
      const shown = Math.min(1, s.t / 0.15, (1 - s.t) / 0.3);
      for (let k = 0; k < 56; k++) {
        const x = Math.round(MAP_VIEW.x + 20 + hash(k, 1, 51) * (MAP_VIEW.width - 40) + Math.sin(s.t * 5 + k) * 4);
        const y = Math.round(MAP_VIEW.y + 40 + ((hash(k, 2, 51) + 1 - s.t * (0.3 + hash(k, 3, 51) * 0.3)) % 1) * (MAP_VIEW.height - 60));
        if ((k + Math.floor(s.t * 24)) % 4 === 0 || bayer(x, y) >= shown) continue;
        this.screen.set(x, y, NEUTRAL[7]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) this.screen.set(x + dx, y + dy, k % 2 ? GOLD[6] : GOLD[5]);
      }
    } else if (s.kind === 'smoke') {
      // Smoke rising where a Fireball burst (#190): grey puffs that swell, drift up and thin out.
      for (let k = 0; k < 6; k++) {
        const px = bx + (k - 2.5) * 10 + Math.sin(s.t * 4 + k) * 3;
        const py = by - 6 - s.t * (34 + (k % 3) * 8);
        const r = 4 + s.t * 9 + (k % 2) * 2;
        for (let y = Math.floor(py - r); y <= py + r; y++) {
          for (let x = Math.floor(px - r); x <= px + r; x++) {
            const d = Math.hypot(x - px, (y - py) * 1.2) / r;
            if (d > 1 || bayer(x, y) < s.t * 0.95 + 0.15) continue;
            this.screen.set(x, y, d > 0.7 ? STONE[2] : d > 0.35 ? STONE[3] : STONE[4]);
          }
        }
      }
    } else if (s.kind === 'dust') {
      // Dust thrown up along the ground where something lands (#190): low puffs spread `size` wide,
      // swelling, rising a little and thinning out.
      const width = s.size ?? 40;
      for (let k = 0; k < 6; k++) {
        const px = bx + (k - 2.5) * (width / 6) + (hash(k, Math.round(bx), 41) - 0.5) * 4;
        const py = by - 2 - s.t * 8 - (k % 2) * 3;
        const r = 2 + s.t * (3 + width / 10) + (k % 3);
        for (let y = Math.floor(py - r); y <= py + r; y++) {
          for (let x = Math.floor(px - r); x <= px + r; x++) {
            const d = Math.hypot(x - px, (y - py) * 1.3) / r;
            if (d > 1 || bayer(x, y) < s.t * 0.95) continue;
            this.screen.set(x, y, d < 0.35 ? STONE[6] : d < 0.7 ? STONE[5] : STONE[3]);
          }
        }
      }
    } else if (s.kind === 'poof') {
      // Dust where a stack went down: puffs that swell, rise and thin out.
      for (let k = 0; k < 7; k++) {
        const px = bx + (k - 3) * 7 + Math.sin(k * 2.1) * 3;
        const py = by - 6 - s.t * 18 - (k % 3) * 5;
        const r = 4 + s.t * 7 + (k % 2) * 2;
        for (let y = Math.floor(py - r); y <= py + r; y++) {
          for (let x = Math.floor(px - r); x <= px + r; x++) {
            const d = Math.hypot(x - px, (y - py) * 1.2) / r;
            if (d > 1 || bayer(x, y) < s.t * 0.9) continue;
            this.screen.set(x, y, d > 0.7 ? STONE[3] : d > 0.35 ? STONE[5] : STONE[6]);
          }
        }
      }
    } else {
      for (let k = 0; k < 14; k++) {
        const a = k * 0.9 + s.t * 6;
        const r = 10 + (k % 4) * 5;
        this.screen.set(Math.round(bx + Math.cos(a) * r), Math.round(by - 20 + Math.sin(a) * r * 0.6 - s.t * 10), s.color ?? GOLD[6]);
      }
    }
  }

  private bar(b: BattleState, view: BattleView) {
    const { screen } = this;
    paintBarBackground(screen);
    const big = bigLettering();
    const text = BAR.y + 5 - Math.floor((lettered(13) - 13) / 2);
    const shownId = view.inspect ?? view.active;
    const countOf = (x: { id: number; count: number }) => view.counts.get(x.id) ?? x.count;
    const f = shownId === null ? null : b.fighters.find((x) => x.id === shownId && countOf(x) > 0);
    if (view.targeting) drawText(screen, `Cast ${SPELLS[view.targeting as SpellId]?.name ?? view.targeting}: ${view.touch ? 'tap a target, or Cancel' : 'pick a target (Esc to cancel)'}`, BAR.x + 12, text, GOLD[6], INK, lettered(13));
    else if (f) {
      const t = unitOf(f);
      const share = (x: number) => `${x > 0 ? '+' : '\u2212'}${Math.round(Math.abs(x) * 100)}%`;
      const [luck, morale] = [luckOf(b, f), moraleOf(b, f)];
      const spirits = [Math.round(luck * 100) ? `Luck ${share(luck)}` : '', Math.round(morale * 100) ? `Morale ${share(morale)}` : ''];
      const named = [...spirits, ...abilitiesOf(f.troop).map((a) => a.name), ...f.status.map((s) => STATUSES[s].name), f.defending ? 'Defending' : ''].filter(Boolean);
      const tagged = (list: string[]) => list.map((tag) => ` ${tag}`).join('');
      const tags = tagged(named);
      const { attack, defence } = statsOf(b, f);
      const count = countOf(f);
      // A named foe is one of a kind: "Baron Grimsby", not "1 Baron Grimsby". An enemy hero says his level (#239).
      const who = t.name === t.one ? `${capital(t.name)}${f.level ? `, level ${roman(f.level)}` : ''}` : `${count} ${count === 1 ? t.one : t.name}`;
      // Nothing reaches a leader, so he has no defence or health to speak of, only his own blows, if he strikes at all.
      const blows = isLeader(f) && !f.shots && !abilitiesOf(f.troop).some((a) => a.rides) ? '' : ` Att ${attack}${isLeader(f) ? '' : ` Def ${defence}`} Dmg ${t.damage[0]}-${t.damage[1]}`;
      const numbers = `${who}  ·${blows}${isLeader(f) ? '' : ` HP ${view.health.get(f.id) ?? f.hp}/${t.hp}`}${hasTurn(f) ? ` Spd ${speedOf(f)}` : ''}${f.shots ? ` Shots ${f.shots}` : ''}`;
      let info = `${numbers}${tags}`;
      // A long line gets smaller type rather than running into the mana.
      const room = BUTTONS[0].rect.x - lettered(70) - 8 - (BAR.x + 12);
      const top = lettered(13);
      let size = top;
      while (size > lettered(big ? 12 : 10) && textMask(info, size).width > room) size--;
      // By touch the type stays big enough to read, so the line's last tags go instead: the stack's card has them all.
      if (big) {
        const kept = [...named];
        while (kept.length && textMask(info, size).width > room) {
          kept.pop();
          info = `${numbers}${tagged(kept)}`;
        }
      }
      drawText(screen, info, BAR.x + 12, text + Math.floor((top - size) / 2), f.side === 'player' ? PARCHMENT[6] : RED[6], INK, size);
    }
    // A villain's mana while you look at him; your own otherwise.
    const mana = f?.book ? `Mana ${f.book.mana}` : `Mana ${b.hero.mana}`;
    drawText(screen, mana, BUTTONS[0].rect.x - lettered(70), text, f?.book ? RED[6] : BLUE[6], INK, lettered(13));
    for (const button of BUTTONS) {
      const { x, y, width, height } = button.rect;
      const disabled = button.id === 'spells' && !Object.values(SPELLS).some((s) => canCast(b, s.id));
      const label = button.id === 'auto' && view.finishOffer ? 'Finish' : button.id === 'defend' && view.bard ? 'Sing' : button.label;
      for (let j = 0; j < height; j++) {
        for (let i = 0; i < width; i++) {
          const edge = i === 0 || j === 0 ? GOLD[4] : i === width - 1 || j === height - 1 ? INK : -1;
          screen.set(x + i, y + j, edge >= 0 ? edge : shade(STONE, 0.42 - j * 0.01 + (noise((x + i) / 4, (y + j) / 4, 41) - 0.5) * 0.2, x + i, y + j));
        }
      }
      const size = lettered(12);
      const left = big ? Math.round(width / 2 - textMask(label, size).width / 2) : Math.round(width / 2 - label.length * 3.4);
      drawText(screen, label, x + left, y + 1 - Math.floor((size - 12) / 2), disabled ? STONE[4] : PARCHMENT[6], INK, size);
    }
  }

  /**
   * The last thing that happened, on a dark strip across the top of the field: smaller type if it's
   * too long for it, and if it's still too long, its last sentences go, so it's never cut off.
   */
  private logLine(text: string) {
    if (!text) return;
    const y0 = LOG_TOP;
    const big = bigLettering();
    // By touch the type is bigger, so the strip is wider and a little deeper.
    const [left, right] = big ? [MAP_VIEW.x + 60, MAP_VIEW.x + MAP_VIEW.width - 60] : [MAP_VIEW.x + 150, MAP_VIEW.x + MAP_VIEW.width - 150];
    for (let y = y0 - (big ? 3 : 0); y < LOG_BOTTOM + (big ? 2 : 0); y++) for (let x = left; x < right; x++) this.screen.set(x, y, SHADOW_LUT[SHADOW_LUT[this.screen.get(x, y)]]);
    const top = lettered(13);
    let size = top;
    while (size > lettered(big ? 12 : 11) && textMask(text, size).width > right - left) size--;
    while (textMask(text, size).width > right - left) {
      const end = text.slice(0, -1).search(/[.!?][^.!?]*$/);
      if (end <= 0) break;
      text = text.slice(0, end + 1);
    }
    const across = big ? textMask(text, size).width / 2 : (text.length * 3.3 * size) / 13;
    drawText(this.screen, text, Math.round(MAP_VIEW.x + MAP_VIEW.width / 2 - across), y0 - 1 + Math.floor((13 - size) / 2), PARCHMENT[6], INK, size);
  }
}

export { HEXES, hexAt, hexCentre, sideAt };
