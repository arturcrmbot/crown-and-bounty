import { commissionOf } from './campaign';
import { heroMorning, heroPayday } from './dawn';
import { TROOPS } from '../content/troops';
import { heroStats, rested } from './hero';
import { mapOf } from './map/maps';
import { haul, setOut } from './map/convoys';
import { moveEnemies, trailedBy } from './map/roaming';
import { loseSight } from './map/sight';
import { rideHome, rideOut } from './map/sortie';
import { payday as reopen } from './places';
import { ambushCard } from './places/enemy';
import { again, close, COMMISSION, coins, LAST_DAY, locationById, PAYDAY_EVERY, roman, show, wages, type GameEvent, type GameState, type Location, type Result } from './state';

export { ambushCard };

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
  let next: GameState = { ...state, day, movement: stats.movement, hero: { ...state.hero, mana: rested(state.hero.mana, stats.maxMana) } };
  const lines: string[] = [];
  if (payday) {
    // Rations in the baggage (Westmere's grain, caught on the road) feed the troops instead of their wages.
    const fed = (state.rations ?? 0) > 0;
    const pay = fed ? 0 : Math.round(wages(state.army) * (1 + stats.wages));
    const commission = COMMISSION + stats.payday;
    next = {
      ...next,
      gold: next.gold + commission - pay,
      locations: next.locations.map((l) => grow(reopen(l))),
      ...(fed ? { rations: state.rations! - 1 } : {}),
    };
    const estates = heroPayday(next, stats);
    next = estates.state;
    const paid = fed ? 'Your troops eat the rations in your baggage this week, and draw **no wages**.' : `Your troops take **${coins(pay)} gold** in wages.`;
    // The mill's flour is news only once he has found a mill.
    const mill = state.locations.some((l) => l.kind === 'mill' && l.seen);
    lines.push(`**Payday!** The King sends **${coins(commission)} gold**. ${paid}`, ...estates.rents, mill ? 'The mill has flour again, and there are fresh volunteers.' : 'There are fresh volunteers to recruit.', ...estates.lines);
    // Who has more men now is the talk on payday, which goes in the journal (`heardOf`), so the card fits a phone (#155).
  }
  // Bands that wake today start to roam or hunt, and word gets about: in the journal (`heardOf`), and on
  // the day's card too unless it's payday's, which keeps to payday so it fits a phone (#155).
  if (!payday) for (const l of next.locations) if (l.enemy?.wakes?.day === day && !l.done) lines.push(l.enemy.wakes.news);
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
  // The night: a villain who has been hurt rides out, convoys go on along their roads, stacks on the
  // move take their walk, a hunter may reach the camp, and a villain's band that can't find the hero
  // goes home. On payday's dawn, convoys set out. Whatever moved where he can't see it is out of sight.
  const out = rideOut(next);
  const hauled = haul(out.state);
  const night = moveEnemies(hauled.state, mapOf(next));
  const home = rideHome(night.state);
  const convoys = payday ? setOut(home.state) : { state: home.state, events: [], lines: [] };
  const morning = heroMorning(loseSight(next, convoys.state), state);
  next = morning.state;
  events.push(...out.events, ...hauled.events, ...night.events, ...home.events, ...convoys.events, ...morning.events);
  // A convoy setting out is the talk on payday, in the journal (`heardOf`), not on its card (#155).
  lines.push(...out.lines, ...home.lines);
  // A hero who rides through woodland is told the trees will hide him too: nothing can follow him there (#217).
  const shelter = heroStats(next).forestWalk ? 'shelter in a town or among the trees' : 'shelter in a town';
  for (const l of trailedBy(next)) lines.push(`**${l.name}** are on your trail. Camp near them tonight and they’ll fall on you at dawn, so ride clear, ${shelter}, or turn and fight.`);
  if (night.ambush) {
    next = { ...next, ambush: night.ambush, ambushRest: undefined };
    const foe = locationById(next, night.ambush);
    events.push(show(ambushCard(next, lines), foe.at, foe.id));
    return { state: next, events };
  }
  // A dawn with news gets a card; a quiet one needs no click: the screens just say which day it is.
  if (lines.length) events.push(show({ title: `Day ${roman(day)}`, lines, choices: [close] }));
  return { state: next, events };
}
