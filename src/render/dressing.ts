import type { Location } from '../rules/game';
import type { Point } from '../rules/map/geometry';
import { CELL, forestAmount, forestAt, riverHalfWidth, Terrain, type MapModel } from '../rules/map/model';
import type { Placed } from './adventureScreen';
import type { Bitmap } from './bitmap';
import { piece } from './mapArt';
import { GROVE_TREES, type PieceName } from './mapPieces';
import { fbm, hash, noise } from './noise';
import { mirror } from './sprites';

/**
 * How Aldmoor's painted map is dressed (#178), as HoMM2 dresses its maps: woods packed and grouped by
 * kind, with a fringe of bushes and flowers; copses and hills over open country so no stretch of it is
 * bare; a little scene round every place; and reeds and flower beds along the river. It's all drawing:
 * the rules' walk grid is the same, and nothing stands on a road.
 */

type Kind = keyof typeof GROVE_TREES;

/** Woods are grown in clumps of one look, as HoMM2's are: which look, from the land's slow noise. */
const PINEWOODS: Kind[][] = [['pine'], ['pine', 'pine', 'fir'], ['pine'], ['fir', 'pine'], ['pine', 'pine', 'pine', 'dead'], ['pine']];
const LEAFWOODS: Kind[][] = [['green'], ['green', 'green', 'teal'], ['orange', 'gold', 'green'], ['green', 'green', 'birch'], ['teal', 'green'], ['red', 'orange', 'green'], ['green', 'gold'], ['green']];

const BUSHES = [0, 1, 2, 3, 4, 5, 26, 27, 28];
const FLOWERS = [6, 7, 8, 9, 10, 11];
const BEDS: PieceName[] = ['bedPurple', 'bedPurple2', 'bedPink', 'bedPink2', 'bedRed', 'bedRed2', 'bedRed3', 'bedYellow', 'bedYellow2'];
const SMALL_BEDS: PieceName[] = ['bedRed', 'bedRed2', 'bedRed3', 'bedYellow', 'bedYellow2'];

/** What stands round each sort of place, by its look (or its kind): a piece and where, from the place's foot. */
type Prop = [PieceName, number, number];
const SCENES: Record<string, Prop[]> = {
  castle: [['fountain', -82, 20], ['bedPink2', 80, 14], ['bedPurple', -60, 40], ['bedRed', 58, 36], ['gazebo', 96, -10], ['bedYellow', -96, -6]],
  well: [['bedRed', -24, 6], ['bedYellow', 24, 8], ['bedPurple', 0, 22]],
  village: [['haystack', -70, -20], ['garden', 60, 26], ['fence', 92, 20], ['scarecrow', 70, 6], ['barrels', -40, 22], ['crates', 34, -22], ['bedYellow', -26, 6], ['bedRed', 24, 8]],
  mill: [['logPile', 44, 18], ['wagon', 70, -4], ['barrels', -8, 26], ['crates', 18, 30], ['bedPink', 54, 40]],
  tower: [['outcrop', -40, 4], ['rock', 30, 10], ['bones', 22, 28]],
  mine: [['ore', 56, 10], ['wagon', -62, 12], ['logPile', 70, 30], ['rock', -50, 32]],
  shrine: [['bedPurple', -30, 12], ['bedPink', 30, 14], ['bedYellow', 0, 28]],
  event: [['bedPurple', -30, 12], ['bedPink', 30, 14]],
  chest: [['outcrop3', -6, -12], ['bedYellow', 22, 8]],
  gold: [['goldSmall', 20, 6]],
  stockade: [['bones', -58, 24], ['fire', 54, 22], ['crates', 62, -6], ['barrels', -60, -4]],
  camp: [['fire', 0, 24], ['cauldron', 34, 18], ['crates', -40, 14], ['barrels', 46, -6]],
  lodge: [['logPile', -50, 12], ['wagon', 54, 14], ['fire', 12, 28], ['barrels', -28, 26]],
  hall: [['fence', -60, 18], ['barrels', 56, 16], ['haystack', 66, -8], ['bedRed', -30, 30]],
  mews: [['fence', -44, 14], ['haystack', 42, 10]],
  range: [['haystack', -40, 6], ['barrels', 40, 12], ['fence', 0, 26]],
  cottage: [['garden', 44, 10], ['fence', -42, 14], ['bedYellow', 8, 22]],
  house: [['garden', -48, 12], ['barrels', 40, 12], ['bedRed', 10, 24]],
  windmill: [['haystack', 34, 12], ['wagon', -46, 14]],
  signpost: [['bedYellow2', 16, 6]],
  hut: [['garden', 30, 10], ['fence', -30, 12], ['bedYellow', 6, 18], ['haystack', -24, -14]],
  holes: [['ore', 30, 10], ['mound', -34, -6]],
};

export function dress(map: MapModel, locations: readonly Location[], scenery: Placed[]) {
  const { province } = map;
  const W = map.width;
  const H = map.height;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= province.width || y >= province.height ? -1 : map.terrain[Math.floor(y / CELL) * W + Math.floor(x / CELL)]);

  // How far each cell is from a road, and from the water, in cells (up to 12).
  const far = (is: (t: number) => boolean) => {
    const d = new Uint8Array(W * H).fill(255);
    const queue: number[] = [];
    for (let i = 0; i < d.length; i++) if (is(map.terrain[i])) (d[i] = 0), queue.push(i);
    for (let k = 0; k < queue.length; k++) {
      const i = queue[k];
      if (d[i] >= 12) continue;
      const x = i % W;
      for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (n >= 0 && n < d.length && d[n] > d[i] + 1) (d[n] = d[i] + 1), queue.push(n);
      }
    }
    return (x: number, y: number) => (x < 0 || y < 0 || x >= province.width || y >= province.height ? 0 : d[Math.floor(y / CELL) * W + Math.floor(x / CELL)] * CELL);
  };
  const road = far((t) => t === Terrain.Road || t === Terrain.Bridge || t === Terrain.Ford || t === Terrain.Building);
  const water = far((t) => t === Terrain.Water);

  const places: Point[] = [...locations.map((l) => l.at), ...province.decor.map((d) => d.at), province.hero];
  const nearPlace = (x: number, y: number, r: number) => places.some(([px, py]) => Math.abs(px - x) < r && Math.abs(py - y) < r * 0.8);

  // What's been put where, a cell of 16 px at a time, so dressing never piles up on itself.
  const TAKEN = 16;
  const taken = new Uint8Array(Math.ceil(province.width / TAKEN) * Math.ceil(province.height / TAKEN));
  const cols = Math.ceil(province.width / TAKEN);
  const isTaken = (x: number, y: number, w: number) => {
    for (let gx = Math.floor((x - w / 2) / TAKEN); gx <= Math.floor((x + w / 2) / TAKEN); gx++) {
      const k = Math.floor(y / TAKEN) * cols + gx;
      if (gx >= 0 && gx < cols && taken[k]) return true;
    }
    return false;
  };
  const take = (x: number, y: number, w: number) => {
    for (let gx = Math.floor((x - w / 2) / TAKEN); gx <= Math.floor((x + w / 2) / TAKEN); gx++) {
      const k = Math.floor(y / TAKEN) * cols + gx;
      if (gx >= 0 && gx < cols && k >= 0 && k < taken.length) taken[k] = 1;
    }
  };

  // How many things stand in each 96 px square, so the last pass can find the bare ones.
  const BLOCK = 80;
  const blocks = Math.ceil(province.width / BLOCK);
  const count = new Uint16Array(blocks * Math.ceil(province.height / BLOCK));
  const put = (name: PieceName, x: number, y: number, flip: boolean) => {
    const p = piece(name);
    if (!p) return null;
    if (x >= 0 && y >= 0 && x < province.width && y < province.height) count[Math.floor(y / BLOCK) * blocks + Math.floor(x / BLOCK)]++;
    const sprite: Bitmap = flip ? mirror(p.sprite) : p.sprite;
    scenery.push({ sprite, x: Math.round(x - sprite.width / 2), y: Math.round(y - p.foot) });
    return p.sprite;
  };
  /** Whether a piece this wide can stand with its foot here: on grass (or the wood), off the roads and the water. */
  const fits = (x: number, y: number, w: number, clear: number, wood = false) => {
    for (const dx of [-w / 2, 0, w / 2]) {
      const t = at(x + dx, y);
      if (t !== Terrain.Grass && !(wood && t === Terrain.Forest)) return false;
      if (road(x + dx, y) < clear || water(x + dx, y) < 8) return false;
    }
    return true;
  };
  const pick = <T>(list: readonly T[], v: number) => list[Math.floor(v * list.length) % list.length];
  const lookOf = (x: number, y: number, pine: boolean) => {
    const v = fbm(x / 170, y / 150, 2, pine ? 431 : 432);
    const looks = pine ? PINEWOODS : LEAFWOODS;
    return looks[Math.min(looks.length - 1, Math.floor(Math.max(0, (v - 0.25) * 2) * looks.length))];
  };
  const tree = (x: number, y: number, kinds: Kind[], seed: number) => {
    const kind = pick(kinds, hash(Math.round(x), Math.round(y), seed));
    put(pick(GROVE_TREES[kind], hash(Math.round(x), Math.round(y), seed + 1)) as PieceName, x, y, hash(Math.round(x), Math.round(y), seed + 2) < 0.5);
  };

  // A little scene round every place: what its people use, and flowers.
  const scene = (key: string, [px, py]: Point, seed: number) => {
    for (const [name, dx, dy] of SCENES[key] ?? []) {
      const p = piece(name);
      if (!p) continue;
      // Where it's meant to stand, or failing that, mirrored, or a little further out.
      const spot = ([[dx, dy], [-dx, dy], [dx * 1.3, dy + 12], [-dx * 1.3, dy + 12]] as const)
        .map(([ox, oy]) => [px + ox, py + oy] as const)
        .find(([x, y]) => fits(x, y, p.sprite.width, 10) && !isTaken(x, y, p.sprite.width) && !places.some(([qx, qy]) => (qx !== px || qy !== py) && Math.abs(qx - x) < 30 && Math.abs(qy - y) < 26));
      if (!spot) continue;
      const [x, y] = spot;
      put(name, x, y, hash(px, py + dx, seed) < 0.5 && !name.startsWith('wagon'));
      take(x, y, p.sprite.width);
    }
  };
  for (const l of locations) {
    if (l.enemy && l.kind !== 'hideout') continue;
    scene(l.look ?? l.kind, l.at, 440);
    take(l.at[0], l.at[1], 60);
    take(l.at[0], l.at[1] - 16, 60);
  }
  province.decor.forEach((d, i) => {
    if (hash(i, 0, 441) < 0.6) scene(d.sprite === 'holes' ? 'holes' : 'hut', d.at, 442 + i);
    take(d.at[0], d.at[1], 40);
  });

  // The woods: the rules plant a tree every few pixels; one in four of those stands, each its clump's kind.
  for (const t of map.trees) {
    if (hash(Math.round(t.x), Math.round(t.y), 411) > 0.3) continue;
    // A broadleaf in a pinewood stays green: an autumn one's top among the pines reads as a fire.
    const pinewood = (province.forests[forestAt(province, t.x, t.y)]?.[4] ?? province.woods?.pine ?? 0.75) > 0.5;
    tree(t.x, t.y, t.kind === 'pine' ? lookOf(t.x, t.y, true) : pinewood ? ['green', 'green', 'birch'] : lookOf(t.x, t.y, false), 450);
  }
  province.trees.forEach(([x, y, isPine]) => tree(x, y, lookOf(x, y, isPine), 453));

  // The wood's edge, frayed: a tree or two out on the grass, then bushes and flowers, as HoMM2's woods end.
  for (let gy = 8; gy < province.height; gy += 14) {
    for (let gx = 8; gx < province.width; gx += 14) {
      const x = gx + (hash(gx, gy, 460) - 0.5) * 12;
      const y = gy + (hash(gx, gy, 461) - 0.5) * 10;
      const f = forestAmount(province, x, y);
      if (f < 0.36 || f > 0.52 || at(x, y) !== Terrain.Grass || nearPlace(x, y, 46)) continue;
      const r = hash(gx, gy, 462);
      if (f > 0.44 && r < 0.45 && fits(x, y, 18, 22)) {
        const forest = province.forests[forestAt(province, x, y)];
        tree(x, y, lookOf(x, y, (forest?.[4] ?? province.woods?.pine ?? 0.75) > 0.5), 463);
      } else if (r < 0.3 && fits(x, y, 14, 12)) {
        const list = hash(gx, gy, 464) < 0.6 ? BUSHES : FLOWERS;
        put(`decor${pick(list, hash(gx, gy, 465))}` as PieceName, x, y, hash(gx, gy, 466) < 0.5);
      }
    }
  }

  // Copses over open country, away from the roads: a clump of one kind, ringed with bushes.
  for (let gy = 10; gy < province.height; gy += 15) {
    for (let gx = 10; gx < province.width; gx += 17) {
      const x = gx + (hash(gx, gy, 470) - 0.5) * 14;
      const y = gy + (hash(gx, gy, 471) - 0.5) * 12;
      const c = fbm(x / 150, y / 130, 3, 472) + (noise(x / 30, y / 30, 473) - 0.5) * 0.12;
      if (c < 0.53 || at(x, y) !== Terrain.Grass || forestAmount(province, x, y) > 0.36 || nearPlace(x, y, 70) || isTaken(x, y, 20)) continue;
      if (c > 0.585) {
        if (hash(gx, gy, 474) < 0.85 && fits(x, y, 20, 40)) tree(x, y, lookOf(x, y, hash(Math.floor(x / 300), Math.floor(y / 300), 475) < 0.3), 476);
      } else if (hash(gx, gy, 477) < 0.35 && fits(x, y, 14, 16)) {
        put(`decor${pick(hash(gx, gy, 478) < 0.7 ? BUSHES : FLOWERS, hash(gx, gy, 479))}` as PieceName, x, y, hash(gx, gy, 480) < 0.5);
      }
    }
  }

  // Rolling hills in the downs, and rocks and mounds on the heath.
  for (const { kind, at: [cx, cy, rx, ry] } of province.regions ?? []) {
    if (kind === 'fields') continue;
    const step = kind === 'downs' ? 46 : 70;
    for (let y = cy - ry; y < cy + ry; y += step) {
      for (let x = cx - rx; x < cx + rx; x += step) {
        const jx = x + (hash(x, y, 481) - 0.5) * step * 0.8;
        const jy = y + (hash(x, y, 482) - 0.5) * step * 0.8;
        if (Math.hypot((jx - cx) / rx, (jy - cy) / ry) > 0.95 || hash(x, y, 483) > (kind === 'downs' ? 0.5 : 0.22)) continue;
        const list: PieceName[] = kind === 'downs' ? ['hillBig', 'hillWide', 'hill', 'hill', 'hillSmall', 'outcrop'] : ['outcrop2', 'outcrop3', 'rock', 'hillSmall', 'outcrop'];
        const name = pick(list, hash(x, y, 484));
        const p = piece(name);
        if (!p || !fits(jx, jy, p.sprite.width * 0.8, 30) || isTaken(jx, jy, p.sprite.width) || nearPlace(jx, jy, 60) || forestAmount(province, jx, jy) > 0.4) continue;
        put(name, jx, jy, hash(x, y, 485) < 0.5);
        take(jx, jy, p.sprite.width);
        take(jx, jy - 16, p.sprite.width);
      }
    }
  }

  // The river's banks: reeds at the water's edge, beds of flowers on the grass, a rock or a lily pad in the water.
  let s = 0;
  for (let n = 1; n < map.river.length; n++) {
    const [ax, ay] = map.river[n - 1];
    const [bx, by] = map.river[n];
    const len = Math.hypot(bx - ax, by - ay);
    for (let t = 0; t < len; t += 12, s += 12) {
      const x = ax + ((bx - ax) * t) / len;
      const y = ay + ((by - ay) * t) / len;
      const [nx, ny] = [-(by - ay) / len, (bx - ax) / len];
      const half = riverHalfWidth(s);
      if (road(x, y) < 40 || nearPlace(x, y, 50)) continue;
      for (const side of [-1, 1]) {
        const r = hash(Math.round(s), side, 490);
        const k = hash(Math.round(s), side, 491);
        if (r < 0.3) {
          const d = half + 1;
          put(pick(['reeds', 'reeds2', 'reeds3', 'reeds4'], k), x + nx * d * side, y + ny * d * side + 3, k < 0.5);
        } else if (r < 0.42) {
          const d = half + 16;
          const [fx, fy] = [x + nx * d * side, y + ny * d * side];
          const name = pick(r < 0.36 ? BEDS : SMALL_BEDS, k);
          const p = piece(name);
          if (p && at(fx, fy) === Terrain.Grass && road(fx, fy) > 16 && !isTaken(fx, fy, p.sprite.width)) {
            put(name, fx, fy, k < 0.5);
            take(fx, fy, p.sprite.width);
          }
        } else if (r < 0.46) {
          const d = half * 0.45;
          put(pick(['lily', 'lily', 'wetRock', 'wetRocks', 'wetRocks2'], k), x + nx * d * side, y + ny * d * side + 4, k < 0.5);
        }
      }
    }
  }

  // No bare stretch: any square of open country with nothing in it gets a tree and a bush or two, or a bed of flowers.
  for (let k = 0; k < count.length; k++) {
    if (count[k]) continue;
    const bx = (k % blocks) * BLOCK;
    const by = Math.floor(k / blocks) * BLOCK;
    for (let tries = 0; tries < 6; tries++) {
      const x = bx + 16 + hash(k, tries, 520) * (BLOCK - 32);
      const y = by + 16 + hash(k, tries, 521) * (BLOCK - 32);
      if (!fits(x, y, 24, 24) || nearPlace(x, y, 50) || isTaken(x, y, 24)) continue;
      const r = hash(k, tries, 522);
      if (r < 0.55) {
        tree(x, y, lookOf(x, y, false), 523);
        put(`decor${pick(BUSHES, hash(k, 1, 524))}` as PieceName, x + 14, y + 6, false);
        if (r < 0.3) tree(x - 14, y - 4, lookOf(x, y, false), 525);
      } else put(pick(BEDS, hash(k, 2, 526)), x, y, r < 0.75);
      break;
    }
  }
}
