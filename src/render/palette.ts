/**
 * One 256-colour palette for the whole screen, as in HoMM2. Index 0 is "transparent" in sprites.
 * Ramps run dark to light and hue-shift: shadows lean blue, lights lean yellow.
 */
const hexes: string[] = ['#000000'];

function ramp(...colors: string[]): number[] {
  const first = hexes.length;
  hexes.push(...colors);
  return colors.map((_, i) => first + i);
}

export const INK = ramp('#0b0a10')[0];
export const NEUTRAL = ramp('#1a1620', '#2c2632', '#433c48', '#5e5664', '#7c7482', '#a29aa6', '#cdc6cf', '#f2eef2');
export const GRASS = ramp('#15300e', '#1c4212', '#265816', '#316f1b', '#3e8621', '#4f9c28', '#66b132', '#84c443', '#a8d65e');
export const LEAF = ramp('#0b2210', '#113216', '#17441b', '#1f5820', '#2a6d26', '#38822e', '#4b9836', '#65ae41', '#89c653');
export const DIRT = ramp('#2e1c0e', '#472c16', '#61401f', '#7b552a', '#956c38', '#ae8649', '#c6a262', '#dcbe82');
export const SAND = ramp('#5e4526', '#7c6036', '#9a7c48', '#b6985e', '#d0b47a', '#e6d09c');
export const ROCK = ramp('#1e1612', '#30231b', '#453325', '#5c4530', '#74583c', '#8e6f4d', '#a88962', '#c2a67e', '#dcc6a2');
export const STONE = ramp('#26262f', '#383843', '#4c4c59', '#62626f', '#7b7b89', '#9696a3', '#b3b3bf', '#d3d3dc');
export const WOOD = ramp('#28160a', '#40230f', '#5b3415', '#78481e', '#955e29', '#b07838', '#c8944e');
export const BLUE = ramp('#0d1546', '#15226a', '#1f3390', '#2b48b4', '#3f64d2', '#6088e6', '#90b0f6');
export const RED = ramp('#340808', '#581010', '#82191a', '#ab291f', '#d2432b', '#ec6f48', '#f8a276');
export const GOLD = ramp('#482c06', '#6e460c', '#986612', '#c28a1c', '#e0ae2c', '#f2ce50', '#fbea96');
export const SKIN = ramp('#5c3220', '#8c5234', '#ba7a4e', '#dea878', '#f4d0a4');
export const WATER = ramp('#081440', '#0d1e5a', '#132a74', '#1b3990', '#244aa8', '#305ebe', '#3f74d0', '#5a90e0', '#86b4ee', '#c4e0fa');

/** Colours that rotate every tick. Water pixels use them to shimmer and flow, like HoMM2's palette cycling. */
export const CYCLE_DEEP = ramp('#132a74', '#152e7c', '#1a3790', '#1e3f9c', '#1a3790', '#152e7c');
export const CYCLE_SHALLOW = ramp('#244aa8', '#2952b0', '#3a6cca', '#7eaeec', '#3a6cca', '#2952b0');
const CYCLES = [CYCLE_DEEP, CYCLE_SHALLOW];

export const PALETTE_SIZE = hexes.length;

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const COLORS = hexes.map(rgb);

/** Packs the palette as little-endian RGBA words, ready to write into ImageData. */
export function paletteWords(tick: number): Uint32Array {
  const words = new Uint32Array(256);
  COLORS.forEach(([r, g, b], i) => (words[i] = (255 << 24) | (b << 16) | (g << 8) | r));
  for (const cycle of CYCLES) {
    cycle.forEach((index, i) => {
      const [r, g, b] = COLORS[cycle[(i - tick + cycle.length * 1000) % cycle.length]];
      words[index] = (255 << 24) | (b << 16) | (g << 8) | r;
    });
  }
  return words;
}

function nearest(r: number, g: number, b: number, exclude: Set<number>): number {
  let best = 1;
  let bestDistance = Infinity;
  COLORS.forEach(([pr, pg, pb], i) => {
    if (i === 0 || exclude.has(i)) return;
    const distance = 2 * (pr - r) ** 2 + 4 * (pg - g) ** 2 + 3 * (pb - b) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  });
  return best;
}

const cycling = new Set(CYCLES.flat());

/** For each colour, the palette colour of the same thing in shadow: darker and a little bluer. */
export const SHADOW_LUT = new Uint8Array(256).map((_, i) => {
  if (i >= COLORS.length) return i;
  if (cycling.has(i)) return WATER[1];
  const [r, g, b] = COLORS[i];
  return nearest(r * 0.52, g * 0.56, b * 0.7 + 8, cycling);
});

/** The palette colour closest to an RGB value, for the minimap. */
export const nearestColor = (r: number, g: number, b: number) => nearest(r, g, b, cycling);
export const colorOf = (index: number) => COLORS[index];
