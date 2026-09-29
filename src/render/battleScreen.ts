import { abilitiesOf, TROOPS, type TroopId } from '../content/troops';
import { SPELLS, STATUSES } from '../content/spells';
import { canCast, lookOf, rallyOf, speedOf, statsOf, unitOf, type BattleState, type Fighter } from '../rules/battle/battle';
import { COLS, colOf, HEXES, ROWS, rowOf } from '../rules/battle/hex';
import { Bitmap, blit } from './bitmap';
import { critters, critterSprite, type Critter } from './critters';
import { animLength, corpseSprite, hurtSprite, standard, STAND, troopFigure, type Pose, type Standard } from './battleSprites';
import { upcomingFighters } from './battleOrder';
import { ART } from './units';
import { drawBanner } from './banner';
import { BAR, MAP_VIEW, paintBarBackground, paintFrame, SCREEN, type Rect } from './frame';
import { bayer, hash, noise, shade } from './noise';
import { BLUE, CYCLE_BOG, EARTH, GOLD, GRASS, INK, LEAF, LIGHT_LUT, NEUTRAL, PARCHMENT, PLUM, RED, REED, SHADOW_LUT, STONE, WOOD } from './palette';
import { boulder, oak, pine, willow } from './sprites';
import { drawText } from './text';

/** The King's blue with his gold star, over Aldric's side. */
const ROYAL: Standard = { cloth: [BLUE[1], BLUE[2], BLUE[3], BLUE[4]], emblem: 'star' };

/** Aldric, or a villain: one of a kind, a name rather than a number. */
const oneOfAKind = (f: Fighter) => TROOPS[f.troop].name === TROOPS[f.troop].one;

/** Whose standard flies over the enemy: Grimsby's goose, the fen's moon, a skull for outlaws; beasts carry none. */
function standardOf(troops: TroopId[]): Standard | null {
  const has = (...ids: TroopId[]) => troops.some((t) => ids.includes(t));
  if (has('baron', 'swordsmen', 'crossbowmen')) return { cloth: [RED[1], RED[2], RED[3], RED[4]], emblem: 'goose' };
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
  /** The same for health, for those shown by a health bar (one of a kind): it drops as each blow lands. */
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
  hover: { hex: number; kind: 'move' | 'melee' | 'shoot' | 'spell' } | null;
  floaters: Floater[];
  shots: Shot[];
  log: string;
  /** Whose turn it is, for the bar. */
  active: number | null;
  /** A stack under the pointer: the bar shows it instead of the acting one. */
  inspect: number | null;
  /** Stacks the Courtier would rally if he moved to the hovered hex. */
  rallyPreview: Set<number>;
  /** What the pointed-at action would do, shown instead of the log. */
  preview: string | null;
  targeting: string | null;
  /** Seconds since the battle opened, for breathing and flags. */
  time: number;
  /** How hard the field shakes this frame, in pixels. */
  shake: number;
  /** VICTORY or DEFEAT across the field at the end. */
  banner: { sprite: Bitmap; age: number; life: number } | null;
  /** The safe-finish offer replaces Auto in the bar while the player can accept it. */
  finishOffer: boolean;
};

export const BUTTONS: { id: 'spells' | 'wait' | 'defend' | 'auto' | 'retreat'; label: string; rect: Rect }[] = ['spells', 'wait', 'defend', 'auto', 'retreat'].map((id, i) => ({
  id: id as 'spells',
  label: { spells: 'Spells', wait: 'Wait', defend: 'Defend', auto: 'Auto', retreat: 'Retreat' }[id]!,
  rect: { x: BAR.x + BAR.width - 5 * 66 - 6 + i * 66, y: BAR.y + 3, width: 62, height: BAR.height - 6 },
}));

function paintField(obstacles: number[], seed: number, fen: boolean): Bitmap {
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
   * The King's star at the top left, over Aldric's side (he's on the field himself now), and the
   * enemy's standard at the top right (beasts have none).
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
    if (active && active.count > 0) {
      fillHex(screen, active.at, LIGHT_LUT, 1);
      outlineHex(screen, active.at, GOLD[5]);
    }
    if (view.hover) outlineHex(screen, view.hover.hex, view.hover.kind === 'move' ? GOLD[6] : view.hover.kind === 'spell' ? BLUE[6] : RED[5]);

    // The fallen stay where they fell, under everyone still standing. Aldric is carried off.
    for (const f of b.fighters) {
      if (f.count > 0 || view.dying.has(f.id) || f.hero) continue;
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
    // Where a stack stands: its hex, or wherever it has got to on a walk. Lunges and reels move only
    // the figure, so its count stays put on its hex.
    const place = (id: number, at: number) => view.positions.get(id) ?? hexCentre(at);
    // Aldric stands in the gold ring he has on the map, so you find him at a glance here too.
    for (const f of shown) {
      if (!f.hero) continue;
      const [px, py] = place(f.id, f.at);
      const [ox, oy] = view.offsets.get(f.id) ?? [0, 0];
      this.ring(Math.round(px + ox), Math.round(py + oy + 12));
    }
    for (const f of shown) {
      if (f.hero || f.side !== 'player' || !rallyOf(b, f)) continue;
      const [px, py] = place(f.id, f.at);
      const [ox, oy] = view.offsets.get(f.id) ?? [0, 0];
      this.auraRing(Math.round(px + ox), Math.round(py + oy + 12));
    }
    for (const f of shown) {
      if (!view.rallyPreview.has(f.id)) continue;
      const [px, py] = place(f.id, f.at);
      const [ox, oy] = view.offsets.get(f.id) ?? [0, 0];
      this.auraRing(Math.round(px + ox), Math.round(py + oy + 12), true);
    }
    shown.sort((x, y) => place(x.id, x.at)[1] - place(y.id, y.at)[1]);
    for (const f of shown) {
      const [px, py] = place(f.id, f.at);
      const [ox, oy] = view.offsets.get(f.id) ?? [0, 0];
      const facing = view.facings.get(f.id) ?? (f.side === 'player' ? 1 : -1);
      // Turned into newts or frogs, a stack is those creatures till the spell wears off.
      const look = view.looks.has(f.id) ? view.looks.get(f.id)! : lookOf(f);
      if (look) {
        for (const c of critters(look, !oneOfAKind(f), view.time, f.id)) {
          const sprite = critterSprite(look, facing, c.phase);
          const shown = view.flashing.has(f.id) ? hurtSprite(sprite) : sprite;
          blit(screen, shown, Math.round(px + ox + c.dx - sprite.width / 2), Math.round(py + oy + 12 + c.dy - sprite.height), MAP_VIEW);
        }
        continue;
      }
      const pose = view.poses.get(f.id) ?? (view.positions.has(f.id) ? STAND : fidget(f.troop, f.id, view.time));
      const figure = troopFigure(f.troop, f.side === 'player' ? 'blue' : 'red', facing, pose, 'battle');
      const sprite = view.flashing.has(f.id) ? hurtSprite(figure.sprite) : figure.sprite;
      // Standing about, everyone breathes: a pixel up and down, each stack in its own time.
      const breath = pose.anim === 'stand' && !view.positions.has(f.id) && !view.offsets.has(f.id) && Math.sin(view.time * 2.4 + f.id * 1.9) > 0.35 ? 1 : 0;
      blit(screen, sprite, Math.round(px + ox + figure.x), Math.round(py + oy + 12 + figure.y) - breath, MAP_VIEW);
    }
    // Counts go on last, so a troll never hides the goblins behind him. One of a kind (Aldric, a
    // villain) shows how hurt he is instead: "1" would say nothing.
    for (const f of shown) {
      const count = view.counts.get(f.id) ?? f.count;
      if (count <= 0) continue;
      const [cx, cy] = place(f.id, f.at);
      const x = Math.round(cx + (f.side === 'player' ? 14 : -14));
      if (oneOfAKind(f)) this.health(x, Math.round(cy + 11), (view.health.get(f.id) ?? f.hp) / unitOf(f).hp, f.side === 'player');
      else this.badge(x, Math.round(cy + 8), count, f.side === 'player', rallyOf(b, f) !== null);
    }
    for (const s of view.shots) this.shot(s);
    for (const t of view.floaters) drawText(screen, t.text, Math.round(t.x - t.text.length * 4), Math.round(t.y - t.age * FLOAT_RISE), t.color, INK, 15);
    if (view.banner) drawBanner(screen, view.banner.sprite, MAP_VIEW.x + MAP_VIEW.width / 2, MAP_VIEW.y + 150, view.banner.age, view.banner.life);
    if (view.shake > 0.5) this.shake(view.shake, view.time);
    this.logLine(view.preview ?? view.log);
    this.turnStrip(b);
    this.bar(b, view);
    blit(screen, this.overlay, 0, 0);
    return screen;
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

  /** The gold ring on the ground round Aldric's feet: bright, with a dark edge, as on the map. */
  private ring(cx: number, cy: number) {
    const [rx, ry] = [26, 8];
    for (const [grow, colour] of [[1, INK], [-1, GOLD[3]], [0, GOLD[6]]] as const) {
      for (let a = 0; a < Math.PI * 2; a += 0.004) {
        const x = Math.round(cx + Math.cos(a) * (rx + grow));
        const y = Math.round(cy + Math.sin(a) * (ry + grow * 0.6));
        if (y >= MAP_VIEW.y && y < MAP_VIEW.y + MAP_VIEW.height) this.screen.set(x, y, colour);
      }
    }
  }

  /** Gold marks on friendly stacks lifted by the Courtier; dotted gold previews a hovered move. */
  private auraRing(cx: number, cy: number, preview = false) {
    const [rx, ry] = [30, 10];
    const strokes: [number, number][] = preview ? [[0, GOLD[6]]] : [[1, INK], [-1, GOLD[3]], [0, GOLD[6]]];
    for (const [grow, colour] of strokes) {
      for (let a = 0; a < Math.PI * 2; a += 0.004) {
        if (preview && Math.floor(a * 18) % 2) continue;
        const x = Math.round(cx + Math.cos(a) * (rx + grow));
        const y = Math.round(cy + Math.sin(a) * (ry + grow * 0.6));
        if (y >= MAP_VIEW.y && y < MAP_VIEW.y + MAP_VIEW.height) this.screen.set(x, y, colour);
      }
    }
  }

  /** A one-of-a-kind fighter's health: a gold-framed bar in his side's colour, emptying as he's hurt. */
  private health(cx: number, y: number, share: number, player: boolean) {
    const w = 30;
    const x = cx - w / 2;
    const full = Math.round((w - 2) * Math.max(0, Math.min(1, share)));
    for (let j = 0; j < 7; j++) {
      for (let i = 0; i < w; i++) {
        const edge = i === 0 || j === 0 || i === w - 1 || j === 6;
        this.screen.set(x + i, y + j, edge ? GOLD[3] : i - 1 < full ? (player ? (j < 3 ? BLUE[5] : BLUE[4]) : j < 3 ? RED[5] : RED[4]) : INK);
      }
    }
  }

  /** A stack's count on its hex. A rallied stack's badge is edged in bright gold, with a little pennant above. */
  private badge(cx: number, y: number, count: number, player: boolean, rallied = false) {
    const text = String(count);
    const w = text.length * 7 + 7;
    const x = cx - Math.floor(w / 2);
    const fill = player ? BLUE[2] : RED[2];
    for (let j = 0; j < 13; j++) {
      for (let i = 0; i < w; i++) {
        const edge = i === 0 || j === 0 || i === w - 1 || j === 12;
        this.screen.set(x + i, y + j, edge ? (rallied ? GOLD[6] : GOLD[3]) : fill);
      }
    }
    if (rallied) {
      // A little gold pennant on the badge's corner, flying from a dark staff.
      for (let j = -10; j < 0; j++) for (const i of [0, 1]) this.screen.set(x + i, y + j, i ? WOOD[4] : INK);
      for (let j = 0; j < 7; j++) {
        const reach = 7 - Math.abs(j - 3) * 2;
        for (let i = 0; i <= reach; i++) this.screen.set(x + 2 + i, y - 10 + j, i === reach || j === 0 || j === 6 ? INK : j < 3 ? GOLD[6] : GOLD[4]);
      }
    }
    drawText(this.screen, text, x + 3, y - 2, NEUTRAL[7], INK, 11);
  }

  /** The next turns, as small versions of the figures on the field. */
  private turnStrip(b: BattleState) {
    const next = b.result ? [] : upcomingFighters(b);
    if (!next.length) return;
    const { screen } = this;
    const labelWidth = 34;
    const cellWidth = 38;
    const width = labelWidth + next.length * cellWidth + 6;
    const height = 20;
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
    drawText(screen, 'NEXT', x0 + 4, y0 + 5, GOLD[6], INK, 9);

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
      if (fighter.hero) this.smallRing(iconX + Math.floor(icon.width / 2), y0 + height / 2);
      blit(screen, icon, iconX, iconY);
      if (!fighter.hero) {
        drawText(screen, String(fighter.count), x + 20, y0 + 5, PARCHMENT[6], INK, 9);
      }
    });
  }

  private smallRing(cx: number, cy: number) {
    for (const [rx, ry, color] of [[9, 8, INK], [8, 7, GOLD[4]], [7, 6, GOLD[6]]] as const) {
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
    const text = BAR.y + 5;
    const shownId = view.inspect ?? view.active;
    const countOf = (x: { id: number; count: number }) => view.counts.get(x.id) ?? x.count;
    const f = shownId === null ? null : b.fighters.find((x) => x.id === shownId && countOf(x) > 0);
    if (view.targeting) drawText(screen, `Cast ${view.targeting}: pick a target (Esc to cancel)`, BAR.x + 12, text, GOLD[6], INK);
    else if (f) {
      const t = unitOf(f);
      const tags = [...abilitiesOf(f.troop).map((a) => ` ${a.name}`), ...f.status.filter((s) => s !== 'hasted').map((s) => ` ${STATUSES[s].name}`), rallyOf(b, f) ? ' Rallied' : '', f.defending ? ' Defending' : ''].join('');
      const { attack, defence } = statsOf(b, f);
      const count = countOf(f);
      // A named foe is one of a kind: "Baron Grimsby", not "1 Baron Grimsby".
      const who = t.name === t.one ? t.name : `${count} ${count === 1 ? t.one : t.name}`;
      const info = `${who}  ·  Att ${attack} Def ${defence} Dmg ${t.damage[0]}-${t.damage[1]} HP ${view.health.get(f.id) ?? f.hp}/${t.hp} Spd ${speedOf(f)}${f.shots ? ` Shots ${f.shots}` : ''}${tags}`;
      drawText(screen, info, BAR.x + 12, text, f.side === 'player' ? PARCHMENT[6] : RED[6], INK);
    }
    // Aldric's health stays beside the mana even while another fighter is under the pointer.
    const hero = b.fighters.find((x) => x.hero);
    if (hero) drawText(screen, `Aldric ${view.health.get(hero.id) ?? hero.hp}/${unitOf(hero).hp}`, BUTTONS[0].rect.x - 164, text, BLUE[6], INK);
    // A villain's mana while you look at him; your own otherwise.
    const mana = f?.book ? `Mana ${f.book.mana}` : `Mana ${b.hero.mana}`;
    drawText(screen, mana, BUTTONS[0].rect.x - 70, text, f?.book ? RED[6] : BLUE[6], INK);
    for (const button of BUTTONS) {
      const { x, y, width, height } = button.rect;
      const disabled = button.id === 'spells' && !Object.values(SPELLS).some((s) => canCast(b, s.id));
      const label = button.id === 'auto' && view.finishOffer ? 'Finish' : button.label;
      for (let j = 0; j < height; j++) {
        for (let i = 0; i < width; i++) {
          const edge = i === 0 || j === 0 ? GOLD[4] : i === width - 1 || j === height - 1 ? INK : -1;
          screen.set(x + i, y + j, edge >= 0 ? edge : shade(STONE, 0.42 - j * 0.01 + (noise((x + i) / 4, (y + j) / 4, 41) - 0.5) * 0.2, x + i, y + j));
        }
      }
      drawText(screen, label, x + Math.round(width / 2 - label.length * 3.4), y + 1, disabled ? STONE[4] : PARCHMENT[6], INK, 12);
    }
  }

  /** The last thing that happened, on a dark strip across the top of the field. */
  private logLine(text: string) {
    if (!text) return;
    const y0 = LOG_TOP;
    for (let y = y0; y < LOG_BOTTOM; y++) for (let x = MAP_VIEW.x + 150; x < MAP_VIEW.x + MAP_VIEW.width - 150; x++) this.screen.set(x, y, SHADOW_LUT[SHADOW_LUT[this.screen.get(x, y)]]);
    drawText(this.screen, text, Math.round(MAP_VIEW.x + MAP_VIEW.width / 2 - text.length * 3.3), y0 - 1, PARCHMENT[6], INK, 13);
  }
}

export { HEXES };
