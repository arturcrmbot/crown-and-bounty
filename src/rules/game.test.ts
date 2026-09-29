import { describe as suite, expect, it } from 'vitest';
import { apply, armyPower, countOf, endDay, fight, finishFight, leadershipUsed, locationById, roman, startFight, visit, wages, type Result } from './game';
import { isExplored } from './map/fog';
import { buildMap, cellIndex } from './map/model';
import { newGame } from './scenario';
import { ALDMOOR } from '../content/aldmoor';

const cardOf = (result: Result) => {
  const event = result.events.find((e) => e.type === 'card');
  if (!event || event.type !== 'card') throw new Error('No card');
  return event.card;
};

suite('days', () => {
  it('writes days in Roman numerals', () => {
    expect([1, 3, 4, 9, 14, 40, 99, 100].map(roman)).toEqual(['I', 'III', 'IV', 'IX', 'XIV', 'XL', 'XCIX', 'C']);
  });

  it('gives fresh movement each day', () => {
    const tired = { ...newGame(), movement: 3 };
    expect(endDay(tired).state.movement).toBe(150);
    expect(endDay(tired).state.day).toBe(2);
  });

  it('pays the commission and takes wages on day VIII', () => {
    let state = newGame();
    for (let i = 0; i < 6; i++) state = endDay(state).state;
    expect(state.day).toBe(7);
    const before = state.gold;
    const payday = endDay(state);
    expect(payday.state.day).toBe(8);
    expect(payday.state.gold).toBe(before + 1000 - wages(state.army));
    expect(cardOf(payday).lines[0]).toContain('Payday');
    expect(payday.events).toContainEqual({ type: 'day', day: 8, payday: true });
  });

  it('loses the commission after day C', () => {
    const late = { ...newGame(), day: 100 };
    expect(endDay(late).state.over).toBe('lost');
  });
});

suite('places', () => {
  it('lets you keep the chest gold or turn it into leadership', () => {
    const state = newGame();
    const gold = apply(state, { type: 'choose', id: 'chest', choice: 'keep' })!.state;
    expect(gold.gold).toBe(state.gold + 500);
    const cheer = apply(state, { type: 'choose', id: 'chest', choice: 'give' })!.state;
    expect(cheer.leadership).toBe(state.leadership + 25);
    expect(locationById(cheer, 'chest').done).toBe(true);
  });

  it('pays out a gold pile once', () => {
    const once = visit(newGame(), 'gold').state;
    expect(visit(once, 'gold').state.gold).toBe(once.gold);
  });

  it('caps recruiting by leadership and gold', () => {
    const state = newGame();
    const room = 140 - leadershipUsed(state.army);
    const joined = apply(state, { type: 'choose', id: 'village', choice: 'recruit' })!.state;
    expect(countOf(joined.army, 'peasants')).toBe(Math.min(20, room));
    expect(leadershipUsed(joined.army)).toBeLessThanOrEqual(joined.leadership);
    const broke = { ...state, gold: 0 };
    expect(apply(broke, { type: 'choose', id: 'village', choice: 'recruit' })).toBeNull();
  });

  it('points the way to the hideout from the watchtower, for a hero who takes the journal over the banner', () => {
    expect(cardOf(visit(newGame(), 'tower')).choices.map((c) => c.label)).toEqual(['Take the banner', 'Take the journal', 'Leave them to the crows']);
    const result = apply(newGame(), { type: 'choose', id: 'tower', choice: 'top/journal' })!;
    expect(result.events).toContainEqual({ type: 'reveal', at: locationById(result.state, 'hideout').at, radius: 90 });
    const map = buildMap(ALDMOOR);
    const [hx, hy] = locationById(result.state, 'hideout').at;
    expect(isExplored(newGame().explored, cellIndex(map, hx, hy))).toBe(false);
    expect(isExplored(result.state.explored, cellIndex(map, hx, hy))).toBe(true);
    expect(result.state.hero.gear.banner).toBeUndefined();
    const banner = apply(newGame(), { type: 'choose', id: 'tower', choice: 'top/banner' })!.state;
    expect(banner.hero.gear.banner).toBe('oldBanner');
    expect(isExplored(banner.explored, cellIndex(map, hx, hy))).toBe(false);
    expect(apply(banner, { type: 'choose', id: 'tower', choice: 'top/journal' })).toBeNull();
  });
});

suite('fights', () => {
  it('shows the fallen from both sides and the mana spent', () => {
    const fresh = newGame(7, undefined, 'wizard');
    const state = { ...fresh, army: [{ troop: 'knights' as const, count: 10 }], hero: { ...fresh.hero, mana: 30 } };
    const started = startFight(state, 'poachers')!.state;
    const battle = started.battle!;
    const player = battle.fighters.find((fighter) => fighter.side === 'player' && !fighter.hero)!;
    const enemy = battle.fighters.find((fighter) => fighter.side === 'enemy')!;
    const ended = {
      ...battle,
      result: 'won' as const,
      hero: { ...battle.hero, mana: 23 },
      fighters: battle.fighters.map((fighter) =>
        fighter.id === player.id ? { ...fighter, count: fighter.count - 2 } : fighter.side === 'enemy' ? { ...fighter, count: 0 } : fighter,
      ),
    };

    const result = finishFight({ ...started, battle: ended });
    const report = cardOf(result).battleResult;
    expect(report).toEqual({
      player: [{ troop: player.troop, count: 2 }],
      enemy: [{ troop: enemy.troop, count: enemy.startCount }],
      manaSpent: 7,
      manaAvailable: 30,
    });
  });

  it('beats the poachers with the starting army, with light losses', () => {
    const result = fight(newGame(), 'poachers')!;
    expect(cardOf(result).title).toBe('Victory!');
    expect(cardOf(result).battleResult?.enemy.length).toBeGreaterThan(0);
    expect(result.events).toContainEqual({ type: 'removed', id: 'poachers' });
    expect(armyPower(result.state.army)).toBeGreaterThan(armyPower(newGame().army) * 0.8);
    expect(locationById(result.state, 'poachers').done).toBe(true);
    expect(result.state.battle).toBeUndefined();
  });

  it('keeps the patrol too strong for the starting army, and leaves a camp of deserters once it is beaten', () => {
    expect(fight(newGame(), 'patrol')!.state.locations.find((l) => l.id === 'patrol')!.done).toBe(false);
    const strong = { ...newGame(), army: [{ troop: 'knights' as const, count: 40 }, { troop: 'archers' as const, count: 40 }] };
    const won = fight(strong, 'patrol')!;
    expect(locationById(won.state, 'patrol').done).toBe(true);
    expect(countOf(won.state.army, 'knights')).toBeGreaterThanOrEqual(20);
    const camp = locationById(won.state, 'deserters');
    expect(camp.recruits?.troop).toBe('swordsmen');
    expect(won.events).toContainEqual({ type: 'added', id: 'deserters' });
  });

  it('is repeatable for the same seed', () => {
    expect(fight(newGame(7), 'hideout')!).toEqual(fight(newGame(7), 'hideout')!);
  });

  it('wins the commission by taking the hideout with a big enough army', () => {
    const strong = { ...newGame(), army: [{ troop: 'knights' as const, count: 70 }, { troop: 'archers' as const, count: 60 }] };
    expect(armyPower(strong.army)).toBeGreaterThan(armyPower(locationById(strong, 'hideout').enemy!.army) * 1.2);
    const result = fight(strong, 'hideout')!;
    expect(result.state.over).toBe('won');
    expect(result.events).toContainEqual({ type: 'over', result: 'won' });
    expect(result.state.bounty).toBe('paid');
  });

  it('sends a beaten hero home to his castle with no army', () => {
    const weak = { ...newGame(), army: [{ troop: 'archers' as const, count: 10 }, { troop: 'peasants' as const, count: 10 }] };
    const result = fight(weak, 'hideout')!;
    expect(cardOf(result).title).toBe('Defeat');
    expect(result.state.army).toEqual([]);
    expect(result.state.hero.at[1]).toBeGreaterThan(locationById(result.state, 'castle').at[1]);
    expect(locationById(result.state, 'hideout').done).toBe(false);
  });
});
