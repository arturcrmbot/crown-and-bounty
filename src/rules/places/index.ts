/**
 * Every kind of place, and the three things the game does with a place: describe it, visit it,
 * and take a choice on its card. Choices written as content (a page's, a parley) work for every
 * kind; each kind's own choices (recruit, fight, dig...) live in its module.
 */
import { meets, takeChoice } from '../effects';
import { riddenOut } from '../map/sortie';
import { locationById, type GameState, type Location, type LocationKind, type Result } from '../state';
import { dwelling } from './dwelling';
import { x } from './ending';
import { enemy, haggled } from './enemy';
import { event } from './event';
import type { PlaceKind } from './kind';
import { pickup } from './pickup';
import { mill, mine, signpost, tower } from './sights';
import { chest, pile } from './treasure';
import { well } from './well';

export const PLACE_KINDS: Record<LocationKind, PlaceKind> = {
  castle: dwelling,
  village: dwelling,
  chest,
  gold: pile,
  tower,
  mine,
  mill,
  signpost,
  patrol: enemy('patrol'),
  hideout: enemy('hideout'),
  dig: x,
  event,
  well,
  pickup,
};

/** The card for a place before the hero rides there. */
export const describe = (state: GameState, id: string) => {
  const place = locationById(state, id);
  return PLACE_KINDS[place.kind].about(state, place);
};

/** The band still guarding a place, if one is: until it's gone, riding up to the place brings it to its feet. */
export const guardOf = (state: GameState, place: Location): Location | null => (place.guard ? (state.locations.find((l) => l.id === place.guard && !l.done) ?? null) : null);

/** What happens when the hero arrives. A place with its guard still over it is that guard's to settle first. */
export const visit = (state: GameState, id: string): Result => {
  const place = locationById(state, id);
  const guard = guardOf(state, place);
  return guard ? PLACE_KINDS[guard.kind].arrive(state, guard) : PLACE_KINDS[place.kind].arrive(state, place);
};

/** A choice on a place's card: `page/choice` or `parley/id` for content, else the kind's own. */
export function choose(state: GameState, id: string, choice: string): Result | null {
  const place = state.locations.find((l) => l.id === id);
  if (!place) return null;
  const slash = choice.indexOf('/');
  if (slash < 0) return PLACE_KINDS[place.kind].choose?.(state, place, choice) ?? null;
  const [head, key] = [choice.slice(0, slash), choice.slice(slash + 1)];
  if (head === 'parley') {
    const parley = place.enemy?.parleys?.find((p) => p.id === key);
    return parley && !riddenOut(state, place) ? takeChoice(state, place, haggled(state, parley)) : null;
  }
  const page = place.pages?.find((p) => p.id === head);
  const option = page?.choices.find((c) => c.id === key);
  return page && option && meets(state, page.when) ? takeChoice(state, place, option, PLACE_KINDS[place.kind].card) : null;
}

/** Payday for a place: its kind reopens or restocks it. */
export const payday = (place: Location): Location => PLACE_KINDS[place.kind].payday?.(place) ?? place;

export { DISCOVERY_XP, forceLine, priceOf } from './common';
export { recruitable } from './dwelling';
export type { PlaceKind } from './kind';
