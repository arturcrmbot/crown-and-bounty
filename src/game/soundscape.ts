import type { Soundscape } from '../audio/ambience';
import type { GameState } from '../rules/game';
import { lineAt, type Point } from '../rules/map/geometry';
import { CELL, Terrain, type MapModel } from '../rules/map/model';

/** Every `step` pixels along a polyline. */
function along(line: readonly Point[], step: number): Point[] {
  const out: Point[] = [];
  let next = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const d = Math.hypot(bx - ax, by - ay);
    let t = next;
    for (; t < d; t += step) out.push([ax + ((bx - ax) * t) / d, ay + ((by - ay) * t) / d]);
    next = t - d;
  }
  return out;
}

/** The centres of cells of these kinds of terrain, every `stride` cells each way. */
function cellsOf(map: MapModel, kinds: number[], stride: number): Point[] {
  const out: Point[] = [];
  for (let cy = stride >> 1; cy < map.height; cy += stride) {
    for (let cx = stride >> 1; cx < map.width; cx += stride) {
      if (kinds.includes(map.terrain[cy * map.width + cx])) out.push([cx * CELL + CELL / 2, cy * CELL + CELL / 2]);
    }
  }
  return out;
}

/**
 * Where the land makes its sounds, read once from the map as the rules see it: the river and the
 * falls where it drops over the cliff, the fen's pools, woods, crags and cliffs, and the places.
 */
export function soundscapeOf(map: MapModel, state: GameState): Soundscape {
  const { province } = map;
  const river = along(map.river, 24);
  const cliff = map.cliff;
  const falls: Point[] = [];
  if (cliff && province.cliff) {
    const drop = river.filter(([x, y]) => {
      const top = lineAt(cliff, x);
      return top !== undefined && y >= top - 12 && y <= top + province.cliff!.height + 12;
    });
    // One roar, from the middle of the drop.
    if (drop.length) falls.push([drop.reduce((s, [x]) => s + x, 0) / drop.length, drop.reduce((s, [, y]) => s + y, 0) / drop.length]);
  }
  const still: Point[] = [];
  for (const [cx, cy, rx, ry] of province.pools ?? []) {
    for (let y = cy - ry; y <= cy + ry; y += 32) for (let x = cx - rx; x <= cx + rx; x += 32) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) still.push([x, y]);
    still.push([cx, cy]);
  }
  const at = (test: (l: GameState['locations'][number]) => boolean) => state.locations.filter(test).map((l) => l.at);
  return {
    river,
    falls,
    still,
    woods: cellsOf(map, [Terrain.Forest], 4),
    high: [...cellsOf(map, [Terrain.Cliff, Terrain.Rock], 4), ...province.crags.map(([x, y, , h]) => [x, y - h / 2] as Point)],
    // Villages and castles talk and ring with the smith; the deserters' camp and the archery range have sounds of their own.
    town: at((l) => (l.kind === 'village' || l.kind === 'castle') && l.look !== 'range' && l.look !== 'camp'),
    butts: at((l) => l.look === 'range'),
    crows: at((l) => l.kind === 'tower' && l.look !== 'abbey'),
    abbey: at((l) => l.kind === 'tower' && l.look === 'abbey'),
    mill: at((l) => l.kind === 'mill'),
    mine: at((l) => l.kind === 'mine'),
    fen: Boolean(province.fen),
  };
}
