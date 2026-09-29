import type { GameState } from '../rules/game';
import type { Point } from '../rules/map/geometry';
import { CELL, Terrain, type MapModel } from '../rules/map/model';
import { hash } from '../rules/noise';
import { Weather, type Sky } from '../render/weather';

/** Where smoke rises: the smoke hole in every cottage's thatch, and the kitchens of castles. */
function chimneysOf(map: MapModel, state: GameState): Point[] {
  const huts = map.province.decor.filter((d) => d.sprite === 'hut').map((d) => [d.at[0] + 3, d.at[1] - 24] as Point);
  const castles = state.locations.filter((l) => l.kind === 'castle').map((l) => [l.at[0] + 18, l.at[1] - 78] as Point);
  return [...huts, ...castles];
}

/** Where fireflies dance at night: along the edges of the woods, and over the fen's pools. */
function gladesOf(map: MapModel): Point[] {
  const out: Point[] = [];
  const at = (x: number, y: number) => {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    return cx >= 0 && cy >= 0 && cx < map.width && cy < map.height ? map.terrain[cy * map.width + cx] : Terrain.Grass;
  };
  for (let y = 24; y < map.height * CELL; y += 48) {
    for (let x = 24; x < map.width * CELL; x += 48) {
      const edge = at(x, y) === Terrain.Forest && [[40, 0], [-40, 0], [0, 40], [0, -40]].some(([dx, dy]) => at(x + dx, y + dy) !== Terrain.Forest);
      if (edge && hash(x, y, 113) < 0.5) out.push([x, y]);
    }
  }
  for (const [cx, cy, rx, ry] of map.province.pools ?? []) {
    for (let a = 0; a < Math.PI * 2; a += 1.3) out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

export const weatherOf = (map: MapModel, state: GameState) => new Weather(chimneysOf(map, state), gladesOf(map));

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** When the day's shower comes (seconds into the day), and how long it takes to pass. */
const SHOWER_AT = 18;
const SHOWER_FOR = 40;

/** Whether a shower passes over today: about one day in four, never the first. */
export const showerDay = (state: GameState) => state.day > 1 && hash(state.day, state.campaign.chapter, 131) < 0.28;

/**
 * The sky over the map: the light follows the day, the fen is misty at dawn (and a little at
 * night), some days a shower passes, and the heath has a wind in the heather.
 */
export function skyOf(state: GameState, fen: boolean, day: number, night: number, time: number, sinceDawn: number): Sky {
  const rain = showerDay(state) ? smooth(SHOWER_AT, SHOWER_AT + 5, sinceDawn) * (1 - smooth(SHOWER_AT + SHOWER_FOR - 6, SHOWER_AT + SHOWER_FOR, sinceDawn)) : 0;
  return {
    day,
    time,
    night,
    mist: fen ? Math.max(0.5 * (1 - smooth(0, 0.35, day)), night * 0.25) : 0,
    rain,
    wind: fen ? 0 : 0.55 + 0.35 * Math.sin(time * 0.13),
  };
}
