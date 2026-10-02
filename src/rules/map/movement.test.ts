import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../../content/aldmoor';
import { newGame } from '../scenario';
import type { GameState } from '../state';
import { isExplored } from './fog';
import { buildMap, cellCentre, cellIndex, Terrain } from './model';
import { facingEnemy, planRoute, routeCosts, stepAlong } from './movement';

const map = buildMap(ALDMOOR);

describe('riding', () => {
  it('plans a route to the chest and pays for each step', () => {
    const state = newGame();
    const route = planRoute(state, map, state.locations.find((l) => l.id === 'chest')!.at)!;
    expect(route.length).toBeGreaterThan(5);
    const step = stepAlong(state, map, route)!;
    expect(step.state.movement).toBeCloseTo(state.movement - routeCosts(state, map, route)[0]);
    expect(step.events[0]).toMatchObject({ type: 'moved' });
  });

  it('stops when today\u2019s movement runs out, and leaves the rest for tomorrow', () => {
    let state = { ...newGame(), movement: 10 };
    let route = planRoute(state, map, state.locations.find((l) => l.id === 'castle')!.at)!;
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
    // South of the King's road, out of sight from the start and the castle.
    const far = cellIndex(map, 2640, 1180);
    expect(isExplored(state.explored, far)).toBe(false);
    let s = { ...state, movement: 999 };
    let route = planRoute(s, map, [2620, 1150])!;
    while (route.length) {
      const step = stepAlong(s, map, route);
      if (!step) break;
      s = step.state;
      route = route.slice(1);
    }
    expect(isExplored(s.explored, far)).toBe(true);
  });

  it('crosses the river at the old bridge once the patrol is gone, and the long way round by the ford till then', () => {
    const state = { ...newGame(), movement: 150 };
    // The crossroads just over the bridge.
    const crossroads: [number, number] = [1544, 1488];
    const open = { ...state, locations: state.locations.map((l) => (l.id === 'patrol' ? { ...l, done: true } : l)) };
    const held = planRoute(state, map, crossroads)!;
    const over = planRoute(open, map, crossroads)!;
    expect(held.some((i) => map.terrain[i] === Terrain.Ford)).toBe(true);
    expect(over.some((i) => map.terrain[i] === Terrain.Ford)).toBe(false);
    // The long way round costs more than a day's riding more.
    expect(routeCosts(state, map, held).at(-1)! - routeCosts(open, map, over).at(-1)!).toBeGreaterThan(150);
  });

  it('reaches Grimsby from day one, the long way round, and past the wolves once they are beaten', () => {
    const state = { ...newGame(), movement: 150 };
    const hideout = state.locations.find((l) => l.id === 'hideout')!.at;
    const open = { ...state, locations: state.locations.map((l) => (l.id === 'patrol' ? { ...l, done: true } : l)) };
    const beaten = { ...open, locations: open.locations.map((l) => (l.id === 'wolves' ? { ...l, done: true } : l)) };
    expect(planRoute(state, map, hideout, true)).not.toBeNull();
    // The way past the kennels is shorter than round the wolves, if only a little.
    const ride = (s: GameState) => routeCosts(s, map, planRoute(s, map, hideout, true)!).at(-1)!;
    expect(ride(beaten)).toBeLessThan(ride(open));
  });

  it('rides up to the patrol on the bridge from his own bank', () => {
    const state = { ...newGame(), movement: 999 };
    const patrol = state.locations.find((l) => l.id === 'patrol')!.at;
    const route = planRoute(state, map, patrol, true)!;
    expect(route.some((i) => map.terrain[i] === Terrain.Ford)).toBe(false);
    const [x] = cellCentre(map, route.at(-1)!);
    expect(x).toBeGreaterThan(patrol[0]);
  });

  it('knows the enemy he has ridden up to, until it is beaten', () => {
    let s = { ...newGame(), movement: 999 };
    expect(facingEnemy(s)).toBeNull();
    const patrol = s.locations.find((l) => l.id === 'patrol')!;
    let route = planRoute(s, map, patrol.at, true)!;
    while (route.length) {
      s = stepAlong(s, map, route)!.state;
      route = route.slice(1);
    }
    expect(facingEnemy(s)?.id).toBe('patrol');
    expect(planRoute(s, map, patrol.at, true)).toEqual([]);
    const beaten = { ...s, locations: s.locations.map((l) => (l.id === 'patrol' ? { ...l, done: true } : l)) };
    expect(facingEnemy(beaten)?.id).not.toBe('patrol');
  });
});
