/** Pixel coordinates on the 14 x 14 tile look-test map (32 px tiles, so 448 x 448). */
export type Point = readonly [number, number];

export const TILE = 32;
export const MAP_TILES = 14;
export const MAP_PX = TILE * MAP_TILES;

/** Control points, smoothed into a curve. Runs north to south, off both edges. */
export const RIVER: Point[] = [
  [300, -16], [292, 40], [308, 92], [332, 140], [322, 190], [302, 236],
  [296, 282], [312, 330], [328, 378], [314, 420], [302, 470],
];

/** From the castle gate east over the bridge and off the right edge. */
export const ROAD: Point[] = [
  [110, 256], [150, 266], [200, 262], [252, 258], [300, 258], [348, 262], [398, 250], [466, 244],
];

/** Bottom-centre anchors. */
export const CASTLE: Point = [108, 252];
export const HERO: Point = [240, 266];
export const MOUNTAINS = [
  { at: [92, 128] as Point, width: 150, height: 104, seed: 3 },
  { at: [210, 84] as Point, width: 96, height: 68, seed: 8 },
];
/** Tree clusters: centre, radius, count and kind. */
export const FORESTS = [
  { at: [400, 70] as Point, radius: 62, count: 30, pine: false, seed: 1 },
  { at: [420, 380] as Point, radius: 56, count: 22, pine: true, seed: 2 },
  { at: [70, 390] as Point, radius: 64, count: 26, pine: false, seed: 4 },
  { at: [236, 150] as Point, radius: 22, count: 4, pine: false, seed: 5 },
  { at: [186, 400] as Point, radius: 20, count: 3, pine: true, seed: 6 },
];
export const CHEST: Point = [196, 336];
export const GOLD_PILE: Point = [406, 300];
