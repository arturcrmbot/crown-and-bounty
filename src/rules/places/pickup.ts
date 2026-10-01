import { applyEffects } from '../effects/core';
import { heroStats } from '../hero';
import type { Point } from '../map/geometry';
import { close, show, type GameEvent, type GameState, type Location, type Result } from '../state';
import { aboutWords, note, ride } from './common';
import type { PlaceKind } from './kind';

/**
 * Small things lying by the roads and tracks (#192): a purse, a sheaf of oats, a few crystals, a lost
 * letter. He takes them as he rides by, without stopping and without a card, as HoMM2's heroes take
 * its piles, and finding one is worth no experience of its own. What each gives is its `gives`,
 * applied as a content choice's effects are; the map makes the noise. Only a letter stops him, to be
 * read, as HoMM2's bottles do, and its words go in the journal.
 */

/** How near he has to ride to something lying by the way to take it: a tile, about his own height in the saddle. */
export const REACH = 32;

/** Takes one thing lying by the way: what it gives, and it's gone. A lost letter he stops to read (its `visit` words). */
function take(state: GameState, place: Location): Result {
  const taken = applyEffects(state, place, { ...place.gives, done: true });
  const events: GameEvent[] = [{ type: 'picked', id: place.id }, ...taken.events];
  const read = place.text?.visit;
  if (read) events.push(show(note(place, read), place.at));
  return { state: taken.state, events };
}

/** Whatever lies within reach of where he stands now, he takes in passing. */
export function pickUp(state: GameState, [x, y]: Point): Result {
  let next = state;
  const events: GameEvent[] = [];
  for (const place of state.locations) {
    if (place.kind !== 'pickup' || place.done || Math.hypot(place.at[0] - x, place.at[1] - y) > REACH) continue;
    const taken = take(next, place);
    next = taken.state;
    events.push(...taken.events);
  }
  return { state: next, events };
}

/** What the bot makes of one: its gold and movement, a little for mana he has room for, and its experience. */
function worthOf(state: GameState, place: Location): number {
  const g = place.gives ?? {};
  const room = Math.max(0, heroStats(state).maxMana - state.hero.mana);
  return (g.gold ?? 0) + (g.treasure ?? 0) + (g.movement ?? 0) + Math.min(g.mana ?? 0, room) * 4 + (g.xp ?? 0);
}

export const pickup: PlaceKind = {
  about: (state, place) => ({ title: place.name, lines: aboutWords(state, place), choices: [ride(place, 'Pick it up'), close] }),
  // Ridden up to, it's been taken on the way already, unless it lay where no way comes near enough.
  arrive: (state, place) => (place.done ? { state, events: [] } : take(state, place)),
  worth: (state, place) => (place.done ? null : worthOf(state, place)),
  bot: (state, place) => (place.done ? state : take(state, place).state),
};
