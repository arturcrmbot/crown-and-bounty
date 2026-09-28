import { describe, expect, it } from 'vitest';
import { TROOPS, type TroopId } from '../../content/troops';
import { finishFight, startFight, type GameState } from '../game';
import { newGame } from '../scenario';
import { autoResolve, castActions } from './ai';
import { activeFighter, battleAct, canCast, castsLeft, createBattle, fighterById, statsOf, type BattleHero, type BattleState, type Fighter } from './battle';
import { COLS, neighbours } from './hex';

const hero: BattleHero = { attack: 2, defence: 2, spellPower: 2, mana: 20, spells: ['bolt'], castRound: 0 };
const army = (...stacks: [TroopId, number][]) => stacks.map(([troop, count]) => ({ troop, count }));
const baronFight = (me: Partial<BattleHero> = {}) =>
  createBattle({ place: 'hideout', seed: 7, player: army(['knights', 10], ['archers', 20]), enemy: army(['swordsmen', 20], ['crossbowmen', 10], ['baron', 1]), hero: { ...hero, ...me } });
const of = (b: BattleState, troop: TroopId) => b.fighters.find((f) => f.troop === troop)!;
/** The battle with `troop`'s stack acting now. */
const turnOf = (b: BattleState, troop: TroopId): BattleState => {
  const id = of(b, troop).id;
  return { ...b, order: [id, ...b.order.filter((x) => x !== id)] };
};
const change = (b: BattleState, id: number, to: Partial<Fighter>): BattleState => ({ ...b, fighters: b.fighters.map((f) => (f.id === id ? { ...f, ...to } : f)) });

describe('villains who cast and give orders', () => {
  it('leads with a spellbook of his own: spells, mana and orders, all from his troop data', () => {
    const b = baronFight();
    const baron = of(b, 'baron');
    expect(baron.book).toMatchObject({ name: 'Baron Grimsby', mana: 15, spells: ['haste', 'slow'] });
    expect(baron.book!.charges).toEqual(TROOPS.baron.caster!.charges);
    expect(baron.book!.charges).not.toBe(TROOPS.baron.caster!.charges);
    expect(b.fighters.filter((f) => f.book)).toHaveLength(1);
  });

  it('bellows "Shield wall!": +3 defence on every stack of his for two rounds, for no mana, and his men still act', () => {
    const b = turnOf(baronFight(), 'crossbowmen');
    const baron = of(b, 'baron');
    const before = statsOf(b, of(b, 'swordsmen')).defence;
    const { battle, events } = battleAct(b, { type: 'cast', spell: 'shieldwall', by: baron.id });
    expect(events.filter((e) => e.type === 'spell' && e.by === baron.id)).toHaveLength(3);
    for (const f of battle.fighters) expect(f.status.includes('shieldwall')).toBe(f.side === 'enemy');
    expect(statsOf(battle, of(battle, 'swordsmen')).defence).toBe(before + 3);
    const book = fighterById(battle, baron.id).book!;
    expect(book.mana).toBe(15);
    expect(book.charges!.find((c) => c.spell === 'shieldwall')!.uses).toBe(0);
    // One cast a round, and the crossbowmen whose turn it was still take it.
    expect(castsLeft(battle, baron.id)).toBe(0);
    expect(canCast(battle, 'crossbows', baron.id)).toBe(false);
    expect(activeFighter(battle)!.id).toBe(of(b, 'crossbowmen').id);
    // It holds through the next round, and is gone as the one after begins.
    let later = battle;
    while (later.round < 2) later = battleAct(later, { type: 'defend' }).battle;
    expect(of(later, 'swordsmen').status).toContain('shieldwall');
    while (later.round < 3) later = battleAct(later, { type: 'defend' }).battle;
    expect(of(later, 'swordsmen').status).not.toContain('shieldwall');
  });

  it('bellows "Crossbows, fire!": every shooter of his looses at once, at whoever it would hurt most', () => {
    const b = turnOf(baronFight(), 'swordsmen');
    const baron = of(b, 'baron');
    const { battle, events } = battleAct(b, { type: 'cast', spell: 'crossbows', by: baron.id });
    expect(events[0]).toMatchObject({ type: 'volley', side: 'enemy', spell: 'crossbows', by: baron.id });
    const shots = events.filter((e) => e.type === 'hit');
    expect(shots).toHaveLength(1);
    expect(shots[0]).toMatchObject({ attacker: of(b, 'crossbowmen').id, ranged: true });
    expect(of(battle, 'crossbowmen').shots).toBe(of(b, 'crossbowmen').shots - 1);
    expect(activeFighter(battle)!.id).toBe(of(b, 'swordsmen').id);
  });

  it('roars "Call the guard!" once he is hurt: fresh swordsmen march in at his edge of the field, next round', () => {
    let b = turnOf(baronFight(), 'swordsmen');
    const baron = of(b, 'baron');
    expect(canCast(b, 'guard', baron.id)).toBe(false);
    b = change(b, baron.id, { hp: 90 });
    expect(canCast(b, 'guard', baron.id)).toBe(true);
    const { battle, events } = battleAct(b, { type: 'cast', spell: 'guard', by: baron.id });
    const summon = events.find((e) => e.type === 'summon')!;
    expect(summon).toMatchObject({ spell: 'guard', by: baron.id });
    const fresh = fighterById(battle, (summon as { fighter: number }).fighter);
    expect(fresh).toMatchObject({ side: 'enemy', troop: 'swordsmen', count: 6, startCount: 6 });
    expect(fresh.at % COLS).toBe(COLS - 1);
    expect(battle.order).not.toContain(fresh.id);
    expect(canCast(battle, 'guard', baron.id)).toBe(false);
  });

  it('casts only while he stands, on his own side\u2019s turns', () => {
    const b = baronFight();
    const baron = of(b, 'baron');
    expect(battleAct(turnOf(b, 'knights'), { type: 'cast', spell: 'shieldwall', by: baron.id }).events).toHaveLength(0);
    const down = change(turnOf(b, 'swordsmen'), baron.id, { count: 0, hp: 0 });
    expect(canCast(down, 'shieldwall', baron.id)).toBe(false);
    expect(castActions(down).some((a) => a.type === 'cast')).toBe(false);
  });

  it('Mother Mirrow turns your stacks into newts, slows them, and brews her own back up; a newt can\u2019t cast', () => {
    const b = createBattle({ place: 'hideout', seed: 3, player: army(['knights', 10], ['archers', 20]), enemy: army(['trolls', 6], ['goblins', 60], ['witch', 1]), hero: { ...hero, unit: { troop: 'heroWizard', hp: 50, damage: [4, 6] } } });
    const witch = of(b, 'witch');
    expect(witch.book).toMatchObject({ name: 'Mother Mirrow', mana: 14, spells: ['newts', 'slow', 'brew'] });
    // She turns Aldric himself into a newt: no spells till he's himself again.
    const aldric = b.fighters.find((f) => f.hero)!;
    const newt = battleAct(turnOf(b, 'goblins'), { type: 'cast', spell: 'newts', target: aldric.id, by: witch.id }).battle;
    expect(fighterById(newt, aldric.id).status).toContain('newts');
    expect(fighterById(newt, witch.id).book!.mana).toBe(8);
    expect(canCast(turnOf(newt, 'archers'), 'bolt')).toBe(false);
    // Left to herself, she casts.
    const end = autoResolve(b);
    expect(of(end, 'witch').book!.mana).toBeLessThan(14);
  });

  it('Aunt Bramble turns your stacks into frogs, and throws bolts', () => {
    const b = createBattle({ place: 'hideout', seed: 5, player: army(['knights', 10], ['archers', 20]), enemy: army(['trolls', 6], ['goblins', 60], ['bramble', 1]), hero });
    const bramble = of(b, 'bramble');
    expect(bramble.book).toMatchObject({ name: 'Aunt Bramble', spellPower: 3, spells: ['frogs', 'bolt', 'brew'] });
    const frogs = battleAct(turnOf(b, 'goblins'), { type: 'cast', spell: 'frogs', target: of(b, 'knights').id, by: bramble.id }).battle;
    expect(of(frogs, 'knights').status).toContain('frogs');
    const bolt = battleAct(turnOf(b, 'goblins'), { type: 'cast', spell: 'bolt', target: of(b, 'archers').id, by: bramble.id }).events[0];
    expect(bolt).toMatchObject({ type: 'spell', spell: 'bolt', by: bramble.id, damage: 60 });
  });

  it('uses his tricks when he fights it out: the enemy AI casts and gives orders', () => {
    const end = autoResolve(baronFight());
    const book = of(end, 'baron').book!;
    const used = book.charges!.reduce((sum, c) => sum + c.uses, 0) < TROOPS.baron.caster!.charges!.reduce((sum, c) => sum + c.uses, 0);
    expect(used || book.mana < 15).toBe(true);
  });
});

describe('what spells and heroes can do', () => {
  it('heals: health back, and the fallen get up again, but no more than the stack began with', () => {
    let b = turnOf(baronFight({ spells: ['brew'] }), 'archers');
    const archers = of(b, 'archers');
    b = change(b, archers.id, { count: 17, hp: 4 });
    const { battle, events } = battleAct(b, { type: 'cast', spell: 'brew', target: archers.id });
    // 15 health a point of spell power, 30 in all, on 16 whole archers and one with 4 left.
    expect(events[0]).toMatchObject({ type: 'spell', spell: 'brew', healed: 30, raised: 2 });
    expect(of(battle, 'archers')).toMatchObject({ count: 19, hp: 6 });
    const most = battleAct(change(b, archers.id, { count: 20, hp: 1 }), { type: 'cast', spell: 'brew', target: archers.id }).battle;
    expect(of(most, 'archers')).toMatchObject({ count: 20, hp: 14 });
  });

  it('wards his own stacks as the battle opens, and says where each status came from', () => {
    const b = baronFight({ wards: { archers: ['stoneskin'] }, slows: ['swordsmen'], brought: [{ source: 'Armourer', side: 'player', troops: ['archers'], status: 'stoneskin' }, { source: 'Stakes (Advanced Scouting)', side: 'enemy', troops: ['swordsmen'], status: 'slowed' }] });
    expect(of(b, 'archers').status).toEqual(['stoneskin']);
    expect(of(b, 'knights').status).toEqual([]);
    expect(of(b, 'swordsmen').status).toEqual(['slowed']);
    expect(b.opening).toEqual([
      { source: 'Armourer', status: 'stoneskin', fighters: [of(b, 'archers').id] },
      { source: 'Stakes (Advanced Scouting)', status: 'slowed', fighters: [of(b, 'swordsmen').id] },
    ]);
  });

  it('casts from a charge for no mana, but it takes one of the round\u2019s casts all the same', () => {
    const charges = [{ spell: 'fireball' as const, uses: 2 }];
    const b = turnOf(baronFight({ charges }), 'archers');
    expect(canCast(b, 'fireball')).toBe(true);
    const { battle } = battleAct(b, { type: 'cast', spell: 'fireball', target: of(b, 'swordsmen').id });
    expect(battle.hero.mana).toBe(20);
    expect(battle.hero.charges).toEqual([{ spell: 'fireball', uses: 1 }]);
    expect(castsLeft(battle)).toBe(0);
    expect(charges[0].uses).toBe(2);
  });

  it('turns a stack into newts: it can\u2019t strike back, loses its next turn, and is itself again', () => {
    let b = baronFight({ spells: ['newts'] });
    const newts = of(b, 'swordsmen');
    const knights = of(b, 'knights');
    const beside = neighbours(newts.at).find((i) => !b.obstacles.includes(i) && !b.fighters.some((f) => f.at === i))!;
    b = change(b, knights.id, { at: beside });
    b = { ...b, order: [knights.id, newts.id, ...b.order.filter((x) => x !== knights.id && x !== newts.id)] };
    b = battleAct(b, { type: 'cast', spell: 'newts', target: newts.id }).battle;
    expect(of(b, 'swordsmen').status).toContain('newts');
    const blow = battleAct(b, { type: 'melee', target: newts.id, from: beside });
    expect(blow.events.filter((e) => e.type === 'hit')).toHaveLength(1);
    expect(blow.events).toContainEqual({ type: 'skip', fighter: newts.id, status: 'newts' });
    expect(of(blow.battle, 'swordsmen').status).not.toContain('newts');
    expect(activeFighter(blow.battle)!.id).not.toBe(newts.id);
  });
});

describe('a battle called off with only Aldric left', () => {
  it('says he gets away alone, and sends him home to raise another army', () => {
    const s: GameState = { ...newGame(1066, undefined, 'knight'), opening: undefined };
    const started = startFight(s, 'patrol')!.state;
    const battle = started.battle!;
    const fled: BattleState = { ...battle, result: 'fled', fighters: battle.fighters.map((f) => (f.side === 'player' && !f.hero ? { ...f, count: 0, hp: 0 } : f)) };
    const { state, events } = finishFight({ ...started, battle: fled });
    expect(state.army).toEqual([]);
    const card = events.find((e) => e.type === 'card') as { card: { title: string; lines: string[] } } | undefined;
    expect(card?.card.title).toBe('Retreat!');
    expect(card?.card.lines.join(' ')).toContain('gets away alone');
    expect(card?.card.lines.join(' ')).not.toContain('Your men fall back');
  });
});
