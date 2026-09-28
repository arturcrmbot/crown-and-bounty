/**
 * The hero's spells, and the statuses spells (and some troops) put on stacks. Everything a spell
 * or status does is written here as data; the battle engine and the AI read it, and never name a
 * spell themselves.
 */
export type SpellId = 'bolt' | 'bless' | 'slow' | 'haste' | 'fireball' | 'stoneskin';

/** Spells for the adventure map, cast from the hero's card. */
export type MapSpellId = 'farsight';
export const MAP_SPELLS: Record<MapSpellId, { id: MapSpellId; name: string; mana: number; note: string; radius: number }> = {
  farsight: { id: 'farsight', name: 'Far Sight', mana: 10, note: 'The mist rolls back for a long way around you.', radius: 340 },
};

/** Lasting effects on a stack. Each one changes numbers the engine already uses. */
export type StatusId = 'blessed' | 'slowed' | 'hasted' | 'stoneskin';

export type StatusDef = {
  name: string;
  /** The stack always rolls its best damage. */
  bestDamage?: boolean;
  /** Hexes added to speed, then a multiplier (rounded up). */
  speedAdd?: number;
  speedTimes?: number;
  /** Defence added while it lasts. */
  defenceAdd?: number;
  /** Attack added while it lasts (a curse takes it away). */
  attackAdd?: number;
  /** The stack always rolls its worst damage (a curse). With `bestDamage` too, the two cancel out. */
  worstDamage?: boolean;
  /** Damage it takes from shots is multiplied by this (a shield against arrows: 0.5). */
  rangedTaken?: number;
};

export const STATUSES: Record<StatusId, StatusDef> = {
  blessed: { name: 'Blessed', bestDamage: true },
  slowed: { name: 'Slowed', speedTimes: 0.5 },
  hasted: { name: 'Hasted', speedAdd: 2 },
  stoneskin: { name: 'Stone Skin', defenceAdd: 3 },
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
  mana: number;
  on: 'enemy' | 'friend';
  note: string;
  effect: SpellEffect;
  /** How it looks and sounds: a bolt from the sky, a ball of fire, or a sparkle in a colour. */
  look: { kind: 'bolt' | 'fire' | 'sparkle'; colour: 'gold' | 'blue' | 'red' };
};

export const SPELLS: Record<SpellId, SpellDef> = {
  bolt: { id: 'bolt', name: 'Lightning Bolt', mana: 7, on: 'enemy', note: 'Twenty damage for every point of spell power.', effect: { kind: 'damage', perPower: 20 }, look: { kind: 'bolt', colour: 'gold' } },
  bless: { id: 'bless', name: 'Bless', mana: 5, on: 'friend', note: 'The stack always rolls its best damage, for the rest of the battle.', effect: { kind: 'status', status: 'blessed' }, look: { kind: 'sparkle', colour: 'gold' } },
  slow: { id: 'slow', name: 'Slow', mana: 5, on: 'enemy', note: 'Halves the stack\u2019s speed, for the rest of the battle.', effect: { kind: 'status', status: 'slowed' }, look: { kind: 'sparkle', colour: 'blue' } },
  haste: { id: 'haste', name: 'Haste', mana: 5, on: 'friend', note: '+2 speed for the stack, for the rest of the battle.', effect: { kind: 'status', status: 'hasted' }, look: { kind: 'sparkle', colour: 'gold' } },
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    mana: 9,
    on: 'enemy',
    note: 'Twelve damage for every point of spell power, to the stack and to everyone next to it. Mind your own men.',
    effect: { kind: 'burst', perPower: 12 },
    look: { kind: 'fire', colour: 'red' },
  },
  stoneskin: { id: 'stoneskin', name: 'Stone Skin', mana: 5, on: 'friend', note: '+3 defence for the stack, for the rest of the battle.', effect: { kind: 'status', status: 'stoneskin' }, look: { kind: 'sparkle', colour: 'blue' } },
};
