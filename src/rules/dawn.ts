/**
 * What the hero's skills do as the days go by. On payday: fuller castles and villages, rents and
 * volunteers. Every morning: scouts who report where every band stands. `endDay` calls these.
 */
import { TROOPS } from '../content/troops';
import { heroStats } from './hero';
import { revealDisc } from './map/fog';
import { RESTOCK } from './places/dwelling';
import { addTroops, coins, leadershipUsed, troops, type GameEvent, type GameState } from './state';

const dwelling = (kind: string) => kind === 'castle' || kind === 'village';

/**
 * Payday, after the King's gold and the wages: what the hero's estates and his name bring in.
 * `paid` is what the payday itself counted: its rents and interest were on the purse before it.
 */
export function heroPayday(state: GameState, paid = heroStats(state)): { state: GameState; rents: string[]; lines: string[] } {
  const s = heroStats(state);
  let next = state;
  const parts = [paid.rents && `**${coins(paid.rents)} gold** is rent from the castles and villages you have visited`, paid.interest && `**${coins(paid.interest)} gold** is the bankers\u2019 interest on your purse`].filter(Boolean);
  const rents = parts.length ? [`Of that, ${parts.join(', and ')}.`] : [];
  const lines: string[] = [];
  const extra = Math.round(RESTOCK * s.restock);
  if (extra > 0) {
    next = { ...next, locations: next.locations.map((l) => (l.recruits && dwelling(l.kind) ? { ...l, recruits: { ...l.recruits, count: l.recruits.count + extra } } : l)) };
    lines.push(`Your stewards have been busy: every castle and village has **${extra} more volunteers** than usual.`);
  }
  if (s.volunteers > 0) {
    // Your name draws men to your biggest company. Beasts don't read proclamations.
    const paid = next.army.filter((t) => TROOPS[t.troop].wage > 0);
    const biggest = paid.reduce<(typeof paid)[number] | null>((a, b) => (!a || b.count * TROOPS[b.troop].leadership > a.count * TROOPS[a.troop].leadership ? b : a), null);
    if (biggest) {
      const each = TROOPS[biggest.troop].leadership;
      const room = Math.floor((s.leadership - leadershipUsed(next.army)) / each);
      const count = Math.min(room, Math.max(1, Math.floor(s.volunteers / each)));
      const army = count > 0 ? addTroops(next.army, biggest.troop, count) : null;
      if (army) next = { ...next, army };
      lines.push(army ? `**${troops(biggest.troop, count)}** ride in to join you, for your name alone.` : 'Volunteers ride in to join you, for your name alone, but you can\u2019t lead any more.');
    }
  }
  return { state: next, rents, lines };
}

/** How far round each band the mist lifts when the hero's scouts are shadowing it. */
export const SHADOWED = 56;

/** How far round a treasure the mist lifts when a treasure hunter smells it. */
export const SMELLED = 36;

/**
 * Morning, after the night's moves. A night rider rides on with what he left of yesterday
 * (`yesterday` is the day before it ended). Scouts who shadow every band report where it stands
 * now, and a treasure hunter smells any treasure near his camp.
 */
export function heroMorning(state: GameState, yesterday: GameState): { state: GameState; events: GameEvent[] } {
  const s = heroStats(state);
  let explored = state.explored;
  const events: GameEvent[] = [];
  const lift = (at: GameState['hero']['at'], radius: number) => {
    const seen = revealDisc(explored, state.world, at[0], at[1], radius);
    explored = seen.bits;
    if (seen.changed) events.push({ type: 'reveal', at, radius });
  };
  for (const l of state.locations) {
    if (l.done) continue;
    if (s.shadow && l.enemy && l.kind !== 'hideout') lift(l.at, SHADOWED);
    const treasure = l.kind === 'chest' || l.kind === 'gold' || l.kind === 'mine';
    if (s.smells && treasure && Math.hypot(l.at[0] - state.hero.at[0], l.at[1] - state.hero.at[1]) <= s.smells) lift(l.at, SMELLED);
  }
  const carried = Math.min(Math.max(0, yesterday.movement), Math.round(heroStats(yesterday).movement * s.carry));
  return { state: { ...state, explored, movement: state.movement + carried }, events };
}
