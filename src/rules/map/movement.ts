import type { GameEvent, GameState } from '../game';
import { heroStats } from '../hero';
import { revealDisc } from './fog';
import type { Point } from './geometry';
import { cellCentre, cellIndex, gridWithEnemies, standingEnemies, Terrain, type MapModel } from './model';
import { findPath, nearestPassable, reachableNear } from './pathfinding';

/** How far the hero sees as he rides, in pixels. */
export const SIGHT = 150;

const cellXY = (map: MapModel, i: number) => ({ x: i % map.width, y: Math.floor(i / map.width) });

/** Woodland costs a ranger this much a cell: slower than grass, but nobody else gets through at all. */
export const FOREST_COST = 3;
const woodland = new WeakMap<MapModel, Float32Array>();

/** What each cell costs this hero to ride through: a ranger can take to the woods. */
export function costsFor(state: GameState, map: MapModel): Float32Array {
  if (!heroStats(state).forestWalk) return map.grid.cost;
  let cost = woodland.get(map);
  if (!cost) {
    cost = map.grid.cost.slice();
    for (let i = 0; i < cost.length; i++) if (map.terrain[i] === Terrain.Forest) cost[i] = FOREST_COST;
    woodland.set(map, cost);
  }
  return cost;
}

/** Enemies block the way where they stand, until they are beaten. */
const standingGrid = (state: GameState, map: MapModel) => gridWithEnemies({ ...map, grid: { ...map.grid, cost: costsFor(state, map) } }, standingEnemies(state.locations));

/** How close (in cells) the hero rides up to an enemy he is going to face. */
export const APPROACH = 6;

/**
 * The cells from the hero to `target` (excluding his own), or null if there is no way. With
 * `approach`, he rides up to it from his own side, for enemies that block their own road.
 */
export function planRoute(state: GameState, map: MapModel, target: Point, approach = false): number[] | null {
  const grid = standingGrid(state, map);
  const start = nearestPassable(grid, cellXY(map, cellIndex(map, state.hero.at[0], state.hero.at[1])));
  const aim = cellXY(map, cellIndex(map, target[0], target[1]));
  const goal = approach ? start && reachableNear(grid, start, aim, APPROACH) : nearestPassable(grid, aim, 16);
  if (!start || !goal) return null;
  const cells = findPath(grid, start, goal);
  if (!cells) return null;
  return cells.slice(1).map((c) => c.y * map.width + c.x);
}

/**
 * Days until the hero gets to `target`: 0 for today, 1 for tomorrow, and so on, or null if there is
 * no way there. Each new day brings his full movement.
 */
export function daysAway(state: GameState, map: MapModel, target: Point, approach = false): number | null {
  const route = planRoute(state, map, target, approach);
  if (!route) return null;
  const total = route.length ? routeCosts(state, map, route)[route.length - 1] : 0;
  if (total <= state.movement) return 0;
  return Math.ceil((total - state.movement) / Math.max(1, heroStats(state).movement));
}

/** Movement points for one step between neighbouring cells. Matches the A* costs. */
export function stepCost(map: MapModel, from: number, to: number, cost = map.grid.cost): number {
  const a = cellXY(map, from);
  const b = cellXY(map, to);
  const diagonal = a.x !== b.x && a.y !== b.y;
  return (diagonal ? Math.SQRT2 : 1) * (cost[from] + cost[to]) * 0.5;
}

/** Total cost of each prefix of a route, for colouring today's and tomorrow's marks. */
export function routeCosts(state: GameState, map: MapModel, route: number[]): number[] {
  const costs = costsFor(state, map);
  let from = cellIndex(map, state.hero.at[0], state.hero.at[1]);
  let total = 0;
  return route.map((to) => {
    total += stepCost(map, from, to, costs);
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
  const cost = stepCost(map, from, route[0], costsFor(state, map));
  if (!Number.isFinite(cost) || state.movement < cost) return null;
  const at = cellCentre(map, route[0]);
  const facing = at[0] > state.hero.at[0] ? 1 : at[0] < state.hero.at[0] ? -1 : state.hero.facing;
  const sight = revealDisc(state.explored, state.world, at[0], at[1], heroStats(state).sight);
  const next: GameState = { ...state, movement: state.movement - cost, hero: { ...state.hero, at, facing }, explored: sight.bits };
  const events: GameEvent[] = [{ type: 'moved', at, facing }];
  if (sight.changed) events.push({ type: 'reveal', at, radius: heroStats(state).sight });
  return { state: next, events };
}
