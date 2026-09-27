import { heroStats } from '../hero';
import { close, coins, leadershipUsed, update, type GameState, type Location, type Result } from '../state';
import { loot, note, option, ride, say, words } from './common';
import type { PlaceKind } from './kind';

function openChest(state: GameState, place: Location, take: 'keep' | 'give'): Result | null {
  if (place.done) return null;
  const gold = loot(state, place.gold ?? 0);
  const opened = update(state, place.id, { done: true });
  const removed = { type: 'removed', id: place.id } as const;
  if (take === 'keep') return say({ ...opened, gold: state.gold + gold }, place, note(place, [`**+${coins(gold)} gold.** The villagers will never know.`]), removed);
  const leadership = Math.round(gold / 20);
  return say({ ...opened, leadership: state.leadership + leadership }, place, note(place, [`The villagers cheer. **+${leadership} leadership.**`, 'Somebody starts a song about you. It rhymes \u201cAldric\u201d with \u201cbald trick\u201d.']), removed);
}

/** A treasure chest: keep the gold, or hand it out for leadership. */
export const chest: PlaceKind = {
  about: (_, place) => ({ title: place.name, lines: words(place, 'about'), choices: [ride(place, 'Open'), close] }),
  arrive(state, place) {
    if (place.done) return say(state, place, note(place, ['Empty. You check twice anyway.']));
    const gold = loot(state, place.gold ?? 0);
    return say(state, place, {
      title: place.name,
      lines: [`You pry the lid off. Inside: **${coins(gold)} gold**.`, 'Keep it, or hand it out so the villagers sing your praises across the province?'],
      choices: [option(place, 'Keep the gold', 'keep'), option(place, `Hand it out (+${Math.round(gold / 20)} leadership)`, 'give')],
    });
  },
  choose: (state, place, choice) => (choice === 'keep' || choice === 'give' ? openChest(state, place, choice) : null),
  worth: (_, place) => (place.done ? null : 500),
  bot(state, place) {
    if (place.done) return state;
    const short = heroStats(state).leadership - leadershipUsed(state.army) < 40;
    return openChest(state, place, short ? 'give' : 'keep')?.state ?? state;
  },
};

/** A pile of gold by the road: picked up on arrival. */
export const pile: PlaceKind = {
  about: (_, place) => ({ title: place.name, lines: words(place, 'about'), choices: [ride(place, 'Take'), close] }),
  arrive(state, place) {
    if (place.done) return say(state, place, note(place, ['Nothing left but footprints.']));
    const gold = loot(state, place.gold ?? 0);
    return say(update({ ...state, gold: state.gold + gold }, place.id, { done: true }), place, note(place, [`You pocket **${coins(gold)} gold**.`]), { type: 'removed', id: place.id });
  },
  worth: (_, place) => (place.done ? null : (place.gold ?? 0)),
};
