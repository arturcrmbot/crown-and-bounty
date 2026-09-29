/**
 * The difficulty model: what each tier of enemy should feel like, as win chances at two moments of
 * a commission. `start` is day I with the army you arrive with. `explored` is after a few days of
 * riding round, taking what's lying about, recruiting and beating the pests, without touching the
 * gates. The balance tests hold every province, hand-made or generated, to these for every
 * background. `reference` is a careful player on day 21, for the reports (`npm run difficulty`,
 * `npm run sim:curve`): no test holds him to a number.
 */
import { BACKGROUNDS } from '../content/backgrounds';
import { playCommission } from './bot';
import { provinceOf } from './campaign';
import { winChance } from './fight';
import { mapOf } from './map/maps';
import { merge, riddenOut } from './map/sortie';
import { update, type GameState, type Tier } from './state';

type Range = readonly [number, number];

export const TARGETS: Record<Tier, { start?: Range; explored?: Range }> = {
  /** An easy first fight: won from the start, with light losses. */
  pest: { start: [0.9, 1] },
  /** A fair fight from the start. */
  band: { start: [0.5, 1] },
  /** Too strong at first, so you explore and grow; beatable once you have. */
  gate: { start: [0, 0.35], explored: [0.75, 1] },
  /** The villain: out of reach until the whole loop is done. */
  boss: { start: [0, 0.05] },
};

/** The day the reports look at a careful player: the third week. */
export const TARGET_DAY = 21;

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

/** Days of exploring before the `explored` checkpoint, in a province as wide as the first ones (40 tiles). */
export const EXPLORE_DAYS = 6;

/** Days of exploring in this commission's province: longer in a wider one, as its rides are (Aldmoor's 100 tiles: 15). */
export const exploreDays = (state: GameState) => Math.round((EXPLORE_DAYS * provinceOf(state).width) / (40 * 32));

/** The `explored` checkpoint: the bot rides round, collects, recruits and beats pests, but no more. */
export function explored(start: GameState): GameState {
  const days = exploreDays(start);
  return playCommission(start, mapOf(start), 20000, {
    allow: (l) => !l.enemy || l.enemy.tier === 'pest',
    stop: (s) => s.day >= days,
  }).state;
}

/** Every enemy's tier and win chance at a checkpoint. */
export function odds(state: GameState): { id: string; tier: Tier; chance: number }[] {
  return state.locations.filter((l) => l.enemy && !l.done && l.enemy.tier).map((l) => ({ id: l.id, tier: l.enemy!.tier!, chance: winChance(state, l.id) }));
}
