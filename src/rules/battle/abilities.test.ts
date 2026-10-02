import { describe, expect, it } from 'vitest';
import type { TroopId } from '../../content/troops';
import { battleAct, createBattle, fighterById, isCharge, options, type BattleEvent, type BattleHero, type BattleState } from './battle';
import { hexIndex } from './hex';

const hero: BattleHero = { attack: 1, defence: 1, spellPower: 2, mana: 20, spells: [], castRound: 0 };
/** A battle with the stacks where `at` puts them (by id: yours first, then theirs), and `order` to act. */
const field = (player: [TroopId, number][], enemy: [TroopId, number][], at: Record<number, number>, order: number[], more: Partial<BattleHero> = {}): BattleState => {
  const b = createBattle({ place: 'test', seed: 7, player: player.map(([troop, count]) => ({ troop, count })), enemy: enemy.map(([troop, count]) => ({ troop, count })), hero: { ...hero, ...more }, obstacles: 0 });
  return { ...b, order, fighters: b.fighters.map((f) => (at[f.id] !== undefined ? { ...f, at: at[f.id] } : f)) };
};
const hits = (events: BattleEvent[]) => events.filter((e): e is Extract<BattleEvent, { type: 'hit' }> => e.type === 'hit');

describe('Set Pikes', () => {
  // Knights clear of the line, with a run of three to the hex beside it: a charge, against anyone but pikes.
  const run = (troop: TroopId) => field([['knights', 20]], [[troop, 40]], { 0: hexIndex(2, 4), 1: hexIndex(6, 4) }, [0, 1], { charge: ['knights'] });
  const blow = { type: 'melee' as const, target: 1, from: hexIndex(5, 4) };

  it('takes the charge out of a charge: no bonus, the pikes strike first, and nobody is winded', () => {
    const swords = run('swordsmen');
    expect(isCharge(swords, fighterById(swords, 0), blow.from)).toBe(true);
    const pikes = run('pikemen');
    expect(isCharge(pikes, fighterById(pikes, 0), blow.from, options(pikes).moves, fighterById(pikes, 1))).toBe(false);
    const { battle, events } = battleAct(pikes, blow, true);
    const [first, knights] = hits(events);
    expect(first).toMatchObject({ attacker: 1, target: 0, retaliation: false });
    expect(knights).toMatchObject({ attacker: 0, target: 1, braced: true });
    expect(knights.charge).toBeUndefined();
    expect(hits(events)).toHaveLength(2);
    expect(fighterById(battle, 0).status).not.toContain('winded');
  });

  it('lets the knights hit pikemen as hard as a plain blow, no harder', () => {
    const knights = hits(battleAct(run('pikemen'), blow, true).events)[1];
    // The same blow from beside them, with no run-up: the pikes strike first either way.
    const close = field([['knights', 20]], [['pikemen', 40]], { 0: hexIndex(5, 4), 1: hexIndex(6, 4) }, [0, 1], { charge: ['knights'] });
    const plain = hits(battleAct(close, blow, true).events)[1];
    expect(plain.braced).toBeUndefined();
    expect(knights.damage).toBe(plain.damage);
  });
});
