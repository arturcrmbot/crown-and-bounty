import type { Point } from '../rules/map/geometry';
import type { Location } from '../rules/state';
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
  shrine: [676, 506],
  poachers: [880, 684],
  highwaymen: [366, 336],
  boars: [1040, 424],
  nan: [1012, 556],
  cache: [772, 800],
  butts: [612, 640],
  delving: [205, 828],
} satisfies Record<string, Point>;

/** Where the hero comes up at each end of the dwarf's old delving: beside its mouth, where he can be seen. */
const DELVING_NORTH: Point = [200, 214];
const DELVING_SOUTH: Point = [205, 862];

/** The patrol's size: a gate, too strong for a fresh army (see `rules/difficulty.ts`). */
const PATROL = { swordsmen: 50, crossbowmen: 29 };

/** Where Grimsby's men make camp once they've had enough of him: beaten, or sent home with his orders. */
const DESERTERS: Location = {
  id: 'deserters',
  kind: 'village',
  look: 'camp',
  name: 'Deserters\u2019 Camp',
  at: [468, 628],
  done: false,
  recruits: { troop: 'swordsmen', count: 12, price: 60 },
  text: { about: ['Grimsby\u2019s former men, sharpening their swords and their excuses.', 'Swordsmen, for hire.'] },
};

/** The same camp when Sergeant Pike brings the whole patrol home: more of them, and in a better mood. */
const PIKES_CAMP: Location = { ...DESERTERS, recruits: { troop: 'swordsmen', count: 20, price: 60 } };

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
  flocks: [[1010, 90]],
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
    {
      id: 'castle',
      kind: 'castle',
      name: 'Castle Aldmoor',
      at: at.castle,
      done: false,
      recruits: { troop: 'knights', count: 5, price: 100 },
      wares: ['swordOfAldmoor', 'breastplate', 'helmOfFarSight', 'luckyHorseshoe', 'spyglass', 'silverSignet'],
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
                '*"A King\u2019s man with manners. Here: the old delving runs under Darkwood, and comes up behind them wolves. Mind your head."*',
              ],
            },
          ],
        },
        {
          id: 'delving',
          when: { flag: 'delving' },
          lines: ['The dwarf nods at the rails. *"South, under Darkwood, and up behind the wolves. Takes all day."*'],
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
          lines: ['The bricks are down. The rails run north under Darkwood, all the way back to the Old Mine.'],
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
          '**NORTH:** the Old Watchtower.',
          '**EAST:** Westmere, over the old bridge.',
          '**SOUTH-WEST:** Darkwood, and Baron Grimsby, who owes the Crown three years of taxes and one goose.',
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
        behaviour: 'roam',
        range: 90,
        lines: ['Grimsby\u2019s men, with goose feathers in their helmets. They patrol the crossroads, and they are not in a hurry.'],
        army: [{ troop: 'swordsmen', count: PATROL.swordsmen }, { troop: 'crossbowmen', count: PATROL.crossbowmen }],
        reward: 500,
        threat: 'They level their spears.',
        parleys: [
          {
            id: 'bribe',
            label: 'Pay them to go home',
            needs: { gold: 900 },
            effects: { done: true },
            lines: ['The sergeant counts the coins twice, salutes, and marches the patrol back to Darkwood. *"We got lost, my lord. Very lost."*'],
          },
          {
            id: 'orders',
            label: 'Show them the Baron\u2019s orders',
            needs: { flag: 'orders' },
            effects: { done: true, xp: 300, reinforce: { id: 'hideout', share: 0.3 }, place: DESERTERS, flags: { orders: false } },
            lines: [
              'The sergeant reads the letter upside down, then the right way up. *"Back to the stockade, lads. Baron\u2019s orders."*',
              'A few of them go. The rest decide they have had enough of the Baron, and make camp by the crossroads. *The few will be waiting for you behind Grimsby\u2019s walls.*',
            ],
          },
          {
            id: 'pike',
            label: 'Give Sergeant Pike his father\u2019s journal',
            needs: { flag: 'pike' },
            effects: { done: true, xp: 300, place: PIKES_CAMP, flags: { pike: false } },
            lines: [
              'Sergeant Pike reads his father\u2019s journal twice, and blows his nose on his sleeve. *"Right, lads. Mum wants us home."*',
              'The whole patrol follows him off to the crossroads, where they make camp. *They would fight for the Crown now, for the right money.*',
            ],
          },
        ],
        spoils: { place: DESERTERS },
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
        army: [{ troop: 'swordsmen', count: 56 }, { troop: 'crossbowmen', count: 30 }, { troop: 'baron', count: 1 }],
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
      enemy: {
        look: 'soldiers',
        tier: 'pest',
        behaviour: 'roam',
        range: 60,
        lines: ['Poachers, with the King\u2019s deer over their shoulders.'],
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
        lines: ['Wild boars, rooting up the castle road.'],
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
