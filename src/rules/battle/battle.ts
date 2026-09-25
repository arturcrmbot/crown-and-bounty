import { SPELLS, type SpellId } from '../../content/spells';
import { TROOPS, type TroopId } from '../../content/troops';
import { roll, type Army } from '../state';
import { COLS, HEXES, hexIndex, neighbours, reachable } from './hex';

export type Side = 'player' | 'enemy';

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
  blessed: boolean;
  slowed: boolean;
  hasted: boolean;
};

/** The player's hero, watching from the edge of the field: skills for every stack, and spells. */
export type BattleHero = {
  /** What the battle log calls him. */
  name?: string;
  attack: number;
  defence: number;
  spellPower: number;
  mana: number;
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
};

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
};

export type BattleAction =
  | { type: 'move'; to: number }
  | { type: 'melee'; target: number; from: number }
  | { type: 'shoot'; target: number }
  | { type: 'wait' }
  | { type: 'defend' }
  | { type: 'cast'; spell: SpellId; target: number }
  | { type: 'retreat' };

export type BattleEvent =
  | { type: 'move'; fighter: number; path: number[] }
  | { type: 'hit'; attacker: number; target: number; damage: number; killed: number; ranged: boolean; retaliation: boolean; hexed?: boolean }
  /** A troll's wounds close up at the start of its turn. */
  | { type: 'regen'; fighter: number; healed: number }
  | { type: 'spell'; spell: SpellId; target: number; damage: number; killed: number }
  | { type: 'wait' | 'defend'; fighter: number }
  | { type: 'turn'; fighter: number }
  | { type: 'round'; round: number }
  | { type: 'end'; result: 'won' | 'lost' | 'fled' };

export type BattleResult = { battle: BattleState; events: BattleEvent[] };

/** Rows the stacks line up on, centre first. */
const LINE_UP = [4, 2, 6, 0, 8];

const alive = (f: Fighter) => f.count > 0;
export const fighterById = (b: BattleState, id: number) => b.fighters.find((f) => f.id === id)!;
export const activeFighter = (b: BattleState): Fighter | null => (b.result || b.order.length === 0 ? null : fighterById(b, b.order[0]));
export const speedOf = (f: Fighter) => {
  const base = TROOPS[f.troop].speed + (f.hasted ? 2 : 0);
  return f.slowed ? Math.ceil(base / 2) : base;
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
        shots: TROOPS[s.troop].shots ? TROOPS[s.troop].shots! + (side === 'player' ? (args.hero.troops?.[s.troop]?.shots ?? 0) : 0) : 0,
        retaliated: false,
        defending: false,
        waited: false,
        blessed: false,
        slowed: side === 'enemy' && (args.hero.slows ?? []).includes(s.troop),
        hasted: false,
      }),
    );
  add(args.player.filter((s) => s.count > 0), 'player', 0);
  add(args.enemy.filter((s) => s.count > 0), 'enemy', COLS - 1);
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
  return { place: args.place, round: 1, fighters, order: turnOrder(fighters), obstacles, seed, hero: args.hero, ...(args.ground === 'fen' ? { ground: 'fen' as const } : {}) };
}

/** Whether a hex is taken by a rock or by a living stack (other than `except`). */
export function blocked(b: BattleState, i: number, except?: number): boolean {
  return b.obstacles.includes(i) || b.fighters.some((f) => alive(f) && f.at === i && f.id !== except);
}

const enemiesOf = (b: BattleState, f: Fighter) => b.fighters.filter((o) => alive(o) && o.side !== f.side);
export const adjacentEnemy = (b: BattleState, f: Fighter) => enemiesOf(b, f).some((e) => neighbours(f.at).includes(e.at));

export type Options = { moves: Map<number, number[]>; melee: { target: number; from: number }[]; shoot: number[] };

/** Everything the acting stack can do right now. */
export function options(b: BattleState): Options {
  const f = activeFighter(b);
  if (!f) return { moves: new Map(), melee: [], shoot: [] };
  const moves = reachable(f.at, speedOf(f), (i) => blocked(b, i, f.id));
  const melee: Options['melee'] = [];
  for (const e of enemiesOf(b, f)) {
    for (const n of neighbours(e.at)) if (n === f.at || moves.has(n)) melee.push({ target: e.id, from: n });
  }
  const shoot = isRanged(f) && !adjacentEnemy(b, f) ? enemiesOf(b, f).map((e) => e.id) : [];
  return { moves, melee, shoot };
}

/** A stack's attack and defence as they stand, with the hero's help. */
export function statsOf(b: BattleState, f: Fighter): { attack: number; defence: number } {
  const t = TROOPS[f.troop];
  const help = heroSkill(b, f);
  return { attack: t.attack + help.attack, defence: t.defence + help.defence };
}

/** Attack and defence the hero adds to a stack: his own, plus any bonus for that kind of troop. */
function heroSkill(b: BattleState, f: Fighter): { attack: number; defence: number } {
  if (f.side !== 'player') return { attack: 0, defence: 0 };
  const troop = b.hero.troops?.[f.troop];
  return { attack: b.hero.attack + (troop?.attack ?? 0), defence: b.hero.defence + (troop?.defence ?? 0) };
}

/** The attack-against-defence multiplier, HoMM2 style. */
export function skillFactor(attack: number, defence: number): number {
  return attack >= defence ? Math.min(4, 1 + 0.1 * (attack - defence)) : Math.max(0.3, 1 - 0.05 * (defence - attack));
}

/** Damage one stack deals another. With `seed` it rolls; without, it's the average. */
export function strike(b: BattleState, attacker: Fighter, target: Fighter, ranged: boolean, seed?: number): { damage: number; seed?: number } {
  const t = TROOPS[attacker.troop];
  const attack = t.attack + heroSkill(b, attacker).attack;
  let defence = TROOPS[target.troop].defence + heroSkill(b, target).defence;
  if (target.defending) defence = Math.round(defence * 1.3);
  const [min, max] = t.damage;
  let perTroop: number;
  if (attacker.blessed) perTroop = max;
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
  const inMelee = !ranged && t.shots ? 0.5 : 1;
  const skill = attacker.side === 'player' ? 1 + ((ranged ? b.hero.ranged : b.hero.melee) ?? 0) : 1;
  const armour = target.side === 'player' ? 1 - (b.hero.armour ?? 0) : 1;
  const damage = Math.max(1, Math.round(attacker.count * perTroop * skillFactor(attack, defence) * inMelee * skill * armour));
  return { damage, seed };
}

/** What `damage` leaves of a stack. */
export function wound(target: Fighter, damage: number): { count: number; hp: number; killed: number } {
  const full = TROOPS[target.troop].hp;
  const remaining = (target.count - 1) * full + target.hp - damage;
  if (remaining <= 0) return { count: 0, hp: 0, killed: target.count };
  const count = Math.ceil(remaining / full);
  return { count, hp: remaining - (count - 1) * full, killed: target.count - count };
}

/** Mana a spell costs this hero. */
export const spellCost = (b: BattleState, spell: SpellId) => Math.max(1, SPELLS[spell].mana - (b.hero.manaDiscount ?? 0));
export const canCast = (b: BattleState, spell: SpellId) => b.hero.spells.includes(spell) && b.hero.castRound < b.round && b.hero.mana >= spellCost(b, spell);
export const boltDamage = (b: BattleState) => 20 * b.hero.spellPower;

/** Applies one action for the acting stack (or the hero's spell) and moves the battle on. */
export function battleAct(b: BattleState, action: BattleAction): BattleResult {
  const f = activeFighter(b);
  if (!f) return { battle: b, events: [] };
  const fighters = b.fighters.map((x) => ({ ...x }));
  let next: BattleState = { ...b, fighters, order: [...b.order], hero: { ...b.hero } };
  const me = fighterById(next, f.id);
  const events: BattleEvent[] = [];
  const opts = options(b);

  const hit = (attacker: Fighter, target: Fighter, ranged: boolean, retaliation: boolean) => {
    const rolled = strike(next, attacker, target, ranged, next.seed);
    next.seed = rolled.seed!;
    const w = wound(target, rolled.damage);
    target.count = w.count;
    target.hp = w.hp;
    events.push({ type: 'hit', attacker: attacker.id, target: target.id, damage: rolled.damage, killed: w.killed, ranged, retaliation });
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
      if (action.from !== me.at) {
        events.push({ type: 'move', fighter: me.id, path: opts.moves.get(action.from)! });
        me.at = action.from;
      }
      const target = fighterById(next, action.target);
      hit(me, target, false, false);
      if (alive(target) && !target.retaliated) {
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
      if (TROOPS[me.troop].ability === 'hexes' && alive(target) && !target.slowed) {
        target.slowed = true;
        (events[events.length - 1] as Extract<BattleEvent, { type: 'hit' }>).hexed = true;
      }
      break;
    }
    case 'wait': {
      if (me.waited) return battleAct(b, { type: 'defend' });
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
      next.hero.castRound = b.round;
      let damage = 0;
      let killed = 0;
      if (action.spell === 'bolt') {
        damage = boltDamage(b);
        const w = wound(target, damage);
        killed = w.killed;
        target.count = w.count;
        target.hp = w.hp;
      } else if (action.spell === 'bless') target.blessed = true;
      else if (action.spell === 'haste') target.hasted = true;
      else target.slowed = true;
      events.push({ type: 'spell', spell: action.spell, target: target.id, damage, killed });
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
    const fighters = next.fighters.map((f) => ({ ...f, retaliated: false, waited: false }));
    next = { ...next, round: next.round + 1, fighters, order: turnOrder(fighters) };
    events.push({ type: 'round', round: next.round });
  }
  const acting = fighterById(next, next.order[0]);
  if (acting.defending) next = { ...next, fighters: next.fighters.map((f) => (f.id === acting.id ? { ...f, defending: false } : f)) };
  const full = TROOPS[acting.troop].hp;
  if (TROOPS[acting.troop].ability === 'regenerates' && acting.hp < full) {
    next = { ...next, fighters: next.fighters.map((f) => (f.id === acting.id ? { ...f, hp: full } : f)) };
    events.push({ type: 'regen', fighter: acting.id, healed: full - acting.hp });
  }
  events.push({ type: 'turn', fighter: acting.id });
  return { battle: next, events };
}

/** The survivors of one side, as an army again. */
export function survivors(b: BattleState, side: Side): Army {
  return b.fighters.filter((f) => f.side === side && alive(f)).map((f) => ({ troop: f.troop, count: f.count }));
}

export const livingHexes = (b: BattleState) => new Set(b.fighters.filter(alive).map((f) => f.at));
export { HEXES };
