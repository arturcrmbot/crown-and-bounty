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
  well: [764, 448],
  gold: [470, 402],
  gold2: [1046, 772],
  goblins: [552, 590],
  troll: [902, 744],
  hideout: [1160, 866],
  landing: [1030, 810],
  boars: [1040, 470],
} satisfies Record<string, Point>;

/** Where the hero steps ashore at each end of the peat cutters' channel: beside the hut, and on the road by the landing. */
const CHANNEL_NORTH: Point = [170, 724];
const CHANNEL_SOUTH: Point = [1065, 812];

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
  flocks: [[620, 170], [1180, 620]],
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
      wares: ['harrowgateMail', 'fenBanner', 'astrolabe', 'recruitingDrum', 'stewardsLedger', 'helmOfFarSight', 'castellansPipes'],
      text: { about: ['The King\u2019s keep in the Fenmarch, damp to the battlements.', 'The castellan wears waders indoors, and plays the bagpipes. Badly.', 'Knights to recruit, and an armoury.'] },
    },
    {
      id: 'abbey',
      kind: 'tower',
      look: 'abbey',
      name: 'St Wendel\u2019s Abbey',
      at: at.abbey,
      done: false,
      text: {
        about: ['A ruined abbey on a hump of dry ground.', '*Someone has been lighting candles in the cloister.*'],
        done: ['The candles are out. A heron has taken over the pulpit.'],
      },
      pages: [
        {
          id: 'anselm',
          when: { notFlag: 'abbey' },
          lines: [
            'The last monk, Brother Anselm, is still here, praying for drier weather. The abbey has three things left worth giving the King\u2019s man, he says, and he can spare one:',
            'the old abbot\u2019s **staff**, for a clever head; St Wendel\u2019s **thunderbolt prayer**, for smiting, in moderation; or a **letter** for the witch, who turns out to be his big sister.',
          ],
          choices: [
            {
              id: 'staff',
              label: 'Take the abbot\u2019s staff',
              effects: { artifact: 'abbotsStaff', flags: { abbey: 'staff' }, done: true },
              lines: ['*"He won\u2019t be needing it,"* says Brother Anselm. *"He was eaten by eels in twelve hundred and four."*'],
            },
            {
              id: 'bolt',
              label: 'Learn the thunderbolt prayer',
              needs: { notSpell: 'bolt' },
              effects: { spell: 'bolt', flags: { abbey: 'bolt' }, done: true },
              lines: ['You learn it on your knees in the wet cloister. Out over the fen, the sky rumbles, interested.'],
            },
            {
              id: 'letter',
              label: 'Take his letter for the witch',
              effects: { reveal: { at: at.hideout, radius: 90 }, flags: { abbey: 'letter', anselm: true }, done: true },
              lines: [
                '*"She lives past the troll\u2019s bridge, in a hut on legs. The legs are the worst part."* He points south-east.',
                '*"Give her this, and tell her to write to her brother."*',
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'peathut',
      kind: 'mine',
      look: 'peathut',
      name: 'Peat Cutters\u2019 Hut',
      at: at.peathut,
      done: false,
      text: {
        about: ['Stacks of peat, and a hut sinking gently into the fen.', 'Nobody has answered the door in weeks.'],
        done: ['The hut is up to its windows in the fen. The peat stacks have not moved.'],
      },
      pages: [
        {
          id: 'hut',
          when: { notFlag: 'peat' },
          lines: [
            'The cutters fled from the goblins in a hurry. The hut is sinking into the fen as you watch: *there\u2019s time to save one thing.*',
            'Their **wages**, in a tin box; a pair of **eelskin boots** by the stove that fit you perfectly, which is suspicious; or their **punt**, with the pole notched for a secret channel through the reeds that comes out south of the meres, behind the troll.',
          ],
          choices: [
            {
              id: 'wages',
              label: 'Save the wages',
              effects: { treasure: 500, flags: { peat: 'wages' }, done: true },
              lines: ['You wade out with the tin box as the hut settles, with a sigh, up to its windows.'],
            },
            {
              id: 'boots',
              label: 'Save the boots',
              effects: { artifact: 'eelskinBoots', flags: { peat: 'boots' }, done: true },
              lines: ['You pull them on as the hut settles up to its windows. They are slippery, but only on the inside.'],
            },
            {
              id: 'punt',
              label: 'Save the punt',
              effects: { flags: { peat: 'punt', punt: true }, reveal: { at: at.landing, radius: 70 } },
              lines: ['You drag the punt clear as the hut settles up to its windows. The notches on the pole show the way: south through the reeds, behind the troll, to the cutters\u2019 landing.'],
            },
          ],
        },
        {
          id: 'punt',
          when: { flag: 'punt' },
          lines: ['The cutters\u2019 punt, tied up by the sunken hut. The channel runs south through the reeds, behind the troll, to their landing.'],
          choices: [
            {
              id: 'south',
              label: 'Pole the punt south',
              effects: { travel: CHANNEL_SOUTH },
              lines: ['You pole through the reeds all day, past herons, eels and one very surprised goblin, and come ashore south of the meres at dusk. The troll never saw you.'],
            },
            { id: 'stay', label: 'Not today' },
          ],
        },
      ],
    },
    {
      id: 'landing',
      kind: 'mine',
      look: 'peathut',
      name: 'The Cutters\u2019 Landing',
      at: at.landing,
      done: false,
      text: { about: ['A little boathouse at the end of a channel through the reeds.', '*Nobody has tied up here in weeks.*'] },
      pages: [
        {
          id: 'empty',
          when: { notFlag: 'punt' },
          lines: ['A little boathouse at the end of a channel through the reeds. There is no boat, and the channel is far too deep to wade.'],
          choices: [],
        },
        {
          id: 'punt',
          when: { flag: 'punt' },
          lines: ['The cutters\u2019 punt, tied up at the landing. The channel runs north through the reeds, back to the sunken hut.'],
          choices: [
            {
              id: 'north',
              label: 'Pole the punt north',
              effects: { travel: CHANNEL_NORTH },
              lines: ['A long day among the reeds. You come ashore by the sunken hut at dusk, smelling strongly of eel.'],
            },
            { id: 'stay', label: 'Not today' },
          ],
        },
      ],
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
      text: {
        about: ['It pumps the fen dry, one bucket at a time.'],
        done: ['"Come back next week, officer. The fen came back first."'],
        visit: ['"Dry lanes for the King\u2019s men!" The miller opens every sluice, and your troops march on firm ground.'],
      },
      pages: [
        {
          id: 'miller',
          when: { notFlag: 'windmill' },
          lines: [
            '*"And something for the King\u2019s man, since you\u2019re here about the goblins."* He has fished a **goblin\u2019s lucky charm** out of the sluice (*goblins are very good at finding things that aren\u2019t theirs*).',
            'Or there are his **two tall sons**, who can hit a heron at a hundred paces and would rather not, if you have room to lead a dozen archers.',
          ],
          choices: [
            {
              id: 'charm',
              label: 'Take the goblin charm',
              effects: { artifact: 'goblinCharm', flags: { windmill: 'charm' } },
              lines: ['It smells of eels and mischief. Already you have a feeling there is gold nearby.'],
            },
            {
              id: 'sons',
              label: 'Take on his sons',
              effects: { troops: [{ troop: 'archers', count: 12 }], flags: { windmill: 'sons' } },
              lines: ['They turn up with their bows, their cousins and a basket of eel pies. *"Write to your mother,"* says the miller. They won\u2019t.'],
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
          '**SOUTH-WEST:** St Wendel\u2019s Abbey.',
          '**EAST:** Eelby, and Harrowgate Keep over the river.',
          '**SOUTH:** the deep fen, and Mother Mirrow, who turned the King\u2019s tax collector into a newt.',
        ],
      },
    },
    { id: 'chest', kind: 'chest', name: 'Treasure Chest', at: at.chest, done: false, gold: 700 },
    { id: 'chest2', kind: 'chest', name: 'Treasure Chest', at: at.chest2, done: false, gold: 600 },
    {
      id: 'well',
      kind: 'well',
      name: 'St Wendel\u2019s Spring',
      at: at.well,
      done: false,
      text: {
        about: ['A spring bubbling up through the peat, clear as glass, with a tin cup on a nail.'],
        visit: ['It tastes of peat and something older. Your head clears like a mist at sunrise.'],
      },
    },
    { id: 'gold', kind: 'gold', name: 'Pile of Gold', at: at.gold, done: false, gold: 350 },
    { id: 'gold2', kind: 'gold', name: 'Pile of Gold', at: at.gold2, done: false, gold: 500 },
    {
      id: 'goblins',
      kind: 'patrol',
      name: 'Bog Goblins',
      at: at.goblins,
      done: false,
      artifact: 'brannocsLance',
      enemy: {
        look: 'goblins',
        behaviour: 'hunt',
        range: 170,
        lines: ['A great many **bog goblins**, squabbling over a boot.', 'They stop squabbling when they see your baggage, and start following it.', '*One of them is dragging a knight\u2019s lance through the mud.*'],
        army: [{ troop: 'goblins', count: 180 }],
        reward: 400,
        threat: 'They giggle, which is worse than shouting.',
        parleys: [
          {
            id: 'boot',
            label: 'Buy them a second boot',
            needs: { gold: 150 },
            effects: { done: true },
            lines: ['You buy a boot from a passing pedlar and throw it in. Now there are two boots, and so, somehow, two arguments. The goblins wander off into the reeds, still shouting.'],
          },
        ],
        flees: 'The goblins scatter into the reeds, still arguing about the boot.',
        loot: 'You find {gold} in a hollow log, and the lance, which turns out to be Sir Brannoc\u2019s, lost in the fen a hundred years ago.',
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
        lines: ['Wild boars, wallowing in a peat bog by the alder copse.', 'They look very happy about it, and would like to be left alone.'],
        army: [{ troop: 'boars', count: 14 }],
        reward: 150,
        threat: 'The biggest one stands up, dripping, and lowers its tusks.',
        tamed: 'You wade in and scratch the biggest one behind the ears. That settles it: they follow you out of the bog, delighted, and very, very muddy.',
        flees: 'The boars crash off into the alders.',
        loot: 'Truffles in the peat where they were wallowing! Worth {gold} at market.',
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
        parleys: [
          {
            id: 'toll',
            label: 'Pay the toll',
            needs: { troop: 'knights', count: 2 },
            effects: { done: true },
            lines: ['Two of your knights agree to stay and help collect tolls. They seem to like the hours. The trolls wave you across, and the bridge is yours to use.'],
          },
        ],
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
      artifact: 'witchsHat',
      enemy: {
        look: 'stockade',
        grows: 0.05,
        charge: 'Storm the hut',
        lines: ['A hut on long chicken legs, deep in the fen. Something inside is croaking.', 'Trolls doze under it, and goblins everywhere else.'],
        army: [{ troop: 'trolls', count: 15 }, { troop: 'goblins', count: 190 }, { troop: 'witch', count: 1 }],
        reward: 3000,
        threat: 'Mother Mirrow leans out of the window. *"Newts are happier, dearie. Ask him."*',
        parleys: [
          {
            id: 'letter',
            label: 'Give her Brother Anselm\u2019s letter',
            needs: { flag: 'anselm' },
            effects: { desert: { troop: 'goblins', share: 0.5 }, flags: { anselm: false } },
            lines: ['Mother Mirrow reads her little brother\u2019s letter twice, and sniffs. *"He always did write a lovely letter."* To show she isn\u2019t a monster, she sends half her goblins home to their mothers. She keeps the trolls.'],
          },
          {
            id: 'outhex',
            label: 'Out-hex her',
            needs: { background: 'wizard', spellPower: 7 },
            effects: { win: true, gold: 1500, xp: 900 },
            lines: ['Hedge magic against bog magic, over her own cauldron. Your newt-into-tax-collector spell is better than her tax-collector-into-newt spell, and she knows it. She hands over the jar with very bad grace.'],
            because: 'she wouldn\u2019t hand over the jar for less than half',
          },
        ],
        flees: 'The hut sits down with a thump.',
        loot: 'The Crown pays {gold}.',
      },
      text: { done: ['The hut is empty, apart from a great many jars.'] },
    },
  ],
};
