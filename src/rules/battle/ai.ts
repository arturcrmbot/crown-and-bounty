import { troopPower, TROOPS } from '../../content/troops';
import {
  activeFighter, battleAct, boltDamage, canCast, fighterById, isRanged, options, spellCost, strike, wound,
  type BattleAction, type BattleState, type Fighter,
} from './battle';
import { distance } from './hex';

/** Fighting worth that `damage` would take out of a stack. */
function worthOf(target: Fighter, damage: number): number {
  const w = wound(target, damage);
  const partial = (target.hp - (w.count === target.count ? w.hp : 0)) / TROOPS[target.troop].hp;
  return (w.killed + Math.max(0, partial) * 0.3) * troopPower(target.troop);
}

/** How dangerous a stack is right now: its worth, with archers counted extra. */
const threat = (f: Fighter) => f.count * troopPower(f.troop) * (isRanged(f) ? 1.3 : 1);

/** Worth killed, with the enemy's own shooters counted extra: every archer down is fewer arrows back. */
const payoff = (target: Fighter, damage: number) => worthOf(target, damage) * (isRanged(target) ? 1.5 : 1);

/** What a side's shooters with arrows left are worth. */
function firepower(b: BattleState, side: Fighter['side']): number {
  return b.fighters.filter((o) => o.side === side && o.count > 0 && isRanged(o)).reduce((sum, o) => sum + threat(o), 0);
}

/** Where a melee stack should stand to shield our best shooter: next to it, on the enemy's side. Null if it's there already. */
function guardPost(b: BattleState, f: Fighter, moves: ReadonlyMap<number, unknown>): number | null {
  const shooters = b.fighters.filter((o) => o.side === f.side && o.count > 0 && isRanged(o));
  const foes = b.fighters.filter((o) => o.side !== f.side && o.count > 0);
  if (shooters.length === 0 || foes.length === 0) return null;
  const ward = shooters.reduce((x, y) => (threat(y) > threat(x) ? y : x));
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
export function chooseAction(b: BattleState): BattleAction {
  const f = activeFighter(b)!;
  const foes = b.fighters.filter((o) => o.count > 0 && o.side !== f.side);

  if (f.side === 'player' && canCast(b, 'bolt')) {
    const target = foes.reduce((best, o) => (payoff(o, boltDamage(b)) > payoff(best, boltDamage(b)) ? o : best));
    if (worthOf(target, boltDamage(b)) > troopPower(target.troop) * 0.5) return { type: 'cast', spell: 'bolt', target: target.id };
  }
  if (f.side === 'player' && canCast(b, 'slow')) {
    const fast = foes.filter((o) => !o.slowed && TROOPS[o.troop].speed >= 6).sort((x, y) => threat(y) - threat(x))[0];
    if (fast && (!b.hero.spells.includes('bolt') || b.hero.mana >= spellCost(b, 'slow') + spellCost(b, 'bolt'))) return { type: 'cast', spell: 'slow', target: fast.id };
  }
  if (f.side === 'player' && canCast(b, 'bless') && !b.hero.spells.includes('bolt')) {
    const strongest = b.fighters.filter((o) => o.count > 0 && o.side === 'player' && !o.blessed).sort((x, y) => threat(y) - threat(x))[0];
    if (strongest) return { type: 'cast', spell: 'bless', target: strongest.id };
  }
  if (f.side === 'player' && canCast(b, 'haste') && !f.hasted && !isRanged(f)) return { type: 'cast', spell: 'haste', target: f.id };

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
  const goal = foes.reduce((pick, o) => (threat(o) / (distance(f.at, o.at) + 1) > threat(pick) / (distance(f.at, pick.at) + 1) ? o : pick));
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

/** Lets both commanders play it out. Stalemates end after 40 rounds with the attacker falling back. */
export function autoResolve(b: BattleState): BattleState {
  let battle = b;
  for (let guard = 0; guard < 4000 && !battle.result; guard++) {
    if (battle.round > 40) return { ...battle, result: 'fled' };
    const { battle: next, events } = battleAct(battle, chooseAction(battle));
    if (events.length === 0) return { ...battle, result: 'fled' };
    battle = next;
  }
  return battle;
}
