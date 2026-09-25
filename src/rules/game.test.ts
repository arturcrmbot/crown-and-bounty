import { describe as suite, expect, it } from 'vitest';
import { apply, armyPower, endDay, fight, leadershipUsed, locationById, roman, visit, type Result } from './game';
import { newGame } from './scenario';

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
    expect(payday.state.gold).toBe(before + 1000 - (12 * 8 + 25 * 3));
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
    const gold = apply(state, { type: 'chest', id: 'chest', take: 'gold' })!.state;
    expect(gold.gold).toBe(state.gold + 500);
    const cheer = apply(state, { type: 'chest', id: 'chest', take: 'leadership' })!.state;
    expect(cheer.leadership).toBe(state.leadership + 25);
    expect(locationById(cheer, 'chest').done).toBe(true);
  });

  it('pays out a gold pile once', () => {
    const once = visit(newGame(), 'gold').state;
    expect(visit(once, 'gold').state.gold).toBe(once.gold);
  });

  it('caps recruiting by leadership and gold', () => {
    const state = newGame();
    const room = state.leadership - leadershipUsed(state.army);
    const joined = apply(state, { type: 'recruit', id: 'village' })!.state;
    expect(joined.army.peasants).toBe(Math.min(20, room));
    expect(leadershipUsed(joined.army)).toBeLessThanOrEqual(joined.leadership);
    const broke = { ...state, gold: 0 };
    expect(apply(broke, { type: 'recruit', id: 'village' })).toBeNull();
  });

  it('points the way to the hideout from the watchtower', () => {
    const result = visit(newGame(), 'tower');
    expect(result.events).toContainEqual({ type: 'reveal', at: locationById(result.state, 'hideout').at, radius: 90 });
    expect(result.state.leadership).toBe(140);
  });
});

suite('fights', () => {
  it('beats the patrol with the starting army, losing the weakest troops first', () => {
    const result = fight(newGame(), 'patrol');
    expect(cardOf(result).title).toBe('Victory!');
    expect(result.events).toContainEqual({ type: 'removed', id: 'patrol' });
    expect(result.state.army.knights).toBe(12);
    expect(result.state.army.archers).toBeLessThan(25);
    expect(locationById(result.state, 'patrol').done).toBe(true);
  });

  it('is repeatable for the same seed', () => {
    expect(fight(newGame(7), 'hideout')).toEqual(fight(newGame(7), 'hideout'));
  });

  it('wins the commission by taking the hideout with a big enough army', () => {
    const strong = { ...newGame(), army: { knights: 30, archers: 30, peasants: 0 } };
    expect(armyPower(strong.army)).toBeGreaterThan(200 * 1.2);
    const result = fight(strong, 'hideout');
    expect(result.state.over).toBe('won');
    expect(result.events).toContainEqual({ type: 'over', result: 'won' });
    expect(result.state.bounty).toBe('paid');
  });

  it('sends a weak army home with losses', () => {
    const weak = { ...newGame(), army: { knights: 0, archers: 10, peasants: 10 } };
    const result = fight(weak, 'hideout');
    expect(cardOf(result).title).toBe('Retreat!');
    expect(armyPower(result.state.army)).toBeLessThan(armyPower(weak.army));
  });
});
