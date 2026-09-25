/** The hero's spells. One per round, paid for with mana. */
export type SpellId = 'bolt' | 'bless' | 'slow' | 'haste';

export type SpellDef = { id: SpellId; name: string; mana: number; on: 'enemy' | 'friend'; note: string };

export const SPELLS: Record<SpellId, SpellDef> = {
  bolt: { id: 'bolt', name: 'Lightning Bolt', mana: 7, on: 'enemy', note: 'Twenty damage for every point of spell power.' },
  bless: { id: 'bless', name: 'Bless', mana: 5, on: 'friend', note: 'The stack always rolls its best damage, for the rest of the battle.' },
  slow: { id: 'slow', name: 'Slow', mana: 5, on: 'enemy', note: 'Halves the stack\u2019s speed, for the rest of the battle.' },
  haste: { id: 'haste', name: 'Haste', mana: 5, on: 'friend', note: '+2 speed for the stack, for the rest of the battle.' },
};
