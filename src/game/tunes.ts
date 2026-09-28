import type { Mood, TrackId } from '../audio/score';
import { troopPower, type TroopId } from '../content/troops';
import type { BattleState } from '../rules/battle/battle';
import type { GameState } from '../rules/game';
import type { Point } from '../rules/map/geometry';

/** Each commission's own tune: Aldmoor's jig, the Fenmarch's mist, then the three provinces beyond. */
const PROVINCE_TUNES: TrackId[] = ['heath', 'fen', 'weald', 'marsh', 'reach'];

export const provinceTune = (chapter: number, fen: boolean): TrackId => PROVINCE_TUNES[chapter] ?? (fen ? 'marsh' : 'weald');

/** A villain's theme, if one of these troops is a villain: Bramble's temper outshouts the Baron's march when they're together. */
export function villainTune(troops: readonly TroopId[]): TrackId | null {
  if (troops.includes('bramble')) return 'bramble';
  if (troops.includes('witch')) return 'mirrow';
  if (troops.includes('baron')) return 'grimsby';
  return null;
}

/** How near a villain's lair his theme starts to play, in map pixels. */
export const LAIR_RANGE = 300;

/** The theme of a villain whose lair the hero is near, while it still stands. */
export function lairTune(state: GameState, [x, y]: Point): TrackId | null {
  for (const l of state.locations) {
    if (l.kind !== 'hideout' || l.done || !l.enemy) continue;
    if (Math.hypot(l.at[0] - x, l.at[1] - y) > LAIR_RANGE) continue;
    const tune = villainTune(l.enemy.army.map((s) => s.troop));
    if (tune) return tune;
  }
  return null;
}

/** The music for a battle: the villain's theme in his own fight, otherwise the battle march. */
export const battleTune = (b: BattleState): TrackId => villainTune(b.fighters.filter((f) => f.side === 'enemy').map((f) => f.troop)) ?? 'battle';

/**
 * How a battle is going, for the music. Intensity starts low and builds with each round and with
 * everything lost on either side; the balance is how much less of his strength the hero has lost
 * than the enemy has of theirs: above 0 he's winning.
 */
export function battleMood(b: BattleState): Mood {
  const worth = (side: 'player' | 'enemy', count: (f: BattleState['fighters'][number]) => number) =>
    b.fighters.filter((f) => f.side === side).reduce((sum, f) => sum + count(f) * troopPower(f.troop), 0);
  const ours = worth('player', (f) => f.count);
  const theirs = worth('enemy', (f) => f.count);
  const ours0 = Math.max(1, worth('player', (f) => f.startCount));
  const theirs0 = Math.max(1, worth('enemy', (f) => f.startCount));
  const lost = 1 - (ours + theirs) / (ours0 + theirs0);
  const intensity = Math.min(1, 0.25 + 0.1 * Math.max(0, b.round - 1) + 1.2 * lost);
  return { intensity, balance: Math.max(-1, Math.min(1, ours / ours0 - theirs / theirs0)) };
}

/** On the map, and everywhere but a battle, the music is calm. */
export const CALM: Mood = { intensity: 0, balance: 0 };
