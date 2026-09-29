import type { Bonus } from './backgrounds';

export type ArtifactSlot = 'weapon' | 'armour' | 'helm' | 'banner' | 'trinket';
export type Slot = ArtifactSlot | 'trinket2' | 'trinket3';
export const TRINKET_SLOTS: readonly Slot[] = ['trinket', 'trinket2', 'trinket3'];
export const SLOTS: Slot[] = ['weapon', 'armour', 'helm', 'banner', ...TRINKET_SLOTS];
export const slotsForArtifact = (slot: ArtifactSlot): readonly Slot[] => (slot === 'trinket' ? TRINKET_SLOTS : [slot]);
export const slotAcceptsArtifact = (slot: Slot, artifactSlot: ArtifactSlot) => slotsForArtifact(artifactSlot).includes(slot);

export type ArtifactId =
  | 'swordOfAldmoor'
  | 'carvingKnife'
  | 'breastplate'
  | 'dwarvenHelm'
  | 'helmOfFarSight'
  | 'oldBanner'
  | 'luckyHorseshoe'
  | 'wizardsButton'
  | 'goldenFeather'
  | 'millersLoaf'
  | 'abbotsStaff'
  | 'eelskinBoots'
  | 'goblinCharm'
  | 'trollhide'
  | 'harrowgateMail'
  | 'fenBanner'
  | 'astrolabe'
  | 'poachersHorn'
  | 'greenwoodCloak'
  | 'brannocsLance'
  | 'twinWand'
  | 'crystalBall'
  | 'silverSignet'
  | 'hawthornCrown'
  | 'grimsbysHat'
  | 'witchsHat'
  | 'bramblesLadle'
  | 'headsmansAxe'
  | 'kingsPlate'
  | 'friarsHabit'
  | 'pilgrimsHat'
  | 'blackBanner'
  | 'recruitingDrum'
  | 'surveyorsChain'
  | 'spyglass'
  | 'stewardsLedger'
  | 'bonesDice'
  | 'rabbitsFoot'
  | 'castellansPipes';

/** A set of artifacts that do something more when all of them are worn. */
export type SetId = 'regalia' | 'finery';

export type Artifact = { id: ArtifactId; name: string; slot: ArtifactSlot; note: string; bonus: Bonus; drawback?: true; price?: number; set?: SetId };

export const ARTIFACTS: Record<ArtifactId, Artifact> = {
  swordOfAldmoor: { id: 'swordOfAldmoor', name: 'Sword of Aldmoor', slot: 'weapon', note: '+2 attack. Came with the castle, like the damp.', bonus: { attack: 2 }, price: 900 },
  carvingKnife: { id: 'carvingKnife', name: 'Grimsby\u2019s Carving Knife', slot: 'weapon', note: '+1 attack, +5% melee damage. The goose flinches when it sees it. *Grimsby\u2019s Regalia: wear his knife, his feather and his hat together, and his men start every battle slowed.*', bonus: { attack: 1, melee: 0.05 }, set: 'regalia' },
  breastplate: { id: 'breastplate', name: 'Breastplate of the Crown', slot: 'armour', note: '+2 defence, and very shiny.', bonus: { defence: 2 }, price: 900 },
  dwarvenHelm: { id: 'dwarvenHelm', name: 'Dwarven Helm', slot: 'helm', note: '+1 defence, and your troops take 5% less damage.', bonus: { defence: 1, armour: 0.05 } },
  helmOfFarSight: { id: 'helmOfFarSight', name: 'Helm of Far Sight', slot: 'helm', note: 'See 60 paces further.', bonus: { sight: 60 }, price: 500 },
  oldBanner: {
    id: 'oldBanner',
    name: 'The Old Tower Banner',
    slot: 'banner',
    note: '+20 leadership, and your archers rally to it: +1 attack and +3 shots. Moth-eaten, much loved.',
    bonus: { leadership: 20, troops: { archers: { attack: 1, shots: 3 } } },
  },
  luckyHorseshoe: { id: 'luckyHorseshoe', name: 'Lucky Horseshoe', slot: 'trinket', note: '+20 movement a day.', bonus: { movement: 20 }, price: 400 },
  wizardsButton: { id: 'wizardsButton', name: 'A Wizard\u2019s Button', slot: 'trinket', note: '+1 spell power. Nobody knows which wizard.', bonus: { spellPower: 1 } },
  goldenFeather: { id: 'goldenFeather', name: 'Golden Goose Feather', slot: 'trinket', note: '+300 gold every payday. The goose would like it back. *Grimsby\u2019s Regalia: wear his knife, his feather and his hat together, and his men start every battle slowed.*', bonus: { payday: 300 }, set: 'regalia' },
  millersLoaf: {
    id: 'millersLoaf',
    name: 'The Miller\u2019s Everlasting Loaf',
    slot: 'trinket',
    note: 'Nobody marches on an empty stomach: +25 movement a day, and wages cost a tenth less. It never goes stale, which is worrying.',
    bonus: { movement: 25, wages: -0.1 },
  },
  abbotsStaff: { id: 'abbotsStaff', name: 'The Abbot\u2019s Staff', slot: 'weapon', note: '+2 spell power. Still smells faintly of incense and eels.', bonus: { spellPower: 2 } },
  eelskinBoots: { id: 'eelskinBoots', name: 'Eelskin Boots', slot: 'trinket', note: '+30 movement a day. Slippery, but only on the inside. *The Fenmarch Finery: wear the boots, the jerkin and the banner together, and the fen takes you for one of its own.*', bonus: { movement: 30 }, set: 'finery' },
  goblinCharm: { id: 'goblinCharm', name: 'Goblin Lucky Charm', slot: 'trinket', note: '+20% gold from treasure. Goblins are very good at finding things that aren\u2019t theirs.', bonus: { loot: 0.2 } },
  trollhide: { id: 'trollhide', name: 'Trollhide Jerkin', slot: 'armour', note: '+1 defence, and your troops take 10% less damage. Does not wash. *The Fenmarch Finery: wear the boots, the jerkin and the banner together, and the fen takes you for one of its own.*', bonus: { defence: 1, armour: 0.1 }, set: 'finery' },
  harrowgateMail: { id: 'harrowgateMail', name: 'Harrowgate Mail', slot: 'armour', note: '+3 defence. Heavy enough to anchor a boat.', bonus: { defence: 3 }, price: 1600 },
  fenBanner: { id: 'fenBanner', name: 'Banner of the Fens', slot: 'banner', note: '+35 leadership. The heron on it is either noble or hungry. *The Fenmarch Finery: wear the boots, the jerkin and the banner together, and the fen takes you for one of its own.*', bonus: { leadership: 35 }, price: 1200, set: 'finery' },
  astrolabe: { id: 'astrolabe', name: 'Brass Astrolabe', slot: 'trinket', note: '+1 spell power, +1 knowledge. It points at stars, mostly the wrong ones.', bonus: { spellPower: 1, knowledge: 1 }, price: 1400 },
  // Relics: each carries one hero's trick, so anyone can learn to win another way.
  poachersHorn: { id: 'poachersHorn', name: 'The Poacher\u2019s Horn', slot: 'trinket', note: 'Your archers loose a free volley before every battle, as a ranger\u2019s do.', bonus: { volley: true } },
  greenwoodCloak: { id: 'greenwoodCloak', name: 'Greenwood Cloak', slot: 'armour', note: '+1 defence, and you ride through the woods like a ranger, where nothing can follow.', bonus: { defence: 1, forestWalk: true } },
  brannocsLance: {
    id: 'brannocsLance',
    name: 'Sir Brannoc\u2019s Lance',
    slot: 'weapon',
    note: '+1 attack, and your knights and swordsmen charge: after a run-up of 3 hexes, started clear of the enemy, they hit a quarter harder, and nobody strikes back.',
    bonus: { attack: 1, charge: ['knights', 'swordsmen'] },
  },
  twinWand: {
    id: 'twinWand',
    name: 'The Twin Wand',
    slot: 'weapon',
    note: '+1 spell power, and a second spell every round of battle (nobody casts more than two). The two halves argue.',
    bonus: { spellPower: 1, casts: 1 },
  },
  crystalBall: { id: 'crystalBall', name: 'Crystal of Far Sight', slot: 'helm', note: 'Cast Far Sight on the map, and see 40 paces further.', bonus: { mapSpells: ['farsight'], sight: 40 }, price: 800 },
  silverSignet: { id: 'silverSignet', name: 'Silver Signet', slot: 'trinket', note: 'Bribes cost a third less, and small bands will take your coin and join you.', bonus: { bribes: 0.33, hires: true }, price: 900 },
  hawthornCrown: {
    id: 'hawthornCrown',
    name: 'The Hawthorn Crown',
    slot: 'helm',
    note: 'Beasts that couldn\u2019t beat you follow you instead, as a ranger\u2019s do, and draw no wages. The King must never see you in it.',
    bonus: { tames: true },
  },
  // What the villains leave behind.
  grimsbysHat: { id: 'grimsbysHat', name: 'Grimsby\u2019s Hat', slot: 'helm', note: '+1 attack, +1 defence. It has a goose feather in it, and ambitions. *Grimsby\u2019s Regalia: wear his knife, his feather and his hat together, and his men start every battle slowed.*', bonus: { attack: 1, defence: 1 }, set: 'regalia' },
  witchsHat: {
    id: 'witchsHat',
    name: 'Mother Mirrow\u2019s Hat',
    slot: 'helm',
    note: '+2 spell power, +1 knowledge, and goblins and trolls know that hat: they start every battle slowed. Very pointy.',
    bonus: { spellPower: 2, knowledge: 1, slows: ['goblins', 'trolls'] },
  },
  bramblesLadle: {
    id: 'bramblesLadle',
    name: 'Aunt Bramble\u2019s Ladle',
    slot: 'weapon',
    note: '+3 spell power, but every spell costs a mana more. She stirred everything with it, the choir included.',
    bonus: { spellPower: 3, manaDiscount: -1 },
    drawback: true,
  },
  // Gear with a price, and gear that changes how you ride, talk and count.
  headsmansAxe: { id: 'headsmansAxe', name: 'The Headsman\u2019s Axe', slot: 'weapon', note: '+4 attack, but \u22122 defence. Nobody near it is safe, you included.', bonus: { attack: 4, defence: -2 }, drawback: true, price: 1100 },
  kingsPlate: { id: 'kingsPlate', name: 'The King\u2019s Plate', slot: 'armour', note: '+5 defence, but \u221240 movement a day. You clank.', bonus: { defence: 5, movement: -40 }, drawback: true, price: 1500 },
  friarsHabit: {
    id: 'friarsHabit',
    name: 'A Friar\u2019s Habit',
    slot: 'armour',
    note: '+2 knowledge, but \u22121 defence: it is only wool. Folk give a friar a better price: bribes cost a tenth less.',
    bonus: { knowledge: 2, defence: -1, bribes: 0.1 },
    drawback: true,
    price: 900,
  },
  pilgrimsHat: {
    id: 'pilgrimsHat',
    name: 'A Pilgrim\u2019s Hat',
    slot: 'helm',
    note: '+1 knowledge, and your mana comes back as you ride: a point for every 20 movement. The scallop shell on it has been a long way.',
    bonus: { knowledge: 1, manaRide: 20 },
  },
  blackBanner: {
    id: 'blackBanner',
    name: 'The Black Banner',
    slot: 'banner',
    note: '+10 leadership, and bands far weaker than you surrender when you ride up: nobody wants to fight under the skull. Honest folk shun it: recruits cost a tenth more.',
    bonus: { leadership: 10, cows: true, recruitPrice: 0.1 },
    drawback: true,
  },
  recruitingDrum: {
    id: 'recruitingDrum',
    name: 'The Recruiting Drum',
    slot: 'banner',
    note: '+15 leadership, and every payday volunteers join your biggest company. Nobody can resist a good drum.',
    bonus: { leadership: 15, volunteers: 15 },
    price: 800,
  },
  surveyorsChain: {
    id: 'surveyorsChain',
    name: 'The Surveyor\u2019s Chain',
    slot: 'trinket',
    note: 'Riding off the road costs a quarter less. The King\u2019s surveyor measured every field in the realm, and lost this in the last one.',
    bonus: { offRoad: 0.25 },
  },
  spyglass: {
    id: 'spyglass',
    name: 'A Scout\u2019s Spyglass',
    slot: 'trinket',
    note: 'See 20 paces further, count every enemy, and put a number on your chances, and on what they carry.',
    bonus: { sight: 20, counts: true, odds: true },
    price: 600,
  },
  stewardsLedger: {
    id: 'stewardsLedger',
    name: 'The Steward\u2019s Ledger',
    slot: 'trinket',
    note: 'Every castle and village you have visited pays you 60 gold of rent on payday. The steward will want it back, eventually.',
    bonus: { rents: 60 },
    price: 900,
  },
  bonesDice: {
    id: 'bonesDice',
    name: 'A Pair of Bone Dice',
    slot: 'trinket',
    note: 'Won off a card-sharp who swore they were fair: a 12% chance a blow lands lucky, twice as hard, and a 12% chance a stack\u2019s spirits win it another turn.',
    bonus: { luck: 0.12, morale: 0.12 },
    price: 700,
  },
  // Luck and morale, one each: the Aldmoor poachers' charm, and the Fenmarch castellan's pipes.
  rabbitsFoot: {
    id: 'rabbitsFoot',
    name: 'A Rabbit\u2019s Foot',
    slot: 'trinket',
    note: 'A 10% chance any blow lands lucky, twice as hard. Lucky for you; less so for the rabbit.',
    bonus: { luck: 0.1 },
  },
  castellansPipes: {
    id: 'castellansPipes',
    name: 'The Castellan\u2019s Bagpipes',
    slot: 'trinket',
    note: 'A 10% chance a stack\u2019s spirits win it another turn before the round moves on, if only to get further from the noise. The castellan is very glad to see them go.',
    bonus: { morale: 0.1 },
    price: 500,
  },
};

export type ArtifactSet = { id: SetId; name: string; note: string; bonus: Bonus };

/** Sets: all of their pieces worn at once do something more. */
export const SETS: Record<SetId, ArtifactSet> = {
  regalia: {
    id: 'regalia',
    name: 'Grimsby\u2019s Regalia',
    note: 'Grimsby\u2019s men salute it out of habit before they remember whose side they are on: swordsmen and crossbowmen start every battle slowed.',
    bonus: { slows: ['swordsmen', 'crossbowmen'] },
  },
  finery: {
    id: 'finery',
    name: 'The Fenmarch Finery',
    note: 'The fen folk take you for one of their own: goblins and trolls start every battle slowed, and you ride off the road a quarter cheaper.',
    bonus: { slows: ['goblins', 'trolls'], offRoad: 0.25 },
  },
};

/** The pieces of a set, in the order they're listed. */
export const piecesOf = (set: SetId) => (Object.values(ARTIFACTS) as Artifact[]).filter((a) => a.set === set).map((a) => a.id);

/** Relics carry another hero's trick: a charge, a volley, the woods, a second spell, Far Sight, a silver tongue, a way with beasts. */
export const RELICS: ArtifactId[] = ['poachersHorn', 'greenwoodCloak', 'brannocsLance', 'twinWand', 'crystalBall', 'silverSignet', 'hawthornCrown'];
