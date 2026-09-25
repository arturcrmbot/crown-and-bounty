import { ALDMOOR } from '../content/aldmoor';
import type { BackgroundId } from '../content/backgrounds';
import { playCommission, type BotRun } from './bot';
import { buildMap } from './map/model';
import { newGame } from './scenario';

/** Plays the commission once per seed and returns each run, for balance checks. */
export function simulate(seeds: number[], background: BackgroundId = 'knight'): (BotRun & { seed: number })[] {
  const map = buildMap(ALDMOOR);
  return seeds.map((seed) => {
    const run = playCommission(newGame(seed, ALDMOOR, background), map);
    return { seed, ...run };
  });
}
