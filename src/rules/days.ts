import { commissionOf } from './campaign';
import { heroMorning, heroPayday } from './dawn';
import { TROOPS } from '../content/troops';
import { heroStats } from './hero';
import { mapOf } from './map/maps';
import { moveEnemies } from './map/roaming';
import { payday as reopen } from './places';
import { FIGHT_NOTE, oddsLine, SERGEANTS_NOTE } from './places/enemy';
import { likelyLossesLine, winChance } from './fight';
import { again, close, COMMISSION, coins, LAST_DAY, locationById, PAYDAY_EVERY, roman, show, wages, type Card, type Choice, type GameEvent, type GameState, type Location, type Result } from './state';

/** The card while an enemy has fallen on the camp: fight, or run. It stays until answered. */
export function ambushCard(state: GameState, before: string[] = []): Card {
  const foe = locationById(state, state.ambush!);
  const choices: Choice[] = [
    { label: 'To arms!', detail: FIGHT_NOTE, action: { type: 'choose', id: foe.id, choice: 'fight' } },
    { label: 'Let the sergeants handle it', detail: SERGEANTS_NOTE, action: { type: 'choose', id: foe.id, choice: 'auto' } },
    { label: 'Run for it (lose a fifth of the army)', action: { type: 'choose', id: foe.id, choice: 'flee' } },
  ];
  return { title: `Day ${roman(state.day)}: ambush!`, lines: [...before, `At first light, **${foe.name}** fall on your camp!`, foe.enemy!.threat, oddsLine(winChance(state, foe.id)), likelyLossesLine(state, foe.id)], choices };
}

/** A villain recruits on payday; the villain himself stays one. */
function grow(l: Location): Location {
  const e = l.enemy;
  if (!e?.grows || l.done || (e.grown ?? 0) >= MAX_GROWTH) return l;
  const army = e.army.map((s) => (TROOPS[s.troop].leadership >= 99 ? s : { ...s, count: Math.round(s.count * (1 + e.grows!)) }));
  return { ...l, enemy: { ...e, army, grown: (e.grown ?? 0) + 1 } };
}

/** Paydays a villain goes on recruiting for. */
const MAX_GROWTH = 5;

/**
 * Next day: fresh legs. Payday comes once a week, from day VIII: the King pays, troops take wages, places
 * restock, villains recruit. In the night, stacks on the move take their walk.
 */
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
      locations: next.locations.map((l) => grow(reopen(l))),
    };
    const estates = heroPayday(next, stats);
    next = estates.state;
    lines.push(`**Payday!** The King sends **${coins(commission)} gold**. Your troops take **${coins(pay)}** in wages.`, ...estates.rents, 'The mill has flour again, and there are fresh volunteers.', ...estates.lines);
    for (const l of state.locations) if (l.enemy?.grows && !l.done && (l.enemy.grown ?? 0) < MAX_GROWTH) lines.push(`Word on the road: **${l.name}** has taken on more men.`);
  }
  const events: GameEvent[] = [{ type: 'day', day, payday }];
  if (day > LAST_DAY && state.bounty === 'open') {
    next = { ...next, over: 'lost' };
    lines.push(commissionOf(state).timeout);
    events.push({ type: 'over', result: 'lost' });
  }
  const tryAgain = { label: 'Try this commission again', action: { type: 'retry' } } as const;
  if (next.over) {
    events.push(show({ title: `Day ${roman(day)}`, lines, choices: next.over === 'lost' ? [tryAgain, again] : [close] }));
    return { state: next, events };
  }
  // The night: stacks on the move, and a hunter may reach the camp.
  const night = moveEnemies(next, mapOf(next));
  const morning = heroMorning(night.state, state);
  next = morning.state;
  events.push(...night.events, ...morning.events);
  const trailing = next.locations.filter((l) => l.enemy?.trailing && !l.done);
  for (const l of trailing) lines.push(`**${l.name}** are on your trail. Camp near them tonight and they’ll fall on you at dawn: ride clear, shelter in a town, or turn and fight.`);
  if (night.ambush) {
    next = { ...next, ambush: night.ambush };
    const foe = locationById(next, night.ambush);
    events.push(show(ambushCard(next, lines), foe.at, foe.id));
    return { state: next, events };
  }
  // A dawn with news gets a card; a quiet one needs no click: the screens just say which day it is.
  if (lines.length) events.push(show({ title: `Day ${roman(day)}`, lines, choices: [close] }));
  return { state: next, events };
}
