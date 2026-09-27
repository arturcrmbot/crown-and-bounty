import { provinceOf } from '../campaign';
import type { GameState } from '../state';
import { buildMap, type MapModel } from './model';

/** The logical map of each province, built once: the rules need it every night, the screens all the time. */
const maps = new Map<string, MapModel>();

export function mapOf(state: GameState): MapModel {
  const province = provinceOf(state);
  let map = maps.get(province.id);
  if (!map) {
    if (maps.size > 6) maps.clear();
    map = buildMap(province);
    maps.set(province.id, map);
  }
  return map;
}
