import { revealDisc } from '../map/fog';
import { close, coins, update, type Card, type GameState, type Location } from '../state';
import { found, loot, note, ride, say, words } from './common';
import type { PlaceKind } from './kind';

/** The card for a one-off place: its words before, or once it's used up. */
const onceCard = (place: Location, verb: string): Card => (place.done ? note(place, words(place, 'done')) : { title: place.name, lines: words(place, 'about'), choices: [ride(place, verb), close] });

/** A lookout: a clue, and a view of somewhere far off (the tower's journal points at the hideout). */
export const tower: PlaceKind = {
  about: (_, place) => onceCard(place, 'Enter'),
  arrive(state, place) {
    if (place.done) return say(state, place, onceCard(place, 'Enter'));
    const next = update(state, place.id, { done: true });
    const card = note(place, words(place, 'visit'));
    if (!place.reveals) return found(next, place, card);
    const [rx, ry] = place.reveals;
    const seen: GameState = { ...next, explored: revealDisc(next.explored, next.world, rx, ry, 90).bits };
    return found(seen, place, card, { type: 'reveal', at: place.reveals, radius: 90 });
  },
  worth: (_, place) => (place.done ? null : 400),
};

/** A stash to find once: the mine's forgotten ore cart, the peat cutters' wages. */
export const mine: PlaceKind = {
  about: (_, place) => onceCard(place, 'Enter'),
  arrive(state, place) {
    if (place.done) return say(state, place, onceCard(place, 'Enter'));
    const gold = loot(state, place.gold ?? 0);
    return found(update({ ...state, gold: state.gold + gold }, place.id, { done: true }), place, note(place, words(place, 'visit').map((line) => line.replace('{gold}', coins(gold)))));
  },
  worth: (_, place) => (place.done ? null : (place.gold ?? 0)),
};

/** A mill: a good meal and a longer day's march, once a week. */
export const mill: PlaceKind = {
  about: (_, place) => onceCard(place, 'Visit'),
  arrive(state, place) {
    if (place.done) return say(state, place, note(place, words(place, 'done')));
    return found(update({ ...state, movement: state.movement + 40 }, place.id, { done: true }), place, note(place, [...words(place, 'visit'), '**+40 movement** today.']));
  },
  payday: (place) => ({ ...place, done: false }),
  worth: (_, place) => (place.done ? null : 60),
};

/** A signpost: directions, and a little experience for finding it. */
export const signpost: PlaceKind = {
  about: (_, place) => note(place, words(place, 'about')),
  arrive: (state, place) => found(state, place, note(place, words(place, 'about'))),
  worth: () => null,
};
