import type { GameEvent, GameState } from '../game';
import { revealDisc } from './fog';
import type { Point } from './geometry';
import { cellCentre, cellIndex, gridWithEnemies, type MapModel } from './model';
import { findPath, nearestPassable } from './pathfinding';

/** How far the hero sees as he rides, in pixels. */
export const SIGHT = 150;

const cellXY = (map: MapModel, i: number) => ({ x: i % map.width, y: Math.floor(i / map.width) });

/** Enemies block the way until they are beaten. */
const standingGrid = (state: GameState, map: MapModel) =>
  gridWithEnemies(map, (id) => !state.locations.find((l) => l.id === id)?.done);

/** The cells from the hero to `target` (excluding his own), or null if there is no way. */
export function planRoute(state: GameState, map: MapModel, target: Point): number[] | null {
  const grid = standingGrid(state, map);
  const start = nearestPassable(grid, cellXY(map, cellIndex(map, state.hero.at[0], state.hero.at[1])));
  const goal = nearestPassable(grid, cellXY(map, cellIndex(map, target[0], target[1])), 16);
  if (!start || !goal) return null;
  const cells = findPath(grid, start, goal);
  if (!cells) return null;
  return cells.slice(1).map((c) => c.y * map.width + c.x);
}

/** Movement points for one step between neighbouring cells. Matches the A* costs. */
export function stepCost(map: MapModel, from: number, to: number): number {
  const a = cellXY(map, from);
  const b = cellXY(map, to);
  const diagonal = a.x !== b.x && a.y !== b.y;
  return (diagonal ? Math.SQRT2 : 1) * (map.grid.cost[from] + map.grid.cost[to]) * 0.5;
}

/** Total cost of each prefix of a route, for colouring today's and tomorrow's marks. */
export function routeCosts(state: GameState, map: MapModel, route: number[]): number[] {
  let from = cellIndex(map, state.hero.at[0], state.hero.at[1]);
  let total = 0;
  return route.map((to) => {
    total += stepCost(map, from, to);
    from = to;
    return total;
  });
}

/**
 * One step along the route, if today's movement allows it. The hero moves to the next cell,
 * turns to face it, and sees further.
 */
export function stepAlong(state: GameState, map: MapModel, route: number[]): { state: GameState; events: GameEvent[] } | null {
  if (route.length === 0) return null;
  const from = cellIndex(map, state.hero.at[0], state.hero.at[1]);
  const cost = stepCost(map, from, route[0]);
  if (!Number.isFinite(cost) || state.movement < cost) return null;
  const at = cellCentre(map, route[0]);
  const facing = at[0] > state.hero.at[0] ? 1 : at[0] < state.hero.at[0] ? -1 : state.hero.facing;
  const sight = revealDisc(state.explored, map.province, at[0], at[1], SIGHT);
  const next: GameState = { ...state, movement: state.movement - cost, hero: { at, facing }, explored: sight.bits };
  const events: GameEvent[] = [{ type: 'moved', at, facing }];
  if (sight.changed) events.push({ type: 'reveal', at, radius: SIGHT });
  return { state: next, events };
}
