import type { Province } from '../../content/types';
import { nearest, smooth, type Point } from './geometry';
import { CELL } from './model';

/**
 * Which walk-grid cells the hero has seen, as a bitset of 32-bit words. Plain numbers, so a
 * save is just JSON.
 */
export type Explored = number[];

export const gridSize = (province: Province) => ({ width: Math.ceil(province.width / CELL), height: Math.ceil(province.height / CELL) });

export const isExplored = (bits: Explored, i: number) => ((bits[i >>> 5] >>> (i & 31)) & 1) === 1;

function setBit(bits: Explored, i: number) {
  bits[i >>> 5] |= 1 << (i & 31);
}

/** Marks every cell whose centre is within `radius` pixels of (x, y). Returns new bits and whether anything changed. */
export function revealDisc(bits: Explored, province: Province, x: number, y: number, radius: number): { bits: Explored; changed: boolean } {
  const { width, height } = gridSize(province);
  const next = bits.slice();
  let changed = false;
  const c0 = Math.max(0, Math.floor((x - radius) / CELL));
  const c1 = Math.min(width - 1, Math.floor((x + radius) / CELL));
  const r0 = Math.max(0, Math.floor((y - radius) / CELL));
  const r1 = Math.min(height - 1, Math.floor((y + radius) / CELL));
  for (let cy = r0; cy <= r1; cy++) {
    for (let cx = c0; cx <= c1; cx++) {
      const i = cy * width + cx;
      if (isExplored(next, i)) continue;
      if (Math.hypot(cx * CELL + CELL / 2 - x, cy * CELL + CELL / 2 - y) > radius) continue;
      setBit(next, i);
      changed = true;
    }
  }
  return { bits: next, changed };
}

/** What the hero has seen when the commission starts: along the trails and inside the discs. */
export function startingExplored(province: Province): Explored {
  const { width, height } = gridSize(province);
  const bits: Explored = new Array(Math.ceil((width * height) / 32)).fill(0);
  const trails = province.explored.trails.map((t) => smooth(t));
  for (let cy = 0; cy < height; cy++) {
    for (let cx = 0; cx < width; cx++) {
      const p: Point = [cx * CELL + CELL / 2, cy * CELL + CELL / 2];
      const onTrail = trails.some((t) => nearest(t, p[0], p[1]).d < province.explored.trailRadius);
      const inDisc = province.explored.discs.some(([x, y, r]) => Math.hypot(p[0] - x, p[1] - y) < r);
      if (onTrail || inDisc) setBit(bits, cy * width + cx);
    }
  }
  return bits;
}
