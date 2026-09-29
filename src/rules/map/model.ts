import type { Province } from '../../content/types';
import type { Location } from '../state';
import { fbm, hash, noise } from '../noise';
import { lineAt, smooth, type Point } from './geometry';
import type { Grid } from './pathfinding';

/** Walk-grid cells are 8 map pixels square. */
export const CELL = 8;

export const Terrain = { Grass: 0, Road: 1, Water: 2, Cliff: 3, Forest: 4, Rock: 5, Building: 6, Bridge: 7 } as const;
export type Terrain = (typeof Terrain)[keyof typeof Terrain];

/** Half-width of the river in pixels, a distance `s` along it. The painter uses the same numbers. */
export const riverHalfWidth = (s: number) => 10 + (noise(s / 60, 0.5, 11) - 0.5) * 6;
export const pathHalfWidth = (s: number) => 3.4 + (noise(s / 25, 3, 21) - 0.5) * 1.6;

/** Distance in pixels outside the nearest pool, negative inside, before the shore's wobble. */
export function poolDistance(province: Province, x: number, y: number): number {
  let best = Infinity;
  for (const [cx, cy, rx, ry] of province.pools ?? []) best = Math.min(best, (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry));
  return best;
}

/** The shore's wobble at a point, so pools aren't perfect ellipses. The painter uses the same numbers. */
export const shoreWobble = (x: number, y: number) => (noise(x / 18, y / 18, 91) - 0.5) * 10;

/** Signed distance from a pool's shore: negative in the water. */
export const poolEdge = (province: Province, x: number, y: number) => poolDistance(province, x, y) + shoreWobble(x, y);

/** Blocked ground around a building's foot point: width, and height above the foot, in pixels. */
const FOOTPRINTS: Record<string, [number, number]> = {
  abbey: [64, 26],
  peathut: [44, 16],
  windmill: [34, 16],
  stilthut: [60, 24],
  shrine: [22, 8],
  event: [22, 8],
  castle: [104, 48],
  tower: [22, 14],
  mine: [56, 24],
  mill: [40, 18],
  village: [18, 8],
  well: [18, 8],
  signpost: [4, 4],
  hideout: [72, 28],
  hut: [24, 12],
};

/** An enemy stack holds the ground this far round it, so it can close a road. */
const ENEMY_REACH = 22;

/** A tree the painter should draw: its foot, and which kind and variant. */
export type Tree = { x: number; y: number; kind: 'pine' | 'oak' | 'willow'; variant: number };

/** The land as the rules see it: terrain per cell, the walk grid and trees. Enemies stand where the state says. */
export type MapModel = {
  province: Province;
  width: number;
  height: number;
  terrain: Uint8Array;
  /** Movement cost per cell: 1 on roads and the bridge, 2 on grass, Infinity where nothing can pass. */
  grid: Grid;
  river: Point[];
  paths: Point[][];
  cliff: Point[] | null;
  trees: Tree[];
};

/**
 * The forests and clearings that reach each square of a province, in their own order, so that
 * `forestAmount` only looks at those near the point: a forest reaches 1.91 times its radii (beyond,
 * it wants no trees at all), a clearing its own radius.
 */
type ForestIndex = { clearings: [number, number, number][]; forests: number[][]; nearClearings: number[][]; cols: number; rows: number };
const INDEX_CELL = 64;
const forestIndexes = new WeakMap<Province, ForestIndex>();

function forestIndex(province: Province): ForestIndex {
  let index = forestIndexes.get(province);
  if (index) return index;
  const clearings: [number, number, number][] = [
    // Enemies stand on roads that are clear already; a clearing round them would open a way past.
    ...province.locations.filter((l) => !l.enemy).map((l) => [l.at[0], l.at[1] - 10, 38] as [number, number, number]),
    [province.hero[0], province.hero[1] - 10, 38],
    ...province.locations.filter((l) => l.kind === 'hideout').map((l) => [l.at[0], l.at[1] - 20, 64] as [number, number, number]),
  ];
  const cols = Math.ceil(province.width / INDEX_CELL) + 1;
  const rows = Math.ceil(province.height / INDEX_CELL) + 1;
  const forests: number[][] = Array.from({ length: cols * rows }, () => []);
  const nearClearings: number[][] = Array.from({ length: cols * rows }, () => []);
  const mark = (lists: number[][], item: number, x0: number, y0: number, x1: number, y1: number) => {
    for (let cy = Math.max(0, Math.floor(y0 / INDEX_CELL)); cy <= Math.min(rows - 1, Math.floor(y1 / INDEX_CELL)); cy++) {
      for (let cx = Math.max(0, Math.floor(x0 / INDEX_CELL)); cx <= Math.min(cols - 1, Math.floor(x1 / INDEX_CELL)); cx++) lists[cy * cols + cx].push(item);
    }
  };
  province.forests.forEach(([cx, cy, rx, ry], i) => mark(forests, i, cx - rx * 1.92, cy - ry * 1.92, cx + rx * 1.92, cy + ry * 1.92));
  clearings.forEach(([cx, cy, r], i) => mark(nearClearings, i, cx - r, cy - r, cx + r, cy + r));
  index = { clearings, forests, nearClearings, cols, rows };
  forestIndexes.set(province, index);
  return index;
}

/** How much forest wants to grow at a point: above one half means woodland. Landmarks keep a clearing. */
export function forestAmount(province: Province, x: number, y: number): number {
  const index = forestIndex(province);
  // Points just off the map (a tree's jitter) look in the nearest square, which lists everything reaching past the edge.
  const cx = Math.min(index.cols - 1, Math.max(0, Math.floor(x / INDEX_CELL)));
  const cy = Math.min(index.rows - 1, Math.max(0, Math.floor(y / INDEX_CELL)));
  const at = cy * index.cols + cx;
  let amount = 0;
  for (const i of index.forests[at]) {
    const [fx, fy, rx, ry] = province.forests[i];
    const d = Math.hypot((x - fx) / rx, (y - fy) / ry);
    amount = Math.max(amount, 1.05 - d * 0.55);
  }
  amount += (fbm(x / 40, y / 40, 2, 61) - 0.5) * 0.3;
  for (const i of index.nearClearings[at]) {
    const [kx, ky, r] = index.clearings[i];
    const d = Math.hypot(x - kx, y - ky) / r;
    if (d < 1) amount -= (1 - d) * 0.8;
  }
  return amount;
}

/**
 * Distance from each cell's centre to the nearest of some polylines, and the distance along it
 * there, for cells within `radius` pixels (Infinity beyond). The same sums as `nearest`, done
 * segment by segment over the cells near each one, which is far quicker than every cell by every line.
 */
function cellField(lines: readonly Point[][], radius: number, width: number, height: number): { d: Float64Array; s: Float64Array } {
  const d = new Float64Array(width * height).fill(Infinity);
  const s = new Float64Array(width * height);
  for (const path of lines) {
    let along = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, ay] = path[i];
      const [bx, by] = path[i + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const length = Math.hypot(dx, dy) || 1e-6;
      const x0 = Math.max(0, Math.floor((Math.min(ax, bx) - radius) / CELL));
      const x1 = Math.min(width - 1, Math.floor((Math.max(ax, bx) + radius) / CELL));
      const y0 = Math.max(0, Math.floor((Math.min(ay, by) - radius) / CELL));
      const y1 = Math.min(height - 1, Math.floor((Math.max(ay, by) + radius) / CELL));
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const x = cx * CELL + CELL / 2;
          const y = cy * CELL + CELL / 2;
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (length * length)));
          const distance = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
          const k = cy * width + cx;
          if (distance < d[k]) {
            d[k] = distance;
            s[k] = along + t * length;
          }
        }
      }
      along += length;
    }
  }
  return { d, s };
}

export function buildMap(province: Province): MapModel {
  const width = Math.ceil(province.width / CELL);
  const height = Math.ceil(province.height / CELL);
  const river = smooth(province.river);
  const paths = province.paths.map((p) => smooth(p));
  const cliff = province.cliff ? smooth(province.cliff.line, 6) : null;
  const terrain = new Uint8Array(width * height);
  // Only nearness matters here: the river is at most ~17 px wide with its bank, roads block forest within 9 px.
  const riverField = cellField([river], 28, width, height);
  const pathField = cellField(paths, 28, width, height);

  for (let cy = 0; cy < height; cy++) {
    for (let cx = 0; cx < width; cx++) {
      const x = cx * CELL + CELL / 2;
      const y = cy * CELL + CELL / 2;
      const k = cy * width + cx;
      const r = { d: riverField.d[k], s: riverField.s[k] };
      const p = { d: pathField.d[k], s: pathField.s[k] };
      const onPath = p.d < pathHalfWidth(p.s) + 1.5;
      const top = cliff ? lineAt(cliff, x) : undefined;
      const face = top === undefined ? -99 : y - top;
      let t: Terrain = Terrain.Grass;
      if (province.cliff && face >= -3 && face < province.cliff.height + 3) t = Terrain.Cliff;
      else if (r.d < riverHalfWidth(r.s) + 4 || poolEdge(province, x, y) < 3) t = onPath ? Terrain.Bridge : Terrain.Water;
      else if (onPath) t = Terrain.Road;
      else if (p.d > 9 && forestAmount(province, x, y) > 0.5) t = Terrain.Forest;
      terrain[cy * width + cx] = t;
    }
  }

  const index = (x: number, y: number) => {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    return cx >= 0 && cy >= 0 && cx < width && cy < height ? cy * width + cx : -1;
  };
  /** Marks the cells under a rectangle standing on (x, footY). Roads and the bridge stay open. */
  const cellsUnder = (x: number, footY: number, w: number, h: number) => {
    const cells: number[] = [];
    for (let y = footY - h; y <= footY; y += CELL / 2) {
      for (let px = x - w / 2; px <= x + w / 2; px += CELL / 2) {
        const i = index(px, y);
        if (i >= 0 && !cells.includes(i)) cells.push(i);
      }
    }
    return cells;
  };
  const block = (cells: number[], as: Terrain) => {
    for (const i of cells) if (terrain[i] !== Terrain.Road && terrain[i] !== Terrain.Bridge) terrain[i] = as;
  };

  for (const [x, y, w, h] of province.crags) block(cellsUnder(x, y, w * 0.9, h * 0.45), Terrain.Rock);
  for (const [x, y, size] of province.rocks) block(cellsUnder(x, y, size, 2), Terrain.Rock);
  for (const [x, y] of province.trees) block(cellsUnder(x, y, 2, 2), Terrain.Forest);
  for (const d of province.decor) block(cellsUnder(d.at[0], d.at[1], ...FOOTPRINTS[d.sprite]), Terrain.Building);
  for (const l of province.locations) {
    const footprint = FOOTPRINTS[l.look ?? l.kind];
    if (footprint && (!l.enemy || l.kind === 'hideout')) block(cellsUnder(l.at[0], l.at[1], ...footprint), Terrain.Building);
  }

  // Trees for the painter: packed on a jittered grid wherever forest grows, kept off roads and water.
  const trees: Tree[] = [];
  const woods = province.woods ?? { pine: 0.75, willow: 0 };
  const clear = (x: number, y: number) => {
    const own = index(x, y);
    if (own < 0 || terrain[own] !== Terrain.Forest) return false;
    return [[-8, 0], [8, 0], [0, -8], [0, 8], [-6, -6], [6, -6], [-6, 6], [6, 6]].every(([dx, dy]) => {
      const i = index(x + dx, y + dy);
      return i >= 0 && (terrain[i] === Terrain.Forest || terrain[i] === Terrain.Grass);
    });
  };
  for (let gy = 0; gy < province.height; gy += 5) {
    for (let gx = (gy / 5) % 2 === 0 ? 0 : 3.5; gx < province.width; gx += 7) {
      const x = gx + (hash(gx, gy, 1) - 0.5) * 5;
      const y = gy + (hash(gx, gy, 2) - 0.5) * 4;
      const f = forestAmount(province, x, y);
      if (f < 0.5 || hash(gx, gy, 3) > (f > 0.56 ? 0.95 : 0.55) || !clear(x, y)) continue;
      const pick = hash(gx, gy, 4);
      trees.push({ x, y, kind: pick < woods.pine ? 'pine' : pick < woods.pine + woods.willow ? 'willow' : 'oak', variant: hash(gx, gy, 5) });
    }
  }

  const cost = new Float32Array(width * height);
  for (let i = 0; i < cost.length; i++) {
    const t = terrain[i];
    cost[i] = t === Terrain.Road || t === Terrain.Bridge ? 1 : t === Terrain.Grass ? 2 : Infinity;
  }

  return { province, width, height, terrain, grid: { width, height, cost }, river, paths, cliff, trees };
}

/** The cells an enemy stack standing at `at` holds, so it can close a road. */
export function enemyCellsAt(map: MapModel, [x, y]: Point): number[] {
  const cells: number[] = [];
  const r = Math.ceil(ENEMY_REACH / CELL) + 1;
  const [cx0, cy0] = [Math.floor(x / CELL), Math.floor((y - 6) / CELL)];
  for (let cy = Math.max(0, cy0 - r); cy <= Math.min(map.height - 1, cy0 + r); cy++) {
    for (let cx = Math.max(0, cx0 - r); cx <= Math.min(map.width - 1, cx0 + r); cx++) {
      if (Math.hypot(cx * CELL + CELL / 2 - x, cy * CELL + CELL / 2 - (y - 6)) <= ENEMY_REACH) cells.push(cy * map.width + cx);
    }
  }
  return cells;
}

/** The walk grid with these enemies marked as impassable where they stand. */
export function gridWithEnemies(map: MapModel, enemies: readonly { at: Point }[]): Grid {
  const cost = map.grid.cost.slice();
  for (const e of enemies) for (const i of enemyCellsAt(map, e.at)) cost[i] = Infinity;
  return { width: map.width, height: map.height, cost };
}

/** Enemies that stand in the way: on the map, not yet beaten, and not holed up in a hideout. */
export const standingEnemies = (locations: readonly Location[]) => locations.filter((l) => l.enemy && !l.done && l.kind !== 'hideout');

export const cellIndex = (map: MapModel, x: number, y: number) => Math.floor(y / CELL) * map.width + Math.floor(x / CELL);
export const cellCentre = (map: MapModel, i: number): Point => [(i % map.width) * CELL + CELL / 2, Math.floor(i / map.width) * CELL + CELL / 2];
