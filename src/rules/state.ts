/** Pure game rules: no DOM, no timers. Every change returns a new state plus events, and dice come from `seed`. */
import type { ArtifactId, Slot } from '../content/artifacts';
import type { BackgroundId } from '../content/backgrounds';
import type { PerkId, SkillId } from '../content/skills';
import type { SpellId } from '../content/spells';
import { TROOPS, troopPower, troops, type TroopId } from '../content/troops';
import type { BattleState } from './battle/battle';
import type { Offer } from './hero';
import type { Explored } from './map/fog';
import type { Point } from './map/geometry';

export type { Point, TroopId };
export { TROOPS, troops };

/** One company in an army: a kind of troop and how many. */
export type Stack = { troop: TroopId; count: number };
/** Up to five stacks, as in HoMM2. */
export type Army = Stack[];
export const MAX_STACKS = 5;

export const MOVEMENT_PER_DAY = 150;
export const PAYDAY_EVERY = 7;
export const COMMISSION = 1000;
export const LAST_DAY = 100;

export type LocationKind = 'castle' | 'tower' | 'mine' | 'village' | 'mill' | 'chest' | 'gold' | 'patrol' | 'hideout' | 'signpost' | 'dig';

export type Enemy = {
  /** How the enemy is drawn on the map. */
  look: 'soldiers' | 'wolves' | 'stockade' | 'goblins' | 'troll';
  /** The button that starts the fight, if not just "Fight". */
  charge?: string;
  /** Other ways past them than a fight. */
  parleys?: Parley[];
  lines: string[];
  army: Army;
  reward: number;
  /** What they do when you ride up, how they lose, and where the gold was. */
  threat: string;
  flees: string;
  loot: string;
};

/** What an option asks of the hero: who he was, what he knows, or what he can spare (and then pays). */
export type Needs = { background?: BackgroundId; skill?: SkillId; spellPower?: number; gold?: number; troop?: TroopId; count?: number };

/** Another way past an enemy than a fight: talk, pay or trick. */
export type Parley = {
  id: string;
  label: string;
  needs: Needs;
  lines: string[];
  /** `pass`: they let you by and you gain nothing. `win`: it counts as beating them, for `reward` gold. */
  outcome: 'pass' | 'win';
  reward?: number;
  xp?: number;
};

export type Location = {
  id: string;
  kind: LocationKind;
  name: string;
  at: Point;
  /** One-off places are used up; the mill and recruiters reopen on payday. */
  done: boolean;
  gold?: number;
  recruits?: { troop: TroopId; count: number; price: number };
  enemy?: Enemy;
  /** A map point the visit reveals (the tower's journal points at the hideout). */
  reveals?: Point;
  /** Visited at least once, for the discovery experience. */
  seen?: boolean;
  /** What the place gives the first time: an artifact for the hero. */
  artifact?: ArtifactId;
  /** For sale here (the castle armoury). */
  wares?: ArtifactId[];
  /** This province's words for the place, instead of the usual ones for its kind. */
  text?: PlaceText;
  /** Which sprite stands for it, when not the usual one for its kind. */
  look?: PlaceLook;
};

/** Flavour for a place: before a visit, once it's used up, and on the visit itself. */
export type PlaceText = { about?: string[]; done?: string[]; visit?: string[] };
export type PlaceLook = 'abbey' | 'peathut' | 'windmill' | 'stilthut';

/** The campaign so far: which commission this is, how the others went, and how this one began. */
export type Campaign = {
  /** Index into the list of commissions, from 0. */
  chapter: number;
  /** Seeds the provinces generated after the hand-made ones, so each campaign gets its own. */
  seed?: number;
  record: { chapter: number; days: number; level: number }[];
  /** The hero, purse and army as this commission began, for trying it again. */
  start: { hero: Hero; gold: number; leadership: number; army: Army };
  /** At court between commissions: the boons on offer, and the one taken. */
  court?: { boons: BoonId[]; chosen?: BoonId };
};

export type BoonId = 'fencing' | 'armourer' | 'library' | 'astronomer' | 'warrant' | 'purse';

export type GameState = {
  day: number;
  gold: number;
  leadership: number;
  army: Army;
  movement: number;
  seed: number;
  locations: Location[];
  bounty: 'open' | 'paid';
  over?: 'won' | 'lost';
  hero: Hero;
  /** The province's size in pixels, for fog and anything else that needs the map's shape. */
  world: { width: number; height: number };
  explored: Explored;
  /** A battle in progress, so a save can be made mid-fight. */
  battle?: BattleState;
  campaign: Campaign;
  /** Set until the player picks a background on the opening card. */
  opening?: boolean;
};

/** Sir Aldric: where he is, who he was, and what he has learned. Derived numbers come from `heroStats`. */
export type Hero = {
  at: Point;
  facing: 1 | -1;
  background: BackgroundId;
  level: number;
  xp: number;
  /** Primary stats before skills and gear: the background's, plus level-ups. */
  attack: number;
  defence: number;
  spellPower: number;
  /** Ten mana per point of knowledge, refilled every morning. */
  knowledge: number;
  mana: number;
  spells: SpellId[];
  skills: Partial<Record<SkillId, number>>;
  perks: PerkId[];
  gear: Partial<Record<Slot, ArtifactId>>;
  pack: ArtifactId[];
  /** Level-ups still waiting for a choice. */
  offers: Offer[];
};

/** What the player can do from a card. `go` rides to a location and visits it on arrival. */
export type Action =
  | { type: 'go'; id: string }
  | { type: 'chest'; id: string; take: 'gold' | 'leadership' }
  | { type: 'recruit'; id: string }
  | { type: 'fight'; id: string }
  | { type: 'autofight'; id: string }
  | { type: 'endDay' }
  | { type: 'restart' }
  | { type: 'close' }
  /** Picked from the spellbook in battle: the screen then asks for a target. */
  | { type: 'spell'; spell: SpellId }
  /** Confirmed from the battle card: the army falls back. */
  | { type: 'retreat' }
  | { type: 'learn'; option: string }
  | { type: 'equip'; artifact: ArtifactId }
  | { type: 'gear' }
  | { type: 'armoury'; id: string }
  | { type: 'buy'; id: string; artifact: ArtifactId }
  | { type: 'background'; id: BackgroundId }
  /** Deals with an enemy some other way than a fight. */
  | { type: 'parley'; id: string; parley: string }
  /** Digs where the map's X is, at the end of the campaign. */
  | { type: 'dig'; id: string }
  /** After a won commission: ride to the King. */
  | { type: 'court' }
  | { type: 'boon'; id: BoonId }
  | { type: 'nextCommission' }
  /** After a lost commission: the same one again, from its start. */
  | { type: 'retry' };

/** A button on a card. A `disabled` one shows what the player could do with another hero, or more gold. */
export type Choice = { label: string; action: Action; disabled?: boolean };

/** A parchment card: a title, a few lines (with **bold** and *italics*), and choices. `wide` is for big decisions. */
export type Card = { title: string; lines: string[]; choices: Choice[]; wide?: boolean };

/** What happened, for the screens to show. The rules never draw anything themselves. */
export type GameEvent =
  /** A card to show, anchored over `place` if given, else over `at`, else centred. */
  | { type: 'card'; card: Card; at: Point | null; place?: string }
  | { type: 'reveal'; at: Point; radius: number }
  | { type: 'removed'; id: string }
  /** A new place appears on the map, like the X once the map is whole. */
  | { type: 'added'; id: string }
  | { type: 'moved'; at: Point; facing: 1 | -1 }
  | { type: 'day'; day: number; payday: boolean }
  | { type: 'battle'; place: string }
  | { type: 'levelUp'; level: number }
  | { type: 'over'; result: 'won' | 'lost' }
  /** The hero is at court: the screens show the throne room. */
  | { type: 'court' }
  /** A new commission has begun, maybe in a new province: the screens rebuild the map. */
  | { type: 'commission' };

export type Result = { state: GameState; events: GameEvent[] };

export const close: Choice = { label: 'Close', action: { type: 'close' } };
export const again: Choice = { label: 'Start a new campaign', action: { type: 'restart' } };

/** A card event anchored above a map point, or centred when `at` is null. */
export const show = (card: Card, at: Point | null = null, place?: string): GameEvent => ({ type: 'card', card, at, place });

/** Gold amounts as written on a card: 2,000 not 2000. */
export const coins = (n: number) => Math.round(n).toLocaleString('en-GB');

export function roman(n: number): string {
  const numerals: [number, string][] = [[100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [value, letters] of numerals) {
    while (n >= value) {
      out += letters;
      n -= value;
    }
  }
  return out;
}

export const armyPower = (army: Army) => army.reduce((sum, s) => sum + s.count * troopPower(s.troop), 0);
export const leadershipUsed = (army: Army) => army.reduce((sum, s) => sum + s.count * TROOPS[s.troop].leadership, 0);
export const wages = (army: Army) => army.reduce((sum, s) => sum + s.count * TROOPS[s.troop].wage, 0);
export const countOf = (army: Army, troop: TroopId) => army.find((s) => s.troop === troop)?.count ?? 0;

export function armyLine(army: Army): string {
  const parts = army.filter((s) => s.count > 0).map((s) => troops(s.troop, s.count));
  return parts.length ? parts.join(' · ') : 'No army at all';
}

/** Adds troops to the stack of the same kind, or a free slot. Null when all five slots are taken. */
export function addTroops(army: Army, troop: TroopId, count: number): Army | null {
  if (army.some((s) => s.troop === troop)) return army.map((s) => (s.troop === troop ? { ...s, count: s.count + count } : s));
  return army.length < MAX_STACKS ? [...army, { troop, count }] : null;
}

/** mulberry32, one step: returns a number in [0, 1) and the next seed. */
export function roll(seed: number): [number, number] {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

export function update(state: GameState, id: string, change: Partial<Location>): GameState {
  return { ...state, locations: state.locations.map((l) => (l.id === id ? { ...l, ...change } : l)) };
}

export const locationById = (state: GameState, id: string) => {
  const found = state.locations.find((l) => l.id === id);
  if (!found) throw new Error(`No location ${id}`);
  return found;
};

/** Objects that vanish from the map once their place is done. */
export const VANISHES = new Set<LocationKind>(['chest', 'gold', 'patrol']);
