import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../../content/aldmoor';
import { buildMap, CELL, cellIndex, Terrain } from './model';
import { findPath, nearestPassable, passable } from './pathfinding';

const map = buildMap(ALDMOOR);
const cellOf = (x: number, y: number) => ({ x: Math.floor(x / CELL), y: Math.floor(y / CELL) });
const terrainAt = (x: number, y: number) => map.terrain[cellIndex(map, x, y)];

describe('the logical map of Aldmoor', () => {
  it('lets the hero start on open ground', () => {
    const { x, y } = cellOf(...ALDMOOR.hero);
    expect(passable(map.grid, x, y)).toBe(true);
  });

  it('can reach every place from the start', () => {
    const start = cellOf(...ALDMOOR.hero);
    for (const place of ALDMOOR.locations) {
      const goal = nearestPassable(map.grid, cellOf(...place.at), 16);
      expect(goal, place.id).not.toBeNull();
      expect(findPath(map.grid, start, goal!), place.id).not.toBeNull();
    }
  });

  it('starts the hero at the east edge, on the King\u2019s road', () => {
    expect(ALDMOOR.hero[0]).toBeGreaterThan(ALDMOOR.width - 200);
    expect(terrainAt(...ALDMOOR.hero)).toBe(Terrain.Road);
  });

  it('is 100 by 75 tiles, so a day on a road crosses about a third of it', () => {
    expect([ALDMOOR.width / 32, ALDMOOR.height / 32]).toEqual([100, 75]);
    expect((150 * CELL) / ALDMOOR.width).toBeGreaterThan(0.3);
    expect((150 * CELL) / ALDMOOR.width).toBeLessThan(0.4);
  });

  it('blocks the river from edge to edge, but for the old bridge and the ford', () => {
    expect(terrainAt(1799, 100)).toBe(Terrain.Water);
    expect(terrainAt(1632, 1200)).toBe(Terrain.Water);
    expect(terrainAt(1456, 2080)).toBe(Terrain.Water);
    const bridges = [...map.terrain].filter((t) => t === Terrain.Bridge).length;
    expect(bridges).toBeGreaterThan(0);
    expect(bridges).toBeLessThan(12);
    // The ford wades: slower than a road.
    expect(terrainAt(1769, 360)).toBe(Terrain.Ford);
    expect(map.grid.cost[cellIndex(map, 1769, 360)]).toBe(2);
    // Nothing else crosses: the east bank at the top of the map can't be reached from the west but by those two.
    const shut = { ...map.grid, cost: map.grid.cost.map((c, i) => (map.terrain[i] === Terrain.Bridge || map.terrain[i] === Terrain.Ford ? Infinity : c)) };
    expect(findPath(shut, cellOf(3100, 1048), cellOf(1000, 800))).toBeNull();
  });

  it('blocks the forest and speeds up the roads', () => {
    expect(terrainAt(300, 1720)).toBe(Terrain.Forest);
    expect(terrainAt(2700, 2190)).toBe(Terrain.Forest);
    expect(map.grid.cost[cellIndex(map, 2900, 990)]).toBe(1);
    expect(map.grid.cost[cellIndex(map, 3000, 1300)]).toBe(2);
  });

  it('grows pines in Darkwood and mostly oaks in the King\u2019s chase', () => {
    const share = (x0: number, y0: number, x1: number, y1: number) => {
      const here = map.trees.filter((t) => t.x >= x0 && t.x < x1 && t.y >= y0 && t.y < y1);
      return here.filter((t) => t.kind === 'pine').length / here.length;
    };
    expect(share(100, 1600, 700, 2300)).toBeGreaterThan(0.85);
    expect(share(2400, 2100, 3100, 2400)).toBeLessThan(0.5);
  });

  it('plants trees only in the forest', () => {
    expect(map.trees.length).toBeGreaterThan(500);
    expect(map.trees.every((t) => terrainAt(t.x, t.y) === Terrain.Forest)).toBe(true);
  });

  it('is the same every time', () => {
    const again = buildMap(ALDMOOR);
    expect(again.terrain).toEqual(map.terrain);
    expect(again.trees).toEqual(map.trees);
  });
});
