import { describe, expect, it } from 'vitest';
import { bare, reference, TARGETS, TARGET_DAY } from './difficulty';
import { winChance } from './fight';
import { newGame } from './scenario';

const within = (chance: number, range?: readonly [number, number]) => !range || (chance >= range[0] && chance <= range[1]);

describe('the power budget in Aldmoor', () => {
  for (const background of ['knight', 'wizard', 'ranger', 'courtier'] as const) {
    it(`holds for the ${background}: on day ${TARGET_DAY}, Grimsby is a hard fight for a careful player`, () => {
      const start = { ...newGame(1066, undefined, background), opening: undefined };
      const hero = reference(start);
      expect(hero.day).toBe(TARGET_DAY);
      expect(hero.locations.find((l) => l.id === 'hideout')!.done).toBe(false);
      const all = winChance(hero, 'hideout');
      const alone = winChance(bare(hero), 'hideout');
      expect(within(all, TARGETS.boss.budget), `with everything he found: ${all}`).toBe(true);
      // What he found counts: on his army alone, it's harder.
      expect(alone, `on his army alone: ${alone}`).toBeLessThanOrEqual(all);
    }, 900_000);
  }
});
