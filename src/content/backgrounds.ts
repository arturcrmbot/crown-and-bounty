import type { SpellId } from './spells';
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
};

export type Background = {
  id: BackgroundId;
  name: string;
  title: string;
  /** What the story calls him in passing. */
  short: string;
  pitch: string;
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
    stats: { attack: 1, defence: 1, spellPower: 1, knowledge: 1 },
    leadership: 140,
    gold: 1000,
    army: [{ troop: 'knights', count: 10 }, { troop: 'archers', count: 20 }],
    spells: ['bless'],
    signature: { name: 'Banner of the Realm', note: 'Knights get +1 attack and +1 defence.', bonus: { troops: { knights: { attack: 1, defence: 1 } } } },
    growth: { attack: 4, defence: 4, spellPower: 1, knowledge: 1 },
    favours: ['offence', 'armourer', 'leadership'],
  },
  wizard: {
    id: 'wizard',
    name: 'Hedge Wizard',
    title: 'Aldric the Hedge Wizard',
    short: 'Aldric',
    pitch: 'Fewer swords, more lightning. Spells are cheaper and hit much harder.',
    stats: { attack: 0, defence: 1, spellPower: 3, knowledge: 3 },
    leadership: 110,
    gold: 1250,
    army: [{ troop: 'knights', count: 8 }, { troop: 'archers', count: 22 }],
    spells: ['bolt', 'bless', 'slow', 'haste'],
    signature: { name: 'Hedge Magic', note: 'Every spell costs 2 less mana.', bonus: { manaDiscount: 2 } },
    growth: { attack: 1, defence: 1, spellPower: 4, knowledge: 3 },
    favours: ['sorcery', 'mysticism', 'scouting'],
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger of the Greenwood',
    title: 'Aldric of the Greenwood',
    short: 'Aldric',
    pitch: 'Rides further, sees further, and his archers never miss twice.',
    stats: { attack: 1, defence: 1, spellPower: 1, knowledge: 1 },
    leadership: 120,
    gold: 1000,
    army: [{ troop: 'knights', count: 9 }, { troop: 'archers', count: 34 }],
    spells: ['slow'],
    signature: { name: 'Pathfinder', note: '+30 movement a day, sees 50 paces further and counts every enemy exactly, archers +1 attack and +4 shots.', bonus: { movement: 30, sight: 50, troops: { archers: { attack: 1, shots: 4 } } } },
    growth: { attack: 3, defence: 2, spellPower: 1, knowledge: 1 },
    favours: ['archery', 'logistics', 'scouting'],
  },
  courtier: {
    id: 'courtier',
    name: 'Courtier',
    title: 'Lord Aldric, Courtier',
    short: 'Lord Aldric',
    pitch: 'Knows everyone, owes no one. Cheaper troops, fatter paydays, a full purse.',
    stats: { attack: 1, defence: 1, spellPower: 2, knowledge: 2 },
    leadership: 125,
    gold: 2400,
    army: [{ troop: 'knights', count: 10 }, { troop: 'archers', count: 20 }],
    spells: ['bless', 'slow'],
    signature: { name: 'Silver Tongue', note: 'Recruits cost a fifth less and every payday brings 250 more gold.', bonus: { recruitPrice: -0.2, payday: 250 } },
    growth: { attack: 2, defence: 2, spellPower: 2, knowledge: 2 },
    favours: ['estates', 'leadership', 'mysticism'],
  },
};
