import { ALDMOOR } from './content/aldmoor';
import { Game } from './game/game';
import { Display } from './game/display';
import { Input } from './game/input';
import { backgroundCard, welcomeBackCard } from './game/intro';
import { loadGame, saveGame, stopSaving } from './game/save';
import { SCREEN } from './render/frame';
import { paletteWords } from './render/palette';
import { startFight } from './rules/game';
import { buildMap } from './rules/map/model';
import { newGame } from './rules/scenario';

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
const resume = saved && !saved.over ? saved : null;
if (frozen) stopSaving();

// ?battle=patrol opens straight onto a fight, for checking the battle screen.
const fightAt = query.get('battle');
const start = resume ?? (fightAt ? startFight(newGame(), fightAt).state : newGame());

const display = new Display(SCREEN.width, SCREEN.height);
const game = new Game(display, buildMap(ALDMOOR), start, Math.max(1, Number(query.get('speed') ?? 1)));
const input = new Input(display, game.input);
if (query.has('x')) game.adventure.view.centreOn(Number(query.get('x')), Number(query.get('y') ?? 480));
window.__kc = game.debug();
window.addEventListener('pagehide', () => saveGame(game.adventure.state));

if (!game.battle) game.adventure.showCard(resume ? welcomeBackCard(resume.day) : backgroundCard(), null);

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
