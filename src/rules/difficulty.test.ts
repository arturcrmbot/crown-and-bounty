import { describe, expect, it } from 'vitest';
import { climbed, medians, TARGETS, type Step } from './difficulty';
import type { GameState } from './state';
import { newGame } from './scenario';

/** Whether each step of the climb with an enemy still standing is where the targets say, at this moment. */
function holds(state: GameState, when: keyof typeof TARGETS) {
  const now = medians(state);
  for (const [step, [low, high]] of Object.entries(TARGETS[when]) as [string, readonly [number, number]][]) {
    const chance = now[(step === 'top' ? step : Number(step)) as Step];
    if (chance !== undefined) expect(chance >= low && chance <= high, `${when}: ${step === 'top' ? 'the villain' : `ring ${step}`} at ${chance}`).toBe(true);
  }
}

describe('the climb in Aldmoor', () => {
  for (const background of ['knight', 'wizard', 'ranger', 'courtier'] as const) {
    it(`holds for the ${background}: a fair first fight, the river and the chase once the first two rings are done, and the villain out of reach`, () => {
      const start = { ...newGame(1066, undefined, background), opening: undefined };
      holds(start, 'start');
      const later = climbed(start);
      holds(later, 'climbed');
      // The first two rings and nothing more: no band beyond the second has been touched (the grain cart waits off the road till payday).
      expect(later.locations.filter((l) => (l.enemy?.ring ?? 0) > 2 && !l.enemy!.convoy).some((l) => l.done)).toBe(false);
    }, 600_000);
  }
});
