import { choiceButton } from '../effects';
import { fight, startFight, winChance } from '../fight';
import { armyLine, type Choice, type GameState, type Location } from '../state';
import { forceLine, note, option, ride, say, words } from './common';
import type { PlaceKind } from './kind';

const retreat: Choice = { label: 'Retreat', action: { type: 'close' } };

/** The other ways past them, as buttons: greyed out, with what they need, when the hero can't take them. */
const parleys = (state: GameState, place: Location) => (place.enemy?.parleys ?? []).map((p) => choiceButton(state, place, p, `parley/${p.id}`));

/** What the sergeants think of the odds, in words. */
function hint(chance: number): string {
  if (chance >= 0.9) return 'They look nervous.';
  if (chance >= 0.55) return 'It will be close.';
  return 'Your army looks at you. Then at them. Then at you.';
}

/** An enemy on the map: fight it, let the sergeants fight it, or take one of its parleys. */
export function enemy(kind: 'patrol' | 'hideout'): PlaceKind {
  return {
    about: (_, place) => ({ title: place.name, lines: [...place.enemy!.lines, `About ${forceLine(place.enemy!.army)}.`], choices: [ride(place, 'Approach'), { label: 'Close', action: { type: 'close' } }] }),
    arrive(state, place) {
      const foe = place.enemy!;
      if (place.done) return say(state, place, note(place, words(place, 'done')));
      if (state.army.length === 0) return say(state, place, { title: place.name, lines: [foe.threat, 'You have no troops to fight with. Recruit some first.'], choices: [...parleys(state, place), retreat] });
      return say(state, place, {
        title: place.name,
        lines: [foe.threat, hint(winChance(state, place.id))],
        choices: [option(place, foe.charge ?? 'Fight', 'fight'), option(place, 'Let the sergeants handle it', 'auto'), ...parleys(state, place), retreat],
      });
    },
    choose(state, place, choice) {
      const calm: GameState = state.ambush === place.id ? { ...state, ambush: undefined } : state;
      if (choice === 'fight') return startFight(calm, place.id);
      if (choice === 'auto') return fight(calm, place.id);
      if (choice === 'flee' && state.ambush === place.id) {
        const army = state.army.map((s) => ({ ...s, count: s.count - Math.ceil(s.count * 0.2) })).filter((s) => s.count > 0);
        return say({ ...calm, army }, place, note(place, ['You leave the camp fires burning and ride hard. Not everyone keeps up.', `*${armyLine(army)} are left.*`]));
      }
      return null;
    },
    worth(state, place) {
      if (place.done) return null;
      const odds = winChance(state, place.id, 6);
      if (kind === 'patrol') return odds >= 0.9 ? place.enemy!.reward + 200 : null;
      return odds >= 0.85 || (state.day > 40 && odds >= 0.6) ? 5000 : null;
    },
  };
}
