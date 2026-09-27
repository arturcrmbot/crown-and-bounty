import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../../content/aldmoor';
import { FENMARCH } from '../../content/fenmarch';
import { apply, endDay, locationById, type GameState } from '../game';
import { beginCommission, newGame } from '../scenario';
import { buildMap, cellIndex } from './model';
import { AMBUSH_REACH, hunting } from './roaming';

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
    expect(locationById(s, 'wolves').at).toEqual(locationById(aldmoor(), 'wolves').at);
  });

  it('wander their territory when they roam, and never stand where nobody could', () => {
    const map = buildMap(ALDMOOR);
    const home = locationById(aldmoor(), 'patrol').at;
    let s = aldmoor();
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      s = endDay(s).state;
      const at = locationById(s, 'patrol').at;
      seen.add(String(at));
      expect(dist(at, home)).toBeLessThanOrEqual(90 * 1.6 + 8);
      expect(Number.isFinite(map.grid.cost[cellIndex(map, at[0], at[1])])).toBe(true);
    }
    expect(seen.size).toBeGreaterThan(3);
  });

  it('move the same way every time for the same seed', () => {
    expect(locationById(nights(aldmoor(), 6), 'patrol').at).toEqual(locationById(nights(aldmoor(), 6), 'patrol').at);
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

  it('let villains recruit every payday, though the villain stays one', () => {
    let s = aldmoor();
    for (let day = 1; day < 8; day++) s = endDay(s).state;
    const army = locationById(s, 'hideout').enemy!.army;
    expect(army.find((a) => a.troop === 'swordsmen')!.count).toBe(Math.round(48 * 1.05));
    expect(army.find((a) => a.troop === 'baron')!.count).toBe(1);
  });
});
