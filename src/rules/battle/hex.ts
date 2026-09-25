/** The battlefield: 11 x 9 hexes, odd rows shifted half a hex right, as in HoMM2. */
export const COLS = 11;
export const ROWS = 9;
export const HEXES = COLS * ROWS;

export const hexIndex = (col: number, row: number) => row * COLS + col;
export const colOf = (i: number) => i % COLS;
export const rowOf = (i: number) => Math.floor(i / COLS);
export const onField = (col: number, row: number) => col >= 0 && row >= 0 && col < COLS && row < ROWS;

const EVEN: [number, number][] = [[1, 0], [-1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]];
const ODD: [number, number][] = [[1, 0], [-1, 0], [0, -1], [1, -1], [0, 1], [1, 1]];

export function neighbours(i: number): number[] {
  const col = colOf(i);
  const row = rowOf(i);
  return (row % 2 === 0 ? EVEN : ODD).filter(([dc, dr]) => onField(col + dc, row + dr)).map(([dc, dr]) => hexIndex(col + dc, row + dr));
}

/** Steps between two hexes, ignoring anything in the way. */
export function distance(a: number, b: number): number {
  const cube = (i: number) => {
    const row = rowOf(i);
    const x = colOf(i) - (row - (row & 1)) / 2;
    return [x, row, -x - row] as const;
  };
  const [ax, ay, az] = cube(a);
  const [bx, by, bz] = cube(b);
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
}

/** Every hex reachable within `steps` through free hexes, with the path to each. */
export function reachable(from: number, steps: number, blocked: (i: number) => boolean): Map<number, number[]> {
  const paths = new Map<number, number[]>([[from, []]]);
  let frontier = [from];
  for (let s = 0; s < steps && frontier.length > 0; s++) {
    const next: number[] = [];
    for (const i of frontier) {
      for (const n of neighbours(i)) {
        if (paths.has(n) || blocked(n)) continue;
        paths.set(n, [...paths.get(i)!, n]);
        next.push(n);
      }
    }
    frontier = next;
  }
  paths.delete(from);
  return paths;
}
