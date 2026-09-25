import { fbm } from './noise';

/** Pixel coordinates on the look-test map: 40 x 30 tiles of 32 px. */
export type Point = readonly [number, number];

export const TILE = 32;
export const MAP_WIDTH = 40 * TILE;
export const MAP_HEIGHT = 30 * TILE;

/** North to south, off both edges. It drops over the cliff as a waterfall. */
export const RIVER: Point[] = [
  [900, -20], [872, 70], [904, 170], [880, 270], [848, 350], [828, 420], [812, 480],
  [786, 548], [748, 620], [712, 700], [690, 780], [660, 860], [640, 990],
];

/** A south-facing rock step across the map; the path from the castle comes down through its gap. */
export const CLIFF: Point[] = [[640, 452], [700, 440], [760, 436], [830, 440], [900, 432], [952, 420]];
export const CLIFF_HEIGHT = 24;

/** Thin winding paths: tower to village over the bridge, castle to village, and a branch south-west. */
export const PATHS: Point[][] = [
  [[292, 236], [330, 300], [380, 362], [440, 430], [500, 510], [540, 590], [592, 660], [650, 706], [700, 724], [762, 742], [842, 772], [930, 800]],
  [[1112, 214], [1080, 282], [1030, 334], [992, 404], [970, 480], [954, 580], [944, 680], [936, 790]],
  [[500, 512], [432, 560], [344, 622], [254, 700], [172, 780], [80, 862]],
];

export const CASTLE: Point = [1120, 212];
export const TOWER: Point = [290, 226];
export const MILL: Point = [874, 566];
export const HUTS: Point[] = [[968, 772], [1012, 820], [904, 836]];
export const HERO: Point = [546, 612];
export const CHEST: Point = [420, 700];
export const GOLD_PILE: Point = [640, 560];

/** Clearings kept free of forest: centre and radius. */
const CLEARINGS: [number, number, number][] = [
  [546, 600, 170], [1120, 200, 120], [290, 220, 80], [874, 560, 70], [960, 800, 110], [420, 700, 60],
];

/** How much forest wants to grow here, 0 to 1. Trees go where this is above one half. */
export function forestAmount(x: number, y: number): number {
  let amount = fbm(x / 150, y / 150, 3, 61) * 1.25 - 0.1;
  for (const [cx, cy, r] of CLEARINGS) {
    const d = Math.hypot(x - cx, y - cy) / r;
    if (d < 1.4) amount -= (1.4 - d) * 0.7;
  }
  return amount;
}
