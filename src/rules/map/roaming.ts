/**
 * The map's own life: at night, enemy stacks move. Guards hold their ground. Roamers wander their
 * territory. Hunters wander too, but come for a weaker hero who strays into it. The first night
 * they only pick up his trail: at dawn he is told, and sees them, so he can ride clear, shelter in a
 * town or turn and fight. If he's still in reach the next night, they fall on his camp at dawn. A
 * villain riding out of his lair (`sortie.ts`) hunts him the same way, whatever the odds, and rides
 * home when he can't find him. It all runs on the same walk grid, costs and dice as the hero.
 */
import { TROOPS, leads } from '../../content/troops';
import { armyPower, roll, type GameEvent, type GameState, type Location } from '../state';
import { revealDisc } from './fog';
import type { Point } from './geometry';
import { heroStats } from '../hero';
import { mapOf } from './maps';
import { CELL, cellCentre, cellIndex, gridWithEnemies, standingEnemies, Terrain, type MapModel } from './model';
import { stepCost } from './movement';
import { findPath, nearestPassable } from './pathfinding';

/** How far a hunter notices the hero, and how close is close enough to fall on him. */
export const HUNT_SIGHT = 260;
export const AMBUSH_REACH = 40;
/** How close to a castle or village the hero shelters behind its walls, where nothing comes for him. */
export const SHELTER = 48;

/**
 * Movement points a stack has in a night: its slowest troop sets the pace (a leader keeps up with his
 * men), unless it rides (`pace`). It's always slower than a mounted hero.
 */
export function nightPace(l: Location): number {
  const e = l.enemy!;
  if (e.pace) return e.pace;
  const army = e.army.filter((s) => s.count > 0);
  const men = army.filter((s) => !leads(s.troop));
  return 18 + 3 * Math.min(...(men.length ? men : army).map((s) => TROOPS[s.troop].speed));
}

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cellOf = ([x, y]: Point) => ({ x: Math.floor(x / CELL), y: Math.floor(y / CELL) });

/** Whether the hero is sheltering in a castle or a village tonight. */
export const inTown = (state: GameState) => state.locations.some((l) => (l.kind === 'castle' || l.kind === 'village') && dist(l.at, state.hero.at) <= SHELTER);

/**
 * Whether a hunter comes for the hero tonight: he is near (as far as it can see), inside its
 * territory, weaker (unless it's `bold`), and out in the open, and his scouts aren't shadowing it. A
 * villain's band that has run out of patience comes for nobody: it's going home.
 */
export function hunting(state: GameState, l: Location): boolean {
  const e = l.enemy!;
  if (e.behaviour !== 'hunt' || (e.rest ?? 0) > 0 || e.patience === 0 || inTheWoods(state) || inTown(state) || heroStats(state).shadow) return false;
  const home = e.home ?? l.at;
  const hero = state.hero.at;
  const theirs = armyPower(state.army);
  return theirs > 0 && dist(l.at, hero) <= (e.sight ?? HUNT_SIGHT) && dist(home, hero) <= (e.range ?? 120) * 1.5 && (Boolean(e.bold) || armyPower(e.army) >= theirs * 1.2);
}

/** A ranger among the trees leaves no track that anything on the map can follow. */
function inTheWoods(state: GameState): boolean {
  if (!heroStats(state).forestWalk) return false;
  const map = mapOf(state);
  return map.terrain[cellIndex(map, state.hero.at[0], state.hero.at[1])] === Terrain.Forest;
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
    const hunts = hunting(next, l);
    // A hunter that has only now picked up the trail keeps its distance tonight: the hero gets a day's warning.
    const keep = hunts && !e.trailing ? AMBUSH_REACH * 2 : AMBUSH_REACH * 0.6;
    let goal: Point;
    if (hunts) goal = next.hero.at;
    // A villain's band that can't find the hero rides home.
    else if (e.lair) goal = home;
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
      if (cost > budget || dist(home, step) > range * 1.6 || dist(step, next.hero.at) < keep) break;
      budget -= cost;
      at = step;
      path.push(step);
    }
    if (path.length === 0) continue;
    next = { ...next, locations: next.locations.map((o) => (o.id === l.id ? { ...o, at, enemy: { ...o.enemy!, home } } : o)) };
    events.push({ type: 'enemyMoved', id: l.id, from: l.at, path });
  }
  // Only a hunter that was already on the trail at dawn yesterday falls on the camp.
  const ambush = next.locations.find((l) => l.enemy && !l.done && l.enemy.trailing && hunting(next, l) && dist(l.at, next.hero.at) <= AMBUSH_REACH);
  // Hunters that fell on the camp rest a few nights, whatever came of it; the others count down.
  // Those hunting now are on the trail, and the hero sees them in the morning.
  let explored = next.explored;
  const locations = next.locations.map((l) => {
    const e = l.enemy;
    if (!e) return l;
    if (l.id === ambush?.id) {
      const { trailing: _, ...calm } = e;
      return { ...l, enemy: { ...calm, rest: 3 } };
    }
    const trailing = !l.done && hunting(next, l);
    if (trailing) {
      const seen = revealDisc(explored, next.world, l.at[0], l.at[1], SPOTTED);
      explored = seen.bits;
      if (seen.changed) events.push({ type: 'reveal', at: l.at, radius: SPOTTED });
    }
    if (!trailing && !e.trailing && !e.rest) return l;
    const { rest, trailing: _, ...plain } = e;
    return { ...l, enemy: { ...plain, ...(rest && rest > 1 ? { rest: rest - 1 } : {}), ...(trailing ? { trailing } : {}) } };
  });
  return { state: { ...next, seed, locations, explored }, events, ambush: ambush?.id ?? null };
}

/** How much of the mist lifts round a hunter on the hero's trail, so he can see it coming. */
const SPOTTED = 48;
