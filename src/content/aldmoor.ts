import { nearest, smooth, type Point } from '../rules/map/geometry';
import { hash, rng } from '../rules/noise';
import type { ContentChoice, Location } from '../rules/state';
import { FINDS } from './aldmoorFinds';
import type { Province, Region } from './types';

/** Aldmoor is 100 by 75 tiles of 32 pixels: a day's ride on a road crosses about a third of it. */
const W = 100 * 32;
const H = 75 * 32;

/**
 * Map points of every place in the province, in pixels. The land is laid out as in the sketch
 * (`docs/act1/aldmoor.svg`): the farmland round Castle Aldmoor and Westmere in the middle of the east,
 * the downs to the north-east, the King's chase to the south-east, the crags along the north, the heath
 * west of the river and Darkwood in the south-west, where Grimsby has his stockade.
 */
const at = {
  castle: [2520, 864],
  signpost: [2462, 912],
  shrine: [2912, 930],
  gold: [2990, 1192],
  chest: [2992, 500],
  butts: [2356, 1150],
  village: [2104, 1392],
  mill: [1680, 1182],
  well: [1502, 1252],
  nan: [2300, 1846],
  hall: [1872, 1624],
  lodge: [2652, 2092],
  bears: [2476, 2020],
  falconer: [566, 1090],
  poachers: [2816, 1488],
  boars: [2688, 1664],
  cache: [1768, 1716],
  patrol: [1670, 1466],
  highwaymen: [1296, 1044],
  tower: [1032, 812],
  mine: [1264, 312],
  wolves: [1040, 1472],
  delving: [640, 1718],
  hideout: [320, 2128],
  mrsPike: [2210, 1372],
  diggings: [620, 470],
} satisfies Record<string, Point>;

/** Where the hero comes up at each end of the dwarf's old delving: beside its mouth, where he can be seen. */
const DELVING_NORTH: Point = [1212, 330];
const DELVING_SOUTH: Point = [668, 1744];

/** The patrol's size: a gate that holds the bridge for about a week (see `rules/difficulty.ts` and `docs/BALANCE.md`). */
const PATROL = { swordsmen: 70, crossbowmen: 40 };

/** The old King's huntsmen, waiting at his hunt hall for someone to open it. */
const HUNTSMEN = 12;

/** What Old Nan's word shows of the chase: the lodge, and what sleeps on the track to it. */
const LODGE_VIEW: Point = [2570, 2056];

/** Where Grimsby's men make camp once they've had enough of him: beaten, or sent home with his orders. */
const DESERTERS: Location = {
  id: 'deserters',
  kind: 'village',
  look: 'camp',
  name: 'Deserters\u2019 Camp',
  at: [1578, 1560],
  done: false,
  recruits: { troop: 'swordsmen', count: 12, price: 60 },
  text: { about: ['Grimsby\u2019s former men are sharpening their swords and their excuses.', 'You can hire swordsmen here.'] },
};

/** The same camp when Sergeant Pike brings the whole patrol home to Westmere: more of them, and in a better mood. */
const PIKES_CAMP: Location = {
  ...DESERTERS,
  name: 'Pike\u2019s Camp',
  at: [2036, 1512],
  recruits: { troop: 'swordsmen', count: 20, price: 60 },
  text: { about: ['The Baron\u2019s old patrol has camped on Westmere green, where their mothers can keep an eye on them.', 'You can hire swordsmen here.'] },
};

/**
 * Grimsby and his guard, riding out of the stockade's gate when the King's man hurts him (see the
 * hideout's `sortie`). He comes for the hero along the roads on his best pony, whatever the odds, as
 * far as the heath and the old bridge, and goes home when he can't find him.
 */
const GRIMSBY_RIDES: Location = {
  id: 'grimsby',
  kind: 'patrol',
  name: 'Grimsby and his Guard',
  at: [298, 2168],
  done: false,
  enemy: {
    look: 'soldiers',
    behaviour: 'hunt',
    bold: true,
    range: 1200,
    sight: 1800,
    pace: 80,
    patience: 7,
    lines: ['Baron Grimsby is out on his best pony, with the goose under one arm and his guard at his back. He means to teach the King\u2019s man a lesson.'],
    army: [],
    reward: 400,
    threat: '*"There he is!"* shouts the Baron, pointing with the goose. *"Get him!"*',
    lastWords: 'A strategic retreat! Hold on tight, goose!',
    flees: 'The Baron gallops home to his stockade, the goose under his arm, and his guard limps after him.',
    loot: 'In the mud where he turned his pony you find {gold}, the guard\u2019s pay.',
  },
};

/** What Old Nan does for the King's man, whatever else she has told him: her charms, for gold or a wolf pelt. */
const NAN_CHARMS: ContentChoice[] = [
  {
    id: 'stone',
    label: 'Learn Stone Skin',
    needs: { gold: 300, notSpell: 'stoneskin' },
    effects: { spell: 'stoneskin' },
    lines: ['She taps your men\u2019s shields with a wooden spoon. They go grey, and very hard. *"That\u2019ll keep the arrows out."*'],
  },
  {
    id: 'fire',
    label: 'Give her the wolf pelt',
    needs: { flag: 'wolfpelt', notSpell: 'fireball' },
    effects: { spell: 'fireball', flags: { wolfpelt: false } },
    lines: ['*"Ooh, that\u2019s a warm one."* She wraps herself in it, and shows you how to set the air on fire. *"Mind your own lads, mind."*'],
  },
];
const NAN_LEAVE: ContentChoice = { id: 'leave', label: 'Ride on', lines: ['You leave her to her cauldron. Something in it winks at you.'] };
/**
 * What Old Nan knows of the old King's hunt hall, once Aldric has seen it shut: where its key is, and
 * what's in the way. `nanHall` keeps, for the journal, that she told him, once the key sets `lodge`.
 */
const NAN_HALL: ContentChoice = {
  id: 'hall',
  label: 'Ask her about the old King\u2019s hunt hall',
  when: { seen: 'hall', notFlag: 'lodge' },
  effects: { flags: { lodge: 'told', nanHall: true }, reveal: { at: LODGE_VIEW, radius: 130 } },
  lines: [
    '*"The old King\u2019s hall? Shut up since he died, bless him. He kept the key at his lodge in the chase, on a nail by the door."*',
    '*"Take the track past my back door. There\u2019s a bear sleeps on it now, dearie. Well. Some bears. Mind them."*',
  ],
};

/** The roads, as the sketch has them. The river crosses two of them: at the old bridge, and at the ford. */
const roads = {
  // The King's road, in from the east edge, past St Aldhelm's shrine to the castle.
  king: [[3232, 1072], [3100, 1046], [3000, 1022], [2900, 990], [2800, 958], [2700, 922], [2610, 890], [2532, 870]],
  // The castle down through the fields to Westmere.
  westmere: [[2500, 876], [2462, 936], [2420, 1000], [2384, 1056], [2330, 1130], [2270, 1210], [2224, 1280], [2160, 1346], [2104, 1388]],
  // Westmere west over the old bridge, past the crossroads, to the kennels at the edge of Darkwood.
  bridge: [[2104, 1392], [2040, 1422], [1960, 1442], [1880, 1456], [1800, 1464], [1740, 1466], [1670, 1464], [1600, 1470], [1544, 1488], [1460, 1510], [1370, 1528], [1280, 1530], [1180, 1510], [1100, 1488], [1040, 1472]],
  // On from the kennels, through Darkwood, round to the gate of Grimsby's stockade.
  darkwood: [[1040, 1472], [980, 1520], [900, 1600], [820, 1690], [730, 1780], [640, 1870], [550, 1960], [470, 2050], [420, 2128], [376, 2168], [340, 2164], [322, 2138]],
  // The crossroads north over the heath, past the watchtower, to the crags.
  heath: [[1544, 1488], [1520, 1400], [1480, 1300], [1420, 1200], [1350, 1100], [1280, 1030], [1190, 960], [1100, 900], [1010, 846], [920, 760], [840, 670], [770, 590], [700, 530]],
  // The castle north-west through the downs, over the ford, the long way round.
  ford: [[2466, 890], [2420, 836], [2370, 770], [2310, 690], [2240, 612], [2160, 544], [2076, 482], [1990, 432], [1900, 396], [1830, 370], [1769, 360], [1700, 366], [1620, 378], [1520, 392]],
  // Over the ford to the dwarf's old mine.
  mine: [[1520, 392], [1450, 372], [1380, 348], [1310, 326], [1266, 318]],
  // Over the ford along the foot of the crags, west across the heath.
  crags: [[1520, 392], [1420, 426], [1300, 456], [1180, 476], [1060, 494], [940, 512], [820, 524], [700, 530]],
  // The way Grimsby rides out: from his gate, through Darkwood and up the west of the heath.
  grimsby: [[700, 530], [620, 640], [540, 780], [460, 940], [390, 1120], [330, 1320], [292, 1520], [274, 1700], [270, 1880], [258, 2000], [244, 2090], [258, 2160], [298, 2168], [318, 2140]],
  // Westmere south to Old Nan's, at the edge of the King's chase.
  nan: [[2104, 1392], [2118, 1480], [2146, 1580], [2186, 1680], [2226, 1770], [2262, 1846]],
  // On past Old Nan's back door, into the King's chase, to the old King's hunting lodge.
  lodge: [[2262, 1846], [2282, 1896], [2330, 1944], [2400, 1986], [2476, 2020], [2548, 2052], [2604, 2082], [2644, 2098]],
  // A track off Grimsby's road, out across the heath to the old King's falconer.
  falconer: [[406, 1080], [450, 1084], [500, 1090], [548, 1094]],
  // A lane off the bridge road down to the old King's hunt hall.
  hall: [[1880, 1456], [1884, 1520], [1878, 1580], [1872, 1628]],
  // Westmere north-west to the mill on the river.
  mill: [[2104, 1388], [2046, 1330], [1976, 1272], [1900, 1226], [1812, 1198], [1736, 1188], [1700, 1186]],
  // A lane off the King's road, up into the downs.
  downs: [[2800, 958], [2826, 860], [2862, 760], [2910, 650], [2958, 560], [2988, 510]],
  // A cart track off the Darkwood road to the dwarf's old delving.
  delving: [[730, 1780], [700, 1756], [668, 1740], [646, 1724]],
  // Off the heath road, to where Grimsby's men are digging for the old King's treasure.
  dig: [[700, 530], [676, 508], [648, 490], [626, 476]],
} satisfies Record<string, Point[]>;

const paths: Point[][] = Object.values(roads);

/** The grain cart's way from Westmere to Grimsby's stockade: over the old bridge, past the kennels, and through Darkwood. */
const CART_ROAD: Point[] = [...roads.bridge.slice(1), ...roads.darkwood.slice(1)];

/** The river, north to south: the only ways over are the old bridge and the ford. */
const river: Point[] = [[1760, -80], [1808, 240], [1696, 560], [1776, 880], [1632, 1200], [1672, 1456], [1536, 1760], [1456, 2080], [1392, 2480]];

/** Woods as ellipses, with their share of pines: dark Darkwood, the oaks of the King's chase, a copse on the downs, and spinneys between. */
const forests: [number, number, number, number, number?][] = [
  // Darkwood.
  [300, 1720, 330, 420, 0.95],
  [560, 2130, 520, 300, 0.95],
  [800, 1860, 260, 260, 0.95],
  [620, 1520, 240, 180, 0.9],
  [1060, 2190, 250, 230, 0.9],
  [150, 1360, 170, 150, 0.9],
  // The King's chase.
  [2700, 2190, 560, 260, 0.35],
  [3060, 1700, 200, 420, 0.35],
  [2250, 2240, 300, 200, 0.35],
  [2440, 2000, 190, 130, 0.3],
  [1990, 2180, 230, 220, 0.35],
  // On the downs.
  [2870, 300, 180, 130, 0.5],
  [2620, 180, 120, 90, 0.5],
  // Spinneys on the heath and among the fields.
  [860, 1210, 120, 80],
  [1400, 640, 90, 60],
  [2710, 700, 70, 50],
  [2560, 1310, 90, 60],
];

/** The fields round the castle and Westmere, the downs to the north-east, and the heath west of the river. */
const regions: Region[] = [
  { kind: 'fields', at: [2540, 990, 430, 280] },
  { kind: 'fields', at: [2150, 1360, 360, 270] },
  { kind: 'fields', at: [2780, 1290, 250, 190] },
  { kind: 'fields', at: [1900, 1250, 220, 170] },
  { kind: 'fields', at: [1930, 1620, 190, 140] },
  { kind: 'downs', at: [2860, 380, 560, 340] },
  { kind: 'downs', at: [2210, 420, 330, 210] },
  { kind: 'heath', at: [800, 900, 820, 480] },
  // Where Grimsby's men dig, just under the crags.
  { kind: 'heath', at: [640, 530, 250, 120] },
  { kind: 'heath', at: [1320, 1240, 300, 260] },
  { kind: 'heath', at: [1380, 1920, 230, 440] },
];

const smoothRoads = paths.map((p) => smooth(p));
const smoothRiver = smooth(river);
const places = Object.values(at);
const clearOf = ([x, y]: Point, road: number, water: number, place: number) =>
  smoothRoads.every((r) => nearest(r, x, y).d > road) && nearest(smoothRiver, x, y).d > water && places.every(([px, py]) => Math.hypot(px - x, py - y) > place);
const riverX = (y: number) => {
  for (let i = 0; i < smoothRiver.length - 1; i++) {
    const [ax, ay] = smoothRiver[i];
    const [bx, by] = smoothRiver[i + 1];
    if (y >= ay && y <= by) return ax + ((bx - ax) * (y - ay)) / (by - ay);
  }
  return smoothRiver[smoothRiver.length - 1][0];
};
const inWoods = ([x, y]: Point) => forests.some(([cx, cy, rx, ry]) => Math.hypot((x - cx) / rx, (y - cy) / ry) < 1.25);
/** Clear of the small finds along the rides (#124) too: only what would stand on one goes, so nothing else moves. */
const byNoFind = (place: number) => ([x, y]: readonly [number, number, ...unknown[]]) => FINDS.every(({ at: [fx, fy] }) => Math.hypot(fx - x, fy - y) > place);

/** Points on a jittered grid `step` apart, from a fixed seed, where `keep` says. */
function scatter(seed: number, step: number, keep: (p: Point, r: () => number) => boolean): Point[] {
  const random = rng(seed);
  const out: Point[] = [];
  for (let y = step / 2; y < H; y += step) {
    for (let x = step / 2; x < W; x += step) {
      const p: Point = [Math.round(x + (random() - 0.5) * step * 0.8), Math.round(y + (random() - 0.5) * step * 0.8)];
      if (keep(p, random)) out.push(p);
    }
  }
  return out;
}

/**
 * How high the land stands: 1 in the crags along the north, less in the downs to the north-east,
 * nothing in the fields, on the heath or in the woods.
 */
function height([x, y]: Point): number {
  const wobble = (hash(Math.floor(x / 120), 0, 7) - 0.5) * 70;
  if (x < riverX(y) - 40) return Math.max(0, Math.min(1, (470 + wobble - y) / 120));
  if (x < 2440) return Math.max(0, Math.min(1, (420 + wobble - (x - 1800) * 0.18 - y) / 140));
  return y < 620 ? 0.16 : 0;
}

/** The crags: a range of rock along the north, cut by the river, with the downs' tors to the east. */
const crags: [number, number, number, number][] = scatter(29, 96, (p, r) => r() < height(p) && clearOf(p, 46, 60, 90) && !inWoods(p)).map(([x, y], i) => {
  const big = 1 - y / 600;
  return [x, y, Math.round(70 + hash(i, 1, 30) * 50 + big * 20), Math.round(48 + hash(i, 2, 30) * 36 + big * 22)] as [number, number, number, number];
}).filter(byNoFind(90));

/** Lone trees in the fields and on the heath, and boulders on the heath and the downs. */
const trees: [number, number, boolean][] = scatter(31, 170, (p, r) => r() < 0.3 && height(p) === 0 && clearOf(p, 18, 30, 60) && !inWoods(p))
  .map(([x, y], i): [number, number, boolean] => [x, y, hash(i, 3, 31) < 0.4])
  .filter(byNoFind(60));
const rocks: [number, number, number][] = scatter(37, 150, (p, r) => r() < (p[0] < riverX(p[1]) ? 0.3 : 0.12) && clearOf(p, 14, 30, 50) && !inWoods(p))
  .map(([x, y], i): [number, number, number] => [x, y, Math.round(5 + hash(i, 4, 37) * 4)])
  .filter(byNoFind(50));

const hero: Point = [3100, 1046];

/** Aldmoor's lands, as the sketch names them (`docs/act1/aldmoor.svg`). */
export const LANDS = { fields: 'the fields', downs: 'the downs', crags: 'the crags', heath: 'the heath', darkwood: 'Darkwood', chase: 'the King\u2019s chase' } as const;
export type Land = keyof typeof LANDS;

const darkwood = forests.filter(([, , , , pines]) => (pines ?? 0) >= 0.9);

/**
 * Which of Aldmoor's lands a point is in: the crags along the north, down to the road at their foot;
 * west of the river the heath, with Darkwood south of it; east of it the downs, the fields round the
 * castle and Westmere, and the King's chase in the south. For saying where a long ride is
 * (`rules/map/rides.ts`).
 */
export function landOf([x, y]: Point): Land {
  if (x < riverX(y)) return y < 540 ? 'crags' : darkwood.some(([cx, cy, rx, ry]) => Math.hypot((x - cx) / rx, (y - cy) / ry) < 1.15) ? 'darkwood' : 'heath';
  if (y < 330 && x < 2440) return 'crags';
  return y < 760 ? 'downs' : y > 1760 ? 'chase' : 'fields';
}

/** The first province: Aldmoor, where Baron Grimsby has gone to ground with the royal goose. */
export const ALDMOOR: Province = {
  id: 'aldmoor',
  name: 'Aldmoor',
  width: W,
  height: H,
  river,
  // The river drops over a step in the crags above the ford.
  cliff: { line: [[1690, 214], [1750, 206], [1810, 200], [1870, 204], [1930, 214]], height: 24 },
  paths,
  forests,
  regions,
  // The long way round: the road wades the river below the falls.
  fords: [[1769, 360]],
  crags,
  trees,
  rocks,
  flocks: [[2880, 300], [900, 820], [2600, 2100]],
  decor: [
    { sprite: 'hut', at: [2098, 1330], place: 'village', seed: 3 },
    { sprite: 'hut', at: [2180, 1420], place: 'village', seed: 4 },
    { sprite: 'hut', at: [2044, 1464], place: 'village', seed: 5 },
    { sprite: 'hut', at: [2020, 1376], place: 'village', seed: 6 },
    { sprite: 'holes', at: [588, 452], place: 'diggings', seed: 7 },
    { sprite: 'holes', at: [660, 448], place: 'diggings', seed: 8 },
  ],
  hero,
  heroFacing: -1,
  explored: {
    trails: [roads.king],
    trailRadius: 120,
    discs: [[at.castle[0], at.castle[1], 180], [hero[0], hero[1], 200]],
  },
  locations: [
    {
      id: 'castle',
      kind: 'castle',
      name: 'Castle Aldmoor',
      at: at.castle,
      done: false,
      recruits: { troop: 'knights', count: 5, price: 100 },
      wares: ['swordOfAldmoor', 'breastplate', 'helmOfFarSight', 'luckyHorseshoe', 'spyglass', 'silverSignet', 'bonesDice'],
      text: { about: ['Your castle flies the King\u2019s banner.', 'The steward is pretending to count spoons.', 'You can recruit knights here, and there is an armoury.'] },
    },
    {
      id: 'tower',
      kind: 'tower',
      name: 'Old Watchtower',
      at: at.tower,
      done: false,
      text: {
        about: ['Nobody has kept watch here for nearly a century.', '*Something has disturbed the crows recently.*'],
        done: ['The tower is empty now, apart from some very offended crows.'],
      },
      pages: [
        {
          id: 'top',
          when: { notFlag: 'tower' },
          lines: [
            'At the top of the stairs, the crows are guarding an old soldier\u2019s things. One is his **banner**, moth-eaten and much loved, that archers rally to. The other is his **journal**, which is all about Grimsby and somebody called Pike.',
            '*The crows will let you take one. They are very clear about this.*',
          ],
          choices: [
            {
              id: 'banner',
              label: 'Take the banner',
              effects: { artifact: 'oldBanner', flags: { tower: 'banner' }, done: true },
              lines: ['The crows let it go with very bad grace. Your archers stand up straighter just looking at it.'],
            },
            {
              id: 'journal',
              label: 'Take the journal',
              effects: { reveal: { at: at.hideout, radius: 90 }, flags: { tower: 'journal', pike: true }, done: true },
              lines: [
                'The journal says, *"Grimsby rides south-west, into Darkwood. He sleeps with the goose."*',
                'On the last page he has written, *"My boy is a sergeant in the Baron\u2019s patrol now, God help him. If you see him, tell Pike his mother wants him home."*',
              ],
            },
            { id: 'leave', label: 'Leave them to the crows', lines: ['The crows watch you all the way down the stairs.'] },
          ],
        },
      ],
    },
    {
      id: 'mine',
      kind: 'mine',
      name: 'Old Mine',
      at: at.mine,
      done: false,
      text: {
        about: ['The rails lead into darkness.', 'Something down there is humming.'],
        done: ['The humming has stopped. The dwarf has asked you, twice, to leave.'],
      },
      pages: [
        {
          id: 'cart',
          when: { notFlag: 'dwarf' },
          lines: [
            'You find a forgotten ore cart, still full of ore worth a good **400 gold**. The humming is a dwarf, pushing it the wrong way up the rails.',
            '*"Mine,"* he says. *"Well. Nobody\u2019s. But mine."* He looks like someone who would remember a favour.',
          ],
          choices: [
            {
              id: 'take',
              label: 'Take the cart',
              effects: { treasure: 400, flags: { dwarf: 'robbed' }, done: true },
              lines: ['You push the cart out into the daylight. Behind you, the humming starts again, lower, and not at all friendly.'],
            },
            {
              id: 'help',
              label: 'Help him push it back down',
              effects: { artifact: 'dwarvenHelm', flags: { dwarf: 'friend', delving: true }, reveal: { at: at.delving, radius: 70 } },
              lines: [
                'It takes all afternoon. At the bottom, the dwarf gives you his spare helmet and a long look.',
                '*"A King\u2019s man with manners. Now then. The old delving runs south under the heath, and comes up in Darkwood, behind them wolves. Mind your head."*',
              ],
            },
          ],
        },
        {
          id: 'delving',
          when: { flag: 'delving' },
          lines: ['The dwarf nods at the rails. *"South, under the heath, and up in Darkwood behind the wolves. Takes all day."*'],
          choices: [
            {
              id: 'south',
              label: 'Ride the old delving south',
              effects: { travel: DELVING_SOUTH },
              lines: ['You ride the old delving all day, in the dark, with your head down. You come up in Darkwood at dusk, well behind the wolves.'],
            },
            { id: 'stay', label: 'Not today' },
          ],
        },
      ],
    },
    {
      id: 'delving',
      kind: 'mine',
      name: 'The Old Delving',
      at: at.delving,
      done: false,
      text: {
        about: ['An old mine mouth opens in the middle of Darkwood.', '*Somebody has bricked it up from the inside.*'],
        later: [{ when: { flag: 'delving' }, about: ['An old mine mouth opens in the middle of Darkwood.', '*The bricks are down, in a neat dwarfish pile. The rails run north into the dark.*'] }],
      },
      pages: [
        {
          id: 'shut',
          when: { notFlag: 'delving' },
          lines: ['The old mine mouth is bricked up from the inside. Somewhere behind the bricks, very faintly, somebody is humming.'],
          choices: [],
        },
        {
          id: 'open',
          when: { flag: 'delving' },
          lines: ['The bricks are down. The rails run north under the heath, all the way back to the Old Mine in the crags.'],
          choices: [
            {
              id: 'north',
              label: 'Ride the old delving north',
              effects: { travel: DELVING_NORTH },
              lines: ['You spend a long day in the dark, and come up at the Old Mine at dusk, where the dwarf pretends he hasn\u2019t been waiting.'],
            },
            { id: 'stay', label: 'Not today' },
          ],
        },
      ],
    },
    { id: 'village', kind: 'village', name: 'Westmere', at: at.village, done: false, recruits: { troop: 'peasants', count: 20, price: 10 }, text: { about: ['The 340 people of Westmere are friendly, if nosy.'] } },
    {
      id: 'mrsPike',
      kind: 'event',
      look: 'house',
      name: 'Mrs Pike\u2019s Cottage',
      at: at.mrsPike,
      done: false,
      text: { about: ['A neat cottage on Westmere green has a sergeant\u2019s coat on the washing line.', '*It hasn\u2019t been worn in a while.*'] },
      pages: [
        {
          id: 'home',
          when: { flag: 'pikeHome', notFlag: 'mrsPike' },
          lines: [
            'Mrs Pike opens the door before you knock. Her boy is at the table behind her, on his third breakfast.',
            '*"You brought him home. With his father\u2019s journal, of all things."* She\u2019d like to thank you properly, with her late husband\u2019s **lucky horseshoe** off the door, or with a **word** in the right ears round Westmere.',
          ],
          choices: [
            {
              id: 'horseshoe',
              label: 'Take the old sergeant\u2019s horseshoe',
              needs: { notArtifact: 'luckyHorseshoe' },
              effects: { artifact: 'luckyHorseshoe', xp: 100, flags: { mrsPike: 'horseshoe' } },
              lines: ['She takes it down from over the door. *"Never did him a bit of good. Then again, he never rode anywhere."*'],
            },
            {
              id: 'word',
              label: 'Let her tell Westmere',
              effects: { leadership: 20, xp: 100, flags: { mrsPike: 'word' } },
              lines: ['By teatime every mother in Westmere knows who brought Mrs Pike\u2019s boy home, and her sons are asking where to sign.'],
            },
          ],
        },
        { id: 'fed', when: { flag: 'mrsPike' }, lines: ['Mrs Pike is feeding her boy, his patrol, and anyone else who stands still long enough.'], choices: [] },
        {
          id: 'gone',
          when: { flag: 'patrolGone' },
          lines: ['*"The patrol\u2019s gone from the bridge, they say. And my boy with it, into Darkwood, of all places."*', 'She goes back inside. The coat stays on the line.'],
          choices: [],
        },
        {
          id: 'waiting',
          lines: [
            'Mrs Pike is pegging out a sergeant\u2019s coat that nobody wears. *"My boy\u2019s in the Baron\u2019s patrol. On that bridge, in all weathers."*',
            '*"His father would have known what to say to him. Wrote everything down, his father did."*',
          ],
          choices: [],
        },
      ],
    },
    {
      id: 'mill',
      kind: 'mill',
      name: 'Westmere Mill',
      at: at.mill,
      done: false,
      text: {
        about: ['The wheel turns. The miller waves a floury hand.'],
        done: ['"Next week, officer. Flour doesn\u2019t grow on trees."'],
        visit: ['"Flour for the King\u2019s men!" Your troops eat well and march on.'],
      },
      pages: [
        {
          id: 'miller',
          when: { notFlag: 'miller' },
          lines: [
            '*"And for the King\u2019s officer, something special. Just the one thing, mind. Times are hard."*',
            'He holds up a **loaf** that has not gone stale in living memory, because nobody marches on an empty stomach. Or you could have his old mum\u2019s **charm for a fair wind**, which blows the chaff off the grain, and your lads along with it.',
          ],
          choices: [
            {
              id: 'loaf',
              label: 'Take the Everlasting Loaf',
              effects: { artifact: 'millersLoaf', flags: { miller: 'loaf' } },
              lines: ['*"Mind, it\u2019s still warm,"* says the miller. It has been warm for forty years.'],
            },
            {
              id: 'wind',
              label: 'Learn the fair-wind charm',
              needs: { notSpell: 'haste' },
              effects: { spell: 'haste', flags: { miller: 'wind' } },
              lines: ['He whistles it for you, slowly, three times. The sails turn faster all by themselves.'],
            },
          ],
        },
      ],
    },
    {
      id: 'signpost',
      kind: 'signpost',
      name: 'Signpost',
      at: at.signpost,
      done: false,
      text: {
        about: [
          '**SOUTH-WEST:** Westmere, and the old bridge.',
          '**NORTH-WEST:** the ford, the long way round.',
          '**OVER THE RIVER:** the heath, and Darkwood, and Baron Grimsby, who owes the Crown three years of taxes and one goose.',
        ],
      },
    },
    {
      id: 'shrine',
      kind: 'event',
      look: 'shrine',
      name: 'Shrine of St Aldhelm',
      at: at.shrine,
      done: false,
      text: { about: ['This is a mossy wayside shrine to St Aldhelm, the patron saint of lost geese.'] },
      pages: [
        {
          id: 'start',
          when: { notFlag: 'aldhelm' },
          lines: [
            'You come upon a mossy wayside shrine to St Aldhelm, the patron saint of lost geese. Somebody has left a single white feather on the step.',
            'The saint wears a **crown of hawthorn**, still in flower. With it on, they say, any beast in the greenwood would follow you, as they follow a ranger. And he still listens to anyone who **prays for a goose**.',
            'On a peg by the door hangs a **pilgrim\u2019s hat** with a scallop shell. Whoever wears it on the road finds their strength again as they walk.',
            '*A saint can only spare so much. Choose one.*',
          ],
          choices: [
            {
              id: 'pray',
              label: 'Pray for the royal goose',
              effects: { flags: { aldhelm: 'prayed', goose: true }, done: true },
              lines: ['You pray for the goose, wherever the Baron keeps her. Far off, in Darkwood, something honks. *She heard. Next time you are near her, whistle the saint\u2019s hymn.*'],
            },
            {
              id: 'crown',
              label: 'Borrow the saint\u2019s crown',
              effects: { artifact: 'hawthornCrown', flags: { aldhelm: 'crown' }, done: true },
              lines: ['You lift it off, with an apology. The saint does not seem to mind. The geese on the pond look scandalised.'],
            },
            {
              id: 'hat',
              label: 'Take the pilgrim\u2019s hat',
              effects: { artifact: 'pilgrimsHat', flags: { aldhelm: 'hat' }, done: true },
              lines: ['You leave a coin in the bowl for the next pilgrim, and take the hat down. It fits as if it had been waiting for you.'],
            },
            { id: 'leave', label: 'Ride on' },
          ],
        },
        { id: 'after', when: { flag: 'aldhelm' }, lines: ['The shrine is quiet. The feather has gone.'], choices: [] },
      ],
    },
    {
      id: 'nan',
      kind: 'event',
      look: 'cottage',
      name: 'Old Nan\u2019s Cottage',
      at: at.nan,
      done: false,
      text: { about: ['A crooked cottage with a crooked chimney leans at the edge of the wood.', '*The smoke is purple.*'] },
      pages: [
        {
          id: 'hearth',
          when: { flag: 'lullaby' },
          lines: ['Old Nan is humming the Baron\u2019s lullaby over her cauldron. *"Back again, dearie? A charm, is it?"*'],
          choices: [...NAN_CHARMS, NAN_HALL, NAN_LEAVE],
        },
        {
          id: 'door',
          lines: [
            'Old Nan peers at you over a steaming cauldron. *"The King\u2019s man! I know a charm or two, dearie, for them as can pay."*',
            '*"And if you ever bring me a good warm wolf pelt, I\u2019ll show you something hotter."*',
          ],
          choices: [
            ...NAN_CHARMS,
            {
              // What she sings a Courtier can sing at Grimsby's walls (see the hideout's parleys).
              id: 'baron',
              label: 'Ask her about the Baron',
              needs: { notFlag: 'lullaby' },
              effects: { flags: { lullaby: true } },
              lines: [
                '*"Little Master Grimsby? I was his nanny, dearie, before he went to the bad. Screamed the house down every night, he did, till I sang him this."*',
                'She rocks in her chair and sings you a lullaby, all four verses. By the end of it, you could do with a nap yourself.',
              ],
            },
            NAN_HALL,
            NAN_LEAVE,
          ],
        },
      ],
    },
    {
      id: 'hall',
      kind: 'village',
      look: 'hall',
      name: 'The King\u2019s Hunt Hall',
      at: at.hall,
      done: false,
      text: {
        about: ['The old King\u2019s hunt hall stands by the bridge.', '*There are antlers over the door, and shutters nobody has opened since he died.*'],
        done: ['The fires are lit, and every one of the old King\u2019s huntsmen has gone with you.'],
        later: [
          { when: { flag: 'watHome' }, about: ['The old King\u2019s hunt hall stands by the bridge.', '*The shutters are open, and a hawk sits on the antlers over the door.*'] },
          { when: { flag: 'huntsmen' }, about: ['The old King\u2019s hunt hall stands by the bridge.', '*The shutters are open again, and there is smoke from the chimney.*'] },
          {
            when: { flag: 'huntKey', notFlag: 'huntsmen' },
            about: ['The old King\u2019s hunt hall stands by the bridge.', '*There is a stag over the door, the same stag as on the old King\u2019s key, so the key should fit its lock.*'],
            note: 'the old King\u2019s key fits its lock',
          },
        ],
      },
      pages: [
        {
          id: 'locked',
          when: { notFlag: 'huntKey' },
          lines: ['The old King\u2019s hunt hall has been shut up since he died.', '*The lock is the size of a loaf. Somebody still oils it.*'],
          choices: [],
        },
        {
          id: 'door',
          when: { flag: 'huntKey', notFlag: 'huntsmen' },
          lines: ['The old King\u2019s key fits the lock. It turns stiffly, as if it has been waiting for you.'],
          choices: [
            {
              id: 'open',
              label: 'Open the hall',
              effects: { flags: { huntsmen: true }, recruits: { troop: 'huntsmen', count: HUNTSMEN, restock: 0 }, xp: 100 },
              lines: [
                'Inside there is dust, antlers, and the old King\u2019s chair by the cold hearth. By evening the fires are lit, and grey, lean men are at the door. *The old King\u2019s huntsmen have come home.*',
                '*"Grimsby gave our job to Rook,"* says the eldest. *"We\u2019d like a word with him. We\u2019ll come with you for nothing, sir, if you\u2019re going his way."*',
              ],
            },
          ],
        },
      ],
    },
    {
      // The old King's falconer, on the open heath west of the river: a clue, his hawk, and, once the
      // huntsmen are back at the hall, himself and his lads.
      id: 'falconer',
      kind: 'event',
      look: 'mews',
      name: 'The Falconer\u2019s Bothy',
      at: at.falconer,
      done: false,
      text: {
        about: ['A low stone bothy sits out on the heath, with a hawk on a block outside it.', '*She watches you all the way in.*'],
        later: [
          { when: { flag: 'watHome' }, about: ['A low stone bothy sits out on the heath, shut up and quiet.', '*Old Wat has gone home to the hunt hall, and taken his lads with him.*'] },
          { when: { flag: 'falconer' }, about: ['A low stone bothy sits out on the heath, with an empty block outside it.', '*Old Wat sits by the door and watches the sky.*'] },
        ],
      },
      pages: [
        {
          id: 'gone',
          when: { flag: 'watHome' },
          lines: ['The bothy is shut up. An old falconer\u2019s glove hangs on the perch, for whoever comes next.'],
          choices: [],
        },
        {
          id: 'meg',
          when: { notFlag: 'falconer' },
          lines: [
            'Old Wat was the old King\u2019s falconer, and Meg is the last of his hawks. *"Forty years on this heath, sir, and nobody left to hunt for."*',
            '*"Grimsby\u2019s lot are digging up the heath for the old King\u2019s gold, I hear. He never buried gold. Whatever he put in the ground, it was warm."*',
          ],
          choices: [
            {
              id: 'meg',
              label: 'Take Meg with you',
              effects: { artifact: 'oldKingsHawk', flags: { falconer: 'meg' } },
              lines: ['*"She\u2019ll come back to you, if you\u2019re worth coming back to."* Meg steps onto your wrist as if she\u2019d been waiting for you.'],
            },
            {
              id: 'home',
              label: 'Ask him to come home to the hunt hall',
              when: { flag: 'huntsmen' },
              effects: { flags: { falconer: 'home', watHome: true }, recruits: { at: 'hall', troop: 'huntsmen', count: 4 }, xp: 100 },
              lines: [
                '*"The lads are back at the hall?"* Old Wat whistles, and three lean lads come up out of the heather. They are his apprentices. *"Then so are we, all four of us, and Meg."*',
                '*"And if we meet that Rook on the way, he\u2019ll get a clip round the ear. I taught him everything he knows."*',
              ],
            },
            { id: 'leave', label: 'Ride on' },
          ],
        },
        {
          id: 'glove',
          when: { flag: 'falconer' },
          lines: ['Old Wat is mending a jess by the door, and whistling to nobody. *"Look after her, sir."*'],
          choices: [],
        },
      ],
    },
    {
      id: 'lodge',
      kind: 'event',
      look: 'lodge',
      name: 'The Old King\u2019s Lodge',
      at: at.lodge,
      done: false,
      text: { about: ['The old King\u2019s hunting lodge lies deep in the chase.', '*Nobody has lit a fire here in years.*'] },
      pages: [
        {
          id: 'nail',
          when: { notFlag: 'huntKey' },
          lines: [
            'Inside you find antlers, cobwebs, and the old King\u2019s chair by the cold hearth, as if he had only just stepped out.',
            'On a nail by the door hangs a big iron **key** with a stag on its bow, beside his old hunting coat.',
          ],
          choices: [
            {
              id: 'key',
              label: 'Take the key',
              effects: { flags: { huntKey: true, lodge: 'key' }, treasure: 150 },
              lines: ['It is heavier than it looks. *The old King\u2019s key has a stag on it, the same stag as over the door of his hunt hall by the bridge.*', 'In a pocket of the coat you find a purse of the old King\u2019s crowns.'],
            },
            { id: 'leave', label: 'Leave it on its nail' },
          ],
        },
        { id: 'empty', when: { flag: 'huntKey' }, lines: ['The lodge is quiet. The nail by the door is empty.'], choices: [] },
      ],
    },
    {
      id: 'butts',
      kind: 'village',
      look: 'range',
      name: 'Aldmoor Butts',
      at: at.butts,
      done: false,
      recruits: { troop: 'archers', count: 12, price: 30 },
      text: { about: ['These are the village archery butts, with straw targets and a sign that says *"MIND THE GOOSE"*.', 'You can hire archers here.'] },
    },
    { id: 'chest', kind: 'chest', name: 'Treasure Chest', at: at.chest, done: false, gold: 500, artifact: 'surveyorsChain' },
    {
      id: 'well',
      kind: 'well',
      name: 'St Aldhelm\u2019s Well',
      at: at.well,
      done: false,
      text: {
        about: ['A tin cup hangs on a chain by this holy well. The pilgrims say its water clears the head.'],
        visit: ['You drink. The water is cold enough to hurt, and your head is suddenly very clear.'],
      },
    },
    { id: 'gold', kind: 'gold', name: 'Pile of Gold', at: at.gold, done: false, gold: 250 },
    {
      id: 'patrol',
      kind: 'patrol',
      name: 'Grimsby\u2019s Patrol',
      at: at.patrol,
      done: false,
      artifact: 'carvingKnife',
      enemy: {
        look: 'soldiers',
        tier: 'gate',
        lines: ['Grimsby\u2019s men wear goose feathers in their helmets. They hold the old bridge, and they are not in a hurry.'],
        army: [{ troop: 'swordsmen', count: PATROL.swordsmen }, { troop: 'crossbowmen', count: PATROL.crossbowmen }],
        reward: 500,
        threat: 'They level their spears.',
        parleys: [
          {
            id: 'bribe',
            label: 'Pay them to go home',
            needs: { gold: 900 },
            effects: { done: true, flags: { patrolGone: true } },
            lines: ['The sergeant counts the coins twice, salutes, and marches the patrol back to Darkwood. *"We got lost, my lord. Very lost."*'],
          },
          {
            id: 'orders',
            label: 'Show them the Baron\u2019s orders',
            needs: { flag: 'orders' },
            effects: { done: true, xp: 300, reinforce: { id: 'hideout', share: 0.3 }, place: DESERTERS, flags: { orders: false, patrolGone: true } },
            lines: [
              'The sergeant reads the letter upside down, then the right way up. *"Back to the stockade, lads. Baron\u2019s orders."*',
              'A few of them go. The rest decide they have had enough of the Baron, and make camp by the crossroads. *The few will be waiting for you behind Grimsby\u2019s walls.*',
            ],
          },
          {
            id: 'pike',
            label: 'Give Sergeant Pike his father\u2019s journal',
            needs: { flag: 'pike' },
            effects: { done: true, xp: 300, place: PIKES_CAMP, flags: { pike: false, pikeHome: true } },
            lines: [
              'Sergeant Pike reads his father\u2019s journal twice, and blows his nose on his sleeve. *"Right, lads. Mum wants us home."*',
              'The whole patrol follows him home to Westmere, where they make camp on the green. *They would fight for the Crown now, for the right money.*',
            ],
          },
        ],
        spoils: { place: DESERTERS, flags: { patrolGone: true } },
        flees: 'Grimsby\u2019s patrol breaks and runs for Darkwood.',
        loot: 'You find {gold} on the road. A dozen of them would rather fight for the Crown, so they make camp by the crossroads, and you can hire **swordsmen** there now.',
      },
    },
    {
      // Every payday, while the patrol holds the bridge, a squad of it takes Westmere's grain to Grimsby.
      id: 'cart',
      kind: 'patrol',
      look: 'cart',
      name: 'The Grain Cart',
      at: CART_ROAD[0],
      done: true,
      enemy: {
        look: 'soldiers',
        tier: 'band',
        convoy: {
          from: 'patrol',
          share: 0.2,
          route: CART_ROAD,
          pace: 360,
          leaves: 'In Westmere, a squad of Pike\u2019s lads is loading the village\u2019s grain onto a cart, for the Baron\u2019s stockade.',
        },
        lines: ['Westmere\u2019s grain is on its way to Grimsby\u2019s stockade, with a squad of Pike\u2019s lads from the bridge to see that it gets there.', '*The carter doesn\u2019t look happy about it. Nor does the ox.*'],
        army: [{ troop: 'swordsmen', count: 10 }, { troop: 'crossbowmen', count: 6 }],
        reward: 100,
        threat: 'The carter whips up the ox. Pike\u2019s lads put themselves between you and the grain, rather apologetically.',
        spoils: { flags: { grain: true }, rations: 1, page: 'grain' },
        flees: 'Pike\u2019s lads leave the cart in the road and run for the bridge.',
        loot: 'In the carter\u2019s box you find {gold}, and a note from the Baron about the price of oats.',
      },
      pages: [
        {
          id: 'grain',
          answer: true,
          when: { flag: 'grain' },
          lines: ['*The carter would like to know whose grain it is now.*'],
          choices: [
            {
              id: 'westmere',
              label: 'Take it home to Westmere',
              effects: { flags: { grain: false }, rations: -1, recruits: { at: 'village', count: 30 }, leadership: 10 },
              lines: ['You drive the cart back to Westmere yourself. The whole village turns out to unload it, and by evening its lads are queuing to take the King\u2019s shilling. *Westmere won\u2019t forget it.*'],
            },
            {
              id: 'keep',
              label: 'Keep it for your men',
              effects: { flags: { grain: false } },
              lines: ['Your quartermaster rubs his hands. *Come payday, the men eat the Baron\u2019s bread, and draw no wages.*'],
            },
          ],
        },
      ],
    },
    {
      id: 'hideout',
      kind: 'hideout',
      name: 'Grimsby\u2019s Hideout',
      at: at.hideout,
      done: false,
      artifact: 'goldenFeather',
      enemy: {
        look: 'stockade',
        tier: 'boss',
        // He recruits 3% a payday, five times: enough that waiting costs something, not so much that he runs away from a hero beaten once at his walls.
        grows: 0.03,
        charge: 'Storm the stockade',
        lines: ['A muddy stockade stands deep in Darkwood. Someone inside is honking.'],
        // Sized to the power budget: a hard fight for a careful player on day 21 (docs/BALANCE.md).
        army: [{ troop: 'swordsmen', count: 69 }, { troop: 'crossbowmen', count: 36 }, { troop: 'baron', count: 1 }],
        reward: 2000,
        threat: 'The Baron shouts from the palisade, *"I have the goose AND the walls!"*',
        // Raid his dig, take his patrol off the bridge or his huntsman from his wolves, and he rides out with a fifth of his men to meet you.
        sortie: {
          when: [{ flag: 'dig', is: 'raided' }, { flag: 'patrolGone' }, { flag: 'pikeHome' }, { flag: 'rook' }],
          guard: 0.2,
          band: GRIMSBY_RIDES,
          barred: ['The gate is barred, and for once nobody inside is honking.', '*"The Baron\u2019s out!"* shouts a sentry over the palisade. *"Looking for you, as it happens. He took the goose."*'],
          out: 'Word reaches you that **Baron Grimsby** has ridden out of his stockade with his guard, looking for you.',
          home: 'You hear that **Baron Grimsby** has given up looking for you, and gone home to his stockade.',
        },
        parleys: [
          {
            id: 'goose',
            label: 'Whistle St Aldhelm\u2019s hymn',
            needs: { flag: 'goose' },
            effects: { desert: { troop: 'crossbowmen', share: 0.5 }, flags: { goose: false } },
            lines: ['You whistle the saint\u2019s hymn under the palisade. Inside, the royal goose hears it and makes a break for it, honking, and half the crossbowmen go after her. *They catch her in the end. The crossbowmen, you suspect, have kept running.*'],
          },
          {
            // The Courtier's way: a bard's song, learned from Grimsby's old nanny, and the price is half the bounty, to her.
            id: 'lullaby',
            label: 'Sing him Old Nan\u2019s lullaby',
            needs: { background: 'courtier', flag: 'lullaby' },
            hint: 'a song you don\u2019t know yet',
            effects: { win: true, gold: 1000, xp: 450, flags: { lullaby: false } },
            lines: [
              'You tune your lute under the palisade and sing *Hush-a-bye, Baron*, all four verses, the way Old Nan sings it. By the second, his men are humming along. By the third, the Baron is sobbing into the goose.',
              '*"Nobody\u2019s sung me that since I was six,"* he sniffs, and comes down to you, on one condition. Half his bounty must go to his old nanny.',
            ],
            because: 'the other half went to the Baron\u2019s old nanny',
          },
        ],
        flees: 'The stockade gate falls open.',
        loot: 'The Crown pays {gold}.',
      },
      text: { done: ['There is nobody here now but a few goose feathers.'] },
    },
    {
      id: 'poachers',
      kind: 'patrol',
      name: 'Poachers',
      at: at.poachers,
      done: false,
      artifact: 'rabbitsFoot',
      enemy: {
        look: 'soldiers',
        tier: 'pest',
        behaviour: 'roam',
        range: 60,
        lines: ['A band of poachers is carrying off the King\u2019s deer.', '*Their leader keeps touching a rabbit\u2019s foot on a string, for luck.*'],
        army: [{ troop: 'poachers', count: 16 }],
        reward: 150,
        threat: 'They nock their arrows, a little guiltily.',
        parleys: [
          {
            id: 'hire',
            label: 'Offer them honest work',
            needs: { background: 'courtier' },
            effects: { done: true, troops: [{ troop: 'poachers', count: 16 }], xp: 60 },
            lines: ['"Scouting for the Crown? Paid? In advance?" The poachers can\u2019t sign up fast enough.'],
          },
          {
            id: 'spare',
            label: 'Let them off, if they swear off the King\u2019s deer',
            effects: {
              done: true,
              xp: 40,
              flags: { poachers: 'spared' },
              place: { id: 'cache', kind: 'chest', name: 'The Poachers\u2019 Cache', at: at.cache, done: false, gold: 300, artifact: 'poachersHorn' },
              reveal: { at: at.cache, radius: 80 },
            },
            lines: ['They swear on the deer, which seems fair. As they go, the youngest whispers, *"Hollow oak, south of the old bridge. Take the horn, my lord. We won\u2019t be needing it."*'],
          },
        ],
        spoils: { flags: { venison: true } },
        flees: 'The poachers drop the deer and run.',
        loot: 'You find {gold} and a haunch of the King\u2019s venison. *Something out there would love this.*',
      },
    },
    {
      id: 'diggings',
      kind: 'patrol',
      name: 'Grimsby\u2019s Dig',
      at: at.diggings,
      done: false,
      text: { done: ['There are forty holes in the heather, and not one of them is the right one.'] },
      enemy: {
        look: 'soldiers',
        tier: 'band',
        lines: ['Grimsby\u2019s men are digging on the heath for the old King\u2019s treasure, and a good many more of them are standing guard. They have dug forty holes so far.', '*None of them is the right one.*'],
        army: [{ troop: 'swordsmen', count: 32 }, { troop: 'crossbowmen', count: 14 }, { troop: 'peasants', count: 30 }],
        reward: 400,
        threat: 'The foreman waves his spade at you. *"Dig your own hole!"*',
        spoils: { flags: { dig: 'raided' } },
        flees: 'The diggers drop their spades and run for Darkwood.',
        loot: 'In the biggest hole you find {gold} of the Baron\u2019s wages, and his orders, pinned to a spade. *"Keep digging. It isn\u2019t gold, so don\u2019t pocket it. You\u2019ll know it when you see it. G."*',
      },
    },
    {
      id: 'highwaymen',
      kind: 'patrol',
      name: 'Highwaymen',
      at: at.highwaymen,
      done: false,
      artifact: 'blackBanner',
      enemy: {
        look: 'soldiers',
        tier: 'pest',
        lines: ['Highwaymen stand in a line across the road to the watchtower, under a black banner with a skull on it.'],
        army: [{ troop: 'bandits', count: 14 }],
        reward: 200,
        threat: '*"Stand and deliver!"* They stand. Somebody has to deliver.',
        parleys: [
          {
            id: 'toll',
            label: 'Pay their toll',
            needs: { gold: 120 },
            effects: { done: true },
            lines: ['They bite every coin, bow, and melt away into the heather.'],
          },
        ],
        spoils: { flags: { orders: true } },
        flees: 'The highwaymen scatter into the heather.',
        loot: 'Their takings come to {gold}, and among them is a letter with the Baron\u2019s seal. *"All patrols back to the stockade if the King\u2019s man comes. G."*',
      },
    },
    {
      id: 'boars',
      kind: 'patrol',
      name: 'Wild Boars',
      at: at.boars,
      done: false,
      enemy: {
        look: 'wolves',
        tier: 'pest',
        behaviour: 'roam',
        range: 60,
        lines: ['Wild boars are rooting at the edge of the King\u2019s chase.'],
        army: [{ troop: 'boars', count: 9 }],
        reward: 80,
        threat: 'The biggest one lowers its tusks and scrapes the ground.',
        tamed: 'You lay a trail of acorns, and the boars follow it like a procession, all the way into your baggage train. They seem to think it was their idea.',
        flees: 'The boars crash off into the woods.',
        loot: 'Where they were rooting you find truffles, worth {gold} at market.',
      },
    },
    {
      id: 'bears',
      kind: 'patrol',
      name: 'Bears',
      at: at.bears,
      done: false,
      enemy: {
        look: 'wolves',
        tier: 'band',
        lines: ['Bears are asleep across the track to the old King\u2019s lodge.', '*The biggest one is snoring. The trees shake a little.*'],
        army: [{ troop: 'bears', count: 7 }],
        reward: 150,
        threat: 'The biggest bear gets up. It goes on getting up for quite a long time.',
        tamed: 'You sit down in the track, and wait. At dusk the biggest bear comes and sits beside you, and leans. *The others decide that makes you family.*',
        flees: 'The bears lumber off into the chase, grumbling.',
        loot: 'In the hollow oak they were sleeping under you find {gold} in old coins, and a great deal of honey.',
      },
    },
    {
      id: 'wolves',
      kind: 'patrol',
      name: 'Rook\u2019s Wolves',
      at: at.wolves,
      done: false,
      artifact: 'greenwoodCloak',
      enemy: {
        look: 'wolves',
        tier: 'gate',
        // Rook the Huntsman, the Baron's captain (#15): his wolves hold the kennels in week 1, and from week 2 he
        // hunts whoever camps near their ground, if the pack could beat him.
        behaviour: 'hunt',
        range: 340,
        sight: 380,
        wakes: { day: 8, news: 'Word reaches you that the Baron has told **Rook the Huntsman** to bring you in, and Rook has let his wolves off the leash.' },
        lines: ['Rook the Huntsman and the Baron\u2019s wolves are sitting on the path as if they own it.', '*Rook was the best poacher Aldmoor ever had, until the Baron gave him the old King\u2019s huntsmen\u2019s job.*'],
        army: [{ troop: 'wolves', count: 100 }, { troop: 'rook', count: 1 }],
        reward: 300,
        threat: 'Rook puts two fingers in his mouth and whistles, once. Every wolf in the pack looks at you.',
        lastWords: 'Don\u2019t tell the Baron! He\u2019ll give my job back to the old King\u2019s lot!',
        tamed: 'You sit down in the heather among them, and wait. At dusk the old grey leader lies down at your feet with a sigh, and the pack after him. Rook whistles and whistles, and not one of them looks round. *He gives himself up in disgust.*',
        parleys: [
          {
            id: 'venison',
            label: 'Throw them the King\u2019s venison',
            needs: { flag: 'venison' },
            effects: { done: true, xp: 100, flags: { venison: false } },
            lines: ['You toss the poachers\u2019 haunch of venison into the heather. The whole pack goes after it, snarling, and Rook goes after the pack, shouting. The road to Darkwood is clear.'],
          },
        ],
        spoils: { flags: { wolfpelt: true } },
        taken: { rook: 'taken' },
        flees: 'The pack scatters into Darkwood without him.',
        loot: 'In Rook\u2019s hut by the kennels you find {gold}, a fine grey pelt, and an old ranger\u2019s cloak his wolves had been sleeping on. *Old Nan would like that pelt.*',
      },
    },
    ...FINDS,
  ],
};
