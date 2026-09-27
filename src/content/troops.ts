import type { StatusId } from './spells';

/** Every kind of troop, with HoMM2-style numbers. Troops are just numbers: 400 peasants are 400 peasants. */
export type TroopId = 'peasants' | 'archers' | 'knights' | 'swordsmen' | 'crossbowmen' | 'wolves' | 'baron' | 'goblins' | 'trolls' | 'witch' | 'bramble';

export type TroopDef = {
  id: TroopId;
  /** Plural, as troops usually come; `one` is for a single troop. */
  name: string;
  one: string;
  /** Health of one troop. */
  hp: number;
  attack: number;
  defence: number;
  damage: readonly [number, number];
  /** Hexes per turn on the battlefield. */
  speed: number;
  /** Arrows or bolts; ranged troops shoot unless an enemy stands next to them. */
  shots?: number;
  /** Leadership each troop needs, and gold each troop takes on payday. */
  leadership: number;
  wage: number;
  /** A one-line description for cards. */
  note: string;
  /** What only this troop does in battle. */
  abilities?: Ability[];
};

export type Ability = 'regenerates' | 'hexes';

/**
 * Troop abilities, as data the battle engine reads at fixed moments. A new ability that uses
 * these moments is just a new entry here.
 */
export type AbilityDef = {
  name: string;
  note: string;
  /** At the start of the stack's turn, its top troop heals this share of its health (1 is all its wounds). */
  healsTopOnTurn?: number;
  /** Its shots put this status on whatever they hit. */
  shotStatus?: StatusId;
};

export const ABILITIES: Record<Ability, AbilityDef> = {
  regenerates: { name: 'Regenerates', note: 'At the start of each turn, the top troll heals half its health.', healsTopOnTurn: 0.5 },
  hexes: { name: 'Hexes', note: 'Her shots slow whatever they hit.', shotStatus: 'slowed' },
};

/** The abilities of a kind of troop, with their rules. */
export const abilitiesOf = (id: TroopId): AbilityDef[] => (TROOPS[id].abilities ?? []).map((a) => ABILITIES[a]);

export const TROOPS: Record<TroopId, TroopDef> = {
  peasants: { id: 'peasants', name: 'Peasants', one: 'Peasant', hp: 3, attack: 1, defence: 1, damage: [1, 1], speed: 3, leadership: 1, wage: 1, note: 'Pitchforks, enthusiasm, not much else.' },
  archers: { id: 'archers', name: 'Archers', one: 'Archer', hp: 14, attack: 5, defence: 3, damage: [2, 3], speed: 4, shots: 12, leadership: 2, wage: 3, note: 'Shoot from anywhere, unless something is chewing on them.' },
  knights: { id: 'knights', name: 'Knights', one: 'Knight', hp: 42, attack: 8, defence: 8, damage: [5, 8], speed: 5, leadership: 5, wage: 8, note: 'Heavy, loyal and very pleased with their armour.' },
  swordsmen: { id: 'swordsmen', name: 'Swordsmen', one: 'Swordsman', hp: 24, attack: 6, defence: 6, damage: [3, 5], speed: 4, leadership: 3, wage: 4, note: 'Grimsby\u2019s men. Goose feathers in every helmet.' },
  crossbowmen: { id: 'crossbowmen', name: 'Crossbowmen', one: 'Crossbowman', hp: 14, attack: 5, defence: 4, damage: [2, 4], speed: 3, shots: 8, leadership: 2, wage: 3, note: 'Slow to reload, slower to smile.' },
  wolves: { id: 'wolves', name: 'Wolves', one: 'Wolf', hp: 12, attack: 7, defence: 3, damage: [3, 5], speed: 7, leadership: 2, wage: 0, note: 'Fast, hungry, and not interested in your commission.' },
  baron: { id: 'baron', name: 'Baron Grimsby', one: 'Baron Grimsby', hp: 160, attack: 11, defence: 10, damage: [9, 14], speed: 4, leadership: 99, wage: 0, note: 'Carries the royal goose under one arm, and a very large sword in the other.' },
  goblins: { id: 'goblins', name: 'Bog Goblins', one: 'Bog Goblin', hp: 5, attack: 4, defence: 2, damage: [1, 3], speed: 6, leadership: 1, wage: 1, note: 'Small, green and in a tremendous hurry.' },
  trolls: { id: 'trolls', name: 'Trolls', one: 'Troll', hp: 70, attack: 9, defence: 7, damage: [8, 12], speed: 3, leadership: 12, wage: 20, note: 'Big, slow, and very attached to their bridge.', abilities: ['regenerates'] },
  witch: { id: 'witch', name: 'Mother Mirrow', one: 'Mother Mirrow', hp: 140, attack: 8, defence: 8, damage: [6, 10], speed: 4, shots: 8, leadership: 99, wage: 0, note: 'Throws hexes, and the occasional ladle.', abilities: ['hexes'] },
  bramble: { id: 'bramble', name: 'Aunt Bramble', one: 'Aunt Bramble', hp: 170, attack: 9, defence: 9, damage: [7, 11], speed: 4, shots: 10, leadership: 99, wage: 0, note: 'Mother Mirrow\u2019s big sister. Bigger hat, worse temper.', abilities: ['hexes'] },
};

/**
 * A rough fighting worth per troop, for odds hints and the bot. It grows with health, average
 * damage and the attack and defence skills, with a bonus for ranged troops.
 */
export function troopPower(id: TroopId): number {
  const t = TROOPS[id];
  const damage = (t.damage[0] + t.damage[1]) / 2;
  return Math.sqrt(t.hp * damage) * (1 + (t.attack + t.defence) / 20) * (t.shots ? 1.35 : 1);
}

/** HoMM2's words for how many: "a few Wolves", "lots of Swordsmen", "a horde of Goblins". */
export function crowd(id: TroopId, count: number): string {
  const word = count < 5 ? 'a few' : count < 10 ? 'several' : count < 20 ? 'a pack of' : count < 50 ? 'lots of' : count < 100 ? 'a horde of' : count < 250 ? 'a throng of' : count < 500 ? 'a swarm of' : count < 1000 ? 'zounds of' : 'a legion of';
  return `${word} ${TROOPS[id].name}`;
}

/** "1 Knight", "12 Knights". */
export const troops = (id: TroopId, count: number) => `${count} ${count === 1 ? TROOPS[id].one : TROOPS[id].name}`;
