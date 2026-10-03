import { BACKGROUNDS, type BackgroundId } from './content/backgrounds';
import { SPELLS, type SpellId } from './content/spells';
import { TROOPS, type TroopId } from './content/troops';
import { setLanguage } from './i18n';
import { Game } from './game/game';
import { Display } from './game/display';
import { Input } from './game/input';
import { botRideCard, chapterStartCard, failedCard, welcomeBackCard } from './game/intro';
import { loadGame, saveGame, stopSaving } from './game/save';
import { startCounter } from './game/counter';
import { SCREEN } from './render/frame';
import { paletteWords } from './render/palette';
import { loadLettering, setLettering } from './render/text';
import { loadUnitArt } from './render/wesnoth';
import { toggleMute, wakeAudio } from './audio/context';
import { MuteButton } from './ui/mute';
import { MixPanel } from './ui/mix';
import { Rail } from './ui/rail';
import { setUiRoom, setUiScale } from './ui/scale';
import { touch, upright, whenTouchChanges } from './ui/touch';
import { turnCard } from './ui/turn';
import { ARTIFACTS, slotsForArtifact, type ArtifactId } from './content/artifacts';
import { beginCommission, commissionAt, equip, giveArtifact, hasNextCommission, newGame, startFight, update, CAMPAIGN_LENGTH, type GameState } from './rules/game';
import { playCampaignStarts } from './rules/bot';

/** "knights:20,archers:30" as an army, for the debug starts, and "sergeant:1:5" an enemy hero at level 5. */
const armyFrom = (text: string | null) =>
  (text ?? '')
    .split(',')
    .map((part) => part.split(':'))
    .filter(([troop, count]) => troop in TROOPS && Number(count) > 0)
    .map(([troop, count, level]) => ({ troop: troop as TroopId, count: Number(count), ...(Number(level) > 0 ? { level: Number(level) } : {}) }));

declare global {
  interface Window {
    /** Set once the first frame is on screen. Used by the scripts in `scripts/`. */
    __ready?: boolean;
    __kc?: ReturnType<Game['debug']>;
  }
}

/** HoMM2 advanced its palette cycles about eight times a second. */
const TICK_MS = 120;

// ?lang=pl uses Polish; ?fresh=1 ignores the save, ?freeze=1 also stops the clock, and ?speed=8 rides faster.
const query = new URLSearchParams(window.location.search);
const language = query.get('lang') === 'pl' ? 'pl' : 'en';
setLanguage(language);
document.documentElement.lang = language;
const chapterNumber = Number(query.get('chapter'));
const requestedChapter = Number.isInteger(chapterNumber) && chapterNumber >= 2 && chapterNumber <= CAMPAIGN_LENGTH ? chapterNumber : null;
const frozen = query.get('freeze') === '1';
const saved = frozen || query.get('fresh') === '1' ? null : loadGame();
// Carry on with any save, unless its campaign is over: then a new one begins.
const resume = saved && !(saved.over === 'won' && !hasNextCommission(saved)) ? saved : null;
if (frozen) stopSaving();

// Every new campaign gets its own seed, so its later provinces are its own. ?seed=N (or ?freeze=1) fixes it.
const seed = query.has('seed') ? Number(query.get('seed')) : frozen ? 1066 : crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
const who = query.get('hero');
const chosen = who && who in BACKGROUNDS ? (who as BackgroundId) : null;

/** Debug starts: ?commission=2 rides into the second province, ?court=1 opens the court after the first. */
function debugStart(): GameState {
  // ?hero=ranger (or knight, wizard, courtier) picks the background for a debug start, so the opening card doesn't ask.
  const drafted = newGame(seed, undefined, chosen ?? 'knight');
  // ?gear=swordOfAldmoor,oldBanner wears gear into the first free slot of its kind, then the pack.
  // Nobody is asked here, so gear with a drawback goes on too.
  const gear = (query.get('gear') ?? '').split(',').filter((id): id is ArtifactId => id in ARTIFACTS);
  const dress = (state: GameState, id: ArtifactId) => {
    const given = giveArtifact(state, id);
    const free = slotsForArtifact(ARTIFACTS[id].slot).some((slot) => !given.hero.gear[slot]);
    return free && given.hero.pack.includes(id) ? (equip(given, id)?.state ?? given) : given;
  };
  const picked = gear.reduce(dress, chosen ? { ...drafted, opening: undefined } : drafted);
  // ?spells=fireball,stoneskin teaches spells for a debug start.
  const taught = (query.get('spells') ?? '').split(',').filter((id): id is SpellId => id in SPELLS && !picked.hero.spells.includes(id as SpellId));
  const first = taught.length ? { ...picked, hero: { ...picked.hero, spells: [...picked.hero.spells, ...taught] } } : picked;
  const court = Number(query.get('court') ?? 0);
  const chapter = court > 0 ? court - 1 : Number(query.get('commission') ?? 1) - 1;
  const { hero, gold, leadership } = first;
  // ?army=knights:20,archers:30 sets the army for a debug start.
  const army = query.has('army') ? armyFrom(query.get('army')) : first.army;
  const record = Array.from({ length: chapter }, (_, i) => ({ chapter: i, days: 10, level: 1 }));
  const begun = chapter > 0 ? beginCommission(commissionAt(first.campaign, chapter).province, first.seed, { hero, gold, leadership, army }, chapter, record, first.seed) : { ...first, army };
  // ?flags=pike:false,dwarf:friend sets story flags, as if those things had happened (what the court remembers).
  const flags = (query.get('flags') ?? '').split(',').map((part) => part.split(':')).filter(([flag, value]) => flag && value !== undefined);
  const said = (value: string) => (value === 'true' ? true : value === 'false' ? false : Number.isFinite(Number(value)) ? Number(value) : value);
  const flagged = flags.length ? { ...begun, flags: { ...begun.flags, ...Object.fromEntries(flags.map(([flag, value]) => [flag, said(value)])) } } : begun;
  // ?movement=40 leaves that much of today's riding, for the evening's light; 0 is nightfall.
  const moved = query.has('movement') ? { ...flagged, movement: Math.max(0, Number(query.get('movement'))) } : flagged;
  // ?feast=1 (#191): the eve of payday, so the day ends at once into the payday feast.
  const base = query.get('feast') === '1' ? { ...moved, day: 7, opening: undefined } : moved;
  if (court > 0) return { ...base, opening: undefined, over: 'won', bounty: 'paid' };
  // ?sceptre=1 (with ?commission=5): the last bounty is paid and the X is on the map.
  const x = commissionAt(first.campaign, chapter).province.sceptre;
  if (query.get('sceptre') === '1' && x) return { ...base, bounty: 'paid', locations: [...base.locations, { id: 'sceptre', kind: 'dig', name: 'X Marks the Spot', at: x, done: false }] };
  // ?battle=patrol opens straight onto a fight, for checking the battle screen; &enemy=pikemen:30,spiders:10 sets who it's
  // against, and &enemy=swordsmen:30,sergeant:1:5 puts a level-V sergeant at their head.
  const fightAt = query.get('battle');
  const foe = fightAt && query.has('enemy') ? base.locations.find((l) => l.id === fightAt)?.enemy : undefined;
  const staged = fightAt && foe ? update(base, fightAt, { enemy: { ...foe, army: armyFrom(query.get('enemy')) } }) : base;
  return fightAt ? (startFight({ ...staged, opening: undefined }, fightAt)?.state ?? staged) : staged;
}

// The troops are Battle for Wesnoth's units: their images load while the title shows, and a
// debug start (straight onto the map or into a fight) waits for them.
const unitArt = loadUnitArt();
// The lettering comes with the game (#148), and nothing paints a word before it's here.
await loadLettering();
// By touch the picture shrinks to fit a phone, so the words on its bars and ribbon are drawn bigger (#155).
const letter = () => setLettering(touch() ? 1.3 : 1);
letter();
whenTouchChanges(letter);
const display = new Display(SCREEN.width, SCREEN.height);
// Screens change with a transition, except when frozen (so screenshots catch them settled); ?transitions=1 keeps them.
const game = new Game(display, Math.max(1, Number(query.get('speed') ?? 1)), !frozen || query.get('transitions') === '1');
const input = new Input(display, game.input);
// The title and the King's welcome come first, unless a debug start (or a frozen screenshot) wants straight in.
// ?quick=1 skips them too; ?title=1 brings them back even when frozen.
const quick = (frozen && query.get('title') !== '1') || ['quick', 'battle', 'chapter', 'court', 'commission', 'sceptre', 'reveal', 'x', 'hero', 'spells', 'army', 'gear', 'flags', 'movement', 'feast'].some((k) => query.has(k));
if (quick) {
  if (requestedChapter !== null) {
    game.showTitle(null, () => newGame(seed));
    game.showProgress(botRideCard(0, requestedChapter));
    void (async () => {
      await unitArt;
      const journey = playCampaignStarts(newGame(seed, undefined, chosen ?? 'knight'));
      let step = journey.next();
      while (!step.done) {
        const start = step.value;
        if (start.campaign.chapter === requestedChapter - 1) {
          game.resume(start);
          game.adventure.showCard(chapterStartCard(start), null);
          return;
        }
        game.showProgress(botRideCard(start.campaign.chapter, requestedChapter));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        step = journey.next();
      }
      const last = step.value.at(-1);
      game.showProgress({
        title: 'The bot is stuck',
        lines: [last ? `He could not win Commission ${last.state.campaign.chapter + 1} twice, so he cannot ride ahead to Commission ${requestedChapter}. Try another seed.` : `He could not ride ahead to Commission ${requestedChapter}. Try another seed.`],
        choices: [],
        wide: true,
      });
    })();
  } else {
    await unitArt;
    // ?reveal=1 lifts the fog, for looking the whole map over.
    const start = resume ?? (query.has('reveal') ? { ...debugStart(), explored: debugStart().explored.map(() => -1) } : debugStart());
    game.resume(start);
    if (query.has('x')) game.adventure.view.centreOn(Number(query.get('x')), Number(query.get('y') ?? 480));
    const dig = start.locations.find((l) => l.kind === 'dig');
    if (query.get('sceptre') === '1' && dig) game.adventure.view.centreOn(dig.at[0], dig.at[1]);
    if (query.get('feast') === '1' && !resume && game.top.name === 'adventure') game.adventure.choose({ type: 'endDay' });
    if (game.top.name === 'adventure' && resume && !resume.opening) game.adventure.showCard(resume.over === 'lost' ? failedCard(resume) : welcomeBackCard(resume), null);
  }
} else game.showTitle(resume, () => newGame(seed));
window.__kc = game.debug();
// Sound may only start once the player has done something. Listen as the event comes in, before
// anything (a card, the sound button) can stop it on the way. M, or the button, turns it off and on.
for (const type of ['pointerdown', 'pointerup', 'keydown', 'touchend'] as const) window.addEventListener(type, wakeAudio, { capture: true });
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'm') toggleMute();
});
const mute = new MuteButton();
const mix = new MixPanel();
// Played by touch: buttons down the sides for what keys do, and a card asking for the phone sideways.
const rail = new Rail((button) => game.pressButton(button));
turnCard();
window.addEventListener('pagehide', () => {
  const state = game.saveable;
  if (state) saveGame(state);
});

let last = performance.now();
requestAnimationFrame(function frame(now) {
  // The first frame can be stamped a moment before the page started counting: never run the clock backwards.
  // Held upright, the game waits for the phone to be turned sideways.
  const dt = frozen || upright() ? 0 : Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  game.update(dt, input.held);
  const tick = frozen ? 0 : Math.floor(now / TICK_MS);
  display.present(game.frame(tick), paletteWords(tick));
  setUiScale(display.scale);
  // Played by touch on its side, cards keep between the rails; otherwise they have the whole window.
  const picture = display.canvas.getBoundingClientRect();
  if (touch() && !upright()) setUiRoom(picture.left, picture.right);
  else setUiRoom(0, window.innerWidth);
  game.placeCards();
  mute.place(display);
  mix.place(display);
  rail.place(display, touch() && !upright() ? game.buttons() : null);
  if (!window.__ready) document.getElementById('kc-loading')?.remove();
  window.__ready = true;
  requestAnimationFrame(frame);
});
// The visitor counter (#157) loads after the first frame, so it never slows the first paint. Without a site code it never loads.
startCounter();
