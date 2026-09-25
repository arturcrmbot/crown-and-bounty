import type { Province } from '../../content/types';
import { troopPower } from '../../content/troops';
import type { Army } from '../state';
import { chooseAction } from './ai';
import { battleAct, createBattle, type BattleHero, type BattleState } from './battle';

export type BattleStats = { fight: string; wins: number; seeds: number; rounds: number; actions: number; lost: number; spells: number };

const power = (b: BattleState, side: 'player' | 'enemy') => b.fighters.filter((f) => f.side === side).reduce((s, f) => s + f.count * troopPower(f.troop), 0);

/** AI against AI for many seeds: how often the player's side wins, how long it takes, what it costs. */
export function battleStats(province: Province, fight: string, player: Army, hero: BattleHero, seeds = 40): BattleStats {
  const place = province.locations.find((l) => l.id === fight)!;
  const stats: BattleStats = { fight, wins: 0, seeds, rounds: 0, actions: 0, lost: 0, spells: 0 };
  for (let seed = 1; seed <= seeds; seed++) {
    let b = createBattle({ place: fight, seed, player, enemy: place.enemy!.army, hero, obstacles: place.kind === 'hideout' ? 3 : 5 });
    const start = power(b, 'player');
    for (let n = 0; n < 3000 && !b.result; n++) {
      const action = chooseAction(b);
      if (action.type === 'cast') stats.spells++;
      b = battleAct(b, action).battle;
      stats.actions++;
    }
    if (b.result === 'won') stats.wins++;
    stats.rounds += b.round;
    stats.lost += 1 - power(b, 'player') / start;
  }
  return { ...stats, rounds: stats.rounds / seeds, actions: stats.actions / seeds, lost: stats.lost / seeds, spells: stats.spells / seeds };
}
