import type { Bonus } from './backgrounds';

/** Skills have three ranks; each rank adds its bonus again. */
export type SkillId = 'archery' | 'offence' | 'armourer' | 'logistics' | 'scouting' | 'leadership' | 'estates' | 'sorcery' | 'mysticism';

export type Skill = { id: SkillId; name: string; note: string; perRank: Bonus };

export const RANKS = ['Basic', 'Advanced', 'Expert'] as const;

export const SKILLS: Record<SkillId, Skill> = {
  archery: { id: 'archery', name: 'Archery', note: 'Ranged attacks deal 15% more damage a rank.', perRank: { ranged: 0.15 } },
  offence: { id: 'offence', name: 'Offence', note: 'Melee attacks deal 10% more damage a rank.', perRank: { melee: 0.1 } },
  armourer: { id: 'armourer', name: 'Armourer', note: 'Your troops take 7% less damage a rank.', perRank: { armour: 0.07 } },
  logistics: { id: 'logistics', name: 'Logistics', note: '+20 movement a day a rank.', perRank: { movement: 20 } },
  scouting: { id: 'scouting', name: 'Scouting', note: 'See 40 paces further a rank, and count every enemy exactly.', perRank: { sight: 40 } },
  leadership: { id: 'leadership', name: 'Leadership', note: '+25 leadership a rank.', perRank: { leadership: 25 } },
  estates: { id: 'estates', name: 'Estates', note: '+150 gold every payday a rank.', perRank: { payday: 150 } },
  sorcery: { id: 'sorcery', name: 'Sorcery', note: '+1 spell power a rank.', perRank: { spellPower: 1 } },
  mysticism: { id: 'mysticism', name: 'Mysticism', note: '+1 knowledge (10 mana) a rank.', perRank: { knowledge: 1 } },
};

/** Perks are taken once and bend a rule, in the game's voice. */
export type PerkId =
  | 'quartermaster'
  | 'nightRider'
  | 'gooseWhisperer'
  | 'treasureHunter'
  | 'drillSergeant'
  | 'warchest'
  | 'cavalryCharge'
  | 'firstVolley'
  | 'woodsman'
  | 'battleMage'
  | 'silverTongue'
  | 'farSight';

/** A perk. `trick` marks one that changes what you can do, not just a number: those come first on a level-up. */
export type Perk = { id: PerkId; name: string; note: string; bonus: Bonus; trick?: boolean };

export const PERKS: Record<PerkId, Perk> = {
  quartermaster: { id: 'quartermaster', name: 'Quartermaster', note: 'Wages cost a fifth less. The troops have noticed.', bonus: { wages: -0.2 } },
  nightRider: { id: 'nightRider', name: 'Night Rider', note: '+35 movement a day. The horse has opinions about this.', bonus: { movement: 35 } },
  gooseWhisperer: { id: 'gooseWhisperer', name: 'Goose Whisperer', note: 'The royal goose likes you, and word gets round. Every villain starts a battle slowed, looking over their shoulder.', bonus: { slows: ['baron', 'witch', 'bramble'] } },
  treasureHunter: { id: 'treasureHunter', name: 'Treasure Hunter', note: 'Chests, piles and old mines give half as much again.', bonus: { loot: 0.5 } },
  drillSergeant: { id: 'drillSergeant', name: 'Drill Sergeant', note: 'Peasants fight like militia: +3 attack, +2 defence.', bonus: { troops: { peasants: { attack: 3, defence: 2 } } } },
  warchest: { id: 'warchest', name: 'War Chest', note: 'Every payday brings 400 more gold.', bonus: { payday: 400 } },
  // The heroes' tricks, to learn: a level can teach any hero another's way of winning.
  cavalryCharge: {
    id: 'cavalryCharge',
    name: 'Cavalry Charge',
    note: 'Your knights charge: after a run-up of 3 hexes, started clear of the enemy, they hit a quarter harder, and nobody strikes back.',
    bonus: { charge: ['knights'] },
    trick: true,
  },
  firstVolley: { id: 'firstVolley', name: 'First Volley', note: 'Your archers loose a free volley before every battle.', bonus: { volley: true }, trick: true },
  woodsman: { id: 'woodsman', name: 'Woodsman', note: 'You ride through the woods, where nothing on the map can follow or hunt you.', bonus: { forestWalk: true }, trick: true },
  battleMage: { id: 'battleMage', name: 'Battle Mage', note: 'Cast one more spell every round of battle.', bonus: { casts: 1 }, trick: true },
  silverTongue: { id: 'silverTongue', name: 'Silver Tongue', note: 'Bribes cost a third less, and small bands will take your coin and join you.', bonus: { bribes: 0.33, hires: true }, trick: true },
  farSight: { id: 'farSight', name: 'Far Sight', note: 'Cast Far Sight from the map: the mist rolls back for a long way around you.', bonus: { mapSpells: ['farsight'] }, trick: true },
};
