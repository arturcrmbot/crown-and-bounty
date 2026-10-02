import { describe, expect, it } from 'vitest';
import type { TroopId } from '../../content/troops';
import { battleAct, createBattle, fighterById, isCharge, options, strike, type BattleEvent, type BattleHero, type BattleState } from './battle';
import { hexIndex, neighbours } from './hex';

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

describe('Plate Armour', () => {
  it('halves what a shot does to men-at-arms, and says so, but not a blow', () => {
    const b = field([['archers', 30]], [['menAtArms', 20], ['knights', 20]], {}, [0, 1, 2]);
    const [archers, plate, knights] = b.fighters;
    const shot = strike(b, archers, plate, true);
    expect(shot.plate).toBe(true);
    expect(strike(b, archers, knights, true).plate).toBeUndefined();
    // An archer's blow at close quarters is half his shot, and plate doesn't touch it: so it matches a shot that plate halved.
    const blow = strike(b, archers, plate, false);
    expect(blow.plate).toBeUndefined();
    expect(Math.abs(shot.damage - blow.damage)).toBeLessThanOrEqual(1);
    // The shot's hit says so, for the floater and the log.
    const fired = battleAct(b, { type: 'shoot', target: 1 }, true);
    expect(hits(fired.events)[0]).toMatchObject({ target: 1, ranged: true, plate: true });
  });
});

describe('Backstab', () => {
  // Their cutpurses (2) go for your knights (0); in the second battle their swordsmen (3) already stand beside the knights.
  const knights = hexIndex(4, 4);
  const [beside, other] = neighbours(knights);
  const alone = field([['knights', 10], ['archers', 10]], [['cutpurses', 30], ['swordsmen', 10]], { 0: knights, 1: hexIndex(0, 0), 2: beside, 3: hexIndex(10, 8) }, [2, 0, 1, 3]);
  const flanked = field([['knights', 10], ['archers', 10]], [['cutpurses', 30], ['swordsmen', 10]], { 0: knights, 1: hexIndex(0, 0), 2: beside, 3: other }, [2, 0, 1, 3]);
  const stab = { type: 'melee' as const, target: 0, from: beside };

  it('doubles a cutpurse\u2019s blow when one of theirs is at the stack already, and says so', () => {
    const plain = hits(battleAct(alone, stab, true).events)[0];
    const doubled = hits(battleAct(flanked, stab, true).events)[0];
    expect(plain.backstab).toBeUndefined();
    expect(doubled.backstab).toBe(true);
    expect(Math.abs(doubled.damage - plain.damage * 2)).toBeLessThanOrEqual(1);
  });

  it('is the cutpurses\u2019 own: swordsmen beside a friend hit no harder', () => {
    const b = field([['knights', 10]], [['swordsmen', 30], ['cutpurses', 10]], { 0: knights, 1: beside, 2: other }, [1, 0, 2]);
    expect(strike(b, fighterById(b, 1), fighterById(b, 0), false).backstab).toBeUndefined();
  });
});
