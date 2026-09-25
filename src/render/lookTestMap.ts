import { fbm } from './noise';

/**
 * The hand-authored look-test map, in pixels: 40 x 30 tiles of 32 px. Large readable shapes
 * (forests, a mountain range, a river) and a handful of landmarks with detail around them.
 */
export type Point = readonly [number, number];

export const TILE = 32;
export const MAP_WIDTH = 40 * TILE;
export const MAP_HEIGHT = 30 * TILE;

/** North to south, off both edges. It drops over the cliff as a waterfall. */
export const RIVER: Point[] = [
  [900, -20], [872, 70], [904, 170], [880, 270], [848, 350], [828, 420], [812, 480],
  [786, 548], [748, 620], [712, 700], [690, 780], [660, 860], [640, 990],
];

/** A south-facing rock step east of the meadow; the castle road comes down through its gap. */
export const CLIFF: Point[] = [[640, 452], [700, 440], [760, 436], [830, 440], [900, 432], [952, 420]];
export const CLIFF_HEIGHT = 24;

export const PATHS: Point[][] = [
  // Watchtower, past the signpost and the hero, over the bridge to Westmere.
  [[292, 236], [330, 300], [380, 362], [440, 430], [500, 510], [540, 590], [592, 660], [650, 706], [700, 724], [762, 742], [842, 772], [930, 800]],
  // Castle down through the cliff gap to Westmere.
  [[1112, 214], [1080, 282], [1030, 334], [992, 404], [970, 480], [954, 580], [944, 680], [936, 790]],
  // From the signpost south-west into Darkwood.
  [[500, 512], [432, 560], [344, 622], [254, 700], [172, 780], [80, 862]],
  // A spur from the tower path up to the mine.
  [[330, 300], [262, 250], [200, 214], [150, 196]],
];

export const CASTLE: Point = [1120, 212];
export const TOWER: Point = [290, 226];
export const MINE: Point = [150, 196];
export const MILL: Point = [818, 566];
export const VILLAGE = { huts: [[968, 772], [1016, 818], [904, 838], [1050, 770]] as Point[], well: [966, 822] as Point };
export const HERO: Point = [546, 612];
export const PATROL: Point = [404, 586];
export const SIGNPOST: Point = [520, 520];
export const CHEST: Point = [458, 702];
export const GOLD_PILE: Point = [640, 560];

/** Crags forming the north-west range, the cliff rim and the eastern ridge: x, foot y, width, height. */
export const CRAGS: [number, number, number, number][] = [
  [60, 110, 120, 86], [170, 90, 130, 96], [290, 104, 120, 84], [400, 80, 128, 92], [520, 96, 110, 76], [610, 70, 90, 64],
  [110, 150, 90, 56], [460, 136, 80, 50],
  [236, 262, 50, 32], [346, 256, 40, 26],
  [676, 444, 46, 30], [744, 436, 36, 24], [916, 426, 44, 30],
  [1236, 360, 60, 46], [1206, 470, 54, 40],
];

/** Forest masses as ellipses: centre, radii. */
const FORESTS: [number, number, number, number][] = [
  [140, 560, 200, 230],
  [1010, 110, 100, 90],
  [1140, 670, 170, 170],
  [420, 930, 250, 100],
  [700, 300, 78, 56],
  [1236, 150, 70, 90],
];

/** Lone trees placed on purpose: x, y, pine or not. */
export const TREES: [number, number, boolean][] = [
  [1040, 250, false], [1188, 262, false], [1172, 290, true],
  [1000, 760, false], [884, 790, false], [1080, 842, true],
  [478, 694, false], [612, 520, false], [872, 604, true], [884, 522, true], [380, 420, false],
];

/** Boulders placed on purpose: x, y, size. */
export const ROCKS: [number, number, number][] = [
  [258, 244, 8], [320, 250, 6], [270, 276, 5], [188, 222, 7], [206, 236, 5], [620, 610, 5], [960, 540, 6], [1062, 300, 5],
];

/** How much forest wants to grow here: above one half means woodland. */
export function forestAmount(x: number, y: number): number {
  let amount = 0;
  for (const [cx, cy, rx, ry] of FORESTS) {
    const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
    amount = Math.max(amount, 1.05 - d * 0.55);
  }
  return amount + (fbm(x / 40, y / 40, 2, 61) - 0.5) * 0.3;
}

/** Where the hero has already been: along the roads from the castle, and around him. */
export const EXPLORED = {
  trails: [PATHS[1], PATHS[0].slice(4)],
  trailRadius: 120,
  discs: [[CASTLE[0], CASTLE[1], 170], [HERO[0], HERO[1], 190]] as [number, number, number][],
};
