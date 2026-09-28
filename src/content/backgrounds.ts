import type { MapSpellId, SpellId } from './spells';
import type { TroopId } from './troops';

/** Who Sir Aldric was before the King found him. Chosen once, at the start of the campaign. */
export type BackgroundId = 'knight' | 'wizard' | 'ranger' | 'courtier';

/** How an ability changes the hero. Everything is optional and adds up. */
export type Bonus = {
  attack?: number;
  defence?: number;
  spellPower?: number;
  knowledge?: number;
  leadership?: number;
  movement?: number;
  sight?: number;
  /** Multipliers, as fractions: 0.15 is 15% more. */
  melee?: number;
  ranged?: number;
  /** Fraction of damage your troops shrug off. */
  armour?: number;
  wages?: number;
  recruitPrice?: number;
  payday?: number;
  loot?: number;
  manaDiscount?: number;
  /** Extra attack and defence for one kind of troop. */
  troops?: Partial<Record<TroopId, { attack?: number; defence?: number; shots?: number }>>;
  /** Enemy troops that start every battle slowed. */
  slows?: TroopId[];
  /** Troops that charge: after a run-up of 3 hexes or more, started clear of the enemy, they hit a quarter harder, and can't be struck back. */
  charge?: TroopId[];
  /** His archers loose a free volley before every battle. */
  volley?: boolean;
  /** Rides through woodland, slowly, where nothing on the map can follow. */
  forestWalk?: boolean;
  /** Extra spells he may cast in one round of battle. */
  casts?: number;
  /** Spells he can cast on the map. */
  mapSpells?: MapSpellId[];
  /** Fraction off every bribe. */
  bribes?: number;
  /** Small bands will take his coin and join him. */
  hires?: boolean;
  /** Beasts that couldn't beat him follow him instead of fighting. */
  tames?: boolean;
  /** Defence for every artifact he wears. */
  gearDefence?: number;
  /** Share off the cost of riding off the road, and through woods he can ride. */
  offRoad?: number;
  /** His scouts count every enemy exactly. */
  counts?: boolean;
  /** His scouts put a number on his chances, and say what an enemy carries. */
  odds?: boolean;
  /** His scouts shadow every band: he sees them all through the mist, and nothing can hunt him. */
  shadow?: boolean;
  /** Share of every company that stays on between commissions, on top of the usual quarter. */
  veterans?: number;
  /** Leadership's worth of volunteers who join his biggest company every payday. */
  volunteers?: number;
  /** Share more volunteers every castle and village finds on payday. */
  restock?: number;
  /** Gold every castle and village he has visited pays him on payday. */
  rents?: number;
  /** Mana comes back as he rides: a point for every this much movement. */
  manaRide?: number;
  /** Bands far weaker than him surrender when he rides up. */
  cows?: boolean;
  /** Gatekeepers will take his coin and join him too, at twice the price. */
  hiresGates?: boolean;
};

export type Background = {
  id: BackgroundId;
  name: string;
  title: string;
  /** What the story calls him in passing. */
  short: string;
  pitch: string;
  /** How he wins, in a line, for the choice at the start. */
  playstyle: string;
  stats: { attack: number; defence: number; spellPower: number; knowledge: number };
  leadership: number;
  gold: number;
  army: { troop: TroopId; count: number }[];
  spells: SpellId[];
  /** The signature perk, always on. */
  signature: { name: string; note: string; bonus: Bonus };
  /** Which stat grows on a level-up, as weights. */
  growth: { attack: number; defence: number; spellPower: number; knowledge: number };
  /** Skills this background is drawn to: they're offered more often. */
  favours: string[];
};

export const BACKGROUNDS: Record<BackgroundId, Background> = {
  knight: {
    id: 'knight',
    name: 'Knight of the Realm',
    title: 'Sir Aldric, Knight of the Realm',
    short: 'Sir Aldric',
    pitch: 'Heavy horse, heavier armour. Leads more troops and his knights hit harder.',
    playstyle: 'Charge in. The biggest army, and knights whose charge nobody can answer.',
    stats: { attack: 1, defence: 1, spellPower: 1, knowledge: 1 },
    leadership: 140,
    gold: 1000,
    army: [{ troop: 'knights', count: 10 }, { troop: 'archers', count: 20 }],
    spells: ['bless'],
    signature: {
      name: 'Banner of the Realm',
      note: 'Knights get +1 attack and +1 defence, and they charge, as Sir Aldric does himself: after a run-up of 3 hexes or more, started clear of the enemy, they hit a quarter harder, and nobody can strike back.',
      bonus: { troops: { knights: { attack: 1, defence: 1 } }, charge: ['knights', 'heroKnight'] },
    },
    growth: { attack: 4, defence: 4, spellPower: 1, knowledge: 1 },
    favours: ['offence', 'armourer', 'leadership'],
  },
  wizard: {
    id: 'wizard',
    name: 'Hedge Wizard',
    title: 'Aldric the Hedge Wizard',
    short: 'Aldric',
    pitch: 'Fewer swords, more lightning. Spells are cheaper and hit much harder.',
    playstyle: 'Win with magic. Four spells, two casts a round, and Far Sight on the map.',
    stats: { attack: 0, defence: 1, spellPower: 3, knowledge: 3 },
    leadership: 110,
    gold: 1250,
    army: [{ troop: 'knights', count: 8 }, { troop: 'archers', count: 22 }],
    spells: ['bolt', 'bless', 'slow', 'haste'],
    signature: { name: 'Hedge Magic', note: 'Every spell costs 2 less mana, he can cast two spells a round, and on the map he knows Far Sight.', bonus: { manaDiscount: 2, casts: 1, mapSpells: ['farsight'] } },
    growth: { attack: 1, defence: 1, spellPower: 4, knowledge: 3 },
    favours: ['sorcery', 'mysticism', 'scouting'],
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger of the Greenwood',
    title: 'Aldric of the Greenwood',
    short: 'Aldric',
    pitch: 'Rides further, sees further, and his archers never miss twice.',
    playstyle: 'Scout and shoot. Rides the woods, fires first, and wild beasts follow him.',
    stats: { attack: 1, defence: 1, spellPower: 1, knowledge: 1 },
    leadership: 120,
    gold: 1000,
    army: [{ troop: 'knights', count: 9 }, { troop: 'archers', count: 34 }],
    spells: ['slow'],
    signature: {
      name: 'Pathfinder',
      note: 'Rides through the woods, where nothing on the map can follow. +30 movement a day, sees further and counts every foe. His archers get +1 attack and +4 shots, and loose a free volley before every battle. Beasts that couldn\u2019t beat him follow him instead, and draw no wages.',
      bonus: { movement: 30, sight: 50, counts: true, troops: { archers: { attack: 1, shots: 4 } }, volley: true, forestWalk: true, tames: true },
    },
    growth: { attack: 3, defence: 2, spellPower: 1, knowledge: 1 },
    favours: ['archery', 'logistics', 'scouting'],
  },
  courtier: {
    id: 'courtier',
    name: 'Courtier',
    title: 'Lord Aldric, Courtier',
    short: 'Lord Aldric',
    pitch: 'Knows everyone, owes no one. Cheaper troops, fatter paydays, a full purse.',
    playstyle: 'Pay your way. Starts rich, bribes cheap, and buys whole bands of cutthroats.',
    stats: { attack: 1, defence: 1, spellPower: 2, knowledge: 2 },
    leadership: 125,
    gold: 2400,
    army: [{ troop: 'knights', count: 10 }, { troop: 'archers', count: 20 }],
    spells: ['bless', 'slow'],
    signature: {
      name: 'Silver Tongue',
      note: 'Recruits cost a fifth less, every payday brings 250 more gold, bribes cost half, and small bands will take his coin and join him.',
      bonus: { recruitPrice: -0.2, payday: 250, bribes: 0.5, hires: true },
    },
    growth: { attack: 2, defence: 2, spellPower: 2, knowledge: 2 },
    favours: ['estates', 'diplomacy', 'leadership'],
  },
};
