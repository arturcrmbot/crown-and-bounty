import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { gridSize, isExplored, revealDisc, type Explored } from '../rules/map/fog';
import { CELL } from '../rules/map/model';
import { newGame } from '../rules/scenario';
import { FogMask } from './fog';

const { width, height } = ALDMOOR;
const cols = gridSize(ALDMOOR).width;
const rows = gridSize(ALDMOOR).height;

/** Every pixel of a cell, as the mask has it. */
const pixelsOf = (fog: FogMask, cell: number) => {
  const out: number[] = [];
  const cx = (cell % cols) * CELL;
  const cy = Math.floor(cell / cols) * CELL;
  for (let y = cy; y < Math.min(height, cy + CELL); y++) for (let x = cx; x < Math.min(width, cx + CELL); x++) out.push(fog.mask[y * width + x]);
  return out;
};

/** How many cells off the nearest explored cell is, as far as `reach` (or reach + 1 if none is). */
function cellsOff(bits: Explored, cell: number, reach: number): number {
  const cx = cell % cols;
  const cy = Math.floor(cell / cols);
  let best = reach + 1;
  for (let y = Math.max(0, cy - reach); y <= Math.min(rows - 1, cy + reach); y++) {
    for (let x = Math.max(0, cx - reach); x <= Math.min(cols - 1, cx + reach); x++) {
      if (isExplored(bits, y * cols + x)) best = Math.min(best, Math.max(Math.abs(x - cx), Math.abs(y - cy)));
    }
  }
  return best;
}

/** Aldmoor as the hero finds it, and after riding west a way along the King's road. */
function ridden(): Explored {
  let bits = newGame(1066).explored;
  for (let x = 3000; x > 2500; x -= 16) bits = revealDisc(bits, ALDMOOR, x, 1000 - (3000 - x) * 0.2, 150).bits;
  return bits;
}

describe('the fog on the map', () => {
  it('never lies over land the hero has seen, not even at its edge: every pixel of every explored cell is clear', () => {
    for (const bits of [newGame(1066).explored, ridden()]) {
      const fog = new FogMask(width, height, bits);
      let explored = 0;
      for (let cell = 0; cell < cols * rows; cell++) {
        if (!isExplored(bits, cell)) continue;
        explored++;
        expect(pixelsOf(fog, cell).every((v) => v === 0), `cell ${cell}`).toBe(true);
      }
      expect(explored).toBeGreaterThan(3000);
    }
  });

  it('covers the land he hasn\u2019t seen, with a soft edge a few cells wide that lies over it, not over what he has seen', () => {
    const bits = ridden();
    const fog = new FogMask(width, height, bits);
    let edge = 0;
    for (let cell = 0; cell < cols * rows; cell++) {
      if (isExplored(bits, cell)) continue;
      const off = cellsOff(bits, cell, 4);
      const pixels = pixelsOf(fog, cell);
      // Four cells out and more, it's all fog; next to explored land, it's thinning out.
      if (off > 4) expect(pixels.every((v) => v === 1), `cell ${cell}`).toBe(true);
      if (off === 1) {
        edge++;
        expect(pixels.some((v) => v === 0), `cell ${cell}`).toBe(true);
      }
    }
    expect(edge).toBeGreaterThan(200);
  });

  it('says a point is fogged exactly where the rules say the land is unexplored', () => {
    const bits = ridden();
    const fog = new FogMask(width, height, bits);
    for (let y = 3; y < height; y += 37) {
      for (let x = 5; x < width; x += 29) expect(fog.isFogged(x, y), `${x}, ${y}`).toBe(!isExplored(bits, Math.floor(y / CELL) * cols + Math.floor(x / CELL)));
    }
    expect(fog.isFogged(-5, 10)).toBe(false);
  });

  it('clears round what he has just seen as if it were laid afresh, however far he has ridden', () => {
    let bits = newGame(1066).explored;
    const fog = new FogMask(width, height, bits);
    for (const [x, y, r] of [[2900, 980, 150], [2860, 960, 150], [1632, 1200, 90], [0, 0, 150], [3190, 2390, 200]]) {
      bits = revealDisc(bits, ALDMOOR, x, y, r).bits;
      fog.reveal(bits, x, y, r);
    }
    const fresh = new FogMask(width, height, bits).mask;
    let differ = 0;
    for (let i = 0; i < fresh.length; i++) if (fresh[i] !== fog.mask[i]) differ++;
    expect(differ).toBe(0);
  });

  it('never clouds over again: what is clear stays clear as he sees more', () => {
    let bits = newGame(1066).explored;
    const fog = new FogMask(width, height, bits);
    let before = fog.mask.slice();
    for (let x = 3000; x > 2000; x -= 100) {
      bits = revealDisc(bits, ALDMOOR, x, 1000, 150).bits;
      fog.reveal(bits, x, 1000, 150);
      let clouded = 0;
      for (let i = 0; i < before.length; i++) if (before[i] === 0 && fog.mask[i] === 1) clouded++;
      expect(clouded, `at ${x}`).toBe(0);
      before = fog.mask.slice();
    }
  });
});
