/** A grid of movement costs. Infinity means impassable. */
export type Grid = { width: number; height: number; cost: Float32Array };
export type Cell = { x: number; y: number };

const DIRS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

export const passable = (grid: Grid, x: number, y: number) =>
  x >= 0 && y >= 0 && x < grid.width && y < grid.height && Number.isFinite(grid.cost[y * grid.width + x]);

/** The passable cell nearest to `cell`, searching outwards up to `radius` cells. */
export function nearestPassable(grid: Grid, cell: Cell, radius = 12): Cell | null {
  for (let r = 0; r <= radius; r++) {
    let best: Cell | null = null;
    let bestD = Infinity;
    for (let y = cell.y - r; y <= cell.y + r; y++) {
      for (let x = cell.x - r; x <= cell.x + r; x++) {
        if (Math.max(Math.abs(x - cell.x), Math.abs(y - cell.y)) !== r || !passable(grid, x, y)) continue;
        const d = Math.hypot(x - cell.x, y - cell.y);
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/**
 * A* over the 8-connected grid. Diagonal steps cost √2 times the cell cost and may not cut
 * the corner of an impassable cell. Returns the cells from start to goal, or null.
 */
export function findPath(grid: Grid, start: Cell, goal: Cell): Cell[] | null {
  const { width, height, cost } = grid;
  if (!passable(grid, start.x, start.y) || !passable(grid, goal.x, goal.y)) return null;
  const size = width * height;
  const g = new Float32Array(size).fill(Infinity);
  const from = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  let minCost = Infinity;
  for (let i = 0; i < size; i++) if (cost[i] < minCost) minCost = cost[i];
  const h = (i: number) => {
    const dx = Math.abs((i % width) - goal.x);
    const dy = Math.abs(Math.floor(i / width) - goal.y);
    return (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)) * minCost;
  };
  // Binary heap of [f, index].
  const heap: [number, number][] = [];
  const push = (f: number, i: number) => {
    heap.push([f, i]);
    for (let c = heap.length - 1; c > 0; ) {
      const p = (c - 1) >> 1;
      if (heap[p][0] <= heap[c][0]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      for (let p = 0; ; ) {
        const l = p * 2 + 1;
        const r = l + 1;
        let m = p;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === p) break;
        [heap[p], heap[m]] = [heap[m], heap[p]];
        p = m;
      }
    }
    return top;
  };
  const startIndex = start.y * width + start.x;
  const goalIndex = goal.y * width + goal.x;
  g[startIndex] = 0;
  push(h(startIndex), startIndex);
  while (heap.length > 0) {
    const [, current] = pop();
    if (current === goalIndex) break;
    if (closed[current]) continue;
    closed[current] = 1;
    const cx = current % width;
    const cy = Math.floor(current / width);
    for (const [dx, dy, step] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!passable(grid, nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!passable(grid, cx + dx, cy) || !passable(grid, cx, cy + dy))) continue;
      const next = ny * width + nx;
      const tentative = g[current] + step * (cost[current] + cost[next]) * 0.5;
      if (tentative < g[next]) {
        g[next] = tentative;
        from[next] = current;
        push(tentative + h(next), next);
      }
    }
  }
  if (!Number.isFinite(g[goalIndex])) return null;
  const path: Cell[] = [];
  for (let i = goalIndex; i !== -1; i = from[i]) path.push({ x: i % width, y: Math.floor(i / width) });
  return path.reverse();
}
