import { choiceButton } from '../effects';
import { fight, startFight, winChance } from '../fight';
import type { Choice, GameState, Location } from '../state';
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
      if (choice === 'fight') return startFight(state, place.id);
      if (choice === 'auto') return fight(state, place.id);
      return null;
    },
    worth(state, place) {
      if (place.done) return null;
      const odds = winChance(state, place.id, 6);
      if (kind === 'patrol') return odds >= 0.99 ? place.enemy!.reward + 200 : null;
      return odds >= 0.99 || (state.day > 60 && odds >= 0.6) ? 5000 : null;
    },
  };
}
