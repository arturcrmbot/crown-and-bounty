import type { GameEvent, GameState } from '../game';
import { heroStats } from '../hero';
import { revealDisc } from './fog';
import type { Point } from './geometry';
import type { Location } from '../state';
import { CELL, cellCentre, cellIndex, gridWithEnemies, standingEnemies, Terrain, type MapModel } from './model';
import { findPath, nearestPassable, reachableNear } from './pathfinding';

/** How far the hero sees as he rides, in pixels. */
export const SIGHT = 150;

const cellXY = (map: MapModel, i: number) => ({ x: i % map.width, y: Math.floor(i / map.width) });

/** Woodland costs a ranger this much a cell: slower than grass, but nobody else gets through at all. */
export const FOREST_COST = 3;
/** Cost grids worked out already, by map and by the hero's way of riding. */
const riding = new WeakMap<MapModel, Map<string, Float32Array>>();

/**
 * What each cell costs this hero to ride through: a ranger can take to the woods, and Logistics
 * makes riding off the road cheaper (never cheaper than a road).
 */
export function costsFor(state: GameState, map: MapModel): Float32Array {
  const { forestWalk, offRoad } = heroStats(state);
  if (!forestWalk && !offRoad) return map.grid.cost;
  const key = `${forestWalk}/${offRoad}`;
  let known = riding.get(map);
  if (!known) riding.set(map, (known = new Map()));
  let cost = known.get(key);
  if (!cost) {
    cost = map.grid.cost.slice();
    for (let i = 0; i < cost.length; i++) {
      const t = map.terrain[i];
      if (t === Terrain.Forest && forestWalk) cost[i] = Math.max(1, FOREST_COST * (1 - offRoad));
      else if (t === Terrain.Grass) cost[i] = Math.max(1, cost[i] * (1 - offRoad));
    }
    known.set(key, cost);
  }
  return cost;
}

/** Enemies block the way where they stand, until they are beaten. */
const standingGrid = (state: GameState, map: MapModel) => gridWithEnemies({ ...map, grid: { ...map.grid, cost: costsFor(state, map) } }, standingEnemies(state.locations));

/** How close (in cells) the hero rides up to an enemy he is going to face. */
export const APPROACH = 6;

/**
 * The unbeaten enemy the hero stands at, having ridden up to it: the nearest one within his
 * approach, or null. Its fight card belongs to him while he stays there.
 */
export function facingEnemy(state: GameState): Location | null {
  const [x, y] = state.hero.at;
  const reach = (APPROACH + 1) * CELL;
  let best: Location | null = null;
  let bestD = Infinity;
  for (const l of state.locations) {
    if (!l.enemy || l.done) continue;
    const d = Math.hypot(l.at[0] - x, l.at[1] - y);
    if (d <= reach && d < bestD) {
      best = l;
      bestD = d;
    }
  }
  return best;
}

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
 * Mana that comes back on a stretch of riding, from `before` to `after` movement left: a point
 * every time the day's movement passes a mark (Mysticism).
 */
export const manaRidden = (rate: number, before: number, after: number) => (rate > 0 ? Math.max(0, Math.floor(before * rate) - Math.floor(after * rate)) : 0);

/**
 * One step along the route, if today's movement allows it. The hero moves to the next cell,
 * turns to face it, and sees further. A mystic's mana comes back as he rides.
 */
export function stepAlong(state: GameState, map: MapModel, route: number[]): { state: GameState; events: GameEvent[] } | null {
  if (route.length === 0) return null;
  const from = cellIndex(map, state.hero.at[0], state.hero.at[1]);
  const cost = stepCost(map, from, route[0], costsFor(state, map));
  if (!Number.isFinite(cost) || state.movement < cost) return null;
  const stats = heroStats(state);
  const at = cellCentre(map, route[0]);
  const facing = at[0] > state.hero.at[0] ? 1 : at[0] < state.hero.at[0] ? -1 : state.hero.facing;
  const sight = revealDisc(state.explored, state.world, at[0], at[1], stats.sight);
  const movement = state.movement - cost;
  const mana = Math.max(state.hero.mana, Math.min(stats.maxMana, state.hero.mana + manaRidden(stats.manaRate, state.movement, movement)));
  const next: GameState = { ...state, movement, hero: { ...state.hero, at, facing, mana }, explored: sight.bits };
  const events: GameEvent[] = [{ type: 'moved', at, facing }];
  if (sight.changed) events.push({ type: 'reveal', at, radius: stats.sight });
  return { state: next, events };
}
