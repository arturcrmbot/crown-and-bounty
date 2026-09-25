import type { Point } from '../rules/map/geometry';
import type { Province } from './types';

/** Map points of every place in the province, in pixels on the 40 x 30 tile map. */
const at = {
  castle: [1120, 212],
  tower: [290, 226],
  mine: [150, 196],
  mill: [818, 566],
  village: [966, 822],
  patrol: [404, 586],
  signpost: [520, 520],
  chest: [458, 702],
  gold: [640, 560],
  hideout: [104, 850],
  wolves: [256, 700],
} satisfies Record<string, Point>;

const paths: Point[][] = [
  // Watchtower, past the signpost and the hero, over the bridge to Westmere.
  [[292, 236], [330, 300], [380, 362], [440, 430], [500, 510], [540, 590], [592, 660], [650, 706], [700, 724], [762, 742], [842, 772], [930, 800]],
  // Castle down through the cliff gap to Westmere.
  [[1112, 214], [1080, 282], [1030, 334], [992, 404], [970, 480], [954, 580], [944, 680], [936, 790]],
  // From the signpost south-west into Darkwood.
  [[500, 512], [432, 560], [344, 622], [254, 700], [172, 780], [80, 862]],
  // A spur from the tower path up to the mine.
  [[330, 300], [262, 250], [200, 214], [150, 196]],
];

const hero: Point = [546, 612];

/** The first province: Aldmoor, where Baron Grimsby has gone to ground with the royal goose. */
export const ALDMOOR: Province = {
  id: 'aldmoor',
  name: 'Aldmoor',
  width: 40 * 32,
  height: 30 * 32,
  river: [
    [900, -20], [872, 70], [904, 170], [880, 270], [848, 350], [828, 420], [812, 480],
    [786, 548], [748, 620], [712, 700], [690, 780], [660, 860], [640, 990],
  ],
  cliff: { line: [[640, 452], [700, 440], [760, 436], [830, 440], [900, 432], [952, 420]], height: 24 },
  paths,
  forests: [
    [140, 560, 200, 230],
    [1010, 110, 100, 90],
    [1140, 670, 170, 170],
    [420, 930, 250, 100],
    // Joins Darkwood to the south wood, so the road past the wolves is the only way to Grimsby.
    [300, 810, 120, 70],
    [700, 300, 78, 56],
    [1236, 150, 70, 90],
  ],
  crags: [
    [60, 110, 120, 86], [170, 90, 130, 96], [290, 104, 120, 84], [400, 80, 128, 92], [520, 96, 110, 76], [610, 70, 90, 64],
    [110, 150, 90, 56], [460, 136, 80, 50],
    [236, 262, 50, 32], [346, 256, 40, 26],
    [676, 444, 46, 30], [744, 436, 36, 24], [916, 426, 44, 30],
    [1236, 360, 60, 46], [1206, 470, 54, 40],
  ],
  trees: [
    [1040, 250, false], [1188, 262, false], [1172, 290, true],
    [1000, 760, false], [884, 790, false], [1080, 842, true],
    [478, 694, false], [612, 520, false], [872, 604, true], [884, 522, true], [380, 420, false],
  ],
  rocks: [[258, 244, 8], [320, 250, 6], [270, 276, 5], [188, 222, 7], [206, 236, 5], [620, 610, 5], [960, 540, 6], [1062, 300, 5]],
  decor: [
    { sprite: 'hut', at: [968, 772], place: 'village', seed: 3 },
    { sprite: 'hut', at: [1016, 818], place: 'village', seed: 4 },
    { sprite: 'hut', at: [904, 838], place: 'village', seed: 5 },
    { sprite: 'hut', at: [1050, 770], place: 'village', seed: 6 },
  ],
  hero,
  explored: {
    trails: [paths[1], paths[0].slice(4)],
    trailRadius: 120,
    discs: [[at.castle[0], at.castle[1], 170], [hero[0], hero[1], 190]],
  },
  locations: [
    { id: 'castle', kind: 'castle', name: 'Castle Aldmoor', at: at.castle, done: false, recruits: { troop: 'knights', count: 5, price: 100 } },
    { id: 'tower', kind: 'tower', name: 'Old Watchtower', at: at.tower, done: false, reveals: at.hideout },
    { id: 'mine', kind: 'mine', name: 'Old Mine', at: at.mine, done: false, gold: 400 },
    { id: 'village', kind: 'village', name: 'Westmere', at: at.village, done: false, recruits: { troop: 'peasants', count: 20, price: 10 } },
    { id: 'mill', kind: 'mill', name: 'Westmere Mill', at: at.mill, done: false },
    { id: 'signpost', kind: 'signpost', name: 'Signpost', at: at.signpost, done: false },
    { id: 'chest', kind: 'chest', name: 'Treasure Chest', at: at.chest, done: false, gold: 500 },
    { id: 'gold', kind: 'gold', name: 'Pile of Gold', at: at.gold, done: false, gold: 250 },
    {
      id: 'patrol',
      kind: 'patrol',
      name: 'Grimsby\u2019s Patrol',
      at: at.patrol,
      done: false,
      enemy: {
        look: 'soldiers',
        lines: ['About **24 swordsmen** and **16 crossbowmen**.', 'They have goose feathers in their helmets.'],
        army: [{ troop: 'swordsmen', count: 24 }, { troop: 'crossbowmen', count: 16 }],
        reward: 300,
        threat: 'They level their spears.',
        flees: 'Grimsby\u2019s patrol breaks and runs for Darkwood.',
        loot: 'You find {gold} on the road.',
      },
    },
    {
      id: 'hideout',
      kind: 'hideout',
      name: 'Grimsby\u2019s Hideout',
      at: at.hideout,
      done: false,
      enemy: {
        look: 'stockade',
        lines: ['A muddy stockade deep in Darkwood. Someone inside is honking.', 'About **36 swordsmen**, **18 crossbowmen** and one Baron.'],
        army: [{ troop: 'swordsmen', count: 36 }, { troop: 'crossbowmen', count: 18 }, { troop: 'baron', count: 1 }],
        reward: 2000,
        threat: 'The Baron shouts from the palisade: *"I have the goose AND the walls!"*',
        flees: 'The stockade gate falls open.',
        loot: 'The Crown pays {gold}.',
      },
    },
    {
      id: 'wolves',
      kind: 'patrol',
      name: 'Wolf Pack',
      at: at.wolves,
      done: false,
      enemy: {
        look: 'wolves',
        lines: ['About **32 wolves** are sitting on the path like they own it.', 'Your archers are pretending not to have seen them.'],
        army: [{ troop: 'wolves', count: 32 }],
        reward: 150,
        threat: 'They bare their teeth. One of them yawns, which is somehow worse.',
        flees: 'The pack scatters into Darkwood.',
        loot: 'You find {gold} the wolves were, somehow, guarding.',
      },
    },
  ],
};
