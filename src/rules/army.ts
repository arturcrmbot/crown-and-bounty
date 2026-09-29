import { feuding, TROOPS, type TroopId } from '../content/troops';
import { GRUMBLE } from './battle/battle';
import { moveWithin } from './hero';
import type { Army, GameState, Result } from './state';

/**
 * A word of warning before newcomers join: which of the army's companies won't march happily
 * beside them (see `FEUDS` in content/troops.ts), and what it costs. Nothing if they'd all get on,
 * or if the quarrel is an old one: their people already march with the army.
 */
export function grumbleLine(army: Army, newcomers: readonly TroopId[]): string | null {
  const here = army.filter((s) => s.count > 0);
  const people = (t: TroopId) => TROOPS[t].people;
  const fresh = [...new Set(newcomers.filter((t) => !here.some((s) => people(s.troop) === people(t))))];
  const old = [...new Set(here.filter((s) => fresh.some((t) => feuding(s.troop, t))).map((s) => s.troop))];
  if (!old.length) return null;
  const names = (ids: TroopId[]) => {
    const all = ids.map((id) => TROOPS[id].name);
    return all.length > 1 ? `${all.slice(0, -1).join(', ')} and ${all[all.length - 1]}` : all[0];
  };
  const quarrel = fresh.filter((t) => old.some((o) => feuding(o, t)));
  return `*Your ${names(old)} won\u2019t march happily beside ${names(quarrel)}: \u2212${Math.round(GRUMBLE * 100)}% morale for all of them.*`;
}

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
