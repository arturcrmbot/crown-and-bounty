import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../../content/aldmoor';
import { FENMARCH } from '../../content/fenmarch';
import { apply, endDay, locationById, type GameState } from '../game';
import { beginCommission, newGame } from '../scenario';
import { buildMap, cellIndex } from './model';
import { AMBUSH_REACH, amongTrees, hunting } from './roaming';
import { cellCentre, Terrain } from './model';

const aldmoor = (): GameState => ({ ...newGame(3, ALDMOOR, 'knight'), opening: undefined });
const fen = (army: GameState['army'], at: [number, number]): GameState => {
  const s = beginCommission(FENMARCH, 3, { ...newGame().campaign.start, army }, 1, []);
  return { ...s, hero: { ...s.hero, at } };
};
const nights = (s: GameState, n: number) => {
  for (let i = 0; i < n && !s.ambush; i++) s = endDay(s).state;
  return s;
};
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('enemies on the map', () => {
  it('keep their posts when they guard', () => {
    const s = nights(aldmoor(), 12);
    expect(locationById(s, 'highwaymen').at).toEqual(locationById(aldmoor(), 'highwaymen').at);
  });

  it('wander their territory when they roam, and never stand where nobody could', () => {
    const map = buildMap(ALDMOOR);
    const home = locationById(aldmoor(), 'poachers').at;
    let s = aldmoor();
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      s = endDay(s).state;
      const at = locationById(s, 'poachers').at;
      seen.add(String(at));
      expect(dist(at, home)).toBeLessThanOrEqual(60 * 1.6 + 8);
      expect(Number.isFinite(map.grid.cost[cellIndex(map, at[0], at[1])])).toBe(true);
    }
    expect(seen.size).toBeGreaterThan(3);
  });

  it('move the same way every time for the same seed', () => {
    expect(locationById(nights(aldmoor(), 6), 'poachers').at).toEqual(locationById(nights(aldmoor(), 6), 'poachers').at);
  });

  it('hold the old bridge: Pike\u2019s patrol never leaves it', () => {
    expect(locationById(nights(aldmoor(), 12), 'patrol').at).toEqual(locationById(aldmoor(), 'patrol').at);
  });

  it('come for a weaker hero in their territory, and fall on his camp at dawn', () => {
    const weak = fen([{ troop: 'peasants', count: 10 }], [470, 590]);
    expect(hunting(weak, locationById(weak, 'goblins'))).toBe(true);
    const s = nights(weak, 6);
    expect(s.ambush).toBe('goblins');
    expect(dist(locationById(s, 'goblins').at, s.hero.at)).toBeLessThanOrEqual(AMBUSH_REACH);
    // Nothing else until it's dealt with: running costs a fifth of the army.
    const fled = apply(s, { type: 'choose', id: 'goblins', choice: 'flee' })!.state;
    expect(fled.ambush).toBeUndefined();
    expect(fled.army[0].count).toBe(8);
    const fought = apply(s, { type: 'choose', id: 'goblins', choice: 'auto' })!.state;
    expect(fought.ambush).toBeUndefined();
    // Whatever came of it, they rest a few nights before they hunt again.
    expect(locationById(fled, 'goblins').enemy!.rest).toBe(3);
    expect(nights(fled, 2).ambush).toBeUndefined();
  });

  it('leave a stronger hero alone', () => {
    const strong = fen([{ troop: 'knights', count: 300 }], [470, 590]);
    expect(hunting(strong, locationById(strong, 'goblins'))).toBe(false);
    expect(nights(strong, 6).ambush).toBeUndefined();
  });

  it('give a day\u2019s warning before they fall on the camp, and never come into a town', () => {
    const weak = fen([{ troop: 'peasants', count: 10 }], [470, 590]);
    const first = endDay(weak);
    expect(first.state.ambush).toBeUndefined();
    expect(locationById(first.state, 'goblins').enemy!.trailing).toBe(true);
    const dawn = first.events.find((e) => e.type === 'card');
    expect(dawn?.type === 'card' && dawn.card.lines.some((l) => l.includes('on your trail'))).toBe(true);
    // Behind a town's walls, nothing comes for him.
    const town = weak.locations.find((l) => l.kind === 'village')!;
    const safe = { ...weak, hero: { ...weak.hero, at: town.at } };
    expect(hunting(safe, locationById(safe, 'goblins'))).toBe(false);
  });

  it('tell a ranger the trees will hide him too, and they do (#217)', () => {
    const weak = fen([{ troop: 'peasants', count: 10 }], [470, 590]);
    const map = buildMap(FENMARCH);
    const ranger: GameState = { ...weak, hero: { ...weak.hero, background: 'ranger' } };
    // Out in the open the goblins pick up his trail, and the warning names the trees as well as a town.
    const open = cellCentre(map, map.terrain.findIndex((t, i) => t === Terrain.Grass && Math.hypot(cellCentre(map, i)[0] - 470, cellCentre(map, i)[1] - 590) < 40));
    const exposed = { ...ranger, hero: { ...ranger.hero, at: open } };
    expect(amongTrees(exposed, open)).toBe(false);
    const warned = endDay(exposed).events.find((e) => e.type === 'card');
    expect(warned?.type === 'card' && warned.card.lines.find((l) => l.includes('on your trail'))).toMatch(/shelter in a town or among the trees, or turn and fight/);
    // A knight hears only of a town.
    const knight = endDay({ ...weak, hero: { ...weak.hero, at: open } }).events.find((e) => e.type === 'card');
    expect(knight?.type === 'card' && knight.card.lines.find((l) => l.includes('on your trail'))).toMatch(/shelter in a town, or turn and fight/);
    // Among the trees, nothing hunts him at all.
    const trees = cellCentre(map, map.terrain.findIndex((t) => t === Terrain.Forest));
    const hidden = { ...ranger, hero: { ...ranger.hero, at: trees } };
    expect(amongTrees(hidden, trees)).toBe(true);
    expect(amongTrees({ ...weak, hero: { ...weak.hero, at: trees } }, trees)).toBe(false);
    expect(hunting(hidden, locationById(hidden, 'goblins'))).toBe(false);
  });

  it('let villains recruit every payday, though the villain stays one', () => {
    let s = aldmoor();
    const lair = locationById(s, 'hideout').enemy!;
    const start = lair.army.find((a) => a.troop === 'swordsmen')!.count;
    for (let day = 1; day < 8; day++) s = endDay(s).state;
    const army = locationById(s, 'hideout').enemy!.army;
    expect(lair.grows).toBeGreaterThan(0);
    expect(army.find((a) => a.troop === 'swordsmen')!.count).toBe(Math.round(start * (1 + lair.grows!)));
    expect(army.find((a) => a.troop === 'baron')!.count).toBe(1);
  });
});
