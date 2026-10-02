import type { MapSpellId, SpellId, StatusId } from './spells';
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
  /** Share more damage his spells do (0.15 is 15% more). */
  spellDamage?: number;
  /** Bless, Haste and Stone Skin, cast on one of his stacks, fall on every stack of his at once. */
  massBlessings?: boolean;
  /** Damage added to a burst (a Fireball) for every point of spell power. */
  burstPower?: number;
  /** Extra attack and defence for one kind of troop. */
  troops?: Partial<Record<TroopId, { attack?: number; defence?: number; shots?: number }>>;
  /** Enemy troops that start every battle slowed. */
  slows?: TroopId[];
  /** His own troops that start every battle with these statuses on them (a ward). */
  wards?: Partial<Record<TroopId, StatusId[]>>;
  /** Casts that cost no mana, a few a battle, but take one of the round's casts all the same (a wand's bolts). */
  charges?: { spell: SpellId; uses: number }[];
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
  /** Battle spells he can cast while he has this (gear that holds a spell). */
  spells?: SpellId[];
  /** How hard his shooters hit in melee, as a share of a shot (the best counts): 1 is full strength. */
  shooterMelee?: number;
  /** After a won battle: this share of his mana comes back, and this share of each company's fallen get up. */
  manaBack?: number;
  mend?: number;
  /** Fraction off every bribe. */
  bribes?: number;
  /** Small bands will take his coin and join him. */
  hires?: boolean;
  /** Beasts follow him instead of fighting, as many as his army outweighs them (`tameOffer`), for the rest of his day, and the rest attack. */
  tames?: boolean;
  /** Beasts follow him far more readily than they follow anyone else who tames (`befriends`): the Ranger's way with them. */
  beastMaster?: boolean;
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
  /** Chance, as a fraction, that a blow lands lucky: twice as hard. */
  luck?: number;
  /** Chance, as a fraction, that a stack's good spirits win it another turn before the round moves on. */
  morale?: number;
  /** Recruiters throw in this share more, free. */
  freeRecruits?: number;
  /** Share of a day's movement he can leave unused and ride tomorrow. */
  carry?: number;
  /** He can smell treasure this far off: at dawn the mist lifts over it. */
  smells?: number;
  /** Share of his purse the King's bankers pay on payday (up to 500). */
  interest?: number;
  /** More choices at every level-up, and more boons at court. */
  choices?: number;
  boons?: number;
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
  /** The signature perk, always on. `brief` is it in two sentences, for the card that starts the commission; the hero screen has the `note`. */
  signature: { name: string; note: string; bonus: Bonus; brief?: string };
  /** Which stat grows on a level-up, as weights. */
  growth: { attack: number; defence: number; spellPower: number; knowledge: number };
  /** His own three skills: every level-up offers one while any has a rank left, and they're offered more often. */
  favours: string[];
  /** He is a wizard: only he is offered wizardry (`WIZARDRY` in `skills.ts`). */
  wizardry?: boolean;
};

export const BACKGROUNDS: Record<BackgroundId, Background> = {
  knight: {
    id: 'knight',
    name: 'Knight of the Realm',
    title: 'Sir Aldric, Knight of the Realm',
    short: 'Sir Aldric',
    pitch: 'Heavy horse, heavier armour. Leads more troops and his knights hit harder.',
    playstyle: 'Charge in. You lead the biggest army, and nobody can strike back when your knights charge.',
    stats: { attack: 1, defence: 1, spellPower: 1, knowledge: 1 },
    leadership: 140,
    gold: 1000,
    army: [{ troop: 'knights', count: 10 }, { troop: 'archers', count: 20 }],
    spells: [],
    signature: {
      name: 'Banner of the Realm',
      brief: 'Your knights get +1 attack and +1 defence, and charge as you do. A long charge hits a quarter harder, and nobody strikes back.',
      note: 'Your knights get +1 attack and +1 defence, and they charge, as you do yourself. After a run-up of 3 hexes or more, started clear of the enemy, they hit a quarter harder and nobody can strike back. The charge winds them, though, so they can\u2019t strike back themselves for the rest of that round and the next.',
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
    playstyle: 'Win with magic. You know two spells and find more on the map, you can cast two a round, and on the map you can cast Far Sight.',
    stats: { attack: 0, defence: 1, spellPower: 3, knowledge: 3 },
    leadership: 110,
    gold: 1250,
    army: [{ troop: 'knights', count: 8 }, { troop: 'archers', count: 22 }],
    spells: ['arrow', 'bless'],
    signature: { name: 'Hedge Magic', note: 'Every spell costs 2 less mana, you can cast two spells a round, and on the map you know Far Sight.', bonus: { manaDiscount: 2, casts: 1, mapSpells: ['farsight'] } },
    growth: { attack: 1, defence: 1, spellPower: 4, knowledge: 3 },
    favours: ['sorcery', 'mysticism', 'spellcraft'],
    wizardry: true,
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger of the Greenwood',
    title: 'Aldric of the Greenwood',
    short: 'Aldric',
    pitch: 'Rides further, sees further, and his archers never miss twice.',
    playstyle: 'Scout and shoot. You ride through the woods, your archers shoot first, and wild beasts follow you.',
    stats: { attack: 1, defence: 1, spellPower: 1, knowledge: 1 },
    leadership: 120,
    gold: 1000,
    army: [{ troop: 'knights', count: 9 }, { troop: 'archers', count: 34 }],
    spells: [],
    signature: {
      name: 'Pathfinder',
      brief: 'You ride through the woods, where nothing on the map can follow you, and your archers loose a free volley before every battle. Beasts may follow you instead of fighting, and they draw no wages.',
      note: 'You ride through the woods, where nothing on the map can follow you. You get +30 movement a day and see further, and your scouts count every enemy exactly. Your archers get +1 attack and +4 shots, and loose a free volley before every battle, except at a villain\u2019s walls. Beasts follow you instead of fighting, half of a pack as strong as your army, and all of one two thirds as strong, and the rest attack. Winning them over takes the rest of the day. Beasts draw no wages and need no leadership.',
      bonus: { movement: 30, sight: 50, counts: true, troops: { archers: { attack: 1, shots: 4 } }, volley: true, forestWalk: true, tames: true, beastMaster: true },
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
    playstyle: 'Talk your way through. You start rich and bribe cheaply, and in battle you pay, jeer and sing instead of fighting.',
    stats: { attack: 1, defence: 1, spellPower: 2, knowledge: 2 },
    leadership: 125,
    gold: 2400,
    army: [{ troop: 'knights', count: 10 }, { troop: 'archers', count: 20 }],
    spells: [],
    signature: {
      name: 'Silver Tongue',
      note: 'Recruits cost a fifth less, every payday brings 250 more gold, bribes cost half, and small bands will take your coin and join you.',
      bonus: { recruitPrice: -0.2, payday: 250, bribes: 0.5, hires: true },
    },
    growth: { attack: 2, defence: 2, spellPower: 2, knowledge: 2 },
    favours: ['estates', 'diplomacy', 'leadership'],
  },
};
