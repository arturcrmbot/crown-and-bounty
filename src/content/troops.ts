import type { BackgroundId } from './backgrounds';
import type { SpellId, StatusId } from './spells';

/** Every kind of troop, with HoMM2-style numbers. Troops are just numbers: 400 peasants are 400 peasants. */
export type TroopId = 'peasants' | 'archers' | 'knights' | 'swordsmen' | 'crossbowmen' | 'wolves' | 'baron' | 'goblins' | 'trolls' | 'witch' | 'bramble' | 'poachers' | 'bandits' | 'boars' | HeroId;
/** Aldric himself, as each background fights: one of a kind, like the villains, and never in the army. */
export type HeroId = 'heroKnight' | 'heroWizard' | 'heroRanger' | 'heroCourtier';

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
  /** A beast's feelings about following a hero it respects, for the card that says it joined. */
  tamed?: string;
  /**
   * The hero's own numbers grow: `damage` is his at level I, and each level adds `perLevel` to both
   * ends of it. A caster's damage also grows by `perPower` for every point of spell power.
   */
  hero?: { background: BackgroundId; perLevel: { damage: number }; perPower?: number };
  /** A villain who leads his side as a hero does: his spellbook, and his orders (see `Spellbook` in rules/battle/battle.ts). */
  caster?: Caster;
};

/** A villain's magic: spell power, mana, spells he knows, and orders he can give a few times a battle for no mana. */
export type Caster = { spellPower: number; mana: number; casts?: number; spells?: SpellId[]; charges?: { spell: SpellId; uses: number }[] };

export type Ability = 'regenerates' | 'hexes' | 'leads' | 'rides' | 'bard' | 'firstStrike' | 'stings' | 'pierce';

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
  /** Its blows at close quarters put this status on whatever they hit. */
  stingStatus?: StatusId;
  /**
   * A leader: Aldric, a villain or a captain. He stands behind his side's troops, off the hexes they
   * fight over, and acts from there. No blow, shot or spell can reach him, friend or foe (a Fireball
   * passes over him), so nobody strikes back at him either. He takes no turn unless he has
   * something to do with it: shots, or `rides`. His side is beaten when its troops are.
   */
  leads?: boolean;
  /** A leader who rides out from behind the line, as far as his speed takes him, strikes, and rides back, all in one move. */
  rides?: boolean;
  /**
   * A leader who fights with coin and words instead of blows, one move a turn: he pays a stack
   * `weeks.leave` weeks of its wages to leave the field, or `weeks.join` to fight for him if it fits
   * under his banner; he jeers a stack (`jeer`); or he sings one of his `songs` over his own.
   */
  bard?: { jeer: StatusId; songs: StatusId[]; weeks: { leave: number; join: number } };
  /** It strikes first when it defends against a melee blow, unless the attacker has this too. */
  firstStrike?: boolean;
  /** Its blows cut this much off the target's defence, armour and all. */
  pierce?: number;
};

export const ABILITIES: Record<Ability, AbilityDef> = {
  regenerates: { name: 'Regenerates', note: 'At the start of each turn, the top troll heals half its health.', healsTopOnTurn: 0.5 },
  hexes: { name: 'Hexes', note: 'Her shots slow whatever they hit.', shotStatus: 'slowed' },
  leads: { name: 'Behind the line', note: 'Leads from behind his men, where no blow, shot or spell can reach him, so nobody strikes back at him. When his army is beaten, so is he.', leads: true },
  rides: { name: 'Rides out', note: 'Rides out from behind the line, strikes, and rides back, all in one move.', rides: true },
  bard: {
    name: 'Bard',
    note: 'Fights with coin and words instead of a blade. Each turn he pays a stack to leave the field (or, with room under his banner, to fight for him), jeers one until it loses heart, or sings his own men on.',
    bard: { jeer: 'jeered', songs: ['heartened', 'charmed'], weeks: { leave: 4, join: 12 } },
  },
  firstStrike: { name: 'First Strike', note: 'Pitchforks first: it strikes before whatever attacks it, unless that also strikes first.', firstStrike: true },
  stings: { name: 'Stinging Bite', note: 'Whatever it hits up close is poisoned: a little health lost each turn, though it never falls past a sliver.', stingStatus: 'poisoned' },
  pierce: { name: 'Piercing Bolts', note: 'Its bolts punch through armour: -1 defence against them.', pierce: 1 },
};

/** The abilities of a kind of troop, with their rules. */
export const abilitiesOf = (id: TroopId): AbilityDef[] => (TROOPS[id].abilities ?? []).map((a) => ABILITIES[a]);

export const TROOPS: Record<TroopId, TroopDef> = {
  peasants: { id: 'peasants', name: 'Peasants', one: 'Peasant', hp: 3, attack: 1, defence: 1, damage: [1, 1], speed: 3, leadership: 1, wage: 1, note: 'Pitchforks, enthusiasm, not much else.', abilities: ['firstStrike'] },
  archers: { id: 'archers', name: 'Archers', one: 'Archer', hp: 14, attack: 5, defence: 3, damage: [2, 3], speed: 4, shots: 12, leadership: 2, wage: 3, note: 'Shoot from anywhere, unless something is chewing on them.' },
  knights: { id: 'knights', name: 'Knights', one: 'Knight', hp: 42, attack: 8, defence: 8, damage: [5, 8], speed: 5, leadership: 5, wage: 8, note: 'Heavy, loyal and very pleased with their armour.' },
  swordsmen: { id: 'swordsmen', name: 'Swordsmen', one: 'Swordsman', hp: 24, attack: 6, defence: 6, damage: [3, 5], speed: 4, leadership: 3, wage: 4, note: 'Grimsby\u2019s men. Goose feathers in every helmet.' },
  crossbowmen: { id: 'crossbowmen', name: 'Crossbowmen', one: 'Crossbowman', hp: 14, attack: 5, defence: 4, damage: [2, 4], speed: 3, shots: 8, leadership: 2, wage: 3, note: 'Slow to reload, slower to smile. Their bolts punch through armour.', abilities: ['pierce'] },
  wolves: { id: 'wolves', name: 'Wolves', one: 'Wolf', hp: 12, attack: 7, defence: 3, damage: [3, 5], speed: 7, leadership: 2, wage: 0, note: 'Fast, hungry, and not interested in your commission.', tamed: 'The pack leader sniffs your boots, decides you\u2019ll do, and the whole pack falls in behind you, tongues out.' },
  baron: {
    id: 'baron', name: 'Baron Grimsby', one: 'Baron Grimsby', hp: 160, attack: 11, defence: 10, damage: [9, 14], speed: 4, leadership: 99, wage: 0,
    note: 'Carries the royal goose under one arm, and gives the orders with the other.', abilities: ['leads'],
    caster: { spellPower: 2, mana: 15, spells: ['haste', 'slow'], charges: [{ spell: 'shieldwall', uses: 1 }, { spell: 'crossbows', uses: 2 }, { spell: 'guard', uses: 1 }] },
  },
  goblins: { id: 'goblins', name: 'Bog Goblins', one: 'Bog Goblin', hp: 5, attack: 4, defence: 2, damage: [1, 3], speed: 6, leadership: 1, wage: 1, note: 'Small, green, in a tremendous hurry, and their bite poisons.', abilities: ['stings'] },
  trolls: { id: 'trolls', name: 'Trolls', one: 'Troll', hp: 70, attack: 9, defence: 7, damage: [8, 12], speed: 3, leadership: 12, wage: 20, note: 'Big, slow, and very attached to their bridge.', abilities: ['regenerates'] },
  witch: {
    id: 'witch', name: 'Mother Mirrow', one: 'Mother Mirrow', hp: 140, attack: 8, defence: 8, damage: [6, 10], speed: 4, shots: 8, leadership: 99, wage: 0,
    note: 'Throws hexes, and the occasional ladle.', abilities: ['leads', 'hexes'],
    caster: { spellPower: 2, mana: 14, spells: ['newts', 'slow', 'brew'] },
  },
  bramble: {
    id: 'bramble', name: 'Aunt Bramble', one: 'Aunt Bramble', hp: 170, attack: 9, defence: 9, damage: [7, 11], speed: 4, shots: 10, leadership: 99, wage: 0,
    note: 'Mother Mirrow\u2019s big sister. Bigger hat, worse temper.', abilities: ['leads', 'hexes'],
    caster: { spellPower: 3, mana: 14, spells: ['frogs', 'bolt', 'brew'] },
  },
  poachers: { id: 'poachers', name: 'Poachers', one: 'Poacher', hp: 7, attack: 3, defence: 2, damage: [1, 3], speed: 4, shots: 6, leadership: 1, wage: 1, note: 'Other people\u2019s deer, other people\u2019s rabbits, and now, other people\u2019s officers.' },
  bandits: { id: 'bandits', name: 'Highwaymen', one: 'Highwayman', hp: 11, attack: 4, defence: 3, damage: [2, 3], speed: 5, leadership: 2, wage: 2, note: 'Stand and deliver. Mostly they stand.' },
  boars: { id: 'boars', name: 'Wild Boars', one: 'Wild Boar', hp: 18, attack: 5, defence: 4, damage: [2, 4], speed: 5, leadership: 2, wage: 0, note: 'Bristles, tusks and a very short temper.', tamed: 'The boars decide you are the biggest boar they have ever met, and trot after you, grunting happily.' },
  // Aldric in battle, as each background fights from behind the line. His numbers grow with him: see `hero`.
  heroKnight: {
    id: 'heroKnight', name: 'Sir Aldric', one: 'Sir Aldric', hp: 80, attack: 5, defence: 5, damage: [12, 18], speed: 6, leadership: 99, wage: 0, abilities: ['leads', 'rides'],
    note: 'The King\u2019s colours on his lance. He rides out from behind his men, charges, and is back before anyone can answer.',
    hero: { background: 'knight', perLevel: { damage: 2 } },
  },
  heroWizard: {
    id: 'heroWizard', name: 'Aldric', one: 'Aldric', hp: 50, attack: 2, defence: 3, damage: [3, 5], speed: 4, shots: 10, leadership: 99, wage: 0, abilities: ['leads'],
    note: 'Bolts from his staff, as hard as his spell power, thrown over his men\u2019s heads.',
    hero: { background: 'wizard', perLevel: { damage: 1 }, perPower: 3 },
  },
  heroRanger: {
    id: 'heroRanger', name: 'Aldric', one: 'Aldric', hp: 60, attack: 5, defence: 3, damage: [8, 12], speed: 5, shots: 12, leadership: 99, wage: 0, abilities: ['leads'],
    note: 'A longbow, and the patience to use it, from behind his men.',
    hero: { background: 'ranger', perLevel: { damage: 2 } },
  },
  heroCourtier: {
    id: 'heroCourtier', name: 'Lord Aldric', one: 'Lord Aldric', hp: 55, attack: 4, defence: 4, damage: [6, 10], speed: 6, leadership: 99, wage: 0, abilities: ['leads', 'bard'],
    note: 'A lute, a purse and a sharp tongue: he pays, jeers and sings, and leaves the fighting to his men.',
    hero: { background: 'courtier', perLevel: { damage: 1 } },
  },
};

/** Beasts draw no wages and follow no villain: a hero with a way with beasts can win them over. */
export const isBeast = (id: TroopId) => TROOPS[id].wage === 0 && TROOPS[id].leadership < 99;

const HEROES = Object.fromEntries(Object.values(TROOPS).flatMap((t) => (t.hero ? [[t.hero.background, t.id]] : []))) as Record<BackgroundId, HeroId>;
/** The troop that is Aldric himself, as a background fights. */
export const heroTroop = (background: BackgroundId): HeroId => HEROES[background];

/**
 * A rough fighting worth per troop, for odds hints and the bot. It grows with health, average
 * damage and the attack and defence skills, with a bonus for ranged troops.
 */
export function troopPower(id: TroopId): number {
  return unitPower(TROOPS[id]);
}

/** The same worth for any numbers: a troop's, or the hero's as they stand. */
export function unitPower(t: Pick<TroopDef, 'hp' | 'damage' | 'attack' | 'defence' | 'shots'>): number {
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
