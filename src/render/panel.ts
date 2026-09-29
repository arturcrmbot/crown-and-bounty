import { BACKGROUNDS } from '../content/backgrounds';
import { bountyOf, CAMPAIGN_LENGTH, coins, commissionOf, heroStats, LAST_DAY, LEVELS, mapPieces, roman, type BarItem, type GameState } from '../rules/game';
import { Bitmap, blit } from './bitmap';
import { BOUNTY_PLATE, HERO_PLATE, type Rect } from './frame';
import { COIN, CRYSTAL, HORSESHOE } from './hud';
import { hash, noise, shade } from './noise';
import { BLUE, GOLD, INK, PARCHMENT, RED, SLATE, STONE } from './palette';
import { portraitOf, PORTRAIT_SIZE } from './portraits';
import { drawText, textMask } from './text';

/** Something on a plate of the panel, and the box of the screen that answers the pointer for it. */
export type PanelHit = { item: BarItem; x0: number; y0: number; x1: number; y1: number };

/** Where things sit on the plates, from each plate's top left. */
const FACE = { x: 8, y: 8 };
const TEXT_X = 84;
const GAUGE = { x: 26, width: 164 };
const MOVEMENT_Y = 88;
const MANA_Y = 108;
const POSTER_FACE = { x: 8, y: 28 };
const SCRAP = { width: 16, height: 14, gap: 5, y: 106 };

/**
 * The plates under the minimap, as HoMM2 had its hero beside his movement and spell points, and King's
 * Bounty its contract: Aldric's face, name and level with his movement and mana, and the WANTED
 * poster with the reward, the days left and the pieces of the old map found so far. What only changes
 * with a level or a day is drawn once and kept; the gauges are drawn fresh.
 */
export class Panel {
  private readonly cache = new Map<string, Bitmap>();

  /** Paints both plates into `frame` (the interface's), `hover` lit. Returns what answers the pointer where. */
  paint(frame: Bitmap, state: GameState, hover: BarItem | null): PanelHit[] {
    const hero = this.plate(HERO_PLATE, heroKey(state), (b) => paintHero(b, state));
    blit(frame, hero, HERO_PLATE.x, HERO_PLATE.y);
    const stats = heroStats(state);
    gauge(frame, HERO_PLATE.x + GAUGE.x, HERO_PLATE.y + MOVEMENT_Y + 2, GAUGE.width, state.movement / Math.max(1, stats.movement), GOLD);
    gauge(frame, HERO_PLATE.x + GAUGE.x, HERO_PLATE.y + MANA_Y + 2, GAUGE.width, stats.maxMana > 0 ? state.hero.mana / stats.maxMana : 0, BLUE);
    const poster = this.plate(BOUNTY_PLATE, bountyKey(state), (b) => paintBounty(b, state));
    blit(frame, poster, BOUNTY_PLATE.x, BOUNTY_PLATE.y);
    const row = (r: Rect, y: number, height: number) => ({ x0: r.x, y0: r.y + y, x1: r.x + r.width, y1: r.y + y + height });
    const hits: PanelHit[] = [
      { item: { kind: 'movement' }, ...row(HERO_PLATE, MOVEMENT_Y - 3, 16) },
      { item: { kind: 'mana' }, ...row(HERO_PLATE, MANA_Y - 3, 16) },
      { item: { kind: 'hero' }, ...row(HERO_PLATE, 0, HERO_PLATE.height) },
      { item: { kind: 'pieces' }, ...row(BOUNTY_PLATE, SCRAP.y - 4, SCRAP.height + 8) },
      { item: { kind: 'bounty' }, ...row(BOUNTY_PLATE, 0, BOUNTY_PLATE.height) },
    ];
    // Whichever plate the pointer is on is lit round its edge, as the bar's items are underlined.
    const lit = hover && (hover.kind === 'hero' || hover.kind === 'movement' || hover.kind === 'mana' ? HERO_PLATE : hover.kind === 'bounty' || hover.kind === 'pieces' ? BOUNTY_PLATE : null);
    for (const r of [HERO_PLATE, BOUNTY_PLATE]) rim(frame, r, r === lit ? GOLD[5] : SLATE[4]);
    return hits;
  }

  /** A plate's lasting part, drawn once for each `key`. */
  private plate(r: Rect, key: string, draw: (b: Bitmap) => void): Bitmap {
    const id = `${r.y}|${key}`;
    let b = this.cache.get(id);
    if (!b) {
      if (this.cache.size > 16) this.cache.clear();
      b = new Bitmap(r.width, r.height);
      draw(b);
      this.cache.set(id, b);
    }
    return b;
  }
}

const heroKey = (s: GameState) => `${s.hero.background}|${s.hero.level}|${s.hero.xp}`;
const bountyKey = (s: GameState) => `${commissionOf(s).villain}|${s.bounty}|${s.day}|${mapPieces(s)}|${bountyOf(s)}|${s.paid?.gold}`;

/** Slate, a little darker towards the foot. */
function slate(b: Bitmap, seed: number) {
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) b.set(x, y, shade(SLATE, 0.34 + (noise(x / 4, (y + seed) / 4, 57) - 0.5) * 0.18 - (y / b.height) * 0.1, x, y));
  }
}

/** A face on a warm backdrop in a thin gold frame, as on the cards. */
function framedFace(b: Bitmap, face: Bitmap | null, x: number, y: number) {
  for (let j = 0; j < PORTRAIT_SIZE; j++) for (let i = 0; i < PORTRAIT_SIZE; i++) b.set(x + i, y + j, shade(PARCHMENT, 0.62 - j * 0.006 + (hash(i, j, 61) - 0.5) * 0.08, i, j));
  if (face) blit(b, face, x, y);
  trimLine(b, x - 1, y - 1, PORTRAIT_SIZE + 2, PORTRAIT_SIZE + 2, INK);
  trimLine(b, x - 2, y - 2, PORTRAIT_SIZE + 4, PORTRAIT_SIZE + 4, GOLD[4]);
  trimLine(b, x - 3, y - 3, PORTRAIT_SIZE + 6, PORTRAIT_SIZE + 6, INK);
}

function trimLine(b: Bitmap, x: number, y: number, w: number, h: number, colour: number) {
  for (let i = x; i < x + w; i++) {
    b.set(i, y, colour);
    b.set(i, y + h - 1, colour);
  }
  for (let j = y; j < y + h; j++) {
    b.set(x, j, colour);
    b.set(x + w - 1, j, colour);
  }
}

/** The plate's inner edge: lit gold under the pointer, a dark line otherwise. */
function rim(frame: Bitmap, r: Rect, colour: number) {
  trimLine(frame, r.x, r.y, r.width, r.height, colour);
}

/** Words that fit `width`, a line each: the longest run of them that fits, then the rest. */
function lines(text: string, width: number, size: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && textMask(next, size).width > width) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** A gauge: a dark groove, filled `share` of the way along, lit along its top edge. */
function gauge(frame: Bitmap, x: number, y: number, width: number, share: number, ramp: readonly number[]) {
  const filled = Math.round(Math.max(0, Math.min(1, share)) * (width - 2));
  for (let j = 0; j < 7; j++) {
    for (let i = 0; i < width; i++) {
      const edge = j === 0 || j === 6 || i === 0 || i === width - 1;
      frame.set(x + i, y + j, edge ? INK : i - 1 < filled ? (j === 1 ? ramp[6] : j < 4 ? ramp[5] : ramp[4]) : j === 1 ? SLATE[0] : SLATE[1]);
    }
  }
}

/** Aldric's plate: his face, name, background and level, how far to the next, and the marks for his gauges. */
function paintHero(b: Bitmap, state: GameState) {
  slate(b, 0);
  const bg = BACKGROUNDS[state.hero.background];
  framedFace(b, portraitOf(state.hero.background), FACE.x, FACE.y);
  drawText(b, bg.short, TEXT_X, 7, GOLD[6], INK);
  lines(bg.name, b.width - TEXT_X - 6, 11).slice(0, 2).forEach((line, i) => drawText(b, line, TEXT_X, 26 + i * 13, PARCHMENT[5], INK, 11));
  drawText(b, `Level ${roman(state.hero.level)}`, TEXT_X, 54, PARCHMENT[6], INK);
  const [from, to] = [LEVELS[state.hero.level] ?? 0, LEVELS[state.hero.level + 1]];
  gauge(b, TEXT_X, 73, b.width - TEXT_X - 8, to ? (state.hero.xp - from) / (to - from) : 1, GOLD);
  blit(b, HORSESHOE, 8, MOVEMENT_Y + 2);
  blit(b, CRYSTAL, 9, MANA_Y + 1);
}

/**
 * The bounty's plate, as the poster is: WANTED over the villain's face (stamped PAID once he's taken),
 * the reward (or what the Crown paid), the days left, and the pieces of the old map.
 */
function paintBounty(b: Bitmap, state: GameState) {
  slate(b, 40);
  const c = commissionOf(state);
  const paid = state.bounty === 'paid';
  drawText(b, 'WANTED', Math.round((b.width - textMask('WANTED', 13).width) / 2), 5, RED[5], INK);
  framedFace(b, c.face ? portraitOf(c.face) : null, POSTER_FACE.x, POSTER_FACE.y);
  if (paid) stamp(b, 'PAID', POSTER_FACE.x + PORTRAIT_SIZE / 2, POSTER_FACE.y + PORTRAIT_SIZE - 22);
  const name = lines(c.villain, b.width - TEXT_X - 6, 13).slice(0, 2);
  name.forEach((line, i) => drawText(b, line, TEXT_X, 27 + i * 15, GOLD[6], INK));
  const y = 30 + name.length * 15;
  blit(b, COIN, TEXT_X, y + 4);
  drawText(b, coins(paid ? (state.paid?.gold ?? bountyOf(state)) : bountyOf(state)), TEXT_X + 12, y, GOLD[5], INK);
  const left = LAST_DAY - state.day;
  drawText(b, paid ? 'Bounty paid' : `${left} day${left === 1 ? '' : 's'} left`, TEXT_X, y + 18, paid ? GOLD[5] : left <= 10 ? RED[5] : PARCHMENT[6], INK);
  // The torn pieces of the old map: one for every bounty paid, the rest still to find.
  const found = mapPieces(state);
  const x0 = Math.round((b.width - (CAMPAIGN_LENGTH * SCRAP.width + (CAMPAIGN_LENGTH - 1) * SCRAP.gap)) / 2);
  for (let k = 0; k < CAMPAIGN_LENGTH; k++) scrap(b, x0 + k * (SCRAP.width + SCRAP.gap), SCRAP.y, k, k < found);
}

/** A word stamped in red ink across a face, in a red box, as on the poster once the bounty is paid. */
function stamp(b: Bitmap, word: string, cx: number, y: number) {
  const mask = textMask(word, 13, 2);
  const [w, h] = [mask.width + 6, mask.height + 2];
  const x0 = Math.round(cx - w / 2);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const edge = i < 2 || j < 2 || i >= w - 2 || j >= h - 2;
      // Stamped ink takes unevenly: a pixel of the edge missing here and there.
      if (edge && hash(i, j, 65) > 0.15) b.set(x0 + i, y + j, RED[3]);
      else if (!edge && mask.solid(i - 3, j - 1) && hash(i, j, 66) > 0.1) b.set(x0 + i, y + j, RED[4]);
    }
  }
}

/** A torn scrap of the old map, with a stretch of red-inked road on it; or, not found yet, its outline in faint gold. */
function scrap(b: Bitmap, x: number, y: number, k: number, found: boolean) {
  const { width: w, height: h } = SCRAP;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      // Torn edges: a ragged pixel off here and there along each side.
      const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1;
      if (edge && hash(i + k * 17, j, 63) < 0.35) continue;
      if (!found) {
        if (edge && (i + j) % 2 === 0) b.set(x + i, y + j, GOLD[3]);
        continue;
      }
      const road = Math.abs(j - (h / 2 + Math.sin((i + k * 5) / 3) * 3)) < 0.8;
      b.set(x + i, y + j, road && i % 3 !== 0 ? RED[3] : edge ? PARCHMENT[2] : shade(PARCHMENT, 0.7 + (hash(i, j + k * 9, 64) - 0.5) * 0.2, i, j));
    }
  }
  if (found && k === CAMPAIGN_LENGTH - 1) for (const [dx, dy] of [[5, 4], [6, 5], [7, 6], [8, 7], [9, 8], [9, 4], [8, 5], [6, 7], [5, 8]]) b.set(x + dx, y + dy, RED[2]);
  if (!found) for (let i = 4; i < w - 3; i += 4) b.set(x + i, y + h / 2, STONE[3]);
}
