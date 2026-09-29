import { isExplored, type Explored } from '../rules/map/fog';
import { CELL } from '../rules/map/model';
import { bayer } from './noise';

/** How far the fog's soft edge reaches out over the land the hero hasn't seen, in pixels. */
const EDGE = 24;
/** How many cells off the nearest explored cell can be and still matter to the edge. */
const REACH = Math.ceil(EDGE / CELL) + 1;
/** Each cell's distance from explored land is counted this far, in cells: past it, it's all fog. */
const FAR = REACH + 0.5;

/**
 * Pixel fog built from the rules' explored cells, as in HoMM2: land the hero has seen is clear, all
 * of it, for good, and the fog's soft edge lies over the land he hasn't, dithered like the rest of
 * the art. `mask` is 1 where a pixel is under the fog.
 */
export class FogMask {
  readonly mask: Uint8Array;
  /** How far each cell's centre is out from explored land, in cells: -0.5 for an explored cell. */
  private readonly edge: Float32Array;
  private readonly cols: number;
  private readonly rows: number;
  private readonly width: number;
  private readonly height: number;
  private bits: Explored;
  /** Room for the distance count round a reveal. */
  private scratch = new Float32Array(0);

  constructor(width: number, height: number, bits: Explored) {
    this.width = width;
    this.height = height;
    this.cols = Math.ceil(width / CELL);
    this.rows = Math.ceil(height / CELL);
    this.mask = new Uint8Array(width * height);
    this.edge = new Float32Array(this.cols * this.rows);
    this.bits = bits;
    this.refresh(0, 0, this.cols - 1, this.rows - 1);
  }

  /** Clears the fog round a point after the hero has seen `radius` pixels round it: `bits` is what he has seen now. */
  reveal(bits: Explored, x: number, y: number, radius: number) {
    this.bits = bits;
    const r = Math.ceil(radius / CELL) + REACH + 1;
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    this.refresh(cx - r, cy - r, cx + r, cy + r);
  }

  /** Whether a map point is on land the hero has never seen. The fog's soft edge is only paint. */
  isFogged(x: number, y: number) {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return false;
    return !isExplored(this.bits, cy * this.cols + cx);
  }

  private refresh(c0: number, r0: number, c1: number, r1: number) {
    const { cols, rows, bits, edge } = this;
    c0 = Math.max(0, c0);
    r0 = Math.max(0, r0);
    c1 = Math.min(cols - 1, c1);
    r1 = Math.min(rows - 1, r1);
    // How far each cell is from the nearest explored one, counted over the cells round these too.
    const x0 = Math.max(0, c0 - REACH);
    const y0 = Math.max(0, r0 - REACH);
    const w = Math.min(cols - 1, c1 + REACH) - x0 + 1;
    const h = Math.min(rows - 1, r1 + REACH) - y0 + 1;
    if (this.scratch.length < w * h) this.scratch = new Float32Array(w * h);
    const d = this.scratch;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) d[y * w + x] = isExplored(bits, (y0 + y) * cols + x0 + x) ? 0 : FAR;
    }
    // Two sweeps, straight steps 1 and diagonal ones the square root of 2: near enough a circle's distance.
    const D = Math.SQRT2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let v = d[i];
        if (v === 0) continue;
        if (x > 0) v = Math.min(v, d[i - 1] + 1);
        if (y > 0) {
          v = Math.min(v, d[i - w] + 1);
          if (x > 0) v = Math.min(v, d[i - w - 1] + D);
          if (x < w - 1) v = Math.min(v, d[i - w + 1] + D);
        }
        d[i] = v;
      }
    }
    for (let y = h - 1; y >= 0; y--) {
      for (let x = w - 1; x >= 0; x--) {
        const i = y * w + x;
        let v = d[i];
        if (v === 0) continue;
        if (x < w - 1) v = Math.min(v, d[i + 1] + 1);
        if (y < h - 1) {
          v = Math.min(v, d[i + w] + 1);
          if (x < w - 1) v = Math.min(v, d[i + w + 1] + D);
          if (x > 0) v = Math.min(v, d[i + w - 1] + D);
        }
        d[i] = v;
      }
    }
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) edge[cy * cols + cx] = Math.min(FAR, d[(cy - y0) * w + cx - x0]) - 0.5;
    }
    // Between the centres of four cells, the distance goes smoothly from one to the next.
    const px0 = Math.max(0, c0 * CELL);
    const py0 = Math.max(0, r0 * CELL);
    const px1 = Math.min(this.width, (c1 + 1) * CELL);
    const py1 = Math.min(this.height, (r1 + 1) * CELL);
    const full = EDGE / CELL;
    for (let y = py0; y < py1; y++) {
      const v = Math.max(0, (y - CELL / 2) / CELL);
      const j = Math.min(rows - 2, Math.floor(v));
      const fy = Math.min(1, v - j);
      const row = y * this.width;
      const cellRow = Math.floor(y / CELL) * cols;
      for (let x = px0; x < px1; ) {
        const u = Math.max(0, (x - CELL / 2) / CELL);
        const i = Math.min(cols - 2, Math.floor(u));
        // The pixels between the same four cells: all clear or all fog when the four agree.
        const end = i === cols - 2 ? px1 : Math.min(px1, CELL / 2 + (i + 1) * CELL);
        const a = edge[j * cols + i];
        const b = edge[j * cols + i + 1];
        const c = edge[(j + 1) * cols + i];
        const e = edge[(j + 1) * cols + i + 1];
        if (a < 0 && b < 0 && c < 0 && e < 0) {
          this.mask.fill(0, row + x, row + end);
          x = end;
          continue;
        }
        if (a >= full && b >= full && c >= full && e >= full) {
          this.mask.fill(1, row + x, row + end);
          x = end;
          continue;
        }
        for (; x < end; x++) {
          if (edge[cellRow + Math.floor(x / CELL)] < 0) {
            this.mask[row + x] = 0;
            continue;
          }
          const fx = Math.min(1, Math.max(0, (x - CELL / 2) / CELL) - i);
          const out = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy;
          this.mask[row + x] = out / full > bayer(x, y) ? 1 : 0;
        }
      }
    }
  }
}
