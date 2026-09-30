import type { GameState, Result } from '../rules/game';
import type { Point } from '../rules/map/geometry';

/** The choice to rest is always offered when a route has used the day's movement. Played by touch, there's no E to press. */
export function tiredResult(state: GameState, rides: boolean, at: Point, touch = false): Result {
  return {
    state,
    events: [{
      type: 'card',
      card: {
        title: rides ? 'Your horse is spent' : 'Your legs are spent',
        lines: ['End the day to rest, and you ride on at dawn. The red marks on the route are for tomorrow.'],
        choices: [
          { label: touch ? 'End the day' : 'End the day (E)', action: { type: 'endDay' } },
          { label: 'Not yet', detail: 'Look around first. The route will wait.', action: { type: 'close' } },
        ],
      },
      at,
    }],
  };
}
