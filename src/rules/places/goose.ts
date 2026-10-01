import { close, type GameEvent, type GameState, type Location } from '../state';
import { aboutWords, found, note, ride, say, words } from './common';
import type { PlaceKind } from './kind';

/**
 * The lost geese (#192): the royal goose's cousins, wandered off across the province and tucked away
 * where a curious rider looks. Found, a goose goes home to the goose pond (the place that looks like
 * one), which shows her there, and the goose-girl counts them in. Once every one is home, the flag
 * `geese` is set, for the goose-girl's thanks and the King's word at court.
 */
export const lostGeese = (state: GameState): Location[] => state.locations.filter((l) => l.kind === 'goose');

/** How many of the lost geese he has sent home so far. */
export const geeseHome = (state: GameState): number => lostGeese(state).filter((l) => l.done).length;

export const goose: PlaceKind = {
  about: (state, place) => ({ title: place.name, lines: aboutWords(state, place), choices: [ride(place, 'Send her home'), close] }),
  arrive(state, place) {
    if (place.done) return say(state, place, note(place, ['There is nothing here now but a feather.']));
    let next: GameState = { ...state, locations: state.locations.map((l) => (l.id === place.id ? { ...l, done: true } : l)) };
    const home = geeseHome(next);
    const all = lostGeese(next).length;
    const every = home === all;
    if (every) next = { ...next, flags: { ...next.flags, geese: true } };
    const counted = every ? `That makes all ${all} of them home. The goose-girl at the pond will want to thank you.` : `That makes ${home} of the ${all} lost geese home.`;
    const pond = next.locations.find((l) => l.look === 'pond');
    const events: GameEvent[] = [{ type: 'removed', id: place.id }, ...(pond ? [{ type: 'changed', id: pond.id } as const] : [])];
    return found(next, place, note(place, [...words(place, 'visit'), counted]), ...events);
  },
  worth: (_, place) => (place.done ? null : 60),
  bot: (state, place) => goose.arrive(state, place).state,
};
