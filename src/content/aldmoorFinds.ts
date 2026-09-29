import type { Location } from '../rules/state';

/**
 * Small things along Aldmoor's rides (#124): wherever a player rides, something worth stopping for is
 * less than a day away, and on the roads there's something about every half day (`rules/map/rides.ts`
 * measures it). They're small on purpose, for the balance's sake: a line of gossip, a scrap of the
 * Baron's orders, a lost pack, a band to fight, pay or dodge. None of them answers a quest.
 */
export const FINDS: Location[] = [
  // --- On the roads ---------------------------------------------------------------------------
  {
    id: 'crossroads',
    kind: 'signpost',
    name: 'The Crossroads',
    at: [1566, 1514],
    done: false,
    text: {
      about: [
        '**NORTH:** the heath, the old watchtower, and the crags.',
        '**WEST:** the kennels, and Darkwood. *Mind the dogs.* Somebody has scratched underneath: *THEY ARE NOT DOGS.*',
        '**EAST:** the old bridge, Westmere, and a hot dinner.',
      ],
    },
  },
  {
    id: 'tollboard',
    kind: 'signpost',
    name: 'The Baron\u2019s Toll-board',
    at: [566, 790],
    done: false,
    text: {
      about: [
        '**BARON GRIMSBY\u2019S ROAD.** Toll: one penny. Carts: tuppence. Geese: free.',
        '*There is no toll-keeper, and there never has been. The Baron just likes the sign.*',
      ],
    },
  },
  {
    id: 'diggersCamp',
    kind: 'event',
    look: 'campfire',
    name: 'The Diggers\u2019 Fire',
    at: [1120, 512],
    done: false,
    text: { about: ['A ring of cold ashes by the road, and the marks of a great many spades.', '*Somebody has left a letter under a stone.*'] },
    pages: [
      {
        id: 'orders',
        lines: [
          'Grimsby\u2019s diggers camped here on their way to the heath. Under the stone, in the Baron\u2019s hand:',
          '*"RATIONS FOR THE DIG. Forty men: one sausage each. Forty spades. The goose is NOT a ration, and the next man who says so is digging the latrines. G."*',
        ],
        choices: [],
      },
    ],
  },
  {
    id: 'nest',
    kind: 'event',
    look: 'nest',
    name: 'An Eagle\u2019s Nest',
    at: [1450, 472],
    done: false,
    text: { about: ['An eagle\u2019s nest on a crag by the road, and something in it catching the sun.'] },
    pages: [
      {
        id: 'ledge',
        when: { notFlag: 'nest' },
        lines: ['The nest is lined with the things eagles like: a spoon, three buttons, somebody\u2019s spectacles, and a scatter of old coins. *The eagle is out.*'],
        choices: [
          {
            id: 'climb',
            label: 'Climb up for the coins',
            effects: { treasure: 60, flags: { nest: true } },
            lines: ['You leave her the spoon and the spectacles. It seems only fair.'],
          },
          { id: 'leave', label: 'Leave them to the eagle' },
        ],
      },
      { id: 'robbed', when: { flag: 'nest' }, lines: ['The eagle is back, and has counted her buttons. She gives you a very long look.'], choices: [] },
    ],
  },
  {
    id: 'picketsCamp',
    kind: 'event',
    look: 'campfire',
    name: 'The Pickets\u2019 Fire',
    at: [292, 1880],
    done: false,
    text: { about: ['A pickets\u2019 fire by the Baron\u2019s road, still warm, and nobody minding it.', '*A note is nailed to the nearest pine.*'] },
    pages: [
      {
        id: 'note',
        lines: [
          '*"PICKETS. If the King\u2019s man comes, shout. If he doesn\u2019t come, shout anyway, every hour, so I know you\u2019re awake. G."*',
          'Underneath, in another hand: *"Gone after rabbits. Back soon. Shout if you need us."*',
        ],
        choices: [],
      },
    ],
  },
  {
    id: 'hamper',
    kind: 'gold',
    look: 'hamper',
    name: 'A Wicker Hamper',
    at: [322, 1500],
    done: false,
    gold: 100,
    text: {
      about: ['A wicker hamper in the ditch by the Baron\u2019s road, with **B.G.** on the lid in gold.', '*It fell off somebody\u2019s pony.*'],
      visit: ['The Baron\u2019s lunch: a pork pie, a pot of goose grease (for her feathers), and {gold} in a silk purse. There\u2019s a note in with the pie: *"More pie. G."*'],
    },
  },
  {
    id: 'fordpack',
    kind: 'gold',
    look: 'pack',
    name: 'A Pedlar\u2019s Pack',
    at: [1840, 408],
    done: false,
    gold: 80,
    text: {
      about: ['A pedlar\u2019s pack, washed up against the stepping stones of the ford.'],
      visit: ['Ribbons, buttons, a tin whistle, and {gold} in a sock. *Somewhere downstream, a pedlar is having a very bad week.*'],
    },
  },

  // --- The downs --------------------------------------------------------------------------------
  {
    id: 'shepherd',
    kind: 'event',
    look: 'fold',
    name: 'Old Tam\u2019s Fold',
    at: [2236, 572],
    done: false,
    text: { about: ['A drystone fold on the downs, half full of sheep, and an old shepherd leaning on his crook.', '*The other half of the fold is very empty.*'] },
    pages: [
      {
        id: 'home',
        when: { flag: 'ewes', notFlag: 'tam' },
        lines: ['Old Tam counts his ewes back in, twice, and a third time for luck. *"Every one. Even Maud, and nobody wants Maud."*'],
        choices: [
          {
            id: 'thanks',
            label: 'Shake his hand',
            effects: { xp: 60, flags: { tam: true } },
            lines: ['He shakes your hand for a long time, and gives you a cheese the size of a cartwheel. By Sunday every shepherd on the downs knows the King\u2019s man by name.'],
          },
        ],
      },
      { id: 'thanked', when: { flag: 'tam' }, lines: ['Old Tam is asleep against the wall of his fold, his ewes round him. Maud is eating his hat.'], choices: [] },
      {
        id: 'fold',
        lines: [
          '*"Rustlers,"* says Old Tam. *"Took half my ewes off over the downs, bold as you like, while I was at my dinner."*',
          '*"The Baron\u2019s men used to see rustlers off. Now they\u2019re all too busy digging holes in the heath."*',
        ],
        choices: [],
      },
    ],
  },
  {
    id: 'rustlers',
    kind: 'patrol',
    name: 'Rustlers',
    at: [2560, 420],
    done: false,
    enemy: {
      look: 'soldiers',
      tier: 'pest',
      behaviour: 'roam',
      range: 80,
      lines: ['Rustlers, lying low in a hollow of the downs with a flock that isn\u2019t theirs, waiting for dark.', '*The sheep have a look of Old Tam\u2019s about them.*'],
      army: [{ troop: 'bandits', count: 9 }],
      reward: 90,
      threat: '*"These are our sheep,"* says the biggest. *"We\u2019ve had them for hours."*',
      parleys: [
        {
          id: 'buy',
          label: 'Buy the ewes back',
          needs: { gold: 80 },
          effects: { done: true, flags: { ewes: true } },
          lines: ['They count your money, count the sheep, decide it comes out about even, and go off over the downs whistling. The ewes set off home to Old Tam\u2019s fold.'],
        },
        {
          id: 'shame',
          label: 'Tell them whose sheep these are',
          needs: { background: 'courtier' },
          effects: { done: true, xp: 40, flags: { ewes: true } },
          lines: ['You tell them, at length and with gestures, whose sheep these are and what the King thinks of rustling. By the end they are driving the ewes home to Old Tam themselves, and apologising to Maud.'],
        },
      ],
      spoils: { flags: { ewes: true } },
      flees: 'The rustlers scatter over the downs. The sheep stay where they are, chewing.',
      loot: 'In their pockets: {gold}. And forty ewes, who set off home to Old Tam\u2019s fold without being asked.',
    },
  },
  {
    id: 'eelcatcher',
    kind: 'event',
    look: 'boat',
    name: 'The Eel-catcher',
    at: [1792, 770],
    done: false,
    text: { about: ['A boat pulled up on the bank, eel traps drying beside it, and an eel-catcher mending a net.'] },
    pages: [
      {
        id: 'net',
        when: { notFlag: 'eel' },
        lines: [
          '*"Eels? River\u2019s full of \u2019em. So\u2019s the ford. That\u2019s why nobody wades it barefoot twice."*',
          '*"The Baron won\u2019t ride this way. Says the ford\u2019s beneath him. Well, it is. It\u2019s under the water."*',
        ],
        choices: [
          {
            id: 'eel',
            label: 'Buy a smoked eel',
            needs: { gold: 10 },
            effects: { movement: 30, flags: { eel: true } },
            lines: ['Your men pass it round, and march all the faster afterwards, to get away from the smell.'],
          },
          { id: 'leave', label: 'Ride on' },
        ],
      },
      { id: 'eaten', when: { flag: 'eel' }, lines: ['The eel-catcher waves a very long eel at you. You wave back, carefully.'], choices: [] },
    ],
  },

  // --- The fields -------------------------------------------------------------------------------
  {
    id: 'collectors',
    kind: 'patrol',
    name: 'The Baron\u2019s Tax Collectors',
    at: [2090, 1000],
    done: false,
    enemy: {
      look: 'soldiers',
      tier: 'pest',
      behaviour: 'roam',
      range: 90,
      lines: ['The Baron\u2019s tax collectors, going from farm to farm with a very large ledger.', '*They are collecting the taxes the Baron owes the King, from the King\u2019s own farmers.*'],
      army: [{ troop: 'swordsmen', count: 5 }, { troop: 'crossbowmen', count: 3 }],
      reward: 120,
      threat: 'The one with the ledger licks his pencil. *"Name? Farm? Arrears?"*',
      parleys: [
        {
          id: 'pay',
          label: 'Pay what they say you owe',
          needs: { gold: 100 },
          effects: { done: true },
          lines: ['The one with the ledger writes you down, underlines you twice, and gives you a receipt with the Baron\u2019s seal on it. They go off to bother somebody else.'],
        },
        {
          id: 'audit',
          label: 'Ask to see their sums',
          needs: { background: 'courtier' },
          effects: { done: true, xp: 60 },
          lines: ['You find three mistakes in the Baron\u2019s sums, all in the King\u2019s favour, and read them out slowly. The collectors go pale, shut the ledger and go home to think about it.'],
        },
      ],
      flees: 'The tax collectors run for the bridge, dropping receipts.',
      loot: 'In their strongbox: {gold}, and the Baron\u2019s ledger. *"Owed to the King: three years\u2019 taxes. Pay later. One goose. NEVER. G."*',
    },
  },
  {
    id: 'hayrick',
    kind: 'event',
    look: 'hayrick',
    name: 'The Hayrick',
    at: [2690, 1290],
    done: false,
    text: { about: ['A hayrick in the stubble, with a pitchfork stuck in it and a pair of boots sticking out of the top.'] },
    pages: [
      {
        id: 'boots',
        lines: [
          'The boots belong to a farmhand, who is not asleep. *"Guarding the hay, sir. The Baron\u2019s men took last year\u2019s, for his pony."*',
          '*"Ate the lot, that pony. Most spoiled pony in the King\u2019s country. Sleeps indoors."*',
        ],
        choices: [],
      },
    ],
  },
  {
    id: 'goosePond',
    kind: 'event',
    look: 'pond',
    name: 'The Goose Pond',
    at: [2460, 1590],
    done: false,
    text: { about: ['A pond at the bottom of Westmere green, and a great many geese, every one of them looking at you.'] },
    pages: [
      {
        id: 'geese',
        lines: [
          'The goose-girl says every goose in Aldmoor is some cousin of the royal goose, and they all know it.',
          '*"The Baron came by once, with her under his arm. Every goose on the pond hissed him all the way to the bridge. Geese don\u2019t forget."*',
        ],
        choices: [],
      },
    ],
  },

  // --- The heath --------------------------------------------------------------------------------
  {
    id: 'skeps',
    kind: 'event',
    look: 'skeps',
    name: 'Widow Hesketh\u2019s Bees',
    at: [1400, 760],
    done: false,
    text: { about: ['Straw beehives in a row on the heather, humming, and a widow in a veil.'] },
    pages: [
      {
        id: 'honey',
        when: { notFlag: 'hesketh' },
        lines: [
          '*"Heather honey. Best in the King\u2019s country. The Baron\u2019s men came for it last summer, and my girls had a word with them."*',
          '*"There\u2019s a pot for the King\u2019s man, since he asked nicely. Keeps a soldier going all day."*',
        ],
        choices: [
          {
            id: 'honey',
            label: 'Take the pot of honey',
            effects: { movement: 40, flags: { hesketh: true } },
            lines: ['Your men share it round, and march the rest of the day with sticky beards and no complaints.'],
          },
          { id: 'leave', label: 'Ride on' },
        ],
      },
      { id: 'after', when: { flag: 'hesketh' }, lines: ['The bees hum. Widow Hesketh waves her smoker at you, and the bees stay home.'], choices: [] },
    ],
  },
  {
    id: 'stones',
    kind: 'event',
    look: 'stones',
    name: 'The Grey Wethers',
    at: [980, 1100],
    done: false,
    text: { about: ['A ring of old standing stones on the heath: older than the King, older than the old King, older than the heath.'] },
    pages: [
      {
        id: 'ring',
        when: { notFlag: 'wethers' },
        lines: ['The shepherds call them the Grey Wethers, and say they go down to the river to drink on midsummer night. The tallest has footholds cut in it, worn smooth.'],
        choices: [
          {
            id: 'climb',
            label: 'Climb the tallest stone',
            effects: { reveal: { at: [980, 1100], radius: 420 }, flags: { wethers: true } },
            lines: ['From the top you can see half the heath: the old watchtower, smoke over the kennels, and a very great deal of heather.'],
          },
          { id: 'leave', label: 'Leave them be' },
        ],
      },
      { id: 'after', when: { flag: 'wethers' }, lines: ['The stones stand where they stood. *Probably.*'], choices: [] },
    ],
  },
  {
    id: 'tinkersPack',
    kind: 'gold',
    look: 'pack',
    name: 'A Tinker\u2019s Pack',
    at: [880, 1390],
    done: false,
    gold: 60,
    text: {
      about: ['A tinker\u2019s pack, dropped in the heather in a hurry.', '*Something made him run. Something with a great many feet, by the tracks.*'],
      visit: ['Pots, pans, a kettle with no bottom, and {gold} that fell out of it.'],
    },
  },

  // --- The edge of the King's chase ---------------------------------------------------------------
  {
    id: 'charcoal',
    kind: 'event',
    look: 'kiln',
    name: 'The Charcoal Burners',
    at: [2040, 1920],
    done: false,
    text: { about: ['A charcoal clamp smoking at the edge of the King\u2019s chase, and two burners as black as their charcoal, watching it.'] },
    pages: [
      {
        id: 'clamp',
        lines: [
          '*"The chase is thin of deer since the Baron gave Rook the hunting,"* says the elder. *"Him and his wolves, and every poacher in Aldmoor after what\u2019s left."*',
          '*"The old King\u2019s huntsmen would never have stood for it. Nobody\u2019s seen them since his hall was shut."*',
        ],
        choices: [],
      },
    ],
  },
  {
    id: 'hubert',
    kind: 'event',
    look: 'shrine',
    name: 'St Hubert\u2019s Shrine',
    at: [1800, 1940],
    done: false,
    text: { about: ['A little shrine to St Hubert, patron saint of hunters, with a stag\u2019s antlers nailed over it.'] },
    pages: [
      {
        id: 'apple',
        when: { notFlag: 'hubert' },
        lines: ['St Hubert gave up hunting when a stag asked him to, which is more notice than most hunters get. His shrine is swept, and somebody has left him an apple.'],
        choices: [
          {
            id: 'pray',
            label: 'Leave him an apple of your own',
            effects: { movement: 30, flags: { hubert: true } },
            lines: ['A stag watches you from the edge of the chase, and nods. You ride on the lighter for it.'],
          },
          { id: 'leave', label: 'Ride on' },
        ],
      },
      { id: 'after', when: { flag: 'hubert' }, lines: ['Two apples on the step now. Something has had a bite out of one.'], choices: [] },
    ],
  },
];
