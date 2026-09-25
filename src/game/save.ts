import type { GameState } from '../rules/game';

const KEY = 'kings-commission/save/v1';

/** Saves are just the rules state as JSON. */
export function saveGame(state: GameState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private windows and full storage just don't save.
  }
}

export function loadGame(): GameState | null {
  try {
    const text = localStorage.getItem(KEY);
    if (!text) return null;
    const state = JSON.parse(text) as GameState;
    return state && Array.isArray(state.explored) && state.hero ? state : null;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
