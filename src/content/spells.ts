import type { TroopId } from './troops';
/**
 * The hero's spells, and the statuses spells (and some troops) put on stacks. Everything a spell
 * or status does is written here as data; the battle engine and the AI read it, and never name a
 * spell themselves.
 */
export type SpellId = 'bolt' | 'bless' | 'slow' | 'haste' | 'fireball' | 'stoneskin' | OrderId | 'newts' | 'frogs' | 'brew';
/** A villain's orders to his men: shouted, not cast, so they cost no mana, only a few uses a battle (see `charges`). */
export type OrderId = 'shieldwall' | 'crossbows' | 'guard';

/** Spells for the adventure map, cast from the hero's card. */
export type MapSpellId = 'farsight';
export const MAP_SPELLS: Record<MapSpellId, { id: MapSpellId; name: string; mana: number; note: string; radius: number }> = {
  farsight: { id: 'farsight', name: 'Far Sight', mana: 10, note: 'The mist rolls back for a long way around you.', radius: 340 },
};

/** Lasting effects on a stack. Each one changes numbers the engine already uses. */
export type StatusId = 'blessed' | 'slowed' | 'hasted' | 'stoneskin' | 'shieldwall' | 'newts' | 'frogs' | 'poisoned' | 'jeered' | 'heartened' | 'charmed' | 'marked' | 'winded' | 'webbed';

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
  /** It wears off after this many rounds (the one it began in counts); otherwise it lasts the battle. */
  rounds?: number;
  /** The stack loses its next turn, and then it wears off. */
  skipsTurn?: boolean;
  /** The stack can't strike back while it lasts. */
  noStrikeBack?: boolean;
  /** A caster under it can't cast. */
  silences?: boolean;
  /** Drawn as this creature while it lasts. */
  look?: 'newt' | 'frog';
  /** At the start of the stack's turn, its top troop loses this share of its health (never past a sliver). */
  hurtsTopOnTurn?: number;
  /**
   * Added to the stack's morale while it lasts: above nought, the chance it goes again before the
   * round moves on; below, the chance it loses heart, and its turn, as the turn comes.
   */
  morale?: number;
  /** Added to the chance its blows land lucky, twice as hard, while it lasts. */
  luck?: number;
  /** A bard's song that puts it on every stack of his side: what he sings ("a marching song"). */
  song?: string;
  /** What the log says when a blow puts this status on a stack. */
  onHit?: string;
};

export const STATUSES: Record<StatusId, StatusDef> = {
  blessed: { name: 'Blessed', bestDamage: true },
  // Two rounds, not the whole battle (#238): slowed for good, a band that fights as one stack never reached the archers.
  slowed: { name: 'Slowed', speedTimes: 0.5, rounds: 2, onHit: 'The hex slows them down.' },
  hasted: { name: 'Hasted', speedAdd: 2 },
  stoneskin: { name: 'Stone Skin', defenceAdd: 3 },
  shieldwall: { name: 'Shield Wall', defenceAdd: 3, rounds: 2 },
  // A charge's price: whoever just rode one home can't strike back for the rest of that round and the next.
  winded: { name: 'Winded', noStrikeBack: true, rounds: 2 },
  newts: { name: 'Newts', skipsTurn: true, noStrikeBack: true, silences: true, look: 'newt' },
  frogs: { name: 'Frogs', skipsTurn: true, noStrikeBack: true, silences: true, look: 'frog' },
  poisoned: { name: 'Poisoned', hurtsTopOnTurn: 0.1, onHit: 'The bite leaves them poisoned.' },
  // A bard's work: a jeer that saps a stack's spirit, and songs that lift his own.
  jeered: { name: 'Jeered', morale: -0.3, rounds: 2 },
  heartened: { name: 'Heartened', morale: 0.25, rounds: 2, song: 'a marching song' },
  charmed: { name: 'Charmed', luck: 0.2, rounds: 2, song: 'a lucky song' },
  // A huntsman's arrow picks out the quarry, and the pack knows where to bite.
  marked: { name: 'Marked', defenceAdd: -3, rounds: 2, onHit: 'The arrow marks them for the pack.' },
  // A giant spider's web: no speed at all for the rest of the round it bit in and the next, so no move, though it can still strike or shoot.
  webbed: { name: 'Webbed', speedTimes: 0, rounds: 2, onHit: 'The web holds them fast.' },
};

/** What casting a spell does. `on` says whose stacks: the caster's own side (`friend`) or the other. */
export type SpellEffect =
  /** Damage: this much for every point of the caster's spell power. */
  | { kind: 'damage'; perPower: number }
  /** A status on the target (see its `rounds` for how long). */
  | { kind: 'status'; status: StatusId }
  /** Damage like `damage`, to the target and to every stack standing next to it, friend or foe. */
  | { kind: 'burst'; perPower: number }
  /** Health back, this much for every point of spell power: the fallen get up again, as many as the stack began with. */
  | { kind: 'heal'; perPower: number }
  /** A status on every stack of one side at once. It needs no target. */
  | { kind: 'mass'; status: StatusId }
  /** Every shooter on the caster's side looses at once, where its shots take the most. It needs no target. */
  | { kind: 'volley' }
  /**
   * A fresh stack of `troop` marches in from the caster's edge of the field: `share` of how many of
   * them his side began with (or, with none of them, as much fighting worth). It needs no target.
   */
  | { kind: 'summon'; troop: TroopId; share: number };

export type SpellDef = {
  id: SpellId;
  name: string;
  mana: number;
  on: 'enemy' | 'friend';
  note: string;
  effect: SpellEffect;
  /** How it looks and sounds: a bolt from the sky, a ball of fire, or a sparkle in a colour. */
  look: { kind: 'bolt' | 'fire' | 'sparkle'; colour: 'gold' | 'blue' | 'red' };
  /** An order: what the caster bellows, and how ("bellows", "roars"). The log says it that way. */
  shout?: { verb: string; words: string };
  /** Only once the caster's troops are down to this share of the health they began with. */
  hurt?: number;
};

/** Whether a spell is aimed at a stack; the others (a mass status, a volley, a summons) take the whole field. */
export const needsTarget = (spell: SpellId) => !['mass', 'volley', 'summon'].includes(SPELLS[spell].effect.kind);

export const SPELLS: Record<SpellId, SpellDef> = {
  bolt: { id: 'bolt', name: 'Lightning Bolt', mana: 7, on: 'enemy', note: 'It does twenty damage for every point of spell power.', effect: { kind: 'damage', perPower: 20 }, look: { kind: 'bolt', colour: 'gold' } },
  bless: { id: 'bless', name: 'Bless', mana: 5, on: 'friend', note: 'The stack always rolls its best damage, for the rest of the battle.', effect: { kind: 'status', status: 'blessed' }, look: { kind: 'sparkle', colour: 'gold' } },
  slow: { id: 'slow', name: 'Slow', mana: 5, on: 'enemy', note: 'It halves the stack\u2019s speed for this round and the next.', effect: { kind: 'status', status: 'slowed' }, look: { kind: 'sparkle', colour: 'blue' } },
  haste: { id: 'haste', name: 'Haste', mana: 5, on: 'friend', note: 'It gives the stack +2 speed for the rest of the battle.', effect: { kind: 'status', status: 'hasted' }, look: { kind: 'sparkle', colour: 'gold' } },
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    mana: 9,
    on: 'enemy',
    note: 'It does twelve damage for every point of spell power, to the stack and to everyone next to it. Mind your own men.',
    effect: { kind: 'burst', perPower: 12 },
    look: { kind: 'fire', colour: 'red' },
  },
  stoneskin: { id: 'stoneskin', name: 'Stone Skin', mana: 5, on: 'friend', note: 'It gives the stack +3 defence for the rest of the battle.', effect: { kind: 'status', status: 'stoneskin' }, look: { kind: 'sparkle', colour: 'blue' } },
  // Villains' spells and orders. Heroes could learn them too.
  newts: {
    id: 'newts', name: 'Newts', mana: 6, on: 'enemy', effect: { kind: 'status', status: 'newts' }, look: { kind: 'sparkle', colour: 'gold' },
    note: 'It turns a stack into newts, so it loses its next turn and can\u2019t strike back till then.',
  },
  frogs: {
    id: 'frogs', name: 'Frogs', mana: 6, on: 'enemy', effect: { kind: 'status', status: 'frogs' }, look: { kind: 'sparkle', colour: 'gold' },
    note: 'It turns a stack into frogs, so it loses its next turn and can\u2019t strike back till then.',
  },
  brew: {
    id: 'brew', name: 'Witch\u2019s Brew', mana: 6, on: 'friend', effect: { kind: 'heal', perPower: 15 }, look: { kind: 'sparkle', colour: 'gold' },
    note: 'It gives back fifteen health for every point of spell power, and the fallen get up again, as many as the stack began with.',
  },
  shieldwall: {
    id: 'shieldwall', name: 'Shield Wall', mana: 0, on: 'friend', effect: { kind: 'mass', status: 'shieldwall' }, look: { kind: 'sparkle', colour: 'blue' },
    shout: { verb: 'bellows', words: 'Shield wall!' }, note: 'Every stack of his locks shields and gets +3 defence for two rounds.',
  },
  crossbows: {
    id: 'crossbows', name: 'Crossbows, Fire!', mana: 0, on: 'enemy', effect: { kind: 'volley' }, look: { kind: 'sparkle', colour: 'red' },
    shout: { verb: 'bellows', words: 'Crossbows, fire!' }, note: 'Every shooter of his looses at once, at whoever it would hurt most.',
  },
  guard: {
    id: 'guard', name: 'Call the Guard', mana: 0, on: 'friend', effect: { kind: 'summon', troop: 'swordsmen', share: 0.3 }, look: { kind: 'sparkle', colour: 'red' },
    shout: { verb: 'roars', words: 'Call the guard!' }, hurt: 0.6, note: 'Once his men are hurt, fresh swordsmen march in from his edge of the field, nearly a third as many as he began with.',
  },
};
