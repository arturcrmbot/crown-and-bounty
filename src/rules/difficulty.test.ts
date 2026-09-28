import { describe, expect, it } from 'vitest';
import { explored, odds, TARGETS } from './difficulty';
import { newGame } from './scenario';

const within = (chance: number, range?: readonly [number, number]) => !range || (chance >= range[0] && chance <= range[1]);

describe('the difficulty model in Aldmoor', () => {
  for (const background of ['knight', 'wizard', 'ranger', 'courtier'] as const) {
    it(`holds for the ${background}: easy first fights, gates to come back to, a villain out of reach`, () => {
      const start = { ...newGame(1066, undefined, background), opening: undefined };
      for (const o of odds(start)) expect(within(o.chance, TARGETS[o.tier].start), `${o.id} (${o.tier}) at the start: ${o.chance}`).toBe(true);
      const later = explored(start);
      for (const o of odds(later)) expect(within(o.chance, TARGETS[o.tier].explored), `${o.id} (${o.tier}) once explored: ${o.chance}`).toBe(true);
      // Exploring beats the pests and nothing more.
      expect(later.locations.filter((l) => l.enemy?.tier === 'pest').every((l) => l.done)).toBe(true);
      expect(later.locations.filter((l) => l.enemy?.tier === 'gate').some((l) => l.done)).toBe(false);
    }, 60_000);
  }
});
