import { abilitiesOf, type TroopId } from '../../content/troops';
import { needsTarget, SPELLS, STATUSES } from '../../content/spells';
import {
  activeFighter, battleAct, canCast, casterSide, castersOf, CHARGE_BONUS, CHARGE_HEXES, fighterById, hasTurn, isLeader, luckOf, moraleOf, onField, rideFrom, ridesOut, spellsOf, hasStatus, isRanged, options, powerOf, spellCost, spellDamage, speedOf, statsOf, stepsTo, strike, unitOf, wound,
  type BattleAction, type BattleState, type Fighter, type Options, type Side,
} from './battle';
import { distance, HEXES, NEIGHBOURS, reachMask } from './hex';

/** Fighting worth that `damage` would take out of a stack. */
function worthOf(target: Fighter, damage: number): number {
  const w = wound(target, damage);
  const partial = (target.hp - (w.count === target.count ? w.hp : 0)) / unitOf(target).hp;
  return (w.killed + Math.max(0, partial) * 0.3) * powerOf(target);
}

/** How dangerous a stack is right now: its worth, with archers counted extra. */
const threatV1 = (f: Fighter) => f.count * powerOf(f) * (isRanged(f) ? 1.3 : 1);

/** Worth killed, with the enemy's own shooters counted extra: every archer down is fewer arrows back. */
const payoff = (target: Fighter, damage: number) => worthOf(target, damage) * (isRanged(target) ? 1.5 : 1);

/** What a side's shooters with arrows left are worth. */
function firepower(b: BattleState, side: Fighter['side']): number {
  return b.fighters.filter((o) => o.side === side && o.count > 0 && isRanged(o)).reduce((sum, o) => sum + threatV1(o), 0);
}

/** Where a melee stack should stand to shield our best shooter: next to it, on the enemy's side. Null if it's there already. */
function guardPost(b: BattleState, f: Fighter, moves: ReadonlyMap<number, unknown>): number | null {
  const shooters = b.fighters.filter((o) => o.side === f.side && onField(o) && isRanged(o));
  const foes = b.fighters.filter((o) => o.side !== f.side && onField(o));
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
  const foes = b.fighters.filter((o) => onField(o) && o.side !== f.side);
  if (foes.length === 0) return { type: 'defend' };

  if (f.side === 'player' && canCast(b, 'bolt')) {
    const bolt = spellDamage(b, 'bolt');
    const target = foes.reduce((best, o) => (payoff(o, bolt) > payoff(best, bolt) ? o : best));
    if (worthOf(target, bolt) > powerOf(target) * 0.5) return { type: 'cast', spell: 'bolt', target: target.id };
  }
  if (f.side === 'player' && canCast(b, 'slow')) {
    const fast = foes.filter((o) => !hasStatus(o, 'slowed') && unitOf(o).speed >= 6).sort((x, y) => threatV1(y) - threatV1(x))[0];
    if (fast && (!b.hero.spells.includes('bolt') || b.hero.mana >= spellCost(b, 'slow') + spellCost(b, 'bolt'))) return { type: 'cast', spell: 'slow', target: fast.id };
  }
  if (f.side === 'player' && canCast(b, 'bless') && !b.hero.spells.includes('bolt')) {
    const strongest = b.fighters.filter((o) => o.count > 0 && o.side === 'player' && !hasStatus(o, 'blessed')).sort((x, y) => threatV1(y) - threatV1(x))[0];
    if (strongest) return { type: 'cast', spell: 'bless', target: strongest.id };
  }
  if (f.side === 'player' && canCast(b, 'haste') && !hasStatus(f, 'hasted') && !isRanged(f) && onField(f)) return { type: 'cast', spell: 'haste', target: f.id };

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
    if (left.count > 0 && !target.retaliated && !isLeader(f)) loss = worthOf(f, strike(b, { ...target, count: left.count, hp: left.hp }, moved, false).damage);
    const score = gain - loss * 0.6 - (m.from === f.at ? 0 : 0.01);
    if (!best || score > best.score) best = { action: { type: 'melee', target: m.target, from: m.from }, score };
  }
  if (best && best.score > 0) return best.action;

  // Archers out of arrows, or blocked, still fight. A leader who can't strike now waits for his next turn.
  if (best && isRanged(f)) return best.action;
  if (isLeader(f)) return best ? best.action : { type: 'defend' };

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

export type FinishEstimate = {
  wins: number;
  samples: number;
  losses: { troop: TroopId; count: number }[];
};

const finishSeed = (seed: number, sample: number) => (Math.imul(seed + sample, 0x9e3779b1) ^ 0x85ebca6b) >>> 0;

/** A cautious estimate for finishing a decided battle with the sergeants. */
export function finishEstimate(b: BattleState, samples = 10): FinishEstimate | null {
  if (b.result || b.fighters.some((f) => f.side === 'enemy' && f.count > 0 && isRanged(f))) return null;

  let wins = 0;
  const lostByTroop = new Map<TroopId, number>();
  for (let i = 0; i < samples; i++) {
    const end = autoResolve({ ...b, seed: finishSeed(b.seed, i) });
    if (end.result !== 'won') continue;
    wins++;
    for (const before of b.fighters) {
      if (before.side !== 'player' || !onField(before)) continue;
      const after = fighterById(end, before.id);
      const lost = Math.max(0, before.count - after.count);
      if (lost > 0) lostByTroop.set(before.troop, (lostByTroop.get(before.troop) ?? 0) + lost);
    }
  }

  if (wins < Math.ceil(samples * 0.9)) return null;
  const losses = [...lostByTroop].map(([troop, total]) => ({ troop, count: Math.round(total / wins) })).filter((loss) => loss.count > 0);
  return { wins, samples, losses };
}

// --- The commander (v2) and the enemy ------------------------------------------------------------
//
// Both try every action they could take with the real rules (average damage, no dice), and score
// what's left: the worth of each side's stacks, less what the other side could take back next turn,
// plus what they could take themselves. So they finish off wounded stacks, gang up on a stack that
// has already struck back, go for shooters, keep their own shooters shooting, and know that a
// stack which regenerates shrugs off scratches, all without knowing any spell or troop by name. A
// leader behind the line (Aldric, a villain) can't be reached: nobody aims at him, and nobody counts
// on striking back at him. He's worth the spells he could still cast; a stack that charges is
// feared for the charge, and a leader who rides out for how far he can ride.
// Your sergeants (the commander) may hold back and let the enemy come; the enemy never does (see
// `onslaught`).

/**
 * How much each side's next strikes count. The careful commander weighs what it could lose; the
 * enemy picks its blows the same way, but closes in bravely, and heads for your shooters (`hunt`).
 */
type Weights = { theirNow: number; theirLater: number; ourNow: number; ourLater: number; patient: boolean; hunt?: number };
const CAREFUL: Weights = { theirNow: 0.7, theirLater: 0.3, ourNow: 0.3, ourLater: 0.12, patient: true };
const STRIKE: Weights = { ...CAREFUL, patient: false };
const BRAVE: Weights = { theirNow: 0.35, theirLater: 0.1, ourNow: 0.6, ourLater: 0.25, patient: false, hunt: 0.05 };

/** A stack still standing is worth this many of its troops more: its turn, its strike back, the hexes it holds. */
const PRESENCE = 0.5;
/** How much of what a stack's top troop will heal before it acts again counts as healed already. */
const HEALED = 0.5;

/** What one troop of a stack is worth as it stands: health times damage, with skill, bless, luck, morale, speed and shots. */
function troopWorth(b: BattleState, f: Fighter): number {
  const t = unitOf(f);
  const { attack, defence } = statsOf(b, f);
  const [min, max] = t.damage;
  const damage = f.status.some((s) => STATUSES[s].bestDamage) ? max : (min + max) / 2;
  const player = f.side === 'player';
  const skill = player ? 1 + Math.max(b.hero.melee ?? 0, f.shots > 0 ? (b.hero.ranged ?? 0) : 0) : 1;
  const armour = player ? 1 / (1 - (b.hero.armour ?? 0)) : 1;
  // Luck at its average, and morale as the share of a turn more (or less) the stack can expect each round.
  const spirits = (1 + luckOf(b, f)) * actions(b, f);
  // Shooters are worth more by kind, not by arrows left: spending an arrow is judged by what it hits.
  return Math.sqrt(t.hp * armour * damage * skill * spirits) * (1 + (attack + defence) / 20) * (t.shots ? 1.35 : 1) * (0.8 + 0.05 * speedOf(f));
}

/** The turns a stack can expect for every one it's due: one, and its morale's chance of another, or of losing it. */
const actions = (b: BattleState, f: Fighter) => Math.max(0, 1 + moraleOf(b, f));

/** Share of a troop's health its top troop heals at the start of each of its turns. */
const heals = new Map<Fighter['troop'], number>();
const healShare = (troop: Fighter['troop']) => {
  let share = heals.get(troop);
  if (share === undefined) heals.set(troop, (share = Math.max(0, ...abilitiesOf(troop).map((a) => a.healsTopOnTurn ?? 0))));
  return share;
};

/**
 * What a caster (Aldric, or a villain) is worth to his side besides his blows: the spells his mana
 * can still cast, and his charges (orders) at `CHARGE` mana each. Each
 * point counts as this much fighting worth for every point of spell power: about half what a bolt
 * takes with it, so a good spell is still worth its mana.
 */
const CASTER = 1;
const CHARGE = 5;

function stackWorth(b: BattleState, f: Fighter): number {
  if (f.count <= 0) return 0;
  const hp = unitOf(f).hp;
  const healing = Math.min(hp - f.hp, hp * healShare(f.troop));
  const worth = troopWorth(b, f) * (f.count - 1 + (f.hp + healing * HEALED) / hp + PRESENCE);
  const book = f.hero ? b.hero : f.book;
  if (!book) return worth;
  const charges = (book.charges ?? []).reduce((sum, c) => sum + c.uses, 0);
  return book.spells.length || charges ? worth + CASTER * book.spellPower * (book.mana + CHARGE * charges) : worth;
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
  for (const f of b.fighters) if (onField(f)) mask[f.at] = 1;
  return mask;
}

/** The hexes a leader who rides out could strike from this turn, round what `mask` marks. */
function rideMask(f: Fighter, mask: Uint8Array): Uint8Array {
  const reach = new Uint8Array(HEXES);
  for (const hex of rideFrom(f, (i) => !mask[i]).keys()) reach[hex] = 1;
  return reach;
}

/**
 * What `side` could take from the other with each stack's best strike: a shot, or a blow from a hex
 * it can reach, less what the target strikes back (nothing, for a charge).
 * `now` is this coming turn; `later` counts blows only reachable the turn after, so stacks see an
 * attack coming and screen their shooters. Blows on one target add up, but never past what that
 * target is worth.
 */
function threat(b: BattleState, side: Side, mask: Uint8Array): { now: number; later: number } {
  const foes = b.fighters.filter((o) => onField(o) && o.side !== side);
  const now = new Map<number, number>();
  const later = new Map<number, number>();
  const add = (map: Map<number, number>, id: number, worth: number) => map.set(id, (map.get(id) ?? 0) + worth);
  for (const f of b.fighters) {
    // A stack that will lose its turn (turned into newts), or a leader with nothing to do, threatens nobody this time.
    if (f.side !== side || !hasTurn(f) || f.status.some((st) => STATUSES[st].skipsTurn)) continue;
    // Morale's expected extra turn (or the one low spirits may cost it) counts for its blows too.
    const turns = actions(b, f);
    const leader = isLeader(f);
    const pinned = !leader && foes.some((o) => NEIGHBOURS[f.at].includes(o.at));
    if (f.shots > 0 && !pinned) {
      let best = 0;
      let target = -1;
      for (const o of foes) {
        const gain = loss(b, o, strike(b, f, o, true).damage);
        if (gain > best) [best, target] = [gain, o.id];
      }
      if (target >= 0) add(now, target, best * turns);
      continue;
    }
    if (leader && !ridesOut(f)) continue;
    const speed = speedOf(f);
    // A leader rides out from his side's edge every time, so his reach never grows: nothing for later.
    const reach = leader ? rideMask(f, mask) : reachMask(f.at, speed, mask);
    const farther = leader ? reach : reachMask(f.at, speed * 2, mask);
    let best = 0;
    let target = -1;
    let bestLater = 0;
    let targetLater = -1;
    // A stack that charges, standing clear of the enemy, finds a run-up to whoever it can reach; a leader always has one.
    const charge = !pinned && (leader || speed >= CHARGE_HEXES) && f.side === 'player' && (b.hero.charge ?? []).includes(f.troop);
    for (const o of foes) {
      const soon = NEIGHBOURS[o.at].some((n) => reach[n]);
      if (!soon && !NEIGHBOURS[o.at].some((n) => farther[n])) continue;
      const damage = strike(b, f, o, false, undefined, charge ? CHARGE_BONUS : 1).damage;
      const w = wound(o, damage);
      let gain = stackWorth(b, o) - stackWorth(b, { ...o, count: w.count, hp: w.hp });
      if (w.count > 0 && !o.retaliated && !charge && !leader) gain -= loss(b, f, strike(b, { ...o, count: w.count, hp: w.hp }, f, false).damage);
      if (soon && gain > best) [best, target] = [gain, o.id];
      else if (!soon && gain > bestLater) [bestLater, targetLater] = [gain, o.id];
    }
    if (target >= 0) add(now, target, best * turns);
    else if (targetLater >= 0) add(later, targetLater, bestLater * turns);
  }
  const total = (map: Map<number, number>) => [...map].reduce((sum, [id, worth]) => sum + Math.min(worth, stackWorth(b, fighterById(b, id))), 0);
  return { now: total(now), later: total(later) };
}

/** Shooting worth with arrows left: whoever has less of it can't win by waiting. */
const firepowerOf = (b: BattleState, side: Side) => b.fighters.filter((f) => f.count > 0 && f.side === side && f.shots > 0).reduce((sum, f) => sum + stackWorth(b, f), 0);

/** How good the battle looks for `side`, weighing the blows to come as `w` says. */
export function evaluate(b: BattleState, side: Side, w: Weights = CAREFUL): number {
  const mine = b.fighters.filter((f) => f.count > 0 && f.side === side).reduce((sum, f) => sum + stackWorth(b, f), 0);
  const theirs = b.fighters.filter((f) => f.count > 0 && f.side !== side).reduce((sum, f) => sum + stackWorth(b, f), 0);
  if (b.result === 'won' || b.result === 'lost') return (b.result === 'won') === (side === 'player') ? 1e5 + mine : -1e5 - theirs;
  const other: Side = side === 'player' ? 'enemy' : 'player';
  const mask = blockedMask(b);
  const theirs2 = threat(b, other, mask);
  const ours = threat(b, side, mask);
  let score = mine - theirs - w.theirNow * theirs2.now - w.theirLater * theirs2.later + w.ourNow * ours.now + w.ourLater * ours.later;
  if (w.hunt) {
    // Their shooters on the field hurt wherever we stand: every stack that can't shoot heads for them.
    const shooters = b.fighters.filter((f) => onField(f) && f.side === other && f.shots > 0);
    if (shooters.length > 0) {
      for (const f of b.fighters) {
        if (!onField(f) || f.side !== side || f.shots > 0) continue;
        const nearest = Math.min(...shooters.map((o) => distance(f.at, o.at)));
        score -= w.hunt * stackWorth(b, f) * Math.max(0, nearest - 1) / Math.max(1, speedOf(f));
      }
    }
  }
  if (!w.patient) return score;
  // Out-shot, waiting only loses: close in on their stacks. And the longer a battle drags on, the
  // more both sides want to get it over with, so nobody dances round a troll for forty rounds.
  const pressure = (firepowerOf(b, other) > firepowerOf(b, side) * 1.1 ? 1 : 0) + Math.max(0, (b.round - 6) / 6);
  if (pressure > 0) {
    const targets = b.fighters.filter((f) => onField(f) && f.side === other);
    for (const f of b.fighters) {
      if (!onField(f) || f.side !== side || (f.shots > 0 && !targets.some((o) => NEIGHBOURS[f.at].includes(o.at)))) continue;
      const nearest = Math.min(...targets.map((o) => distance(f.at, o.at)));
      score -= 0.03 * pressure * stackWorth(b, f) * Math.max(0, nearest - 1) / Math.max(1, speedOf(f));
    }
  }
  return score;
}

/** Every action the acting stack could take (the hero's spells come separately). */
export function stackActions(b: BattleState): BattleAction[] {
  const opts = options(b);
  return [
    ...opts.shoot.map((target): BattleAction => ({ type: 'shoot', target })),
    ...opts.melee.map((m): BattleAction => ({ type: 'melee', target: m.target, from: m.from })),
    ...[...opts.moves.keys()].map((to): BattleAction => ({ type: 'move', to })),
    { type: 'defend' },
  ];
}

/** Every spell the hero could cast now, on every stack it could be cast on. */
export function castActions(b: BattleState): BattleAction[] {
  const acting = activeFighter(b);
  if (!acting) return [];
  // Aldric's book for your side's turns; each villain's own for theirs.
  const casters: (number | undefined)[] = acting.side === 'player' ? [undefined] : castersOf(b, acting.side).map((f) => f.id);
  const actions: BattleAction[] = [];
  for (const by of casters) {
    const side = casterSide(b, by);
    for (const spell of spellsOf(b, by)) {
      if (!canCast(b, spell, by)) continue;
      const who = by === undefined ? {} : { by };
      if (!needsTarget(spell)) {
        actions.push({ type: 'cast', spell, ...who });
        continue;
      }
      const on = SPELLS[spell].on;
      for (const f of b.fighters) if (onField(f) && (f.side === side) === (on === 'friend')) actions.push({ type: 'cast', spell, target: f.id, ...who });
    }
  }
  return actions;
}

/** The action that leaves the battle looking best for `side`. */
function best(b: BattleState, actions: BattleAction[], side: Side, w: Weights = CAREFUL): { action: BattleAction; score: number } | null {
  let top: { action: BattleAction; score: number } | null = null;
  for (const action of actions) {
    const { battle, events } = battleAct(b, action, true);
    if (events.length === 0) continue;
    const score = evaluate(battle, side, w);
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
  if (!b.fighters.some((o) => onField(o) && o.side !== f.side)) return { type: 'defend' };
  // A spell first, if one is worth more than not casting (the stack still acts after it).
  if (f.side === 'player') {
    const cast = best(b, castActions(b), 'player');
    if (cast && cast.score > evaluate(b, 'player') + 1) return cast.action;
  }
  return best(b, stackActions(b), f.side)?.action ?? { type: 'defend' };
}

/**
 * The enemy's way: never wait, never turtle, never back off. Shooters shoot, at whatever hurts you
 * most; one caught in melee steps clear if it can get out of everyone's reach, and fights if it
 * can't. Everyone else strikes the best blow in reach, weighing what the target strikes back. With
 * nobody in reach, a stack closes in at full pace, round the rocks, making for your shooters first.
 */
export function onslaught(b: BattleState): BattleAction {
  const f = activeFighter(b)!;
  const side = f.side;
  // A villain casts, or gives an order, when that beats doing without (the stack still acts after).
  const cast = best(b, castActions(b), side, STRIKE);
  if (cast && cast.score > evaluate(b, side, STRIKE) + 1) return cast.action;
  const opts = options(b);
  if (opts.shoot.length > 0) return best(b, opts.shoot.map((target): BattleAction => ({ type: 'shoot', target })), side, STRIKE)!.action;
  const blow = best(b, opts.melee.map((m): BattleAction => ({ type: 'melee', target: m.target, from: m.from })), side, STRIKE);
  // A leader never walks the field: he strikes if he can reach anyone, and otherwise waits for his next turn.
  if (isLeader(f)) return blow?.action ?? { type: 'defend' };
  if (f.shots > 0) {
    // Caught in melee: step clear if it can get out of reach, since a shot next turn beats a blow at half strength now.
    const melee = opts.melee.map((m): BattleAction => ({ type: 'melee', target: m.target, from: m.from }));
    const clear = best(b, outOfReach(b, f, opts.moves).map((to): BattleAction => ({ type: 'move', to })), side, BRAVE);
    const fight = best(b, melee, side, BRAVE);
    if (clear && (!fight || clear.score > fight.score)) return clear.action;
  }
  return blow?.action ?? closeIn(b, f, opts, side)?.action ?? { type: 'defend' };
}

/**
 * The best of the moves that close in at full pace on one of the other side's stacks. With no way
 * through to any of them, it edges as near as it can, as the crow flies.
 */
function closeIn(b: BattleState, f: Fighter, opts: Options, side: Side): { action: BattleAction; score: number } | null {
  const foes = b.fighters.filter((o) => onField(o) && o.side !== side);
  const hexes = new Set<number>();
  for (const o of foes) {
    const steps = stepsTo(b, [o], f);
    const here = steps[f.at] < 0 ? Infinity : steps[f.at];
    let low = here;
    for (const [hex] of opts.moves) if (steps[hex] >= 0 && steps[hex] < low) low = steps[hex];
    if (low < here) for (const [hex] of opts.moves) if (steps[hex] === low) hexes.add(hex);
  }
  if (hexes.size === 0) {
    const crow = (hex: number) => Math.min(...foes.map((o) => distance(hex, o.at)));
    const nearest = Math.min(...[...opts.moves.keys()].map(crow));
    for (const [hex] of opts.moves) if (crow(hex) === nearest) hexes.add(hex);
  }
  return best(b, [...hexes].map((to): BattleAction => ({ type: 'move', to })), side, BRAVE);
}

/** Whether `o` gets its turn before `f` does, in a round where both are still to act. */
const actsFirst = (o: Fighter, f: Fighter) => speedOf(o) > speedOf(f) || (speedOf(o) === speedOf(f) && (o.side === f.side ? o.id < f.id : o.side === 'player'));

/**
 * Hexes a shooter caught in melee could step to where none of the other side can come beside it
 * before its next turn, so it shoots again then.
 */
function outOfReach(b: BattleState, f: Fighter, moves: ReadonlyMap<number, unknown>): number[] {
  const mask = blockedMask(b);
  mask[f.at] = 0;
  const reach = new Uint8Array(HEXES);
  for (const o of b.fighters) {
    if (o.count <= 0 || o.side === f.side) continue;
    // A leader who rides out can strike from wherever his ride reaches, every turn; any other leader can't come at all.
    if (isLeader(o)) {
      if (ridesOut(o)) rideMask(o, mask).forEach((r, i) => r && (reach[i] = 1));
      continue;
    }
    reach[o.at] = 1;
    // Its moves before our next turn: the rest of this round, if it hasn't gone yet, and the next one's, if it goes first.
    const turns = (b.order.includes(o.id) ? 1 : 0) + (actsFirst(o, f) ? 1 : 0);
    if (turns === 0) continue;
    const r = reachMask(o.at, speedOf(o) * turns, mask);
    for (let i = 0; i < HEXES; i++) if (r[i]) reach[i] = 1;
  }
  return [...moves.keys()].filter((hex) => !NEIGHBOURS[hex].some((n) => reach[n]));
}
