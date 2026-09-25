import { ALDMOOR } from '../content/aldmoor';
import type { Province } from '../content/types';
import { startingExplored } from './map/fog';
import { MOVEMENT_PER_DAY, type GameState } from './state';

export function newGame(seed = 1066, province: Province = ALDMOOR): GameState {
  return {
    day: 1,
    gold: 1250,
    leadership: 120,
    army: { knights: 12, archers: 25, peasants: 0 },
    movement: MOVEMENT_PER_DAY,
    seed,
    locations: structuredClone(province.locations),
    bounty: 'open',
    hero: { at: province.hero, facing: 1 },
    explored: startingExplored(province),
  };
}
