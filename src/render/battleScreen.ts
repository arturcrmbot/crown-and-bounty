import { abilitiesOf, TROOPS, type TroopId } from '../content/troops';
import { SPELLS, STATUSES, type SpellId } from '../content/spells';
import { canCast, hasTurn, isLeader, lookOf, luckOf, moraleOf, speedOf, statsOf, unitOf, type BattleState, type Fighter } from '../rules/battle/battle';
import { COLS, colOf, HEXES, hexIndex, ROWS, rowOf } from '../rules/battle/hex';
import { Bitmap, blit, SHADOW } from './bitmap';
import { critters, critterSprite, type Critter } from './critters';
import { animLength, bodyHeight, corpseSprite, hurtSprite, standard, STAND, troopFigure, type Pose, type Standard } from './battleSprites';
import { upcomingFighters } from './battleOrder';
import { ART } from './units';
import { drawBanner } from './banner';
import { TIP } from './speech';
import { BAR, MAP_VIEW, paintBarBackground, paintFrame, SCREEN, type Rect } from './frame';
import { bayer, fbm, hash, noise, shade } from './noise';
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
  if (has('baron', 'rook', 'swordsmen', 'crossbowmen')) return { cloth: [RED[1], RED[2], RED[3], RED[4]], emblem: 'goose' };
  if (has('witch', 'bramble', 'goblins', 'trolls')) return { cloth: [PLUM[1], PLUM[2], PLUM[3], PLUM[4]], emblem: 'moon' };
  if (has('bandits', 'poachers')) return { cloth: [LEAF[0], LEAF[1], LEAF[2], LEAF[3]], emblem: 'skull' };
  return null;
}

/** Now and then a stack that waits fidgets, as its Wesnoth unit does, each on its own clock. */
function fidget(troop: TroopId, id: number, time: number): Pose {
  if (!ART[troop].idle || time === 0) return STAND;
  const period = 6 + ((id * 2.3) % 5);
  const ms = (((time + id * 1.7) % period) - (period - animLength(troop, 'idle') / 1000)) * 1000;
  return ms >= 0 ? { anim: 'idle', ms } : STAND;
}

/** Pointy-top hexes, squashed for HoMM2's oblique view: 64 wide, rows 44 apart. */
const HEX_W = 64;
const ROW_H = 44;
const HALF_H = 29;
const FIELD_W = COLS * HEX_W + HEX_W / 2;
const X0 = MAP_VIEW.x + (MAP_VIEW.width - FIELD_W) / 2;
const Y0 = MAP_VIEW.y + 34;

export function hexCentre(i: number): [number, number] {
  const row = rowOf(i);
  return [X0 + HEX_W / 2 + colOf(i) * HEX_W + (row % 2 === 1 ? HEX_W / 2 : 0), Y0 + HALF_H + row * ROW_H];
}

/** Whether (x, y) falls inside the hex centred at (cx, cy). */
function insideHex(x: number, y: number, cx: number, cy: number) {
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  return dx <= HEX_W / 2 && dy <= HALF_H - (dx / (HEX_W / 2)) * (HALF_H / 2);
}

export function hexAt(x: number, y: number): number | null {
  for (let i = 0; i < HEXES; i++) {
    const [cx, cy] = hexCentre(i);
    if (insideHex(x, y, cx, cy)) return i;
  }
  return null;
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
/** The message ribbon across the top of the field. */
const LOG_TOP = MAP_VIEW.y + 6;
export const LOG_BOTTOM = LOG_TOP + 18;
export type Shot = { from: [number, number]; to: [number, number]; t: number; kind: 'arrow' | 'quarrel' | 'hex' | 'magic' | 'gather' | 'bolt' | 'fire' | 'sparkle' | 'spark' | 'blood' | 'poof'; color?: number };
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
  /** Fighters still drawn although the rules have them dead, until their hit plays out. */
  dying: Set<number>;
  /** Stacks the rules have on the field that haven't got there yet: a summoned stack, till it marches in. */
  hidden: Set<number>;
  /** What a stack looks like while a change plays out (newts, or null for itself), instead of what its statuses say. */
  looks: Map<number, Critter | null>;
  reach: Set<number>;
  /** What a click on the hex under the pointer would do, and for a blow, the hex it is struck from. */
  hover: { hex: number; kind: 'move' | 'melee' | 'shoot' | 'spell' | 'bard'; from?: number } | null;
  /** The stacks that click would reach, lit: `target` for those it's aimed at, `danger` for your own it would hurt too. */
  lit: ReadonlyMap<number, 'target' | 'danger'>;
  floaters: Floater[];
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
  /** How hard the field shakes this frame, in pixels. */
  shake: number;
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
    for (const i of view.reach) fillHex(screen, i, LIGHT_LUT, 2);
    const active = view.active === null ? null : b.fighters.find((f) => f.id === view.active);
    // The stack whose turn it is stands on a lit hex; a leader has his ring behind the line instead.
    if (active && active.count > 0 && !isLeader(active)) {
      fillHex(screen, active.at, LIGHT_LUT, 1);
      outlineHex(screen, active.at, GOLD[5]);
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
      const { sprite, x, y } = corpseSprite(f.troop, f.side === 'player' ? 'blue' : 'red', f.side === 'player' ? 1 : -1);
      blit(screen, sprite, Math.round(cx + x), Math.round(cy + 12 + y), MAP_VIEW);
    }
    const flap = Math.floor(view.time * 5) % 8;
    const star = this.ours[flap];
    blit(screen, star, MAP_VIEW.x + 18, Y0 + 100 - star.height, MAP_VIEW);
    if (this.standard) {
      const flag = this.standard[flap];
      blit(screen, flag, MAP_VIEW.x + MAP_VIEW.width - flag.width - 18, Y0 + 100 - flag.height, MAP_VIEW);
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
    shown.sort((x, y) => place(x)[1] - place(y)[1]);
    for (const f of shown) {
      const [px, py] = place(f);
      const [ox, oy] = view.offsets.get(f.id) ?? [0, 0];
      const facing = view.facings.get(f.id) ?? (f.side === 'player' ? 1 : -1);
      // Turned into newts or frogs, a stack is those creatures till the spell wears off.
      const look = view.looks.has(f.id) ? view.looks.get(f.id)! : lookOf(f);
      if (look) {
        for (const c of critters(look, !oneOfAKind(f), view.time, f.id)) {
          const sprite = critterSprite(look, facing, c.phase);
          const shown = view.flashing.has(f.id) ? hurtSprite(sprite) : sprite;
          const [x, y] = [Math.round(px + ox + c.dx - sprite.width / 2), Math.round(py + oy + 12 + c.dy - sprite.height)];
          if (view.lit.has(f.id)) this.glow(sprite, x, y, view.lit.get(f.id)!, view.time);
          blit(screen, shown, x, y, MAP_VIEW);
        }
        continue;
      }
      const pose = view.poses.get(f.id) ?? (view.positions.has(f.id) ? STAND : fidget(f.troop, f.id, view.time));
      const figure = troopFigure(f.troop, f.side === 'player' ? 'blue' : 'red', facing, pose, 'battle');
      const sprite = view.flashing.has(f.id) ? hurtSprite(figure.sprite) : figure.sprite;
      // Standing about, everyone breathes: a pixel up and down, each stack in its own time.
      const breath = pose.anim === 'stand' && !view.positions.has(f.id) && !view.offsets.has(f.id) && Math.sin(view.time * 2.4 + f.id * 1.9) > 0.35 ? 1 : 0;
      const [x, y] = [Math.round(px + ox + figure.x), Math.round(py + oy + 12 + figure.y) - breath];
      if (view.lit.has(f.id)) this.glow(figure.sprite, x, y, view.lit.get(f.id)!, view.time);
      blit(screen, sprite, x, y, MAP_VIEW);
    }
    // A blow's way in: an arrow on the edge from the hex it is struck from into the stack it lands on.
    if (view.hover?.kind === 'melee' && view.hover.from !== undefined) this.arrow(hexCentre(view.hover.from), hexCentre(view.hover.hex));
    // Counts go on last, so a troll never hides the goblins behind him. A leader has none: he's one
    // of a kind, and nothing can hurt him.
    for (const f of shown) {
      const count = view.counts.get(f.id) ?? f.count;
      if (count <= 0 || isLeader(f)) continue;
      const [cx, cy] = place(f);
      this.badge(Math.round(cx + (f.side === 'player' ? 14 : -14)), Math.round(cy + 8), count, f.side === 'player');
    }
    for (const s of view.shots) this.shot(s);
    for (const t of view.floaters) drawText(screen, t.text, Math.round(t.x - t.text.length * 4), Math.round(t.y - t.age * FLOAT_RISE), t.color, INK, 15);
    if (view.speech) this.speech(b, view.speech);
    if (view.banner) drawBanner(screen, view.banner.sprite, MAP_VIEW.x + MAP_VIEW.width / 2, MAP_VIEW.y + 150, view.banner.age, view.banner.life);
    if (view.shake > 0.5) this.shake(view.shake, view.time);
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

  /** Jolts the field (not the frame round it) by up to `amount` pixels, for a heavy blow. */
  private shake(amount: number, time: number) {
    const dx = Math.round((hash(Math.floor(time * 60), 1, 3) - 0.5) * 2 * amount);
    const dy = Math.round((hash(Math.floor(time * 60), 2, 3) - 0.5) * 2 * amount);
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

  /** A stack's count on its hex. */
  private badge(cx: number, y: number, count: number, player: boolean) {
    const text = String(count);
    // By touch the count is bigger, and its badge with it, from the same top.
    const size = lettered(11);
    const w = bigLettering() ? textMask(text, size).width + 6 : text.length * 7 + 7;
    const h = size + 2;
    const x = cx - Math.floor(w / 2);
    const fill = player ? BLUE[2] : RED[2];
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1;
        this.screen.set(x + i, y + j, edge ? GOLD[3] : fill);
      }
    }
    drawText(this.screen, text, x + 3, y - 2, NEUTRAL[7], INK, size);
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
    const height = big ? 24 : 20;
    const words = big ? 4 : 5;
    const x0 = MAP_VIEW.x + Math.floor((MAP_VIEW.width - width) / 2);
    const y0 = LOG_BOTTOM + 2;
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
      const arc = bolt ? 14 : 44;
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
      let x = bx + 30;
      for (let y = MAP_VIEW.y + 4; y < by; y += 2) {
        x += (hash(y, Math.floor(s.t * 20), 5) - 0.5) * 10;
        x += (bx - x) * 0.08;
        for (const dx of [-1, 0, 1]) this.screen.set(Math.round(x + dx), y, dx === 0 ? NEUTRAL[7] : GOLD[6]);
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
      // A star of white and gold where the blow lands: a hard flash at the heart, then streaks out.
      if (s.t < 0.3) for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) if (Math.abs(i) + Math.abs(j) <= 4 - s.t * 8) this.screen.set(Math.round(bx + i), Math.round(by + j), NEUTRAL[7]);
      for (let k = 0; k < 12; k++) {
        const a = k * 0.52 + (hash(k, Math.round(bx), 9) - 0.5) * 0.4;
        const r0 = 3 + s.t * 16;
        const r1 = r0 + 10 * (1 - s.t);
        for (let r = r0; r < r1; r++) if (s.t < 0.6 || (Math.round(r) + k) % 2 === 0) this.screen.set(Math.round(bx + Math.cos(a) * r), Math.round(by + Math.sin(a) * r * 0.7), r < r0 + 3 ? NEUTRAL[7] : GOLD[5]);
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
      const named = [...spirits, ...abilitiesOf(f.troop).map((a) => a.name), ...f.status.filter((s) => s !== 'hasted').map((s) => STATUSES[s].name), f.defending ? 'Defending' : ''].filter(Boolean);
      const tagged = (list: string[]) => list.map((tag) => ` ${tag}`).join('');
      const tags = tagged(named);
      const { attack, defence } = statsOf(b, f);
      const count = countOf(f);
      // A named foe is one of a kind: "Baron Grimsby", not "1 Baron Grimsby".
      const who = t.name === t.one ? t.name : `${count} ${count === 1 ? t.one : t.name}`;
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

export { HEXES };
