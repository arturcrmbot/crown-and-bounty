import { ALDMOOR } from '../content/aldmoor';
import type { Province } from '../content/types';
import { startingExplored } from './map/fog';
import { MOVEMENT_PER_DAY, type GameState } from './state';

export function newGame(seed = 1066, province: Province = ALDMOOR): GameState {
  return {
    day: 1,
    gold: 1250,
    leadership: 120,
    army: [{ troop: 'knights', count: 12 }, { troop: 'archers', count: 25 }],
    movement: MOVEMENT_PER_DAY,
    seed,
    locations: structuredClone(province.locations),
    bounty: 'open',
    hero: { at: province.hero, facing: 1, attack: 1, defence: 1, spellPower: 2, knowledge: 2, mana: 20, spells: ['bolt', 'bless', 'slow'] },
    world: { width: province.width, height: province.height },
    explored: startingExplored(province),
  };
}
