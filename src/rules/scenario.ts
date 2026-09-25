import { ALDMOOR } from '../content/aldmoor';
import { BACKGROUNDS, type BackgroundId } from '../content/backgrounds';
import { COMMISSIONS } from '../content/campaign';
import type { Province } from '../content/types';
import { heroStats, newHero } from './hero';
import { startingExplored } from './map/fog';
import type { Campaign, GameState } from './state';

/** A commission in `province`, beginning with this hero, purse and army. `start` is kept for trying again. */
export function beginCommission(province: Province, seed: number, start: Campaign['start'], chapter: number, record: Campaign['record']): GameState {
  const state: GameState = {
    day: 1,
    gold: start.gold,
    leadership: start.leadership,
    army: start.army.map((s) => ({ ...s })),
    movement: 0,
    seed,
    locations: structuredClone(province.locations),
    bounty: 'open',
    hero: { ...structuredClone(start.hero), at: province.hero, facing: 1 },
    world: { width: province.width, height: province.height },
    explored: startingExplored(province),
    campaign: { chapter, record, start: structuredClone(start) },
  };
  const stats = heroStats(state);
  return { ...state, movement: stats.movement, hero: { ...state.hero, mana: stats.maxMana } };
}

/** A new campaign's first commission in `province`, for a hero of `background` who has yet to confirm it. */
export function newGame(seed = 1066, province: Province = ALDMOOR, background: BackgroundId = 'knight'): GameState {
  const b = BACKGROUNDS[background];
  const chapter = Math.max(0, COMMISSIONS.findIndex((c) => c.province.id === province.id));
  const start = { hero: newHero(background, province.hero), gold: b.gold, leadership: b.leadership, army: b.army };
  return { ...beginCommission(province, seed, start, chapter, []), opening: true };
}

/** Starts the same commission again with the background picked on the opening card. */
export function chooseBackground(state: GameState, background: BackgroundId): GameState {
  const { opening: _, ...fresh } = newGame(state.seed, COMMISSIONS[state.campaign.chapter].province, background);
  return { ...fresh, explored: state.explored, locations: state.locations };
}
