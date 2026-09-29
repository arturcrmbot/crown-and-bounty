import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../../content/aldmoor';
import { FENMARCH } from '../../content/fenmarch';
import { buildMap, CELL } from './model';
import { approachIn, findPath, nearestPassable, pathIn, reachFrom, type Cell, type Grid } from './pathfinding';

/** What a route costs, step by step, as the rules charge for it. */
function costOf(grid: Grid, cells: Cell[]): number {
  let total = 0;
  for (let k = 1; k < cells.length; k++) {
    const a = cells[k - 1].y * grid.width + cells[k - 1].x;
    const b = cells[k].y * grid.width + cells[k].x;
    const diagonal = cells[k].x !== cells[k - 1].x && cells[k].y !== cells[k - 1].y;
    total += (diagonal ? Math.SQRT2 : 1) * (grid.cost[a] + grid.cost[b]) * 0.5;
  }
  return total;
}

describe('finding the way', () => {
  for (const province of [ALDMOOR, FENMARCH]) {
    it(`reads every place's way in ${province.name} off one search, as cheap as A* finds it`, () => {
      const map = buildMap(province);
      const start = nearestPassable(map.grid, { x: Math.floor(province.hero[0] / CELL), y: Math.floor(province.hero[1] / CELL) })!;
      const reach = reachFrom(map.grid, start);
      for (const place of province.locations) {
        const goal = nearestPassable(map.grid, { x: Math.floor(place.at[0] / CELL), y: Math.floor(place.at[1] / CELL) }, 16);
        if (!goal) continue;
        const astar = findPath(map.grid, start, goal);
        const read = pathIn(reach, map.grid.width, goal);
        expect(read === null, place.id).toBe(astar === null);
        if (!astar || !read) continue;
        expect(read[0], place.id).toEqual(start);
        expect(read.at(-1), place.id).toEqual(goal);
        expect(costOf(map.grid, read), place.id).toBeCloseTo(costOf(map.grid, astar), 3);
      }
    });
  }

  it('rides up to a place from the cheaper side, as near it as it can', () => {
    // A wall across a field with a gap at the top: the target sits just past the wall.
    const width = 20;
    const height = 20;
    const cost = new Float32Array(width * height).fill(2);
    for (let y = 2; y < height; y++) cost[y * width + 10] = Infinity;
    const grid = { width, height, cost };
    const reach = reachFrom(grid, { x: 2, y: 18 });
    const near = approachIn(reach, grid, { x: 10, y: 18 }, 3)!;
    expect(near.x).toBeLessThan(10);
    expect(Math.hypot(near.x - 10, near.y - 18)).toBeLessThanOrEqual(1);
  });
});
