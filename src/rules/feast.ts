import { FEAST_LINES } from '../content/feast';
import { commissionOf } from './campaign';
import { PAYDAY_EVERY, type GameState } from './state';

/**
 * The line under the fire at the payday feast (#191): the lines that hold for this commission, this army and this
 * bounty, taking turns payday by payday.
 */
export function feastLine(state: GameState): string {
  const { chapter } = state.campaign;
  const lines = FEAST_LINES.filter(
    (line) =>
      (line.chapter === undefined || line.chapter === chapter) &&
      (!line.open || state.bounty === 'open') &&
      (line.troops ?? []).every((troop) => state.army.some((s) => s.troop === troop && s.count > 0)),
  );
  // The first payday is day VIII.
  const payday = Math.max(0, Math.floor((state.day - 1) / PAYDAY_EVERY) - 1);
  return lines[payday % lines.length].words.replace('{villain}', commissionOf(state).villain);
}
