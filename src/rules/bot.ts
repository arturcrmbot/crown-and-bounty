import type { BackgroundId } from '../content/backgrounds';
import { leads } from '../content/troops';
import { apply, armyPower, choose, endDay, fight, hasNextCommission, learn, locationById, PLACE_KINDS, provinceOf, visit, winChance, type Army, type BoonId, type GameState, type Location } from './game';
import { buildMap, type MapModel } from './map/model';
import { planRoute, routeCosts, stepAlong } from './map/movement';
import { riddenOut } from './map/sortie';
import { hireOffer, tameOffer, worthAFight } from './places/enemy';

export type BotRun = { won: boolean; day: number; gold: number; power: number; fights: number; retreats: number; level: number; log: string[]; start: GameState; state: GameState };

/**
 * A careful player (`docs/BALANCE.md`): ride to whatever is worth most per movement point, take
 * leadership from chests when short of it, recruit whatever it can, fight only with a margin so it keeps
 * its army, learn the skills that multiply, and end the day when tired or when there's nothing to do.
 * It uses exactly the rules the screens use.
 */
/**
 * Limits for a bot run: which places it may go for, and when to stop (for balance checkpoints). A
 * `reckless` bot fights as the old bot did, as soon as the sergeants like the odds, and takes the first
 * thing offered at a level-up (to measure against, in `npm run sim:curve -- --bot`).
 */
export type BotLimits = { allow?: (place: Location) => boolean; stop?: (state: GameState) => boolean; reckless?: boolean };

/** A careful player fights only when he'd still win three times in four against half as many again. */
export const MARGIN = 1.5;
const scaled = (army: Army, k: number) => army.map((s) => (leads(s.troop) ? s : { ...s, count: Math.round(s.count * k) }));

/**
 * Whether a careful player would fight this enemy now: with a margin, so he keeps his army. The villain
 * he storms once he likes the odds, or, as the weeks go by and the villain recruits, sooner: losing at
 * his walls costs the army, not the commission.
 */
export function comfortable(state: GameState, place: Location): boolean {
  const foe = place.enemy;
  if (!foe || place.done || riddenOut(state, place) || !state.army.length) return false;
  if (place.kind === 'hideout') {
    const odds = winChance(state, place.id, 8);
    return odds >= (state.day > 56 ? 0.25 : state.day > 42 ? 0.4 : state.day > 28 ? 0.6 : 0.8);
  }
  return winChance(state, place.id, 8, scaled(foe.army, MARGIN)) >= 0.75;
}

/** The skills a careful player takes at a level-up, the best first: the ones that multiply his army. */
const PICKS: Record<BackgroundId, string[]> = {
  knight: ['skill:offence', 'skill:leadership', 'skill:armourer', 'skill:archery', 'perk:fortunesFavour'],
  wizard: ['skill:sorcery', 'skill:mysticism', 'skill:leadership', 'skill:archery', 'skill:armourer'],
  ranger: ['skill:archery', 'skill:leadership', 'skill:offence', 'skill:armourer', 'perk:fortunesFavour'],
  courtier: ['skill:leadership', 'skill:diplomacy', 'skill:archery', 'skill:offence', 'skill:estates'],
};

/** The option a bot takes at a level-up: the best of its picks, or for a reckless one, the first offered. */
function pickFor(state: GameState, careful: boolean): string {
  const options = state.hero.offers[0].options;
  return (careful && PICKS[state.hero.background].find((p) => options.includes(p))) || options[0];
}

export function playCommission(start: GameState, map: MapModel, maxSteps = 20000, limits: BotLimits = {}): BotRun {
  let state = start;
  const log: string[] = [];
  let fights = 0;
  let retreats = 0;
  const careful = !limits.reckless;
  const learnAll = () => {
    while (state.hero.offers.length > 0) state = learn(state, pickFor(state, careful))!.state;
  };
  /** Whether it would fight this enemy now: with a margin, or for a reckless bot, when the sergeants like the odds. */
  const fightable = (l: Location) => (careful ? comfortable(state, l) : worthAFight(state, l));
  /** What an enemy is worth the ride: a fight it would win comfortably, or a pack that would follow it. */
  const carefulWorth = (l: Location): number | null => {
    if (l.done) return null;
    if (comfortable(state, l)) return l.kind === 'hideout' ? 5000 : l.enemy!.reward + 200;
    const offer = tameOffer(state, l, 8);
    return l.kind === 'patrol' && offer?.whole && offer.respected && offer.joining.length ? l.enemy!.reward + 200 : null;
  };
  /** The night passes; if something falls on the camp at dawn, the sergeants fight it, or the army runs if they'd lose. */
  const nextDay = () => {
    state = endDay(state).state;
    if (state.ambush) {
      fights++;
      const id = state.ambush;
      const odds = winChance(state, id, 8);
      state = choose(state, id, odds >= 0.5 ? 'auto' : 'flee')?.state ?? { ...state, ambush: undefined };
      if (!locationById(state, id).done) retreats++;
      log.push(`day ${state.day}: ambushed by ${locationById(state, id).name}${odds >= 0.5 ? '' : ', ran'}`);
    }
    if (careful) learnAll();
  };
  /** A hunter on the trail that would beat us, if any: then the day ends behind a town's walls. */
  const hunted = () => state.locations.find((l) => l.enemy?.trailing && !l.done && winChance(state, l.id, 8) < 0.6);
  /** Enemies it rode up to today and left alone: not again until tomorrow. */
  let passed = { day: state.day, ids: new Set<string>() };
  for (let guard = 0; guard < 400 && !state.over && !limits.stop?.(state); guard++) {
    let best: { id: string; route: number[]; score: number } | null = null;
    const shelter = hunted() ? state.locations.filter((l) => l.kind === 'castle' || l.kind === 'village') : [];
    for (const l of shelter) {
      const route = planRoute(state, map, l.at);
      if (!route) continue;
      const score = -(route.length ? routeCosts(state, map, route).at(-1)! : 0);
      if (!best || score > best.score) best = { id: l.id, route, score };
    }
    if (passed.day !== state.day) passed = { day: state.day, ids: new Set() };
    for (const l of best ? [] : state.locations) {
      if (limits.allow && !limits.allow(l)) continue;
      if (passed.ids.has(l.id)) continue;
      const value = careful && l.enemy ? carefulWorth(l) : PLACE_KINDS[l.kind].worth(state, l);
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
    let route: number[] | null = best.route;
    const goal = locationById(state, best.id);
    for (let steps = 0; route && route.length > 0 && steps < maxSteps && !state.over; steps++) {
      const step = stepAlong(state, map, route);
      if (step) {
        state = step.state;
        route = route.slice(1);
      } else {
        nextDay();
        // Stacks move at night: find the way again (to where the enemy stands now, if it's one).
        route = planRoute(state, map, locationById(state, best.id).at, Boolean(goal.enemy));
      }
    }
    if (!route || state.over) continue;
    const place = locationById(state, best.id);
    state = visit(state, best.id).state;
    // A courtier (or anyone with the signet) buys small bands outright when the purse allows.
    const offer = place.enemy && !place.done ? hireOffer(state, place) : null;
    if (offer && offer.all && state.gold >= offer.price + 300) {
      state = choose(state, place.id, 'hire')?.state ?? state;
      log.push(`day ${state.day}: hired ${place.name}`);
      continue;
    }
    // A ranger (or anyone with a way with beasts) takes a pack that would follow him, when they'd all come or a fight would be a gamble.
    const pack = place.enemy && !place.done ? tameOffer(state, place) : null;
    const tamed = pack?.whole && pack.respected && pack.joining.length && (careful || pack.all || !fightable(place)) ? choose(state, place.id, 'tame') : null;
    if (tamed) {
      state = tamed.state;
      log.push(`day ${state.day}: tamed ${place.name}`);
      continue;
    }
    // Days on the road: a villain may have recruited, or a pack not come to heel. Fight only if it's worth a fight now.
    if (place.enemy && !place.done && !fightable(locationById(state, place.id))) {
      log.push(`day ${state.day}: ${place.name} (not today)`);
      passed.ids.add(place.id);
      continue;
    }
    if (place.enemy && !place.done) {
      fights++;
      const before = locationById(state, place.id).done;
      state = fight(state, place.id)?.state ?? state;
      if (locationById(state, place.id).done === before) retreats++;
    } else {
      state = PLACE_KINDS[place.kind].bot?.(state, locationById(state, place.id)) ?? state;
    }
    learnAll();
    log.push(`day ${state.day}: ${place.name}${shelter.length ? ' (sheltering)' : ''}`);
    // Sheltering: stay behind the walls until morning.
    if (shelter.length) nextDay();
  }
  return { won: state.over === 'won', day: state.day, gold: state.gold, power: armyPower(state.army), fights, retreats, level: state.hero.level, log, start, state };
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
export function* playCampaignStarts(start: GameState, lastChapter = Infinity): Generator<GameState, BotRun[]> {
  const runs: BotRun[] = [];
  let state = start;
  for (let tries = 0; tries < 12; tries++) {
    yield state;
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

export function playCampaign(start: GameState, lastChapter = Infinity): BotRun[] {
  const journey = playCampaignStarts(start, lastChapter);
  let step = journey.next();
  while (!step.done) step = journey.next();
  return step.value;
}
