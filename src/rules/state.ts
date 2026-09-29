/** Pure game rules: no DOM, no timers. Every change returns a new state plus events, and dice come from `seed`. */
import type { ArtifactId, Slot } from '../content/artifacts';
import type { BackgroundId } from '../content/backgrounds';
import type { FriendId } from '../content/friends';
import type { PortraitId } from '../content/portraits';
import type { PerkId, SkillId } from '../content/skills';
import type { MapSpellId, SpellId, StatusId } from '../content/spells';
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

export type LocationKind = 'castle' | 'tower' | 'mine' | 'village' | 'mill' | 'chest' | 'gold' | 'patrol' | 'hideout' | 'signpost' | 'dig' | 'event' | 'well';

export type Enemy = {
  /** How the enemy is drawn on the map. */
  look: 'soldiers' | 'wolves' | 'stockade' | 'goblins' | 'troll';
  /** The button that starts the fight, if not just "Fight". */
  charge?: string;
  /** Other ways past them than a fight: talk, pay or trick. */
  parleys?: ContentChoice[];
  /** What else beating them brings, however it's done: new recruits, a spell, a place appears. */
  spoils?: Effects;
  /** Story flags its leader's capture sets, however he's taken: his band beaten, or won over from under him. */
  taken?: Record<string, FlagValue>;
  /** How hard they are meant to be, for the balance checks: see `rules/difficulty.ts`. */
  tier?: Tier;
  /**
   * What they do at night. `guard` holds its ground (the default). `roam` wanders within `range` of
   * `home`. `hunt` roams too, but comes for a weaker hero who strays into its territory.
   */
  behaviour?: 'guard' | 'roam' | 'hunt';
  range?: number;
  home?: Point;
  /** A band that holds its ground until `day`, then roams or hunts as `behaviour` says: that dawn, the news says so. */
  wakes?: { day: number; news: string };
  /** How far off a hunter notices the hero, when it has keener eyes (or better spies) than most (`HUNT_SIGHT`). */
  sight?: number;
  /** A hunter that comes for the hero whatever the odds: a villain in a temper. */
  bold?: boolean;
  /** Movement points it has in a night, when it rides instead of walking at its slowest troop's pace. */
  pace?: number;
  /** A share more troops every payday, up to five times: a villain recruiting while you dawdle. */
  grows?: number;
  grown?: number;
  /** Nights left before a hunter that has fallen on the camp hunts again. */
  rest?: number;
  /** A hunter on the hero's trail since dawn: if he's still in reach tonight, it falls on his camp. */
  trailing?: boolean;
  /** A villain who rides out of his lair to meet the hero when he's hurt: see `Sortie`. */
  sortie?: Sortie;
  /** The hurts (story flags) he has already ridden out over. */
  answered?: string[];
  /** Beaten in the open once, he stays behind his walls. */
  humbled?: boolean;
  /**
   * A villain's band out of its lair (the lair's id): beaten, he flees home there; once it can't
   * find the hero, or its `patience` (nights) runs out, it rides home and goes back in.
   */
  lair?: string;
  patience?: number;
  /** A convoy on a road, as Pike's grain cart is: see `Convoy`. */
  convoy?: Convoy;
  lines: string[];
  army: Army;
  reward: number;
  /** What its leader, a villain or a captain, says as his army is beaten: the fight stops on it. */
  lastWords?: string;
  /** What the card says when a hero with a way with beasts wins them over, instead of each beast's usual words. */
  tamed?: string;
  /** What they do when you ride up, how they lose, and where the gold was. */
  threat: string;
  flees: string;
  loot: string;
};

export type FlagValue = boolean | number | string;

/**
 * A convoy on a road (Pike's grain cart). Every payday, while the enemy it comes from (`from`, by id)
 * still holds, a share of that enemy's troops sets out with it from the first of `route`'s points, as
 * its escort, and the payday card says so (`leaves`). It keeps to the road, `pace` pixels a night,
 * through its own people and stopping short of the hero. At the road's end it's gone, and its escort
 * goes back to `from`, until next payday. Caught on the road, its escort never goes back.
 */
export type Convoy = { from: string; share: number; route: Point[]; pace: number; leaves: string };

/**
 * A villain who rides out of his lair to meet the hero when he's hurt: the night any of the story
 * flags in `when` is set (to `is`, if it says), once the hero is where his band would come for him.
 * A share of each of his troops (`guard`) rides with him, and the rest hold the walls, which open to
 * nobody while he's out (`barred`). His band (`band`) sets out from its place at the lair's gate and
 * comes for the hero, whatever the odds. Beat it, and he flees home without it, and stays there;
 * lose him, and he rides home with it, until he's hurt again.
 */
export type Sortie = {
  when: { flag: string; is?: FlagValue }[];
  guard: number;
  band: Location;
  /** What the lair's card says while he's out. */
  barred: string[];
  /** The dawn's news: he has ridden out, and he has given up and gone home. */
  out: string;
  home: string;
};

/**
 * How hard an enemy is meant to be: a `pest` is an easy first fight, a `band` a fair one, a `gate`
 * too strong at first (explore, grow, come back), and a `boss` needs the whole loop.
 */
export type Tier = 'pest' | 'band' | 'gate' | 'boss';

/**
 * What a choice asks of the hero. Who he was, what he knows, what he carries and what has happened
 * are checked; gold, troops and mana are checked and then paid.
 */
export type Needs = {
  background?: BackgroundId;
  skill?: SkillId;
  spellPower?: number;
  level?: number;
  artifact?: ArtifactId;
  /** Something he must not have yet (so a find doesn't hand him a second one). */
  notArtifact?: ArtifactId;
  /** A story flag that must be set, or must not be. */
  flag?: string;
  notFlag?: string;
  /** A place (by id) the hero must have been to. */
  seen?: string;
  gold?: number;
  troop?: TroopId;
  count?: number;
  mana?: number;
  /** A spell the hero must not know yet (so a teacher doesn't teach it twice). */
  notSpell?: SpellId;
};

/** What a choice does, all of it optional, applied in this order. */
export type Effects = {
  gold?: number;
  /** Gold found lying about, which a hero with a knack for treasure finds more of. */
  treasure?: number;
  leadership?: number;
  movement?: number;
  mana?: number;
  /** Primary stats, for good. */
  stats?: Partial<Record<'attack' | 'defence' | 'spellPower' | 'knowledge', number>>;
  artifact?: ArtifactId;
  spell?: SpellId;
  /** Troops that join, as many as leadership and free slots allow. */
  troops?: Army;
  flags?: Record<string, FlagValue>;
  reveal?: { at: Point; radius: number };
  xp?: number;
  /** The place is used up (and gone from the map, if its kind vanishes). */
  done?: boolean;
  /** It counts as beating the place's enemy: its artifact and, at a hideout, the bounty. */
  win?: boolean;
  /** The page of this place to show next, instead of closing. */
  page?: string;
  /** A new place appears on the map: a camp of deserters, a hidden grove. */
  place?: Location;
  /** A share of this place's enemy marches off to join another's (by id): the road clears, the villain grows. */
  reinforce?: { id: string; share: number };
  /** A share of this place's enemy (or of one troop in it) slips away: someone has talked them out of it. */
  desert?: { troop?: TroopId; share: number };
  /** The hero goes there by a way of his own, a tunnel or a punt, and that is the day's riding done. */
  travel?: Point;
  /** Weeks of rations into the baggage (or out of it): each feeds the troops one payday instead of their wages. */
  rations?: number;
  /**
   * Volunteers at a place: this one, or the one `at` names. More of the troop it offers already,
   * or a new offer of `troop` at `price` (free if none), with `restock` more every payday (the usual if none).
   */
  recruits?: { at?: string; troop?: TroopId; count: number; price?: number; restock?: number };
};

/**
 * A choice written as content: a button, what it needs, what it does, and what the card then says.
 * One the hero can't take shows greyed out, naming only what he lacks; when that's a story need (a
 * song he hasn't learned yet), it says its quiet `hint`, if it has one. One whose `when` doesn't
 * hold isn't there at all (a question to ask only once there's something to ask about). One that
 * takes a villain for a price other than the poster's says `because` why, for the poster that comes
 * back stamped PAID: "the other half went on the Baron's lunch".
 */
export type ContentChoice = { id: string; label: string; when?: Needs; needs?: Needs; hint?: string; effects?: Effects; lines?: string[]; because?: string };

/**
 * A card written as content. A visit shows the first page whose `when` holds; an `answer` page is
 * never shown on arrival, only when a choice leads to it.
 */
export type Page = { id: string; when?: Needs; answer?: boolean; title?: string; lines: string[]; choices: ContentChoice[] };

export type Location = {
  id: string;
  kind: LocationKind;
  name: string;
  at: Point;
  /** One-off places are used up; the mill and recruiters reopen on payday. */
  done: boolean;
  gold?: number;
  /** Troops to recruit, and how many more come every payday (`RESTOCK` in places/dwelling.ts unless said). */
  recruits?: { troop: TroopId; count: number; price: number; restock?: number };
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
  /** Cards written as content: an event's whole story, or extra pages for any place. */
  pages?: Page[];
};

/**
 * Flavour for a place: before a visit, once it's used up, and on the visit itself. `later` is what
 * it says from afar once something has happened there, instead of `about`: the first whose `when`
 * holds (the old delving, once the dwarf has opened it).
 */
export type PlaceText = { about?: string[]; done?: string[]; visit?: string[]; later?: { when: Needs; about: string[] }[] };
export type PlaceLook = 'abbey' | 'peathut' | 'windmill' | 'stilthut' | 'shrine' | 'camp' | 'cottage' | 'house' | 'stones' | 'range' | 'hall' | 'lodge' | 'cart' | 'mews';

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

/** The King's own boons; the others are people from the commission who would ride on with Aldric (`FRIENDS`). */
export type KingsBoonId = 'fencing' | 'armourer' | 'library' | 'astronomer' | 'warrant' | 'purse';
export type BoonId = KingsBoonId | FriendId;

export type GameState = {
  day: number;
  gold: number;
  leadership: number;
  army: Army;
  movement: number;
  seed: number;
  locations: Location[];
  bounty: 'open' | 'paid';
  /** What the Crown paid for the villain, and why, if not the poster's price. */
  paid?: { gold: number; because?: string };
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
  /** What has happened in the story: quests started, favours owed, promises made. */
  flags?: Record<string, FlagValue>;
  /** An enemy that fell on the hero's camp at dawn: fight it, or flee, before anything else. */
  ambush?: string;
  /** Weeks of rations in the baggage (Westmere's grain, caught on the road): each feeds the troops one payday instead of their wages. */
  rations?: number;
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
  /** People who ride with him, taken as boons at court: for the rest of the campaign. */
  friends?: FriendId[];
};

/** What the player can do from a card. `go` rides to a location and visits it on arrival. */
export type Action =
  | { type: 'go'; id: string }
  /** Records that a first-time map hint has been shown. */
  | { type: 'hint'; id: 'ride' | 'place' | 'payday' }
  /** A choice on a place's card: one of its kind's own (`recruit`, `fight`...) or written as content (`page/choice`). */
  | { type: 'choose'; id: string; choice: string }
  | { type: 'endDay' }
  | { type: 'restart' }
  | { type: 'close' }
  /** Picked from the spellbook in battle: the screen then asks for a target. */
  | { type: 'spell'; spell: SpellId }
  /** Confirmed from the battle card: the army falls back. */
  | { type: 'retreat' }
  /** A bard's move on a stack, picked from its battle card: pay it to go (`bribe`), to change sides (`buy`), or jeer it. */
  | { type: 'bard'; move: 'bribe' | 'buy' | 'jeer'; target: number }
  /** The song a bard picked to sing over his army. */
  | { type: 'sing'; song: StatusId }
  | { type: 'learn'; option: string }
  | { type: 'equip'; artifact: ArtifactId }
  /** Wears the artifact in pack square `from`; whatever its slot held takes that square. */
  | { type: 'wear'; from: number; slot?: Slot }
  /** Takes off what's worn in `slot`, into pack square `to` (or the end). */
  | { type: 'unequip'; slot: Slot; to?: number }
  /** Moves an artifact between pack squares: onto another, the two swap. */
  | { type: 'movePack'; from: number; to: number }
  /** Moves a stack along the army line, which sets its row in battle: onto another, the two swap. */
  | { type: 'moveStack'; from: number; to: number }
  /** Sends a stack home. The last one stays. */
  | { type: 'dismiss'; index: number }
  | { type: 'background'; id: BackgroundId }
  | { type: 'mapSpell'; spell: MapSpellId }
  /** Puts up the WANTED poster, stamped PAID once the bounty is. */
  | { type: 'poster' }
  /** After a won commission: ride to the King. */
  | { type: 'court' }
  | { type: 'boon'; id: BoonId }
  | { type: 'nextCommission' }
  /** After a lost commission: the same one again, from its start. */
  | { type: 'retry' };

/** A button on a card. A `disabled` one shows what the player could do with another hero, or more gold. */
/** A button on a card. `detail` is a smaller line under the label (with **bold** and *italics*); `portrait` puts a face beside it. */
export type Choice = { label: string; action: Action; disabled?: boolean; portrait?: PortraitId; detail?: string };

/**
 * A battle's losses and mana spent, for the result card: at its top, or after its first `after`
 * lines (on a villain's card, once he's taken, before the bribes and the spoils). `sergeantsSpent`
 * is how much of the mana the sergeants spent, casting for him while they had command.
 */
export type BattleResultCard = { player: Army; enemy: Army; manaSpent: number; manaAvailable: number; sergeantsSpent?: number; after?: number };

/**
 * A parchment card with a title, lines (with **bold** and *italics*), and choices. `wide` is for big
 * decisions. `portrait` puts a face at its top left; `poster` makes it a WANTED poster, which a
 * `stamp` slams across ("PAID") and an `inset` finishes with a picture and its line (the goose, home);
 * `tiles` lays the choices side by side, each with its face, for picking a hero.
 */
export type Card = {
  title: string;
  lines: string[];
  choices: Choice[];
  wide?: boolean;
  portrait?: PortraitId;
  poster?: boolean;
  stamp?: string;
  inset?: { portrait: PortraitId; line: string };
  tiles?: boolean;
  battleResult?: BattleResultCard;
};

/** What happened, for the screens to show. The rules never draw anything themselves. */
export type GameEvent =
  /** A card to show, anchored over `place` if given, else over `at`, else centred. */
  | { type: 'card'; card: Card; at: Point | null; place?: string }
  | { type: 'reveal'; at: Point; radius: number }
  | { type: 'removed'; id: string }
  /** A new place appears on the map, like the X once the map is whole. */
  | { type: 'added'; id: string }
  /** A place looks different now: the old King's hunt hall, opened. */
  | { type: 'changed'; id: string }
  | { type: 'moved'; at: Point; facing: 1 | -1 }
  /** An enemy stack moved in the night, from where it stood along these points. */
  | { type: 'enemyMoved'; id: string; from: Point; path: Point[] }
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

/** A list in words: "3 Knights", "3 Knights and 2 Archers", "3 Knights, 2 Archers and 1 Swordsman". */
export const listed = (items: readonly string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : (items[0] ?? ''));

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

/** Who is still with the hero after a retreat, a flight or a stand-off. */
export const stillWithYou = (army: Army) => (army.some((s) => s.count > 0) ? `*Still with you: ${armyLine(army)}.*` : '*Nobody is left with you.*');

/** "**10 Peasants** join your army.", or "**1 Knight** joins" it. */
export const joinLine = (troop: TroopId, count: number) => `**${troops(troop, count)}** ${count === 1 ? 'joins' : 'join'} your army.`;

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
