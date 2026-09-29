import type { Province } from '../../content/types';
import { nearest, smooth } from './geometry';
import { CELL } from './model';

/**
 * Which walk-grid cells the hero has seen, as a bitset of 32-bit words. Plain numbers, so a
 * save is just JSON.
 */
export type Explored = number[];

/** The walk grid's size in cells for a map `size` pixels big. */
export const gridSize = (size: { width: number; height: number }) => ({ width: Math.ceil(size.width / CELL), height: Math.ceil(size.height / CELL) });

export const isExplored = (bits: Explored, i: number) => ((bits[i >>> 5] >>> (i & 31)) & 1) === 1;

function setBit(bits: Explored, i: number) {
  bits[i >>> 5] |= 1 << (i & 31);
}

/** Marks every cell whose centre is within `radius` pixels of (x, y). Returns new bits and whether anything changed. */
export function revealDisc(bits: Explored, world: { width: number; height: number }, x: number, y: number, radius: number): { bits: Explored; changed: boolean } {
  const { width, height } = gridSize(world);
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

/**
 * What the hero has seen when the commission starts: along the trails and inside the discs. Each
 * stretch of trail and each disc marks only the cells round it, as `nearest` would measure them.
 */
export function startingExplored(province: Province): Explored {
  const { width, height } = gridSize(province);
  const bits: Explored = new Array(Math.ceil((width * height) / 32)).fill(0);
  const radius = province.explored.trailRadius;
  /** Every cell whose centre passes `seen`, within the box round (x0, y0) to (x1, y1). */
  const mark = (x0: number, y0: number, x1: number, y1: number, seen: (x: number, y: number) => boolean) => {
    for (let cy = Math.max(0, Math.floor(y0 / CELL)); cy <= Math.min(height - 1, Math.floor(y1 / CELL)); cy++) {
      for (let cx = Math.max(0, Math.floor(x0 / CELL)); cx <= Math.min(width - 1, Math.floor(x1 / CELL)); cx++) {
        if (seen(cx * CELL + CELL / 2, cy * CELL + CELL / 2)) setBit(bits, cy * width + cx);
      }
    }
  };
  for (const trail of province.explored.trails.map((t) => smooth(t))) {
    for (let i = 0; i < trail.length - 1; i++) {
      const [ax, ay] = trail[i];
      const [bx, by] = trail[i + 1];
      mark(Math.min(ax, bx) - radius, Math.min(ay, by) - radius, Math.max(ax, bx) + radius, Math.max(ay, by) + radius, (x, y) => nearest([trail[i], trail[i + 1]], x, y).d < radius);
    }
  }
  for (const [x, y, r] of province.explored.discs) mark(x - r, y - r, x + r, y + r, (px, py) => Math.hypot(px - x, py - y) < r);
  return bits;
}
