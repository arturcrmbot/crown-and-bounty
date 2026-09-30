import { commissionOf, heroStats, roman, type GameState, type TroopId } from '../rules/game';
import type { BarItem } from '../rules/heroSheet';
import { Bitmap, blit } from './bitmap';
import { BAR, paintBarBackground } from './frame';
import { BLUE, GOLD, INK, NEUTRAL, PARCHMENT, RED, STONE, WOOD } from './palette';
import { drawText, lettered, textMask } from './text';

function icon(rows: string[], colours: Record<string, number>): Bitmap {
  const sprite = new Bitmap(rows[0].length, rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, x) => colours[ch] && sprite.set(x, y, colours[ch])));
  return sprite;
}

const COIN = icon(
  ['..oooo..', '.oyyYYo.', 'oyyyyYYo', 'oyddyyYo', 'oydyyyyo', 'oyyyyydo', '.oyyddo.', '..oooo..'],
  { o: INK, y: GOLD[4], Y: GOLD[6], d: GOLD[2] },
);
const SWORD = icon(
  ['.......ss', '......sWs', '.....sWs.', '....sWs..', '.g.sWs...', '..gWs....', '..bg.....', '.b..g....', 'o........'],
  { s: INK, W: STONE[6], g: GOLD[4], b: WOOD[3], o: GOLD[5] },
);
const BOW = icon(
  ['..bb.....', '.b..w....', 'b....w...', 'b..aaaaaT', 'b....w...', '.b..w....', '..bb.....'],
  { b: WOOD[4], w: NEUTRAL[6], a: WOOD[2], T: STONE[6] },
);
const FORK = icon(
  ['.t.t.t.', '.t.t.t.', '.ttttt.', '...h...', '...h...', '...h...', '...h...', '...h...'],
  { t: STONE[5], h: WOOD[3] },
);
const HORSESHOE = icon(
  ['.oooooo.', 'oiiooiio', 'oio..oio', 'oio..oio', 'oio..oio', 'oo....oo'],
  { o: INK, i: STONE[6] },
);
/** A mana crystal, lit from the top left. */
const CRYSTAL = icon(
  ['...o...', '..oWo..', '.oWBbo.', 'oWBBbdo', 'oBBbbdo', 'oBbbddo', '.obbdo.', '..odo..', '...o...'],
  { o: INK, W: BLUE[6], B: BLUE[5], b: BLUE[4], d: BLUE[2] },
);
const TROOP_ICONS: Record<TroopId, Bitmap> = {
  knights: SWORD,
  swordsmen: SWORD,
  baron: SWORD,
  archers: BOW,
  crossbowmen: BOW,
  peasants: FORK,
  wolves: FORK,
  goblins: FORK,
  trolls: SWORD,
  witch: BOW,
  bramble: BOW,
  poachers: BOW,
  bandits: SWORD,
  boars: FORK,
  bears: FORK,
  huntsmen: BOW,
  rook: BOW,
  // Aldric is never in the army, but should he ever show there.
  heroKnight: SWORD,
  heroWizard: BOW,
  heroRanger: BOW,
  heroCourtier: SWORD,
};

/** The hourglass: click it (or press E) to end the day. It brightens under the pointer. */
const GLASS = ['WWWWWWWWW', 'wwwwwwwww', '.g.....g.', '.gyyyyyg.', '..gyyyg..', '...gyg...', '....g....', '...g.g...', '..g...g..', '.g..y..g.', '.gyyyyyg.', 'wwwwwwwww', 'WWWWWWWWW'];
export const HOURGLASS = icon(GLASS, { W: WOOD[5], w: WOOD[3], g: STONE[5], y: GOLD[4] });
const HOURGLASS_LIT = icon(GLASS, { W: GOLD[6], w: GOLD[4], g: NEUTRAL[7], y: GOLD[6] });
export const HOURGLASS_AT = { x: BAR.x + BAR.width - 20, y: BAR.y + 7 };

/** The journal, open at its pages, with a red ribbon: click it (or press J) to read it. It brightens under the pointer too. */
const BOOK = [
  '..ooo.....ooo..',
  '.oPPPoo.ooPPPo.',
  'oPPlllPoPlllPPo',
  'oPPPPPPoPPPPPPo',
  'oPlllPPoPPlllPo',
  'oPPPPPPoPPPPPPo',
  'oPlllPPoPPlllPo',
  'oPPPPPPoPPPPPPo',
  'oBBBBBBoBBBBBBo',
  '.ooooooRoooooo.',
  '.......R.......',
];
export const JOURNAL = icon(BOOK, { o: INK, P: PARCHMENT[6], l: PARCHMENT[1], B: WOOD[4], R: RED[4] });
const JOURNAL_LIT = icon(BOOK, { o: INK, P: NEUTRAL[7], l: PARCHMENT[2], B: GOLD[5], R: RED[5] });
const JOURNAL_AT = { x: HOURGLASS_AT.x - 30, y: BAR.y + 8 };

/** Where the map bar's dividers sit, from its left edge: the army, the bounty, then the day's numbers and the buttons. */
export const HUD_DIVIDERS = [425, 645];
/** How far apart the army's stacks stand on the bar. */
const STACK_STEP = 60;

/** One thing on the bar, and the stretch of it (screen pixels) that answers the pointer. */
export type HudHit = { item: BarItem; x0: number; x1: number };

/** Which things on the bar a click does something with. */
export const clickable = (item: BarItem) => item.kind === 'hourglass' || item.kind === 'journal' || item.kind === 'stack' || item.kind === 'mana' || item.kind === 'bounty';
const same = (a: BarItem, b: BarItem) => a.kind === b.kind && (a.kind !== 'stack' || (b.kind === 'stack' && a.index === b.index));
/** The buttons, which light up under the pointer rather than being underlined. */
const button = (item: BarItem) => item.kind === 'hourglass' || item.kind === 'journal';

/**
 * Repaints the bottom bar from the game state: gold, army, bounty, movement, mana and the day, then
 * the journal and the hourglass. Everything keeps its own column, so nothing shifts as the numbers
 * change. What a click would work (`hover`) is underlined in gold, or lit. Returns where each thing
 * sits, for hover labels and clicks.
 */
export function paintHud(frame: Bitmap, state: GameState, hover: BarItem | null = null): HudHit[] {
  paintBarBackground(frame, HUD_DIVIDERS);
  const hits: HudHit[] = [];
  const size = lettered(13);
  const text = BAR.y + 5 - Math.floor((size - 13) / 2);
  const mid = BAR.y + BAR.height / 2;
  /** Draws an icon and its number in a column `width` wide from `x`. */
  const item = (what: BarItem, x: number, width: number, sprite: Bitmap | null, label: string, color = PARCHMENT[6]) => {
    let at = x;
    if (sprite) {
      blit(frame, sprite, at, Math.round(mid - sprite.height / 2));
      at += sprite.width + 5;
    }
    at += drawText(frame, label, at, text, color, INK, size);
    hits.push({ item: what, x0: x - 5, x1: Math.max(at, x + width - 12) + 5 });
  };
  const left = BAR.x + 14;
  item({ kind: 'gold' }, left, 76, COIN, state.gold.toLocaleString('en-GB'), GOLD[6]);
  state.army.forEach((stack, index) => item({ kind: 'stack', index }, left + 76 + index * STACK_STEP, STACK_STEP, TROOP_ICONS[stack.troop], String(stack.count)));
  // The villain's name, without "Bounty:" when a long one needs the room.
  const villain = commissionOf(state).villain.toUpperCase();
  const room = HUD_DIVIDERS[1] - HUD_DIVIDERS[0] - 28;
  const bounty = state.bounty === 'paid' ? 'BOUNTY PAID' : textMask(`BOUNTY:  ${villain}`, size).width <= room ? `BOUNTY:  ${villain}` : villain;
  item({ kind: 'bounty' }, BAR.x + HUD_DIVIDERS[0] + 16, 0, null, bounty, state.bounty === 'paid' ? GOLD[6] : GOLD[5]);
  const right = BAR.x + HUD_DIVIDERS[1] + 14;
  item({ kind: 'movement' }, right, 50, HORSESHOE, String(Math.floor(state.movement)), state.movement < 2 ? RED[5] : PARCHMENT[6]);
  item({ kind: 'mana' }, right + 50, 62, CRYSTAL, `${state.hero.mana}/${heroStats(state).maxMana}`, state.hero.mana > 0 ? BLUE[6] : STONE[5]);
  item({ kind: 'day' }, right + 112, 0, null, `DAY  ${roman(state.day)}`);
  const lit = (kind: BarItem['kind']) => hover?.kind === kind;
  blit(frame, lit('journal') ? JOURNAL_LIT : JOURNAL, JOURNAL_AT.x, JOURNAL_AT.y);
  hits.push({ item: { kind: 'journal' }, x0: JOURNAL_AT.x - 6, x1: JOURNAL_AT.x + JOURNAL.width + 4 });
  blit(frame, lit('hourglass') ? HOURGLASS_LIT : HOURGLASS, HOURGLASS_AT.x, HOURGLASS_AT.y);
  hits.push({ item: { kind: 'hourglass' }, x0: HOURGLASS_AT.x - 5, x1: HOURGLASS_AT.x + HOURGLASS.width + 6 });
  const under = hover && clickable(hover) && !button(hover) ? hits.find((h) => same(h.item, hover)) : null;
  if (under) for (let x = under.x0 + 5; x < under.x1 - 5; x++) frame.set(x, BAR.y + BAR.height - 5, GOLD[4]);
  return hits;
}
