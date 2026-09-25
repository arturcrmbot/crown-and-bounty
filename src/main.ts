import { Game } from './game/game';
import { Display } from './game/display';
import { Input } from './game/input';
import { failedCard, welcomeBackCard } from './game/intro';
import { loadGame, saveGame, stopSaving } from './game/save';
import { SCREEN } from './render/frame';
import { paletteWords } from './render/palette';
import { beginCommission, commissionAt, hasNextCommission, newGame, startFight, type GameState } from './rules/game';

declare global {
  interface Window {
    /** Set once the first frame is on screen. Used by the scripts in `scripts/`. */
    __ready?: boolean;
    __kc?: ReturnType<Game['debug']>;
  }
}

/** HoMM2 advanced its palette cycles about eight times a second. */
const TICK_MS = 120;

// ?fresh=1 ignores the save, ?freeze=1 also stops the clock for exact screenshots, ?speed=8 rides faster.
const query = new URLSearchParams(window.location.search);
const frozen = query.get('freeze') === '1';
const saved = frozen || query.get('fresh') === '1' ? null : loadGame();
// Carry on with any save, unless its campaign is over: then a new one begins.
const resume = saved && !(saved.over === 'won' && !hasNextCommission(saved)) ? saved : null;
if (frozen) stopSaving();

/** Debug starts: ?commission=2 rides into the second province, ?court=1 opens the court after the first. */
function debugStart(): GameState {
  const first = newGame();
  const chapter = Number(query.get('commission') ?? 1) - 1;
  if (query.get('court') === '1') return { ...first, opening: undefined, over: 'won', bounty: 'paid' };
  const { hero, gold, leadership, army } = first;
  const base = chapter > 0 ? beginCommission(commissionAt(first.campaign, chapter).province, first.seed, { hero, gold, leadership, army }, chapter, [{ chapter: 0, days: 10, level: 1 }]) : first;
  // ?sceptre=1 (with ?commission=5): the last bounty is paid and the X is on the map.
  const x = commissionAt(first.campaign, chapter).province.sceptre;
  if (query.get('sceptre') === '1' && x) return { ...base, bounty: 'paid', locations: [...base.locations, { id: 'sceptre', kind: 'dig', name: 'X Marks the Spot', at: x, done: false }] };
  // ?battle=patrol opens straight onto a fight, for checking the battle screen.
  const fightAt = query.get('battle');
  return fightAt ? startFight({ ...base, opening: undefined }, fightAt).state : base;
}

// ?reveal=1 lifts the fog, for looking the whole map over.
const start = resume ?? (query.has('reveal') ? { ...debugStart(), explored: debugStart().explored.map(() => -1) } : debugStart());
const display = new Display(SCREEN.width, SCREEN.height);
const game = new Game(display, start, Math.max(1, Number(query.get('speed') ?? 1)));
const input = new Input(display, game.input);
if (query.has('x')) game.adventure.view.centreOn(Number(query.get('x')), Number(query.get('y') ?? 480));
const dig = start.locations.find((l) => l.kind === 'dig');
if (query.get('sceptre') === '1' && dig) game.adventure.view.centreOn(dig.at[0], dig.at[1]);
window.__kc = game.debug();
window.addEventListener('pagehide', () => saveGame(game.state));

if (!game.battle && !game.court && resume && !resume.opening) game.adventure.showCard(resume.over === 'lost' ? failedCard(resume) : welcomeBackCard(resume), null);

let last = performance.now();
requestAnimationFrame(function frame(now) {
  const dt = frozen ? 0 : Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt, input.held);
  const tick = frozen ? 0 : Math.floor(now / TICK_MS);
  display.present(game.frame(tick), paletteWords(tick));
  game.placeCards();
  window.__ready = true;
  requestAnimationFrame(frame);
});
