import { commissionOf } from './campaign';
import { heroStats } from './hero';
import { payday as reopen } from './places';
import { again, close, COMMISSION, coins, LAST_DAY, PAYDAY_EVERY, roman, show, wages, type GameEvent, type GameState, type Result } from './state';

/** Next day: fresh legs. Every seventh day is payday: the King pays, troops take wages, places restock. */
export function endDay(state: GameState): Result {
  const day = state.day + 1;
  const payday = (day - 1) % PAYDAY_EVERY === 0;
  const stats = heroStats(state);
  let next: GameState = { ...state, day, movement: stats.movement, hero: { ...state.hero, mana: stats.maxMana } };
  const lines: string[] = [];
  if (payday) {
    const pay = Math.round(wages(state.army) * (1 + stats.wages));
    const commission = COMMISSION + stats.payday;
    next = {
      ...next,
      gold: next.gold + commission - pay,
      locations: next.locations.map(reopen),
    };
    lines.push(`**Payday!** The King sends **${coins(commission)} gold**. Your troops take **${coins(pay)}** in wages.`, 'The mill has flour again, and there are fresh volunteers.');
  }
  const events: GameEvent[] = [{ type: 'day', day, payday }];
  if (day > LAST_DAY && state.bounty === 'open') {
    next = { ...next, over: 'lost' };
    lines.push(commissionOf(state).timeout);
    events.push({ type: 'over', result: 'lost' });
  }
  const tryAgain = { label: 'Try this commission again', action: { type: 'retry' } } as const;
  events.push(show({ title: `Day ${roman(day)}`, lines: lines.length ? lines : ['The sun comes up over the province. Your horse looks rested.'], choices: next.over === 'lost' ? [tryAgain, again] : [close] }));
  return { state: next, events };
}
