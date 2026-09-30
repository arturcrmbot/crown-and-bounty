import { ARTIFACTS, piecesOf, SETS, slotAcceptsArtifact, slotsForArtifact, type ArtifactId, type SetId, type Slot } from '../content/artifacts';
import { BACKGROUNDS, type BackgroundId, type Bonus } from '../content/backgrounds';
import { FRIENDS } from '../content/friends';
import { PERKS, RANKS, SKILLS, type PerkId, type SkillId } from '../content/skills';
import type { MapSpellId, SpellId, StatusId } from '../content/spells';
import type { TroopId } from '../content/troops';
import { SHOOTER_MELEE } from './battle/battle';
import { close, roll, roman, show, type Card, type Choice, type ContentChoice, type GameEvent, type GameState, type Location, type Needs, type Result } from './state';

/** A level-up waiting for the player to choose: skills (`skill:archery`) or perks (`perk:warchest`). */
export type Offer = { level: number; stat: StatId; options: string[] };
export type StatId = 'attack' | 'defence' | 'spellPower' | 'knowledge';

export const BASE_MOVEMENT = 150;
export const BASE_SIGHT = 150;

/** XP needed for each level, from level 1. */
export const LEVELS = [0, 0, 150, 400, 750, 1200, 1800, 2500, 3400, 4500, 6000, 8000, 10500, 13500, 17000, 21000];
export const levelFor = (xp: number) => {
  let level = 1;
  while (level + 1 < LEVELS.length && xp >= LEVELS[level + 1]) level++;
  return level;
};

/** Everything that adds to the hero: the background's signature, skills at their rank, perks, companions and worn gear. */
export function bonusesOf(state: GameState): Bonus[] {
  return namedBonuses(state).map((x) => x.bonus);
}

/** The same, each with what it's called ("Advanced Archery", "Goose Whisperer"), for words that say where a bonus comes from. */
export function namedBonuses(state: GameState): { name: string; bonus: Bonus }[] {
  const hero = state.hero;
  const signature = BACKGROUNDS[hero.background].signature;
  const out = [{ name: signature.name, bonus: signature.bonus }];
  for (const [id, rank] of Object.entries(hero.skills) as [SkillId, number][]) {
    if (!SKILLS[id] || rank <= 0) continue;
    const r = Math.min(rank, RANKS.length);
    out.push({ name: `${RANKS[r - 1]} ${SKILLS[id].name}`, bonus: SKILLS[id].ranks[r - 1].bonus });
  }
  for (const id of hero.perks) out.push({ name: PERKS[id].name, bonus: PERKS[id].bonus });
  for (const id of hero.friends ?? []) out.push({ name: FRIENDS[id].name, bonus: FRIENDS[id].bonus });
  for (const id of Object.values(hero.gear)) if (id) out.push({ name: ARTIFACTS[id].name, bonus: ARTIFACTS[id].bonus });
  for (const set of wornSets(state)) out.push({ name: SETS[set].name, bonus: SETS[set].bonus });
  return out;
}

/** Sets whose every piece the hero wears. */
export function wornSets(state: GameState): SetId[] {
  const worn = new Set(Object.values(state.hero.gear));
  return (Object.keys(SETS) as SetId[]).filter((set) => piecesOf(set).every((id) => worn.has(id)));
}

/**
 * How far along an artifact's set the hero is (its own note says what the set does), or that he
 * has just completed it. Empty for an artifact that belongs to no set.
 */
export function setLine(state: GameState, id: ArtifactId): string {
  const set = ARTIFACTS[id].set;
  if (!set) return '';
  const pieces = piecesOf(set);
  const worn = pieces.filter((p) => Object.values(state.hero.gear).includes(p)).length;
  if (worn === pieces.length) return `**${SETS[set].name} is complete!** ${SETS[set].note}`;
  return `*You are wearing ${worn} of the ${pieces.length}.*`;
}

export type HeroStats = {
  attack: number;
  defence: number;
  spellPower: number;
  knowledge: number;
  maxMana: number;
  leadership: number;
  movement: number;
  sight: number;
  melee: number;
  ranged: number;
  armour: number;
  wages: number;
  recruitPrice: number;
  payday: number;
  loot: number;
  manaDiscount: number;
  troops: Partial<Record<TroopId, { attack: number; defence: number; shots: number }>>;
  slows: TroopId[];
  wards: Partial<Record<TroopId, StatusId[]>>;
  charges: { spell: SpellId; uses: number }[];
  charge: TroopId[];
  volley: boolean;
  forestWalk: boolean;
  /** Spells he may cast in one round of battle. */
  casts: number;
  mapSpells: MapSpellId[];
  /** Battle spells he can cast: his own, and any his gear holds. */
  spells: SpellId[];
  /** How hard his shooters hit in melee, as a share of a shot. */
  shooterMelee: number;
  /** After a won battle: the share of his mana that comes back, and of each company's fallen who get up. */
  manaBack: number;
  mend: number;
  bribes: number;
  hires: boolean;
  tames: boolean;
  /** Share off riding off the road (and through woods he can ride). */
  offRoad: number;
  /** His scouts count every enemy, put a number on his chances and say what an enemy carries, or shadow every band. */
  counts: boolean;
  odds: boolean;
  shadow: boolean;
  /** Share of every company that stays on between commissions. */
  veterans: number;
  /** Leadership's worth of volunteers every payday, a share more recruits everywhere, and rents (included in `payday`). */
  volunteers: number;
  restock: number;
  rents: number;
  /** Mana that comes back for every point of movement ridden. */
  manaRate: number;
  cows: boolean;
  hiresGates: boolean;
  /** Chance a blow lands lucky: twice as hard. */
  luck: number;
  /** Chance a stack's good spirits win it another turn before the round moves on. */
  morale: number;
  /** Share more recruits, free; share of today's movement that carries over; how far he smells treasure. */
  freeRecruits: number;
  carry: number;
  smells: number;
  /** Interest the King's bankers pay on payday (included in `payday`). */
  interest: number;
  /** Extra choices at a level-up, and extra boons at court. */
  choices: number;
  boons: number;
};

/** The most interest the King's bankers pay on one payday. */
export const MAX_INTEREST = 500;

/** The hero's numbers with everything added up. The rules use these, never the raw fields. */
/**
 * Leadership each level brings: troops follow a famous officer. Leadership caps the army, so it grows
 * slowly enough that he's still growing into the third week of a commission (docs/BALANCE.md).
 */
export const RENOWN = 5;

/** The share of every company that stays on between commissions, before skills. */
export const VETERANS = 0.25;

/** Nobody casts more spells than this in a round, however many ways he has learned to cast again. */
export const MAX_CASTS = 2;

/**
 * The share of the most mana he holds that comes back each dawn. A holy well or his castle fills the
 * rest, so a caster chooses where to spend his spells, and rides to the wells (HoMM2's spell points).
 */
export const DAWN_MANA = 0.25;

/** His mana after a night's rest: a quarter of the most he holds (rounded up) comes back, never past it. */
export const rested = (mana: number, max: number) => Math.max(Math.min(mana, max), Math.min(max, mana + Math.ceil(max * DAWN_MANA)));

export function heroStats(state: GameState): HeroStats {
  const h = state.hero;
  const s: HeroStats = {
    attack: h.attack,
    defence: h.defence,
    spellPower: h.spellPower,
    knowledge: h.knowledge,
    maxMana: 0,
    leadership: state.leadership + (h.level - 1) * RENOWN,
    movement: BASE_MOVEMENT,
    sight: BASE_SIGHT,
    melee: 0,
    ranged: 0,
    armour: 0,
    wages: 0,
    recruitPrice: 0,
    payday: 0,
    loot: 0,
    manaDiscount: 0,
    troops: {},
    slows: [],
    wards: {},
    charges: [],
    charge: [],
    volley: false,
    forestWalk: false,
    casts: 1,
    mapSpells: [],
    spells: [...h.spells],
    shooterMelee: SHOOTER_MELEE,
    manaBack: 0,
    mend: 0,
    bribes: 0,
    hires: false,
    tames: false,
    offRoad: 0,
    counts: false,
    odds: false,
    shadow: false,
    veterans: VETERANS,
    volunteers: 0,
    restock: 0,
    rents: 0,
    manaRate: 0,
    cows: false,
    hiresGates: false,
    luck: 0,
    morale: 0,
    freeRecruits: 0,
    carry: 0,
    smells: 0,
    interest: 0,
    choices: 0,
    boons: 0,
  };
  let interest = 0;
  let gearDefence = 0;
  let rentPerTown = 0;
  for (const b of bonusesOf(state)) {
    s.attack += b.attack ?? 0;
    s.defence += b.defence ?? 0;
    s.spellPower += b.spellPower ?? 0;
    s.knowledge += b.knowledge ?? 0;
    s.leadership += b.leadership ?? 0;
    s.movement += b.movement ?? 0;
    s.sight += b.sight ?? 0;
    s.melee += b.melee ?? 0;
    s.ranged += b.ranged ?? 0;
    s.armour += b.armour ?? 0;
    s.wages += b.wages ?? 0;
    s.recruitPrice += b.recruitPrice ?? 0;
    s.payday += b.payday ?? 0;
    s.loot += b.loot ?? 0;
    s.manaDiscount += b.manaDiscount ?? 0;
    for (const [troop, t] of Object.entries(b.troops ?? {}) as [TroopId, { attack?: number; defence?: number; shots?: number }][]) {
      const prev = s.troops[troop] ?? { attack: 0, defence: 0, shots: 0 };
      s.troops[troop] = { attack: prev.attack + (t.attack ?? 0), defence: prev.defence + (t.defence ?? 0), shots: prev.shots + (t.shots ?? 0) };
    }
    s.slows.push(...(b.slows ?? []));
    for (const [troop, statuses] of Object.entries(b.wards ?? {}) as [TroopId, StatusId[]][]) s.wards[troop] = [...new Set([...(s.wards[troop] ?? []), ...statuses])];
    for (const c of b.charges ?? []) {
      const had = s.charges.find((x) => x.spell === c.spell);
      if (had) had.uses += c.uses;
      else s.charges.push({ ...c });
    }
    s.charge.push(...(b.charge ?? []));
    s.volley ||= Boolean(b.volley);
    s.forestWalk ||= Boolean(b.forestWalk);
    s.casts += b.casts ?? 0;
    s.mapSpells.push(...(b.mapSpells ?? []).filter((m) => !s.mapSpells.includes(m)));
    s.spells.push(...(b.spells ?? []).filter((m) => !s.spells.includes(m)));
    s.shooterMelee = Math.max(s.shooterMelee, b.shooterMelee ?? 0);
    s.manaBack += b.manaBack ?? 0;
    s.mend += b.mend ?? 0;
    s.bribes += b.bribes ?? 0;
    s.hires ||= Boolean(b.hires);
    s.tames ||= Boolean(b.tames);
    s.offRoad += b.offRoad ?? 0;
    s.counts ||= Boolean(b.counts);
    s.odds ||= Boolean(b.odds);
    s.shadow ||= Boolean(b.shadow);
    s.veterans += b.veterans ?? 0;
    s.volunteers += b.volunteers ?? 0;
    s.restock += b.restock ?? 0;
    rentPerTown += b.rents ?? 0;
    s.manaRate += b.manaRide ? 1 / b.manaRide : 0;
    s.cows ||= Boolean(b.cows);
    s.hiresGates ||= Boolean(b.hiresGates);
    s.luck += b.luck ?? 0;
    s.morale += b.morale ?? 0;
    gearDefence += b.gearDefence ?? 0;
    s.freeRecruits += b.freeRecruits ?? 0;
    s.carry = Math.max(s.carry, b.carry ?? 0);
    s.smells = Math.max(s.smells, b.smells ?? 0);
    interest += b.interest ?? 0;
    s.choices += b.choices ?? 0;
    s.boons += b.boons ?? 0;
  }
  s.interest = Math.min(MAX_INTEREST, Math.floor(Math.max(0, state.gold) * interest));
  s.defence += gearDefence * Object.values(h.gear).filter(Boolean).length;
  s.rents = rentPerTown * state.locations.filter((l) => (l.kind === 'castle' || l.kind === 'village') && l.seen).length;
  s.payday += s.rents + s.interest;
  s.offRoad = Math.min(0.5, s.offRoad);
  s.veterans = Math.min(0.5, s.veterans);
  s.bribes = Math.min(0.8, s.bribes);
  s.casts = Math.min(MAX_CASTS, s.casts);
  s.manaBack = Math.min(1, s.manaBack);
  s.mend = Math.min(0.5, s.mend);
  s.armour = Math.min(0.6, s.armour);
  s.luck = Math.min(0.5, s.luck);
  s.morale = Math.min(0.5, s.morale);
  s.maxMana = s.knowledge * 10;
  return s;
}

/**
 * Whether a trick perk would change nothing for this hero: he can already do it (his background's
 * signature, a relic, an earlier perk).
 */
const hasTrick = (state: GameState, id: PerkId) => knowsTrick(state, PERKS[id].bonus);

/** Whether a bonus's trick is one the hero can do already. False for a bonus with no trick. */
export function knowsTrick(state: GameState, b: Bonus): boolean {
  const s = heroStats(state);
  if (b.charge?.length) return b.charge.every((t) => s.charge.includes(t));
  if (b.volley) return s.volley;
  if (b.forestWalk) return s.forestWalk;
  if (b.hires) return s.hires;
  if (b.tames) return s.tames;
  if (b.mapSpells?.length) return b.mapSpells.every((m) => s.mapSpells.includes(m));
  if (b.casts) return s.casts >= MAX_CASTS;
  return false;
}

/** What a level-up could teach: skills below Expert, and perks not yet taken (or tricks he already has). */
function candidates(state: GameState): string[] {
  const skills = (Object.keys(SKILLS) as SkillId[]).filter((id) => (state.hero.skills[id] ?? 0) < RANKS.length).map((id) => `skill:${id}`);
  const perks = (Object.keys(PERKS) as PerkId[]).filter((id) => !state.hero.perks.includes(id) && !hasTrick(state, id)).map((id) => `perk:${id}`);
  return [...skills, ...perks];
}

const isTrick = (option: string) => option.startsWith('perk:') && Boolean(PERKS[option.slice(5) as PerkId].trick);

/**
 * Draws three different options (four for a scholar), favouring the background's skills and the
 * skills already learned. One is always a trick while any are left: something that changes how he plays.
 * `skip` is what he has just learned: its next rank waits for a later level-up, so a skill's ranks come
 * one at a time, not all three from one fight.
 */
function drawOptions(state: GameState, seed: number, skip?: string): { options: string[]; seed: number } {
  const favours = BACKGROUNDS[state.hero.background].favours;
  const pool = candidates(state).filter((option) => option !== skip).map((option) => {
    const [kind, id] = option.split(':');
    const weight = kind === 'perk' ? 0.8 : 1 + (favours.includes(id) ? 1.5 : 0) + (state.hero.skills[id as SkillId] ? 1 : 0);
    return { option, weight };
  });
  const options: string[] = [];
  const take = (from: typeof pool) => {
    const [r, next] = roll(seed);
    seed = next;
    let pick = r * from.reduce((sum, p) => sum + p.weight, 0);
    const i = from.findIndex((p) => (pick -= p.weight) <= 0);
    const chosen = from[i < 0 ? from.length - 1 : i];
    pool.splice(pool.indexOf(chosen), 1);
    options.push(chosen.option);
  };
  const tricks = pool.filter((p) => isTrick(p.option));
  if (tricks.length) take(tricks);
  const wanted = 3 + heroStats(state).choices;
  while (options.length < wanted && pool.length > 0) take(pool);
  return { options, seed };
}

function growStat(state: GameState, seed: number): { stat: StatId; seed: number } {
  const growth = BACKGROUNDS[state.hero.background].growth;
  const [r, next] = roll(seed);
  let pick = r * (growth.attack + growth.defence + growth.spellPower + growth.knowledge);
  const stat = (['attack', 'defence', 'spellPower', 'knowledge'] as StatId[]).find((s) => (pick -= growth[s]) <= 0) ?? 'attack';
  return { stat, seed: next };
}

const STAT_NAMES: Record<StatId, string> = { attack: 'Attack', defence: 'Defence', spellPower: 'Spell power', knowledge: 'Knowledge' };

export function describeOption(option: string, state: GameState): { label: string; note: string } {
  const [kind, id] = option.split(':');
  if (kind === 'perk') return { label: `${PERKS[id as PerkId].name} (${PERKS[id as PerkId].trick ? 'new trick' : 'perk'})`, note: PERKS[id as PerkId].note };
  const rank = Math.min(state.hero.skills[id as SkillId] ?? 0, RANKS.length - 1);
  const next = SKILLS[id as SkillId].ranks[rank];
  // A second cast is nothing new to a hero who casts two already: say so, rather than let him think it's a third.
  const capped = next.bonus.casts && heroStats(state).casts >= MAX_CASTS ? ' *You cast two spells a round already, and nobody casts more, so that part changes nothing for you.*' : '';
  return { label: `${RANKS[rank]} ${SKILLS[id as SkillId].name}`, note: `${next.note}${capped}` };
}

/** The card for the first level-up still waiting, or null. */
export function levelUpCard(state: GameState): Card | null {
  const offer = state.hero.offers[0];
  if (!offer) return null;
  const options = offer.options.map((o) => ({ o, ...describeOption(o, state) }));
  return {
    title: `Level ${roman(offer.level)}!`,
    lines: [`Your ${STAT_NAMES[offer.stat].toLowerCase()} rises by **1**, and your leadership by **${RENOWN}**. Choose something to learn.`],
    choices: options.map((x) => ({ label: x.label, detail: x.note, action: { type: 'learn', option: x.o } })),
  };
}

/** Adds experience; every level gained raises a stat now and queues a choice for the player. */
export function gainXp(state: GameState, amount: number): Result {
  if (amount <= 0) return { state, events: [] };
  const xp = state.hero.xp + Math.round(amount);
  let next: GameState = { ...state, hero: { ...state.hero, xp } };
  const events: GameEvent[] = [];
  let seed = next.seed;
  for (let level = state.hero.level + 1; level <= levelFor(xp); level++) {
    const grown = growStat(next, seed);
    const drawn = drawOptions(next, grown.seed);
    seed = drawn.seed;
    const hero = next.hero;
    next = { ...next, hero: { ...hero, level, [grown.stat]: hero[grown.stat] + 1, offers: [...hero.offers, { level, stat: grown.stat, options: drawn.options }] } };
    events.push({ type: 'levelUp', level });
  }
  return { state: { ...next, seed }, events };
}

/** Takes one of the offered options. */
export function learn(state: GameState, option: string): Result | null {
  const offer = state.hero.offers[0];
  if (!offer || !offer.options.includes(option) || !candidates(state).includes(option)) return null;
  const [kind, id] = option.split(':');
  const hero = { ...state.hero, offers: state.hero.offers.slice(1) };
  if (kind === 'perk') hero.perks = [...hero.perks, id as PerkId];
  else hero.skills = { ...hero.skills, [id]: (hero.skills[id as SkillId] ?? 0) + 1 };
  let next: GameState = { ...state, hero };
  // Offers still waiting were drawn before this choice: draw them again, so none offers what he now has,
  // nor the next rank of what he has just learned.
  let seed = next.seed;
  const offers = hero.offers.map((o) => {
    const drawn = drawOptions(next, seed, option);
    seed = drawn.seed;
    return { ...o, options: drawn.options };
  });
  next = { ...next, seed, hero: { ...hero, offers } };
  const card = levelUpCard(next);
  return { state: next, events: card ? [show(card)] : [] };
}

/**
 * Puts an artifact in the pack, and wears it straight away if it has no drawback and a slot of its
 * kind is free: a trinket takes the first free one of the three.
 */
export function giveArtifact(state: GameState, id: ArtifactId): GameState {
  const artifact = ARTIFACTS[id];
  const slot = artifact.drawback ? undefined : slotsForArtifact(artifact.slot).find((candidate) => !state.hero.gear[candidate]);
  if (slot) return { ...state, hero: { ...state.hero, gear: { ...state.hero.gear, [slot]: id } } };
  return { ...state, hero: { ...state.hero, pack: [...state.hero.pack, id] } };
}

/** The choice shown when a drawback artifact is found. */
export function artifactChoices(state: GameState, id: ArtifactId): Choice[] {
  if (!ARTIFACTS[id].drawback || !state.hero.pack.includes(id)) return [];
  return [
    { label: 'Wear it', action: { type: 'equip', artifact: id } },
    { label: 'Keep it in your pack', action: close.action },
  ];
}

/** Why a find without a drawback went into the pack: its slot is taken, or all three trinket slots are. */
export const slotTaken = (id: ArtifactId) => (ARTIFACTS[id].slot === 'trinket' ? 'all three trinket slots are taken' : 'you wear something there already');

/** Says where a just-found artifact went: on him, or into the pack until he chooses to wear it. */
export function foundNote(state: GameState, id: ArtifactId): string {
  const a = ARTIFACTS[id];
  const set = setLine(state, id);
  const note = Object.values(state.hero.gear).includes(id) ? `You put it on. ${a.note}` : a.drawback
    ? `${a.note} It goes in your pack until you choose whether to wear it.`
    : `${a.note} It goes in your pack, since ${slotTaken(id)}. Press **H** to swap.`;
  return set ? `${note} ${set}` : note;
}

/**
 * After a change of gear: taking off knowledge takes its mana with it, and gear that slows him
 * (heavy plate, or taking off his boots) slows today's ride too, not just tomorrow's. Nothing
 * a change of gear does gives back mana or movement already spent.
 */
const withinMana = (before: GameState, state: GameState): GameState => {
  const s = heroStats(state);
  const slower = Math.max(0, heroStats(before).movement - s.movement);
  return { ...state, movement: Math.max(0, state.movement - slower), hero: { ...state.hero, mana: Math.min(state.hero.mana, s.maxMana) } };
};

/**
 * Moves one thing in a list from `from` to `to`: onto another, the two swap; past the last, it
 * goes to the end. Null when nothing would change. Pack squares and army slots both work this way.
 */
export function moveWithin<T>(list: readonly T[], from: number, to: number): T[] | null {
  if (from < 0 || from >= list.length || to < 0 || to === from) return null;
  const next = [...list];
  if (to < list.length) [next[from], next[to]] = [next[to], next[from]];
  else if (from === list.length - 1) return null;
  else next.push(...next.splice(from, 1));
  return next;
}

/** Wears the artifact in pack square `from`; whatever that slot held takes its square. */
export function wear(state: GameState, from: number, target?: Slot): Result | null {
  const { gear, pack } = state.hero;
  const id = pack[from];
  if (!id) return null;
  const artifactSlot = ARTIFACTS[id].slot;
  const slot = target ?? slotsForArtifact(artifactSlot).find((candidate) => !gear[candidate]) ?? artifactSlot;
  if (!slotAcceptsArtifact(slot, artifactSlot)) return null;
  const worn = gear[slot];
  const rest = worn ? pack.map((p, i) => (i === from ? worn : p)) : pack.filter((_, i) => i !== from);
  return { state: withinMana(state, { ...state, hero: { ...state.hero, gear: { ...gear, [slot]: id }, pack: rest } }), events: [] };
}

/** Wears an artifact from the pack, by name. */
export const equip = (state: GameState, id: ArtifactId): Result | null => wear(state, state.hero.pack.indexOf(id));

/**
 * Takes off what's worn in `slot`, into pack square `to` (the end, if it's past the last). Onto an
 * artifact for the same slot, the two swap.
 */
export function unequip(state: GameState, slot: Slot, to = state.hero.pack.length): Result | null {
  const { gear, pack } = state.hero;
  const worn = gear[slot];
  if (!worn || to < 0) return null;
  if (pack[to] && slotAcceptsArtifact(slot, ARTIFACTS[pack[to]].slot)) return wear(state, to, slot);
  const at = Math.min(to, pack.length);
  const rest = { ...gear };
  delete rest[slot];
  return { state: withinMana(state, { ...state, hero: { ...state.hero, gear: rest, pack: [...pack.slice(0, at), worn, ...pack.slice(at)] } }), events: [] };
}

/** Moves an artifact from one pack square to another. */
export function movePack(state: GameState, from: number, to: number): Result | null {
  const pack = moveWithin(state.hero.pack, from, to);
  return pack ? { state: { ...state, hero: { ...state.hero, pack } }, events: [] } : null;
}

/** What an armourer pays for gear with no price on it: relics, villains' things, finds. */
export const UNPRICED_SALE = 400;

/** What an armourer pays for an artifact: half its price, or 400 gold if it has none. */
export const salePrice = (id: ArtifactId) => {
  const price = ARTIFACTS[id].price;
  return price ? Math.floor(price / 2) : UNPRICED_SALE;
};

/**
 * The place where a choice still asks for an artifact (`needs.artifact`, or a page's `when`), if
 * any: a page its flags haven't closed, or a parley with a band still standing. It can't be sold.
 */
export function wantedAt(state: GameState, id: ArtifactId): Location | undefined {
  // A flag that closes a page, or a spent one (a parley's goose already called), rules a choice out for good.
  const open = (needs: Needs | undefined) => !(needs?.notFlag && state.flags?.[needs.notFlag]) && !(needs?.flag && state.flags?.[needs.flag] === false);
  const asks = (choice: ContentChoice) => choice.needs?.artifact === id && open(choice.needs);
  return state.locations.find(
    (place) =>
      (place.pages ?? []).some((page) => open(page.when) && (page.when?.artifact === id || page.choices.some(asks))) ||
      (!place.done && (place.enemy?.parleys ?? []).some(asks)),
  );
}

/** Sells an artifact from the pack for its sale price. Null if it isn't in the pack, or a choice still needs it. */
export function sell(state: GameState, id: ArtifactId): Result | null {
  const at = state.hero.pack.indexOf(id);
  if (at < 0 || wantedAt(state, id)) return null;
  const pack = state.hero.pack.filter((_, i) => i !== at);
  return { state: { ...state, gold: state.gold + salePrice(id), hero: { ...state.hero, pack } }, events: [] };
}

/** A fresh hero of a background, standing at `at`. */
export function newHero(background: BackgroundId, at: GameState['hero']['at']): GameState['hero'] {
  const b = BACKGROUNDS[background];
  return {
    at,
    facing: 1,
    background,
    level: 1,
    xp: 0,
    ...b.stats,
    mana: b.stats.knowledge * 10,
    spells: [...b.spells] as SpellId[],
    skills: {},
    perks: [],
    gear: {},
    pack: [],
    offers: [],
  };
}
