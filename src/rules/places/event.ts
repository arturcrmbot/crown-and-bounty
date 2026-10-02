import { bestChoice, firstPage, pageCard, takeChoice } from '../effects';
import { close, type GameState, type Location } from '../state';
import { aboutWords, found, note, ride, words } from './common';
import type { PlaceKind } from './kind';

/** The band still over a place, as `guardOf` in `places/index.ts` (which imports this module, so it can't be imported here). */
const guardOf = (state: GameState, place: Location) => (place.guard ? state.locations.find((l) => l.id === place.guard && !l.done) : undefined);

/**
 * A place that is all content: a shrine, a hermit, a quest giver. Its `pages` say everything; the
 * first page whose `when` holds is the one a visit shows, so flags move its story along.
 */
export const event: PlaceKind = {
  about: (state, place) => ({ title: place.name, lines: aboutWords(state, place), choices: [ride(place, 'Visit'), close] }),
  arrive(state, place) {
    const page = firstPage(state, place);
    return found(state, place, page ? pageCard(state, place, page) : note(place, words(place, 'done')));
  },
  // A place with its guard still over it (a scroll stone, #240) is worth nothing to the bot until the guard is gone.
  worth: (state, place) => (guardOf(state, place) ? null : (bestChoice(state, place)?.worth ?? null)),
  bot(state, place) {
    if (guardOf(state, place)) return state;
    const best = bestChoice(state, place);
    return best ? (takeChoice(state, place, best.choice)?.state ?? state) : state;
  },
};
