/**
 * The hero's spells, and the statuses spells (and some troops) put on stacks. Everything a spell
 * or status does is written here as data; the battle engine and the AI read it, and never name a
 * spell themselves. Villains' spellbooks draw from here too.
 *
 * Every spell has a circle, I to III. Anyone can learn the first; the second needs Basic Wisdom and
 * the third Advanced Wisdom, but a wizard reads them all (`circle` in a `Bonus`).
 */
export type SpellId = 'bolt' | 'bless' | 'slow' | 'haste' | 'fireball' | 'stoneskin' | 'rust' | 'fury' | 'quagmire' | 'bulwark' | 'thunderclap' | 'meteor' | 'heroism' | 'wither';

/** How hard a spell is to learn: I, II or III. */
export type Circle = 1 | 2 | 3;
export const CIRCLES = ['I', 'II', 'III'] as const;

/** Spells for the adventure map, cast from the hero screen. */
export type MapSpellId = 'farsight' | 'swiftroad' | 'dowsing' | 'scry' | 'recall';

/** What a map spell does, read by `rules/mapSpells.ts`. */
export type MapEffect =
  /** The mist rolls back this far around the hero. */
  | { kind: 'reveal'; radius: number }
  /** More movement today. */
  | { kind: 'movement'; amount: number }
  /** The mist lifts over every treasure in the province not yet found. */
  | { kind: 'treasure'; radius: number }
  /** The villain's lair shows through the mist, with everyone in it counted. */
  | { kind: 'scry'; radius: number }
  /** He and his army step through the air to the nearest castle; that's the day's riding done. */
  | { kind: 'recall' };

export type MapSpellDef = { id: MapSpellId; name: string; circle: Circle; mana: number; note: string; effect: MapEffect };

export const MAP_SPELLS: Record<MapSpellId, MapSpellDef> = {
  farsight: { id: 'farsight', name: 'Far Sight', circle: 1, mana: 10, note: 'The mist rolls back for a long way around you.', effect: { kind: 'reveal', radius: 340 } },
  swiftroad: { id: 'swiftroad', name: 'Swift Road', circle: 1, mana: 8, note: 'The road shortens under your feet: +50 movement today.', effect: { kind: 'movement', amount: 50 } },
  dowsing: { id: 'dowsing', name: 'Dowsing', circle: 1, mana: 6, note: 'Your hazel twig twitches: every chest, pile of gold and old stash in the province shows through the mist.', effect: { kind: 'treasure', radius: 36 } },
  scry: { id: 'scry', name: 'Scry', circle: 2, mana: 12, note: 'In a bowl of water: the villain\u2019s lair, wherever it is, and everyone in it, counted.', effect: { kind: 'scry', radius: 90 } },
  recall: { id: 'recall', name: 'Recall', circle: 3, mana: 20, note: 'You and your army step through a shimmer in the air to the nearest castle. That\u2019s the day\u2019s riding done.', effect: { kind: 'recall' } },
};

/** Lasting effects on a stack. Each one changes numbers the engine already uses. */
export type StatusId = 'blessed' | 'slowed' | 'hasted' | 'stoneskin' | 'rusted' | 'fury' | 'mired' | 'bulwark' | 'heroic' | 'withered';

export type StatusDef = {
  name: string;
  /** The stack always rolls its best damage. */
  bestDamage?: boolean;
  /** Hexes added to speed, then a multiplier (rounded up). */
  speedAdd?: number;
  speedTimes?: number;
  /** Defence added while it lasts. */
  defenceAdd?: number;
};

export const STATUSES: Record<StatusId, StatusDef> = {
  blessed: { name: 'Blessed', bestDamage: true },
  slowed: { name: 'Slowed', speedTimes: 0.5 },
  hasted: { name: 'Hasted', speedAdd: 2 },
  stoneskin: { name: 'Stone Skin', defenceAdd: 3 },
  rusted: { name: 'Rusted', defenceAdd: -3 },
  fury: { name: 'Fury', bestDamage: true, speedAdd: 2, defenceAdd: -4 },
  mired: { name: 'Mired', speedTimes: 0.5, defenceAdd: -2 },
  bulwark: { name: 'Bulwark', defenceAdd: 6, speedAdd: -1 },
  heroic: { name: 'Heroic', bestDamage: true, defenceAdd: 4, speedAdd: 1 },
  withered: { name: 'Withered', defenceAdd: -6, speedTimes: 0.75 },
};

/** What casting a spell does to its target. */
export type SpellEffect =
  /** Damage: this much for every point of the hero's spell power. */
  | { kind: 'damage'; perPower: number }
  /** A status on the target, for the rest of the battle. */
  | { kind: 'status'; status: StatusId }
  /** Damage like `damage`, to the target and to every stack standing next to it, friend or foe. */
  | { kind: 'burst'; perPower: number };

export type SpellDef = {
  id: SpellId;
  name: string;
  circle: Circle;
  mana: number;
  on: 'enemy' | 'friend';
  note: string;
  effect: SpellEffect;
  /** How it looks and sounds: a bolt from the sky, a ball of fire, or a sparkle in a colour. */
  look: { kind: 'bolt' | 'fire' | 'sparkle'; colour: 'gold' | 'blue' | 'red' };
};

export const SPELLS: Record<SpellId, SpellDef> = {
  bolt: { id: 'bolt', name: 'Lightning Bolt', circle: 1, mana: 7, on: 'enemy', note: 'Twenty damage for every point of spell power.', effect: { kind: 'damage', perPower: 20 }, look: { kind: 'bolt', colour: 'gold' } },
  bless: { id: 'bless', name: 'Bless', circle: 1, mana: 5, on: 'friend', note: 'The stack always rolls its best damage, for the rest of the battle.', effect: { kind: 'status', status: 'blessed' }, look: { kind: 'sparkle', colour: 'gold' } },
  slow: { id: 'slow', name: 'Slow', circle: 1, mana: 5, on: 'enemy', note: 'Halves the stack\u2019s speed, for the rest of the battle.', effect: { kind: 'status', status: 'slowed' }, look: { kind: 'sparkle', colour: 'blue' } },
  haste: { id: 'haste', name: 'Haste', circle: 1, mana: 5, on: 'friend', note: '+2 speed for the stack, for the rest of the battle.', effect: { kind: 'status', status: 'hasted' }, look: { kind: 'sparkle', colour: 'gold' } },
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    circle: 1,
    mana: 9,
    on: 'enemy',
    note: 'Twelve damage for every point of spell power, to the stack and to everyone next to it. Mind your own men.',
    effect: { kind: 'burst', perPower: 12 },
    look: { kind: 'fire', colour: 'red' },
  },
  stoneskin: { id: 'stoneskin', name: 'Stone Skin', circle: 1, mana: 5, on: 'friend', note: '+3 defence for the stack, for the rest of the battle.', effect: { kind: 'status', status: 'stoneskin' }, look: { kind: 'sparkle', colour: 'blue' } },
  rust: { id: 'rust', name: 'Rust', circle: 1, mana: 5, on: 'enemy', note: 'Their armour goes orange and flaky: \u22123 defence, for the rest of the battle. Everyone hits them harder.', effect: { kind: 'status', status: 'rusted' }, look: { kind: 'sparkle', colour: 'red' } },
  fury: {
    id: 'fury',
    name: 'Fury',
    circle: 2,
    mana: 8,
    on: 'friend',
    note: 'They see red: best damage every blow and +2 speed, but \u22124 defence, for the rest of the battle. Bless and Haste in one cast, at a price.',
    effect: { kind: 'status', status: 'fury' },
    look: { kind: 'sparkle', colour: 'red' },
  },
  quagmire: { id: 'quagmire', name: 'Quagmire', circle: 2, mana: 8, on: 'enemy', note: 'The ground turns to porridge under them: half speed and \u22122 defence, for the rest of the battle.', effect: { kind: 'status', status: 'mired' }, look: { kind: 'sparkle', colour: 'blue' } },
  bulwark: { id: 'bulwark', name: 'Bulwark', circle: 2, mana: 7, on: 'friend', note: 'They dig in: +6 defence, but \u22121 speed, for the rest of the battle. Good for archers who aren\u2019t going anywhere.', effect: { kind: 'status', status: 'bulwark' }, look: { kind: 'sparkle', colour: 'blue' } },
  thunderclap: { id: 'thunderclap', name: 'Thunderclap', circle: 2, mana: 11, on: 'enemy', note: 'Thirty-two damage for every point of spell power: a bolt you hear in the next province.', effect: { kind: 'damage', perPower: 32 }, look: { kind: 'bolt', colour: 'blue' } },
  meteor: {
    id: 'meteor',
    name: 'Meteor Shower',
    circle: 3,
    mana: 15,
    on: 'enemy',
    note: 'Twenty damage for every point of spell power, to the stack and everyone next to it. Mind your own men twice.',
    effect: { kind: 'burst', perPower: 20 },
    look: { kind: 'fire', colour: 'gold' },
  },
  heroism: { id: 'heroism', name: 'Heroism', circle: 3, mana: 12, on: 'friend', note: 'Best damage every blow, +4 defence and +1 speed, for the rest of the battle. Songs will be written.', effect: { kind: 'status', status: 'heroic' }, look: { kind: 'sparkle', colour: 'gold' } },
  wither: { id: 'wither', name: 'Wither', circle: 3, mana: 12, on: 'enemy', note: 'Their armour rots and their knees go: \u22126 defence and a quarter slower, for the rest of the battle.', effect: { kind: 'status', status: 'withered' }, look: { kind: 'sparkle', colour: 'red' } },
};

/** A spell of either kind, by id: what it's called, its circle, its mana and its note. */
export type AnySpellId = SpellId | MapSpellId;
export const isMapSpell = (id: AnySpellId): id is MapSpellId => id in MAP_SPELLS;
export const anySpell = (id: AnySpellId): { name: string; circle: Circle; mana: number; note: string } => (isMapSpell(id) ? MAP_SPELLS[id] : SPELLS[id]);
