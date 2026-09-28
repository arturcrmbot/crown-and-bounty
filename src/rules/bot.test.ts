import { describe, expect, it } from 'vitest';
import { simulate, simulateCampaign } from './sim';

describe('the bot', () => {
  it('wins the Aldmoor commission for every seed, well before day C', () => {
    const runs = simulate(Array.from({ length: 12 }, (_, i) => i + 1));
    for (const run of runs) {
      expect(run.won, `seed ${run.seed}: ${run.log.join(', ')}`).toBe(true);
      // A bot that storms Grimsby too soon and loses takes a few weeks to raise another army.
      expect(run.day).toBeLessThan(60);
    }
  }, 600_000);

  it('wins Aldmoor and the Fenmarch, court included', () => {
    for (const { seed, runs } of simulateCampaign([1, 2, 3], 'wizard', 1)) {
      const last = runs.at(-1)!;
      expect(last.state.campaign.chapter, `seed ${seed}`).toBe(1);
      expect(last.won, `seed ${seed}: ${last.log.join(', ')}`).toBe(true);
      expect(last.state.campaign.record).toHaveLength(1);
    }
  }, 600_000);
});
