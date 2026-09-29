import { bestChoice, firstPage, pageCard, takeChoice } from '../effects';
import { look } from '../map/sight';
import { close, coins, update, type Card, type GameState, type Location, type Result } from '../state';
import { aboutWords, found, loot, note, ride, say, words } from './common';
import type { PlaceKind } from './kind';

/** The card for a one-off place: its words before, or once it's used up. */
const onceCard = (state: GameState, place: Location, verb: string): Card => (place.done ? note(place, words(place, 'done')) : { title: place.name, lines: aboutWords(state, place), choices: [ride(place, verb), close] });

/**
 * A sight written as content: the page that holds now offers its choices (the tower's banner or its
 * journal, the mine's cart or the dwarf's favour). Null when it has none, and the kind's own rules
 * apply, as they do for saves from before a place had pages.
 */
function offer(state: GameState, place: Location, before: string[] = []): Result | null {
  const page = firstPage(state, place);
  return page ? found(state, place, pageCard(state, place, page, before)) : null;
}

/** What the bot makes of a sight's choices: the best one it can take, as `worth` and as a visit. */
const choiceWorth = (state: GameState, place: Location) => bestChoice(state, place)?.worth ?? null;
function takeBest(state: GameState, place: Location): GameState {
  const best = place.done && place.kind !== 'mill' ? null : bestChoice(state, place);
  return best ? (takeChoice(state, place, best.choice)?.state ?? state) : state;
}

/** A lookout: a clue, and a view of somewhere far off (the tower's journal points at the hideout). */
export const tower: PlaceKind = {
  about: (state, place) => onceCard(state, place, 'Enter'),
  arrive(state, place) {
    if (place.done) return say(state, place, onceCard(state, place, 'Enter'));
    const content = offer(state, place);
    if (content) return content;
    const next = update(state, place.id, { done: true });
    const card = note(place, words(place, 'visit'));
    if (!place.reveals) return found(next, place, card);
    const [rx, ry] = place.reveals;
    const seen = look(next, [rx, ry], 90).state;
    return found(seen, place, card, { type: 'reveal', at: place.reveals, radius: 90 });
  },
  worth: (state, place) => (place.done ? null : place.pages ? choiceWorth(state, place) : 400),
  bot: takeBest,
};

/** A stash to find once: the mine's forgotten ore cart, the peat cutters' wages. */
export const mine: PlaceKind = {
  about: (state, place) => onceCard(state, place, 'Enter'),
  arrive(state, place) {
    if (place.done) return say(state, place, onceCard(state, place, 'Enter'));
    const content = offer(state, place);
    if (content) return content;
    const gold = loot(state, place.gold ?? 0);
    return found(update({ ...state, gold: state.gold + gold }, place.id, { done: true }), place, note(place, words(place, 'visit').map((line) => line.replace('{gold}', coins(gold)))));
  },
  worth: (state, place) => (place.done ? null : place.pages ? choiceWorth(state, place) : (place.gold ?? 0)),
  bot: takeBest,
};

/** Flour for a longer day's march, once a week. */
const FLOUR = 40;

/** A mill: a good meal and a longer day's march, once a week, and on the first visit, the miller's offer. */
export const mill: PlaceKind = {
  about: (state, place) => onceCard(state, place, 'Visit'),
  arrive(state, place) {
    if (place.done) return offer(state, place, words(place, 'done')) ?? say(state, place, note(place, words(place, 'done')));
    const fed = update({ ...state, movement: state.movement + FLOUR }, place.id, { done: true });
    const lines = [...words(place, 'visit'), `**+${FLOUR} movement** today.`];
    return offer(fed, place, lines) ?? found(fed, place, note(place, lines));
  },
  payday: (place) => ({ ...place, done: false }),
  worth: (state, place) => {
    const flour = place.done ? 0 : 60;
    const best = place.pages ? (choiceWorth(state, place) ?? 0) : 0;
    return flour + best > 0 ? flour + best : null;
  },
  bot: takeBest,
};

/** A signpost: directions, and a little experience for finding it. */
export const signpost: PlaceKind = {
  about: (state, place) => note(place, aboutWords(state, place)),
  arrive: (state, place) => found(state, place, note(place, aboutWords(state, place))),
  worth: () => null,
};
