import { describe, expect, it } from 'vitest';
import { activeFighter, createBattle, type BattleHero } from './battle';
import { autoResolve, chooseActionV1, commander, type Chooser } from './ai';
import type { Army } from '../state';
import { timeout } from '../../testing';

const none: BattleHero = { attack: 0, defence: 0, spellPower: 0, mana: 0, spells: [], castRound: 0 };

/** The same army on both sides, each commander playing each side once per seed. */
function duel(army: Army, seeds: number) {
  const score = { v2: 0, v1: 0, rounds: 0, games: 0 };
  for (let seed = 1; seed <= seeds; seed++) {
    for (const v2player of [true, false]) {
      const b = createBattle({ place: 'duel', seed: seed * 7919, player: army, enemy: army, hero: none, obstacles: 5 });
      const choose: Chooser = (s) => ((activeFighter(s)!.side === 'player') === v2player ? commander(s) : chooseActionV1(s));
      const end = autoResolve(b, choose);
      score.games++;
      score.rounds += end.round;
      if (end.result === 'won' || end.result === 'lost') score[(end.result === 'won') === v2player ? 'v2' : 'v1']++;
    }
  }
  return score;
}

describe('the commander', () => {
  it('beats the old one with mixed armies, and never stalls', () => {
    const mixed = duel([{ troop: 'knights', count: 6 }, { troop: 'swordsmen', count: 10 }, { troop: 'archers', count: 14 }, { troop: 'wolves', count: 10 }], 8);
    expect(mixed.v2).toBeGreaterThanOrEqual(13);
    expect(mixed.rounds / mixed.games).toBeLessThan(20);
  }, timeout(120_000));

  it('does at least as well as the old one with plain armies', () => {
    const plain = duel([{ troop: 'knights', count: 10 }, { troop: 'archers', count: 20 }], 8);
    expect(plain.v2).toBeGreaterThanOrEqual(plain.v1);
  }, timeout(120_000));

  it('grinds down regenerating trolls, and routs whoever can\u2019t land a blow', () => {
    const trolls = duel([{ troop: 'trolls', count: 5 }, { troop: 'goblins', count: 60 }, { troop: 'crossbowmen', count: 10 }], 6);
    expect(trolls.v2).toBeGreaterThan(trolls.v1);
    expect(trolls.rounds / trolls.games).toBeLessThan(25);
  }, timeout(120_000));
});
