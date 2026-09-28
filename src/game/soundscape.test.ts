import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { FENMARCH } from '../content/fenmarch';
import { commissionAt } from '../rules/campaign';
import { mapOf } from '../rules/map/maps';
import { beginCommission, newGame } from '../rules/scenario';
import { soundscapeOf } from './soundscape';

describe('the sounds of the land', () => {
  it('Aldmoor: the river and its falls, the woods and crags, the castle and village, crows at the tower, the mill and the mine', () => {
    const state = newGame(7, ALDMOOR, 'knight');
    const s = soundscapeOf(mapOf(state), state);
    expect(s.river.length).toBeGreaterThan(20);
    expect(s.falls).toHaveLength(1);
    // The falls are where the river drops over the cliff.
    const [fx, fy] = s.falls[0];
    expect(s.river.some(([x, y]) => Math.hypot(x - fx, y - fy) < 40)).toBe(true);
    expect(s.woods.length).toBeGreaterThan(50);
    expect(s.high.length).toBeGreaterThan(10);
    expect(s.town).toHaveLength(2);
    expect(s.crows).toHaveLength(1);
    expect(s.abbey).toHaveLength(0);
    expect(s.mill).toHaveLength(1);
    expect(s.mine.length).toBeGreaterThanOrEqual(1);
    expect(s.butts).toHaveLength(1);
    expect(s.fen).toBe(false);
  });

  it('the Fenmarch: still pools with frogs, and a bell at the abbey instead of crows', () => {
    const state = beginCommission(FENMARCH, 1, newGame().campaign.start, 1, []);
    const s = soundscapeOf(mapOf(state), state);
    expect(s.fen).toBe(true);
    expect(s.still.length).toBeGreaterThan(10);
    expect(s.abbey).toHaveLength(1);
    expect(s.crows).toHaveLength(0);
  });

  it('a generated province has a sound for each of its places', () => {
    const first = newGame(11);
    const state = beginCommission(commissionAt(first.campaign, 2).province, 3, first.campaign.start, 2, [], 11);
    const s = soundscapeOf(mapOf(state), state);
    expect(s.town.length).toBeGreaterThanOrEqual(2);
    expect(s.crows.length + s.abbey.length).toBe(1);
    expect(s.mill).toHaveLength(1);
    expect(s.woods.length).toBeGreaterThan(20);
  });
});
