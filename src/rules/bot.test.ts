import { describe, expect, it } from 'vitest';
import { simulate, simulateCampaign } from './sim';

describe('the bot', () => {
  it('wins the Aldmoor commission for every seed, well before day C', () => {
    const runs = simulate(Array.from({ length: 12 }, (_, i) => i + 1));
    for (const run of runs) {
      expect(run.won, `seed ${run.seed}: ${run.log.join(', ')}`).toBe(true);
      expect(run.day).toBeLessThan(40);
    }
  });

  it('wins the whole campaign, court and Fenmarch included', () => {
    for (const { seed, runs } of simulateCampaign([1, 2, 3], 'wizard')) {
      const last = runs.at(-1)!;
      expect(last.state.campaign.chapter, `seed ${seed}`).toBe(1);
      expect(last.won, `seed ${seed}: ${last.log.join(', ')}`).toBe(true);
      expect(last.state.campaign.record).toHaveLength(1);
    }
  }, 60_000);
});
