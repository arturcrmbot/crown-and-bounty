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
export const GRASS = ramp('#1f2c10', '#2c3c13', '#3b4f17', '#4c631a', '#5f771d', '#758c23', '#8ea12d', '#a9b53c', '#c4c853', '#dcd872');
export const PINE = ramp('#08171a', '#0c2322', '#11302b', '#173f33', '#1e5039', '#276340', '#347747', '#468c4f', '#5fa45a');
export const LEAF = ramp('#0b2210', '#113216', '#17441b', '#1f5820', '#2a6d26', '#38822e', '#4b9836', '#65ae41', '#89c653');
export const DIRT = ramp('#34240f', '#4c3617', '#654a20', '#7e5f2b', '#977638', '#ae8d4a', '#c4a562', '#d8be80');
export const SAND = ramp('#5e4526', '#7c6036', '#9a7c48', '#b6985e', '#d0b47a', '#e6d09c');
export const PARCHMENT = ramp('#6a5332', '#8c7148', '#ad9163', '#c6ab7c', '#d9c194', '#e8d4ac', '#f2e4c4');
export const SLATE = ramp('#0e1219', '#161c26', '#1f2733', '#2a3442', '#374353', '#475567', '#5c6c80');
export const ROCK = ramp('#1b1a20', '#2b2a32', '#3f3d46', '#56535c', '#6e6a72', '#88838a', '#a49ea0', '#c0b9b3', '#ddd7cc');
export const EARTH = ramp('#1e1612', '#30231b', '#453325', '#5c4530', '#74583c', '#8e6f4d', '#a88962');
export const STONE = ramp('#26262f', '#383843', '#4c4c59', '#62626f', '#7b7b89', '#9696a3', '#b3b3bf', '#d3d3dc');
export const WOOD = ramp('#28160a', '#40230f', '#5b3415', '#78481e', '#955e29', '#b07838', '#c8944e');
export const BLUE = ramp('#0d1546', '#15226a', '#1f3390', '#2b48b4', '#3f64d2', '#6088e6', '#90b0f6');
export const RED = ramp('#340808', '#581010', '#82191a', '#ab291f', '#d2432b', '#ec6f48', '#f8a276');
export const GOLD = ramp('#482c06', '#6e460c', '#986612', '#c28a1c', '#e0ae2c', '#f2ce50', '#fbea96');
export const SKIN = ramp('#5c3220', '#8c5234', '#ba7a4e', '#dea878', '#f4d0a4');
/** Muted, darkened greens and greys for land not yet explored. */
export const FOG = ramp('#161a17', '#1f2520', '#29302a', '#343c33', '#40493d', '#4c5647', '#5a6452', '#69735e', '#7a836c');
/** Landmarks under fog are drawn as flat shapes in this colour. */
export const SILHOUETTE = ramp('#1b2021')[0];
export const WATER = ramp('#0a1a44', '#10265e', '#173478', '#1f4392', '#2856ac', '#3569c2', '#4a80d4', '#6a9ae2', '#9cc0ee', '#e2eef8');

/** Colours that rotate every tick. Water pixels use them to shimmer and flow, like HoMM2's palette cycling. */
export const CYCLE_DEEP = ramp('#132a74', '#152e7c', '#1a3790', '#1e3f9c', '#1a3790', '#152e7c');
export const CYCLE_SHALLOW = ramp('#244aa8', '#2952b0', '#3a6cca', '#7eaeec', '#3a6cca', '#2952b0');
/** Falling water: mostly white with blue gaps, cycling downwards. */
export const CYCLE_FALL = ramp('#e2eef8', '#b4d2f2', '#6a9ae2', '#e2eef8', '#ffffff', '#9cc0ee');
/** Torch flames: yellow to deep orange, flickering as the palette turns. */
export const CYCLE_FIRE = ramp('#fff2a0', '#ffd24a', '#f59a2a', '#d8581e', '#f59a2a', '#ffd24a');
/** Fen pools: dark peaty water with a slow green glint. */
export const CYCLE_BOG = ramp('#1d2c24', '#21332a', '#28402f', '#335036', '#28402f', '#21332a');
const CYCLES = [CYCLE_DEEP, CYCLE_SHALLOW, CYCLE_FALL, CYCLE_FIRE, CYCLE_BOG];

/** Plum robes and hats, for the witch. Added late, so kept out of the lookup tables below. */
export const PLUM = ramp('#241029', '#3b1a44', '#5a2a66', '#7c4088', '#a466ac');
/** Reeds and fen grass: straw-gold stems. */
export const REED = ramp('#3a3418', '#5a4f22', '#7d6e30', '#a08e44', '#c2ae62');

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
/** Colours the lookup tables never map to: cycling ones, and ramps added after the tables were tuned. */
const excluded = new Set([...cycling, ...PLUM, ...REED]);

/** For each colour, the palette colour of the same thing in shadow: darker and a little bluer. */
export const SHADOW_LUT = new Uint8Array(256).map((_, i) => {
  if (i >= COLORS.length) return i;
  if (CYCLE_BOG.includes(i)) return PINE[0];
  if (cycling.has(i)) return WATER[1];
  const [r, g, b] = COLORS[i];
  return nearest(r * 0.52, g * 0.56, b * 0.7 + 8, excluded);
});

/** Unexplored land: desaturated, darker and a touch blue. */
export const FOG_LUT = new Uint8Array(256).map((_, i) => {
  if (i >= COLORS.length) return i;
  if (i === SILHOUETTE) return i;
  const [r, g, b] = cycling.has(i) && !CYCLE_BOG.includes(i) ? COLORS[WATER[3]] : COLORS[i];
  const luma = 0.3 * r + 0.59 * g + 0.11 * b;
  const mix = (c: number) => (c * 0.45 + luma * 0.55) * 0.78;
  return nearest(mix(r), mix(g), mix(b) + 6, excluded);
});

/** Highlight: the same colour a little brighter and warmer, for reachable hexes. */
export const LIGHT_LUT = new Uint8Array(256).map((_, i) => {
  if (i >= COLORS.length || cycling.has(i)) return i;
  const [r, g, b] = COLORS[i];
  return nearest(Math.min(255, r * 1.22 + 14), Math.min(255, g * 1.22 + 12), Math.min(255, b * 1.12 + 4), excluded);
});

/** Paper grain: a slightly darker, warmer speck of the same colour. */
export const GRAIN_LUT = new Uint8Array(256).map((_, i) => {
  if (i >= COLORS.length || cycling.has(i)) return i;
  const [r, g, b] = COLORS[i];
  const next = nearest(r * 0.84 + 4, g * 0.84 + 2, b * 0.8, excluded);
  return next === i ? SHADOW_LUT[i] : next;
});
