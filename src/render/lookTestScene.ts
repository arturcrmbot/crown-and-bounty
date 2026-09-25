import type { Grid } from '../rules/pathfinding';
import { AdventureScreen, type Placed } from './adventureScreen';
import { Bitmap, blit, SHADOW } from './bitmap';
import {
  CASTLE, CHEST, CRAGS, EXPLORED, forestAmount, GOLD_PILE, HERO, HIDEOUT, MAP_HEIGHT, MAP_WIDTH, MILL, MINE, PATHS, PATROL,
  ROCKS, SIGNPOST, TOWER, TREES, VILLAGE, WOLVES, type Point,
} from './lookTestMap';
import { bayer, hash } from './noise';
import { SILHOUETTE } from './palette';
import {
  boulder, castle, chest, crag, goldPile, hero, hideout, hut, mill, mine, mirror, oak, patrol, pine, signpost, stoneBridge, watchtower, well, wolfPack,
} from './sprites';
import { distanceField, Ground, paintTerrain, smooth, type Terrain } from './terrain';

const FRAMES = 8;
const animation = <T>(make: (t: number) => T) => Array.from({ length: FRAMES }, (_, i) => make(i / FRAMES));
const footY = (o: Placed) => o.y + o.sprite.height;

/** Landmarks under fog show only as flat dark shapes. */
function silhouette(sprite: Bitmap): Bitmap {
  const out = new Bitmap(sprite.width, sprite.height);
  for (let i = 0; i < sprite.data.length; i++) if (sprite.data[i] !== 0 && sprite.data[i] !== SHADOW) out.data[i] = SILHOUETTE;
  return out;
}

/** Walk grid cells are 8 map pixels square. */
export const CELL = 8;

/** Everything the controller needs to ride the hero around. */
export type HeroRig = {
  object: Placed;
  idle: Bitmap[];
  walk: Bitmap[];
  idleLeft: Bitmap[];
  walkLeft: Bitmap[];
  /** Pixels from the sprite's top to the hooves. */
  foot: number;
};

/** A clickable area in map pixels, for one location of the rules. */
export type Hitbox = { id: string; x0: number; y0: number; x1: number; y1: number };

export type LookTest = {
  view: AdventureScreen;
  grid: Grid;
  hero: HeroRig;
  hitboxes: Hitbox[];
  /** Objects that vanish once their location is done: pickups and enemies. */
  pickups: Map<string, Placed>;
  /** Walk-grid cells an enemy stands on, with the cost to restore once it's beaten. */
  blockers: Map<string, { index: number; cost: number }[]>;
};

export function buildLookTest(): LookTest {
  const terrain = paintTerrain();
  const W = MAP_WIDTH;
  const at = (x: number, y: number) => Math.round(y) * W + Math.round(x);
  const inside = (x: number, y: number) => x >= 4 && y >= 4 && x < W - 4 && y < MAP_HEIGHT - 4;
  const ground = (x: number, y: number) => (inside(x, y) ? terrain.ground[at(x, y)] : -1);
  const open = (x: number, y: number, pathGap: number, riverGap: number) =>
    inside(x, y) &&
    terrain.paths.d[at(x, y)] > pathGap &&
    terrain.river.d[at(x, y)] > riverGap &&
    [[0, 0], [-4, 0], [4, 0], [0, 3], [0, -3]].every(([dx, dy]) => ground(x + dx, y + dy) === Ground.Grass) &&
    ground(x, y + 8) !== Ground.Cliff &&
    ground(x, y - 8) !== Ground.Cliff;

  const scenery: Placed[] = [];
  const landmarks: Placed[] = [];
  const trunks: Point[] = [];
  const place = (sprite: Bitmap, [x, y]: Point, footFromTop: number): Placed => ({ sprite, x: x - sprite.width / 2, y: y - footFromTop });

  // Forest masses: packed trees wherever the authored forest shapes reach.
  const pines = Array.from({ length: 18 }, (_, i) => pine(500 + i, 13 + (i % 6) * 2));
  const oaks = Array.from({ length: 12 }, (_, i) => oak(700 + i, 12 + (i % 4) * 2));
  for (let gy = 0; gy < MAP_HEIGHT; gy += 5) {
    for (let gx = (gy / 5) % 2 === 0 ? 0 : 3.5; gx < W; gx += 7) {
      const x = gx + (hash(gx, gy, 1) - 0.5) * 5;
      const y = gy + (hash(gx, gy, 2) - 0.5) * 4;
      const f = forestAmount(x, y);
      if (f < 0.5 || hash(gx, gy, 3) > (f > 0.56 ? 0.95 : 0.55) || !open(x, y, 7, 22)) continue;
      const variants = hash(gx, gy, 4) < 0.75 ? pines : oaks;
      scenery.push(place(variants[Math.floor(hash(gx, gy, 5) * variants.length)], [x, y], variants[0].height - 5));
      trunks.push([x, y]);
    }
  }
  TREES.forEach(([x, y, isPine], i) => {
    const sprite = isPine ? pine(300 + i, 22) : oak(320 + i, 22);
    scenery.push(place(sprite, [x, y], sprite.height - 5));
    trunks.push([x, y]);
  });
  ROCKS.forEach(([x, y, size], i) => {
    scenery.push(place(boulder(260 + i, size), [x, y], Math.ceil(size * 0.8) + 2));
    trunks.push([x, y]);
  });
  const crags = CRAGS.map(([x, y, w, h], i) => place(crag(w, h, 40 + i), [x, y], h));
  scenery.push(...crags);

  const tower = place(watchtower(0.2), TOWER, 74);
  const mineSite = place(mine(), MINE, 44);
  const huts = VILLAGE.huts.map((p, i) => place(hut(i + 3), p, 28));
  const wellSite = place(well(), VILLAGE.well, 23);
  const post = place(signpost(), SIGNPOST, 23);
  const stockade = place(hideout(0.4), HIDEOUT, 64);
  landmarks.push(tower, mineSite, ...huts, wellSite, post, stockade);
  const crossing = smooth(PATHS[0]).reduce((best, p) => (terrain.river.d[at(p[0], p[1])] < terrain.river.d[at(best[0], best[1])] ? p : best));
  const bridge = place(stoneBridge(46), crossing, 12);
  landmarks.push(bridge);

  const fog = bake(terrain, scenery, landmarks);
  const view = new AdventureScreen(terrain.bitmap, terrain.wild, fog);

  const castleFrames = animation((t) => castle(t * Math.PI * 2));
  const castleObject = { ...place(castleFrames[0], CASTLE, 104), frames: castleFrames };
  const millFrames = animation((t) => mill(t / 8));
  const millObject = { ...place(millFrames[0], MILL, 44), frames: millFrames };
  const patrolFrames = animation((t) => patrol(t * Math.PI * 2));
  const patrolObject = { ...place(patrolFrames[0], PATROL, 40), frames: patrolFrames };
  const chestObject = place(chest(), CHEST, 13);
  const goldObject = place(goldPile(), GOLD_PILE, 12);
  const wolfFrames = animation((t) => wolfPack(t * Math.PI * 2));
  const wolvesObject = { ...place(wolfFrames[0], WOLVES, 27), frames: wolfFrames };
  for (const o of [castleObject, millObject, patrolObject, chestObject, goldObject, wolvesObject]) view.animate(o);

  const idle = animation((t) => hero(t * Math.PI * 2));
  const walk = animation((t) => hero(t, true, true));
  const rig: HeroRig = { object: { ...place(idle[0], HERO, 57), frames: idle }, idle, walk, idleLeft: idle.map(mirror), walkLeft: walk.map(mirror), foot: 57 };
  view.animate(rig.object);
  view.centreOn(HERO[0] + 40, HERO[1] - 70);

  const grid = walkGrid(terrain, trunks, [...landmarks.filter((o) => o !== bridge), ...crags, castleObject, millObject], bridge);
  const box = (id: string, ...objects: Placed[]): Hitbox => ({
    id,
    x0: Math.min(...objects.map((o) => o.x)),
    y0: Math.min(...objects.map((o) => o.y)),
    x1: Math.max(...objects.map((o) => o.x + o.sprite.width)),
    y1: Math.max(...objects.map((o) => o.y + o.sprite.height)),
  });
  const hitboxes = [
    box('castle', castleObject), box('tower', tower), box('mine', mineSite), box('village', ...huts, wellSite), box('mill', millObject),
    box('signpost', post), box('chest', chestObject), box('gold', goldObject), box('patrol', patrolObject), box('hideout', stockade),
    box('wolves', wolvesObject),
  ];
  const pickups = new Map<string, Placed>([['chest', chestObject], ['gold', goldObject], ['patrol', patrolObject], ['wolves', wolvesObject]]);
  const blockers = new Map<string, { index: number; cost: number }[]>();
  for (const [id, o] of [['patrol', patrolObject], ['wolves', wolvesObject]] as const) {
    const cells = new Map<number, number>();
    for (let y = Math.floor(o.sprite.height * 0.5); y < o.sprite.height; y++) {
      for (let x = 0; x < o.sprite.width; x++) {
        const v = o.sprite.get(x, y);
        if (v === 0 || v === SHADOW) continue;
        const index = Math.floor((o.y + y) / CELL) * grid.width + Math.floor((o.x + x) / CELL);
        if (!cells.has(index)) cells.set(index, grid.cost[index]);
      }
    }
    for (const index of cells.keys()) grid.cost[index] = Infinity;
    blockers.set(id, [...cells].map(([index, cost]) => ({ index, cost })));
  }
  return { view, grid, hero: rig, hitboxes, pickups, blockers };
}

/**
 * Where the hero can ride. Roads are twice as quick as grass. Water, banks, cliffs, trees,
 * rocks and buildings block, except the bridge deck.
 */
function walkGrid(terrain: Terrain, trunks: Point[], solids: Placed[], bridge: Placed): Grid {
  const width = MAP_WIDTH / CELL;
  const height = MAP_HEIGHT / CELL;
  const cost = new Float32Array(width * height);
  for (let cy = 0; cy < height; cy++) {
    for (let cx = 0; cx < width; cx++) {
      let road = 0;
      let grass = 0;
      for (let y = cy * CELL; y < (cy + 1) * CELL; y++) {
        for (let x = cx * CELL; x < (cx + 1) * CELL; x++) {
          const g = terrain.ground[y * MAP_WIDTH + x];
          if (g === Ground.Road) road++;
          else if (g === Ground.Grass) grass++;
        }
      }
      const forest = forestAmount(cx * CELL + CELL / 2, cy * CELL + CELL / 2) > 0.56;
      cost[cy * width + cx] = road >= 12 ? 1 : grass + road >= 52 && !forest ? 2 : Infinity;
    }
  }
  const block = (x: number, y: number) => {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    if (cx >= 0 && cy >= 0 && cx < width && cy < height && cost[cy * width + cx] !== 1) cost[cy * width + cx] = Infinity;
  };
  for (const [x, y] of trunks) block(x, y);
  for (const o of solids) {
    const { sprite } = o;
    for (let y = Math.floor(sprite.height * 0.55); y < sprite.height; y++) {
      for (let x = 0; x < sprite.width; x++) {
        const v = sprite.get(x, y);
        if (v !== 0 && v !== SHADOW) block(o.x + x, o.y + y);
      }
    }
  }
  for (let y = bridge.y + 6; y < bridge.y + 18; y += 2) {
    for (let x = bridge.x; x < bridge.x + bridge.sprite.width; x += 2) {
      const cx = Math.floor(x / CELL);
      const cy = Math.floor(y / CELL);
      if (cx >= 0 && cy >= 0 && cx < width && cy < height) cost[cy * width + cx] = 1;
    }
  }
  return { width, height, cost };
}

/**
 * Bakes everything into the explored map and into a roadless copy where landmarks are silhouettes,
 * and returns the starting fog: 1 where the hero hasn't been yet, with a dithered edge.
 */
function bake(terrain: Terrain, scenery: Placed[], landmarks: Placed[]): Uint8Array {
  const all = [...scenery, ...landmarks].sort((a, b) => footY(a) - footY(b));
  const isLandmark = new Set(landmarks);
  for (const o of all) {
    blit(terrain.bitmap, o.sprite, Math.round(o.x), Math.round(o.y));
    blit(terrain.wild, isLandmark.has(o) ? silhouette(o.sprite) : o.sprite, Math.round(o.x), Math.round(o.y));
  }
  const trails = distanceField(EXPLORED.trails.map((t) => smooth(t)), EXPLORED.trailRadius + 40);
  const fogMask = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const i = y * MAP_WIDTH + x;
      let reach = trails.d[i] - EXPLORED.trailRadius;
      for (const [cx, cy, r] of EXPLORED.discs) reach = Math.min(reach, Math.hypot(x - cx, y - cy) - r);
      const fog = Math.min(1, Math.max(0, (reach + 12) / 30));
      if (fog > bayer(x, y)) fogMask[i] = 1;
    }
  }
  return fogMask;
}
