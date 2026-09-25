import { describe, expect, it } from 'vitest';
import { simulate } from './sim';

describe('the bot', () => {
  it('wins the Aldmoor commission for every seed, well before day C', () => {
    const runs = simulate(Array.from({ length: 12 }, (_, i) => i + 1));
    for (const run of runs) {
      expect(run.won, `seed ${run.seed}: ${run.log.join(', ')}`).toBe(true);
      expect(run.day).toBeLessThan(40);
    }
  });
});
