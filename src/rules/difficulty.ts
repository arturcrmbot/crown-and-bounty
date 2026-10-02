/**
 * The difficulty model, as a climb (`docs/BALANCE.md`): five rings of bands by the ride from the start,
 * each met by a careful player on its days, and the villain at the top on the target day. In each ring
 * most bands are a fair fight he wins with losses, and about one is a step ahead, so he comes back for
 * it. The balance tests hold Aldmoor to the climb's shape for every background, as win chances at two
 * moments: `start` is day I with the army he arrives with, and `climbed` a careful player at the end of
 * ring 2's days who has beaten what he could of rings 1 and 2. Every band grows a seventh a week, about
 * as fast as he does, so what keeps the far rings for later is the ride to them: the day each ring falls
 * is `npm run sim:curve`'s to say. `reference` is a careful player on day 21, for the reports
 * (`npm run difficulty`, `npm run sim:curve`): no test holds him to a number.
 */
import { BACKGROUNDS } from '../content/backgrounds';
import { playCommission } from './bot';
import { winChance } from './fight';
import { mapOf } from './map/maps';
import { merge, riddenOut } from './map/sortie';
import { update, type GameState, type Location, type Ring } from './state';

type Range = readonly [number, number];

/** The days a careful player meets each ring's bands: round the castle, the fields and the downs, the river and the chase, the heath and the crags, and Darkwood. */
export const RINGS: Record<Ring, Range> = { 1: [1, 2], 2: [2, 5], 3: [4, 9], 4: [8, 14], 5: [12, 20] };

/** A ring, or the villain's lair at the top of the climb. */
export type Step = Ring | 'top';

/**
 * What the climb should feel like at each moment, as the win chance of the median band of each ring
 * (and of the villain, at the top). On day I the first ring is a fair fight, and everything from the
 * river on, and the villain, is out of reach. Once the first two rings are done, the river and the chase
 * are mostly a fair fight, and the villain is still out of reach.
 */
export const TARGETS: Record<'start' | 'climbed', Partial<Record<Step, Range>>> = {
  start: { 1: [0.5, 1], 3: [0, 0.35], 4: [0, 0.35], 5: [0, 0.35], top: [0, 0.05] },
  climbed: { 3: [0.5, 1], top: [0, 0.05] },
};

/** The day the reports look at a careful player: the third week, when he reaches the top of the climb. */
export const TARGET_DAY = 21;

/** Where an enemy stands in the climb, if it does: its ring, or the top for the villain's lair. */
export const stepOf = (place: Location): Step | null => (place.kind === 'hideout' ? 'top' : (place.enemy?.ring ?? null));

/** The reference hero: a careful player who has done everything but the villain, on the target day. */
export function reference(start: GameState, day = TARGET_DAY): GameState {
  return atHome(playCommission(start, mapOf(start), 20000, { allow: (l) => l.kind !== 'hideout', stop: (s) => s.day >= day }).state);
}

/** The villain behind his walls with his whole army, as the hero would find him at his gate: a band he has out rides home first. */
export function atHome(state: GameState): GameState {
  let next = state;
  for (const lair of state.locations) {
    const band = lair.enemy?.sortie ? riddenOut(next, lair) : null;
    if (!band) continue;
    next = update(next, lair.id, { enemy: { ...lair.enemy!, army: merge(lair.enemy!.army, band.enemy!.army) } });
    next = update(next, band.id, { done: true });
  }
  return next;
}

/** The same hero with his army alone: no gear, and only the spells he came with. */
export const bare = (state: GameState): GameState => ({ ...state, hero: { ...state.hero, gear: {}, spells: [...BACKGROUNDS[state.hero.background].spells] } });

/** The `climbed` checkpoint: the bot rides round, collects, recruits and fights rings 1 and 2, but no more, until the end of ring 2's days. */
export function climbed(start: GameState): GameState {
  return playCommission(start, mapOf(start), 20000, {
    allow: (l) => !l.enemy || (l.enemy.ring ?? 9) <= 2,
    stop: (s) => s.day >= RINGS[2][1],
  }).state;
}

/** Every enemy in the climb, where it stands in it, and its win chance at a checkpoint. */
export function odds(state: GameState): { id: string; step: Step; chance: number }[] {
  return state.locations.flatMap((l) => {
    const step = l.done ? null : stepOf(l);
    return step === null ? [] : [{ id: l.id, step, chance: winChance(state, l.id) }];
  });
}

/** The median win chance of each step of the climb with an enemy still standing. */
export function medians(state: GameState): Partial<Record<Step, number>> {
  const by = new Map<Step, number[]>();
  for (const o of odds(state)) by.set(o.step, [...(by.get(o.step) ?? []), o.chance]);
  return Object.fromEntries([...by].map(([step, chances]) => [step, median(chances)]));
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
