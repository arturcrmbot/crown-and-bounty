import { firstPage, meets, pageCard, takeChoice } from '../effects';
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
  worth: (state, place) => (firstPage(state, place)?.choices.some((c) => c.effects && meets(state, c.needs)) ? 150 : null),
  bot(state, place) {
    const choice = firstPage(state, place)?.choices.find((c) => c.effects && meets(state, c.needs));
    return choice ? (takeChoice(state, place, choice)?.state ?? state) : state;
  },
};
