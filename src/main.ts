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

// Every new campaign gets its own seed, so its later provinces are its own. ?seed=N (or ?freeze=1) fixes it.
const seed = query.has('seed') ? Number(query.get('seed')) : frozen ? 1066 : crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;

/** Debug starts: ?commission=2 rides into the second province, ?court=1 opens the court after the first. */
function debugStart(): GameState {
  const first = newGame(seed);
  const court = Number(query.get('court') ?? 0);
  const chapter = court > 0 ? court - 1 : Number(query.get('commission') ?? 1) - 1;
  const { hero, gold, leadership, army } = first;
  const record = Array.from({ length: chapter }, (_, i) => ({ chapter: i, days: 10, level: 1 }));
  const base = chapter > 0 ? beginCommission(commissionAt(first.campaign, chapter).province, first.seed, { hero, gold, leadership, army }, chapter, record, first.seed) : first;
  if (court > 0) return { ...base, opening: undefined, over: 'won', bounty: 'paid' };
  // ?sceptre=1 (with ?commission=5): the last bounty is paid and the X is on the map.
  const x = commissionAt(first.campaign, chapter).province.sceptre;
  if (query.get('sceptre') === '1' && x) return { ...base, bounty: 'paid', locations: [...base.locations, { id: 'sceptre', kind: 'dig', name: 'X Marks the Spot', at: x, done: false }] };
  // ?battle=patrol opens straight onto a fight, for checking the battle screen.
  const fightAt = query.get('battle');
  return fightAt ? (startFight({ ...base, opening: undefined }, fightAt)?.state ?? base) : base;
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
