import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../../content/aldmoor';
import { newGame } from '../scenario';
import { isExplored } from './fog';
import { buildMap, cellIndex } from './model';
import { planRoute, routeCosts, stepAlong } from './movement';

const map = buildMap(ALDMOOR);

describe('riding', () => {
  it('plans a route to the chest and pays for each step', () => {
    const state = newGame();
    const route = planRoute(state, map, [458, 702])!;
    expect(route.length).toBeGreaterThan(5);
    const step = stepAlong(state, map, route)!;
    expect(step.state.movement).toBeCloseTo(state.movement - routeCosts(state, map, route)[0]);
    expect(step.events[0]).toMatchObject({ type: 'moved' });
  });

  it('stops when today\u2019s movement runs out, and leaves the rest for tomorrow', () => {
    let state = { ...newGame(), movement: 10 };
    let route = planRoute(state, map, [1120, 240])!;
    let steps = 0;
    for (;;) {
      const step = stepAlong(state, map, route);
      if (!step) break;
      state = step.state;
      route = route.slice(1);
      steps++;
    }
    expect(steps).toBeGreaterThan(0);
    expect(route.length).toBeGreaterThan(0);
    expect(state.movement).toBeLessThan(3);
  });

  it('sees further as he rides', () => {
    const state = newGame();
    const far = cellIndex(map, 330, 330);
    expect(isExplored(state.explored, far)).toBe(false);
    let s = state;
    let route = planRoute(s, map, [380, 362])!;
    while (route.length) {
      const step = stepAlong(s, map, route);
      if (!step) break;
      s = step.state;
      route = route.slice(1);
    }
    expect(isExplored(s.explored, far)).toBe(true);
  });

  it('cannot get past the wolves to the hideout until they are beaten', () => {
    const state = newGame();
    expect(planRoute(state, map, [104, 850])).toBeNull();
    expect(planRoute(state, map, [256, 690])).not.toBeNull();
    const beaten = { ...state, locations: state.locations.map((l) => (l.id === 'wolves' ? { ...l, done: true } : l)) };
    expect(planRoute(beaten, map, [104, 850])).not.toBeNull();
  });
});
