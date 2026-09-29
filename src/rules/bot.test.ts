import { describe, expect, it } from 'vitest';
import { newGame } from './scenario';
import { playCampaign, playCampaignStarts } from './bot';
import { simulate, simulateCampaign } from './sim';

describe('the bot', () => {
  it('wins the Aldmoor commission for every seed, well before day C', () => {
    const runs = simulate(Array.from({ length: 8 }, (_, i) => i + 1));
    for (const run of runs) {
      expect(run.won, `seed ${run.seed}: ${run.log.join(', ')}`).toBe(true);
      // A bot that storms Grimsby too soon and loses takes a few weeks to raise another army.
      expect(run.day).toBeLessThan(75);
    }
  }, 900_000);

  it('wins Aldmoor and the Fenmarch, court included', () => {
    for (const { seed, runs } of simulateCampaign([1, 2, 3], 'wizard', 1)) {
      const last = runs.at(-1)!;
      expect(last.state.campaign.chapter, `seed ${seed}`).toBe(1);
      expect(last.won, `seed ${seed}: ${last.log.join(', ')}`).toBe(true);
      expect(last.state.campaign.record).toHaveLength(1);
    }
  }, 600_000);

  it('starts chapter III with the same state as the campaign bot', () => {
    const start = newGame(1, undefined, 'wizard');
    const chapter = 2;
    const runs = playCampaign(start, chapter);
    const journey = playCampaignStarts(start);
    let step = journey.next();
    while (!step.done && step.value.campaign.chapter < chapter) step = journey.next();

    expect(step.done).toBe(false);
    // The first try at that chapter: a commission lost and tried again adds a run before it.
    if (!step.done) expect(step.value).toEqual(runs.find((r) => r.start.campaign.chapter === chapter)!.start);
  }, 600_000);

  it('offers each background as the beginning of a bot campaign', () => {
    for (const background of ['knight', 'wizard', 'ranger', 'courtier'] as const) {
      const journey = playCampaignStarts(newGame(1066, undefined, background));
      const step = journey.next();
      expect(step.done).toBe(false);
      if (!step.done) expect(step.value.hero.background).toBe(background);
    }
  });
});
