import { ALDMOOR } from '../content/aldmoor';
import { BACKGROUNDS, type BackgroundId } from '../content/backgrounds';
import type { Province } from '../content/types';
import { heroStats, newHero } from './hero';
import { startingExplored } from './map/fog';
import type { GameState } from './state';

/** A new commission in `province`, for a hero of `background`. */
export function newGame(seed = 1066, province: Province = ALDMOOR, background: BackgroundId = 'knight'): GameState {
  const b = BACKGROUNDS[background];
  const state: GameState = {
    day: 1,
    gold: b.gold,
    leadership: b.leadership,
    army: b.army.map((s) => ({ ...s })),
    movement: 0,
    seed,
    locations: structuredClone(province.locations),
    bounty: 'open',
    hero: newHero(background, province.hero),
    world: { width: province.width, height: province.height },
    explored: startingExplored(province),
  };
  return { ...state, movement: heroStats(state).movement };
}

/** Starts the same commission again with a different background (from the opening card). */
export function chooseBackground(state: GameState, background: BackgroundId): GameState {
  const fresh = newGame(state.seed, ALDMOOR, background);
  return { ...fresh, explored: state.explored, locations: state.locations };
}
