import { artifactPhrase } from '../../content/artifacts';
import { bestChoice, firstPage, pageCard, takeChoice } from '../effects';
import { artifactChoices, foundNote, giveArtifact, heroStats } from '../hero';
import { close, coins, leadershipUsed, update, type Choice, type GameState, type Location, type Result } from '../state';
import { aboutWords, loot, note, option, ride, say, words } from './common';
import type { PlaceKind } from './kind';

/** Whether a band still guards this place (see `guardOf` in `places/index.ts`). */
const guarded = (state: GameState, place: Location) => Boolean(place.guard && state.locations.some((l) => l.id === place.guard && !l.done));

function openChest(state: GameState, place: Location, take: 'keep' | 'give'): Result | null {
  if (place.done) return null;
  const gold = loot(state, place.gold ?? 0);
  let opened = update(state, place.id, { done: true });
  // It stays where it stood, open and empty.
  const changed = { type: 'changed', id: place.id } as const;
  // Some chests hold more than coin, and that he keeps either way.
  const found: string[] = [];
  let choices: Choice[] = [];
  if (place.artifact) {
    opened = giveArtifact(opened, place.artifact);
    found.push(`Under the coins you find ${artifactPhrase(place.artifact)}. ${foundNote(opened, place.artifact)}`);
    choices = artifactChoices(opened, place.artifact);
  }
  if (take === 'keep') {
    const card = note(place, [`You keep **${coins(gold)} gold**. The villagers will never know.`, ...found]);
    if (choices.length) card.choices = choices;
    return say({ ...opened, gold: state.gold + gold }, place, card, changed);
  }
  const leadership = Math.round(gold / 20);
  const card = note(place, [`The villagers cheer, and you gain **${leadership} leadership**.`, 'Somebody starts a song about you. It rhymes \u201cAldric\u201d with \u201cbald trick\u201d.', ...found]);
  if (choices.length) card.choices = choices;
  return say({ ...opened, leadership: state.leadership + leadership }, place, card, changed);
}

/**
 * A treasure chest: keep the gold, or hand it out for leadership, as in King's Bounty. They all look
 * the same, and some hold something else instead, written as content (`pages`): a spell scroll, a
 * map of a land, a piece of gear (#192). Opened, it stays on the map, open and empty.
 */
export const chest: PlaceKind = {
  about: (state, place) => ({ title: place.name, lines: aboutWords(state, place), choices: [ride(place, 'Open'), close] }),
  arrive(state, place) {
    if (place.done) return say(state, place, note(place, ['The chest is empty. You check twice anyway.']));
    const page = firstPage(state, place);
    if (page) return say(state, place, pageCard(state, place, page));
    const gold = loot(state, place.gold ?? 0);
    return say(state, place, {
      title: place.name,
      lines: [`You pry the lid off and find **${coins(gold)} gold** inside.`, 'Will you keep it, or hand it out so the villagers sing your praises across the province?'],
      choices: [option(place, 'Keep the gold', 'keep'), option(place, `Hand it out (+${Math.round(gold / 20)} leadership)`, 'give')],
    });
  },
  choose: (state, place, choice) => (choice === 'keep' || choice === 'give' ? openChest(state, place, choice) : null),
  worth: (state, place) => (place.done || guarded(state, place) ? null : place.pages ? (bestChoice(state, place)?.worth ?? null) : Math.max(150, place.gold ?? 0) + (place.artifact ? 300 : 0)),
  bot(state, place) {
    if (place.done || guarded(state, place)) return state;
    if (place.pages) {
      const best = bestChoice(state, place);
      return best ? (takeChoice(state, place, best.choice)?.state ?? state) : state;
    }
    const short = heroStats(state).leadership - leadershipUsed(state.army) < 40;
    return openChest(state, place, short ? 'give' : 'keep')?.state ?? state;
  },
};

/**
 * A pile of gold by the road: scooped up on arrival, no card needed (the map shows the gold rising),
 * unless there's something to say about what the gold was in (a pedlar's pack, the Baron's hamper).
 */
export const pile: PlaceKind = {
  about: (state, place) => ({ title: place.name, lines: aboutWords(state, place), choices: [ride(place, 'Take'), close] }),
  arrive(state, place) {
    if (place.done) return say(state, place, note(place, ['There is nothing left but footprints.']));
    const gold = loot(state, place.gold ?? 0);
    const taken = update({ ...state, gold: state.gold + gold }, place.id, { done: true });
    const removed = { type: 'removed', id: place.id } as const;
    const lines = words(place, 'visit').map((line) => line.replace('{gold}', `**${coins(gold)} gold**`));
    return lines.length ? say(taken, place, note(place, lines), removed) : { state: taken, events: [removed] };
  },
  worth: (_, place) => (place.done ? null : (place.gold ?? 0)),
};
