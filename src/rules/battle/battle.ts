import { needsTarget, SPELLS, STATUSES, type SpellId, type StatusId } from '../../content/spells';
import { ABILITIES, abilitiesOf, TROOPS, unitPower, type TroopDef, type TroopId } from '../../content/troops';
import { MAX_STACKS, roll, type Army } from '../state';
import { COLS, HEXES, hexIndex, NEIGHBOURS, neighbours, reachable, ROWS } from './hex';

export type Side = 'player' | 'enemy';

/** A fighter's own health and damage per troop, when they aren't its troop's usual ones: the hero's damage grows with him. */
export type UnitNumbers = { hp: number; damage: readonly [number, number] };

/**
 * One stack on the battlefield, or a leader behind his side's line (see `isLeader`, who has no hex:
 * his `at` is `REAR`). `hp` is the health of its top troop; the rest are whole.
 */
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
  /** Spells and abilities on the stack, for the rest of the battle unless `until` says otherwise. */
  status: StatusId[];
  /** Whether good morale has already won this stack a second turn this round (once a round). */
  moraleUsed?: boolean;
  /** The round a status wears off at the start of (those with `rounds`). */
  until?: Partial<Record<StatusId, number>>;
  unit?: UnitNumbers;
  /** Aldric himself, who leads your side from behind the line: the side's spells are his to cast. */
  hero?: boolean;
  /** How many walked off the field without a blow: paid to go home, or gone over to the other side. */
  left?: number;
  /** A villain who leads his side as Aldric does his: his own spellbook, cast from behind his men. */
  book?: Spellbook;
};

/**
 * What a caster knows: spell power, mana, spells, and charges (casts that cost no mana, but take
 * one of the round's casts all the same: a wand's bolts, a villain's orders).
 */
export type Spellbook = {
  /** What the battle log calls him. */
  name?: string;
  spellPower: number;
  mana: number;
  /** The most mana he holds, for the spellbook: none comes back in battle, it's full again at dawn. */
  maxMana?: number;
  spells: SpellId[];
  /** Spells he may cast in a round, and how many he has cast in `castRound`. */
  castRound: number;
  casts?: number;
  castsThisRound?: number;
  manaDiscount?: number;
  charges?: { spell: SpellId; uses: number }[];
};

/** The player's hero: skills for every stack, his spellbook, and himself on the field. */
export type BattleHero = Spellbook & {
  attack: number;
  defence: number;
  /** Damage multipliers from skills and gear, as fractions (0.15 is 15% more). */
  melee?: number;
  ranged?: number;
  /** Fraction of damage the hero's troops shrug off. */
  armour?: number;
  /** Chance a stack's blow lands lucky: twice as hard. */
  luck?: number;
  /** Chance a stack's good spirits win it another turn before the round moves on. */
  morale?: number;
  manaDiscount?: number;
  /** The gold he carries, for a bard's bribes, the share off every bribe, and the leadership he has free for troops who come over. */
  gold?: number;
  bribes?: number;
  room?: number;
  /** Extra attack, defence and shots for kinds of troop. */
  troops?: Partial<Record<TroopId, { attack: number; defence: number; shots: number }>>;
  /** Enemy troops that start slowed. */
  slows?: TroopId[];
  /** His own troops that start with these statuses on them (a ward). */
  wards?: Partial<Record<TroopId, StatusId[]>>;
  /** Where each status he brings comes from, for the battle's opening words: "Advanced Archery: the Wolves start slowed". */
  brought?: { source: string; side: Side; troops: TroopId[]; status: StatusId }[];
  /** Troops that charge (see CHARGE_HEXES). */
  charge?: TroopId[];
  /** Archers loose a free volley before the first round. */
  volley?: boolean;
  /** How hard his shooters hit in melee, as a share of a shot: half, unless he has taught them better. */
  shooterMelee?: number;
  /** He leads from behind the line as this troop, with these numbers (see `heroFighter` in rules/fight.ts). */
  unit?: UnitNumbers & { troop: TroopId };
};

/** Where a leader stands, as far as the field goes: behind his side's line, on no hex at all. */
export const REAR = -1;

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
  /** The statuses the hero brought to the field, and where from: said as the battle opens. */
  opening?: { source: string; status: StatusId; fighters: number[] }[];
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
  /** A spell or an order. `target` for those aimed at a stack; `by` for a villain's (none for Aldric's). */
  | { type: 'cast'; spell: SpellId; target?: number; by?: number }
  | { type: 'volley' }
  | { type: 'retreat' }
  /** A bard's moves: pay a stack to leave the field (or `join`, to fight for him), jeer one, or sing over his own. */
  | { type: 'bribe'; target: number; join?: boolean }
  | { type: 'jeer'; target: number }
  | { type: 'sing'; song: StatusId };

export type BattleEvent =
  /** A stack walks its path; a leader who rides out rides in from his side's edge along it, to strike. */
  | { type: 'move'; fighter: number; path: number[] }
  /** A leader who rode out to strike rides back behind his side's line, along his path. */
  | { type: 'back'; fighter: number; path: number[] }
  | { type: 'hit'; attacker: number; target: number; damage: number; killed: number; ranged: boolean; retaliation: boolean; status?: StatusId; charge?: boolean; lucky?: boolean }
  /** Every shooter on a side looses at once: the ranger's archers before the battle, or at a villain's order (`spell`, `by`). */
  | { type: 'volley'; side?: Side; spell?: SpellId; by?: number }
  /** A fresh stack marches in from its side's edge of the field, called by a spell or an order. */
  | { type: 'summon'; fighter: number; spell: SpellId; by?: number }
  /** A stack loses its turn to a status (newts), which then wears off. */
  | { type: 'skip'; fighter: number; status: StatusId }
  /** A troll's wounds close up at the start of its turn. */
  | { type: 'regen'; fighter: number; healed: number }
  /** A poisoned stack loses a sliver of health at the start of its turn, never past a sliver left. */
  | { type: 'poison'; fighter: number; hurt: number }
  /**
   * A spell lands. `splash` marks the stacks a burst (or a mass status) caught besides its target;
   * `healed` is health given back and `raised` the fallen who got up; `by` is a villain casting.
   */
  | { type: 'spell'; spell: SpellId; target: number; damage: number; killed: number; splash?: boolean; healed?: number; raised?: number; by?: number }
  | { type: 'wait' | 'defend'; fighter: number }
  | { type: 'turn'; fighter: number }
  /** Good spirits win a stack another turn before the round moves on (once a round). */
  | { type: 'morale'; fighter: number }
  /** Low spirits: a stack loses heart, and its turn. */
  | { type: 'falter'; fighter: number }
  /** A bard pays `count` of a stack `gold` to leave the field, or to fight for him as a new stack (`joined`). */
  | { type: 'bribe'; fighter: number; target: number; gold: number; count: number; joined?: number }
  /** A bard jeers a stack, which takes the status. */
  | { type: 'jeer'; fighter: number; target: number; status: StatusId }
  /** A bard sings, and every stack of his side on the field takes the song's status. */
  | { type: 'song'; fighter: number; status: StatusId; targets: number[] }
  | { type: 'round'; round: number }
  | { type: 'end'; result: 'won' | 'lost' | 'fled'; rout?: boolean };

export type BattleResult = { battle: BattleState; events: BattleEvent[] };

/** Rows the stacks line up on, centre first. */
const LINE_UP = [4, 2, 6, 0, 8];

const alive = (f: Fighter) => f.count > 0;

const troopsWith = (has: (a: (typeof ABILITIES)[keyof typeof ABILITIES]) => unknown) => new Set(Object.values(TROOPS).filter((t) => (t.abilities ?? []).some((a) => has(ABILITIES[a]))).map((t) => t.id));
const LEADS = troopsWith((a) => a.leads);
const RIDES = troopsWith((a) => a.rides);
const BARDS = troopsWith((a) => a.bard);
/** Aldric, a villain or a captain: he leads from behind his side's line, and nothing can reach him there (`leads` in content/troops.ts). */
export const isLeader = (f: Pick<Fighter, 'troop'>) => LEADS.has(f.troop);
/** A leader who rides out from behind the line to strike, and back. */
export const ridesOut = (f: Pick<Fighter, 'troop'>) => RIDES.has(f.troop);
/** A stack standing on the field: the only kind of fighter a blow, a shot or a spell can reach. */
export const onField = (f: Fighter) => f.count > 0 && !LEADS.has(f.troop);
/** Whether a fighter has a turn of his own: every stack does, but a leader only with something to do in it. */
export const hasTurn = (f: Fighter) => f.count > 0 && (!LEADS.has(f.troop) || f.shots > 0 || RIDES.has(f.troop) || BARDS.has(f.troop));
/** A bard's repertoire (`bard` in content/troops.ts), if the fighter is one. */
export const bardOf = (f: Pick<Fighter, 'troop'>) => (BARDS.has(f.troop) ? abilitiesOf(f.troop).find((a) => a.bard)!.bard! : null);
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

/** Aldric's own fighter, behind his side's line, if he came to the battle. */
export const heroOnField = (b: BattleState) => b.fighters.find((f) => f.hero) ?? null;

/** The book a cast draws on: a villain's own (`by`), or the player's hero's. */
export const bookOf = (b: BattleState, by?: number): Spellbook | null => (by === undefined ? b.hero : (b.fighters.find((f) => f.id === by)?.book ?? null));
/** Who casts from a book: the villain, or Aldric's own fighter (none in a battle saved before he came to them). */
export const casterOf = (b: BattleState, by?: number): Fighter | null => (by === undefined ? heroOnField(b) : (b.fighters.find((f) => f.id === by) ?? null));
/** The side a book casts for. */
export const casterSide = (b: BattleState, by?: number): Side => casterOf(b, by)?.side ?? 'player';
/** Whether a caster can cast at all: not turned into something that can't. A hero with no fighter of his own always can. */
export function canCastAt(b: BattleState, by?: number): boolean {
  const f = casterOf(b, by);
  if (!f) return by === undefined;
  return alive(f) && !f.status.some((s) => STATUSES[s].silences);
}
/** The villains on the field who can cast for `side` right now. */
export const castersOf = (b: BattleState, side: Side) => b.fighters.filter((f) => f.side === side && f.book && canCastAt(b, f.id));
/** How much of a side's troops is left, as a share of the health they began with. Its leaders don't count: they can't be hurt. */
export function sideShare(b: BattleState, side: Side): number {
  let [left, start] = [0, 0];
  for (const f of b.fighters) {
    if (f.side !== side || isLeader(f)) continue;
    const hp = unitOf(f).hp;
    left += f.count > 0 ? (f.count - 1) * hp + f.hp : 0;
    start += f.startCount * hp;
  }
  return start ? left / start : 0;
}
/** What a status's look is while it lasts (newts, frogs), if any. */
export const lookOf = (f: Fighter) => f.status.map((s) => STATUSES[s].look).find(Boolean) ?? null;

/** Speed after statuses: additions first, then multipliers, rounded up. */
export const speedOf = (f: Fighter) => {
  const defs = f.status.map((s) => STATUSES[s]);
  const base = unitOf(f).speed + defs.reduce((sum, d) => sum + (d.speedAdd ?? 0), 0);
  const times = defs.reduce((product, d) => product * (d.speedTimes ?? 1), 1);
  return times === 1 ? base : Math.ceil(base * times);
};
export const isRanged = (f: Fighter) => f.shots > 0;

/** What a stack's statuses add to one of its numbers (a song's morale, a jeer's). */
const fromStatuses = (f: Fighter, of: 'morale' | 'luck') => f.status.reduce((sum, s) => sum + (STATUSES[s][of] ?? 0), 0);
/**
 * A stack's morale: its side's (the hero's, for yours), with what songs and jeers add. Above
 * nought, the chance it goes again before the round moves on; below, the chance it loses heart and
 * its turn as the turn comes.
 */
export const moraleOf = (b: BattleState, f: Fighter) => (f.side === 'player' ? (b.hero.morale ?? 0) : 0) + fromStatuses(f, 'morale');
/** The chance a stack's blow lands lucky, twice as hard: its side's (the hero's, for yours), with what songs add. */
export const luckOf = (b: BattleState, f: Fighter) => (f.side === 'player' ? (b.hero.luck ?? 0) : 0) + fromStatuses(f, 'luck');

function turnOrder(fighters: Fighter[]): number[] {
  return fighters
    .filter(hasTurn)
    .sort((a, b) => speedOf(b) - speedOf(a) || (a.side === b.side ? a.id - b.id : a.side === 'player' ? -1 : 1))
    .map((f) => f.id);
}

export function createBattle(args: { place: string; seed: number; player: Army; enemy: Army; hero: BattleHero; obstacles?: number; ground?: BattleState['ground'] }): BattleState {
  const fighters: Fighter[] = [];
  const shotsOf = (troop: TroopId, side: Side) => (TROOPS[troop].shots ? TROOPS[troop].shots! + (side === 'player' ? (args.hero.troops?.[troop]?.shots ?? 0) : 0) : 0);
  // What the hero brings: enemy troops slowed, his own warded.
  const brought = (troop: TroopId, side: Side): StatusId[] => (side === 'enemy' ? ((args.hero.slows ?? []).includes(troop) ? ['slowed'] : []) : [...(args.hero.wards?.[troop] ?? [])]);
  // The stacks line up on their side's edge of the field; a villain or a captain stands behind them.
  const add = (army: Army, side: Side, col: number) => {
    let row = 0;
    for (const s of army) {
      fighters.push({
        id: fighters.length,
        side,
        troop: s.troop,
        count: s.count,
        startCount: s.count,
        hp: TROOPS[s.troop].hp,
        at: isLeader(s) ? REAR : hexIndex(col, LINE_UP[row++ % LINE_UP.length]),
        shots: shotsOf(s.troop, side),
        retaliated: false,
        defending: false,
        waited: false,
        status: brought(s.troop, side),
        // A villain leads his side with his own spellbook.
        ...(side === 'enemy' && TROOPS[s.troop].caster ? { book: newBook(TROOPS[s.troop]) } : {}),
      });
    }
  };
  add(args.player.filter((s) => s.count > 0), 'player', 0);
  add(args.enemy.filter((s) => s.count > 0), 'enemy', COLS - 1);
  // Aldric leads his army from behind its line: no part of it, and on no hex of the field.
  const hero = args.hero.unit;
  if (hero) {
    const { troop, ...unit } = hero;
    fighters.push({ id: fighters.length, side: 'player', troop, count: 1, startCount: 1, hp: unit.hp, at: REAR, shots: shotsOf(troop, 'player'), retaliated: false, defending: false, waited: false, status: brought(troop, 'player'), unit, hero: true });
  }
  for (const f of fighters) for (const status of f.status) wearsOff(f, status, 1);
  // The opening words: what each thing he brought does to whom.
  const opening = (args.hero.brought ?? [])
    .map((x) => ({ source: x.source, status: x.status, fighters: fighters.filter((f) => f.side === x.side && x.troops.includes(f.troop) && f.status.includes(x.status)).map((f) => f.id) }))
    .filter((x) => x.fighters.length > 0);
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
  const book: BattleHero = args.hero.charges ? { ...args.hero, charges: args.hero.charges.map((c) => ({ ...c })) } : args.hero;
  return { place: args.place, round: 1, fighters, order: turnOrder(fighters), obstacles, seed, hero: book, ...(args.ground === 'fen' ? { ground: 'fen' as const } : {}), ...(volley ? { volley } : {}), ...(opening.length ? { opening } : {}) };
}

/** A villain's spellbook as the battle opens, from his troop's data. */
function newBook(t: TroopDef): Spellbook {
  const c = t.caster!;
  return { name: t.one, spellPower: c.spellPower, mana: c.mana, maxMana: c.mana, spells: [...(c.spells ?? [])], castRound: 0, ...(c.casts ? { casts: c.casts } : {}), ...(c.charges ? { charges: c.charges.map((x) => ({ ...x })) } : {}) };
}

/** Sets when a status wears off, if it has `rounds`: it counts the round it began in. */
function wearsOff(f: Fighter, status: StatusId, round: number) {
  const rounds = STATUSES[status].rounds;
  if (rounds) f.until = { ...f.until, [status]: round + rounds };
}

/** Whether a hex is taken by a rock or by a living stack (other than `except`). */
export function blocked(b: BattleState, i: number, except?: number): boolean {
  return b.obstacles.includes(i) || b.fighters.some((f) => onField(f) && f.at === i && f.id !== except);
}

/** The other side's stacks on the field: whoever `f` could strike, shoot or cast at. Never a leader. */
const enemiesOf = (b: BattleState, f: Fighter) => b.fighters.filter((o) => onField(o) && o.side !== f.side);
/** Whether an enemy stands beside `f`. Nobody ever stands beside a leader. */
export const adjacentEnemy = (b: BattleState, f: Fighter) => !isLeader(f) && enemiesOf(b, f).some((e) => NEIGHBOURS[f.at].includes(e.at));

/**
 * Steps from every hex to the nearest free hex beside one of `targets`, round rocks and living
 * stacks (-1: no way there). `mover`'s own hex counts as free, so it can be measured from.
 */
export function stepsTo(b: BattleState, targets: readonly Fighter[], mover?: Fighter): Int16Array {
  const mask = new Uint8Array(HEXES);
  for (const i of b.obstacles) mask[i] = 1;
  for (const f of b.fighters) if (onField(f) && f.id !== mover?.id) mask[f.at] = 1;
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
  const players = b.fighters.filter((f) => onField(f) && f.side === 'player');
  let gap = 0;
  let stuck = true;
  for (const e of b.fighters) {
    if (!onField(e) || e.side !== 'enemy') continue;
    const steps = stepsTo(b, players, e)[e.at];
    if (steps >= 0) stuck = false;
    gap += steps < 0 ? HEXES : steps;
  }
  return { gap, stuck };
}

/**
 * What the acting fighter can do: walk to `moves`, strike from a hex beside a target, or shoot. A
 * leader never walks; one who rides out strikes from the hexes in `rides`, with the path in to each.
 */
export type Options = { moves: Map<number, number[]>; melee: { target: number; from: number }[]; shoot: number[]; rides?: Map<number, number[]> };

/** Options worked out already: a battle state never changes once made, and the AI asks about the same one many times. */
const known = new WeakMap<BattleState, Options>();

/** Everything the acting stack can do right now. Don't change what it returns. */
export function options(b: BattleState): Options {
  const cached = known.get(b);
  if (cached) return cached;
  const f = activeFighter(b);
  if (!f) return { moves: new Map(), melee: [], shoot: [] };
  const foes = enemiesOf(b, f);
  let opts: Options;
  if (isLeader(f)) {
    // A leader shoots from behind the line, or rides out to strike and back; he never walks the field.
    const rides = ridesOut(f) ? rideReach(b, f) : new Map<number, number[]>();
    const melee: Options['melee'] = [];
    for (const e of foes) for (const n of NEIGHBOURS[e.at]) if (rides.has(n)) melee.push({ target: e.id, from: n });
    opts = { moves: new Map(), melee, shoot: isRanged(f) ? foes.map((e) => e.id) : [], ...(ridesOut(f) ? { rides } : {}) };
  } else {
    const moves = reachable(f.at, speedOf(f), (i) => blocked(b, i, f.id));
    const melee: Options['melee'] = [];
    for (const e of foes) {
      for (const n of neighbours(e.at)) if (n === f.at || moves.has(n)) melee.push({ target: e.id, from: n });
    }
    opts = { moves, melee, shoot: isRanged(f) && !adjacentEnemy(b, f) ? foes.map((e) => e.id) : [] };
  }
  known.set(b, opts);
  return opts;
}

/** The rows a leader rides in by, nearest the middle of the line first. */
const RIDE_IN = Array.from({ length: ROWS }, (_, row) => row).sort((x, y) => Math.abs(x - 4) - Math.abs(y - 4) || x - y);

/**
 * The hexes a leader who rides out can strike from this turn, with the path to each: in from his
 * side's edge of the field (that hex is his first step), through hexes `free` lets him pass, as far
 * as his speed takes him.
 */
export function rideFrom(f: Fighter, free: (i: number) => boolean): Map<number, number[]> {
  const col = f.side === 'player' ? 0 : COLS - 1;
  const paths = new Map<number, number[]>();
  let frontier: number[] = [];
  for (const row of RIDE_IN) {
    const i = hexIndex(col, row);
    if (!free(i)) continue;
    paths.set(i, [i]);
    frontier.push(i);
  }
  for (let step = 1; step < speedOf(f) && frontier.length > 0; step++) {
    const next: number[] = [];
    for (const i of frontier) {
      for (const n of NEIGHBOURS[i]) {
        if (paths.has(n) || !free(n)) continue;
        paths.set(n, [...paths.get(i)!, n]);
        next.push(n);
      }
    }
    frontier = next;
  }
  return paths;
}
/** Where a leader who rides out can strike from, round the rocks and the stacks on the field. */
export const rideReach = (b: BattleState, f: Fighter) => rideFrom(f, (i) => !blocked(b, i));

/** Defence a stack's statuses add (Stone Skin). */
const statusDefence = (f: Fighter) => f.status.reduce((sum, s) => sum + (STATUSES[s].defenceAdd ?? 0), 0);
/** Attack a stack's statuses add, or take away (a curse). */
const statusAttack = (f: Fighter) => f.status.reduce((sum, s) => sum + (STATUSES[s].attackAdd ?? 0), 0);
/** What a stack's statuses do to the damage it takes from a shot (a shield against arrows). */
const statusShot = (f: Fighter) => f.status.reduce((times, s) => times * (STATUSES[s].rangedTaken ?? 1), 1);

/** A stack's attack and defence as they stand, with the hero's help. */
export function statsOf(b: BattleState, f: Fighter): { attack: number; defence: number } {
  const t = unitOf(f);
  const extra = helpOf(b, f);
  return { attack: t.attack + extra.attack + statusAttack(f), defence: t.defence + extra.defence + statusDefence(f) };
}

/** Attack and defence the hero adds to a stack: his own, plus any bonus for that kind of troop. */
function helpOf(b: BattleState, f: Fighter): { attack: number; defence: number } {
  if (f.side !== 'player') return { attack: 0, defence: 0 };
  const troop = b.hero.troops?.[f.troop];
  return { attack: b.hero.attack + (troop?.attack ?? 0), defence: b.hero.defence + (troop?.defence ?? 0) };
}

/** The attack-against-defence multiplier, HoMM2 style. */
export function skillFactor(attack: number, defence: number): number {
  return attack >= defence ? Math.min(4, 1 + 0.1 * (attack - defence)) : Math.max(0.3, 1 - 0.05 * (defence - attack));
}

/** Damage one stack deals another, times `bonus` (a charge). With `seed` it rolls; without, it's the average. */
export function strike(b: BattleState, attacker: Fighter, target: Fighter, ranged: boolean, seed?: number, bonus = 1): { damage: number; seed?: number; lucky?: boolean } {
  const t = unitOf(attacker);
  const attack = t.attack + helpOf(b, attacker).attack + statusAttack(attacker);
  let defence = unitOf(target).defence + helpOf(b, target).defence + statusDefence(target);
  if (target.defending) defence = Math.round(defence * 1.3);
  // Crossbows and the like punch through armour: a flat cut off the target's defence.
  const pierce = Math.max(0, ...abilitiesOf(attacker.troop).map((a) => a.pierce ?? 0));
  if (pierce) defence = Math.max(0, defence - pierce);
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
  // A lucky blow lands twice as hard. Without a seed (the AI's look-ahead), the chance is spread over the average instead.
  const luckChance = luckOf(b, attacker);
  let lucky = false;
  let luck = 1;
  if (luckChance > 0) {
    if (seed === undefined) luck = 1 + luckChance;
    else {
      const [v, next] = roll(seed);
      seed = next;
      if (v < luckChance) {
        lucky = true;
        luck = 2;
      }
    }
  }
  const damage = Math.max(1, Math.round(attacker.count * perTroop * skillFactor(attack, defence) * inMelee * skill * armour * bonus * shield * luck));
  return { damage, seed, ...(lucky ? { lucky } : {}) };
}

/** What `damage` leaves of a stack. */
export function wound(target: Fighter, damage: number): { count: number; hp: number; killed: number } {
  const full = unitOf(target).hp;
  const remaining = (target.count - 1) * full + target.hp - damage;
  if (remaining <= 0) return { count: 0, hp: 0, killed: target.count };
  const count = Math.ceil(remaining / full);
  return { count, hp: remaining - (count - 1) * full, killed: target.count - count };
}

/** Mana a spell costs a caster (the hero, unless `by` names a villain). An order costs none. */
export const spellCost = (b: BattleState, spell: SpellId, by?: number) => (SPELLS[spell].mana === 0 ? 0 : Math.max(1, SPELLS[spell].mana - (bookOf(b, by)?.manaDiscount ?? 0)));
/** Spells a caster may still cast this round: one, or two for a wizard. */
export const castsLeft = (b: BattleState, by?: number) => {
  const book = bookOf(b, by);
  return book ? (book.casts ?? 1) - (book.castRound === b.round ? (book.castsThisRound ?? 1) : 0) : 0;
};
/** A charge left for a spell (a wand's bolt, an order), if any. */
export const chargeOf = (b: BattleState, spell: SpellId, by?: number) => bookOf(b, by)?.charges?.find((c) => c.spell === spell && c.uses > 0) ?? null;
/** Every spell a caster could cast, if he had the mana and the round's casts: those he knows, and those he has charges for. */
export const spellsOf = (b: BattleState, by?: number): SpellId[] => {
  const book = bookOf(b, by);
  return book ? [...new Set([...book.spells, ...(book.charges ?? []).filter((c) => c.uses > 0).map((c) => c.spell)])] : [];
};
/** Whether a caster may cast a spell now: a cast left this round, himself, a charge or the mana, and his men hurt enough if the spell asks it. */
export function canCast(b: BattleState, spell: SpellId, by?: number): boolean {
  const book = bookOf(b, by);
  if (!book || castsLeft(b, by) <= 0 || !canCastAt(b, by)) return false;
  const hurt = SPELLS[spell].hurt;
  if (hurt !== undefined && sideShare(b, casterSide(b, by)) > hurt) return false;
  return Boolean(chargeOf(b, spell, by)) || (book.spells.includes(spell) && book.mana >= spellCost(b, spell, by));
}
/**
 * Whether a melee attack from `from` would be a charge: a charging troop with a run-up, riding far
 * enough first from a start clear of the enemy (circling a stack it is already fighting isn't one).
 * A leader who charges always has his run-up: he rides in from behind the line.
 */
export const isCharge = (b: BattleState, f: Fighter, from: number, moves = options(b).moves) =>
  f.side === 'player' && (b.hero.charge ?? []).includes(f.troop) && (isLeader(f) || (from !== f.at && (moves.get(from)?.length ?? 0) >= CHARGE_HEXES && !adjacentEnemy(b, f)));
/** Damage a spell does, or 0 if it doesn't do damage. */
export const spellDamage = (b: BattleState, spell: SpellId, by?: number) => {
  const effect = SPELLS[spell].effect;
  return effect.kind === 'damage' || effect.kind === 'burst' ? effect.perPower * (bookOf(b, by)?.spellPower ?? 0) : 0;
};

/** Who a spell cast at `target` would hit: the target, and for a burst every stack next to it too. It passes over the leaders. */
export function spellVictims(b: BattleState, spell: SpellId, target: Fighter): Fighter[] {
  if (SPELLS[spell].effect.kind !== 'burst') return [target];
  const around = new Set([target.at, ...neighbours(target.at)]);
  return [target, ...b.fighters.filter((f) => onField(f) && f.id !== target.id && around.has(f.at))];
}

/** Puts a status on a stack, once. */
const addStatus = (f: Fighter, status: StatusId, round: number) => {
  if (!f.status.includes(status)) f.status = [...f.status, status];
  wearsOff(f, status, round);
};

/** A free hex at a side's own edge of the field, for a stack that marches in: the line's rows first, then the next column in. */
function edgeHex(b: BattleState, side: Side): number | null {
  for (let step = 0; step < COLS; step++) {
    const col = side === 'player' ? step : COLS - 1 - step;
    for (const row of [...LINE_UP, 1, 3, 5, 7]) if (!blocked(b, hexIndex(col, row))) return hexIndex(col, row);
  }
  return null;
}

/**
 * Everyone on `side` who can shoot (and isn't caught in melee) looses once, where his shots take the
 * most: the other side's shooters count double.
 */
function loose(next: BattleState, side: Side, fighters: Fighter[], hit: (a: Fighter, t: Fighter, ranged: boolean, retaliation: boolean) => void) {
  for (const shooter of fighters.filter((x) => x.side === side && alive(x) && x.shots > 0 && !adjacentEnemy(next, x))) {
    const targets = fighters.filter((x) => x.side !== side && onField(x));
    if (!targets.length) break;
    const worth = (x: Fighter) => Math.min(x.count, strike(next, shooter, x, true).damage / unitOf(x).hp) * powerOf(x) * (x.shots > 0 ? 2 : 1);
    const target = targets.reduce((best, x) => (worth(x) > worth(best) ? x : best));
    shooter.shots -= 1;
    hit(shooter, target, true, false);
  }
}

/** How many a summons brings: a share of how many of that troop the side began with, or as much fighting worth. */
function summoned(b: BattleState, side: Side, troop: TroopId, share: number): number {
  const own = b.fighters.filter((f) => f.side === side && f.troop === troop).reduce((sum, f) => sum + f.startCount, 0);
  if (own > 0) return Math.max(1, Math.round(own * share));
  const worth = b.fighters.filter((f) => f.side === side && !isLeader(f)).reduce((sum, f) => sum + f.startCount * powerOf(f), 0);
  return Math.max(1, Math.round((worth * share) / unitPower(TROOPS[troop])));
}

/**
 * What a bard pays a stack of the other side to leave the field, or with `join` to fight for him: so
 * many weeks of its wages, less the hero's share off every bribe, to the nearest ten. Null for
 * troops who take no gold (beasts), for a leader (nothing can reach him), and for a bard who isn't
 * yours: the gold is your purse.
 */
export function bribePrice(b: BattleState, bard: Fighter, target: Fighter, join = false): number | null {
  const art = bardOf(bard);
  const wage = TROOPS[target.troop].wage;
  if (!art || bard.side !== 'player' || target.side === bard.side || !onField(target) || !wage) return null;
  const weeks = join ? art.weeks.join : art.weeks.leave;
  return Math.max(10, Math.round((target.count * wage * weeks * (1 - (b.hero.bribes ?? 0))) / 10) * 10);
}

/** Whether a stack paid to change sides would fit under the hero's banner: leadership for all of it, and a place in his line. */
export function canJoin(b: BattleState, target: Fighter): boolean {
  const line = new Set(b.fighters.filter((f) => f.side === 'player' && onField(f)).map((f) => f.troop));
  return target.count * TROOPS[target.troop].leadership <= (b.hero.room ?? 0) && (line.has(target.troop) || line.size < MAX_STACKS);
}

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
    // Its shots or its bite put a status on whatever they hit, at fixed moments the two abilities read.
    let status: StatusId | undefined;
    if (alive(target)) {
      for (const ability of abilitiesOf(attacker.troop)) {
        const put = ranged ? ability.shotStatus : ability.stingStatus;
        if (put && !hasStatus(target, put)) {
          addStatus(target, put, b.round);
          status = put;
        }
      }
    }
    events.push({ type: 'hit', attacker: attacker.id, target: target.id, damage: rolled.damage, killed: w.killed, ranged, retaliation, ...(status ? { status } : {}), ...(charge ? { charge } : {}), ...(rolled.lucky ? { lucky: true } : {}) });
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
      // A leader rides out from behind the line to strike, and back again: he never stands on the field.
      const ride = isLeader(f) ? opts.rides?.get(action.from) : undefined;
      if (ride) events.push({ type: 'move', fighter: me.id, path: ride });
      else if (action.from !== me.at) {
        events.push({ type: 'move', fighter: me.id, path: opts.moves.get(action.from)! });
        me.at = action.from;
      }
      const target = fighterById(next, action.target);
      // Spears and pikes strike first when they defend, unless the attacker has the same knack.
      // Nothing can reach a leader, so nothing strikes first at him, nor back.
      const untouched = charge || isLeader(f);
      const firstStrike = !untouched && abilitiesOf(target.troop).some((a) => a.firstStrike) && !abilitiesOf(me.troop).some((a) => a.firstStrike);
      if (firstStrike) hit(target, me, false, false);
      if (alive(me)) hit(me, target, false, false, charge);
      // Nobody gets to swing back at a lance coming in at the gallop, nor a stack turned into newts,
      // nor at a first strike already spent this blow.
      if (!firstStrike && alive(target) && !target.retaliated && !untouched && !target.status.some((st) => STATUSES[st].noStrikeBack)) {
        target.retaliated = true;
        hit(target, me, false, true);
      }
      if (ride) events.push({ type: 'back', fighter: me.id, path: [...ride].reverse() });
      break;
    }
    case 'shoot': {
      if (!opts.shoot.includes(action.target)) return { battle: b, events: [] };
      me.shots -= 1;
      const target = fighterById(next, action.target);
      hit(me, target, true, false);
      break;
    }
    case 'wait': {
      if (me.waited) return battleAct(b, { type: 'defend' }, expected);
      me.waited = true;
      next.order = [...next.order.slice(1), me.id];
      events.push({ type: 'wait', fighter: me.id });
      return settle(next, events, false, expected);
    }
    case 'defend':
      me.defending = true;
      events.push({ type: 'defend', fighter: me.id });
      break;
    case 'cast': {
      // Aldric casts on his side's turns, a villain on his: each from his own book, while he stands.
      const by = action.by;
      const side = casterSide(b, by);
      const spell = SPELLS[action.spell];
      const aimed = needsTarget(action.spell);
      // No spell lands on a leader, friend or foe: only on the stacks on the field.
      const target = aimed ? fighters.find((x) => x.id === action.target && onField(x)) : undefined;
      if (side !== f.side || !canCast(b, action.spell, by) || (aimed && (!target || (spell.on === 'enemy') !== (target.side !== side)))) return { battle: b, events: [] };
      // It costs a charge if there is one, and mana if not; either way, one of the round's casts.
      const book: Spellbook = { ...bookOf(b, by)! };
      const charge = chargeOf(b, action.spell, by);
      if (charge) book.charges = book.charges!.map((c) => (c === charge ? { ...c, uses: c.uses - 1 } : c));
      else book.mana -= spellCost(b, action.spell, by);
      book.castsThisRound = book.castRound === b.round ? (book.castsThisRound ?? 1) + 1 : 1;
      book.castRound = b.round;
      if (by === undefined) next.hero = { ...next.hero, ...book };
      else fighterById(next, by).book = book;
      const cast = { spell: action.spell, ...(by !== undefined ? { by } : {}) };
      const effect = spell.effect;
      const power = book.spellPower;
      switch (effect.kind) {
        case 'status':
          addStatus(target!, effect.status, b.round);
          events.push({ type: 'spell', ...cast, target: target!.id, damage: 0, killed: 0 });
          break;
        case 'mass': {
          const on = fighters.filter((x) => onField(x) && (x.side === side) === (spell.on === 'friend'));
          on.forEach((x, i) => {
            addStatus(x, effect.status, b.round);
            events.push({ type: 'spell', ...cast, target: x.id, damage: 0, killed: 0, ...(i > 0 ? { splash: true } : {}) });
          });
          break;
        }
        case 'heal': {
          // Health back, up to all the stack began with: the fallen get up again.
          const t = target!;
          const full = unitOf(t).hp;
          const had = (t.count - 1) * full + t.hp;
          const total = Math.min(t.startCount * full, had + effect.perPower * power);
          const count = Math.ceil(total / full);
          events.push({ type: 'spell', ...cast, target: t.id, damage: 0, killed: 0, healed: total - had, raised: count - t.count });
          t.count = count;
          t.hp = total - (count - 1) * full;
          break;
        }
        case 'volley':
          events.push({ type: 'volley', side, ...cast });
          next.struck = true;
          loose(next, side, fighters, hit);
          break;
        case 'summon': {
          const at = edgeHex(next, side);
          const count = summoned(next, side, effect.troop, effect.share);
          if (at === null || count <= 0) return { battle: b, events: [] };
          const t = TROOPS[effect.troop];
          fighters.push({ id: fighters.length, side, troop: effect.troop, count, startCount: count, hp: t.hp, at, shots: t.shots ?? 0, retaliated: false, defending: false, waited: false, status: [] });
          events.push({ type: 'summon', ...cast, fighter: fighters.length - 1 });
          break;
        }
        default: {
          next.struck = true;
          for (const victim of spellVictims(next, action.spell, target!)) {
            const damage = effect.perPower * power;
            const w = wound(victim, damage);
            victim.count = w.count;
            victim.hp = w.hp;
            events.push({ type: 'spell', ...cast, target: victim.id, damage, killed: w.killed, ...(victim.id !== target!.id ? { splash: true } : {}) });
          }
        }
      }
      return settle(next, events, false, expected);
    }
    case 'volley': {
      if (!b.volley) return { battle: b, events: [] };
      next.volley = undefined;
      events.push({ type: 'volley' });
      loose(next, 'player', fighters, hit);
      return settle(next, events, false, expected);
    }
    case 'retreat':
      next = { ...next, result: 'fled' };
      events.push({ type: 'end', result: 'fled' });
      return { battle: next, events };
    case 'bribe': {
      // The gold goes, and so do they: home, or over to his side as a stack of his own, next round.
      const target = fighters.find((x) => x.id === action.target);
      const price = target ? bribePrice(b, f, target, action.join) : null;
      if (!target || price === null || price > (b.hero.gold ?? 0) || (action.join && !canJoin(b, target))) return { battle: b, events: [] };
      const count = target.count;
      next.hero.gold = (b.hero.gold ?? 0) - price;
      target.left = (target.left ?? 0) + count;
      target.count = 0;
      let joined: number | undefined;
      if (action.join) {
        joined = fighters.length;
        fighters.push({ id: joined, side: f.side, troop: target.troop, count, startCount: count, hp: target.hp, at: target.at, shots: target.shots, retaliated: false, defending: false, waited: false, status: [] });
        next.hero.room = (b.hero.room ?? 0) - count * TROOPS[target.troop].leadership;
      }
      events.push({ type: 'bribe', fighter: f.id, target: target.id, gold: price, count, ...(joined !== undefined ? { joined } : {}) });
      break;
    }
    case 'jeer': {
      const art = bardOf(f);
      const target = fighters.find((x) => x.id === action.target && onField(x) && x.side !== f.side);
      if (!art || !target) return { battle: b, events: [] };
      addStatus(target, art.jeer, b.round);
      events.push({ type: 'jeer', fighter: f.id, target: target.id, status: art.jeer });
      break;
    }
    case 'sing': {
      const art = bardOf(f);
      if (!art?.songs.includes(action.song)) return { battle: b, events: [] };
      const on = fighters.filter((x) => onField(x) && x.side === f.side);
      for (const x of on) addStatus(x, action.song, b.round);
      events.push({ type: 'song', fighter: f.id, status: action.song, targets: on.map((x) => x.id) });
      break;
    }
  }
  return settle(next, events, true, expected);
}

/** Drops the dead, ends the turn if asked, starts a new round when everyone has acted, and checks for a winner. */
function settle(b: BattleState, events: BattleEvent[], endTurn: boolean, expected = false): BattleResult {
  let order = b.order.filter((id) => alive(fighterById(b, id)));
  let fighters = b.fighters;
  let seed = b.seed;
  if (endTurn && order[0] === b.order[0]) {
    const actedId = order[0];
    order = order.slice(1);
    // Good spirits: a chance the stack goes again before the round moves on, once a round. The
    // AI's look-ahead (`expected`) skips the roll, so it never sees a bonus turn that may not come.
    const acted = fighterById(b, actedId);
    const morale = moraleOf(b, acted);
    if (!expected && morale > 0 && !acted.moraleUsed) {
      const [v, rolled] = roll(seed);
      seed = rolled;
      if (v < morale) {
        order = [actedId, ...order];
        fighters = fighters.map((f) => (f.id === actedId ? { ...f, moraleUsed: true } : f));
        events.push({ type: 'morale', fighter: actedId });
      }
    }
  }
  let next: BattleState = { ...b, order, fighters, seed };
  // A side is beaten when its troops are: its leader can't be, but he's nothing without them.
  const players = next.fighters.some((f) => onField(f) && f.side === 'player');
  const enemies = next.fighters.some((f) => onField(f) && f.side === 'enemy');
  if (!players || !enemies) {
    const result = enemies ? 'lost' : 'won';
    events.push({ type: 'end', result });
    return { battle: { ...next, result }, events };
  }
  for (let guard = 0; guard < 64; guard++) {
    if (next.order.length === 0) {
      // A round with no blow struck, and the enemy no closer to you, is a quiet one.
      const reach = enemyReach(next);
      const quiet = next.struck || reach.gap < (next.gap ?? Infinity) ? 0 : (next.quiet ?? 0) + 1;
      // Nobody has landed a blow for a while, and nobody will: the battle is called off. Only a side
      // far weaker than the other counts as beaten; otherwise the enemy keeps its army and holds the field.
      if (quiet >= QUIET_ROUNDS) {
        const worth = (side: Side) => next.fighters.filter((f) => onField(f) && f.side === side).reduce((sum, f) => sum + (((f.count - 1) * unitOf(f).hp + f.hp) / unitOf(f).hp) * powerOf(f), 0);
        const result = worth('enemy') < worth('player') * ROUTED_BELOW ? 'won' : 'fled';
        events.push({ type: 'end', result, rout: true });
        return { battle: { ...next, result, quiet, gap: reach.gap, ...(result === 'fled' && reach.stuck ? { standoff: true } : {}) }, events };
      }
      const round = next.round + 1;
      // Statuses that last a few rounds wear off as a new one begins.
      const fighters = next.fighters.map((f) => {
        const gone = f.until ? f.status.filter((st) => (f.until![st] ?? Infinity) <= round) : [];
        return { ...f, retaliated: false, waited: false, moraleUsed: false, ...(gone.length ? { status: f.status.filter((st) => !gone.includes(st)) } : {}) };
      });
      next = { ...next, round, fighters, order: turnOrder(fighters), struck: false, quiet, gap: reach.gap };
      events.push({ type: 'round', round });
    }
    const first = fighterById(next, next.order[0]);
    // A leader with nothing left to do in his turn (his shots spent) lets it pass.
    if (!hasTurn(first)) {
      next = { ...next, order: next.order.slice(1) };
      continue;
    }
    // Low spirits: a chance the stack loses heart, and its turn, once a turn (not again after a wait).
    const spirit = moraleOf(next, first);
    if (!expected && spirit < 0 && !first.waited) {
      const [v, rolled] = roll(next.seed);
      next = { ...next, seed: rolled };
      if (v < -spirit) {
        next = { ...next, order: next.order.slice(1) };
        events.push({ type: 'falter', fighter: first.id });
        continue;
      }
    }
    // A stack turned into newts loses its turn, and then it wears off.
    const skip = first.status.find((st) => STATUSES[st].skipsTurn);
    if (!skip) break;
    next = { ...next, order: next.order.slice(1), fighters: next.fighters.map((f) => (f.id === first.id ? { ...f, status: f.status.filter((st) => st !== skip) } : f)) };
    events.push({ type: 'skip', fighter: first.id, status: skip });
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
  // A poisoned stack loses a sliver of its top troop's health at the start of its turn, never past a sliver left.
  const poison = Math.round(full * Math.max(0, ...acting.status.map((st) => STATUSES[st].hurtsTopOnTurn ?? 0)));
  if (poison > 0 && acting.hp > 1) {
    const hp = Math.max(1, acting.hp - poison);
    next = { ...next, fighters: next.fighters.map((f) => (f.id === acting.id ? { ...f, hp } : f)) };
    events.push({ type: 'poison', fighter: acting.id, hurt: acting.hp - hp });
  }
  events.push({ type: 'turn', fighter: acting.id });
  return { battle: next, events };
}

/**
 * The survivors of one side, as an army again: troops who came over join their own kind. Its leader
 * isn't part of it: Aldric rides on with his.
 */
export function survivors(b: BattleState, side: Side): Army {
  const army: Army = [];
  for (const f of b.fighters) {
    if (f.side !== side || !onField(f)) continue;
    const same = army.find((s) => s.troop === f.troop);
    if (same) same.count += f.count;
    else army.push({ troop: f.troop, count: f.count });
  }
  return army;
}

/** A leader's name, as the words at the end of a battle give it: Aldric's as his background has it, or the villain's. */
const leaderName = (b: BattleState, f: Fighter) => (f.hero ? (b.hero.name ?? TROOPS[f.troop].name) : TROOPS[f.troop].name);

/**
 * How a battle ended for its leaders, in the words the field and the card both use: what became of
 * the army, and of the leader. Aldric retreats when his army is beaten; a villain (or a captain) is
 * taken when his is. Null when no leader's fate is decided: a retreat, or a fight with nobody to take.
 */
export function battleEnd(b: BattleState): { army: string; leader: string } | null {
  if (b.result === 'lost') {
    const hero = b.fighters.find((f) => f.side === 'player' && isLeader(f));
    return hero ? { army: 'Your army is beaten', leader: `${leaderName(b, hero)} retreats` } : null;
  }
  const taken = b.result === 'won' ? b.fighters.filter((f) => f.side === 'enemy' && isLeader(f)).map((f) => leaderName(b, f)) : [];
  if (!taken.length) return null;
  const names = taken.length > 1 ? `${taken.slice(0, -1).join(', ')} and ${taken[taken.length - 1]}` : taken[0];
  return { army: b.quiet !== undefined && b.quiet >= QUIET_ROUNDS ? 'The rest of them give up and run for it' : 'Their army is beaten', leader: `${names} ${taken.length > 1 ? 'are' : 'is'} taken` };
}

export const livingHexes = (b: BattleState) => new Set(b.fighters.filter(onField).map((f) => f.at));
export { HEXES };
