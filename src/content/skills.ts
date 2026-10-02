import type { Bonus } from './backgrounds';
import type { TroopId } from './troops';

/** Skills have three ranks: each rank adds its number, and Advanced and Expert also teach a trick. */
export type SkillId = 'archery' | 'offence' | 'armourer' | 'logistics' | 'scouting' | 'leadership' | 'estates' | 'sorcery' | 'mysticism' | 'diplomacy';

/** One rank of a skill: everything the skill does at that rank, in words and as a bonus. */
export type SkillRank = { note: string; bonus: Bonus };
/**
 * Advanced or Expert: its whole note and bonus, as any rank's, and `adds`, what it adds to the rank
 * before in words, for the level-up card. The hero screen says what a rank does in all (#226).
 */
export type HigherRank = SkillRank & { adds: string };

/** A skill: its three ranks, Basic, Advanced and Expert. */
export type Skill = { id: SkillId; name: string; ranks: readonly [SkillRank, HigherRank, HigherRank] };

export const RANKS = ['Basic', 'Advanced', 'Expert'] as const;

/** Fast troops that rush a line of archers: stakes in the ground slow them down. */
const RUSHERS: TroopId[] = ['wolves', 'boars', 'goblins'];
/** Everyone who fights hand to hand. */
const FIGHTERS: TroopId[] = ['knights', 'swordsmen', 'peasants', 'bandits', 'wolves', 'boars', 'bears', 'goblins', 'trolls'];
const MAIL = { archers: { defence: 2 }, crossbowmen: { defence: 2 }, poachers: { defence: 2 }, huntsmen: { defence: 2 } };

export const SKILLS: Record<SkillId, Skill> = {
  archery: {
    id: 'archery',
    name: 'Archery',
    ranks: [
      { note: 'Every shot hits 15% harder.', bonus: { ranged: 0.15 } },
      {
        note: 'Every shot hits 30% harder, and your archers plant stakes, so wolves, boars and goblins start every battle slowed.',
        adds: 'Every shot hits another 15% harder, 30% in all, and your archers plant stakes, so wolves, boars and goblins start every battle slowed.',
        bonus: { ranged: 0.3, slows: RUSHERS },
      },
      {
        note: 'Every shot hits 45% harder, your archers get +1 attack, the stakes slow wolves, boars and goblins, and your shooters loose a free volley before every battle, except at a villain\u2019s walls.',
        adds: 'Every shot hits another 15% harder, 45% in all, your archers get +1 attack, and your shooters loose a free volley before every battle, except at a villain\u2019s walls.',
        bonus: { ranged: 0.45, slows: RUSHERS, volley: true, troops: { archers: { attack: 1 } } },
      },
    ],
  },
  offence: {
    id: 'offence',
    name: 'Offence',
    ranks: [
      { note: 'Blows in melee land 10% harder.', bonus: { melee: 0.1 } },
      {
        note: 'Blows in melee land 20% harder, and your knights and swordsmen charge. After a run-up of 3 hexes, started clear of the enemy, they hit a quarter harder and nobody strikes back. The charge winds them, though, so they can\u2019t strike back themselves for the rest of that round and the next.',
        adds: 'Blows in melee land another 10% harder, 20% in all, and your knights and swordsmen charge. After a run-up of 3 hexes, started clear of the enemy, they hit a quarter harder and nobody strikes back. The charge winds them, though, so they can\u2019t strike back themselves for the rest of that round and the next.',
        bonus: { melee: 0.2, charge: ['knights', 'swordsmen'] },
      },
      {
        note: 'Blows in melee land 30% harder, and everyone who fights hand to hand charges. After a run-up of 3 hexes, started clear of the enemy, they hit a quarter harder and nobody strikes back. The charge winds them, though, so they can\u2019t strike back themselves for the rest of that round and the next.',
        adds: 'Blows in melee land another 10% harder, 30% in all, and everyone who fights hand to hand charges, not only your knights and swordsmen.',
        bonus: { melee: 0.3, charge: FIGHTERS },
      },
    ],
  },
  armourer: {
    id: 'armourer',
    name: 'Armourer',
    ranks: [
      { note: 'Your troops take 7% less damage.', bonus: { armour: 0.07 } },
      {
        note: 'Your troops take 14% less damage, and your shooters wear mail, which gives archers, crossbowmen, poachers and huntsmen +2 defence.',
        adds: 'Your troops take another 7% less damage, 14% in all, and your shooters wear mail, which gives archers, crossbowmen, poachers and huntsmen +2 defence.',
        bonus: { armour: 0.14, troops: MAIL },
      },
      {
        note: 'Your troops take 21% less damage, your shooters wear mail, and you keep your gear like new, so every piece you wear gives +1 defence.',
        adds: 'Your troops take another 7% less damage, 21% in all, and you keep your gear like new, so every piece you wear gives +1 defence.',
        bonus: { armour: 0.21, troops: MAIL, gearDefence: 1 },
      },
    ],
  },
  logistics: {
    id: 'logistics',
    name: 'Logistics',
    ranks: [
      { note: 'You get +20 movement a day.', bonus: { movement: 20 } },
      {
        note: 'You get +40 movement a day, and riding off the road costs a quarter less, in the woods too if you can ride them.',
        adds: 'You get another +20 movement a day, +40 in all, and riding off the road costs a quarter less, in the woods too if you can ride them.',
        bonus: { movement: 40, offRoad: 0.25 },
      },
      {
        note: 'You get +60 movement a day, and off the road you ride as fast as on it. The woods cost half, if you can ride them.',
        adds: 'You get another +20 movement a day, +60 in all, and off the road you ride as fast as on it. The woods cost half, if you can ride them.',
        bonus: { movement: 60, offRoad: 0.5 },
      },
    ],
  },
  scouting: {
    id: 'scouting',
    name: 'Scouting',
    ranks: [
      { note: 'You see 40 paces further, and count every enemy exactly.', bonus: { sight: 40, counts: true } },
      {
        note: 'You see 80 paces further and count every enemy, and your scouts put a number on your chances and say what the enemy carries.',
        adds: 'You see another 40 paces further, 80 in all, and your scouts put a number on your chances and say what the enemy carries.',
        bonus: { sight: 80, counts: true, odds: true },
      },
      {
        note: 'You see 120 paces further, with counts, chances and what they carry. Your scouts shadow every band in the province, so you see them all through the mist, and nothing can hunt you.',
        adds: 'You see another 40 paces further, 120 in all, and your scouts shadow every band in the province, so you see them all through the mist, and nothing can hunt you.',
        bonus: { sight: 120, counts: true, odds: true, shadow: true },
      },
    ],
  },
  leadership: {
    id: 'leadership',
    name: 'Leadership',
    ranks: [
      { note: 'You get +25 leadership.', bonus: { leadership: 25 } },
      {
        note: 'You get +50 leadership, and a third of every company stays on with you between commissions, not a quarter.',
        adds: 'You get another +25 leadership, +50 in all, and a third of every company stays on with you between commissions, not a quarter.',
        bonus: { leadership: 50, veterans: 1 / 12 },
      },
      {
        note: 'You get +75 leadership, a third of every company stays on between commissions, and every payday volunteers join your biggest company, for your name alone.',
        adds: 'You get another +25 leadership, +75 in all, and every payday volunteers join your biggest company, for your name alone.',
        bonus: { leadership: 75, veterans: 1 / 12, volunteers: 20 },
      },
    ],
  },
  estates: {
    id: 'estates',
    name: 'Estates',
    ranks: [
      { note: 'You get +150 gold every payday.', bonus: { payday: 150 } },
      {
        note: 'You get +300 gold every payday, and every castle and village finds half as many volunteers again.',
        adds: 'You get another +150 gold every payday, +300 in all, and every castle and village finds half as many volunteers again.',
        bonus: { payday: 300, restock: 0.5 },
      },
      {
        note: 'You get +450 gold every payday, and castles and villages are fuller. Every castle and village you have visited also pays you 100 gold of rent on payday.',
        adds: 'You get another +150 gold every payday, +450 in all, and every castle and village you have visited pays you 100 gold of rent on payday.',
        bonus: { payday: 450, restock: 0.5, rents: 100 },
      },
    ],
  },
  sorcery: {
    id: 'sorcery',
    name: 'Sorcery',
    ranks: [
      { note: 'You get +1 spell power.', bonus: { spellPower: 1 } },
      { note: 'You get +2 spell power, and every spell costs 1 mana less.', adds: 'You get another +1 spell power, +2 in all, and every spell costs 1 mana less.', bonus: { spellPower: 2, manaDiscount: 1 } },
      {
        note: 'You get +3 spell power, every spell costs 1 mana less, and you cast a second spell every round of battle, though nobody casts more than two.',
        adds: 'You get another +1 spell power, +3 in all, and you cast a second spell every round of battle, though nobody casts more than two.',
        bonus: { spellPower: 3, manaDiscount: 1, casts: 1 },
      },
    ],
  },
  mysticism: {
    id: 'mysticism',
    name: 'Mysticism',
    ranks: [
      { note: 'You get +1 knowledge, which is 10 more mana.', bonus: { knowledge: 1 } },
      {
        note: 'You get +2 knowledge, which is 20 more mana, and your mana comes back as you ride, a point for every 15 movement.',
        adds: 'You get another +1 knowledge, which is 10 more mana, and your mana comes back as you ride, a point for every 15 movement.',
        bonus: { knowledge: 2, manaRide: 15 },
      },
      {
        note: 'You get +3 knowledge, which is 30 more mana, and your mana comes back twice as fast as you ride, a point for every 7 movement.',
        adds: 'You get another +1 knowledge, which is 10 more mana, and your mana comes back twice as fast as you ride, a point for every 7 movement.',
        bonus: { knowledge: 3, manaRide: 7 },
      },
    ],
  },
  diplomacy: {
    id: 'diplomacy',
    name: 'Diplomacy',
    ranks: [
      { note: 'Bribes cost 15% less, and bands far weaker than you surrender when you ride up. You get their gold and half the experience without a fight.', bonus: { bribes: 0.15, cows: true } },
      {
        note: 'Bribes cost 30% less, weak bands surrender, and small bands will take your coin and join you.',
        adds: 'Bribes cost another 15% less, 30% in all, and small bands will take your coin and join you.',
        bonus: { bribes: 0.3, cows: true, hires: true },
      },
      {
        note: 'Bribes cost 45% less, weak bands surrender, and any band that draws wages will take your coin and join you, even gatekeepers, at twice the price.',
        adds: 'Bribes cost another 15% less, 45% in all, and any band that draws wages will take your coin and join you, even gatekeepers, at twice the price.',
        bonus: { bribes: 0.45, cows: true, hires: true, hiresGates: true },
      },
    ],
  },
};

/** What a skill does at a rank (from 1), in words. */
export const skillNote = (id: SkillId, rank: number) => SKILLS[id].ranks[Math.max(0, Math.min(RANKS.length, rank) - 1)].note;
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
  | 'farSight'
  | 'beastFriend'
  | 'scholar'
  | 'favourite'
  | 'fortunesFavour';

/** A perk. `trick` marks one that changes what you can do, not just a number: those come first on a level-up. */
export type Perk = { id: PerkId; name: string; note: string; bonus: Bonus; trick?: boolean };

export const PERKS: Record<PerkId, Perk> = {
  quartermaster: {
    id: 'quartermaster',
    name: 'Quartermaster',
    note: 'Wages cost a fifth less, and every castle and village throws in one recruit free for every five you take. The troops have noticed.',
    bonus: { wages: -0.2, freeRecruits: 0.2 },
  },
  nightRider: {
    id: 'nightRider',
    name: 'Night Rider',
    note: 'You ride on after dark, so movement you leave unused today carries over to tomorrow, up to half a day\u2019s ride. The owls have opinions about this.',
    bonus: { carry: 0.5 },
  },
  gooseWhisperer: { id: 'gooseWhisperer', name: 'Goose Whisperer', note: 'The royal goose likes you, and word gets round. Every villain starts a battle slowed, looking over their shoulder.', bonus: { slows: ['baron', 'witch', 'bramble'] } },
  treasureHunter: {
    id: 'treasureHunter',
    name: 'Treasure Hunter',
    note: 'Chests, piles and old mines give half as much again, and you can smell them, so every dawn the mist lifts over any treasure within 300 paces.',
    bonus: { loot: 0.5, smells: 300 },
  },
  drillSergeant: { id: 'drillSergeant', name: 'Drill Sergeant', note: 'Peasants fight like militia, with +3 attack and +2 defence.', bonus: { troops: { peasants: { attack: 3, defence: 2 } } } },
  warchest: {
    id: 'warchest',
    name: 'War Chest',
    note: 'The King\u2019s bankers pay you a tenth of what\u2019s in your purse every payday, up to 500 gold. Spend it, or let it grow.',
    bonus: { interest: 0.1 },
  },
  scholar: { id: 'scholar', name: 'Scholar', note: 'Every level-up offers you four choices, not three. You read the small print.', bonus: { choices: 1 } },
  favourite: { id: 'favourite', name: 'The King\u2019s Favourite', note: 'At court the King offers you four boons, not three. The other courtiers are furious.', bonus: { boons: 1 } },
  // The heroes' tricks, to learn: a level can teach any hero another's way of winning.
  cavalryCharge: {
    id: 'cavalryCharge',
    name: 'Cavalry Charge',
    note: 'Your knights charge. After a run-up of 3 hexes, started clear of the enemy, they hit a quarter harder and nobody strikes back. The charge winds them, though, so they can\u2019t strike back themselves for the rest of that round and the next.',
    bonus: { charge: ['knights'] },
    trick: true,
  },
  firstVolley: { id: 'firstVolley', name: 'First Volley', note: 'Your archers loose a free volley before every battle, except at a villain\u2019s walls.', bonus: { volley: true }, trick: true },
  woodsman: { id: 'woodsman', name: 'Woodsman', note: 'You ride through the woods, where nothing on the map can follow or hunt you.', bonus: { forestWalk: true }, trick: true },
  battleMage: { id: 'battleMage', name: 'Battle Mage', note: 'You cast a second spell every round of battle.', bonus: { casts: 1 }, trick: true },
  silverTongue: { id: 'silverTongue', name: 'Silver Tongue', note: 'Bribes cost a third less, and small bands will take your coin and join you.', bonus: { bribes: 0.33, hires: true }, trick: true },
  farSight: { id: 'farSight', name: 'Far Sight', note: 'You can cast Far Sight from the map, and the mist rolls back for a long way around you.', bonus: { mapSpells: ['farsight'] }, trick: true },
  beastFriend: {
    id: 'beastFriend',
    name: 'Beast Friend',
    note: 'Beasts follow you instead of fighting, the more of them the stronger your army is than theirs, and the rest attack. They draw no wages and need no leadership.',
    bonus: { tames: true },
    trick: true,
  },
  fortunesFavour: {
    id: 'fortunesFavour',
    name: 'Fortune\u2019s Favour',
    note: 'Every blow has a 10% chance to land lucky, twice as hard, and every stack has a 10% chance that its spirits win it another turn before the round moves on.',
    bonus: { luck: 0.1, morale: 0.1 },
  },
};
