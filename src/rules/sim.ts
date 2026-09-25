import { ALDMOOR } from '../content/aldmoor';
import { playCommission, type BotRun } from './bot';
import { buildMap } from './map/model';
import { newGame } from './scenario';

/** Plays the commission once per seed and returns each run, for balance checks. */
export function simulate(seeds: number[]): (BotRun & { seed: number })[] {
  const map = buildMap(ALDMOOR);
  return seeds.map((seed) => ({ seed, ...playCommission(newGame(seed), map) }));
}
