import { troopPower, TROOPS } from '../../content/troops';
import { SPELLS, STATUSES } from '../../content/spells';
import {
  activeFighter, battleAct, canCast, fighterById, hasStatus, isRanged, options, spellCost, spellDamage, speedOf, statsOf, strike, wound,
  type BattleAction, type BattleState, type Fighter, type Side,
} from './battle';
import { distance, HEXES, NEIGHBOURS, reachMask } from './hex';

/** Fighting worth that `damage` would take out of a stack. */
function worthOf(target: Fighter, damage: number): number {
  const w = wound(target, damage);
  const partial = (target.hp - (w.count === target.count ? w.hp : 0)) / TROOPS[target.troop].hp;
  return (w.killed + Math.max(0, partial) * 0.3) * troopPower(target.troop);
}

/** How dangerous a stack is right now: its worth, with archers counted extra. */
const threatV1 = (f: Fighter) => f.count * troopPower(f.troop) * (isRanged(f) ? 1.3 : 1);

/** Worth killed, with the enemy's own shooters counted extra: every archer down is fewer arrows back. */
const payoff = (target: Fighter, damage: number) => worthOf(target, damage) * (isRanged(target) ? 1.5 : 1);

/** What a side's shooters with arrows left are worth. */
function firepower(b: BattleState, side: Fighter['side']): number {
  return b.fighters.filter((o) => o.side === side && o.count > 0 && isRanged(o)).reduce((sum, o) => sum + threatV1(o), 0);
}

/** Where a melee stack should stand to shield our best shooter: next to it, on the enemy's side. Null if it's there already. */
function guardPost(b: BattleState, f: Fighter, moves: ReadonlyMap<number, unknown>): number | null {
  const shooters = b.fighters.filter((o) => o.side === f.side && o.count > 0 && isRanged(o));
  const foes = b.fighters.filter((o) => o.side !== f.side && o.count > 0);
  if (shooters.length === 0 || foes.length === 0) return null;
  const ward = shooters.reduce((x, y) => (threatV1(y) > threatV1(x) ? y : x));
  const nearestFoe = (hex: number) => Math.min(...foes.map((o) => distance(hex, o.at)));
  const score = (hex: number) => (distance(hex, ward.at) <= 1 ? 0 : distance(hex, ward.at) * 10) + nearestFoe(hex);
  let bestHex = f.at;
  for (const [hex] of moves) if (score(hex) < score(bestHex)) bestHex = hex;
  return bestHex === f.at ? null : bestHex;
}

/**
 * A plain but sensible commander: bolt the biggest threat, shoot when it can, otherwise take the
 * trade that kills the most worth for the least retaliation, and walk towards the best target
 * when nothing is in reach. It plays both sides in auto-resolve.
 */
export function chooseActionV1(b: BattleState): BattleAction {
  if (b.volley) return { type: 'volley' };
  const f = activeFighter(b)!;
  const foes = b.fighters.filter((o) => o.count > 0 && o.side !== f.side);
  if (foes.length === 0) return { type: 'defend' };

  if (f.side === 'player' && canCast(b, 'bolt')) {
    const bolt = spellDamage(b, 'bolt');
    const target = foes.reduce((best, o) => (payoff(o, bolt) > payoff(best, bolt) ? o : best));
    if (worthOf(target, bolt) > troopPower(target.troop) * 0.5) return { type: 'cast', spell: 'bolt', target: target.id };
  }
  if (f.side === 'player' && canCast(b, 'slow')) {
    const fast = foes.filter((o) => !hasStatus(o, 'slowed') && TROOPS[o.troop].speed >= 6).sort((x, y) => threatV1(y) - threatV1(x))[0];
    if (fast && (!b.hero.spells.includes('bolt') || b.hero.mana >= spellCost(b, 'slow') + spellCost(b, 'bolt'))) return { type: 'cast', spell: 'slow', target: fast.id };
  }
  if (f.side === 'player' && canCast(b, 'bless') && !b.hero.spells.includes('bolt')) {
    const strongest = b.fighters.filter((o) => o.count > 0 && o.side === 'player' && !hasStatus(o, 'blessed')).sort((x, y) => threatV1(y) - threatV1(x))[0];
    if (strongest) return { type: 'cast', spell: 'bless', target: strongest.id };
  }
  if (f.side === 'player' && canCast(b, 'haste') && !hasStatus(f, 'hasted') && !isRanged(f)) return { type: 'cast', spell: 'haste', target: f.id };

  const opts = options(b);
  if (opts.shoot.length > 0) {
    const target = opts.shoot.map((id) => fighterById(b, id)).reduce((best, o) => (payoff(o, strike(b, f, o, true).damage) > payoff(best, strike(b, f, best, true).damage) ? o : best));
    return { type: 'shoot', target: target.id };
  }

  let best: { action: BattleAction; score: number } | null = null;
  for (const m of opts.melee) {
    const target = fighterById(b, m.target);
    const moved = { ...f, at: m.from };
    const damage = strike(b, moved, target, false).damage;
    const gain = worthOf(target, damage) * (isRanged(target) ? 1.25 : 1);
    const left = wound(target, damage);
    let loss = 0;
    if (left.count > 0 && !target.retaliated) loss = worthOf(f, strike(b, { ...target, count: left.count, hp: left.hp }, moved, false).damage);
    const score = gain - loss * 0.6 - (m.from === f.at ? 0 : 0.01);
    if (!best || score > best.score) best = { action: { type: 'melee', target: m.target, from: m.from }, score };
  }
  if (best && best.score > 0) return best.action;

  // Archers out of arrows, or blocked, still fight.
  if (best && isRanged(f)) return best.action;

  // Out-shooting them? Hold the line by our archers and let them walk into the arrows.
  if (!isRanged(f) && firepower(b, f.side) > firepower(b, f.side === 'player' ? 'enemy' : 'player') * 1.2) {
    const guard = guardPost(b, f, opts.moves);
    return guard === null ? { type: 'defend' } : { type: 'move', to: guard };
  }

  // Everyone else closes in on the juiciest target.
  const goal = foes.reduce((pick, o) => (threatV1(o) / (distance(f.at, o.at) + 1) > threatV1(pick) / (distance(f.at, pick.at) + 1) ? o : pick));
  let move: number | null = null;
  let closest = distance(f.at, goal.at);
  for (const [hex] of opts.moves) {
    const d = distance(hex, goal.at);
    if (d < closest) {
      closest = d;
      move = hex;
    }
  }
  if (move !== null) return { type: 'move', to: move };
  return best ? best.action : { type: 'defend' };
}

export type Chooser = (b: BattleState) => BattleAction;

/** Lets both commanders play it out. Stalemates end after 40 rounds with the attacker falling back. */
export function autoResolve(b: BattleState, choose: Chooser = chooseAction): BattleState {
  let battle = b;
  for (let guard = 0; guard < 4000 && !battle.result; guard++) {
    if (battle.round > 40) return { ...battle, result: 'fled' };
    const { battle: next, events } = battleAct(battle, choose(battle));
    if (events.length === 0) return { ...battle, result: 'fled' };
    battle = next;
  }
  return battle;
}

// --- The commander (v2) -------------------------------------------------------------------------
//
// It tries every action it could take with the real rules (average damage, no dice), and scores
// what's left: the worth of its stacks against theirs, less what the enemy could take back next
// turn, plus what it could take itself. So it finishes off wounded stacks, keeps its shooters out
// of reach, blocks the way to them, charges shooters it can't out-shoot, and casts whatever spell
// is worth most, without knowing any spell or troop by name.

/** How much the enemy's next strikes count against us, and ours for us; blows a turn further off count less. */
const THEIR_THREAT = 0.7;
const OUR_THREAT = 0.3;
const THEIR_LATER = 0.3;
const OUR_LATER = 0.12;

/** What one troop of a stack is worth as it stands: health times damage, with skill, bless, speed and shots. */
function troopWorth(b: BattleState, f: Fighter): number {
  const t = TROOPS[f.troop];
  const { attack, defence } = statsOf(b, f);
  const [min, max] = t.damage;
  const damage = f.status.some((s) => STATUSES[s].bestDamage) ? max : (min + max) / 2;
  const player = f.side === 'player';
  const skill = player ? 1 + Math.max(b.hero.melee ?? 0, f.shots > 0 ? (b.hero.ranged ?? 0) : 0) : 1;
  const armour = player ? 1 / (1 - (b.hero.armour ?? 0)) : 1;
  // Shooters are worth more by kind, not by arrows left: spending an arrow is judged by what it hits.
  return Math.sqrt(t.hp * armour * damage * skill) * (1 + (attack + defence) / 20) * (t.shots ? 1.35 : 1) * (0.8 + 0.05 * speedOf(f));
}

function stackWorth(b: BattleState, f: Fighter): number {
  if (f.count <= 0) return 0;
  const hp = TROOPS[f.troop].hp;
  return (troopWorth(b, f) * ((f.count - 1) * hp + f.hp)) / hp;
}

/** Worth a stack loses to `damage`. */
function loss(b: BattleState, f: Fighter, damage: number): number {
  const w = wound(f, damage);
  return stackWorth(b, f) - stackWorth(b, { ...f, count: w.count, hp: w.hp });
}

/** Hexes taken by rocks and living stacks. */
function blockedMask(b: BattleState): Uint8Array {
  const mask = new Uint8Array(HEXES);
  for (const i of b.obstacles) mask[i] = 1;
  for (const f of b.fighters) if (f.count > 0) mask[f.at] = 1;
  return mask;
}

/**
 * What `side` could take from the other with each stack's best strike: a shot, or a blow from a hex
 * it can reach, less what the target strikes back. `now` is this coming turn; `later` counts blows
 * only reachable the turn after, so stacks see an attack coming and screen their shooters. Blows on
 * one target add up, but never past what that target is worth.
 */
function threat(b: BattleState, side: Side, mask: Uint8Array): { now: number; later: number } {
  const foes = b.fighters.filter((o) => o.count > 0 && o.side !== side);
  const now = new Map<number, number>();
  const later = new Map<number, number>();
  const add = (map: Map<number, number>, id: number, worth: number) => map.set(id, (map.get(id) ?? 0) + worth);
  for (const f of b.fighters) {
    if (f.count <= 0 || f.side !== side) continue;
    const pinned = foes.some((o) => NEIGHBOURS[f.at].includes(o.at));
    if (f.shots > 0 && !pinned) {
      let best = 0;
      let target = -1;
      for (const o of foes) {
        const gain = loss(b, o, strike(b, f, o, true).damage);
        if (gain > best) [best, target] = [gain, o.id];
      }
      if (target >= 0) add(now, target, best);
      continue;
    }
    const speed = speedOf(f);
    const reach = reachMask(f.at, speed, mask);
    const farther = reachMask(f.at, speed * 2, mask);
    let best = 0;
    let target = -1;
    let bestLater = 0;
    let targetLater = -1;
    for (const o of foes) {
      const soon = NEIGHBOURS[o.at].some((n) => reach[n]);
      if (!soon && !NEIGHBOURS[o.at].some((n) => farther[n])) continue;
      const damage = strike(b, f, o, false).damage;
      const w = wound(o, damage);
      let gain = stackWorth(b, o) - stackWorth(b, { ...o, count: w.count, hp: w.hp });
      if (w.count > 0 && !o.retaliated) gain -= loss(b, f, strike(b, { ...o, count: w.count, hp: w.hp }, f, false).damage);
      if (soon && gain > best) [best, target] = [gain, o.id];
      else if (!soon && gain > bestLater) [bestLater, targetLater] = [gain, o.id];
    }
    if (target >= 0) add(now, target, best);
    else if (targetLater >= 0) add(later, targetLater, bestLater);
  }
  const total = (map: Map<number, number>) => [...map].reduce((sum, [id, worth]) => sum + Math.min(worth, stackWorth(b, fighterById(b, id))), 0);
  return { now: total(now), later: total(later) };
}

/** Shooting worth with arrows left: whoever has less of it can't win by waiting. */
const firepowerOf = (b: BattleState, side: Side) => b.fighters.filter((f) => f.count > 0 && f.side === side && f.shots > 0).reduce((sum, f) => sum + stackWorth(b, f), 0);

/** How good the battle looks for `side`. */
export function evaluate(b: BattleState, side: Side): number {
  const mine = b.fighters.filter((f) => f.count > 0 && f.side === side).reduce((sum, f) => sum + stackWorth(b, f), 0);
  const theirs = b.fighters.filter((f) => f.count > 0 && f.side !== side).reduce((sum, f) => sum + stackWorth(b, f), 0);
  if (b.result === 'won' || b.result === 'lost') return (b.result === 'won') === (side === 'player') ? 1e5 + mine : -1e5 - theirs;
  const other: Side = side === 'player' ? 'enemy' : 'player';
  const mask = blockedMask(b);
  const theirs2 = threat(b, other, mask);
  const ours = threat(b, side, mask);
  let score = mine - theirs - THEIR_THREAT * theirs2.now - THEIR_LATER * theirs2.later + OUR_THREAT * ours.now + OUR_LATER * ours.later;
  // Out-shot, waiting only loses: close in on their stacks. And the longer a battle drags on, the
  // more both sides want to get it over with, so nobody dances round a troll for forty rounds.
  const pressure = (firepowerOf(b, other) > firepowerOf(b, side) * 1.1 ? 1 : 0) + Math.max(0, (b.round - 6) / 6);
  if (pressure > 0) {
    const targets = b.fighters.filter((f) => f.count > 0 && f.side === other);
    for (const f of b.fighters) {
      if (f.count <= 0 || f.side !== side || (f.shots > 0 && !targets.some((o) => NEIGHBOURS[f.at].includes(o.at)))) continue;
      const nearest = Math.min(...targets.map((o) => distance(f.at, o.at)));
      score -= 0.03 * pressure * stackWorth(b, f) * Math.max(0, nearest - 1) / Math.max(1, speedOf(f));
    }
  }
  return score;
}

/** Every action the acting stack could take (the hero's spells come separately). */
function stackActions(b: BattleState): BattleAction[] {
  const opts = options(b);
  return [
    ...opts.shoot.map((target): BattleAction => ({ type: 'shoot', target })),
    ...opts.melee.map((m): BattleAction => ({ type: 'melee', target: m.target, from: m.from })),
    ...[...opts.moves.keys()].map((to): BattleAction => ({ type: 'move', to })),
    { type: 'defend' },
  ];
}

/** Every spell the hero could cast now, on every stack it could be cast on. */
function castActions(b: BattleState): BattleAction[] {
  const actions: BattleAction[] = [];
  for (const spell of b.hero.spells) {
    if (!canCast(b, spell)) continue;
    const on = SPELLS[spell].on;
    for (const f of b.fighters) if (f.count > 0 && (f.side === 'enemy') === (on === 'enemy')) actions.push({ type: 'cast', spell, target: f.id });
  }
  return actions;
}

/** The action that leaves the battle looking best for the side whose turn it is (by `judge`, if given). */
function best(b: BattleState, actions: BattleAction[], side: Side, judge?: (after: BattleState) => number): { action: BattleAction; score: number } | null {
  let top: { action: BattleAction; score: number } | null = null;
  for (const action of actions) {
    const { battle, events } = battleAct(b, action, true);
    if (events.length === 0) continue;
    const score = judge ? judge(battle) : evaluate(battle, side);
    if (!top || score > top.score) top = { action, score };
  }
  return top;
}

/**
 * What the side whose turn it is does. The enemy always attacks: you chose to fight, so they fight
 * (see `onslaught`). Your own stacks, on auto, are played by the commander, who may hold back.
 */
export function chooseAction(b: BattleState): BattleAction {
  // The ranger's free volley comes before anything else.
  if (b.volley) return { type: 'volley' };
  return activeFighter(b)!.side === 'enemy' ? onslaught(b) : commander(b);
}

/** The careful commander: casts what's worth casting, then takes whatever leaves the battle looking best. */
export function commander(b: BattleState): BattleAction {
  if (b.volley) return { type: 'volley' };
  const f = activeFighter(b)!;
  if (!b.fighters.some((o) => o.count > 0 && o.side !== f.side)) return { type: 'defend' };
  // A spell first, if one is worth more than not casting (the stack still acts after it).
  if (f.side === 'player') {
    const cast = best(b, castActions(b), 'player');
    if (cast && cast.score > evaluate(b, 'player') + 1) return cast.action;
  }
  return best(b, stackActions(b), f.side)?.action ?? { type: 'defend' };
}

/**
 * The enemy's way: never wait, never turtle, never back off. A stack shoots or strikes the best
 * target it can, and if nobody is in reach it closes in on the nearest of yours, round the rocks.
 */
export function onslaught(b: BattleState): BattleAction {
  const f = activeFighter(b)!;
  const acts = stackActions(b);
  const attack = best(b, acts.filter((a) => a.type === 'melee' || a.type === 'shoot'), f.side);
  if (attack) return attack.action;
  const steps = stepsToFoes(b, f);
  const moves = acts.filter((a): a is Extract<BattleAction, { type: 'move' }> => a.type === 'move');
  if (!moves.length) return { type: 'defend' };
  // How far from striking distance each move leaves the stack; hexes cut off from everyone count by straight distance.
  const gap = (to: number) => (steps[to] >= 0 ? steps[to] : HEXES + Math.min(...b.fighters.filter((o) => o.count > 0 && o.side !== f.side).map((o) => distance(to, o.at))));
  const nearest = Math.min(...moves.map((m) => gap(m.to)));
  return best(b, moves.filter((m) => gap(m.to) === nearest), f.side)!.action;
}

/** Steps from every hex to the nearest hex beside one of `f`'s foes, going round rocks and stacks (-1: no way). */
function stepsToFoes(b: BattleState, f: Fighter): Int16Array {
  const mask = blockedMask(b);
  mask[f.at] = 0;
  const steps = new Int16Array(HEXES).fill(-1);
  const queue: number[] = [];
  for (const o of b.fighters) {
    if (o.count <= 0 || o.side === f.side) continue;
    for (const n of NEIGHBOURS[o.at]) {
      if (mask[n] || steps[n] >= 0) continue;
      steps[n] = 0;
      queue.push(n);
    }
  }
  for (let k = 0; k < queue.length; k++) {
    for (const n of NEIGHBOURS[queue[k]]) {
      if (mask[n] || steps[n] >= 0) continue;
      steps[n] = steps[queue[k]] + 1;
      queue.push(n);
    }
  }
  return steps;
}
