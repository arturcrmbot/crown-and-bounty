import { SPELLS, STATUSES, type SpellId, type StatusId } from '../../content/spells';
import { ABILITIES, abilitiesOf, TROOPS, unitPower, type TroopDef, type TroopId } from '../../content/troops';
import { roll, type Army } from '../state';
import { COLS, HEXES, hexIndex, NEIGHBOURS, neighbours, reachable } from './hex';

export type Side = 'player' | 'enemy';

/** A stack's own health and damage per troop, when they aren't its troop's usual ones: the hero's grow with him. */
export type UnitNumbers = { hp: number; damage: readonly [number, number] };

/** One stack on the battlefield. `hp` is the health of its top troop; the rest are whole. */
export type Fighter = {
  id: number;
  side: Side;
  troop: TroopId;
  count: number;
  startCount: number;
  hp: number;
  at: number;
  shots: number;
  retaliated: boolean;
  defending: boolean;
  waited: boolean;
  /** Spells and abilities on the stack, for the rest of the battle. */
  status: StatusId[];
  unit?: UnitNumbers;
  /**
   * Aldric himself, a stack of one: the side's spells are his to cast, and only while he stands.
   * When he falls he's carried from the field, not killed, and the battle goes on without him.
   */
  hero?: boolean;
};

/** The player's hero: skills for every stack, his spells, and himself on the field. */
export type BattleHero = {
  /** What the battle log calls him. */
  name?: string;
  attack: number;
  defence: number;
  spellPower: number;
  mana: number;
  /** The most mana he holds, for the spellbook: none comes back in battle, it's full again at dawn. */
  maxMana?: number;
  spells: SpellId[];
  castRound: number;
  /** Damage multipliers from skills and gear, as fractions (0.15 is 15% more). */
  melee?: number;
  ranged?: number;
  /** Fraction of damage the hero's troops shrug off. */
  armour?: number;
  manaDiscount?: number;
  /** Extra attack, defence and shots for kinds of troop. */
  troops?: Partial<Record<TroopId, { attack: number; defence: number; shots: number }>>;
  /** Enemy troops that start slowed. */
  slows?: TroopId[];
  /** Troops that charge (see CHARGE_HEXES). */
  charge?: TroopId[];
  /** Archers loose a free volley before the first round. */
  volley?: boolean;
  /** How hard his shooters hit in melee, as a share of a shot: half, unless he has taught them better. */
  shooterMelee?: number;
  /** Spells he may cast in a round, and how many he has cast in `castRound`. */
  casts?: number;
  castsThisRound?: number;
  /** He takes the field himself, as this troop with these numbers (see `heroFighter` in rules/fight.ts). */
  unit?: UnitNumbers & { troop: TroopId };
};

/** Where Aldric takes the field beside an army of so many stacks: in the line, in the first row it leaves free, or between the first two when all five are taken. */
export const heroHex = (stacks: number) => hexIndex(0, LINE_UP[stacks] ?? 3);

/** How hard a shooter hits in melee, as a share of its shot, unless the hero has taught his better. */
export const SHOOTER_MELEE = 0.5;

/** A charging stack rides at least this many hexes, from a start clear of the enemy, before it strikes; it hits this much harder, and can't be struck back. */
export const CHARGE_HEXES = 3;
export const CHARGE_BONUS = 1.25;

export type BattleState = {
  place: string;
  round: number;
  fighters: Fighter[];
  /** Fighters still to act this round; the first one is acting now. */
  order: number[];
  obstacles: number[];
  seed: number;
  hero: BattleHero;
  result?: 'won' | 'lost' | 'fled';
  /** What the field looks like: Aldmoor's meadows or the Fenmarch's reeds. It changes nothing else. */
  ground?: 'meadow' | 'fen';
  /** Whether anyone has been hurt this round, and how many rounds in a row nobody was, with the enemy getting no closer. */
  struck?: boolean;
  quiet?: number;
  /** How far the enemy had still to go to reach your stacks when the last round ended (see `enemyGap`). */
  gap?: number;
  /** The battle was called off because the enemy couldn't get at you at all: nobody broke and ran. */
  standoff?: boolean;
  /** The hero's archers are about to loose their free volley, before anyone moves. */
  volley?: boolean;
};

/**
 * Rounds in a row with nobody hurt, and the enemy getting no closer, before the battle is called
 * off. The enemy always attacks, so this only happens when it can't get at you: you kept out of its
 * way, or it has no way through. A far weaker enemy then counts as beaten. Otherwise it keeps its
 * army: if you kept away, you left the field as in a retreat; if it had no way to you, both sides
 * simply draw off.
 */
export const QUIET_ROUNDS = 3;
/** A side this much weaker than the other (in fighting worth) is beaten when a quiet battle is called off. */
export const ROUTED_BELOW = 1 / 3;

export type BattleAction =
  | { type: 'move'; to: number }
  | { type: 'melee'; target: number; from: number }
  | { type: 'shoot'; target: number }
  | { type: 'wait' }
  | { type: 'defend' }
  | { type: 'cast'; spell: SpellId; target: number }
  | { type: 'volley' }
  | { type: 'retreat' };

export type BattleEvent =
  | { type: 'move'; fighter: number; path: number[] }
  | { type: 'hit'; attacker: number; target: number; damage: number; killed: number; ranged: boolean; retaliation: boolean; hexed?: boolean; charge?: boolean }
  /** The ranger's archers open the battle with a free volley. */
  | { type: 'volley' }
  /** A troll's wounds close up at the start of its turn. */
  | { type: 'regen'; fighter: number; healed: number }
  /** A spell lands. `splash` marks the stacks a burst caught besides its target. */
  | { type: 'spell'; spell: SpellId; target: number; damage: number; killed: number; splash?: boolean }
  | { type: 'wait' | 'defend'; fighter: number }
  | { type: 'turn'; fighter: number }
  | { type: 'round'; round: number }
  | { type: 'end'; result: 'won' | 'lost' | 'fled'; rout?: boolean };

export type BattleResult = { battle: BattleState; events: BattleEvent[] };

/** Rows the stacks line up on, centre first. */
const LINE_UP = [4, 2, 6, 0, 8];

const alive = (f: Fighter) => f.count > 0;
export const fighterById = (b: BattleState, id: number) => b.fighters.find((f) => f.id === id)!;
export const activeFighter = (b: BattleState): Fighter | null => (b.result || b.order.length === 0 ? null : fighterById(b, b.order[0]));
export const hasStatus = (f: Fighter, status: StatusId) => f.status.includes(status);

const merged = new WeakMap<UnitNumbers, TroopDef>();
/** A stack's numbers: its troop's, with its own health and damage where it has them (the hero). */
export function unitOf(f: Pick<Fighter, 'troop' | 'unit'>): TroopDef {
  if (!f.unit) return TROOPS[f.troop];
  let def = merged.get(f.unit);
  if (!def) merged.set(f.unit, (def = { ...TROOPS[f.troop], ...f.unit }));
  return def;
}
/** A stack's rough fighting worth per troop (see `troopPower`), with its own numbers. */
export const powerOf = (f: Pick<Fighter, 'troop' | 'unit'>) => unitPower(unitOf(f));

/** Aldric's own fighter, if he took the field. */
export const heroOnField = (b: BattleState) => b.fighters.find((f) => f.hero) ?? null;
/** Whether the side's spells can still be cast: by Aldric while he stands, or from the edge of the field in a battle he didn't join. */
const heroStands = (b: BattleState) => {
  const hero = heroOnField(b);
  return !hero || alive(hero);
};

/** Speed after statuses: additions first, then multipliers, rounded up. */
export const speedOf = (f: Fighter) => {
  const defs = f.status.map((s) => STATUSES[s]);
  const base = unitOf(f).speed + defs.reduce((sum, d) => sum + (d.speedAdd ?? 0), 0);
  const times = defs.reduce((product, d) => product * (d.speedTimes ?? 1), 1);
  return times === 1 ? base : Math.ceil(base * times);
};
export const isRanged = (f: Fighter) => f.shots > 0;

function turnOrder(fighters: Fighter[]): number[] {
  return fighters
    .filter(alive)
    .sort((a, b) => speedOf(b) - speedOf(a) || (a.side === b.side ? a.id - b.id : a.side === 'player' ? -1 : 1))
    .map((f) => f.id);
}

export function createBattle(args: { place: string; seed: number; player: Army; enemy: Army; hero: BattleHero; obstacles?: number; ground?: BattleState['ground'] }): BattleState {
  const fighters: Fighter[] = [];
  const shotsOf = (troop: TroopId, side: Side) => (TROOPS[troop].shots ? TROOPS[troop].shots! + (side === 'player' ? (args.hero.troops?.[troop]?.shots ?? 0) : 0) : 0);
  const add = (army: Army, side: Side, col: number) =>
    army.forEach((s, i) =>
      fighters.push({
        id: fighters.length,
        side,
        troop: s.troop,
        count: s.count,
        startCount: s.count,
        hp: TROOPS[s.troop].hp,
        at: hexIndex(col, LINE_UP[i % LINE_UP.length]),
        shots: shotsOf(s.troop, side),
        retaliated: false,
        defending: false,
        waited: false,
        status: side === 'enemy' && (args.hero.slows ?? []).includes(s.troop) ? ['slowed'] : [],
      }),
    );
  add(args.player.filter((s) => s.count > 0), 'player', 0);
  add(args.enemy.filter((s) => s.count > 0), 'enemy', COLS - 1);
  // Aldric takes the field himself, a stack of one, in the line with his army (but not one of its five).
  const hero = args.hero.unit;
  if (hero) {
    const { troop, ...unit } = hero;
    const at = heroHex(fighters.filter((f) => f.side === 'player').length);
    fighters.push({ id: fighters.length, side: 'player', troop, count: 1, startCount: 1, hp: unit.hp, at, shots: shotsOf(troop, 'player'), retaliated: false, defending: false, waited: false, status: [], unit, hero: true });
  }
  let seed = args.seed;
  const obstacles: number[] = [];
  const wanted = args.obstacles ?? 5;
  for (let tries = 0; obstacles.length < wanted && tries < 100; tries++) {
    const [a, s1] = roll(seed);
    const [b, s2] = roll(s1);
    seed = s2;
    const i = hexIndex(2 + Math.floor(a * (COLS - 4)), Math.floor(b * 9));
    if (!obstacles.includes(i)) obstacles.push(i);
  }
  const volley = Boolean(args.hero.volley) && fighters.some((f) => f.side === 'player' && f.shots > 0);
  return { place: args.place, round: 1, fighters, order: turnOrder(fighters), obstacles, seed, hero: args.hero, ...(args.ground === 'fen' ? { ground: 'fen' as const } : {}), ...(volley ? { volley } : {}) };
}

/** Whether a hex is taken by a rock or by a living stack (other than `except`). */
export function blocked(b: BattleState, i: number, except?: number): boolean {
  return b.obstacles.includes(i) || b.fighters.some((f) => alive(f) && f.at === i && f.id !== except);
}

const enemiesOf = (b: BattleState, f: Fighter) => b.fighters.filter((o) => alive(o) && o.side !== f.side);
export const adjacentEnemy = (b: BattleState, f: Fighter) => enemiesOf(b, f).some((e) => neighbours(f.at).includes(e.at));

/**
 * Steps from every hex to the nearest free hex beside one of `targets`, round rocks and living
 * stacks (-1: no way there). `mover`'s own hex counts as free, so it can be measured from.
 */
export function stepsTo(b: BattleState, targets: readonly Fighter[], mover?: Fighter): Int16Array {
  const mask = new Uint8Array(HEXES);
  for (const i of b.obstacles) mask[i] = 1;
  for (const f of b.fighters) if (alive(f) && f.id !== mover?.id) mask[f.at] = 1;
  const steps = new Int16Array(HEXES).fill(-1);
  const queue: number[] = [];
  const visit = (hex: number, n: number) => {
    if (mask[hex] || steps[hex] >= 0) return;
    steps[hex] = n;
    queue.push(hex);
  };
  for (const t of targets) for (const n of NEIGHBOURS[t.at]) visit(n, 0);
  for (let k = 0; k < queue.length; k++) for (const n of NEIGHBOURS[queue[k]]) visit(n, steps[queue[k]] + 1);
  return steps;
}

/**
 * How far the enemy still has to go to strike: each of its stacks' steps to the nearest hex beside
 * one of yours, added up. A stack with no way through counts the whole field, and `stuck` says
 * whether none of them has one.
 */
export function enemyReach(b: BattleState): { gap: number; stuck: boolean } {
  const players = b.fighters.filter((f) => alive(f) && f.side === 'player');
  let gap = 0;
  let stuck = true;
  for (const e of b.fighters) {
    if (!alive(e) || e.side !== 'enemy') continue;
    const steps = stepsTo(b, players, e)[e.at];
    if (steps >= 0) stuck = false;
    gap += steps < 0 ? HEXES : steps;
  }
  return { gap, stuck };
}

export type Options = { moves: Map<number, number[]>; melee: { target: number; from: number }[]; shoot: number[] };

/** Options worked out already: a battle state never changes once made, and the AI asks about the same one many times. */
const known = new WeakMap<BattleState, Options>();

/** Everything the acting stack can do right now. Don't change what it returns. */
export function options(b: BattleState): Options {
  const cached = known.get(b);
  if (cached) return cached;
  const f = activeFighter(b);
  if (!f) return { moves: new Map(), melee: [], shoot: [] };
  const moves = reachable(f.at, speedOf(f), (i) => blocked(b, i, f.id));
  const melee: Options['melee'] = [];
  for (const e of enemiesOf(b, f)) {
    for (const n of neighbours(e.at)) if (n === f.at || moves.has(n)) melee.push({ target: e.id, from: n });
  }
  const shoot = isRanged(f) && !adjacentEnemy(b, f) ? enemiesOf(b, f).map((e) => e.id) : [];
  const opts = { moves, melee, shoot };
  known.set(b, opts);
  return opts;
}

/** Defence a stack's statuses add (Stone Skin). */
const statusDefence = (f: Fighter) => f.status.reduce((sum, s) => sum + (STATUSES[s].defenceAdd ?? 0), 0);
/** Attack a stack's statuses add, or take away (a curse). */
const statusAttack = (f: Fighter) => f.status.reduce((sum, s) => sum + (STATUSES[s].attackAdd ?? 0), 0);
/** What a stack's statuses do to the damage it takes from a shot (a shield against arrows). */
const statusShot = (f: Fighter) => f.status.reduce((times, s) => times * (STATUSES[s].rangedTaken ?? 1), 1);

/** A stack's attack and defence as they stand, with the hero's help and any rally. */
export function statsOf(b: BattleState, f: Fighter): { attack: number; defence: number } {
  const t = unitOf(f);
  const extra = helpOf(b, f);
  return { attack: t.attack + extra.attack + statusAttack(f), defence: t.defence + extra.defence + statusDefence(f) };
}

/** Attack and defence the hero adds to a stack: his own, plus any bonus for that kind of troop. */
function heroSkill(b: BattleState, f: Fighter): { attack: number; defence: number } {
  if (f.side !== 'player') return { attack: 0, defence: 0 };
  const troop = b.hero.troops?.[f.troop];
  return { attack: b.hero.attack + (troop?.attack ?? 0), defence: b.hero.defence + (troop?.defence ?? 0) };
}

/** Troops that hearten the stacks of their side standing beside them, and by how much (see `aura` in content/troops.ts). */
const AURAS = new Map(Object.values(TROOPS).flatMap((t) => (t.abilities ?? []).flatMap((a) => (ABILITIES[a].aura ? [[t.id, ABILITIES[a].aura!] as const] : []))));
/** Each battle state's stacks that rally their neighbours, found once. */
const rallying = new WeakMap<readonly Fighter[], Fighter[]>();

/** What friends standing beside a stack add to its attack and defence (Lord Aldric's rally), or null if nobody does. */
export function rallyOf(b: BattleState, f: Fighter): { attack: number; defence: number } | null {
  let sources = rallying.get(b.fighters);
  if (!sources) rallying.set(b.fighters, (sources = b.fighters.filter((o) => alive(o) && AURAS.has(o.troop))));
  let [attack, defence, rallied] = [0, 0, false];
  for (const o of sources) {
    if (o.side !== f.side || o.id === f.id || !NEIGHBOURS[f.at].includes(o.at)) continue;
    const aura = AURAS.get(o.troop)!;
    [attack, defence, rallied] = [attack + aura.attack, defence + aura.defence, true];
  }
  return rallied ? { attack, defence } : null;
}

/** Everything a stack gets besides its own attack and defence: the hero's skills, and any rally. */
function helpOf(b: BattleState, f: Fighter): { attack: number; defence: number } {
  const skill = heroSkill(b, f);
  const rally = rallyOf(b, f);
  return rally ? { attack: skill.attack + rally.attack, defence: skill.defence + rally.defence } : skill;
}

/** The attack-against-defence multiplier, HoMM2 style. */
export function skillFactor(attack: number, defence: number): number {
  return attack >= defence ? Math.min(4, 1 + 0.1 * (attack - defence)) : Math.max(0.3, 1 - 0.05 * (defence - attack));
}

/** Damage one stack deals another, times `bonus` (a charge). With `seed` it rolls; without, it's the average. */
export function strike(b: BattleState, attacker: Fighter, target: Fighter, ranged: boolean, seed?: number, bonus = 1): { damage: number; seed?: number } {
  const t = unitOf(attacker);
  const attack = t.attack + helpOf(b, attacker).attack + statusAttack(attacker);
  let defence = unitOf(target).defence + helpOf(b, target).defence + statusDefence(target);
  if (target.defending) defence = Math.round(defence * 1.3);
  const [min, max] = t.damage;
  // A blessing rolls the best damage, a curse the worst; both at once cancel out.
  const lean = (attacker.status.some((s) => STATUSES[s].bestDamage) ? 1 : 0) - (attacker.status.some((s) => STATUSES[s].worstDamage) ? 1 : 0);
  let perTroop: number;
  if (lean > 0) perTroop = max;
  else if (lean < 0) perTroop = min;
  else if (seed === undefined) perTroop = (min + max) / 2;
  else {
    const rolls = Math.min(attacker.count, 10);
    let sum = 0;
    for (let r = 0; r < rolls; r++) {
      const [v, next] = roll(seed);
      seed = next;
      sum += min + Math.floor(v * (max - min + 1));
    }
    perTroop = sum / rolls;
  }
  const inMelee = !ranged && t.shots ? (attacker.side === 'player' ? (b.hero.shooterMelee ?? SHOOTER_MELEE) : SHOOTER_MELEE) : 1;
  const skill = attacker.side === 'player' ? 1 + ((ranged ? b.hero.ranged : b.hero.melee) ?? 0) : 1;
  const armour = target.side === 'player' ? 1 - (b.hero.armour ?? 0) : 1;
  const shield = ranged ? statusShot(target) : 1;
  const damage = Math.max(1, Math.round(attacker.count * perTroop * skillFactor(attack, defence) * inMelee * skill * armour * bonus * shield));
  return { damage: ranged ? shotOn(target, damage) : damage, seed };
}

/** Troops no single shot can take more than a share of (a hero's bodyguard, shields up). */
const SHOT_CAPS = new Map(Object.values(TROOPS).flatMap((t) => (t.abilities ?? []).flatMap((a) => (ABILITIES[a].shotCap ? [[t.id, ABILITIES[a].shotCap!] as const] : []))));
/** What a shot (or a spell) of `damage` really does to a stack, after any cap on it. */
export function shotOn(target: Pick<Fighter, 'troop' | 'unit'>, damage: number): number {
  const cap = SHOT_CAPS.get(target.troop);
  return cap ? Math.min(damage, Math.ceil(unitOf(target).hp * cap)) : damage;
}

/** What `damage` leaves of a stack. */
export function wound(target: Fighter, damage: number): { count: number; hp: number; killed: number } {
  const full = unitOf(target).hp;
  const remaining = (target.count - 1) * full + target.hp - damage;
  if (remaining <= 0) return { count: 0, hp: 0, killed: target.count };
  const count = Math.ceil(remaining / full);
  return { count, hp: remaining - (count - 1) * full, killed: target.count - count };
}

/** Mana a spell costs this hero. */
export const spellCost = (b: BattleState, spell: SpellId) => Math.max(1, SPELLS[spell].mana - (b.hero.manaDiscount ?? 0));
/** Spells the hero may still cast this round: one, or two for a wizard. */
export const castsLeft = (b: BattleState) => (b.hero.casts ?? 1) - (b.hero.castRound === b.round ? (b.hero.castsThisRound ?? 1) : 0);
export const canCast = (b: BattleState, spell: SpellId) => b.hero.spells.includes(spell) && castsLeft(b) > 0 && b.hero.mana >= spellCost(b, spell) && heroStands(b);
/**
 * Whether a melee attack from `from` would be a charge: a charging troop with a run-up, riding far
 * enough first from a start clear of the enemy (circling a stack it is already fighting isn't one).
 */
export const isCharge = (b: BattleState, f: Fighter, from: number, moves = options(b).moves) =>
  f.side === 'player' && (b.hero.charge ?? []).includes(f.troop) && from !== f.at && (moves.get(from)?.length ?? 0) >= CHARGE_HEXES && !adjacentEnemy(b, f);
/** Damage a spell does, or 0 if it doesn't do damage. */
export const spellDamage = (b: BattleState, spell: SpellId) => {
  const effect = SPELLS[spell].effect;
  return effect.kind === 'damage' || effect.kind === 'burst' ? effect.perPower * b.hero.spellPower : 0;
};

/** Who a spell cast at `target` would hit: the target, and for a burst everyone next to it too. */
export function spellVictims(b: BattleState, spell: SpellId, target: Fighter): Fighter[] {
  if (SPELLS[spell].effect.kind !== 'burst') return [target];
  const around = new Set([target.at, ...neighbours(target.at)]);
  return [target, ...b.fighters.filter((f) => alive(f) && f.id !== target.id && around.has(f.at))];
}

/** Puts a status on a stack, once. */
const addStatus = (f: Fighter, status: StatusId) => {
  if (!f.status.includes(status)) f.status = [...f.status, status];
};

/**
 * Applies one action for the acting stack (or the hero's spell) and moves the battle on. With
 * `expected`, damage is the average instead of a roll and the dice aren't used: for the AI to
 * try an action out.
 */
export function battleAct(b: BattleState, action: BattleAction, expected = false): BattleResult {
  const f = activeFighter(b);
  if (!f) return { battle: b, events: [] };
  const fighters = b.fighters.map((x) => ({ ...x }));
  let next: BattleState = { ...b, fighters, order: [...b.order], hero: { ...b.hero } };
  const me = fighterById(next, f.id);
  const events: BattleEvent[] = [];
  const opts = options(b);

  const hit = (attacker: Fighter, target: Fighter, ranged: boolean, retaliation: boolean, charge = false) => {
    const rolled = strike(next, attacker, target, ranged, expected ? undefined : next.seed, charge ? CHARGE_BONUS : 1);
    if (!expected) next.seed = rolled.seed!;
    next.struck = true;
    const w = wound(target, rolled.damage);
    target.count = w.count;
    target.hp = w.hp;
    events.push({ type: 'hit', attacker: attacker.id, target: target.id, damage: rolled.damage, killed: w.killed, ranged, retaliation, ...(charge ? { charge } : {}) });
  };

  switch (action.type) {
    case 'move': {
      const path = opts.moves.get(action.to);
      if (!path) return { battle: b, events: [] };
      me.at = action.to;
      events.push({ type: 'move', fighter: me.id, path });
      break;
    }
    case 'melee': {
      const ok = opts.melee.some((m) => m.target === action.target && m.from === action.from);
      if (!ok) return { battle: b, events: [] };
      const charge = isCharge(b, f, action.from, opts.moves);
      if (action.from !== me.at) {
        events.push({ type: 'move', fighter: me.id, path: opts.moves.get(action.from)! });
        me.at = action.from;
      }
      const target = fighterById(next, action.target);
      hit(me, target, false, false, charge);
      // Nobody gets to swing back at a lance coming in at the gallop.
      if (alive(target) && !target.retaliated && !charge) {
        target.retaliated = true;
        hit(target, me, false, true);
      }
      break;
    }
    case 'shoot': {
      if (!opts.shoot.includes(action.target)) return { battle: b, events: [] };
      me.shots -= 1;
      const target = fighterById(next, action.target);
      hit(me, target, true, false);
      for (const ability of abilitiesOf(me.troop)) {
        if (!ability.shotStatus || !alive(target) || hasStatus(target, ability.shotStatus)) continue;
        addStatus(target, ability.shotStatus);
        (events[events.length - 1] as Extract<BattleEvent, { type: 'hit' }>).hexed = true;
      }
      break;
    }
    case 'wait': {
      if (me.waited) return battleAct(b, { type: 'defend' }, expected);
      me.waited = true;
      next.order = [...next.order.slice(1), me.id];
      events.push({ type: 'wait', fighter: me.id });
      return settle(next, events, false);
    }
    case 'defend':
      me.defending = true;
      events.push({ type: 'defend', fighter: me.id });
      break;
    case 'cast': {
      const spell = SPELLS[action.spell];
      const target = fighters.find((x) => x.id === action.target && alive(x));
      if (!target || !canCast(b, action.spell) || (spell.on === 'enemy') !== (target.side === 'enemy')) return { battle: b, events: [] };
      next.hero.mana -= spellCost(b, action.spell);
      next.hero.castsThisRound = b.hero.castRound === b.round ? (b.hero.castsThisRound ?? 1) + 1 : 1;
      next.hero.castRound = b.round;
      const effect = spell.effect;
      if (effect.kind === 'status') {
        addStatus(target, effect.status);
        events.push({ type: 'spell', spell: action.spell, target: target.id, damage: 0, killed: 0 });
        return settle(next, events, false);
      }
      next.struck = true;
      for (const victim of spellVictims(next, action.spell, target)) {
        const damage = shotOn(victim, spellDamage(b, action.spell));
        const w = wound(victim, damage);
        victim.count = w.count;
        victim.hp = w.hp;
        events.push({ type: 'spell', spell: action.spell, target: victim.id, damage, killed: w.killed, ...(victim.id !== target.id ? { splash: true } : {}) });
      }
      return settle(next, events, false);
    }
    case 'volley': {
      if (!b.volley) return { battle: b, events: [] };
      next.volley = undefined;
      events.push({ type: 'volley' });
      // Every stack that can shoot looses once, where its arrows take the most: their shooters count double.
      for (const shooter of fighters.filter((x) => x.side === 'player' && alive(x) && x.shots > 0)) {
        const targets = fighters.filter((x) => x.side === 'enemy' && alive(x));
        if (!targets.length) break;
        const worth = (x: Fighter) => Math.min(x.count, strike(next, shooter, x, true).damage / unitOf(x).hp) * powerOf(x) * (x.shots > 0 ? 2 : 1);
        const target = targets.reduce((best, x) => (worth(x) > worth(best) ? x : best));
        shooter.shots -= 1;
        hit(shooter, target, true, false);
      }
      return settle(next, events, false);
    }
    case 'retreat':
      next = { ...next, result: 'fled' };
      events.push({ type: 'end', result: 'fled' });
      return { battle: next, events };
  }
  return settle(next, events, true);
}

/** Drops the dead, ends the turn if asked, starts a new round when everyone has acted, and checks for a winner. */
function settle(b: BattleState, events: BattleEvent[], endTurn: boolean): BattleResult {
  let order = b.order.filter((id) => alive(fighterById(b, id)));
  if (endTurn && order[0] === b.order[0]) order = order.slice(1);
  let next: BattleState = { ...b, order };
  const players = next.fighters.some((f) => alive(f) && f.side === 'player');
  const enemies = next.fighters.some((f) => alive(f) && f.side === 'enemy');
  if (!players || !enemies) {
    const result = enemies ? 'lost' : 'won';
    events.push({ type: 'end', result });
    return { battle: { ...next, result }, events };
  }
  if (order.length === 0) {
    // A round with no blow struck, and the enemy no closer to you, is a quiet one.
    const reach = enemyReach(next);
    const quiet = next.struck || reach.gap < (next.gap ?? Infinity) ? 0 : (next.quiet ?? 0) + 1;
    // Nobody has landed a blow for a while, and nobody will: the battle is called off. Only a side
    // far weaker than the other counts as beaten; otherwise the enemy keeps its army and holds the field.
    if (quiet >= QUIET_ROUNDS) {
      const worth = (side: Side) => next.fighters.filter((f) => alive(f) && f.side === side).reduce((sum, f) => sum + (((f.count - 1) * unitOf(f).hp + f.hp) / unitOf(f).hp) * powerOf(f), 0);
      const result = worth('enemy') < worth('player') * ROUTED_BELOW ? 'won' : 'fled';
      events.push({ type: 'end', result, rout: true });
      return { battle: { ...next, result, quiet, gap: reach.gap, ...(result === 'fled' && reach.stuck ? { standoff: true } : {}) }, events };
    }
    const fighters = next.fighters.map((f) => ({ ...f, retaliated: false, waited: false }));
    next = { ...next, round: next.round + 1, fighters, order: turnOrder(fighters), struck: false, quiet, gap: reach.gap };
    events.push({ type: 'round', round: next.round });
  }
  const acting = fighterById(next, next.order[0]);
  if (acting.defending) next = { ...next, fighters: next.fighters.map((f) => (f.id === acting.id ? { ...f, defending: false } : f)) };
  const full = unitOf(acting).hp;
  const heal = Math.round(full * Math.max(0, ...abilitiesOf(acting.troop).map((a) => a.healsTopOnTurn ?? 0)));
  if (heal > 0 && acting.hp < full) {
    const hp = Math.min(full, acting.hp + heal);
    next = { ...next, fighters: next.fighters.map((f) => (f.id === acting.id ? { ...f, hp } : f)) };
    events.push({ type: 'regen', fighter: acting.id, healed: hp - acting.hp });
  }
  events.push({ type: 'turn', fighter: acting.id });
  return { battle: next, events };
}

/** The survivors of one side, as an army again. Aldric isn't part of his army: he rides on with it. */
export function survivors(b: BattleState, side: Side): Army {
  return b.fighters.filter((f) => f.side === side && alive(f) && !f.hero).map((f) => ({ troop: f.troop, count: f.count }));
}

/** Whether Aldric took the field and was carried from it. */
export const heroFell = (b: BattleState) => heroOnField(b)?.count === 0;

export const livingHexes = (b: BattleState) => new Set(b.fighters.filter(alive).map((f) => f.at));
export { HEXES };
