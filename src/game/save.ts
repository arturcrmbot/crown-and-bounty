import { ALDMOOR } from '../content/aldmoor';
import { campaignSeed, withNewPlaces } from '../rules/campaign';
import type { GameState } from '../rules/game';
import { beginCommission } from '../rules/scenario';

/**
 * Bump the version whenever the state's shape changes, so old saves are dropped rather than
 * half-loaded, and the generator's whenever it lays provinces out differently: a save only
 * records a generated province's seed, and must get the same map back.
 */
const VERSION = 7;
const GENERATOR = 2;
const KEY = `kings-commission/save/v${VERSION}-g${GENERATOR}`;
/** Saves from before Aldmoor grew (v6), and before the three trinket slots (v5): both still load. */
const PREVIOUS_KEYS = [`kings-commission/save/v6-g${GENERATOR}`, `kings-commission/save/v5-g${GENERATOR}`];
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
    for (const key of PREVIOUS_KEYS) localStorage.removeItem(key);
  } catch {
    // Private windows and full storage just don't save.
  }
}

export function loadGame(): GameState | null {
  try {
    const current = localStorage.getItem(KEY);
    const text = current ?? PREVIOUS_KEYS.map((key) => localStorage.getItem(key)).find((t) => t !== null);
    if (!text) return null;
    const state = JSON.parse(text) as GameState;
    const valid = state && Array.isArray(state.explored) && Array.isArray(state.army) && typeof state.hero?.level === 'number' && typeof state.campaign?.chapter === 'number' && typeof state.campaign.seed === 'number';
    if (!valid) return null;
    return withNewPlaces(current === null ? onTheBiggerMap(state) : state);
  } catch {
    return null;
  }
}

/**
 * Aldmoor grew three times over (v7): a save made out on its old map begins the commission again on
 * the new one, with the hero, purse and army it began with. Saves from later commissions, or at
 * court with Grimsby caught, carry on as they were.
 */
function onTheBiggerMap(state: GameState): GameState {
  if (state.campaign.chapter !== 0 || state.campaign.court) return state;
  const { start, record } = state.campaign;
  const again = beginCommission(ALDMOOR, state.seed, start, 0, record, campaignSeed(state.campaign));
  if (state.over !== 'won') return state.opening ? { ...again, opening: true } : again;
  // Grimsby is caught and the King is waiting: only where everything stands moves to the new map. Camps and
  // caches that turned up on the old one have nowhere on the new, and are never visited again.
  const where = new Map(ALDMOOR.locations.map((l) => [l.id, l.at]));
  const locations = state.locations.filter((l) => where.has(l.id)).map((l) => ({ ...l, at: where.get(l.id)! }));
  return { ...state, locations, world: again.world, explored: again.explored, hero: { ...state.hero, at: again.hero.at } };
}

export function clearSave() {
  saving = false;
  try {
    localStorage.removeItem(KEY);
    for (const key of PREVIOUS_KEYS) localStorage.removeItem(key);
  } catch {
    // Nothing to clear.
  }
}
