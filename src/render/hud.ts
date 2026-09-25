import { roman, type GameState, type TroopId } from '../rules/game';
import { Bitmap, blit } from './bitmap';
import { BAR, BAR_DIVIDERS, paintBarBackground } from './frame';
import { GOLD, INK, NEUTRAL, PARCHMENT, RED, STONE, WOOD } from './palette';
import { drawText } from './text';

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
const TROOP_ICONS: Record<TroopId, Bitmap> = {
  knights: SWORD,
  swordsmen: SWORD,
  baron: SWORD,
  archers: BOW,
  crossbowmen: BOW,
  peasants: FORK,
  wolves: FORK,
};

/** The hourglass: click it (or press E) to end the day. */
export const HOURGLASS = icon(
  ['wwwwwww', '.oyyyo.', '..oyo..', '...o...', '..o.o..', '.oyyyo.', 'wwwwwww'],
  { w: WOOD[4], o: INK, y: GOLD[5] },
);
export const HOURGLASS_AT = { x: BAR.x + BAR.width - 22, y: BAR.y + 10 };

/** Repaints the bottom bar from the game state: gold, army, bounty, movement and the day. */
export function paintHud(frame: Bitmap, state: GameState) {
  paintBarBackground(frame);
  const text = BAR.y + 5;
  const mid = BAR.y + BAR.height / 2;
  let x = BAR.x + 14;
  const item = (sprite: Bitmap, label: string, color = PARCHMENT[6]) => {
    blit(frame, sprite, x, Math.round(mid - sprite.height / 2));
    x += sprite.width + 6;
    x += drawText(frame, label, x, text, color, INK) + 26;
  };
  item(COIN, state.gold.toLocaleString('en-GB'), GOLD[6]);
  for (const stack of state.army) item(TROOP_ICONS[stack.troop], String(stack.count));
  const bounty = state.bounty === 'paid' ? 'BOUNTY PAID' : 'BOUNTY:  BARON GRIMSBY';
  drawText(frame, bounty, BAR.x + BAR_DIVIDERS[0] + 16, text, state.bounty === 'paid' ? GOLD[6] : GOLD[5], INK);
  x = BAR.x + BAR_DIVIDERS[1] + 14;
  blit(frame, HORSESHOE, x, Math.round(mid - 3));
  drawText(frame, String(Math.floor(state.movement)), x + 12, text, state.movement >= 2 ? PARCHMENT[6] : RED[5], INK);
  drawText(frame, `DAY  ${roman(state.day)}`, x + 54, text, PARCHMENT[6], INK);
  blit(frame, HOURGLASS, HOURGLASS_AT.x, HOURGLASS_AT.y);
}

