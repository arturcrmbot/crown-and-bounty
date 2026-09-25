import { ALDMOOR } from './content/aldmoor';
import { AdventureController } from './game/adventure';
import { Display } from './game/display';
import { Input } from './game/input';
import { loadGame, saveGame } from './game/save';
import { SCREEN } from './render/frame';
import { paletteWords } from './render/palette';
import { roman, type Card } from './rules/game';
import { buildMap } from './rules/map/model';
import { newGame } from './rules/scenario';

declare global {
  interface Window {
    /** Set once the first frame is on screen. Used by the scripts in `scripts/`. */
    __ready?: boolean;
    __kc?: ReturnType<AdventureController['debug']>;
  }
}

/** HoMM2 advanced its palette cycles about eight times a second. */
const TICK_MS = 120;

// ?fresh=1 ignores the save, ?freeze=1 also stops the clock for exact screenshots, ?speed=8 rides faster.
const query = new URLSearchParams(window.location.search);
const frozen = query.get('freeze') === '1';
const saved = frozen || query.get('fresh') === '1' ? null : loadGame();
const resume = saved && !saved.over ? saved : null;

const display = new Display(SCREEN.width, SCREEN.height);
const game = new AdventureController(display, buildMap(ALDMOOR), resume ?? newGame(), Math.max(1, Number(query.get('speed') ?? 1)));
const input = new Input(display, game.input);
if (query.has('x')) game.view.centreOn(Number(query.get('x')), Number(query.get('y') ?? 480));
window.__kc = game.debug();
window.addEventListener('pagehide', () => saveGame(game.state));

const intro: Card = {
  title: 'The King\u2019s Commission',
  lines: [
    'Baron Grimsby owes the Crown three years of taxes and one goose. Bring him in.',
    'Click the map to ride, and click anything that looks interesting. Red marks on your route are for tomorrow.',
    'The hourglass (or **E**) ends the day. Every seventh day is payday.',
  ],
  choices: [{ label: 'Ride out', action: { type: 'close' } }],
};
const welcomeBack = (day: number): Card => ({
  title: 'Welcome back',
  lines: [`Day ${roman(day)} of your commission. Baron Grimsby is still at large.`],
  choices: [{ label: 'Ride on', action: { type: 'close' } }, { label: 'Start a new commission', action: { type: 'restart' } }],
});
game.showCard(resume ? welcomeBack(resume.day) : intro, null);

let last = performance.now();
requestAnimationFrame(function frame(now) {
  const dt = frozen ? 0 : Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt, input.held);
  const tick = frozen ? 0 : Math.floor(now / TICK_MS);
  display.present(game.view.compose(tick).data, paletteWords(tick));
  game.placeCard();
  window.__ready = true;
  requestAnimationFrame(frame);
});
