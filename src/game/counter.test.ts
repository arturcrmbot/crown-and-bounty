import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { apply, newGame, type Action, type GameState } from '../rules/game';
import { count, milestonesIn, startCounter } from './counter';

const aldmoor = (army: GameState['army']): GameState => ({ ...newGame(1066, ALDMOOR, 'knight'), opening: undefined, army });
/** The milestones in what the rules say happens when the hero does this. */
const reached = (state: GameState, action: Action) => {
  const result = apply(state, action)!;
  return milestonesIn(result.state, result.events).map((m) => m.path).sort();
};

describe('the visitor counter', () => {
  it('counts a battle won or lost, however it was fought, and a villain taken in battle as both', () => {
    const strong = aldmoor([{ troop: 'knights', count: 4000 }]);
    expect(reached(strong, { type: 'choose', id: 'wolves', choice: 'auto' })).toEqual(['first-battle-won']);
    expect(reached(strong, { type: 'choose', id: 'hideout', choice: 'auto' })).toEqual(['commission-1-won', 'first-battle-won']);
    expect(reached(aldmoor([{ troop: 'peasants', count: 1 }]), { type: 'choose', id: 'hideout', choice: 'auto' })).toEqual(['first-battle-lost']);
  });

  it('counts the dawns of days 5, 10 and 20', () => {
    const state = aldmoor([]);
    const days = Array.from({ length: 30 }, (_, i) => milestonesIn(state, [{ type: 'day', day: i + 1, payday: false }])).flat();
    expect(days.map((m) => m.path)).toEqual(['day-5', 'day-10', 'day-20']);
  });

  it('does nothing without a site code: here there is no page to load a script into', () => {
    expect(() => startCounter()).not.toThrow();
    expect(() => count({ path: 'new-campaign', title: 'New campaign' })).not.toThrow();
  });
});
