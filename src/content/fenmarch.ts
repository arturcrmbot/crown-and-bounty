import type { Point } from '../rules/map/geometry';
import type { Province } from './types';

/** Map points of every place in the Fenmarch, in pixels on the 40 x 30 tile map. */
const at = {
  keep: [1118, 200],
  abbey: [318, 528],
  peathut: [138, 706],
  village: [612, 438],
  windmill: [990, 524],
  signpost: [398, 300],
  chest: [770, 640],
  chest2: [196, 590],
  gold: [470, 402],
  gold2: [1046, 772],
  goblins: [552, 590],
  troll: [902, 744],
  hideout: [1160, 866],
} satisfies Record<string, Point>;

const paths: Point[][] = [
  // The King's road from the north, past the signpost to Eelby.
  [[176, -10], [182, 60], [196, 140], [240, 210], [310, 262], [398, 300], [470, 342], [540, 384], [600, 414]],
  // Eelby east over the river to Harrowgate Keep.
  [[600, 414], [680, 402], [760, 382], [830, 358], [900, 336], [970, 302], [1040, 252], [1100, 214], [1118, 202]],
  // From the signpost down the causeway to the abbey.
  [[398, 300], [364, 362], [336, 430], [322, 496], [318, 528]],
  // Eelby south along the causeway, past the goblins, over the troll's bridge to Mother Mirrow.
  [[600, 414], [592, 480], [566, 540], [552, 590], [556, 650], [606, 696], [690, 720], [772, 730], [846, 736], [916, 744], [990, 764], [1060, 804], [1124, 844], [1160, 866]],
  // A lane down the east bank to the windmill.
  [[970, 302], [992, 380], [1000, 452], [990, 524]],
  // The peat cutters' track, west from the abbey.
  [[318, 528], [262, 584], [204, 642], [138, 706]],
];

const hero: Point = [198, 150];

/** The second province: the Fenmarch, all reeds and meres, where Mother Mirrow keeps her newt. */
export const FENMARCH: Province = {
  id: 'fenmarch',
  name: 'the Fenmarch',
  width: 40 * 32,
  height: 30 * 32,
  river: [
    [850, -20], [872, 60], [846, 150], [866, 240], [900, 320], [884, 410], [858, 500],
    [876, 590], [906, 680], [900, 770], [868, 860], [884, 990],
  ],
  cliff: null,
  paths,
  forests: [
    [80, 330, 90, 170],
    [620, 170, 150, 70],
    [460, 96, 90, 60],
    [1070, 424, 70, 50],
    [1222, 360, 70, 150],
    // The alder carr that closes the east bank south of the windmill, with the meres below.
    [1110, 610, 210, 50],
    [60, 890, 110, 80],
    [1240, 936, 90, 60],
  ],
  pools: [
    [226, 446, 58, 32],
    [472, 520, 66, 38],
    [420, 690, 110, 50],
    [240, 806, 160, 62],
    [660, 826, 128, 50],
    [724, 566, 58, 30],
    [690, 472, 42, 20],
    // Two meres that run from the river to the eastern edge: the only way south is the troll's bridge.
    [990, 626, 140, 38],
    [1190, 616, 116, 46],
    [1000, 906, 110, 40],
    [1236, 790, 60, 64],
  ],
  woods: { pine: 0.3, willow: 0.6 },
  fen: true,
  crags: [],
  trees: [
    [300, 180, false], [420, 250, false], [760, 300, false], [540, 460, false], [660, 640, false],
    [1000, 170, false], [1180, 250, true], [1030, 700, false], [1200, 720, false], [380, 580, false],
  ],
  rocks: [[250, 300, 6], [700, 360, 5], [1150, 300, 6], [500, 650, 5], [1100, 760, 6]],
  decor: [
    { sprite: 'hut', at: [566, 432], place: 'village', seed: 11 },
    { sprite: 'hut', at: [652, 452], place: 'village', seed: 12 },
    { sprite: 'hut', at: [596, 480], place: 'village', seed: 13 },
    { sprite: 'hut', at: [640, 404], place: 'village', seed: 14 },
  ],
  hero,
  explored: {
    trails: [paths[0]],
    trailRadius: 120,
    discs: [[hero[0], hero[1], 200]],
  },
  locations: [
    {
      id: 'keep',
      kind: 'castle',
      name: 'Harrowgate Keep',
      at: at.keep,
      done: false,
      recruits: { troop: 'knights', count: 6, price: 110 },
      wares: ['harrowgateMail', 'fenBanner', 'astrolabe', 'helmOfFarSight'],
      text: { about: ['The King\u2019s keep in the Fenmarch, damp to the battlements.', 'The castellan wears waders indoors.', 'Knights to recruit, and an armoury.'] },
    },
    {
      id: 'abbey',
      kind: 'tower',
      look: 'abbey',
      name: 'St Wendel\u2019s Abbey',
      at: at.abbey,
      done: false,
      reveals: at.hideout,
      artifact: 'abbotsStaff',
      text: {
        about: ['A ruined abbey on a hump of dry ground.', '*Someone has been lighting candles in the cloister.*'],
        done: ['The candles are out. A heron has taken over the pulpit.'],
        visit: ['The last monk, Brother Anselm, is still here, praying for drier weather. He points south-east: *"The witch lives past the troll\u2019s bridge, in a hut on legs. The legs are the worst part."*'],
      },
    },
    {
      id: 'peathut',
      kind: 'mine',
      look: 'peathut',
      name: 'Peat Cutters\u2019 Hut',
      at: at.peathut,
      done: false,
      gold: 500,
      artifact: 'eelskinBoots',
      text: {
        about: ['Stacks of peat, and a hut sinking gently into the fen.', 'Nobody has answered the door in weeks.'],
        done: ['The door swings in the wind. The peat stacks have not moved.'],
        visit: ['The cutters fled from the goblins and left their wages behind: **{gold} gold** in a tin box.', 'And by the stove, a pair of boots that fit you perfectly, which is suspicious.'],
      },
    },
    {
      id: 'village',
      kind: 'village',
      name: 'Eelby',
      at: at.village,
      done: false,
      recruits: { troop: 'archers', count: 14, price: 40 },
      text: { about: ['A fishing village on stilts and optimism.', 'Fen folk shoot straight. They have to: the eels are fast.'] },
    },
    {
      id: 'windmill',
      kind: 'mill',
      look: 'windmill',
      name: 'Fen Windmill',
      at: at.windmill,
      done: false,
      artifact: 'goblinCharm',
      text: {
        about: ['It pumps the fen dry, one bucket at a time.'],
        done: ['"Come back next week, officer. The fen came back first."'],
        visit: ['"Dry lanes for the King\u2019s men!" The miller opens every sluice, and your troops march on firm ground.', 'She found a goblin charm in the pump, and is glad to be rid of it.'],
      },
    },
    {
      id: 'signpost',
      kind: 'signpost',
      name: 'Signpost',
      at: at.signpost,
      done: false,
      text: {
        about: [
          '**SOUTH-WEST:** St Wendel\u2019s Abbey.',
          '**EAST:** Eelby, and Harrowgate Keep over the river.',
          '**SOUTH:** the deep fen, and Mother Mirrow, who turned the King\u2019s tax collector into a newt.',
        ],
      },
    },
    { id: 'chest', kind: 'chest', name: 'Treasure Chest', at: at.chest, done: false, gold: 700 },
    { id: 'chest2', kind: 'chest', name: 'Treasure Chest', at: at.chest2, done: false, gold: 600 },
    { id: 'gold', kind: 'gold', name: 'Pile of Gold', at: at.gold, done: false, gold: 350 },
    { id: 'gold2', kind: 'gold', name: 'Pile of Gold', at: at.gold2, done: false, gold: 500 },
    {
      id: 'goblins',
      kind: 'patrol',
      name: 'Bog Goblins',
      at: at.goblins,
      done: false,
      enemy: {
        look: 'goblins',
        lines: ['A great many **bog goblins**, squabbling over a boot.', 'They stop squabbling when they see your horse.'],
        army: [{ troop: 'goblins', count: 180 }],
        reward: 400,
        threat: 'They giggle, which is worse than shouting.',
        flees: 'The goblins scatter into the reeds, still arguing about the boot.',
        loot: 'You find {gold} in a hollow log.',
      },
    },
    {
      id: 'troll',
      kind: 'patrol',
      name: 'The Bridge Troll',
      at: at.troll,
      done: false,
      artifact: 'trollhide',
      enemy: {
        look: 'troll',
        lines: ['A troll sits on the only bridge south, with a few friends and a lot of goblins.', '*"Toll is one horse,"* it says. *"Or two knights."*'],
        army: [{ troop: 'trolls', count: 12 }, { troop: 'goblins', count: 60 }],
        reward: 600,
        threat: 'The troll stands up. It keeps standing up for a while.',
        flees: 'The trolls wade off downstream, grumbling about the toll.',
        loot: 'Under the bridge: {gold} in old tolls.',
      },
      text: { done: ['The bridge is free. It creaks with relief.'] },
    },
    {
      id: 'hideout',
      kind: 'hideout',
      look: 'stilthut',
      name: 'Mother Mirrow\u2019s Hut',
      at: at.hideout,
      done: false,
      enemy: {
        look: 'stockade',
        charge: 'Storm the hut',
        lines: ['A hut on long chicken legs, deep in the fen. Something inside is croaking.', 'Trolls doze under it, and goblins everywhere else.'],
        army: [{ troop: 'trolls', count: 18 }, { troop: 'goblins', count: 220 }, { troop: 'witch', count: 1 }],
        reward: 3000,
        threat: 'Mother Mirrow leans out of the window. *"Newts are happier, dearie. Ask him."*',
        flees: 'The hut sits down with a thump.',
        loot: 'The Crown pays {gold}.',
      },
      text: { done: ['The hut is empty, apart from a great many jars.'] },
    },
  ],
};
