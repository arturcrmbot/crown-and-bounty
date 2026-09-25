import { troopPower } from '../content/troops';
import { apply, armyPower, endDay, fight, leadershipUsed, locationById, recruitable, visit, type GameState, type Location } from './game';
import type { MapModel } from './map/model';
import { planRoute, routeCosts, stepAlong } from './map/movement';

export type BotRun = { won: boolean; day: number; gold: number; power: number; fights: number; retreats: number; log: string[] };

/** How much the bot wants a place right now, or null if it isn't worth riding to. */
function worth(state: GameState, l: Location): number | null {
  if (l.done && l.kind !== 'castle' && l.kind !== 'village') return null;
  const odds = l.enemy ? armyPower(state.army) / armyPower(l.enemy.army) : 0;
  switch (l.kind) {
    case 'chest':
      return 500;
    case 'gold':
    case 'mine':
      return l.gold ?? 0;
    case 'tower':
      return 400;
    case 'mill':
      return 60;
    case 'castle':
    case 'village': {
      const n = recruitable(state, l.id);
      return n > 0 ? n * troopPower(l.recruits!.troop) * 3 : null;
    }
    case 'patrol':
      return odds >= 1.3 ? l.enemy!.reward + 200 : null;
    case 'hideout':
      return odds >= 1.15 || (state.day > 70 && odds >= 0.95) ? 5000 : null;
    case 'signpost':
      return null;
  }
}

/**
 * A simple greedy player: ride to whatever is worth most per movement point, take leadership from
 * chests when short of it, recruit whatever it can, fight when the odds are good, end the day when
 * tired or when there's nothing to do. It uses exactly the rules the screens use.
 */
export function playCommission(start: GameState, map: MapModel, maxSteps = 20000): BotRun {
  let state = start;
  const log: string[] = [];
  let fights = 0;
  let retreats = 0;
  const nextDay = () => {
    state = endDay(state).state;
  };
  for (let guard = 0; guard < 400 && !state.over; guard++) {
    let best: { id: string; route: number[]; score: number } | null = null;
    for (const l of state.locations) {
      const value = worth(state, l);
      if (value === null) continue;
      const route = planRoute(state, map, l.at);
      if (!route) continue;
      const cost = route.length ? routeCosts(state, map, route).at(-1)! : 0;
      const score = value / (cost + 15);
      if (!best || score > best.score) best = { id: l.id, route, score };
    }
    if (!best) {
      nextDay();
      continue;
    }
    let route = best.route;
    for (let steps = 0; route.length > 0 && steps < maxSteps && !state.over; steps++) {
      const step = stepAlong(state, map, route);
      if (step) {
        state = step.state;
        route = route.slice(1);
      } else nextDay();
    }
    const place = locationById(state, best.id);
    state = visit(state, best.id).state;
    if (place.kind === 'chest' && !place.done) {
      const short = state.leadership - leadershipUsed(state.army) < 40;
      state = apply(state, { type: 'chest', id: place.id, take: short ? 'leadership' : 'gold' })!.state;
    } else if ((place.kind === 'castle' || place.kind === 'village') && recruitable(state, place.id) > 0) {
      state = apply(state, { type: 'recruit', id: place.id })!.state;
    } else if (place.enemy && !place.done) {
      fights++;
      const before = locationById(state, place.id).done;
      state = fight(state, place.id).state;
      if (locationById(state, place.id).done === before) retreats++;
    }
    log.push(`day ${state.day}: ${place.name}`);
  }
  return { won: state.over === 'won', day: state.day, gold: state.gold, power: armyPower(state.army), fights, retreats, log };
}
