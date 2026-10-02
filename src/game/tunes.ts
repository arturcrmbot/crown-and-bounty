import type { TrackId } from '../audio/score';
import type { TroopId } from '../content/troops';
import type { BattleState } from '../rules/battle/battle';

/** Each commission's own tunes: Aldmoor's, the Fenmarch's, then the three provinces beyond. */
const PROVINCE_TUNES: TrackId[] = ['heath', 'fen', 'weald', 'marsh', 'reach'];

export const provinceTune = (chapter: number, fen: boolean): TrackId => PROVINCE_TUNES[chapter] ?? (fen ? 'marsh' : 'weald');

/** A villain's theme, if one of these troops is a villain: Bramble's temper outshouts the Baron's march when they're together. */
export function villainTune(troops: readonly TroopId[]): TrackId | null {
  if (troops.includes('bramble')) return 'bramble';
  if (troops.includes('witch')) return 'mirrow';
  if (troops.includes('baron')) return 'grimsby';
  return null;
}

/** The music for a battle: the villain's theme in his own fight, otherwise the battle's. */
export const battleTune = (b: BattleState): TrackId => villainTune(b.fighters.filter((f) => f.side === 'enemy').map((f) => f.troop)) ?? 'battle';
