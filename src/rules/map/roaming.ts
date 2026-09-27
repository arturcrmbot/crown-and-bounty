/**
 * The map's own life: at night, enemy stacks move. Guards hold their ground. Roamers wander their
 * territory. Hunters wander too, but come for a weaker hero who strays into it, and fall on his
 * camp at dawn if they reach him. It all runs on the same walk grid, costs and dice as the hero.
 */
import { TROOPS } from '../../content/troops';
import { armyPower, roll, type GameEvent, type GameState, type Location } from '../state';
import type { Point } from './geometry';
import { CELL, cellCentre, gridWithEnemies, standingEnemies, type MapModel } from './model';
import { stepCost } from './movement';
import { findPath, nearestPassable } from './pathfinding';

/** How far a hunter notices the hero, and how close is close enough to fall on him. */
export const HUNT_SIGHT = 260;
export const AMBUSH_REACH = 40;

/** Movement points a stack has in a night: its slowest troop sets the pace. It's always slower than a mounted hero. */
export const nightPace = (l: Location) => 18 + 3 * Math.min(...l.enemy!.army.map((s) => TROOPS[s.troop].speed));

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cellOf = ([x, y]: Point) => ({ x: Math.floor(x / CELL), y: Math.floor(y / CELL) });

/** Whether a hunter comes for the hero tonight: he is near, inside its territory, and weaker. */
export function hunting(state: GameState, l: Location): boolean {
  const e = l.enemy!;
  if (e.behaviour !== 'hunt' || (e.rest ?? 0) > 0) return false;
  const home = e.home ?? l.at;
  const hero = state.hero.at;
  const theirs = armyPower(state.army);
  return theirs > 0 && dist(l.at, hero) <= HUNT_SIGHT && dist(home, hero) <= (e.range ?? 120) * 1.5 && armyPower(e.army) >= theirs * 1.2;
}

/** Every roamer and hunter takes its night's walk. Returns the stacks that are now on the hero's doorstep. */
export function moveEnemies(state: GameState, map: MapModel): { state: GameState; events: GameEvent[]; ambush: string | null } {
  let next = state;
  let seed = state.seed;
  const events: GameEvent[] = [];
  for (const l of state.locations) {
    const e = l.enemy;
    if (!e || l.done || l.kind === 'hideout' || !e.behaviour || e.behaviour === 'guard') continue;
    const home = e.home ?? l.at;
    const range = e.range ?? 120;
    let goal: Point;
    if (hunting(next, l)) goal = next.hero.at;
    else {
      const [a, s1] = roll(seed);
      const [r, s2] = roll(s1);
      seed = s2;
      goal = [home[0] + Math.cos(a * Math.PI * 2) * range * (0.25 + 0.75 * r), home[1] + Math.sin(a * Math.PI * 2) * range * (0.25 + 0.75 * r)];
    }
    // Everyone else stands in the way, the hero included, so nobody walks through anybody.
    const others = standingEnemies(next.locations).filter((o) => o.id !== l.id);
    const grid = gridWithEnemies(map, [...others, { at: [next.hero.at[0], next.hero.at[1] + 6] as Point }]);
    const start = nearestPassable(grid, cellOf(l.at), 3);
    const target = nearestPassable(grid, cellOf(goal), 8);
    if (!start || !target) continue;
    const cells = findPath(grid, start, target);
    if (!cells || cells.length < 2) continue;
    let budget = nightPace(l);
    let at = cellCentre(map, start.y * map.width + start.x);
    const path: Point[] = [];
    for (let k = 1; k < cells.length; k++) {
      const from = cells[k - 1].y * map.width + cells[k - 1].x;
      const to = cells[k].y * map.width + cells[k].x;
      const cost = stepCost(map, from, to);
      const step = cellCentre(map, to);
      // Roamers keep to their territory; even hunters won't chase far beyond it.
      if (cost > budget || dist(home, step) > range * 1.6 || dist(step, next.hero.at) < AMBUSH_REACH * 0.6) break;
      budget -= cost;
      at = step;
      path.push(step);
    }
    if (path.length === 0) continue;
    next = { ...next, locations: next.locations.map((o) => (o.id === l.id ? { ...o, at, enemy: { ...o.enemy!, home } } : o)) };
    events.push({ type: 'enemyMoved', id: l.id, from: l.at, path });
  }
  const ambush = next.locations.find((l) => l.enemy && !l.done && l.enemy.behaviour === 'hunt' && hunting(next, l) && dist(l.at, next.hero.at) <= AMBUSH_REACH);
  // Hunters that fell on the camp rest a few nights, whatever came of it; the others count down.
  const locations = next.locations.map((l) => {
    if (!l.enemy) return l;
    if (l.id === ambush?.id) return { ...l, enemy: { ...l.enemy, rest: 3 } };
    return l.enemy.rest ? { ...l, enemy: { ...l.enemy, rest: l.enemy.rest - 1 } } : l;
  });
  return { state: { ...next, seed, locations }, events, ambush: ambush?.id ?? null };
}
