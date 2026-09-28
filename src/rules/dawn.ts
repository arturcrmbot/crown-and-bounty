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

/** Payday, after the King's gold and the wages: what the hero's estates and his name bring in. */
export function heroPayday(state: GameState): { state: GameState; rents: string[]; lines: string[] } {
  const s = heroStats(state);
  let next = state;
  const rents = s.rents ? [`Of that, **${coins(s.rents)} gold** is rent from the castles and villages you have visited.`] : [];
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

/** Morning, after the night's moves: scouts who shadow every band report where it stands now. */
export function heroMorning(state: GameState): { state: GameState; events: GameEvent[] } {
  if (!heroStats(state).shadow) return { state, events: [] };
  let explored = state.explored;
  const events: GameEvent[] = [];
  for (const l of state.locations) {
    if (!l.enemy || l.done || l.kind === 'hideout') continue;
    const seen = revealDisc(explored, state.world, l.at[0], l.at[1], SHADOWED);
    explored = seen.bits;
    if (seen.changed) events.push({ type: 'reveal', at: l.at, radius: SHADOWED });
  }
  return { state: { ...state, explored }, events };
}
