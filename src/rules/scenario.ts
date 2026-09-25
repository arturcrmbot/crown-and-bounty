import { MOVEMENT_PER_DAY, type GameState, type Location, type Point } from './game';

/** The look-test province. Positions are map pixels on the 40 x 30 tile map. */
export const PLACES = {
  castle: [1120, 212],
  tower: [290, 226],
  mine: [150, 196],
  mill: [818, 566],
  village: [966, 822],
  hero: [546, 612],
  patrol: [404, 586],
  signpost: [520, 520],
  chest: [458, 702],
  gold: [640, 560],
  hideout: [104, 850],
} satisfies Record<string, Point>;

const LOCATIONS: Location[] = [
  { id: 'castle', kind: 'castle', name: 'Castle Aldmoor', at: PLACES.castle, done: false, recruits: { troop: 'knights', count: 5, price: 100 } },
  { id: 'tower', kind: 'tower', name: 'Old Watchtower', at: PLACES.tower, done: false, reveals: PLACES.hideout },
  { id: 'mine', kind: 'mine', name: 'Old Mine', at: PLACES.mine, done: false, gold: 400 },
  { id: 'village', kind: 'village', name: 'Westmere', at: PLACES.village, done: false, recruits: { troop: 'peasants', count: 20, price: 10 } },
  { id: 'mill', kind: 'mill', name: 'Westmere Mill', at: PLACES.mill, done: false },
  { id: 'signpost', kind: 'signpost', name: 'Signpost', at: PLACES.signpost, done: false },
  { id: 'chest', kind: 'chest', name: 'Treasure Chest', at: PLACES.chest, done: false, gold: 500 },
  { id: 'gold', kind: 'gold', name: 'Pile of Gold', at: PLACES.gold, done: false, gold: 250 },
  {
    id: 'patrol',
    kind: 'patrol',
    name: 'Grimsby\u2019s Patrol',
    at: PLACES.patrol,
    done: false,
    enemy: { lines: ['About **18 swordsmen** and **12 archers**.', 'They have goose feathers in their helmets.'], power: 90, reward: 300 },
  },
  {
    id: 'hideout',
    kind: 'hideout',
    name: 'Grimsby\u2019s Hideout',
    at: PLACES.hideout,
    done: false,
    enemy: { lines: ['A muddy stockade deep in Darkwood. Someone inside is honking.', 'About **40 swordsmen**, **20 archers** and one Baron.'], power: 210, reward: 2000 },
  },
];

export function newGame(seed = 1066): GameState {
  return {
    day: 1,
    gold: 1250,
    leadership: 120,
    army: { knights: 12, archers: 25, peasants: 0 },
    movement: MOVEMENT_PER_DAY,
    seed,
    locations: LOCATIONS.map((l) => ({ ...l })),
    bounty: 'open',
  };
}
