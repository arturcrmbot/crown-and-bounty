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
 * The cell within `radius` of `target` that can actually be reached from `start`, nearest the
 * target, with the same steps as A*. For riding up to an enemy who stands on his own road: the
 * passable cell nearest to him may be on his far side.
 */
export function reachableNear(grid: Grid, start: Cell, target: Cell, radius: number): Cell | null {
  const { width } = grid;
  if (!passable(grid, start.x, start.y)) return null;
  const seen = new Uint8Array(width * grid.height);
  const queue = [start.y * width + start.x];
  seen[queue[0]] = 1;
  let best: Cell | null = null;
  let bestD = Infinity;
  for (let k = 0; k < queue.length; k++) {
    const x = queue[k] % width;
    const y = (queue[k] - x) / width;
    const d = Math.hypot(x - target.x, y - target.y);
    if (d <= radius && d < bestD) {
      bestD = d;
      best = { x, y };
    }
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!passable(grid, nx, ny) || seen[ny * width + nx]) continue;
      if (dx && dy && (!passable(grid, x + dx, y) || !passable(grid, x, y + dy))) continue;
      seen[ny * width + nx] = 1;
      queue.push(ny * width + nx);
    }
  }
  return best;
}

/**
 * A binary min-heap of cell indices by priority, in typed arrays: the same order of pops as a heap of
 * pairs, without an allocation per push. Cells go in more than once when a cheaper way turns up.
 */
class Heap {
  f = new Float64Array(1024);
  i = new Int32Array(1024);
  size = 0;

  push(f: number, i: number) {
    if (this.size === this.f.length) {
      const f2 = new Float64Array(this.size * 2);
      const i2 = new Int32Array(this.size * 2);
      f2.set(this.f);
      i2.set(this.i);
      this.f = f2;
      this.i = i2;
    }
    const { f: hf, i: hi } = this;
    let c = this.size++;
    hf[c] = f;
    hi[c] = i;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (hf[p] <= hf[c]) break;
      [hf[p], hf[c]] = [hf[c], hf[p]];
      [hi[p], hi[c]] = [hi[c], hi[p]];
      c = p;
    }
  }

  /** Takes the cell with the lowest priority off the heap. */
  pop(): number {
    const { f: hf, i: hi } = this;
    const top = hi[0];
    const last = --this.size;
    if (last > 0) {
      hf[0] = hf[last];
      hi[0] = hi[last];
      for (let p = 0; ; ) {
        const l = p * 2 + 1;
        const r = l + 1;
        let m = p;
        if (l < last && hf[l] < hf[m]) m = l;
        if (r < last && hf[r] < hf[m]) m = r;
        if (m === p) break;
        [hf[p], hf[m]] = [hf[m], hf[p]];
        [hi[p], hi[m]] = [hi[m], hi[p]];
        p = m;
      }
    }
    return top;
  }
}

/** Working space for `findPath`, kept between calls: big maps would otherwise make a lot of garbage. */
const scratch = { g: new Float32Array(0), from: new Int32Array(0), closed: new Uint8Array(0), heap: new Heap() };

/**
 * A* over the 8-connected grid. Diagonal steps cost √2 times the cell cost and may not cut
 * the corner of an impassable cell. Returns the cells from start to goal, or null.
 */
export function findPath(grid: Grid, start: Cell, goal: Cell): Cell[] | null {
  const { width, height, cost } = grid;
  if (!passable(grid, start.x, start.y) || !passable(grid, goal.x, goal.y)) return null;
  const size = width * height;
  if (scratch.g.length !== size) {
    scratch.g = new Float32Array(size);
    scratch.from = new Int32Array(size);
    scratch.closed = new Uint8Array(size);
  }
  const { g, from, closed, heap } = scratch;
  g.fill(Infinity);
  from.fill(-1);
  closed.fill(0);
  heap.size = 0;
  let minCost = Infinity;
  for (let i = 0; i < size; i++) if (cost[i] < minCost) minCost = cost[i];
  const h = (i: number) => {
    const dx = Math.abs((i % width) - goal.x);
    const dy = Math.abs(Math.floor(i / width) - goal.y);
    return (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)) * minCost;
  };
  const startIndex = start.y * width + start.x;
  const goalIndex = goal.y * width + goal.x;
  g[startIndex] = 0;
  heap.push(h(startIndex), startIndex);
  while (heap.size > 0) {
    const current = heap.pop();
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
        heap.push(tentative + h(next), next);
      }
    }
  }
  if (!Number.isFinite(g[goalIndex])) return null;
  const path: Cell[] = [];
  for (let i = goalIndex; i !== -1; i = from[i]) path.push({ x: i % width, y: Math.floor(i / width) });
  return path.reverse();
}

/** The cheapest cost from one cell to every other on a grid, and the way back from each. */
export type Reach = { start: number; g: Float32Array; from: Int32Array };

/**
 * Dijkstra from `start` over the whole grid, with the same steps and costs as `findPath`: one search
 * answers the way to every place at once, which is what the bot and the ride's hover label ask.
 * From several starts at once, each cell gets the way to the nearest of them.
 */
export function reachFrom(grid: Grid, start: Cell | readonly Cell[]): Reach {
  const { width, height, cost } = grid;
  const size = width * height;
  const g = new Float32Array(size).fill(Infinity);
  const from = new Int32Array(size).fill(-1);
  const starts = 'x' in start ? [start] : start;
  const reach = { start: starts.length ? starts[0].y * width + starts[0].x : -1, g, from };
  const done = new Uint8Array(size);
  const heap = new Heap();
  for (const s of starts) {
    if (!passable(grid, s.x, s.y)) continue;
    g[s.y * width + s.x] = 0;
    heap.push(0, s.y * width + s.x);
  }
  while (heap.size > 0) {
    const current = heap.pop();
    if (done[current]) continue;
    done[current] = 1;
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
        heap.push(tentative, next);
      }
    }
  }
  return reach;
}

/** The cells from the search's start to `goal`, the cheapest way, or null if it can't be reached. */
export function pathIn(reach: Reach, width: number, goal: Cell): Cell[] | null {
  const goalIndex = goal.y * width + goal.x;
  if (!Number.isFinite(reach.g[goalIndex])) return null;
  const path: Cell[] = [];
  for (let i = goalIndex; i !== -1; i = reach.from[i]) path.push({ x: i % width, y: Math.floor(i / width) });
  return path.reverse();
}

/**
 * The reached cell within `radius` of `target` to ride up to it by: near it, but by the cheaper way
 * round, so that he comes at an enemy on a bridge from his own bank.
 */
export function approachIn(reach: Reach, grid: Grid, target: Cell, radius: number): Cell | null {
  let best: Cell | null = null;
  let bestScore = Infinity;
  const r = Math.floor(radius);
  for (let y = Math.max(0, target.y - r); y <= Math.min(grid.height - 1, target.y + r); y++) {
    for (let x = Math.max(0, target.x - r); x <= Math.min(grid.width - 1, target.x + r); x++) {
      const d = Math.hypot(x - target.x, y - target.y);
      const g = reach.g[y * grid.width + x];
      if (d > radius || !Number.isFinite(g)) continue;
      // Every cell nearer is worth more riding than any step costs, as long as it's on this side.
      const score = g + d * 10;
      if (score < bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return best;
}
