import { TROOPS } from '../../content/troops';
import { applyEffects, choiceButton } from '../effects';
import { fight, startFight, winChance } from '../fight';
import { heroStats } from '../hero';
import { armyLine, close, coins, show, type Choice, type ContentChoice, type GameState, type Location, type Result } from '../state';
import { countsExactly, forceLine, note, option, ride, say, words } from './common';
import type { PlaceKind } from './kind';

const retreat: Choice = { label: 'Retreat', action: { type: 'close' } };

/** A parley as this hero would strike it: a courtier talks any bribe down. */
export function haggled(state: GameState, parley: ContentChoice): ContentChoice {
  const off = heroStats(state).bribes;
  const gold = parley.needs?.gold;
  return off && gold ? { ...parley, needs: { ...parley.needs, gold: Math.round((gold * (1 - off)) / 10) * 10 } } : parley;
}

/** The other ways past them, as buttons: greyed out, with what they need, when the hero can't take them. */
const parleys = (state: GameState, place: Location) => (place.enemy?.parleys ?? []).map((p) => choiceButton(state, place, haggled(state, p), `parley/${p.id}`));

/** What a band asks to change sides: only troops that draw wages will (no beasts, no villains), and only small fry. */
export function hirePrice(state: GameState, place: Location): number | null {
  const foe = place.enemy;
  if (!foe || place.done || !heroStats(state).hires || (foe.tier !== 'pest' && foe.tier !== 'band')) return null;
  if (foe.army.some((s) => !TROOPS[s.troop].wage)) return null;
  // Content with its own offer for this sort of hero knows better.
  if (foe.parleys?.some((p) => p.needs?.background === state.hero.background)) return null;
  return foe.army.reduce((sum, s) => sum + s.count * TROOPS[s.troop].wage * HIRE_PRICE, 0);
}
/** Gold per point of a troop's weekly wage, to buy him off his old employer. */
const HIRE_PRICE = 12;

function hire(state: GameState, place: Location): Result | null {
  const price = hirePrice(state, place);
  if (price === null || state.gold < price) return null;
  const done = applyEffects({ ...state, gold: state.gold - price }, place, { troops: place.enemy!.army, done: true });
  const lines = ['They count your gold twice, bite a coin, and fall in behind your banner.', `**\u2212${coins(price)} gold.**`, ...done.lines];
  return { state: done.state, events: [...done.events, show({ title: place.name, lines, choices: [close] }, place.at, place.id)] };
}

/** The courtier's offer, as a button: greyed out when his purse is too light. */
function hireButton(state: GameState, place: Location): Choice[] {
  const price = hirePrice(state, place);
  return price === null ? [] : [option(place, `Hire them (${coins(price)} gold)`, 'hire', state.gold < price)];
}

/** What the sergeants think of the odds, in words. */
function hint(chance: number): string {
  if (chance >= 0.9) return 'They look nervous.';
  if (chance >= 0.55) return 'It will be close.';
  return 'Your army looks at you. Then at them. Then at you.';
}

/** An enemy on the map: fight it, let the sergeants fight it, or take one of its parleys. */
export function enemy(kind: 'patrol' | 'hideout'): PlaceKind {
  return {
    about: (state, place) => {
      const exact = countsExactly(state);
      const force = forceLine(place.enemy!.army, exact);
      const line = exact ? `Your scouts count ${force}.` : `${force.replace(/^\*\*(.)/, (_, c: string) => `**${c.toUpperCase()}`)}.`;
      return { title: place.name, lines: [...place.enemy!.lines, line], choices: [ride(place, 'Approach'), { label: 'Close', action: { type: 'close' } }] };
    },
    arrive(state, place) {
      const foe = place.enemy!;
      if (place.done) return say(state, place, note(place, words(place, 'done')));
      if (state.army.length === 0) return say(state, place, { title: place.name, lines: [foe.threat, 'You have no troops to fight with. Recruit some first.'], choices: [...parleys(state, place), retreat] });
      return say(state, place, {
        title: place.name,
        lines: [foe.threat, hint(winChance(state, place.id))],
        choices: [option(place, foe.charge ?? 'Fight', 'fight'), option(place, 'Let the sergeants handle it', 'auto'), ...hireButton(state, place), ...parleys(state, place), retreat],
      });
    },
    choose(state, place, choice) {
      const calm: GameState = state.ambush === place.id ? { ...state, ambush: undefined } : state;
      if (choice === 'fight') return startFight(calm, place.id);
      if (choice === 'hire') return hire(calm, place);
      if (choice === 'auto') return fight(calm, place.id);
      if (choice === 'flee' && state.ambush === place.id) {
        const army = state.army.map((s) => ({ ...s, count: s.count - Math.ceil(s.count * 0.2) })).filter((s) => s.count > 0);
        return say({ ...calm, army }, place, note(place, ['You leave the camp fires burning and ride hard. Not everyone keeps up.', `*${armyLine(army)} are left.*`]));
      }
      return null;
    },
    worth(state, place) {
      if (place.done) return null;
      const odds = winChance(state, place.id, 8);
      if (kind === 'patrol') return odds >= 0.9 ? place.enemy!.reward + 200 : null;
      // A villain is worth a gamble once the days are running out.
      return odds >= 0.85 || (state.day > 30 && odds >= 0.5) || (state.day > 60 && odds >= 0.25) ? 5000 : null;
    },
  };
}
