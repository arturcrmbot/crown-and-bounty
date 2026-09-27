import { ARTIFACTS } from '../../content/artifacts';
import { foundNote, gainXp, giveArtifact, heroStats } from '../hero';
import { close, locationById, show, TROOPS, troops, update, type Army, type Card, type Choice, type GameEvent, type GameState, type Location, type PlaceText, type Result } from '../state';

/** Experience for finding a place for the first time. */
export const DISCOVERY_XP = 40;

/** Gold from treasure, with the hero's knack for finding it. */
export const loot = (state: GameState, gold: number) => Math.round(gold * (1 + heroStats(state).loot));
/** A recruit's price after the hero's charm. */
export const priceOf = (state: GameState, base: number) => Math.max(1, Math.round(base * (1 + heroStats(state).recruitPrice)));

/** The usual words for each kind of place, for provinces that don't give their own. */
const USUAL: Record<Location['kind'], PlaceText> = {
  castle: { about: ['A royal castle.', 'Troops to recruit, and an armoury.'] },
  tower: { about: ['An old tower, long empty.'], done: ['Empty now.'], visit: ['Someone left a note here, long ago.'] },
  mine: { about: ['Something down there is humming.'], done: ['Nothing left but echoes.'], visit: ['A forgotten stash: **{gold} gold**.'] },
  village: { about: ['Friendly, if nosy.'] },
  mill: { about: ['The miller waves.'], done: ['"Next week, officer."'], visit: ['Your troops eat well and march on.'] },
  chest: { about: ['Heavy, and locked with a lock that isn\u2019t.'] },
  gold: { about: ['Someone left in a hurry.'] },
  patrol: { done: ['Nobody here now.'] },
  hideout: { done: ['Nobody here now.'] },
  signpost: { about: ['The arms point every way at once.'] },
  dig: { about: ['The map says here. Your horse is not convinced.'] },
  event: { about: ['Something worth a look.'], done: ['Nothing more to see here.'] },
};

/** A place's words: the province's own if it has them, else the usual ones for its kind. */
export const words = (place: Location, part: keyof PlaceText): string[] => place.text?.[part] ?? USUAL[place.kind][part] ?? [];

/** "**20 Swordsmen** and **12 Crossbowmen**": what an enemy has, for its card. */
export function forceLine(army: Army): string {
  const parts = army.filter((s) => s.count > 0).map((s) => (TROOPS[s.troop].leadership >= 99 ? `**${TROOPS[s.troop].one}**` : `**${troops(s.troop, s.count)}**`));
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] ?? 'nobody');
}

/** A button for one of a place's choices. */
export const option = (place: Location, label: string, choice: string, disabled = false): Choice => ({ label, action: { type: 'choose', id: place.id, choice }, ...(disabled ? { disabled: true } : {}) });
/** A button that rides there and visits. */
export const ride = (place: Location, label: string): Choice => ({ label, action: { type: 'go', id: place.id } });
/** A card with nothing to do but close it. */
export const note = (place: Location, lines: string[]): Card => ({ title: place.name, lines, choices: [close] });

/** Shows a card anchored over the place. */
export const say = (state: GameState, place: Location, card: Card, ...extra: GameEvent[]): Result => ({ state, events: [...extra, show(card, place.at, place.id)] });

/**
 * The first visit to a place: experience for finding it, and whatever it keeps for a hero.
 * Returns the state, the level-up events, and a line for the card.
 */
function discover(state: GameState, id: string): { state: GameState; events: GameEvent[]; lines: string[] } {
  const place = locationById(state, id);
  if (place.seen) return { state, events: [], lines: [] };
  let next = update(state, id, { seen: true });
  const lines: string[] = [];
  if (place.artifact) {
    next = giveArtifact(next, place.artifact);
    lines.push(`You find **${ARTIFACTS[place.artifact].name}**. ${foundNote(next, place.artifact)}`);
  }
  const xp = gainXp(next, DISCOVERY_XP);
  return { state: xp.state, events: xp.events, lines };
}

/** Shows a card with the first-visit rewards added to it. */
export function found(state: GameState, place: Location, card: Card, ...extra: GameEvent[]): Result {
  const d = discover(state, place.id);
  return say(d.state, place, { ...card, lines: [...card.lines, ...d.lines] }, ...extra, ...d.events);
}
