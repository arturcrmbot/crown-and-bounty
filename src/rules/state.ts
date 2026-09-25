/** Pure game rules: no DOM, no timers. Every change returns a new state plus events, and dice come from `seed`. */
import type { Explored } from './map/fog';
import type { Point } from './map/geometry';

export type { Point };

export type Troop = 'peasants' | 'archers' | 'knights';
export type Army = Record<Troop, number>;

export const TROOPS: Record<Troop, { name: string; leadership: number; power: number; wage: number }> = {
  peasants: { name: 'Peasants', leadership: 1, power: 1, wage: 1 },
  archers: { name: 'Archers', leadership: 2, power: 3, wage: 3 },
  knights: { name: 'Knights', leadership: 5, power: 8, wage: 8 },
};

/** Weakest first: the order in which a battle's losses fall. */
export const LOSS_ORDER: Troop[] = ['peasants', 'archers', 'knights'];

export const MOVEMENT_PER_DAY = 150;
export const PAYDAY_EVERY = 7;
export const COMMISSION = 1000;
export const LAST_DAY = 100;

export type LocationKind = 'castle' | 'tower' | 'mine' | 'village' | 'mill' | 'chest' | 'gold' | 'patrol' | 'hideout' | 'signpost';

export type Enemy = {
  /** How the enemy is drawn on the map. */
  look: 'soldiers' | 'wolves' | 'stockade';
  lines: string[];
  power: number;
  reward: number;
  /** What they do when you ride up, how they lose, and where the gold was. */
  threat: string;
  flees: string;
  loot: string;
};

export type Location = {
  id: string;
  kind: LocationKind;
  name: string;
  at: Point;
  /** One-off places are used up; the mill and recruiters reopen on payday. */
  done: boolean;
  gold?: number;
  recruits?: { troop: Troop; count: number; price: number };
  enemy?: Enemy;
  /** A map point the visit reveals (the tower's journal points at the hideout). */
  reveals?: Point;
};

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
  hero: { at: Point; facing: 1 | -1 };
  explored: Explored;
};

/** What the player can do from a card. `go` rides to a location and visits it on arrival. */
export type Action =
  | { type: 'go'; id: string }
  | { type: 'chest'; id: string; take: 'gold' | 'leadership' }
  | { type: 'recruit'; id: string }
  | { type: 'fight'; id: string }
  | { type: 'endDay' }
  | { type: 'restart' }
  | { type: 'close' };

export type Choice = { label: string; action: Action };

/** A parchment card: a title, a few lines (with **bold** and *italics*), and choices. */
export type Card = { title: string; lines: string[]; choices: Choice[] };

/** What happened, for the screens to show. The rules never draw anything themselves. */
export type GameEvent =
  | { type: 'card'; card: Card; at: Point | null }
  | { type: 'reveal'; at: Point; radius: number }
  | { type: 'removed'; id: string }
  | { type: 'moved'; at: Point; facing: 1 | -1 }
  | { type: 'day'; day: number; payday: boolean }
  | { type: 'over'; result: 'won' | 'lost' };

export type Result = { state: GameState; events: GameEvent[] };

export const close: Choice = { label: 'Close', action: { type: 'close' } };
export const again: Choice = { label: 'Ride again', action: { type: 'restart' } };

/** A card event anchored above a map point, or centred when `at` is null. */
export const show = (card: Card, at: Point | null = null): GameEvent => ({ type: 'card', card, at });

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

export const armyPower = (army: Army) => LOSS_ORDER.reduce((sum, t) => sum + army[t] * TROOPS[t].power, 0);
export const leadershipUsed = (army: Army) => LOSS_ORDER.reduce((sum, t) => sum + army[t] * TROOPS[t].leadership, 0);
export const wages = (army: Army) => LOSS_ORDER.reduce((sum, t) => sum + army[t] * TROOPS[t].wage, 0);

export function armyLine(army: Army): string {
  const parts = (['knights', 'archers', 'peasants'] as Troop[]).filter((t) => army[t] > 0).map((t) => `${army[t]} ${TROOPS[t].name}`);
  return parts.length ? parts.join(' · ') : 'No army at all';
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
