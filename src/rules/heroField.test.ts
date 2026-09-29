import { describe, expect, it } from 'vitest';
import { heroTroop, TROOPS, type TroopId } from '../content/troops';
import { autoResolve, castActions, commander, onslaught } from './battle/ai';
import { battleAct, battleEnd, blocked, canCast, createBattle, hasTurn, heroOnField, isLeader, livingHexes, onField, options, REAR, spellVictims, statsOf, survivors, type BattleState, type Fighter } from './battle/battle';
import { hexIndex, neighbours } from './battle/hex';
import { finishFight, heroFighter, heroInBattle, startFight, winChance, type GameState } from './game';
import { newGame } from './scenario';

const hero = (background: Parameters<typeof newGame>[2] = 'knight', level = 1): GameState => {
  const s = { ...newGame(1066, undefined, background), opening: undefined };
  return { ...s, hero: { ...s.hero, level } };
};
const battleOf = (state: GameState, place: string) => startFight(state, place)!.state.battle!;
const aldric = (b: BattleState) => heroOnField(b)!;
const army = (...stacks: [TroopId, number][]) => stacks.map(([troop, count]) => ({ troop, count }));
const of = (b: BattleState, troop: TroopId) => b.fighters.find((f) => f.troop === troop)!;
/** The battle with one fighter changed, and whoever `order` says acting next. */
const change = (b: BattleState, id: number, to: Partial<Fighter>, order = b.order): BattleState => ({ ...b, order, fighters: b.fighters.map((f) => (f.id === id ? { ...f, ...to } : f)) });
/** Every blow, shot and spell the side acting now could aim, and at whom. */
const aims = (b: BattleState) => {
  const opts = options(b);
  return [...opts.melee.map((m) => m.target), ...opts.shoot, ...castActions(b).flatMap((a) => (a.type === 'cast' && a.target !== undefined ? [a.target] : []))];
};

describe('Aldric behind the line', () => {
  it('leads from behind his army, on no hex of the field, and is no part of it', () => {
    const b = battleOf(hero('knight'), 'patrol');
    const me = aldric(b);
    expect(me).toMatchObject({ side: 'player', troop: 'heroKnight', count: 1, at: REAR });
    expect(isLeader(me) && !onField(me)).toBe(true);
    // The knights and archers take the middle of the line, as they would without him.
    expect(b.fighters.filter((f) => f.side === 'player' && !f.hero).map((f) => f.at)).toEqual([hexIndex(0, 4), hexIndex(0, 2)]);
    expect(survivors(b, 'player')).toEqual(hero('knight').army);
    expect(livingHexes(b).has(REAR)).toBe(false);
  });

  it('is a figure of each background: the Knight, the Hedge Wizard, the Ranger and the Courtier', () => {
    for (const background of ['knight', 'wizard', 'ranger', 'courtier'] as const) {
      const troop = heroTroop(background);
      expect(TROOPS[troop].hero?.background).toBe(background);
      expect(aldric(battleOf(hero(background), 'highwaymen')).troop).toBe(troop);
    }
  });

  it('is modest at level I, and his blows grow with his levels, his spell power and his gear', () => {
    const one = heroFighter(hero('knight'));
    const five = heroFighter(hero('knight', 5));
    expect(five.damage[0]).toBe(one.damage[0] + 4 * TROOPS.heroKnight.hero!.perLevel.damage);
    // His attack counts for his blows as for every stack's, gear included.
    const armed = hero('knight');
    const sword = heroFighter({ ...armed, hero: { ...armed.hero, gear: { weapon: 'swordOfAldmoor' } } });
    expect(sword.attack).toBeGreaterThan(one.attack);
    // The wizard's bolts grow with his spell power.
    const wizard = hero('wizard');
    const wiser = heroFighter({ ...wizard, hero: { ...wizard.hero, spellPower: wizard.hero.spellPower + 2 } });
    expect(wiser.damage[0]).toBe(heroFighter(wizard).damage[0] + 2 * TROOPS.heroWizard.hero!.perPower!);
    // What his card says is what he fights with.
    const b = battleOf(hero('knight', 5), 'patrol');
    expect(statsOf(b, aldric(b)).attack).toBe(five.attack);
  });

  it('can\u2019t be struck, shot or cast at, friend or foe, and a Fireball passes over him', () => {
    const b = battleOf({ ...hero('wizard'), hero: { ...hero('wizard').hero, spells: ['bolt', 'bless', 'fireball'], mana: 50 } }, 'patrol');
    const me = aldric(b);
    // Not by any of the enemy's stacks, whatever they could reach, nor by his own spells.
    for (const f of b.fighters.filter((x) => x.side === 'enemy')) {
      const theirs = change(b, f.id, { at: hexIndex(1, 4) }, [f.id]);
      expect(aims(theirs)).not.toContain(me.id);
    }
    const mine = { ...b, order: [of(b, 'knights').id] };
    expect(aims(mine)).not.toContain(me.id);
    expect(battleAct(mine, { type: 'cast', spell: 'bless', target: me.id }).events).toEqual([]);
    // Not by a witch's spell either.
    const fen = createBattle({ place: 'hideout', seed: 3, player: army(['knights', 10], ['archers', 20]), enemy: army(['trolls', 6], ['goblins', 60], ['witch', 1]), hero: heroInBattle(hero('wizard')) });
    const witch = of(fen, 'witch');
    const theirTurn = { ...fen, order: [of(fen, 'goblins').id] };
    expect(battleAct(theirTurn, { type: 'cast', spell: 'newts', target: aldric(fen).id, by: witch.id }).events).toEqual([]);
    expect(castActions(theirTurn).some((a) => a.type === 'cast' && (a.target === aldric(fen).id || a.target === witch.id))).toBe(false);
    // A fireball on the stack beside where he used to stand catches its neighbours, never him.
    const knights = of(b, 'knights');
    expect(spellVictims(b, 'fireball', knights).some((f) => isLeader(f))).toBe(false);
  });

  it('strikes with no answer: the Knight rides out, charges and rides back behind his men, all in one move', () => {
    const field = createBattle({ place: 'x', seed: 3, player: army(['archers', 5]), enemy: army(['swordsmen', 10]), hero: heroInBattle(hero('knight')), obstacles: 0 });
    const me = aldric(field);
    const foe = of(field, 'swordsmen');
    const lancer = change(field, foe.id, { at: hexIndex(3, 4) }, [me.id]);
    const opts = options(lancer);
    expect(opts.moves.size).toBe(0);
    const blow = opts.melee.find((m) => m.target === foe.id)!;
    const ride = opts.rides!.get(blow.from)!;
    expect(ride[0] % 11).toBe(0);
    const { battle, events } = battleAct(lancer, { type: 'melee', ...blow });
    expect(events.map((e) => e.type).slice(0, 3)).toEqual(['move', 'hit', 'back']);
    expect(events[1]).toMatchObject({ attacker: me.id, target: foe.id, charge: true, retaliation: false });
    expect(events.filter((e) => e.type === 'hit')).toHaveLength(1);
    expect(events[2]).toEqual({ type: 'back', fighter: me.id, path: [...ride].reverse() });
    expect(aldric(battle).at).toBe(REAR);
    // He rides as far as his speed takes him, in from his edge: a stack at the far edge is out of reach.
    const far = change(field, foe.id, { at: hexIndex(10, 4) }, [me.id]);
    expect(options(far).melee).toEqual([]);
    // On auto, the sergeants send him in when there's a stack to ride at.
    expect(commander(lancer)).toMatchObject({ type: 'melee', target: foe.id });
  });

  it('shoots from behind the line as the Wizard and the Ranger, and as the Courtier takes no turn at all', () => {
    for (const background of ['wizard', 'ranger'] as const) {
      const b = battleOf(hero(background), 'patrol');
      const me = aldric(b);
      // Any stack on the field, even with an enemy right in front of his men.
      const swordsmen = of(b, 'swordsmen');
      const turn = change(b, swordsmen.id, { at: hexIndex(1, 4) }, [me.id]);
      expect(options(turn).shoot.sort()).toEqual(b.fighters.filter((f) => f.side === 'enemy' && onField(f)).map((f) => f.id).sort());
      const shot = battleAct(turn, { type: 'shoot', target: swordsmen.id }).events.filter((e) => e.type === 'hit');
      expect(shot).toHaveLength(1);
    }
    const court = battleOf(hero('courtier'), 'patrol');
    expect(hasTurn(aldric(court))).toBe(false);
    expect(court.order).not.toContain(aldric(court).id);
    expect(canCast(court, 'bless')).toBe(true);
  });

  it('ends when a side\u2019s troops are gone: Aldric retreats, and a villain is taken, on the field and the card alike', () => {
    // His last stack falls while he still stands behind the line: the battle is lost, and he retreats.
    const state = hero('knight');
    const b = battleOf(state, 'patrol');
    const swordsmen = of(b, 'swordsmen');
    const last = b.fighters.filter((f) => f.side === 'player' && !f.hero);
    let doomed = change(b, last[1].id, { count: 0, hp: 0 });
    doomed = change(doomed, last[0].id, { count: 1, hp: 1, at: neighbours(hexIndex(5, 4))[0] });
    doomed = change(doomed, swordsmen.id, { at: hexIndex(5, 4) }, [swordsmen.id]);
    const lost = battleAct(doomed, { type: 'melee', target: last[0].id, from: hexIndex(5, 4) });
    expect(lost.battle.result).toBe('lost');
    expect(aldric(lost.battle).count).toBe(1);
    expect(battleEnd(lost.battle)).toEqual({ army: 'Your army is beaten', leader: 'Sir Aldric retreats' });
    const card = finishFight({ ...state, battle: lost.battle }).events.find((e) => e.type === 'card');
    expect(card?.type === 'card' && card.card.lines[0]).toBe('Your army is beaten, and **Sir Aldric retreats**.');
    // Grimsby's last man falls while Grimsby looks on: the battle is won, and he's taken.
    const hideout = createBattle({ place: 'hideout', seed: 7, player: army(['knights', 10]), enemy: army(['swordsmen', 1], ['baron', 1]), hero: heroInBattle(state), obstacles: 0 });
    const knights = of(hideout, 'knights');
    const guard = of(hideout, 'swordsmen');
    const won = battleAct(change(change(hideout, guard.id, { at: hexIndex(1, 4) }), knights.id, {}, [knights.id]), { type: 'melee', target: guard.id, from: knights.at });
    expect(won.battle.result).toBe('won');
    expect(of(won.battle, 'baron').count).toBe(1);
    expect(battleEnd(won.battle)).toEqual({ army: 'Their army is beaten', leader: 'Baron Grimsby is taken' });
  });

  it('fights by the same rules when both sides play it out: nobody aims at a leader, and every battle ends by the troops', () => {
    const fights = [
      createBattle({ place: 'hideout', seed: 11, player: army(['knights', 14], ['archers', 30]), enemy: army(['swordsmen', 30], ['crossbowmen', 14], ['baron', 1]), hero: heroInBattle(hero('knight')), obstacles: 3 }),
      createBattle({ place: 'hideout', seed: 12, player: army(['knights', 12], ['archers', 40]), enemy: army(['trolls', 5], ['goblins', 50], ['witch', 1]), hero: heroInBattle(hero('ranger')), obstacles: 3 }),
    ];
    for (const start of fights) {
      let b = start;
      for (let n = 0; n < 3000 && !b.result; n++) {
        const acting = b.fighters.find((f) => f.id === b.order[0])!;
        const action = acting.side === 'enemy' ? onslaught(b) : commander(b);
        if ('target' in action && action.target !== undefined) expect(isLeader(b.fighters.find((f) => f.id === action.target)!)).toBe(false);
        const next = battleAct(b, action);
        expect(next.events.length).toBeGreaterThan(0);
        b = next.battle;
      }
      expect(['won', 'lost']).toContain(b.result);
      expect(b.fighters.filter((f) => isLeader(f)).every((f) => f.count === 1)).toBe(true);
    }
  });

  it('counts in the sergeants\u2019 odds: a hero grown strong wins close fights more often', () => {
    const close = (level: number) => {
      const s = hero('knight', level);
      return winChance({ ...s, army: s.army.map((a) => ({ ...a, count: Math.round(a.count * 1.3) })) }, 'patrol', 8);
    };
    expect(close(15)).toBeGreaterThan(close(1));
  });

  it('stands behind the line even in a battle saved while he stood in it', () => {
    const b = battleOf(hero('knight'), 'patrol');
    const old = change(b, aldric(b).id, { at: hexIndex(0, 6) });
    expect(blocked(old, hexIndex(0, 6))).toBe(false);
    const swordsmen = of(old, 'swordsmen');
    expect(aims(change(old, swordsmen.id, { at: hexIndex(1, 6) }, [swordsmen.id]))).not.toContain(aldric(old).id);
  });

  it('is missing from a battle saved before he came to them, which plays on without him', () => {
    const state = hero('wizard');
    const old = createBattle({ place: 'highwaymen', seed: 5, player: state.army, enemy: state.locations.find((l) => l.id === 'highwaymen')!.enemy!.army, hero: { ...heroInBattle(state), unit: undefined } });
    expect(heroOnField(old)).toBeNull();
    expect(canCast(old, 'bolt')).toBe(true);
    const won = autoResolve(old);
    expect(won.result).toBe('won');
    const done = finishFight({ ...state, battle: won });
    expect(done.state.battle).toBeUndefined();
    expect(done.state.movement).toBe(state.movement);
    expect(done.state.army.map((s) => s.troop)).toEqual(state.army.map((s) => s.troop));
  });
});
