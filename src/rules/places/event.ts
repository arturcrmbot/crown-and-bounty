import { bestChoice, firstPage, pageCard, takeChoice } from '../effects';
import { close } from '../state';
import { found, note, ride, words } from './common';
import type { PlaceKind } from './kind';

/**
 * A place that is all content: a shrine, a hermit, a quest giver. Its `pages` say everything; the
 * first page whose `when` holds is the one a visit shows, so flags move its story along.
 */
export const event: PlaceKind = {
  about: (_, place) => ({ title: place.name, lines: words(place, 'about'), choices: [ride(place, 'Visit'), close] }),
  arrive(state, place) {
    const page = firstPage(state, place);
    return found(state, place, page ? pageCard(state, place, page) : note(place, words(place, 'done')));
  },
  worth: (state, place) => bestChoice(state, place)?.worth ?? null,
  bot(state, place) {
    const best = bestChoice(state, place);
    return best ? (takeChoice(state, place, best.choice)?.state ?? state) : state;
  },
};
