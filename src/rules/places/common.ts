import { artifactPhrase } from '../../content/artifacts';
import type { PortraitId } from '../../content/portraits';
import { crowd } from '../../content/troops';
import { artifactChoices, foundNote, gainXp, giveArtifact, heroStats } from '../hero';
import { meets } from '../effects/core';
import { close, listed, locationById, show, TROOPS, troops, update, type Army, type Card, type Choice, type GameEvent, type GameState, type Location, type PlaceText, type Result } from '../state';

/** Experience for finding a place for the first time. */
export const DISCOVERY_XP = 40;

/** Gold from treasure, with the hero's knack for finding it. */
export const loot = (state: GameState, gold: number) => Math.round(gold * (1 + heroStats(state).loot));
/** A recruit's price after the hero's charm. Those who ask nothing still ask nothing. */
export const priceOf = (state: GameState, base: number) => (base > 0 ? Math.max(1, Math.round(base * (1 + heroStats(state).recruitPrice))) : 0);

/** The usual words for each kind of place, for provinces that don't give their own. */
const USUAL: Record<Location['kind'], Omit<PlaceText, 'later'>> = {
  castle: { about: ['This is a royal castle.', 'You can recruit troops here, and there is an armoury.'] },
  tower: { about: ['This old tower has been empty for a long time.'], done: ['The tower is empty now.'], visit: ['Someone left a note here, long ago.'] },
  mine: { about: ['Something down there is humming.'], done: ['There is nothing left but echoes.'], visit: ['You find a forgotten stash of **{gold} gold**.'] },
  village: { about: ['The villagers are friendly, if nosy.'] },
  mill: { about: ['The miller waves.'], done: ['"Next week, officer."'], visit: ['Your troops eat well and march on.'] },
  chest: { about: ['It is heavy, and locked with a lock that isn\u2019t.'] },
  gold: { about: ['Someone left this in a hurry.'] },
  patrol: { done: ['There is nobody here now.'] },
  hideout: { done: ['There is nobody here now.'] },
  signpost: { about: ['The arms point every way at once.'] },
  dig: { about: ['The map says it is here. Your sergeant is not convinced.'] },
  event: { about: ['There is something here worth a look.'], done: ['There is nothing more to see here.'] },
  well: { about: ['A tin cup hangs on a chain by this holy well.'], visit: ['You drink. The water is cold and very good.'] },
  pickup: { about: ['Something is lying by the way. Ride by, and you can pick it up without stopping.'] },
  goose: { about: ['A goose is hiding here, a long way from home.'], visit: ['*Honk.* She gives you a long look, decides you mean it, and waddles off home to the goose pond.'] },
};

/** A place's words: the province's own if it has them, else the usual ones for its kind. */
export const words = (place: Location, part: Exclude<keyof PlaceText, 'later'>): string[] => place.text?.[part] ?? USUAL[place.kind][part] ?? [];

/** What a place says from afar: what it says once something has happened there, if something has (`later`), else its words `about` it. */
export const aboutWords = (state: GameState, place: Location): string[] => place.text?.later?.find((l) => meets(state, l.when))?.about ?? words(place, 'about');
/** What a place's hover label says after its name, once something has happened (`later`), if anything. */
export const laterNote = (state: GameState, place: Location): string | undefined => place.text?.later?.find((l) => meets(state, l.when))?.note;

/**
 * What an enemy has, for its card: "**lots of Swordsmen** and **a pack of Crossbowmen**", or with
 * `exact` counts, "**20 Swordsmen** and **12 Crossbowmen**". A villain is always just himself.
 */
export function forceLine(army: Army, exact = true): string {
  const parts = army
    .filter((s) => s.count > 0)
    .map((s) => (TROOPS[s.troop].leadership >= 99 ? `**${TROOPS[s.troop].one}**` : `**${exact ? troops(s.troop, s.count) : crowd(s.troop, s.count)}**`));
  return parts.length ? listed(parts) : 'nobody';
}

/** The face of whoever leads an army, a villain or a captain, for its cards: none for a band with no leader, or none drawn. */
export function faceOf(army: Army): { portrait?: PortraitId } {
  const face = army.map((s) => TROOPS[s.troop].face).find(Boolean);
  return face ? { portrait: face } : {};
}

/** Whether the hero's scouts count an enemy exactly: a Ranger's do, and anyone's with Scouting. */
export const countsExactly = (state: GameState) => heroStats(state).counts;

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
function discover(state: GameState, id: string): { state: GameState; events: GameEvent[]; lines: string[]; choices: Choice[] } {
  const place = locationById(state, id);
  if (place.seen) return { state, events: [], lines: [], choices: [] };
  let next = update(state, id, { seen: true });
  const lines: string[] = [];
  let choices: Choice[] = [];
  if (place.artifact) {
    next = giveArtifact(next, place.artifact);
    lines.push(`You find ${artifactPhrase(place.artifact)}. ${foundNote(next, place.artifact)}`);
    choices = artifactChoices(next, place.artifact);
  }
  const xp = gainXp(next, DISCOVERY_XP);
  return { state: xp.state, events: xp.events, lines, choices };
}

/** Shows a card with the first-visit rewards added to it. */
export function found(state: GameState, place: Location, card: Card, ...extra: GameEvent[]): Result {
  const d = discover(state, place.id);
  const choices = d.choices.length ? [...d.choices, ...card.choices.filter((choice) => choice.action.type !== 'close')] : card.choices;
  return say(d.state, place, { ...card, lines: [...card.lines, ...d.lines], choices }, ...extra, ...d.events);
}
