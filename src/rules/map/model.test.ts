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

  it('blocks the river except at the bridge', () => {
    expect(terrainAt(872, 70)).toBe(Terrain.Water);
    expect(terrainAt(748, 620)).toBe(Terrain.Water);
    const bridges = [...map.terrain].filter((t) => t === Terrain.Bridge).length;
    expect(bridges).toBeGreaterThan(0);
    expect(bridges).toBeLessThan(12);
  });

  it('blocks the forest and speeds up the roads', () => {
    expect(terrainAt(140, 560)).toBe(Terrain.Forest);
    expect(map.grid.cost[cellIndex(map, 440, 430)]).toBe(1);
    expect(map.grid.cost[cellIndex(map, 600, 480)]).toBe(2);
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
