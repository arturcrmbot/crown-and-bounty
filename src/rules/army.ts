import { moveWithin } from './hero';
import type { GameState, Result } from './state';

/** Moves a stack along the army line: onto another, the two swap. Its place sets its row in battle. */
export function moveStack(state: GameState, from: number, to: number): Result | null {
  const army = moveWithin(state.army, from, to);
  return army ? { state: { ...state, army }, events: [] } : null;
}

/** Sends a stack home for good. The last one stays: an officer needs somebody to lead. */
export function dismiss(state: GameState, index: number): Result | null {
  if (!state.army[index] || state.army.length <= 1) return null;
  return { state: { ...state, army: state.army.filter((_, i) => i !== index) }, events: [] };
}
