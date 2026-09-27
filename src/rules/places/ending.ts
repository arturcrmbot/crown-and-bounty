import { BACKGROUNDS } from '../../content/backgrounds';
import { campaignLines } from '../campaign';
import { again, close, show, update, type GameState, type Location, type Result } from '../state';
import { option, ride, say, words } from './common';
import type { PlaceKind } from './kind';

/** Digs up the lost sceptre: the end of the campaign. */
function dig(state: GameState, place: Location): Result | null {
  if (place.done || state.over) return null;
  const next: GameState = { ...update(state, place.id, { done: true }), over: 'won' };
  const hero = BACKGROUNDS[state.hero.background].short;
  return {
    state: next,
    events: [
      { type: 'over', result: 'won' },
      show(
        {
          title: 'The Sceptre of Order!',
          lines: [
            'Three feet down, the shovel rings on iron. Inside the box, wrapped for some reason in a goose-feather quilt: the Sceptre of Order, lost since the old King\u2019s day.',
            `King Osric weeps openly. *"Five commissions, and the Sceptre besides! ${hero}, you shall have a castle of your own."*`,
            ...campaignLines(next),
          ],
          choices: [again],
          wide: true,
        },
        place.at,
        place.id,
      ),
    ],
  };
}

/** The X on the map, once all its pieces are found. */
export const x: PlaceKind = {
  about: (_, place) => ({ title: place.name, lines: words(place, 'about'), choices: [ride(place, 'Ride there'), close] }),
  arrive: (state, place) => say(state, place, { title: place.name, lines: ['Five torn pieces of map, and one very large X.', 'Your men look at the shovel, then at you.'], choices: [option(place, 'Dig here', 'dig'), close] }),
  choose: (state, place, choice) => (choice === 'dig' ? dig(state, place) : null),
  worth: () => 100000,
  bot: (state, place) => dig(state, place)?.state ?? state,
};
