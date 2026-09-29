import { isExplored, type Explored } from '../rules/map/fog';
import { CELL } from '../rules/map/model';
import { bayer } from './noise';

/** How many cells either side the fog edge blends over. */
const BLUR = 2;

/**
 * Pixel fog built from the rules' explored cells: a soft ramp a few cells wide, dithered like the
 * rest of the art. `mask` is 1 where a pixel is still unexplored.
 */
export class FogMask {
  readonly mask: Uint8Array;
  private readonly soft: Float32Array;
  private readonly cols: number;
  private readonly rows: number;
  private readonly width: number;
  private readonly height: number;

  constructor(width: number, height: number, bits: Explored) {
    this.width = width;
    this.height = height;
    this.cols = Math.ceil(width / CELL);
    this.rows = Math.ceil(height / CELL);
    this.mask = new Uint8Array(width * height);
    this.soft = new Float32Array(this.cols * this.rows);
    this.refresh(bits, 0, 0, this.cols - 1, this.rows - 1);
  }

  /** Recomputes the fog around a point after the hero has seen `radius` pixels round it. */
  reveal(bits: Explored, x: number, y: number, radius: number) {
    const r = Math.ceil(radius / CELL) + BLUR + 1;
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    this.refresh(bits, cx - r, cy - r, cx + r, cy + r);
  }

  isFogged(x: number, y: number) {
    const i = Math.round(y) * this.width + Math.round(x);
    return i >= 0 && i < this.mask.length && this.mask[i] === 1;
  }

  private refresh(bits: Explored, c0: number, r0: number, c1: number, r1: number) {
    const { cols, rows } = this;
    c0 = Math.max(0, c0);
    r0 = Math.max(0, r0);
    c1 = Math.min(cols - 1, c1);
    r1 = Math.min(rows - 1, r1);
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        let dark = 0;
        let count = 0;
        for (let dy = -BLUR; dy <= BLUR; dy++) {
          for (let dx = -BLUR; dx <= BLUR; dx++) {
            const x = Math.min(cols - 1, Math.max(0, cx + dx));
            const y = Math.min(rows - 1, Math.max(0, cy + dy));
            dark += isExplored(bits, y * cols + x) ? 0 : 1;
            count++;
          }
        }
        this.soft[cy * cols + cx] = dark / count;
      }
    }
    const x0 = Math.max(0, c0 * CELL);
    const y0 = Math.max(0, r0 * CELL);
    const x1 = Math.min(this.width, (c1 + 1) * CELL);
    const y1 = Math.min(this.height, (r1 + 1) * CELL);
    for (let y = y0; y < y1; y++) {
      const v = Math.max(0, (y - CELL / 2) / CELL);
      const j = Math.min(rows - 2, Math.floor(v));
      const fy = Math.min(1, v - j);
      const row = y * this.width;
      for (let x = x0; x < x1; ) {
        const u = Math.max(0, (x - CELL / 2) / CELL);
        const i = Math.min(cols - 2, Math.floor(u));
        // The pixels between the same four cells: all clear or all dark when the four agree.
        const end = i === cols - 2 ? x1 : Math.min(x1, CELL / 2 + (i + 1) * CELL);
        const a = this.soft[j * cols + i];
        const b = this.soft[j * cols + i + 1];
        const c = this.soft[(j + 1) * cols + i];
        const d = this.soft[(j + 1) * cols + i + 1];
        if (a === b && b === c && c === d && (a === 0 || a === 1)) {
          this.mask.fill(a, row + x, row + end);
          x = end;
          continue;
        }
        for (; x < end; x++) {
          const fx = Math.min(1, Math.max(0, (x - CELL / 2) / CELL) - i);
          const f = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
          this.mask[row + x] = f > bayer(x, y) ? 1 : 0;
        }
      }
    }
  }
}
