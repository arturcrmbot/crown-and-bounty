import { Dir, type Cell } from './hex';

const c = (col: number, row: number): Cell => ({ col, row });

export const COLS = 7;
export const ROWS = 7;

/** North to south. The first and last cells sit off the map so the river runs off both edges. */
export const RIVER: Cell[] = [c(4, -1), c(4, 0), c(4, 1), c(5, 2), c(4, 3), c(4, 4), c(4, 5), c(4, 6), c(3, 7)];

/** From the castle gate east over the bridge. The first cell is the castle, the last is off the map. */
export const ROAD: Cell[] = [c(1, 2), c(1, 3), c(2, 3), c(3, 3), c(4, 3), c(5, 3), c(6, 3), c(7, 3)];

export const CASTLE = { cell: c(1, 2), gate: Dir.SE };
export const HERO = { cell: c(3, 3), facing: 0.75 };

export type Prop = { model: string; cell: Cell; dx?: number; dz?: number; scale?: number };

const nature = (name: string) => `decoration/nature/${name}`;

export const PROPS: Prop[] = [
  { model: nature('trees_A_large'), cell: c(0, 0) },
  { model: nature('trees_B_medium'), cell: c(1, 0) },
  { model: nature('tree_single_B'), cell: c(2, 0), dx: 0.3, dz: -0.2 },
  { model: nature('rock_single_A'), cell: c(3, 0), dx: -0.4, dz: 0.3 },
  { model: nature('trees_A_medium'), cell: c(5, 0) },
  { model: nature('trees_B_large'), cell: c(6, 0) },
  { model: nature('trees_B_large'), cell: c(0, 1) },
  { model: nature('tree_single_A'), cell: c(1, 1), dx: -0.2, dz: 0.3 },
  { model: nature('rock_single_C'), cell: c(3, 1), dx: 0.2, dz: -0.3 },
  { model: nature('tree_single_A'), cell: c(5, 1), dx: 0.4, dz: 0.2 },
  { model: nature('trees_A_large'), cell: c(6, 1) },
  { model: nature('trees_A_small'), cell: c(0, 2) },
  { model: nature('tree_single_B'), cell: c(3, 2), dx: -0.3, dz: -0.1 },
  { model: nature('trees_B_medium'), cell: c(6, 2) },
  { model: nature('rock_single_B'), cell: c(0, 3), dx: 0.1, dz: 0.2 },
  { model: nature('trees_A_medium'), cell: c(0, 4) },
  { model: nature('tree_single_A'), cell: c(2, 4), dx: 0.5, dz: 0.4 },
  { model: nature('rock_single_D'), cell: c(3, 4), dx: -0.2, dz: 0.3 },
  { model: nature('tree_single_B'), cell: c(5, 4), dx: 0.2, dz: -0.2 },
  { model: nature('trees_B_small'), cell: c(6, 4) },
  { model: nature('trees_B_large'), cell: c(0, 5) },
  { model: nature('trees_A_small'), cell: c(1, 5) },
  { model: nature('tree_single_A'), cell: c(2, 5), dx: -0.3, dz: -0.3 },
  { model: nature('trees_A_medium'), cell: c(5, 5) },
  { model: nature('trees_A_large'), cell: c(6, 5) },
  { model: nature('trees_A_large'), cell: c(0, 6) },
  { model: nature('trees_B_medium'), cell: c(1, 6) },
  { model: nature('rock_single_E'), cell: c(3, 6), dx: 0.3, dz: -0.2 },
  { model: nature('trees_B_large'), cell: c(5, 6) },
  { model: nature('trees_B_medium'), cell: c(6, 6) },
  { model: nature('waterlily_A'), cell: c(4, 5), dx: -0.35, dz: 0.1 },
  { model: nature('waterplant_B'), cell: c(4, 1), dx: 0.45, dz: -0.35 },
];
