import type { BackgroundId } from './backgrounds';
import type { PortraitId } from './portraits';
import type { SpellId, StatusId } from './spells';

/** Every kind of troop, with HoMM2-style numbers. Troops are just numbers: 400 peasants are 400 peasants. */
export type TroopId = 'peasants' | 'archers' | 'knights' | 'swordsmen' | 'crossbowmen' | 'wolves' | 'baron' | 'goblins' | 'trolls' | 'witch' | 'bramble' | 'poachers' | 'bandits' | 'boars' | 'bears' | 'huntsmen' | 'rook' | HeroId;
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
  /** Leadership each troop needs (none for troops who draw no wages: beasts, and the old King's huntsmen), and gold each troop takes on payday. */
  leadership: number;
  wage: number;
  /** A one-line description for cards. */
  note: string;
  /** Whose folk they are, for who marches happily with whom (see `FEUDS`). Leaders have none. */
  people?: People;
  /** What only this troop does in battle. */
  abilities?: Ability[];
  /** A beast's feelings about following a hero it respects, for the card that says it joined. */
  tamed?: string;
  /** Why a troop that isn't a beast draws no wages, for its card on the hero screen. */
  unpaid?: string;
  /**
   * The hero's own numbers grow: `damage` is his at level I, and each level adds `perLevel` to both
   * ends of it. A caster's damage also grows by `perPower` for every point of spell power.
   */
  hero?: { background: BackgroundId; perLevel: { damage: number }; perPower?: number };
  /** A villain who leads his side as a hero does: his spellbook, and his orders (see `Spellbook` in rules/battle/battle.ts). */
  caster?: Caster;
  /** How a leader sounds when he speaks aloud: the pitch his babble runs around, in Hz (see `speak` in ui/sound.ts). */
  voice?: number;
  /** A leader's face, on the cards of the band or the lair he leads. */
  face?: PortraitId;
};

/**
 * The peoples of Act I: the King's own folk, outlaws, elves, dwarves, and wild things (beasts and
 * monsters). Aldric and the villains belong to none: everyone follows a leader.
 */
export type People = 'loyal' | 'outlaw' | 'elves' | 'dwarves' | 'wild';

/**
 * Peoples who won't march together. Put both in one army and every stack of either grumbles, and
 * its morale drops (`GRUMBLE` in rules/battle/battle.ts): the King's folk don't trust wild things
 * at their backs, and the feeling is mutual; elves and dwarves have never got on.
 */
export const FEUDS: readonly (readonly [People, People])[] = [
  ['loyal', 'wild'],
  ['elves', 'dwarves'],
];

/** Whether two kinds of troop won't march happily together. */
export function feuding(a: TroopId, b: TroopId): boolean {
  const [x, y] = [TROOPS[a].people, TROOPS[b].people];
  return Boolean(x && y) && FEUDS.some(([p, q]) => (p === x && q === y) || (p === y && q === x));
}

/** A villain's magic: spell power, mana, spells he knows, and orders he can give a few times a battle for no mana. */
export type Caster = { spellPower: number; mana: number; casts?: number; spells?: SpellId[]; charges?: { spell: SpellId; uses: number }[] };

export type Ability = 'regenerates' | 'hexes' | 'leads' | 'rides' | 'bard' | 'firstStrike' | 'stings' | 'pierce' | 'marks' | 'hunter';

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
   * `price.leave` gold for every point of its power to leave the field, or `price.join` to fight for
   * him if it fits under his banner, as many of it as his army outweighs (`outweighs`); he jeers a
   * stack (`jeer`); or he sings one of his `songs` over his own.
   */
  bard?: { jeer: StatusId; songs: StatusId[]; price: { leave: number; join: number } };
  /** It strikes first when it defends against a melee blow, unless the attacker has this too. */
  firstStrike?: boolean;
  /** Its blows cut this much off the target's defence, armour and all. */
  pierce?: number;
  /** Its blows and shots land this much harder on beasts (see `isBeast`). */
  hunts?: number;
};

export const ABILITIES: Record<Ability, AbilityDef> = {
  regenerates: { name: 'Regenerates', note: 'At the start of each turn, the top troll heals half its health.', healsTopOnTurn: 0.5 },
  hexes: { name: 'Hexes', note: 'Her shots slow whatever they hit.', shotStatus: 'slowed' },
  leads: { name: 'Behind the line', note: 'He leads from behind his men, where no blow, shot or spell can reach him, so nobody strikes back at him. When his army is beaten, so is he.', leads: true },
  rides: { name: 'Rides out', note: 'He rides out from behind the line, strikes, and rides back, all in one move.', rides: true },
  bard: {
    name: 'Bard',
    note: 'He fights with coin and words instead of a blade. Each turn he can pay a stack to leave the field, or to fight for him if it fits under his banner. Only an army stronger than theirs can buy them, and the stronger it is, the more of them take the gold. He can also jeer one until it loses heart, or sing his own men on.',
    bard: { jeer: 'jeered', songs: ['heartened', 'charmed'], price: { leave: 2, join: 6 } },
  },
  firstStrike: { name: 'First Strike', note: 'Pitchforks go first, so it strikes before whatever attacks it, unless that also strikes first.', firstStrike: true },
  stings: { name: 'Stinging Bite', note: 'Whatever it hits up close is poisoned, and loses a little health each turn, though never past a sliver.', stingStatus: 'poisoned' },
  pierce: { name: 'Piercing Bolts', note: 'Its bolts punch through armour, so whatever they hit has 1 less defence against them.', pierce: 1 },
  marks: { name: 'Marks the Quarry', note: 'Whatever his arrows hit is marked for the pack, and has \u22123 defence for two rounds.', shotStatus: 'marked' },
  hunter: { name: 'Hunter', note: 'It knows its quarry, so its shots and blows land half as hard again on wolves, boars, bears and every other beast.', hunts: 0.5 },
};

/** The abilities of a kind of troop, with their rules. */
export const abilitiesOf = (id: TroopId): AbilityDef[] => (TROOPS[id].abilities ?? []).map((a) => ABILITIES[a]);

/** Whether a kind of troop is a leader (Aldric, a villain or a captain), who fights from behind his side's line. */
export const leads = (id: TroopId) => abilitiesOf(id).some((a) => a.leads);

export const TROOPS: Record<TroopId, TroopDef> = {
  peasants: { id: 'peasants', name: 'Peasants', one: 'Peasant', hp: 3, attack: 1, defence: 1, damage: [1, 1], speed: 3, leadership: 1, wage: 1, people: 'loyal', note: 'They bring pitchforks, enthusiasm and not much else.', abilities: ['firstStrike'] },
  archers: { id: 'archers', name: 'Archers', one: 'Archer', hp: 14, attack: 5, defence: 3, damage: [2, 3], speed: 4, shots: 12, leadership: 2, wage: 3, people: 'loyal', note: 'They shoot from anywhere, unless something is chewing on them.' },
  knights: { id: 'knights', name: 'Knights', one: 'Knight', hp: 42, attack: 8, defence: 8, damage: [5, 8], speed: 5, leadership: 5, wage: 8, people: 'loyal', note: 'They are heavy, loyal and very pleased with their armour.' },
  swordsmen: { id: 'swordsmen', name: 'Swordsmen', one: 'Swordsman', hp: 24, attack: 6, defence: 6, damage: [3, 5], speed: 4, leadership: 3, wage: 4, people: 'outlaw', note: 'They are Grimsby\u2019s men, with a goose feather in every helmet.' },
  crossbowmen: { id: 'crossbowmen', name: 'Crossbowmen', one: 'Crossbowman', hp: 14, attack: 5, defence: 4, damage: [2, 4], speed: 3, shots: 8, leadership: 2, wage: 3, people: 'outlaw', note: 'They are slow to reload and slower to smile. Their bolts punch through armour.', abilities: ['pierce'] },
  wolves: { id: 'wolves', name: 'Wolves', one: 'Wolf', hp: 12, attack: 7, defence: 3, damage: [3, 5], speed: 7, leadership: 0, wage: 0, people: 'wild', note: 'They are fast, hungry, and not interested in your commission.', tamed: 'The pack leader sniffs your boots, decides you\u2019ll do, and the whole pack falls in behind you, tongues out.' },
  baron: {
    id: 'baron', name: 'Baron Grimsby', one: 'Baron Grimsby', hp: 160, attack: 11, defence: 10, damage: [9, 14], speed: 4, leadership: 99, wage: 0,
    note: 'He carries the royal goose under one arm, and gives the orders with the other.', abilities: ['leads'],
    caster: { spellPower: 2, mana: 15, spells: ['haste', 'slow'], charges: [{ spell: 'shieldwall', uses: 1 }, { spell: 'crossbows', uses: 2 }, { spell: 'guard', uses: 1 }] },
    voice: 104,
    face: 'grimsby',
  },
  goblins: { id: 'goblins', name: 'Bog Goblins', one: 'Bog Goblin', hp: 5, attack: 4, defence: 2, damage: [1, 3], speed: 6, leadership: 1, wage: 1, people: 'wild', note: 'They are small, green and in a tremendous hurry, and their bite poisons.', abilities: ['stings'] },
  trolls: { id: 'trolls', name: 'Trolls', one: 'Troll', hp: 70, attack: 9, defence: 7, damage: [8, 12], speed: 3, leadership: 12, wage: 20, people: 'wild', note: 'They are big, slow, and very attached to their bridge.', abilities: ['regenerates'] },
  witch: {
    id: 'witch', name: 'Mother Mirrow', one: 'Mother Mirrow', hp: 140, attack: 8, defence: 8, damage: [6, 10], speed: 4, shots: 8, leadership: 99, wage: 0,
    note: 'She throws hexes, and the occasional ladle.', abilities: ['leads', 'hexes'],
    caster: { spellPower: 2, mana: 14, spells: ['newts', 'slow', 'brew'] },
    voice: 330,
    face: 'mirrow',
  },
  bramble: {
    id: 'bramble', name: 'Aunt Bramble', one: 'Aunt Bramble', hp: 170, attack: 9, defence: 9, damage: [7, 11], speed: 4, shots: 10, leadership: 99, wage: 0,
    note: 'She is Mother Mirrow\u2019s big sister, with a bigger hat and a worse temper.', abilities: ['leads', 'hexes'],
    caster: { spellPower: 3, mana: 14, spells: ['frogs', 'bolt', 'brew'] },
    voice: 262,
    face: 'bramble',
  },
  poachers: { id: 'poachers', name: 'Poachers', one: 'Poacher', hp: 7, attack: 3, defence: 2, damage: [1, 3], speed: 4, shots: 6, leadership: 1, wage: 1, people: 'outlaw', note: 'They hunt other people\u2019s deer, other people\u2019s rabbits, and now other people\u2019s officers.' },
  bandits: { id: 'bandits', name: 'Highwaymen', one: 'Highwayman', hp: 11, attack: 4, defence: 3, damage: [2, 3], speed: 5, leadership: 2, wage: 2, people: 'outlaw', note: '\u201cStand and deliver,\u201d they say. Mostly they stand.' },
  boars: { id: 'boars', name: 'Wild Boars', one: 'Wild Boar', hp: 18, attack: 5, defence: 4, damage: [2, 4], speed: 5, leadership: 0, wage: 0, people: 'wild', note: 'They are all bristles, tusks and a very short temper.', tamed: 'The boars decide you are the biggest boar they have ever met, and trot after you, grunting happily.' },
  bears: {
    id: 'bears', name: 'Bears', one: 'Bear', hp: 80, attack: 9, defence: 7, damage: [10, 16], speed: 5, leadership: 0, wage: 0, people: 'wild',
    note: 'They are big and brown, and not at all sorry about it.',
    tamed: 'The biggest bear sniffs your hand, sneezes, and leans on you. *The others decide that makes you family.*',
  },
  // The old King's huntsmen: they draw no wages, but they aren't beasts. They serve the King still.
  huntsmen: {
    id: 'huntsmen', name: 'Huntsmen', one: 'Huntsman', hp: 18, attack: 7, defence: 4, damage: [3, 5], speed: 5, shots: 16, leadership: 0, wage: 0, people: 'loyal', abilities: ['hunter'],
    note: 'The old King\u2019s huntsmen are grey and lean, and nobody has ever known them to miss.',
    unpaid: 'They serve the old King still, and they have a score to settle with Rook.',
  },
  // Grimsby's captain (#15): he leads the Baron's wolves from behind them, shoots, and marks their quarry.
  rook: {
    id: 'rook', name: 'Rook the Huntsman', one: 'Rook the Huntsman', hp: 60, attack: 6, defence: 4, damage: [6, 10], speed: 5, shots: 12, leadership: 99, wage: 0,
    note: 'He is the Baron\u2019s huntsman. He shoots from behind his wolves, and whatever his arrows find, the pack goes for.', abilities: ['leads', 'marks'],
    voice: 175,
    face: 'rook',
  },
  // Aldric in battle, as each background fights from behind the line. His numbers grow with him: see `hero`.
  heroKnight: {
    id: 'heroKnight', name: 'Sir Aldric', one: 'Sir Aldric', hp: 80, attack: 5, defence: 5, damage: [12, 18], speed: 6, leadership: 99, wage: 0, abilities: ['leads', 'rides'],
    note: 'He carries the King\u2019s colours on his lance. He rides out from behind his men, charges, and is back before anyone can answer.',
    hero: { background: 'knight', perLevel: { damage: 2 } },
  },
  heroWizard: {
    id: 'heroWizard', name: 'Aldric', one: 'Aldric', hp: 50, attack: 2, defence: 3, damage: [3, 5], speed: 4, shots: 10, leadership: 99, wage: 0, abilities: ['leads'],
    note: 'He throws bolts from his staff over his men\u2019s heads, as hard as his spell power.',
    hero: { background: 'wizard', perLevel: { damage: 1 }, perPower: 3 },
  },
  heroRanger: {
    id: 'heroRanger', name: 'Aldric', one: 'Aldric', hp: 60, attack: 5, defence: 3, damage: [8, 12], speed: 5, shots: 12, leadership: 99, wage: 0, abilities: ['leads'],
    note: 'He has a longbow, and the patience to use it from behind his men.',
    hero: { background: 'ranger', perLevel: { damage: 2 } },
  },
  heroCourtier: {
    id: 'heroCourtier', name: 'Lord Aldric', one: 'Lord Aldric', hp: 55, attack: 4, defence: 4, damage: [6, 10], speed: 6, leadership: 99, wage: 0, abilities: ['leads', 'bard'],
    note: 'He has a lute, a purse and a sharp tongue. He pays, jeers and sings, and leaves the fighting to his men.',
    hero: { background: 'courtier', perLevel: { damage: 1 } },
  },
};

/** Beasts are wild things that draw no wages and follow no villain: a hero with a way with beasts can win them over. */
export const isBeast = (id: TroopId) => TROOPS[id].wage === 0 && TROOPS[id].leadership < 99 && TROOPS[id].people === 'wild';

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

/**
 * How much of a band comes over to an army, to follow it, take its gold or its side (Artur, 30 Sep):
 * the one number is power, and nobody comes while the army is no stronger than they are, all of them
 * once it's twice as strong, and in between, as much as it outweighs them. Whoever doesn't come fights.
 */
export function outweighs(ours: number, theirs: number): number {
  return theirs > 0 ? Math.max(0, Math.min(1, ours / theirs - 1)) : 1;
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
