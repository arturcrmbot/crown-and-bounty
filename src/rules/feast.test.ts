import { describe, expect, it } from 'vitest';
import { FEAST_LINES } from '../content/feast';
import { feastLine } from './feast';
import { newGame } from './scenario';

/** A state on the morning of a payday: the first is day VIII. */
const payday = (n: number, army = newGame().army) => ({ ...newGame(7, undefined, 'knight'), opening: undefined, day: 1 + 7 * n, army });

describe('the line under the fire at the payday feast', () => {
  it('first, in Aldmoor, the men drink to the goose they will bring home', () => {
    expect(feastLine(payday(1))).toBe('Your men drink to the King, and to the goose you will bring home to him.');
  });

  it('takes turns payday by payday, names the villain, and comes round again', () => {
    // Without peasants, four lines hold in Aldmoor: each payday has the next, and the fifth the first again.
    const lines = [1, 2, 3, 4].map((n) => feastLine(payday(n)));
    expect(new Set(lines).size).toBe(4);
    expect(lines).toContain('Your men drink to the King, and to the day you bring Baron Grimsby in.');
    expect(feastLine(payday(5))).toBe(lines[0]);
  });

  it('says what the army is doing only when the army is there to do it', () => {
    const all = (army: { troop: 'peasants' | 'knights' | 'archers'; count: number }[]) => [1, 2, 3, 4, 5, 6].map((n) => feastLine(payday(n, army)));
    const dance = 'The peasants dance until the fire burns low, and the knights pretend not to watch.';
    expect(all([{ troop: 'peasants', count: 30 }, { troop: 'knights', count: 10 }])).toContain(dance);
    expect(all([{ troop: 'archers', count: 30 }])).not.toContain(dance);
  });

  it('once his bounty is paid, nobody drinks to bringing him in', () => {
    const paid = { ...payday(1), bounty: 'paid' as const };
    expect(feastLine(paid)).not.toMatch(/goose|bring/);
  });

  it('is written in the game\u2019s voice: plain full sentences, no colons, dashes, semicolons or brackets', () => {
    for (const { words } of FEAST_LINES) {
      expect(words, words).not.toMatch(/[:;()\u2013\u2014]| - /);
      expect(words, words).toMatch(/^[A-Z].*\.$/);
    }
  });
});
