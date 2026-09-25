import { TROOPS } from '../content/troops';
import { SPELLS } from '../content/spells';
import { speedOf, type BattleState } from '../rules/battle/battle';
import { COLS, colOf, HEXES, ROWS, rowOf } from '../rules/battle/hex';
import { Bitmap, blit } from './bitmap';
import { flashSprite, FIGHTER_FOOT, troopSprite, type Pose } from './battleSprites';
import { BAR, MAP_VIEW, paintBarBackground, paintFrame, SCREEN, type Rect } from './frame';
import { hash, noise, shade } from './noise';
import { BLUE, GOLD, GRASS, INK, LIGHT_LUT, NEUTRAL, PARCHMENT, RED, SHADOW_LUT, STONE } from './palette';
import { boulder, oak, pine } from './sprites';
import { drawText } from './text';

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
export type Shot = { from: [number, number]; to: [number, number]; t: number; kind: 'arrow' | 'bolt' | 'sparkle'; color?: number };

/** What the battle controller wants drawn this frame, on top of the rules state. */
export type BattleView = {
  positions: Map<number, [number, number]>;
  poses: Map<number, Pose>;
  flashing: Set<number>;
  /** Fighters still drawn although the rules have them dead, until their hit plays out. */
  dying: Set<number>;
  reach: Set<number>;
  hover: { hex: number; kind: 'move' | 'melee' | 'shoot' | 'spell' } | null;
  floaters: Floater[];
  shots: Shot[];
  log: string;
  /** Whose turn it is, for the bar. */
  active: number | null;
  /** A stack under the pointer: the bar shows it instead of the acting one. */
  inspect: number | null;
  /** What the pointed-at action would do, shown instead of the log. */
  preview: string | null;
  targeting: string | null;
};

export const BUTTONS: { id: 'spells' | 'wait' | 'defend' | 'auto' | 'retreat'; label: string; rect: Rect }[] = ['spells', 'wait', 'defend', 'auto', 'retreat'].map((id, i) => ({
  id: id as 'spells',
  label: { spells: 'Spells', wait: 'Wait', defend: 'Defend', auto: 'Auto', retreat: 'Retreat' }[id]!,
  rect: { x: BAR.x + BAR.width - 5 * 66 - 6 + i * 66, y: BAR.y + 3, width: 62, height: BAR.height - 6 },
}));

function paintField(obstacles: number[], seed: number): Bitmap {
  const field = new Bitmap(SCREEN.width, SCREEN.height);
  for (let y = MAP_VIEW.y; y < MAP_VIEW.y + MAP_VIEW.height; y++) {
    for (let x = MAP_VIEW.x; x < MAP_VIEW.x + MAP_VIEW.width; x++) {
      const inField = x > X0 - 10 && x < X0 + FIELD_W + 10 && y > Y0 - 4 && y < Y0 + (ROWS - 1) * ROW_H + HALF_H * 2 + 6;
      let level = 0.56 + (noise(x / 40, y / 40, seed) - 0.5) * 0.35 + (noise(x / 7, y / 7, seed + 1) - 0.5) * 0.24 + (hash(x, y, seed + 2) - 0.5) * 0.15;
      if (!inField) level -= 0.18;
      field.set(x, y, shade(GRASS, level, x, y));
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
    const t = i % 3 === 0 ? oak(900 + i, 26) : pine(930 + i, 30);
    const x = MAP_VIEW.x + 10 + ((i * 61 + 13) % (MAP_VIEW.width - 40));
    const top = i % 2 === 0;
    const y = top ? MAP_VIEW.y - t.height + 26 + (i % 3) * 3 : MAP_VIEW.y + MAP_VIEW.height - 18;
    if (!top && x > X0 && x < X0 + FIELD_W - 20) continue;
    blit(field, t, x, y, MAP_VIEW);
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
    const rock = n % 2 === 0 ? boulder(600 + n, 22) : oak(620 + n, 30);
    blit(field, rock, Math.round(cx - rock.width / 2), Math.round(cy + 10 - rock.height + (n % 2 === 0 ? 4 : 6)));
  }
  return field;
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

  constructor(battle: BattleState) {
    const { frame, overlay } = paintFrame();
    this.frame = frame;
    this.overlay = overlay;
    this.field = paintField(battle.obstacles, (battle.seed >>> 8) & 1023);
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

    const shown = b.fighters.filter((f) => f.count > 0 || view.dying.has(f.id));
    const place = (id: number, at: number) => view.positions.get(id) ?? hexCentre(at);
    shown.sort((x, y) => place(x.id, x.at)[1] - place(y.id, y.at)[1]);
    for (const f of shown) {
      const [cx, cy] = place(f.id, f.at);
      const facing = f.side === 'player' ? 1 : -1;
      let sprite = troopSprite(f.troop, facing, view.poses.get(f.id) ?? 'idle');
      if (view.flashing.has(f.id)) sprite = flashSprite(sprite);
      blit(screen, sprite, Math.round(cx - sprite.width / 2), Math.round(cy + 12 - FIGHTER_FOOT(f.troop)), MAP_VIEW);
      if (f.count > 0) this.badge(Math.round(cx + facing * 14), Math.round(cy + 8), f.count, f.side === 'player');
    }
    for (const s of view.shots) this.shot(s);
    for (const t of view.floaters) drawText(screen, t.text, Math.round(t.x - t.text.length * 3.5), Math.round(t.y - t.age * 26), t.color, INK, 13);
    this.logLine(view.preview ?? view.log);
    this.bar(b, view);
    blit(screen, this.overlay, 0, 0);
    return screen;
  }

  private badge(cx: number, y: number, count: number, player: boolean) {
    const text = String(count);
    const w = text.length * 7 + 7;
    const x = cx - Math.floor(w / 2);
    const fill = player ? BLUE[2] : RED[2];
    for (let j = 0; j < 13; j++) {
      for (let i = 0; i < w; i++) {
        const edge = i === 0 || j === 0 || i === w - 1 || j === 12;
        this.screen.set(x + i, y + j, edge ? GOLD[3] : fill);
      }
    }
    drawText(this.screen, text, x + 3, y - 2, NEUTRAL[7], INK, 11);
  }

  private shot(s: Shot) {
    const [ax, ay] = s.from;
    const [bx, by] = s.to;
    if (s.kind === 'arrow') {
      const t = Math.min(1, s.t);
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t - Math.sin(t * Math.PI) * 40;
      const dx = bx - ax;
      const len = Math.hypot(dx, by - ay) || 1;
      for (let k = 0; k < 7; k++) this.screen.set(Math.round(x - (dx / len) * k), Math.round(y - ((by - ay) / len) * k + (1 - 2 * t) * k * 0.4), k === 0 ? STONE[6] : k > 5 ? NEUTRAL[7] : PARCHMENT[2]);
    } else if (s.kind === 'bolt') {
      let x = bx + 30;
      for (let y = MAP_VIEW.y + 4; y < by; y += 2) {
        x += (hash(y, Math.floor(s.t * 20), 5) - 0.5) * 10;
        x += (bx - x) * 0.08;
        for (const dx of [-1, 0, 1]) this.screen.set(Math.round(x + dx), y, dx === 0 ? NEUTRAL[7] : GOLD[6]);
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
    const f = shownId === null ? null : b.fighters.find((x) => x.id === shownId && x.count > 0);
    if (view.targeting) drawText(screen, `Cast ${view.targeting}: pick a target (Esc to cancel)`, BAR.x + 12, text, GOLD[6], INK);
    else if (f) {
      const t = TROOPS[f.troop];
      const tags = [f.blessed ? ' Blessed' : '', f.slowed ? ' Slowed' : '', f.defending ? ' Defending' : ''].join('');
      const info = `${f.count} ${f.count === 1 ? t.one : t.name}  ·  Att ${t.attack} Def ${t.defence} Dmg ${t.damage[0]}-${t.damage[1]} HP ${f.hp}/${t.hp} Spd ${speedOf(f)}${f.shots ? ` Shots ${f.shots}` : ''}${tags}`;
      drawText(screen, info, BAR.x + 12, text, f.side === 'player' ? PARCHMENT[6] : RED[6], INK);
    }
    const mana = `Mana ${b.hero.mana}`;
    drawText(screen, mana, BUTTONS[0].rect.x - 70, text, BLUE[6], INK);
    for (const button of BUTTONS) {
      const { x, y, width, height } = button.rect;
      const disabled = button.id === 'spells' && !Object.values(SPELLS).some((s) => b.hero.spells.includes(s.id) && b.hero.mana >= s.mana && b.hero.castRound < b.round);
      for (let j = 0; j < height; j++) {
        for (let i = 0; i < width; i++) {
          const edge = i === 0 || j === 0 ? GOLD[4] : i === width - 1 || j === height - 1 ? INK : -1;
          screen.set(x + i, y + j, edge >= 0 ? edge : shade(STONE, 0.42 - j * 0.01 + (noise((x + i) / 4, (y + j) / 4, 41) - 0.5) * 0.2, x + i, y + j));
        }
      }
      drawText(screen, button.label, x + Math.round(width / 2 - button.label.length * 3.4), y + 1, disabled ? STONE[4] : PARCHMENT[6], INK, 12);
    }
  }

  /** The last thing that happened, on a dark strip across the top of the field. */
  private logLine(text: string) {
    if (!text) return;
    const y0 = MAP_VIEW.y + 6;
    for (let y = y0; y < y0 + 18; y++) for (let x = MAP_VIEW.x + 150; x < MAP_VIEW.x + MAP_VIEW.width - 150; x++) this.screen.set(x, y, SHADOW_LUT[SHADOW_LUT[this.screen.get(x, y)]]);
    drawText(this.screen, text, Math.round(MAP_VIEW.x + MAP_VIEW.width / 2 - text.length * 3.3), y0 - 1, PARCHMENT[6], INK, 13);
  }
}

export { HEXES };
