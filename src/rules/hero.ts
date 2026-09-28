import { ARTIFACTS, SLOTS, type ArtifactId, type Slot } from '../content/artifacts';
import { BACKGROUNDS, type BackgroundId, type Bonus } from '../content/backgrounds';
import { PERKS, RANKS, SKILLS, type PerkId, type SkillId } from '../content/skills';
import type { MapSpellId, SpellId } from '../content/spells';
import type { TroopId } from '../content/troops';
import { close, roll, roman, show, type Card, type GameEvent, type GameState, type Result } from './state';

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

/** Everything that adds to the hero: the background's signature, skills by rank, perks and worn gear. */
export function bonusesOf(state: GameState): Bonus[] {
  const hero = state.hero;
  const out: Bonus[] = [BACKGROUNDS[hero.background].signature.bonus];
  for (const [id, rank] of Object.entries(hero.skills) as [SkillId, number][]) for (let r = 0; r < rank; r++) out.push(SKILLS[id].perRank);
  for (const id of hero.perks) out.push(PERKS[id].bonus);
  for (const id of Object.values(hero.gear)) if (id) out.push(ARTIFACTS[id].bonus);
  return out;
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
  charge: TroopId[];
  volley: boolean;
  forestWalk: boolean;
  /** Spells he may cast in one round of battle. */
  casts: number;
  mapSpells: MapSpellId[];
  bribes: number;
  hires: boolean;
};

/** The hero's numbers with everything added up. The rules use these, never the raw fields. */
/** Leadership each level brings: troops follow a famous officer. */
export const RENOWN = 10;

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
    charge: [],
    volley: false,
    forestWalk: false,
    casts: 1,
    mapSpells: [],
    bribes: 0,
    hires: false,
  };
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
    s.charge.push(...(b.charge ?? []));
    s.volley ||= Boolean(b.volley);
    s.forestWalk ||= Boolean(b.forestWalk);
    s.casts += b.casts ?? 0;
    s.mapSpells.push(...(b.mapSpells ?? []).filter((m) => !s.mapSpells.includes(m)));
    s.bribes += b.bribes ?? 0;
    s.hires ||= Boolean(b.hires);
  }
  s.bribes = Math.min(0.8, s.bribes);
  s.armour = Math.min(0.6, s.armour);
  s.maxMana = s.knowledge * 10;
  return s;
}

/**
 * Whether a trick perk would change nothing for this hero: he can already do it (his background's
 * signature, a relic, an earlier perk).
 */
function hasTrick(state: GameState, id: PerkId): boolean {
  const s = heroStats(state);
  const b = PERKS[id].bonus;
  if (b.charge?.length) return b.charge.every((t) => s.charge.includes(t));
  if (b.volley) return s.volley;
  if (b.forestWalk) return s.forestWalk;
  if (b.hires) return s.hires;
  if (b.mapSpells?.length) return b.mapSpells.every((m) => s.mapSpells.includes(m));
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
 * Draws three different options, favouring the background's skills and the skills already learned.
 * One of the three is always a trick while any are left: something that changes how he plays.
 */
function drawOptions(state: GameState, seed: number): { options: string[]; seed: number } {
  const favours = BACKGROUNDS[state.hero.background].favours;
  const pool = candidates(state).map((option) => {
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
  while (options.length < 3 && pool.length > 0) take(pool);
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
  const rank = state.hero.skills[id as SkillId] ?? 0;
  return { label: `${RANKS[rank]} ${SKILLS[id as SkillId].name}`, note: SKILLS[id as SkillId].note };
}

/** The card for the first level-up still waiting, or null. */
export function levelUpCard(state: GameState): Card | null {
  const offer = state.hero.offers[0];
  if (!offer) return null;
  const options = offer.options.map((o) => ({ o, ...describeOption(o, state) }));
  return {
    title: `Level ${roman(offer.level)}!`,
    lines: [`**${STAT_NAMES[offer.stat]} +1, leadership +${RENOWN}.** Choose something to learn:`, ...options.map((x) => `**${x.label}**: ${x.note}`)],
    choices: options.map((x) => ({ label: x.label, action: { type: 'learn', option: x.o } })),
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
  // Offers still waiting were drawn before this choice: draw them again, so none offers what he now has.
  let seed = next.seed;
  const offers = hero.offers.map((o) => {
    const drawn = drawOptions(next, seed);
    seed = drawn.seed;
    return { ...o, options: drawn.options };
  });
  next = { ...next, seed, hero: { ...hero, offers } };
  const card = levelUpCard(next);
  return { state: next, events: card ? [show(card)] : [] };
}

/** Puts an artifact in the pack, and wears it straight away if its slot is free. */
export function giveArtifact(state: GameState, id: ArtifactId): GameState {
  const slot = ARTIFACTS[id].slot;
  if (!state.hero.gear[slot]) return { ...state, hero: { ...state.hero, gear: { ...state.hero.gear, [slot]: id } } };
  return { ...state, hero: { ...state.hero, pack: [...state.hero.pack, id] } };
}

/** Says where a just-found artifact went: on him, or into the pack because that slot is taken. */
export function foundNote(state: GameState, id: ArtifactId): string {
  const a = ARTIFACTS[id];
  return state.hero.gear[a.slot] === id ? `You put it on. ${a.note}` : `${a.note} It goes in your pack: you already wear something there.`;
}

/** Wears an artifact from the pack; whatever was in that slot goes back in the pack. */
export function equip(state: GameState, id: ArtifactId): Result | null {
  if (!state.hero.pack.includes(id)) return null;
  const slot = ARTIFACTS[id].slot;
  const worn = state.hero.gear[slot];
  const pack = state.hero.pack.filter((_, i) => i !== state.hero.pack.indexOf(id));
  const hero = { ...state.hero, gear: { ...state.hero.gear, [slot]: id }, pack: worn ? [...pack, worn] : pack };
  const swapped = { ...state, hero };
  // Taking off something that gave knowledge takes its mana with it.
  const next = { ...swapped, hero: { ...hero, mana: Math.min(hero.mana, heroStats(swapped).maxMana) } };
  return { state: next, events: [show(gearCard(next))] };
}

export function gearCard(state: GameState): Card {
  const { gear, pack } = state.hero;
  const worn = SLOTS.map((slot: Slot) => {
    const id = gear[slot];
    return `**${slot[0].toUpperCase()}${slot.slice(1)}:** ${id ? `${ARTIFACTS[id].name}. ${ARTIFACTS[id].note}` : '(nothing)'}`;
  });
  return {
    title: 'Equipment',
    lines: [...worn, ...(pack.length ? [`*In the pack: ${pack.map((id) => ARTIFACTS[id].name).join(', ')}.*`] : [])],
    choices: [...pack.map((id) => ({ label: `Wear ${ARTIFACTS[id].name}`, action: { type: 'equip' as const, artifact: id } })), close],
  };
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
