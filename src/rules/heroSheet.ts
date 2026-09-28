import { TROOPS, troops } from '../content/troops';
import { commissionOf } from './campaign';
import { heroStats } from './hero';
import { COMMISSION, coins, LAST_DAY, PAYDAY_EVERY, roman, wages, type GameState } from './state';

/** Mana left, the most he can hold, and how it comes back: "Mana 12/30 · full again at dawn". */
export function manaNote(state: GameState): string {
  const max = heroStats(state).maxMana;
  const mana = state.hero.mana;
  if (max <= 0) return 'No mana: every point of knowledge holds 10';
  return `Mana ${mana}/${max} · ${mana >= max ? 'it fills up again every dawn' : 'full again at dawn'}`;
}

/** The spellbook's mana line: none comes back in battle. `max` is missing from a battle saved before it was kept. */
export function manaInBattle(mana: number, max?: number): string {
  return max === undefined ? `**${mana}** mana: none comes back in battle.` : `Mana **${mana}/${max}**: none comes back in battle, but it\u2019s full again at dawn.`;
}

/** The next payday: every seventh day, from day VIII. */
export const nextPayday = (state: GameState) => state.day + PAYDAY_EVERY - ((state.day - 1) % PAYDAY_EVERY);

/** What the King sends and the troops take on the next payday, as things stand. */
export function paydayOf(state: GameState): { day: number; pay: number; wages: number } {
  const s = heroStats(state);
  return { day: nextPayday(state), pay: COMMISSION + s.payday, wages: Math.round(wages(state.army) * (1 + s.wages)) };
}

/** Something on the map's bottom bar, for what it says under the pointer. */
export type BarItem =
  | { kind: 'gold' }
  | { kind: 'stack'; index: number }
  | { kind: 'bounty' }
  | { kind: 'movement' }
  | { kind: 'mana' }
  | { kind: 'day' }
  | { kind: 'hourglass' };

/** The bottom bar's hover labels, like HoMM2's status line: what each number means, and what a click does. */
export function barNote(state: GameState, item: BarItem): string {
  switch (item.kind) {
    case 'gold': {
      const p = paydayOf(state);
      return `${coins(state.gold)} gold · payday on day ${roman(p.day)}: the King sends ${coins(p.pay)}, wages take ${coins(p.wages)}`;
    }
    case 'stack': {
      const stack = state.army[item.index];
      if (!stack) return 'Your army';
      return `${troops(stack.troop, stack.count)} · ${coins(stack.count * TROOPS[stack.troop].wage)} gold in wages a week · click to see your army`;
    }
    case 'bounty': {
      const villain = commissionOf(state).villain;
      if (state.bounty === 'paid') return `The bounty on ${villain} is paid`;
      return `Wanted: ${villain}, by day ${LAST_DAY} · ${LAST_DAY - state.day} days left`;
    }
    case 'movement':
      return `${Math.floor(state.movement)} movement left today, of ${heroStats(state).movement} · E ends the day`;
    case 'mana':
      return `${manaNote(state)} · click for the hero (H)`;
    case 'day':
      return `Day ${roman(state.day)} of ${LAST_DAY} · payday every seventh day, next on day ${roman(nextPayday(state))}`;
    case 'hourglass':
      return 'End the day (E)';
  }
}
