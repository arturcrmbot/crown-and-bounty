/** The rules in one place: state, places, days and fights, plus `apply` for anything a card can do. */
import { endDay } from './days';
import { fight } from './fight';
import { openChest, recruit } from './places';
import type { Action, GameState, Result } from './state';

export * from './state';
export { describe, describeHero, openChest, recruit, recruitable, visit } from './places';
export { endDay } from './days';
export { fight } from './fight';

/** Applies a card choice. `go`, `close` and `restart` are for the screens, so they return null here. */
export function apply(state: GameState, action: Action): Result | null {
  switch (action.type) {
    case 'chest':
      return openChest(state, action.id, action.take);
    case 'recruit':
      return recruit(state, action.id);
    case 'fight':
      return fight(state, action.id);
    case 'endDay':
      return endDay(state);
    default:
      return null;
  }
}
