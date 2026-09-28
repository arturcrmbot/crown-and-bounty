import type { BattleState, Fighter } from '../rules/battle/battle';

/** The living fighters shown in the current turn queue, in the order they will act. */
export function upcomingFighters(battle: BattleState, limit = 6): Fighter[] {
  const fighters = new Map(battle.fighters.map((fighter) => [fighter.id, fighter] as const));
  return battle.order
    .flatMap((id) => {
      const fighter = fighters.get(id);
      return fighter && fighter.count > 0 ? [fighter] : [];
    })
    .slice(0, limit);
}
