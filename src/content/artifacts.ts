import type { Bonus } from './backgrounds';

export type Slot = 'weapon' | 'armour' | 'helm' | 'banner' | 'trinket';
export const SLOTS: Slot[] = ['weapon', 'armour', 'helm', 'banner', 'trinket'];

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
  | 'silverSignet';

export type Artifact = { id: ArtifactId; name: string; slot: Slot; note: string; bonus: Bonus; price?: number };

export const ARTIFACTS: Record<ArtifactId, Artifact> = {
  swordOfAldmoor: { id: 'swordOfAldmoor', name: 'Sword of Aldmoor', slot: 'weapon', note: '+2 attack. Came with the castle, like the damp.', bonus: { attack: 2 }, price: 900 },
  carvingKnife: { id: 'carvingKnife', name: 'Grimsby\u2019s Carving Knife', slot: 'weapon', note: '+1 attack, +5% melee damage. The goose flinches when it sees it.', bonus: { attack: 1, melee: 0.05 } },
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
  goldenFeather: { id: 'goldenFeather', name: 'Golden Goose Feather', slot: 'trinket', note: '+300 gold every payday. The goose would like it back.', bonus: { payday: 300 } },
  millersLoaf: {
    id: 'millersLoaf',
    name: 'The Miller\u2019s Everlasting Loaf',
    slot: 'trinket',
    note: 'Nobody marches on an empty stomach: +25 movement a day, and wages cost a tenth less. It never goes stale, which is worrying.',
    bonus: { movement: 25, wages: -0.1 },
  },
  abbotsStaff: { id: 'abbotsStaff', name: 'The Abbot\u2019s Staff', slot: 'weapon', note: '+2 spell power. Still smells faintly of incense and eels.', bonus: { spellPower: 2 } },
  eelskinBoots: { id: 'eelskinBoots', name: 'Eelskin Boots', slot: 'trinket', note: '+30 movement a day. Slippery, but only on the inside.', bonus: { movement: 30 } },
  goblinCharm: { id: 'goblinCharm', name: 'Goblin Lucky Charm', slot: 'trinket', note: '+20% gold from treasure. Goblins are very good at finding things that aren\u2019t theirs.', bonus: { loot: 0.2 } },
  trollhide: { id: 'trollhide', name: 'Trollhide Jerkin', slot: 'armour', note: '+1 defence, and your troops take 10% less damage. Does not wash.', bonus: { defence: 1, armour: 0.1 } },
  harrowgateMail: { id: 'harrowgateMail', name: 'Harrowgate Mail', slot: 'armour', note: '+3 defence. Heavy enough to anchor a boat.', bonus: { defence: 3 }, price: 1600 },
  fenBanner: { id: 'fenBanner', name: 'Banner of the Fens', slot: 'banner', note: '+35 leadership. The heron on it is either noble or hungry.', bonus: { leadership: 35 }, price: 1200 },
  astrolabe: { id: 'astrolabe', name: 'Brass Astrolabe', slot: 'trinket', note: '+1 spell power, +1 knowledge. It points at stars, mostly the wrong ones.', bonus: { spellPower: 1, knowledge: 1 }, price: 1400 },
  // Relics: each carries one hero's trick, so anyone can learn to win another way.
  poachersHorn: { id: 'poachersHorn', name: 'The Poacher\u2019s Horn', slot: 'trinket', note: 'Your archers loose a free volley before every battle, as a ranger\u2019s do.', bonus: { volley: true } },
  greenwoodCloak: { id: 'greenwoodCloak', name: 'Greenwood Cloak', slot: 'armour', note: '+1 defence, and you ride through the woods like a ranger, where nothing can follow.', bonus: { defence: 1, forestWalk: true } },
  brannocsLance: {
    id: 'brannocsLance',
    name: 'Sir Brannoc\u2019s Lance',
    slot: 'weapon',
    note: '+1 attack, and your knights and swordsmen charge: after riding 3 hexes they hit a quarter harder, and nobody strikes back.',
    bonus: { attack: 1, charge: ['knights', 'swordsmen'] },
  },
  twinWand: { id: 'twinWand', name: 'The Twin Wand', slot: 'weapon', note: 'One more spell every round of battle. The two halves argue.', bonus: { casts: 1 } },
  crystalBall: { id: 'crystalBall', name: 'Crystal of Far Sight', slot: 'helm', note: 'Cast Far Sight on the map, and see 40 paces further.', bonus: { mapSpells: ['farsight'], sight: 40 }, price: 800 },
  silverSignet: { id: 'silverSignet', name: 'Silver Signet', slot: 'trinket', note: 'Bribes cost a third less, and small bands will take your coin and join you.', bonus: { bribes: 0.33, hires: true }, price: 900 },
};

/** Relics carry another hero's trick: a charge, a volley, the woods, a second spell, Far Sight, a silver tongue. */
export const RELICS: ArtifactId[] = ['poachersHorn', 'greenwoodCloak', 'brannocsLance', 'twinWand', 'crystalBall', 'silverSignet'];
