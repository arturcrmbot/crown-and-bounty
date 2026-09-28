import { describe, expect, it } from 'vitest';
import { heroTroop, TROOPS } from '../content/troops';
import { autoResolve, commander, onslaught } from './battle/ai';
import { battleAct, canCast, createBattle, heroHex, heroOnField, isCharge, options, statsOf, strike, survivors, type BattleState } from './battle/battle';
import { hexIndex, neighbours } from './battle/hex';
import { finishFight, heroFighter, heroInBattle, startFight, winChance, type GameState } from './game';
import { newGame } from './scenario';

const hero = (background: Parameters<typeof newGame>[2] = 'knight', level = 1): GameState => {
  const s = { ...newGame(1066, undefined, background), opening: undefined };
  return { ...s, hero: { ...s.hero, level } };
};
const battleOf = (state: GameState, place: string) => startFight(state, place)!.state.battle!;
const aldric = (b: BattleState) => heroOnField(b)!;
/** The battle with Aldric moved to `at`, and whatever else changed about him. */
const withHero = (b: BattleState, change: Partial<BattleState['fighters'][number]>): BattleState => ({ ...b, fighters: b.fighters.map((f) => (f.hero ? { ...f, ...change } : f)) });

describe('Aldric on the field', () => {
  it('takes the field with his army, a stack of one in the line, but is no part of it', () => {
    const b = battleOf(hero('knight'), 'patrol');
    const me = aldric(b);
    expect(me).toMatchObject({ side: 'player', troop: 'heroKnight', count: 1, hp: 80 });
    // The knights and archers take the first two rows of the line; he takes the next.
    expect(me.at).toBe(heroHex(2));
    expect(b.fighters.filter((f) => f.side === 'player' && f.at === me.at)).toHaveLength(1);
    expect(survivors(b, 'player')).toEqual(hero('knight').army);
    // With all five stacks out, he stands between the first two.
    const full = createBattle({ place: 'x', seed: 1, player: (['knights', 'archers', 'peasants', 'swordsmen', 'wolves'] as const).map((troop) => ({ troop, count: 5 })), enemy: [{ troop: 'bandits', count: 5 }], hero: heroInBattle(hero()) });
    expect(aldric(full).at).toBe(hexIndex(0, 3));
    expect(new Set(full.fighters.filter((f) => f.side === 'player').map((f) => f.at)).size).toBe(6);
  });

  it('is a figure of each background: the Knight, the Hedge Wizard, the Ranger and the Courtier', () => {
    for (const background of ['knight', 'wizard', 'ranger', 'courtier'] as const) {
      const troop = heroTroop(background);
      expect(TROOPS[troop].hero?.background).toBe(background);
      expect(aldric(battleOf(hero(background), 'highwaymen')).troop).toBe(troop);
    }
  });

  it('is modest at level I, and grows with his levels, his spell power and his gear', () => {
    const one = heroFighter(hero('knight'));
    const five = heroFighter(hero('knight', 5));
    expect(five.hp).toBe(one.hp + 4 * TROOPS.heroKnight.hero!.perLevel.hp);
    expect(five.damage[0]).toBe(one.damage[0] + 4 * TROOPS.heroKnight.hero!.perLevel.damage);
    // His attack and defence count for him as for every stack, gear included.
    const armed = hero('knight');
    const sword = heroFighter({ ...armed, hero: { ...armed.hero, gear: { weapon: 'swordOfAldmoor' } } });
    expect(sword.attack).toBeGreaterThan(one.attack);
    // The wizard's bolts grow with his spell power.
    const wizard = hero('wizard');
    const wiser = heroFighter({ ...wizard, hero: { ...wizard.hero, spellPower: wizard.hero.spellPower + 2 } });
    expect(wiser.damage[0]).toBe(heroFighter(wizard).damage[0] + 2 * TROOPS.heroWizard.hero!.perPower!);
    // What his card says is what he fights with.
    const b = battleOf(hero('knight', 5), 'patrol');
    expect(statsOf(b, aldric(b))).toEqual({ attack: five.attack, defence: five.defence });
  });

  it('fights his own way: the Knight charges, the Wizard and Ranger shoot, the Courtier rallies', () => {
    expect(heroFighter(hero('knight')).charges).toBe(true);
    // Sir Aldric rides at a stack four hexes off: a charge, and nobody strikes back.
    const field = createBattle({ place: 'x', seed: 3, player: [{ troop: 'archers', count: 5 }], enemy: [{ troop: 'swordsmen', count: 10 }], hero: heroInBattle(hero('knight')), obstacles: 0 });
    const me = aldric(field);
    const foe = { ...field.fighters.find((f) => f.side === 'enemy')!, at: hexIndex(5, 2) };
    const lancer: BattleState = { ...field, fighters: field.fighters.map((f) => (f.id === foe.id ? foe : f)), order: [me.id] };
    const run = options(lancer).melee.find((m) => m.target === foe.id && (options(lancer).moves.get(m.from)?.length ?? 0) >= 3)!;
    expect(isCharge(lancer, me, run.from)).toBe(true);
    const blows = battleAct(lancer, { type: 'melee', target: foe.id, from: run.from }, true).events.filter((e) => e.type === 'hit');
    expect(blows).toHaveLength(1);
    expect(blows[0]).toMatchObject({ attacker: me.id, charge: true });
    for (const background of ['wizard', 'ranger'] as const) expect(aldric(battleOf(hero(background), 'patrol')).shots).toBeGreaterThan(0);
    expect(heroFighter(hero('courtier')).abilities.map((a) => a.name)).toContain('Rallies');
    // Stacks beside the Courtier fight with +2 attack and +2 defence; others don't.
    const court = battleOf(hero('courtier'), 'patrol');
    const knights = court.fighters.find((f) => f.troop === 'knights')!;
    const apart = statsOf(court, knights);
    const beside = withHero(court, { at: neighbours(knights.at).find((n) => !court.fighters.some((f) => f.at === n))! });
    expect(statsOf(beside, knights)).toEqual({ attack: apart.attack + 2, defence: apart.defence + 2 });
  });

  it('casts only while he stands: carried off, his spells go with him, and the battle goes on', () => {
    const b = battleOf(hero('wizard'), 'patrol');
    expect(canCast(b, 'bolt')).toBe(true);
    const down = withHero(b, { count: 0, hp: 0 });
    expect(canCast(down, 'bolt')).toBe(false);
    const target = down.fighters.find((f) => f.side === 'enemy')!;
    expect(battleAct(down, { type: 'cast', spell: 'bolt', target: target.id }).events).toEqual([]);
    const after = autoResolve(down);
    expect(after.result).toBeDefined();
    expect(after.fighters.every((f) => !f.hero || f.count === 0)).toBe(true);
  });

  it('is back on his feet after a battle he fell in, at the cost of the rest of the day', () => {
    const state = hero('knight');
    const b = battleOf(state, 'highwaymen');
    const won = { ...b, result: 'won' as const, fighters: b.fighters.map((f) => (f.side === 'enemy' ? { ...f, count: 0 } : f)) };
    const fell = finishFight({ ...state, battle: withHero(won, { count: 0, hp: 0 }) });
    expect(fell.state.movement).toBe(0);
    const card = fell.events.find((e) => e.type === 'card');
    expect(card?.type === 'card' && card.card.lines.some((l) => l.includes('carried from the field'))).toBe(true);
    const stood = finishFight({ ...state, battle: won });
    expect(stood.state.movement).toBe(state.movement);
  });

  it('is shielded from shots by his guard, but not from blows at close quarters', () => {
    const b = battleOf(hero('wizard'), 'patrol');
    const me = aldric(b);
    const crossbowmen = b.fighters.find((f) => f.troop === 'crossbowmen')!;
    const swordsmen = b.fighters.find((f) => f.troop === 'swordsmen')!;
    expect(strike(b, crossbowmen, me, true).damage).toBe(Math.ceil(me.hp / 3));
    expect(strike(b, swordsmen, me, false).damage).toBeGreaterThan(me.hp);
  });

  it('is worth going for: the enemy finishes him off rather than scratch a stack, and the sergeants keep him back', () => {
    // The wizard, down to his last few wounds, in range of their crossbows.
    const b = battleOf(hero('wizard'), 'patrol');
    const crossbowmen = b.fighters.find((f) => f.troop === 'crossbowmen')!;
    const theirTurn = withHero({ ...b, order: [crossbowmen.id] }, { hp: 12 });
    expect(onslaught(theirTurn)).toEqual({ type: 'shoot', target: aldric(theirTurn).id });
    // His own turn, beside their slowed swordsmen: the sergeants don't leave him there to be cut down.
    const swordsmen = { ...b.fighters.find((f) => f.troop === 'swordsmen')!, status: ['slowed' as const] };
    const near = neighbours(swordsmen.at).find((n) => !b.fighters.some((f) => f.at === n))!;
    const slowed = { ...b, fighters: b.fighters.map((f) => (f.id === swordsmen.id ? swordsmen : f)) };
    let turn = withHero({ ...slowed, order: [aldric(b).id] }, { at: near });
    // He may cast first; then he moves.
    for (let action = commander(turn); action.type === 'cast'; action = commander(turn)) turn = battleAct(turn, action, true).battle;
    const after = battleAct(turn, commander(turn), true).battle;
    expect(neighbours(aldric(after).at)).not.toContain(swordsmen.at);
  });

  it('counts in the sergeants\u2019 odds: a hero grown strong wins close fights more often', () => {
    const close = (level: number) => {
      const s = hero('knight', level);
      return winChance({ ...s, army: s.army.map((a) => ({ ...a, count: Math.round(a.count * 1.3) })) }, 'patrol', 8);
    };
    expect(close(15)).toBeGreaterThan(close(1));
  });

  it('is missing from a battle saved before he took the field, which plays on without him', () => {
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
