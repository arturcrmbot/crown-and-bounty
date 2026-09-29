/**
 * A villain's sortie (see `Sortie` in state.ts): hurt him, and he rides out of his lair with his guard
 * to meet the hero in the open. His band hunts the hero as any bold hunter does (`roaming.ts`); this is
 * the rest of it: riding out, riding home, and fleeing home beaten.
 */
import { leads } from '../../content/troops';
import { MAX_STACKS, update, type Army, type GameEvent, type GameState, type Location } from '../state';
import { hunting } from './roaming';

/** How near his gate a band has to be to go back in. */
const HOME = 24;

type Night = { state: GameState; events: GameEvent[]; lines: string[] };

/** The band a villain has out, if he has one. */
export function riddenOut(state: GameState, lair: Location): Location | null {
  const id = lair.enemy?.sortie?.band.id;
  return (id && state.locations.find((l) => l.id === id && !l.done && l.enemy?.lair === lair.id)) || null;
}

/** Whether this enemy's leader flees home when his army is beaten, instead of being taken: a villain met in the open, with his walls to run to. */
export function fleesHome(state: GameState, place: Location): boolean {
  const lair = place.enemy?.lair;
  return Boolean(lair && state.locations.some((l) => l.id === lair && !l.done));
}

/** The hurts a villain hasn't ridden out over yet: story flags set as his sortie says. */
function hurts(state: GameState, lair: Location): string[] {
  const e = lair.enemy!;
  const set = (flag: string, is?: unknown) => (is === undefined ? Boolean(state.flags?.[flag]) : state.flags?.[flag] === is);
  return e.sortie!.when.filter((w) => set(w.flag, w.is) && !(e.answered ?? []).includes(w.flag)).map((w) => w.flag);
}

/** Two armies as one: stacks of a kind together, and new kinds while there's room. */
export function merge(army: Army, more: Army): Army {
  const out = army.map((s) => ({ ...s }));
  for (const s of more) {
    if (s.count <= 0) continue;
    const same = out.find((x) => x.troop === s.troop);
    if (same) same.count += s.count;
    else if (out.length < MAX_STACKS) out.push({ ...s });
  }
  return out;
}

/**
 * The night a villain is hurt, once the hero is where his band would come for him, he rides out: the
 * band appears at his gate, with him and his guard, and the rest stay behind the walls. One already
 * out has answered already, and one beaten in the open stays home.
 */
export function rideOut(state: GameState): Night {
  let next = state;
  const events: GameEvent[] = [];
  const lines: string[] = [];
  for (const lair of state.locations) {
    const e = lair.enemy;
    if (!e?.sortie || lair.done || e.humbled || riddenOut(next, lair)) continue;
    const hurt = hurts(next, lair);
    if (!hurt.length) continue;
    const s = e.sortie;
    const guard = e.army.map((x) => ({ troop: x.troop, count: leads(x.troop) ? x.count : Math.round(x.count * s.guard) })).filter((x) => x.count > 0);
    const band: Location = { ...structuredClone(s.band), done: false, enemy: { ...structuredClone(s.band.enemy!), army: guard, lair: lair.id, home: s.band.at } };
    // Out of his band's reach tonight (far off, or behind a town's walls), the hurt keeps till he is.
    if (!hunting(next, band)) continue;
    const garrison = e.army.map((x) => ({ ...x, count: x.count - (guard.find((g) => g.troop === x.troop)?.count ?? 0) })).filter((x) => x.count > 0);
    const locations = next.locations.filter((l) => l.id !== band.id).map((l) => (l.id === lair.id ? { ...l, enemy: { ...e, army: garrison, answered: [...(e.answered ?? []), ...hurt] } } : l));
    next = { ...next, locations: [...locations, band] };
    events.push({ type: 'added', id: band.id });
    lines.push(s.out);
  }
  return { state: next, events, lines };
}

/**
 * After the night's walk: a band at its gate that can't find the hero goes back in, its villain with
 * it, and the nights it has left to look for him count down.
 */
export function rideHome(state: GameState): Night {
  let next = state;
  const events: GameEvent[] = [];
  const lines: string[] = [];
  for (const band of state.locations) {
    const e = band.enemy;
    if (!e?.lair || band.done) continue;
    const lair = next.locations.find((l) => l.id === e.lair && !l.done);
    const home = e.home ?? band.at;
    if (lair?.enemy?.sortie && !hunting(next, band) && Math.hypot(band.at[0] - home[0], band.at[1] - home[1]) <= HOME) {
      next = update(next, lair.id, { enemy: { ...lair.enemy, army: merge(lair.enemy.army, e.army) } });
      next = update(next, band.id, { done: true });
      events.push({ type: 'removed', id: band.id });
      lines.push(lair.enemy.sortie.home);
    } else if (e.patience) next = update(next, band.id, { enemy: { ...e, patience: e.patience - 1 } });
  }
  return { state: next, events, lines };
}

/** His band beaten in the open, the villain flees home without it, and stays there. */
export function fleeHome(state: GameState, band: Location): GameState {
  const lair = state.locations.find((l) => l.id === band.enemy?.lair && !l.done);
  if (!lair?.enemy) return state;
  const leaders = band.enemy!.army.filter((s) => leads(s.troop));
  return update(state, lair.id, { enemy: { ...lair.enemy, army: merge(lair.enemy.army, leaders), humbled: true } });
}
