import { withNewPlaces } from '../rules/campaign';
import type { GameState } from '../rules/game';

/**
 * Bump the version whenever the state's shape changes, so old saves are dropped rather than
 * half-loaded, and the generator's whenever it lays provinces out differently: a save only
 * records a generated province's seed, and must get the same map back.
 */
const VERSION = 5;
const GENERATOR = 2;
const KEY = `kings-commission/save/v${VERSION}-g${GENERATOR}`;
/** Off once a restart has begun (or for frozen test pages), so nothing writes the old game back. */
let saving = true;

export function stopSaving() {
  saving = false;
}

/** Saves are just the rules state as JSON. */
export function saveGame(state: GameState) {
  if (!saving) return;
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
    const valid = state && Array.isArray(state.explored) && Array.isArray(state.army) && typeof state.hero?.level === 'number' && typeof state.campaign?.chapter === 'number' && typeof state.campaign.seed === 'number';
    return valid ? withNewPlaces(state) : null;
  } catch {
    return null;
  }
}

export function clearSave() {
  saving = false;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
