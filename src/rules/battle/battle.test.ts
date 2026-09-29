import { afterEach, describe, expect, it } from 'vitest';
import { STATUSES, type StatusDef, type StatusId } from '../../content/spells';
import { TROOPS, feuding } from '../../content/troops';
import { autoResolve, chooseAction, evaluate, finishEstimate } from './ai';
import { activeFighter, battleAct, createBattle, enemyReach, fighterById, GRUMBLE, grumblesAt, isCharge, moraleOf, options, QUIET_ROUNDS, rallyTargets, skillFactor, spellDamage, statsOf, strike, threatsToHero, wound, type BattleHero, type BattleEvent, type BattleState } from './battle';
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

  it('previews the friends a Courtier would rally from another hex', () => {
    const b = createBattle({
      place: 'test',
      seed: 7,
      player: [{ troop: 'knights', count: 10 }, { troop: 'archers', count: 10 }],
      enemy: [{ troop: 'wolves', count: 10 }],
      hero: { ...hero, unit: { troop: 'heroCourtier', hp: 55, damage: [6, 10] } },
      obstacles: 0,
    });
    const source = b.fighters.find((f) => f.hero)!;
    const destination = hexIndex(2, 4);
    const [near, enemyNear] = neighbours(destination);
    const friends = b.fighters.filter((f) => f.side === 'player' && !f.hero);
    const enemy = b.fighters.find((f) => f.side === 'enemy')!;
    const positioned = {
      ...b,
      fighters: b.fighters.map((f) =>
        f.id === friends[0].id ? { ...f, at: near } :
        f.id === friends[1].id ? { ...f, at: hexIndex(8, 8) } :
        f.id === enemy.id ? { ...f, at: enemyNear } : f,
      ),
    };

    expect(rallyTargets(positioned, source, destination).map((f) => f.id)).toEqual([friends[0].id]);
    expect(rallyTargets(positioned, { ...source, count: 0 }, destination)).toEqual([]);
  });

  it('warns of melee stacks that can reach Aldric before his next turn', () => {
    const b = createBattle({
      place: 'test',
      seed: 7,
      player: [{ troop: 'knights', count: 10 }],
      enemy: [{ troop: 'swordsmen', count: 10 }],
      hero: { ...hero, unit: { troop: 'heroCourtier', hp: 55, damage: [6, 10] } },
      obstacles: 0,
    });
    const lord = b.fighters.find((f) => f.hero)!;
    const enemy = b.fighters.find((f) => f.side === 'enemy')!;
    const adjacent = neighbours(lord.at)[0];
    const ready = {
      ...b,
      fighters: b.fighters.map((f) => f.id === enemy.id ? { ...f, at: adjacent } : f),
      order: [b.fighters[0].id, enemy.id, lord.id],
    };

    expect(threatsToHero(ready).map((f) => f.id)).toEqual([enemy.id]);
    expect(threatsToHero({ ...ready, order: [b.fighters[0].id, lord.id, enemy.id] })).toEqual([]);
  });

  it('warns of guarded shots or spells only when one can carry Aldric off', () => {
    const create = (enemy: 'crossbowmen' | 'bramble', hp: number) => {
      const b = createBattle({
        place: 'test',
        seed: 7,
        player: [{ troop: 'knights', count: 10 }],
        enemy: [{ troop: enemy, count: 100 }],
        hero: { ...hero, unit: { troop: 'heroCourtier', hp: 55, damage: [6, 10] } },
        obstacles: 0,
      });
      const lord = b.fighters.find((f) => f.hero)!;
      const foe = b.fighters.find((f) => f.side === 'enemy')!;
      return {
        ...b,
        fighters: b.fighters.map((f) => f.id === lord.id ? { ...f, hp } : f),
        order: [b.fighters[0].id, foe.id, lord.id],
      };
    };

    expect(threatsToHero(create('crossbowmen', 55))).toEqual([]);
    expect(threatsToHero(create('crossbowmen', 19))).toHaveLength(1);
    expect(threatsToHero(create('bramble', 55))).toEqual([]);
    expect(threatsToHero(create('bramble', 19))).toHaveLength(1);
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
    expect(hexed.events.some((e) => e.type === 'hit' && e.status === 'slowed')).toBe(true);
  });

  it('lets a stack with first strike hit first when it defends, unless the attacker has it too', () => {
    let b = battle(['swordsmen'], [10], ['peasants'], [50]);
    b = { ...b, fighters: b.fighters.map((f) => (f.side === 'enemy' ? { ...f, at: hexIndex(1, 4) } : f)), order: [0, 1] };
    const result = battleAct(b, { type: 'melee', target: 1, from: hexIndex(0, 4) });
    const hits = result.events.filter((e): e is Extract<BattleEvent, { type: 'hit' }> => e.type === 'hit');
    expect(hits).toHaveLength(2);
    expect(hits[0].attacker).toBe(1); // the peasants, defending, strike first
    expect(hits[1].attacker).toBe(0); // the swordsmen strike back
  });

  it('poisons whatever a goblin bites: a sliver of health lost at the start of its next turn', () => {
    let b = battle(['knights'], [10], ['goblins'], [50]);
    b = { ...b, fighters: b.fighters.map((f) => (f.side === 'enemy' ? { ...f, at: hexIndex(1, 4) } : f)), order: [1, 0] };
    const result = battleAct(b, { type: 'melee', target: 0, from: hexIndex(1, 4) });
    expect(result.events.some((e) => e.type === 'hit' && e.status === 'poisoned')).toBe(true);
    expect(fighterById(result.battle, 0).status).toContain('poisoned');
    expect(result.events.some((e) => e.type === 'poison' && e.fighter === 0)).toBe(true);
  });

  it('lets crossbows pierce armour: -1 defence against them', () => {
    const b = battle(['crossbowmen'], [10], ['knights'], [10]);
    const attacker = b.fighters[0];
    const target = b.fighters[1];
    const t = TROOPS.crossbowmen;
    const avg = (t.damage[0] + t.damage[1]) / 2;
    const factor = skillFactor(t.attack + hero.attack, TROOPS.knights.defence - 1);
    const { damage } = strike(b, attacker, target, true);
    expect(damage).toBe(Math.max(1, Math.round(attacker.count * avg * factor)));
  });

  it('calls off a battle nobody can land a blow in: a far weaker enemy is beaten, any other slips away', () => {
    // A round with nobody hurt and the enemy no nearer than the round before.
    const quietly = (b: BattleState) => ({ ...b, order: [0], quiet: QUIET_ROUNDS - 1, struck: false, gap: enemyReach(b).gap });
    const end = battleAct(quietly(battle(['knights'], [10], ['goblins'], [5])), { type: 'defend' });
    expect(end.battle.result).toBe('won');
    expect(end.events.at(-1)).toMatchObject({ type: 'end', result: 'won', rout: true });
    // Keeping out of a real enemy's way doesn't win anything: it keeps its army, and you leave the field.
    const even = battleAct(quietly(battle(['knights'], [10], ['boars'], [20])), { type: 'defend' });
    expect(even.battle.result).toBe('fled');
    expect(even.battle.standoff).toBeUndefined();
    const busy = battleAct({ ...quietly(battle(['knights'], [10], ['goblins'], [5])), struck: true }, { type: 'defend' });
    expect(busy.battle.result).toBeUndefined();
  });

  it('keeps fighting while the enemy is still coming, however slowly', () => {
    // Slowed trolls take rounds to cross the field: waiting for them doesn't end the battle.
    let b = battle(['knights'], [10], ['trolls'], [2]);
    b = { ...b, fighters: b.fighters.map((f) => (f.side === 'enemy' ? { ...f, status: ['slowed' as const] } : f)) };
    for (let i = 0; i < 60 && !b.result; i++) b = battleAct(b, activeFighter(b)!.side === 'enemy' ? chooseAction(b) : { type: 'defend' }).battle;
    expect(b.result).toBeDefined();
    expect(b.result).not.toBe('fled');
  });

  it('calls it a stand-off when the enemy has no way through to you at all', () => {
    // Knights walled into a corner by rocks: the boars can't get at them, and they won't come out.
    const corner = hexIndex(0, 0);
    const walls = neighbours(corner);
    let b: BattleState = { ...battle(['knights'], [10], ['boars'], [20]), obstacles: walls };
    b = { ...b, fighters: b.fighters.map((f) => (f.side === 'player' ? { ...f, at: corner } : f)) };
    for (let i = 0; i < 40 && !b.result; i++) b = battleAct(b, activeFighter(b)!.side === 'enemy' ? chooseAction(b) : { type: 'defend' }).battle;
    expect(b.result).toBe('fled');
    expect(b.standoff).toBe(true);
  });

  it('never lets the enemy wait or turtle: it strikes if it can, and otherwise closes in', () => {
    // Boars across the field from the knights: every one of their turns is a step closer, or a blow.
    let b = battle(['knights'], [15], ['boars'], [20]);
    const gap = (s: BattleState) => distance(s.fighters[0].at, s.fighters[1].at);
    for (let i = 0; i < 40 && !b.result; i++) {
      const f = activeFighter(b)!;
      if (f.side === 'enemy') {
        const action = chooseAction(b);
        expect(['move', 'melee', 'shoot']).toContain(action.type);
        const before = gap(b);
        b = battleAct(b, action).battle;
        if (action.type === 'move') expect(gap(b)).toBeLessThan(before);
      } else b = battleAct(b, { type: 'defend' }).battle;
    }
    // Turtling doesn't make them go away: the knights fought them off, blow by blow.
    expect(b.result).toBe('won');
    expect(b.quiet ?? 0).toBeLessThan(QUIET_ROUNDS);
  });

  it('keeps its shooters shooting', () => {
    const b = battle(['knights'], [10], ['crossbowmen'], [20]);
    const turn = { ...b, order: [1, 0] };
    expect(chooseAction(turn)).toMatchObject({ type: 'shoot', target: 0 });
  });

  const placed = (b: BattleState, at: Record<number, number>, order: number[]): BattleState => ({ ...b, order, fighters: b.fighters.map((f) => (at[f.id] !== undefined ? { ...f, at: at[f.id] } : f)) });

  it('sends its fighters after your shooters, not just at whoever is nearest', () => {
    const archers = hexIndex(0, 8);
    const b = placed(battle(['knights', 'archers'], [10, 20], ['wolves'], [30]), { 0: hexIndex(1, 1), 1: archers, 2: hexIndex(10, 4) }, [2, 0, 1]);
    const move = chooseAction(b);
    expect(move.type).toBe('move');
    const to = (move as { to: number }).to;
    expect(distance(to, archers)).toBeLessThan(distance(to, hexIndex(1, 1)));
  });

  it('lets a shooter caught in melee step out of reach, and shoot again', () => {
    let b = placed(battle(['swordsmen'], [5], ['crossbowmen'], [20]), { 0: hexIndex(5, 4), 1: hexIndex(6, 4) }, [1]);
    b = { ...b, fighters: b.fighters.map((f) => (f.side === 'player' ? { ...f, status: ['slowed' as const] } : f)) };
    const step = chooseAction(b);
    expect(step.type).toBe('move');
    expect(distance((step as { to: number }).to, hexIndex(5, 4))).toBeGreaterThan(3);
  });

  it('gangs up on a stack that has already struck back', () => {
    const b = placed(battle(['knights', 'knights'], [10, 10], ['swordsmen'], [30]), { 0: hexIndex(5, 3), 1: hexIndex(5, 5), 2: hexIndex(6, 4) }, [2]);
    const tired = { ...b, fighters: b.fighters.map((f) => (f.id === 1 ? { ...f, retaliated: true } : f)) };
    expect(chooseAction(tired)).toMatchObject({ type: 'melee', target: 1 });
  });

  it('lets knights charge only with a run-up, not by circling a stack they are already fighting', () => {
    const lances = (b: BattleState): BattleState => ({ ...b, hero: { ...b.hero, charge: ['knights'] }, order: [0, 1] });
    // From across the field: a charge.
    const clear = lances(placed(battle(['knights'], [10], ['swordsmen'], [30]), { 0: hexIndex(2, 4), 1: hexIndex(6, 4) }, [0, 1]));
    expect(isCharge(clear, clear.fighters[0], hexIndex(5, 4))).toBe(true);
    // Already at grips on one side, riding round to the other three hexes away: just a blow.
    const engaged = lances(placed(battle(['knights'], [10], ['swordsmen'], [30]), { 0: hexIndex(5, 4), 1: hexIndex(6, 4) }, [0, 1]));
    expect(options(engaged).moves.get(hexIndex(7, 4))?.length).toBeGreaterThanOrEqual(3);
    expect(isCharge(engaged, engaged.fighters[0], hexIndex(7, 4))).toBe(false);
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

  it('offers a deterministic finish estimate only without enemy shooters and when the sergeants nearly always win', () => {
    const decided = battle(['knights', 'archers'], [40, 20], ['swordsmen'], [2]);
    const estimate = finishEstimate(decided);
    expect(estimate).not.toBeNull();
    expect(estimate!.wins).toBeGreaterThanOrEqual(9);
    expect(estimate!.samples).toBe(10);
    expect(finishEstimate(decided)).toEqual(estimate);

    expect(finishEstimate(battle(['knights'], [40], ['crossbowmen'], [2]))).toBeNull();
    expect(finishEstimate(battle(['knights'], [1], ['swordsmen'], [50]))).toBeNull();
  });

  it('lets the starting army beat Grimsby\u2019s patrol most of the time', () => {
    let wins = 0;
    for (let seed = 1; seed <= 30; seed++) if (autoResolve(battle(['knights', 'archers'], [12, 25], ['swordsmen', 'crossbowmen'], [18, 12], seed)).result === 'won') wins++;
    expect(wins).toBeGreaterThanOrEqual(24);
  });
});

describe('status fields', () => {
  const hero: BattleHero = { attack: 0, defence: 0, spellPower: 1, mana: 0, spells: [], castRound: 0 };
  const field = () => createBattle({ place: 'x', seed: 1, player: [{ troop: 'archers', count: 20 }], enemy: [{ troop: 'swordsmen', count: 20 }], hero, obstacles: 0 });
  const withStatus = (b: BattleState, id: number, def: StatusDef) => {
    const key = 'test' as StatusId;
    (STATUSES as Record<string, StatusDef>)[key] = def;
    return { ...b, fighters: b.fighters.map((f) => (f.id === id ? { ...f, status: [...f.status, key] } : f)) };
  };
  afterEach(() => delete (STATUSES as Record<string, StatusDef>).test);

  it('attackAdd changes attack, in statsOf and in every blow', () => {
    const b = field();
    const cursed = withStatus(b, 1, { name: 'Weak', attackAdd: -3 });
    expect(statsOf(cursed, cursed.fighters[1]).attack).toBe(statsOf(b, b.fighters[1]).attack - 3);
    expect(strike(cursed, cursed.fighters[1], cursed.fighters[0], false).damage).toBeLessThan(strike(b, b.fighters[1], b.fighters[0], false).damage);
  });

  it('worstDamage rolls the worst, and cancels out with bestDamage', () => {
    const b = field();
    const [min, max] = TROOPS.swordsmen.damage;
    const worst = withStatus(b, 1, { name: 'Cursed', worstDamage: true });
    const plain = strike(b, b.fighters[1], b.fighters[0], false).damage;
    expect(strike(worst, worst.fighters[1], worst.fighters[0], false, 7).damage).toBeCloseTo((plain * min) / ((min + max) / 2), -1);
    const both = withStatus(withStatus(b, 1, { name: 'Cursed', worstDamage: true }), 1, { name: 'Both', worstDamage: true, bestDamage: true });
    expect(strike(both, both.fighters[1], both.fighters[0], false).damage).toBe(plain);
  });

  it('rangedTaken shields against shots, not blows', () => {
    const b = field();
    const shielded = withStatus(b, 1, { name: 'Shield', rangedTaken: 0.5 });
    expect(strike(shielded, shielded.fighters[0], shielded.fighters[1], true).damage).toBe(Math.round(strike(b, b.fighters[0], b.fighters[1], true).damage / 2));
    expect(strike(shielded, shielded.fighters[0], shielded.fighters[1], false).damage).toBe(strike(b, b.fighters[0], b.fighters[1], false).damage);
  });
});

describe('luck and morale', () => {
  it('spreads luck\u2019s chance over the average damage, without a seed', () => {
    const b = battle(['knights'], [10], ['swordsmen'], [10]);
    const plain = strike(b, b.fighters[0], b.fighters[1], false).damage;
    const lucky = { ...b, hero: { ...b.hero, luck: 0.4 } };
    expect(strike(lucky, lucky.fighters[0], lucky.fighters[1], false).damage).toBeCloseTo(plain * 1.4, -1);
    // Only the player's own side rolls for luck.
    expect(strike(lucky, lucky.fighters[1], lucky.fighters[0], false).damage).toBe(strike(b, b.fighters[1], b.fighters[0], false).damage);
  });

  it('with a seed, a lucky blow lands twice as hard and says so', () => {
    const b = battle(['knights'], [10], ['swordsmen'], [10]);
    const lucky = { ...b, hero: { ...b.hero, luck: 1 } };
    const base = strike(b, b.fighters[0], b.fighters[1], false, 123).damage;
    const rolled = strike(lucky, lucky.fighters[0], lucky.fighters[1], false, 123);
    expect(rolled.lucky).toBe(true);
    expect(rolled.damage).toBeCloseTo(base * 2, -1);
    // It fires from battleAct too, on the hit event.
    let shooting = createBattle({ place: 'test', seed: 3, player: [{ troop: 'archers', count: 20 }], enemy: [{ troop: 'swordsmen', count: 20 }], hero: lucky.hero, obstacles: 0 });
    shooting = { ...shooting, order: [0, 1] };
    const { events } = battleAct(shooting, { type: 'shoot', target: 1 });
    expect(events.find((e) => e.type === 'hit')).toMatchObject({ lucky: true });
  });

  it('good morale wins a stack another turn, once a round', () => {
    let b = battle(['knights'], [10], ['swordsmen'], [10]);
    b = { ...b, hero: { ...b.hero, morale: 1 }, order: [0, 1] };
    const first = battleAct(b, { type: 'defend' });
    expect(first.events.some((e) => e.type === 'morale')).toBe(true);
    expect(first.battle.order[0]).toBe(0);
    // It doesn't trigger twice for the same stack in the same round.
    const second = battleAct(first.battle, { type: 'defend' });
    expect(second.events.some((e) => e.type === 'morale')).toBe(false);
  });

  it('the AI\u2019s look-ahead skips the dice for both', () => {
    let b = battle(['knights'], [10], ['swordsmen'], [10]);
    b = { ...b, hero: { ...b.hero, luck: 1, morale: 1 }, order: [0, 1] };
    const { events, battle: after } = battleAct(b, { type: 'defend' }, true);
    expect(events.some((e) => e.type === 'morale')).toBe(false);
    expect(after.order[0]).not.toBe(0);
  });
});

describe('mixed company', () => {
  it('the King\u2019s folk and wild things grumble at each other; outlaws don\u2019t mind', () => {
    const b = battle(['knights', 'wolves', 'archers'], [10, 10, 10], ['swordsmen', 'wolves'], [10, 10]);
    const [knights, wolves, archers, swordsmen, hounds] = b.fighters;
    expect(grumblesAt(b, knights).map((f) => f.troop)).toEqual(['wolves']);
    expect(grumblesAt(b, wolves).map((f) => f.troop)).toEqual(['knights', 'archers']);
    // However many of them there are, one people grumbled at costs GRUMBLE once.
    expect(moraleOf(b, wolves)).toBeCloseTo(-GRUMBLE);
    expect(moraleOf(b, archers)).toBeCloseTo(-GRUMBLE);
    expect(moraleOf(b, swordsmen)).toBe(0);
    expect(moraleOf(b, hounds)).toBe(0);
    // Aldric brings his morale to his side, and it can make up for the grumbling.
    expect(moraleOf({ ...b, hero: { ...b.hero, morale: 0.1 } }, knights)).toBeCloseTo(0);
    expect(feuding('knights', 'boars') && feuding('boars', 'peasants') && !feuding('swordsmen', 'wolves') && !feuding('knights', 'swordsmen')).toBe(true);
  });

  it('stops once the company they grumble at has fallen', () => {
    const b = battle(['knights', 'wolves'], [10, 10], ['swordsmen'], [10]);
    const gone = { ...b, fighters: b.fighters.map((f) => (f.troop === 'wolves' ? { ...f, count: 0 } : f)) };
    expect(moraleOf(gone, gone.fighters[0])).toBe(0);
  });

  it('low spirits make a stack hang back and lose its turn, once a round', () => {
    // Wolves first, then the knights, who grumble at them past all bearing.
    let b = battle(['knights', 'wolves'], [10, 10], ['swordsmen'], [10]);
    b = { ...b, hero: { ...b.hero, morale: -0.9 } };
    expect(b.order).toEqual([1, 0, 2]);
    const { events, battle: after } = battleAct(b, { type: 'defend' });
    expect(events).toContainEqual({ type: 'morale', fighter: 0, bad: true });
    expect(after.order[0]).toBe(2);
    expect(fighterById(after, 0).moraleUsed).toBe(true);
    // The AI's look-ahead doesn't roll for it.
    const guess = battleAct(b, { type: 'defend' }, true);
    expect(guess.events.some((e) => e.type === 'morale')).toBe(false);
    expect(guess.battle.order[0]).toBe(0);
  });

  it('low spirits are tested once, even when a spell is cast before the stack acts', () => {
    let b = battle(['knights', 'wolves'], [10, 10], ['swordsmen'], [10]);
    // Just under nought: the dice will nearly always let them act, and once they have, that's it for the round.
    b = { ...b, hero: { ...b.hero, morale: 0.099 } };
    const next = battleAct(b, { type: 'defend' }).battle;
    expect(next.order[0]).toBe(0);
    expect(fighterById(next, 0).moraleUsed).toBe(true);
    const cast = battleAct(next, { type: 'cast', spell: 'bless', target: 0 });
    expect(cast.events.some((e) => e.type === 'morale')).toBe(false);
    expect(cast.battle.order[0]).toBe(0);
    // No dice were thrown for them again.
    expect(cast.battle.seed).toBe(next.seed);
  });

  it('the AI counts luck at its average and morale as the turns it can expect', () => {
    const b = battle(['knights', 'archers'], [10, 20], ['swordsmen'], [30]);
    const cheered = { ...b, hero: { ...b.hero, morale: 0.3 } };
    const lucky = { ...b, hero: { ...b.hero, luck: 0.3 } };
    expect(evaluate(cheered, 'player')).toBeGreaterThan(evaluate(b, 'player'));
    expect(evaluate(lucky, 'player')).toBeGreaterThan(evaluate(b, 'player'));
    // And the other side sees it coming.
    expect(evaluate(cheered, 'enemy')).toBeLessThan(evaluate(b, 'enemy'));
    const grumbling = battle(['knights', 'archers', 'wolves'], [10, 20, 1], ['swordsmen'], [30]);
    const calm = { ...grumbling, hero: { ...grumbling.hero, morale: GRUMBLE } };
    expect(evaluate(calm, 'player')).toBeGreaterThan(evaluate(grumbling, 'player'));
  });
});

describe('shooters in melee', () => {
  it('hit at half strength, unless the hero has taught them better', () => {
    const hero: BattleHero = { attack: 0, defence: 0, spellPower: 1, mana: 0, spells: [], castRound: 0 };
    const at = (h: BattleHero) => createBattle({ place: 'x', seed: 1, player: [{ troop: 'archers', count: 20 }], enemy: [{ troop: 'swordsmen', count: 20 }], hero: h, obstacles: 0 });
    const half = at(hero);
    const full = at({ ...hero, shooterMelee: 1 });
    const blow = (b: BattleState) => strike(b, b.fighters[0], b.fighters[1], false).damage;
    expect(blow(full)).toBe(Math.round(blow(half) * 2));
    // Only his own: the enemy's crossbowmen still fight at half strength up close.
    const bows = (h: BattleHero) => createBattle({ place: 'x', seed: 1, player: [{ troop: 'swordsmen', count: 20 }], enemy: [{ troop: 'crossbowmen', count: 20 }], hero: h, obstacles: 0 });
    const theirs = (b: BattleState) => strike(b, b.fighters[1], b.fighters[0], false).damage;
    expect(theirs(bows({ ...hero, shooterMelee: 1 }))).toBe(theirs(bows(hero)));
  });
});
