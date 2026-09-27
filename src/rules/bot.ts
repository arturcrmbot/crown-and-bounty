import { apply, armyPower, endDay, fight, hasNextCommission, learn, locationById, PLACE_KINDS, provinceOf, visit, type BoonId, type GameState } from './game';
import { buildMap, type MapModel } from './map/model';
import { planRoute, routeCosts, stepAlong } from './map/movement';

export type BotRun = { won: boolean; day: number; gold: number; power: number; fights: number; retreats: number; level: number; log: string[]; state: GameState };

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
      const value = PLACE_KINDS[l.kind].worth(state, l);
      if (value === null) continue;
      const route = planRoute(state, map, l.at, Boolean(l.enemy));
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
    if (place.enemy && !place.done) {
      fights++;
      const before = locationById(state, place.id).done;
      state = fight(state, place.id)?.state ?? state;
      if (locationById(state, place.id).done === before) retreats++;
    } else {
      state = PLACE_KINDS[place.kind].bot?.(state, locationById(state, place.id)) ?? state;
    }
    while (state.hero.offers.length > 0) state = learn(state, state.hero.offers[0].options[0])!.state;
    log.push(`day ${state.day}: ${place.name}`);
  }
  return { won: state.over === 'won', day: state.day, gold: state.gold, power: armyPower(state.army), fights, retreats, level: state.hero.level, log, state };
}

/** The boon the bot asks the King for: leadership if it can, else gold, else whatever is first. */
function pickBoon(state: GameState): BoonId {
  const boons = state.campaign.court!.boons;
  return (['warrant', 'purse', 'fencing', 'armourer'] as BoonId[]).find((b) => boons.includes(b)) ?? boons[0];
}

/**
 * Plays every commission in turn: each province on its own map, then court, a boon and on to the
 * next. A lost commission is tried once more from its start, as a player would.
 */
export function playCampaign(start: GameState, lastChapter = Infinity): BotRun[] {
  const runs: BotRun[] = [];
  let state = start;
  for (let tries = 0; tries < 12; tries++) {
    const run = playCommission(state, buildMap(provinceOf(state)));
    runs.push(run);
    if (run.state.over === 'lost') {
      if (runs.filter((r) => r.state.campaign.chapter === run.state.campaign.chapter).length > 1) break;
      state = apply(run.state, { type: 'retry' })!.state;
      continue;
    }
    if (!hasNextCommission(run.state) || run.state.campaign.chapter >= lastChapter) break;
    let next = apply(run.state, { type: 'court' })!.state;
    while (next.hero.offers.length > 0) next = learn(next, next.hero.offers[0].options[0])!.state;
    next = apply(next, { type: 'boon', id: pickBoon(next) })!.state;
    state = apply(next, { type: 'nextCommission' })!.state;
  }
  return runs;
}
