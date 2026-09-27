import { describe, expect, it } from 'vitest';
import { autoResolve, chooseAction } from './ai';
import { activeFighter, battleAct, createBattle, fighterById, options, QUIET_ROUNDS, spellDamage, strike, wound, type BattleHero, type BattleState } from './battle';
import { colOf, distance, hexIndex, neighbours, reachable } from './hex';

const hero: BattleHero = { attack: 1, defence: 1, spellPower: 2, mana: 20, spells: ['bolt', 'bless', 'slow'], castRound: 0 };
const battle = (player: BattleState['fighters'][number]['troop'][], counts: number[], enemy: BattleState['fighters'][number]['troop'][], enemyCounts: number[], seed = 7) =>
  createBattle({
    place: 'test',
    seed,
    player: player.map((troop, i) => ({ troop, count: counts[i] })),
    enemy: enemy.map((troop, i) => ({ troop, count: enemyCounts[i] })),
    hero,
    obstacles: 0,
  });

describe('the hex field', () => {
  it('has six neighbours inside and measures steps', () => {
    expect(neighbours(hexIndex(5, 4))).toHaveLength(6);
    expect(neighbours(hexIndex(0, 0)).length).toBeLessThan(6);
    expect(distance(hexIndex(0, 4), hexIndex(10, 4))).toBe(10);
    expect(distance(hexIndex(3, 3), hexIndex(4, 4))).toBe(1);
  });

  it('finds paths round rocks', () => {
    const rock = hexIndex(1, 4);
    expect(reachable(hexIndex(0, 4), 2, () => false).has(hexIndex(2, 4))).toBe(true);
    const paths = reachable(hexIndex(0, 4), 2, (i) => i === rock);
    expect(paths.has(rock)).toBe(false);
    expect(paths.has(hexIndex(2, 4))).toBe(false);
    expect(reachable(hexIndex(0, 4), 3, (i) => i === rock).get(hexIndex(2, 4))).toHaveLength(3);
  });
});

describe('a battle', () => {
  it('lines the armies up on opposite edges, fastest first', () => {
    const b = battle(['knights', 'archers'], [12, 25], ['wolves'], [20]);
    expect(b.fighters.filter((f) => f.side === 'player').every((f) => colOf(f.at) === 0)).toBe(true);
    expect(b.fighters.filter((f) => f.side === 'enemy').every((f) => colOf(f.at) === 10)).toBe(true);
    expect(fighterById(b, b.order[0]).troop).toBe('wolves');
  });

  it('works out wounds on the top troop', () => {
    const b = battle(['knights'], [1], ['swordsmen'], [10]);
    const swordsmen = b.fighters[1];
    expect(wound(swordsmen, 40)).toEqual({ count: 9, hp: 8, killed: 1 });
    expect(wound(swordsmen, 48)).toEqual({ count: 8, hp: 24, killed: 2 });
    expect(wound(swordsmen, 1000).count).toBe(0);
  });

  it('retaliates once a round', () => {
    let b = battle(['knights', 'knights'], [10, 10], ['swordsmen'], [30]);
    b = { ...b, fighters: b.fighters.map((f) => (f.side === 'enemy' ? { ...f, at: hexIndex(1, 4) } : f)), order: [0, 1, 2] };
    const first = battleAct(b, { type: 'melee', target: 2, from: hexIndex(0, 4) });
    expect(first.events.filter((e) => e.type === 'hit')).toHaveLength(2);
    const from = options(first.battle).melee.find((m) => m.target === 2)!.from;
    const second = battleAct(first.battle, { type: 'melee', target: 2, from });
    expect(second.events.filter((e) => e.type === 'hit')).toHaveLength(1);
  });

  it('stops archers shooting with an enemy next to them, and counts arrows', () => {
    const b = battle(['archers'], [20], ['swordsmen'], [5]);
    const ready = { ...b, order: [0, 1] };
    expect(options(ready).shoot).toEqual([1]);
    const shot = battleAct(ready, { type: 'shoot', target: 1 });
    expect(fighterById(shot.battle, 0).shots).toBe(11);
    const pinned = { ...ready, fighters: ready.fighters.map((f) => (f.side === 'enemy' ? { ...f, at: hexIndex(1, 4) } : f)) };
    expect(options(pinned).shoot).toEqual([]);
  });

  it('lets trolls heal half the top troll\u2019s health at the start of their turn', () => {
    const b = battle(['archers'], [20], ['trolls'], [3]);
    const ready = { ...b, order: [0, 1] };
    const shot = battleAct(ready, { type: 'shoot', target: 1 });
    const troll = fighterById(shot.battle, 1);
    const hurt = 70 - (shot.events.find((e) => e.type === 'hit') as { damage: number }).damage;
    expect(shot.battle.order[0]).toBe(1);
    expect(troll.hp).toBe(Math.min(70, hurt + 35));
    expect(shot.events.some((e) => e.type === 'regen' && e.fighter === 1)).toBe(true);
  });

  it('lets the witch\u2019s hexes slow whatever they hit', () => {
    const b = battle(['knights'], [10], ['witch'], [1]);
    const ready = { ...b, order: [1, 0] };
    const hexed = battleAct(ready, { type: 'shoot', target: 0 });
    expect(fighterById(hexed.battle, 0).status).toContain('slowed');
    expect(hexed.events.some((e) => e.type === 'hit' && e.hexed)).toBe(true);
  });

  it('ends a battle nobody can land a blow in: the weaker side gives up the field', () => {
    const b = battle(['knights'], [10], ['goblins'], [5]);
    const quiet = { ...b, order: [0], quiet: QUIET_ROUNDS - 1, struck: false };
    const end = battleAct(quiet, { type: 'defend' });
    expect(end.battle.result).toBe('won');
    expect(end.events.at(-1)).toMatchObject({ type: 'end', result: 'won', rout: true });
    const busy = battleAct({ ...quiet, struck: true }, { type: 'defend' });
    expect(busy.battle.result).toBeUndefined();
  });

  it('makes defenders harder to hurt, and lets a stack wait until last', () => {
    const b = battle(['knights'], [10], ['swordsmen'], [10]);
    const target = b.fighters[1];
    expect(strike(b, b.fighters[0], { ...target, defending: true }, false).damage).toBeLessThan(strike(b, b.fighters[0], target, false).damage);
    const waited = battleAct({ ...b, order: [0, 1] }, { type: 'wait' });
    expect(waited.battle.order).toEqual([1, 0]);
  });

  it('casts one spell a round, paid in mana, without using up the stack\u2019s turn', () => {
    const b = battle(['knights'], [10], ['swordsmen'], [30]);
    const acting = activeFighter(b)!.id;
    const cast = battleAct(b, { type: 'cast', spell: 'bolt', target: 1 });
    expect(cast.events[0]).toMatchObject({ type: 'spell', damage: spellDamage(b, 'bolt') });
    expect(cast.battle.hero.mana).toBe(13);
    expect(activeFighter(cast.battle)!.id).toBe(acting);
    expect(battleAct(cast.battle, { type: 'cast', spell: 'bolt', target: 1 }).events).toHaveLength(0);
  });

  it('always gives the AI a legal move, and plays to a finish the same way every time', () => {
    const b = battle(['knights', 'archers'], [12, 25], ['swordsmen', 'crossbowmen'], [18, 12], 3);
    const action = chooseAction(b);
    expect(battleAct(b, action).events.length).toBeGreaterThan(0);
    const one = autoResolve(b);
    expect(one.result).toBeDefined();
    expect(autoResolve(b)).toEqual(one);
  });

  it('lets the starting army beat Grimsby\u2019s patrol most of the time', () => {
    let wins = 0;
    for (let seed = 1; seed <= 30; seed++) if (autoResolve(battle(['knights', 'archers'], [12, 25], ['swordsmen', 'crossbowmen'], [18, 12], seed)).result === 'won') wins++;
    expect(wins).toBeGreaterThanOrEqual(24);
  });
});
