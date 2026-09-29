import { nearest, smooth, type Point } from '../rules/map/geometry';
import { hash, rng } from '../rules/noise';
import type { Location } from '../rules/state';
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

/** The patrol's size: a gate, too strong for a fresh army (see `rules/difficulty.ts`). */
const PATROL = { swordsmen: 50, crossbowmen: 29 };

/** Where Grimsby's men make camp once they've had enough of him: beaten, or sent home with his orders. */
const DESERTERS: Location = {
  id: 'deserters',
  kind: 'village',
  look: 'camp',
  name: 'Deserters\u2019 Camp',
  at: [1578, 1560],
  done: false,
  recruits: { troop: 'swordsmen', count: 12, price: 60 },
  text: { about: ['Grimsby\u2019s former men, sharpening their swords and their excuses.', 'Swordsmen, for hire.'] },
};

/** The same camp when Sergeant Pike brings the whole patrol home to Westmere: more of them, and in a better mood. */
const PIKES_CAMP: Location = {
  ...DESERTERS,
  name: 'Pike\u2019s Camp',
  at: [2036, 1512],
  recruits: { troop: 'swordsmen', count: 20, price: 60 },
  text: { about: ['The Baron\u2019s old patrol, camped on Westmere green, where their mothers can keep an eye on them.', 'Swordsmen, for hire.'] },
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
  return [x, y, Math.round(70 + hash(i, 1, 30) * 50 + big * 20), Math.round(48 + hash(i, 2, 30) * 36 + big * 22)];
});

/** Lone trees in the fields and on the heath, and boulders on the heath and the downs. */
const trees: [number, number, boolean][] = scatter(31, 170, (p, r) => r() < 0.3 && height(p) === 0 && clearOf(p, 18, 30, 60) && !inWoods(p)).map(([x, y], i) => [x, y, hash(i, 3, 31) < 0.4]);
const rocks: [number, number, number][] = scatter(37, 150, (p, r) => r() < (p[0] < riverX(p[1]) ? 0.3 : 0.12) && clearOf(p, 14, 30, 50) && !inWoods(p)).map(([x, y], i) => [x, y, Math.round(5 + hash(i, 4, 37) * 4)]);

const hero: Point = [3100, 1046];

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
      text: { about: ['Your castle, flying the King\u2019s banner.', 'The steward is pretending to count spoons.', 'Knights to recruit, and an armoury.'] },
    },
    {
      id: 'tower',
      kind: 'tower',
      name: 'Old Watchtower',
      at: at.tower,
      done: false,
      text: {
        about: ['Abandoned for nearly a century.', '*Something has disturbed the crows recently.*'],
        done: ['Empty now, apart from some very offended crows.'],
      },
      pages: [
        {
          id: 'top',
          when: { notFlag: 'tower' },
          lines: [
            'At the top of the stairs, the crows are guarding an old soldier\u2019s things: his **banner**, moth-eaten and much loved, that archers rally to, and his **journal**, which is all about Grimsby and somebody called Pike.',
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
                '*"Grimsby rides south-west, into Darkwood. He sleeps with the goose."*',
                'And on the last page: *"My boy is a sergeant in the Baron\u2019s patrol now, God help him. If you see him, tell Pike his mother wants him home."*',
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
            'A forgotten ore cart, still full: a good **400 gold** of it. The humming is a dwarf, pushing it the wrong way up the rails.',
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
                '*"A King\u2019s man with manners. Here: the old delving runs south under the heath, and comes up in Darkwood, behind them wolves. Mind your head."*',
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
      text: { about: ['An old mine mouth, in the middle of Darkwood.', '*Somebody has bricked it up from the inside.*'] },
      pages: [
        {
          id: 'shut',
          when: { notFlag: 'delving' },
          lines: ['An old mine mouth, bricked up from the inside. Somewhere behind the bricks, very faintly, somebody is humming.'],
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
              lines: ['A long day in the dark. You come up at the Old Mine at dusk, where the dwarf pretends he hasn\u2019t been waiting.'],
            },
            { id: 'stay', label: 'Not today' },
          ],
        },
      ],
    },
    { id: 'village', kind: 'village', name: 'Westmere', at: at.village, done: false, recruits: { troop: 'peasants', count: 20, price: 10 }, text: { about: ['Population 340. Friendly, if nosy.'] } },
    {
      id: 'mrsPike',
      kind: 'event',
      look: 'house',
      name: 'Mrs Pike\u2019s Cottage',
      at: at.mrsPike,
      done: false,
      text: { about: ['A neat cottage on Westmere green, with a sergeant\u2019s coat on the washing line.', '*It hasn\u2019t been worn in a while.*'] },
      pages: [
        {
          id: 'home',
          when: { flag: 'pikeHome', notFlag: 'mrsPike' },
          lines: [
            'Mrs Pike opens the door before you knock. Her boy is at the table behind her, on his third breakfast.',
            '*"You brought him home. With his father\u2019s journal, of all things."* She\u2019d like to thank you properly: with her late husband\u2019s **lucky horseshoe**, off the door, or with a **word** in the right ears round Westmere.',
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
              lines: ['By teatime every mother in Westmere knows who brought Mrs Pike\u2019s boy home, and her sons are asking where to sign. **+20 leadership.**'],
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
            '*"And for the King\u2019s officer, something special. One thing, mind: times are hard."*',
            'He holds up a **loaf** that has not gone stale in living memory (*nobody marches on an empty stomach*), and his old mum\u2019s **charm for a fair wind** (*blows the chaff off the grain, and your lads along with it*).',
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
      text: { about: ['A mossy wayside shrine to St Aldhelm, patron saint of lost geese.'] },
      pages: [
        {
          id: 'start',
          when: { notFlag: 'aldhelm' },
          lines: [
            'A mossy wayside shrine to St Aldhelm, patron saint of lost geese. Somebody has left a single white feather on the step.',
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
      text: { about: ['A crooked cottage with a crooked chimney, at the edge of the wood.', '*The smoke is purple.*'] },
      pages: [
        {
          id: 'door',
          lines: [
            'Old Nan peers at you over a steaming cauldron. *"The King\u2019s man! I know a charm or two, dearie, for them as can pay."*',
            '*"And if you ever bring me a good warm wolf pelt, I\u2019ll show you something hotter."*',
          ],
          choices: [
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
            { id: 'leave', label: 'Ride on', lines: ['You leave her to her cauldron. Something in it winks at you.'] },
          ],
        },
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
      text: { about: ['The village archery butts. Straw targets, and a sign: *"MIND THE GOOSE"*.', 'Archers, for hire.'] },
    },
    { id: 'chest', kind: 'chest', name: 'Treasure Chest', at: at.chest, done: false, gold: 500, artifact: 'surveyorsChain' },
    {
      id: 'well',
      kind: 'well',
      name: 'St Aldhelm\u2019s Well',
      at: at.well,
      done: false,
      text: {
        about: ['A holy well with a tin cup on a chain. The pilgrims say its water clears the head.'],
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
        lines: ['Grimsby\u2019s men, with goose feathers in their helmets. They hold the old bridge, and they are not in a hurry.'],
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
        loot: 'You find {gold} on the road. And a dozen of them would rather fight for the Crown: they make camp by the crossroads, where **swordsmen** can now be hired.',
      },
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
        grows: 0.05,
        charge: 'Storm the stockade',
        lines: ['A muddy stockade deep in Darkwood. Someone inside is honking.'],
        army: [{ troop: 'swordsmen', count: 46 }, { troop: 'crossbowmen', count: 24 }, { troop: 'baron', count: 1 }],
        reward: 2000,
        threat: 'The Baron shouts from the palisade: *"I have the goose AND the walls!"*',
        parleys: [
          {
            id: 'goose',
            label: 'Whistle St Aldhelm\u2019s hymn',
            needs: { flag: 'goose' },
            effects: { desert: { troop: 'crossbowmen', share: 0.5 }, flags: { goose: false } },
            lines: ['You whistle the saint\u2019s hymn under the palisade. Inside, the royal goose hears it and makes a break for it, honking, and half the crossbowmen go after her. *They catch her in the end. The crossbowmen, you suspect, have kept running.*'],
          },
          {
            id: 'pardon',
            label: 'Talk the Baron round',
            needs: { background: 'courtier' },
            effects: { win: true, gold: 1000, xp: 450 },
            lines: ['Over a very long lunch, you explain what the Crown does to barons who keep geese that aren\u2019t theirs, and what it does for barons who don\u2019t. Grimsby signs for the taxes and hands over the goose.'],
          },
        ],
        flees: 'The stockade gate falls open.',
        loot: 'The Crown pays {gold}.',
      },
      text: { done: ['Nobody here but a few goose feathers.'] },
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
        lines: ['Poachers, with the King\u2019s deer over their shoulders.', '*Their leader keeps touching a rabbit\u2019s foot on a string, for luck.*'],
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
            lines: ['They swear on the deer, which seems fair. As they go, the youngest whispers: *"Hollow oak, south of the old bridge. Take the horn, my lord. We won\u2019t be needing it."*'],
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
      text: { done: ['Forty holes in the heather, and not one of them the right one.'] },
      enemy: {
        look: 'soldiers',
        tier: 'band',
        lines: ['Grimsby\u2019s men, digging on the heath for the old King\u2019s treasure, and a good many more of them standing guard. They have dug forty holes so far.', '*None of them is the right one.*'],
        army: [{ troop: 'swordsmen', count: 32 }, { troop: 'crossbowmen', count: 14 }, { troop: 'peasants', count: 30 }],
        reward: 400,
        threat: 'The foreman waves his spade at you. *"Dig your own hole!"*',
        spoils: { flags: { dig: 'raided' } },
        flees: 'The diggers drop their spades and run for Darkwood.',
        loot: 'In the biggest hole: {gold} of the Baron\u2019s wages, and his orders, pinned to a spade. *"Keep digging. It isn\u2019t gold, so don\u2019t pocket it: you\u2019ll know it when you see it. G."*',
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
        lines: ['Highwaymen, in a line across the road to the watchtower, under a black banner with a skull on it.'],
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
        loot: 'Their takings: {gold}, and a letter with the Baron\u2019s seal: *"All patrols back to the stockade if the King\u2019s man comes. G."*',
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
        lines: ['Wild boars, rooting at the edge of the King\u2019s chase.'],
        army: [{ troop: 'boars', count: 9 }],
        reward: 80,
        threat: 'The biggest one lowers its tusks and scrapes the ground.',
        tamed: 'You lay a trail of acorns, and the boars follow it like a procession, all the way into your baggage train. They seem to think it was their idea.',
        flees: 'The boars crash off into the woods.',
        loot: 'Truffles where they were rooting! Worth {gold} at market.',
      },
    },
    {
      id: 'wolves',
      kind: 'patrol',
      name: 'Wolf Pack',
      at: at.wolves,
      done: false,
      artifact: 'greenwoodCloak',
      enemy: {
        look: 'wolves',
        tier: 'gate',
        lines: ['Wolves, sitting on the path like they own it.', 'Your archers are pretending not to have seen them.'],
        army: [{ troop: 'wolves', count: 84 }],
        reward: 300,
        threat: 'They bare their teeth. One of them yawns, which is somehow worse.',
        tamed: 'You sit down in the heather among them, and wait. At dusk the old grey leader lies down at your feet with a sigh. *The pack is yours now, or you are theirs: it\u2019s hard to say which.*',
        parleys: [
          {
            id: 'venison',
            label: 'Throw them the King\u2019s venison',
            needs: { flag: 'venison' },
            effects: { done: true, xp: 100, flags: { venison: false } },
            lines: ['You toss the poachers\u2019 haunch of venison into the heather. The whole pack goes after it, snarling, and the road to Darkwood is clear.'],
          },
        ],
        spoils: { flags: { wolfpelt: true } },
        flees: 'The pack scatters into Darkwood.',
        loot: 'Under their favourite rock: {gold}, a fine grey pelt, and an old ranger\u2019s cloak they had been sleeping on. *Old Nan would like that pelt.*',
      },
    },
  ],
};
