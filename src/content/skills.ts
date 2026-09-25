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
  scouting: { id: 'scouting', name: 'Scouting', note: 'See 40 paces further a rank.', perRank: { sight: 40 } },
  leadership: { id: 'leadership', name: 'Leadership', note: '+25 leadership a rank.', perRank: { leadership: 25 } },
  estates: { id: 'estates', name: 'Estates', note: '+150 gold every payday a rank.', perRank: { payday: 150 } },
  sorcery: { id: 'sorcery', name: 'Sorcery', note: '+1 spell power a rank.', perRank: { spellPower: 1 } },
  mysticism: { id: 'mysticism', name: 'Mysticism', note: '+1 knowledge (10 mana) a rank.', perRank: { knowledge: 1 } },
};

/** Perks are taken once and bend a rule, in the game's voice. */
export type PerkId = 'quartermaster' | 'nightRider' | 'gooseWhisperer' | 'treasureHunter' | 'drillSergeant' | 'warchest';

export type Perk = { id: PerkId; name: string; note: string; bonus: Bonus };

export const PERKS: Record<PerkId, Perk> = {
  quartermaster: { id: 'quartermaster', name: 'Quartermaster', note: 'Wages cost a fifth less. The troops have noticed.', bonus: { wages: -0.2 } },
  nightRider: { id: 'nightRider', name: 'Night Rider', note: '+35 movement a day. The horse has opinions about this.', bonus: { movement: 35 } },
  gooseWhisperer: { id: 'gooseWhisperer', name: 'Goose Whisperer', note: 'The royal goose likes you. Baron Grimsby starts every battle slowed, and knows why.', bonus: { slows: ['baron'] } },
  treasureHunter: { id: 'treasureHunter', name: 'Treasure Hunter', note: 'Chests, piles and old mines give half as much again.', bonus: { loot: 0.5 } },
  drillSergeant: { id: 'drillSergeant', name: 'Drill Sergeant', note: 'Peasants fight like militia: +3 attack, +2 defence.', bonus: { troops: { peasants: { attack: 3, defence: 2 } } } },
  warchest: { id: 'warchest', name: 'War Chest', note: 'Every payday brings 400 more gold.', bonus: { payday: 400 } },
};
