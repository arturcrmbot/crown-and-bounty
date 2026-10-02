import { heroStats, listed, type GameState, type Result } from '../rules/game';
import type { Point } from '../rules/map/geometry';
import { amongTrees, trailedBy } from '../rules/map/roaming';

/**
 * Where a hero who rides through woodland camps tonight, while a band is on his trail: among the trees,
 * where nothing can follow him, or out in the open, where it will find him (#217). Nothing for anyone else.
 */
export function campLine(state: GameState): string | null {
  const hunters = trailedBy(state);
  if (!hunters.length || !heroStats(state).forestWalk) return null;
  return amongTrees(state, state.hero.at)
    ? 'You camp among the trees tonight, where nothing on the map can follow you.'
    : `You camp in the open tonight, and ${listed(hunters.map((l) => `**${l.name}**`))} are on your trail.`;
}

/** The choice to rest is always offered when a route has used the day's movement. Played by touch, there's no E to press. */
export function tiredResult(state: GameState, rides: boolean, at: Point, touch = false): Result {
  const camp = campLine(state);
  return {
    state,
    events: [{
      type: 'card',
      card: {
        title: rides ? 'Your horse is spent' : 'Your legs are spent',
        lines: ['End the day to rest, and you ride on at dawn. The red marks on the route are for tomorrow.', ...(camp ? [camp] : [])],
        choices: [
          { label: touch ? 'End the day' : 'End the day (E)', action: { type: 'endDay' } },
          { label: 'Not yet', detail: 'Look around first. The route will wait.', action: { type: 'close' } },
        ],
      },
      at,
    }],
  };
}
