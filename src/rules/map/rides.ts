import type { Point } from './geometry';
import { CELL, Terrain, type MapModel } from './model';
import { nearestPassable, reachFrom, type Cell } from './pathfinding';

/**
 * How far a player rides between things worth stopping for (#124). Artur's rule: from anywhere a
 * player would ride, something worth stopping for is less than a day away, and along the roads
 * there's something about every half day.
 *
 * A player rides from one thing to another the cheapest way, so the ground he rides is every such
 * way, between every two things (the roads, mostly, and the tracks across open land to what isn't on
 * one). From every spot of it the nearest thing is some ride away, and any ride between two things
 * that passes there is at least twice that: from the last thing to the spot, and on to the next. So
 * twice the furthest any ridden spot is from the nearest thing is the longest ride between things,
 * wherever the things are evenly spread; and wherever a player is, something is at most half that away.
 */

/** Anything with a place on the map, for measuring. */
export type Thing = { id: string; at: Point };

/** The ridden spot furthest from the nearest thing, in some stretch of the map. */
export type Gap = {
  /** The ride from there to the nearest thing, in movement: a day is 150. A ride between things through there is twice this. */
  cost: number;
  at: Point;
  /** The thing nearest it. */
  nearest: string;
};

export type Rides = {
  /** The ride from each cell to the nearest thing: Infinity where nobody can ride. */
  near: Float32Array;
  /** Whether each cell is on the cheapest way between some two things. */
  ridden: Uint8Array;
  /** The ridden spot furthest from the nearest thing, of those `where` holds for (by where it is, and whether it's on a road). */
  gap(where: (at: Point, road: boolean) => boolean): Gap | null;
};

const onRoad = (t: number) => t === Terrain.Road || t === Terrain.Bridge || t === Terrain.Ford;

/** The ground ridden between `things` on this map, at every hero's own costs, and how far each spot of it is from the nearest. */
export function measureRides(map: MapModel, things: readonly Thing[]): Rides {
  const { grid, terrain, width } = map;
  const cellOf = ([x, y]: Point): Cell => ({ x: Math.floor(x / CELL), y: Math.floor(y / CELL) });
  const seeds = things.map((t) => nearestPassable(grid, cellOf(t.at), 16));
  const at = seeds.map((s) => (s ? s.y * width + s.x : -1));
  const reach = reachFrom(grid, seeds.filter((s): s is Cell => s !== null));
  const near = reach.g;
  // Which thing is nearest each cell: the one its way back leads to.
  const owner = new Int32Array(near.length).fill(-2);
  at.forEach((cell, i) => cell >= 0 && (owner[cell] = i));
  const nearestTo = (cell: number): number => {
    const trail: number[] = [];
    let c = cell;
    while (owner[c] === -2 && reach.from[c] >= 0) {
      trail.push(c);
      c = reach.from[c];
    }
    const found = owner[c] === -2 ? -1 : owner[c];
    for (const t of trail) owner[t] = found;
    return found;
  };

  const ridden = new Uint8Array(near.length);
  const stamp = new Int32Array(near.length).fill(-1);
  for (let i = 0; i < things.length; i++) {
    if (at[i] < 0) continue;
    const from = reachFrom(grid, seeds[i]!).from;
    // The cheapest ways from here to every other thing make a tree: each way back stops where it meets one marked already.
    for (let j = i + 1; j < things.length; j++) {
      if (at[j] < 0 || !Number.isFinite(near[at[j]])) continue;
      for (let c = at[j]; c >= 0 && stamp[c] !== i; c = from[c]) {
        stamp[c] = i;
        ridden[c] = 1;
      }
    }
  }

  return {
    near,
    ridden,
    gap(where) {
      let best: Gap | null = null;
      for (let c = 0; c < near.length; c++) {
        if (!ridden[c] || !Number.isFinite(near[c]) || (best && near[c] <= best.cost)) continue;
        const p: Point = [(c % width) * CELL + CELL / 2, Math.floor(c / width) * CELL + CELL / 2];
        if (!where(p, onRoad(terrain[c]))) continue;
        best = { cost: near[c], at: p, nearest: things[nearestTo(c)]?.id ?? '' };
      }
      return best;
    },
  };
}
