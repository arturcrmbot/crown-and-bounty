import { applyEffects } from '../effects/core';
import { heroStats } from '../hero';
import type { Point } from '../map/geometry';
import { close, show, type GameEvent, type GameState, type Location, type Result } from '../state';
import { aboutWords, ride } from './common';
import type { PlaceKind } from './kind';

/**
 * Small things lying by the roads and tracks (#192): a purse, a sheaf of oats, a few crystals, a lost
 * letter. He takes them as he rides by, without stopping and without a card, as HoMM2's heroes take
 * its piles, and finding one is worth no experience of its own. What each gives is its `gives`,
 * applied as a content choice's effects are; the map makes the noise. A lost letter's words (its
 * `visit`) go in the journal, and ridden to on purpose, he stops and reads it where it lay.
 */

/** How near he has to ride to something lying by the way to take it: a tile, about his own height in the saddle. */
export const REACH = 32;

/** Takes one thing lying by the way: what it gives, and it's gone. */
function take(state: GameState, place: Location): Result {
  const taken = applyEffects(state, place, { ...place.gives, done: true });
  return { state: taken.state, events: [{ type: 'picked', id: place.id }, ...taken.events] };
}

/** Whether taking it now would give him nothing: crystals, and nothing else, with his mana full already. They wait for him (#211). */
const wasted = (state: GameState, place: Location) => {
  const g = place.gives ?? {};
  return Boolean(g.mana) && Object.keys(g).every((k) => k === 'mana') && state.hero.mana >= heroStats(state).maxMana;
};

/** Whatever lies within reach of where he stands now, he takes in passing, unless it would do him no good yet. */
export function pickUp(state: GameState, [x, y]: Point): Result {
  let next = state;
  const events: GameEvent[] = [];
  for (const place of state.locations) {
    if (place.kind !== 'pickup' || place.done || Math.hypot(place.at[0] - x, place.at[1] - y) > REACH || wasted(next, place)) continue;
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

/** What his button says: a purse or a letter is "it", and crystals are "them". */
const pickUpLabel = (place: Location) => (/^(A|An) /.test(place.name) ? 'Pick it up' : 'Pick them up');

export const pickup: PlaceKind = {
  // With his mana full they wait for him, but he can still ride there, as to any spot on the map (#226).
  about: (state, place) =>
    wasted(state, place)
      ? { title: place.name, lines: [...aboutWords(state, place), '*Your mana is full already, so they can wait for another day.*'], choices: [ride(place, 'Ride there'), close] }
      : { title: place.name, lines: aboutWords(state, place), choices: [ride(place, pickUpLabel(place)), close] },
  // Ridden up to, it's been taken on the way already, unless it lay where no way comes near enough, or would do him no good yet.
  arrive: (state, place) => {
    if (place.done) return { state, events: [] };
    if (wasted(state, place)) return { state, events: [show({ title: place.name, lines: ['Your mana is full already, so you leave them where they are for another day.'], choices: [close] }, place.at, place.id)] };
    return take(state, place);
  },
  worth: (state, place) => (place.done ? null : worthOf(state, place)),
  bot: (state, place) => (place.done ? state : take(state, place).state),
};
