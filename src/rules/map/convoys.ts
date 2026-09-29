/**
 * Convoys (see `Convoy` in state.ts): a cart that keeps to its road, as Pike's grain cart does from
 * Westmere to Grimsby's stockade. It sets out at dawn on payday with a share of the troops who send
 * it, moves on at night, and at the road's end it's gone, its escort back with those who sent it.
 */
import { leads } from '../../content/troops';
import { update, type GameEvent, type GameState } from '../state';
import { nearest, smooth, type Point } from './geometry';
import { standingEnemies } from './model';
import { merge } from './sortie';

/** How far short of the hero standing in its road a convoy stops, and of another band on it: its cart and escort stand clear of them. */
const KEEP = 56;
const CLEAR = 72;
/** Its steps along the road, in pixels. */
const STEP = 8;

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const round = ([x, y]: Point): Point => [Math.round(x), Math.round(y)];

/** A road as the map draws it, and how long it is, worked out once. */
const roads = new WeakMap<readonly Point[], { line: Point[]; length: number }>();
function roadOf(route: readonly Point[]) {
  let road = roads.get(route);
  if (!road) {
    const line = smooth(route);
    let length = 0;
    for (let i = 1; i < line.length; i++) length += dist(line[i - 1], line[i]);
    road = { line, length };
    roads.set(route, road);
  }
  return road;
}

/** The point `s` pixels along a line. */
export function pointAlong(line: readonly Point[], s: number): Point {
  let left = Math.max(0, s);
  for (let i = 1; i < line.length; i++) {
    const d = dist(line[i - 1], line[i]);
    if (left <= d) {
      const t = d ? left / d : 0;
      return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t];
    }
    left -= d;
  }
  return line[line.length - 1];
}

/**
 * Payday's dawn: every convoy off the road sets out from the start of its road, with a share of the
 * troops of those who send it, while they still hold. The payday card says so.
 */
export function setOut(state: GameState): { state: GameState; events: GameEvent[]; lines: string[] } {
  let next = state;
  const events: GameEvent[] = [];
  const lines: string[] = [];
  for (const l of state.locations) {
    const c = l.enemy?.convoy;
    if (!c || !l.done) continue;
    const from = next.locations.find((f) => f.id === c.from);
    if (!from?.enemy || from.done) continue;
    const escort = from.enemy.army.filter((s) => !leads(s.troop)).map((s) => ({ troop: s.troop, count: Math.round(s.count * c.share) })).filter((s) => s.count > 0);
    const left = from.enemy.army.map((s) => ({ ...s, count: s.count - (escort.find((e) => e.troop === s.troop)?.count ?? 0) })).filter((s) => s.count > 0);
    if (!escort.length || !left.length) continue;
    next = update(next, from.id, { enemy: { ...from.enemy, army: left } });
    next = update(next, l.id, { done: false, at: c.route[0], enemy: { ...l.enemy!, army: escort } });
    events.push({ type: 'added', id: l.id });
    lines.push(c.leaves);
  }
  return { state: next, events, lines };
}

/**
 * The night: every convoy on the road goes on along it. It passes through its own people, but stops
 * short of the hero if he stands in its road, and doesn't end the night on top of another band. At
 * the road's end it's gone, and its escort goes back to those who sent it, if they still hold.
 */
export function haul(state: GameState): { state: GameState; events: GameEvent[] } {
  let next = state;
  const events: GameEvent[] = [];
  for (const l of state.locations) {
    const c = l.enemy?.convoy;
    if (!c || l.done) continue;
    const { line, length } = roadOf(c.route);
    const start = nearest(line, l.at[0], l.at[1]).s;
    const hero = next.hero.at;
    let s = start;
    let before = pointAlong(line, s);
    const path: Point[] = [];
    while (s < length && s < start + c.pace) {
      const t = Math.min(length, start + c.pace, s + STEP);
      const p = pointAlong(line, t);
      if (dist(p, hero) < KEEP && dist(p, hero) < dist(before, hero)) break;
      s = t;
      before = p;
      path.push(round(p));
    }
    if (s >= length) {
      const from = next.locations.find((f) => f.id === c.from);
      if (from?.enemy && !from.done) next = update(next, from.id, { enemy: { ...from.enemy, army: merge(from.enemy.army, l.enemy!.army) } });
      next = update(next, l.id, { done: true });
      events.push({ type: 'removed', id: l.id });
      continue;
    }
    const others = standingEnemies(next.locations).filter((o) => o.id !== l.id);
    while (path.length && others.some((o) => dist(o.at, path[path.length - 1]) < CLEAR)) path.pop();
    if (!path.length) continue;
    next = update(next, l.id, { at: path[path.length - 1] });
    events.push({ type: 'enemyMoved', id: l.id, from: l.at, path });
  }
  return { state: next, events };
}
