import { again, close, COMMISSION, coins, LAST_DAY, MOVEMENT_PER_DAY, PAYDAY_EVERY, roman, show, wages, type GameEvent, type GameState, type Result } from './state';

/** Next day: fresh legs. Every seventh day is payday: the King pays, troops take wages, places restock. */
export function endDay(state: GameState): Result {
  const day = state.day + 1;
  const payday = (day - 1) % PAYDAY_EVERY === 0;
  let next: GameState = { ...state, day, movement: MOVEMENT_PER_DAY, hero: { ...state.hero, mana: state.hero.knowledge * 10 } };
  const lines: string[] = [];
  if (payday) {
    const pay = wages(state.army);
    next = {
      ...next,
      gold: next.gold + COMMISSION - pay,
      locations: next.locations.map((l) => (l.kind === 'mill' ? { ...l, done: false } : l.recruits ? { ...l, recruits: { ...l.recruits, count: l.recruits.count + 10 } } : l)),
    };
    lines.push(`**Payday!** The King sends **${coins(COMMISSION)} gold**. Your troops take **${coins(pay)}** in wages.`, 'The mill has flour again, and there are fresh volunteers.');
  }
  const events: GameEvent[] = [{ type: 'day', day, payday }];
  if (day > LAST_DAY && state.bounty === 'open') {
    next = { ...next, over: 'lost' };
    lines.push('The King\u2019s patience has run out. So has the goose\u2019s.');
    events.push({ type: 'over', result: 'lost' });
  }
  events.push(show({ title: `Day ${roman(day)}`, lines: lines.length ? lines : ['The sun comes up over the province. Your horse looks rested.'], choices: next.over ? [again] : [close] }));
  return { state: next, events };
}
