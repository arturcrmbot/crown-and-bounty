import { SPELLS } from '../../content/spells';
import { troopPower, TROOPS } from '../../content/troops';
import {
  activeFighter, battleAct, boltDamage, canCast, fighterById, isRanged, options, strike, wound,
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

/**
 * A plain but sensible commander: bolt the biggest threat, shoot when it can, otherwise take the
 * trade that kills the most worth for the least retaliation, and walk towards the best target
 * when nothing is in reach. It plays both sides in auto-resolve.
 */
export function chooseAction(b: BattleState): BattleAction {
  const f = activeFighter(b)!;
  const foes = b.fighters.filter((o) => o.count > 0 && o.side !== f.side);

  if (f.side === 'player' && canCast(b, 'bolt')) {
    const target = foes.reduce((best, o) => (worthOf(o, boltDamage(b)) > worthOf(best, boltDamage(b)) ? o : best));
    if (worthOf(target, boltDamage(b)) > troopPower(target.troop) * 0.5) return { type: 'cast', spell: 'bolt', target: target.id };
  }
  if (f.side === 'player' && canCast(b, 'slow')) {
    const fast = foes.filter((o) => !o.slowed && TROOPS[o.troop].speed >= 6).sort((x, y) => threat(y) - threat(x))[0];
    if (fast && b.hero.mana >= SPELLS.slow.mana + SPELLS.bolt.mana) return { type: 'cast', spell: 'slow', target: fast.id };
  }

  const opts = options(b);
  if (opts.shoot.length > 0) {
    const target = opts.shoot.map((id) => fighterById(b, id)).reduce((best, o) => (worthOf(o, strike(b, f, o, true).damage) > worthOf(best, strike(b, f, best, true).damage) ? o : best));
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

  // Archers out of arrows, or blocked, still fight; everyone else closes in on the juiciest target.
  if (best && isRanged(f)) return best.action;
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
