import type { GameState, Result } from '../rules/game';
import type { Point } from '../rules/map/geometry';

/** The choice to rest is always offered when a route has used the day's movement. */
export function tiredResult(state: GameState, rides: boolean, at: Point): Result {
  return {
    state,
    events: [{
      type: 'card',
      card: {
        title: rides ? 'Your horse is spent' : 'Your legs are spent',
        lines: ['End the day to rest, and he rides on at dawn. Red marks on the route are for tomorrow.'],
        choices: [
          { label: 'End the day (E)', action: { type: 'endDay' } },
          { label: 'Not yet', detail: 'Look around first: the route waits.', action: { type: 'close' } },
        ],
      },
      at,
    }],
  };
}
