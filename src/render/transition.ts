import { BAR, MAP_VIEW, SCREEN, type Rect } from './frame';
import { bayer, hash } from './noise';
import { GOLD, INK, LIGHT_LUT, NEUTRAL, SHADOW_LUT } from './palette';

/**
 * How one screen gives way to the next, in the palette, as HoMM2 did it:
 * - `fade`: the picture sinks into the dark in a dither of shadow, and the next one rises out of it;
 * - `dissolve`: the next picture comes in block by block, in a random order;
 * - `clash`: the map darkens, then a gleaming edge sweeps across it like a blade, and the
 *   battlefield behind it flashes as the steel rings.
 * The frame round the picture stays put: only the picture and the bar change.
 */
export type TransitionStyle = 'fade' | 'dissolve' | 'clash';

/** Seconds each takes. All of them are short, and a click skips them. */
export const TRANSITION_TIME: Record<TransitionStyle, number> = { fade: 0.8, dissolve: 0.55, clash: 0.8 };

/** When the next screen is far enough in for its cards to show, as a share of the transition. */
const REVEAL: Record<TransitionStyle, number> = { fade: 0.8, dissolve: 0.5, clash: 0.65 };

/** In a clash, when the blade starts across the map, and when the battlefield is all there. */
const CLASH_BREAK = 0.36;
const CLASH_IN = 0.6;
/** How wide the gleaming edge of the sweep is, in the sweep's order. */
const EDGE = 0.05;

const W = SCREEN.width;
const H = SCREEN.height;

/** Colour tables for sinking into the dark, end to end: step k of colour c is at k * 256 + c. The last step is all ink. */
const DEPTHS = 4;
const DARK = (() => {
  const t = new Uint8Array((DEPTHS + 1) * 256);
  for (let c = 0; c < 256; c++) {
    t[c] = c;
    for (let k = 1; k < DEPTHS; k++) t[k * 256 + c] = SHADOW_LUT[t[(k - 1) * 256 + c]];
    t[DEPTHS * 256 + c] = INK;
  }
  return t;
})();

/** And for a flash of light: the colour itself, then a step brighter and warmer. */
const BRIGHT = (() => {
  const t = new Uint8Array(2 * 256);
  for (let c = 0; c < 256; c++) {
    t[c] = c;
    t[256 + c] = LIGHT_LUT[c];
  }
  return t;
})();

/** The torn parchment's fringe reaches into the picture: it's the same on every screen, so it stays lit. */
const FRINGE = 12;

/**
 * What each screen pixel is: 0 the frame, the same on every screen; 1 the picture that changes (the
 * map view, painting or battlefield, and the bar under it); 2 the picture's edge, where the parchment's
 * torn fringe may reach in. Pixels of 2 that are the same on both screens stay put.
 */
const ZONE = (() => {
  const z = new Uint8Array(W * H);
  for (const r of [MAP_VIEW, BAR] as Rect[]) {
    for (let y = r.y; y < r.y + r.height; y++) {
      for (let x = r.x; x < r.x + r.width; x++) {
        const edge = r === MAP_VIEW && (x - r.x < FRINGE || y - r.y < FRINGE || r.x + r.width - 1 - x < FRINGE || r.y + r.height - 1 - y < FRINGE);
        z[y * W + x] = edge ? 2 : 1;
      }
    }
  }
  return z;
})();

/** Per screen pixel: the ordered-dither threshold, 0 to 1. */
const DITHER = (() => {
  const d = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) d[y * W + x] = bayer(x, y);
  return d;
})();

/**
 * The order in which square blocks of `size` pixels give way, 0 to 1: at random, or with `sweep`,
 * mostly from the top left to the bottom right with a ragged edge. Made once each.
 */
const orders = new Map<string, Float32Array>();
function orderOf(size: number, sweep = 0): Float32Array {
  const key = `${size}/${sweep}`;
  let order = orders.get(key);
  if (!order) {
    order = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const bx = Math.floor(x / size);
        const by = Math.floor(y / size);
        const along = ((bx * size) / W) * 0.6 + ((by * size) / H) * 0.4;
        order[y * W + x] = along * sweep + hash(bx, by, 907 + size) * (1 - sweep);
      }
    }
    orders.set(key, order);
  }
  return order;
}

export class Transition {
  readonly style: TransitionStyle;
  readonly length: number;
  /** Seconds since it began. */
  age = 0;
  /** The screen as it was when the change came. */
  private readonly from: Uint8Array;

  constructor(from: Uint8Array, style: TransitionStyle) {
    this.from = from;
    this.style = style;
    this.length = TRANSITION_TIME[style];
  }

  get progress() {
    return Math.min(1, this.age / this.length);
  }

  get done() {
    return this.age >= this.length;
  }

  /** The next screen is far enough in for its cards. */
  get revealed() {
    return this.progress >= REVEAL[this.style];
  }

  /** Mixes the old screen with `to`, the next screen as it is drawn now, into `out`. */
  compose(to: Uint8Array, out: Uint8Array) {
    const p = this.progress;
    const from = this.from;
    const n = W * H;
    // Outside the picture it's the same frame on every screen: whichever, as long as it's whole.
    out.set(p < 0.5 ? from : to);
    if (this.style === 'dissolve') {
      const order = orderOf(2);
      for (let i = 0; i < n; i++) if (ZONE[i] && order[i] >= p) out[i] = from[i];
    } else if (this.style === 'fade') {
      // Down into the dark over the first half, up out of it over the second.
      const source = p < 0.5 ? from : to;
      const depth = (p < 0.5 ? p / 0.5 : (1 - p) / 0.5) * DEPTHS;
      for (let i = 0; i < n; i++) {
        const z = ZONE[i];
        if (z === 0 || (z === 2 && from[i] === to[i])) continue;
        const k = (depth + DITHER[i]) | 0;
        out[i] = DARK[(k > DEPTHS ? DEPTHS : k) * 256 + source[i]];
      }
    } else {
      const order = orderOf(3, 0.9);
      // The map sinks two steps into shadow. Then a gleaming edge sweeps across it, the battlefield
      // behind it a step brighter, and the flash fades as it settles.
      const sink = Math.min(1, p / CLASH_BREAK) * 2;
      const swept = Math.max(0, Math.min(1, (p - CLASH_BREAK) / (CLASH_IN - CLASH_BREAK))) * (1 + EDGE * 2) - EDGE;
      const flash = p < CLASH_IN ? 1 : Math.max(0, 1 - (p - CLASH_IN) / (1 - CLASH_IN));
      for (let i = 0; i < n; i++) {
        const z = ZONE[i];
        if (z === 0) continue;
        if (z === 2 && from[i] === to[i]) out[i] = to[i];
        else if (order[i] < swept) out[i] = BRIGHT[((flash + DITHER[i]) | 0) * 256 + to[i]];
        else if (order[i] < swept + EDGE) out[i] = order[i] - swept < EDGE * DITHER[i] ? NEUTRAL[7] : GOLD[6];
        else {
          const k = (sink + DITHER[i]) | 0;
          out[i] = DARK[(k > 2 ? 2 : k) * 256 + from[i]];
        }
      }
    }
  }
}
