/** Pointy-top hexes in "odd-r" offset layout: odd rows sit half a tile east. */
export type Cell = { col: number; row: number };

/** Edge directions in 60° steps, measured from +x (east) towards +z (south, towards the camera). */
export const Dir = { E: 0, SE: 1, SW: 2, W: 3, NW: 4, NE: 5 } as const;
export type Dir = (typeof Dir)[keyof typeof Dir];

const ALL_DIRS: readonly Dir[] = [0, 1, 2, 3, 4, 5];

/** KayKit tiles have flat sides at x = ±1, points at z = ±2/√3 and their top face at y = 0. */
export const ROW_STEP = Math.sqrt(3);

export function cellToWorld({ col, row }: Cell): { x: number; z: number } {
  return { x: col * 2 + (row & 1), z: row * ROW_STEP };
}

export function neighbour({ col, row }: Cell, dir: Dir): Cell {
  const odd = row & 1;
  switch (dir) {
    case Dir.E:
      return { col: col + 1, row };
    case Dir.W:
      return { col: col - 1, row };
    case Dir.SE:
      return { col: col + odd, row: row + 1 };
    case Dir.SW:
      return { col: col + odd - 1, row: row + 1 };
    case Dir.NE:
      return { col: col + odd, row: row - 1 };
    case Dir.NW:
      return { col: col + odd - 1, row: row - 1 };
  }
}

export function dirBetween(from: Cell, to: Cell): Dir {
  const dir = ALL_DIRS.find((d) => {
    const n = neighbour(from, d);
    return n.col === to.col && n.row === to.row;
  });
  if (dir === undefined) throw new Error(`Cells ${from.col},${from.row} and ${to.col},${to.row} are not neighbours`);
  return dir;
}

export const cellKey = ({ col, row }: Cell) => `${col},${row}`;
