import type { Location } from '../rules/state';

/**
 * Small things along Aldmoor's rides (#124): wherever a player rides, something worth stopping for is
 * less than a day away, and on the roads there's something about every half day (`rules/map/rides.ts`
 * measures it). They're small on purpose, for the balance's sake: a line of gossip, a scrap of the
 * Baron's orders, a lost pack. None of them answers a quest. The bands here are the climb's (#239),
 * each in its ring (`ring` in rules/state.ts), as big as the ring says: see `docs/BALANCE.md`.
 */
export const FINDS: Location[] = [
  // --- Chests (#192): they all look the same, as in King's Bounty, and each holds something different ---
  {
    id: 'heathChest',
    kind: 'chest',
    name: 'A Chest in the Heather',
    at: [844, 799],
    done: false,
    gold: 150,
    text: { about: ['An iron-bound chest lies half hidden in the heather, as if somebody meant to come back for it.'] },
  },
  {
    id: 'hedgeChest',
    kind: 'chest',
    name: 'A Chest under the Hedge',
    at: [2718, 1035],
    done: false,
    gold: 200,
    text: { about: ['Somebody has pushed a chest under a hedge at the edge of a field, and thrown a sack over it.'] },
  },
  {
    id: 'cragChest',
    kind: 'chest',
    name: 'A Chest in the Crags',
    at: [1300, 500],
    done: false,
    gold: 120,
    text: { about: ['A chest is wedged in a cleft of the crags, where nobody would find it unless they climbed.'] },
  },
  {
    id: 'pineChest',
    kind: 'chest',
    name: 'A Chest under the Pines',
    at: [436, 1276],
    done: false,
    gold: 200,
    guard: 'spiders',
    text: {
      about: ['A chest lies under the pines, green with moss, and something has spun a web over it as thick as a blanket.'],
      later: [{ when: { used: 'spiders' }, about: ['A chest lies under the pines, green with moss, and its padlock has rusted right through.'] }],
    },
  },
  // Darkwood's spiders (#239), in the climb's fifth ring: their webs run from the chest under the pines to the lone pine.
  {
    id: 'spiders',
    kind: 'patrol',
    name: 'Giant Spiders',
    at: [400, 1250],
    done: false,
    enemy: {
      look: 'wolves',
      ring: 5,
      behaviour: 'guard',
      lines: ['Giant spiders have strung their webs through the western pines, from a mossy old chest to the lone pine.', '*A pack of wolves sits round the edge of the webs, waiting for whatever falls out.*'],
      army: [{ troop: 'spiders', count: 28 }, { troop: 'wolves', count: 24 }],
      reward: 150,
      threat: 'The biggest spider comes down on a thread to look at you, and the wolves get up.',
      tamed: 'You stand very still in the webs all afternoon. At dusk the biggest spider decides you are not lunch, the rest follow it, and the wolves follow the spiders.',
      flees: 'The spiders scuttle up into the pines, and the wolves slink off after something easier.',
      loot: 'Wrapped up in the webs you find {gold}, a pedlar\u2019s hat and a great many buttons.',
    },
  },
  {
    id: 'riverChest',
    kind: 'chest',
    name: 'A Chest by the River',
    at: [1815, 1089],
    done: false,
    guard: 'outlaws',
    text: {
      about: ['A small chest with a wax seal on its lid sits on a flat stone by the river, and a band of outlaws is camped round it.'],
      later: [{ when: { used: 'outlaws' }, about: ['A small chest sits on a flat stone by the river, dry as a bone, with a wax seal on its lid.'] }],
    },
    pages: [
      {
        id: 'scroll',
        when: { notSpell: 'slow' },
        lines: ['You break the seal. Inside, wrapped in oilcloth, is a scroll in a wizard\u2019s hand, with a charm written out on it.'],
        choices: [{ id: 'read', label: 'Read the charm', effects: { spell: 'slow', done: true }, lines: ['You read it through twice, and the third time the words stay put.'] }],
      },
      {
        id: 'known',
        lines: ['You break the seal. Inside is a scroll with the charm for **Slow** on it, which you know already, and somebody has filled its margins with notes.'],
        choices: [{ id: 'notes', label: 'Read the notes in its margins', effects: { xp: 100, done: true }, lines: ['The notes are better than the charm.'] }],
      },
    ],
  },
  // Outlaws (#239), in the climb's third ring, camped round the chest by the river above the mill.
  {
    id: 'outlaws',
    kind: 'patrol',
    name: 'Outlaws',
    at: [1858, 1050],
    done: false,
    enemy: {
      look: 'soldiers',
      ring: 3,
      behaviour: 'guard',
      lines: ['A band of outlaws has made camp by the river, round a little chest with a wax seal on its lid.', '*They have been arguing for a week about who gets to open it.*'],
      army: [{ troop: 'bandits', count: 35 }, { troop: 'cutpurses', count: 27 }, { troop: 'poachers', count: 32 }, { troop: 'highwaymanCaptain', count: 1, level: 4 }],
      reward: 250,
      threat: 'The biggest outlaw puts his boot on the chest. *"Finders keepers."*',
      flees: 'The outlaws scatter along the riverbank, still arguing.',
      loot: 'In their camp you find {gold}, and the chest, still sealed.',
    },
  },
  {
    id: 'downsChest',
    kind: 'chest',
    name: 'A Chest in a Hollow',
    at: [2007, 550],
    done: false,
    text: { about: ['A battered chest lies in a hollow of the downs, where a shepherd might shelter from the rain.'] },
    pages: [
      {
        id: 'map',
        lines: ['Inside, rolled up tight, is a map of the King\u2019s chase, drawn by one of the old King\u2019s huntsmen. Every track and every hollow oak is on it.'],
        choices: [{ id: 'study', label: 'Study the map', effects: { reveal: { at: [2380, 1960], radius: 460 }, done: true }, lines: ['You learn the chase by heart before you roll the map up again.'] }],
      },
    ],
  },
  {
    id: 'gildedChest',
    kind: 'chest',
    name: 'A Gilded Chest',
    at: [1162, 1070],
    done: false,
    guard: 'heathWolves',
    text: {
      about: ['A gilded chest stands in the heather, and a pack of wolves lies round it as if it were theirs.'],
      later: [{ when: { used: 'heathWolves' }, about: ['A gilded chest stands in the heather where the wolves were lying.'] }],
    },
    pages: [
      {
        id: 'breastplate',
        lines: ['You pry the lid off. Inside, wrapped in old sacking, lies a breastplate with the King\u2019s crown on it. It must have fallen off a cart a long time ago.'],
        choices: [{ id: 'take', label: 'Take the breastplate', effects: { artifact: 'breastplate', done: true } }],
      },
    ],
  },
  {
    id: 'heathWolves',
    kind: 'patrol',
    name: 'Wolves',
    at: [1194, 1092],
    done: false,
    enemy: {
      look: 'wolves',
      ring: 4,
      behaviour: 'guard',
      lines: ['A big pack of wolves lies round a gilded chest in the heather, and not one of them is asleep.'],
      army: [{ troop: 'wolves', count: 61 }],
      reward: 150,
      threat: 'The biggest wolf gets up, stretches, and shows you all of its teeth.',
      tamed: 'You sit down in the heather and wait. One by one the wolves come and lie down at your feet, and the chest is yours.',
      flees: 'The wolves melt away into the heather.',
      loot: 'Round the chest you find {gold} in old coins, and a great many bones.',
    },
  },
  {
    id: 'rootChest',
    kind: 'chest',
    name: 'A Chest among the Roots',
    at: [2106, 1822],
    done: false,
    guard: 'chaseBoars',
    text: {
      about: ['A chest lies among the roots of an old oak, and a sounder of boars is rooting all round it.'],
      later: [{ when: { used: 'chaseBoars' }, about: ['A chest lies among the roots of an old oak, in ground the boars have turned over.'] }],
    },
    pages: [
      {
        id: 'button',
        lines: ['You pry the lid off. Inside, on a velvet cushion, lies a single brass button, and the cushion has a wizard\u2019s star on it.'],
        choices: [{ id: 'take', label: 'Take the button', effects: { artifact: 'wizardsButton', done: true } }],
      },
    ],
  },
  {
    id: 'chaseBoars',
    kind: 'patrol',
    name: 'A Sounder of Boars',
    at: [2148, 1822],
    done: false,
    enemy: {
      look: 'wolves',
      ring: 3,
      behaviour: 'guard',
      lines: ['A sounder of boars is rooting round a chest under an old oak, and the old sow is watching you.'],
      army: [{ troop: 'boars', count: 56 }],
      reward: 100,
      threat: 'The old sow lowers her head and scrapes the ground, and the rest of them do as she does.',
      tamed: 'You scatter a pocketful of acorns, and the whole sounder follows them into your baggage train, the old sow first.',
      flees: 'The boars crash away into the chase.',
      loot: 'Where they were rooting you find {gold}, and a great many truffles.',
    },
  },

  // --- On the roads ---------------------------------------------------------------------------
  // Cutpurses (#239), the climb's first ring: the first fight on the King's road, between the castle and St Aldhelm's shrine.
  {
    id: 'cutpurses',
    kind: 'patrol',
    name: 'Cutpurses',
    at: [2760, 944],
    done: false,
    enemy: {
      look: 'soldiers',
      ring: 1,
      behaviour: 'roam',
      range: 80,
      lines: ['Cutpurses are working the King\u2019s road between the castle and St Aldhelm\u2019s shrine, with a few poachers to keep watch for them.', '*The pilgrims coming home from the shrine are a good deal lighter than when they set out.*'],
      army: [{ troop: 'cutpurses', count: 25 }, { troop: 'poachers', count: 20 }, { troop: 'cutpurseCaptain', count: 1, level: 1 }],
      reward: 100,
      threat: 'The smallest of them tips his hat to you. The rest are already behind you.',
      flees: 'The cutpurses scatter into the hedges.',
      loot: 'You find {gold} in their pockets, and most of it belonged to the pilgrims.',
    },
  },
  {
    id: 'crossroads',
    kind: 'signpost',
    name: 'The Crossroads',
    at: [1566, 1514],
    done: false,
    text: {
      about: [
        '**NORTH:** the heath, the old watchtower, and the crags.',
        '**WEST:** the kennels, and Darkwood. *Mind the dogs.* Somebody has scratched *THEY ARE NOT DOGS* underneath.',
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
    text: { about: ['A ring of cold ashes lies by the road, among the marks of a great many spades.', '*Somebody has left a letter under a stone.*'] },
    pages: [
      {
        id: 'orders',
        lines: [
          'Grimsby\u2019s diggers camped here on their way to the heath. Under the stone is a letter in the Baron\u2019s hand.',
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
    text: { about: ['An eagle\u2019s nest sits on a crag by the road, and something in it is catching the sun.'] },
    pages: [
      {
        id: 'ledge',
        when: { notFlag: 'nest' },
        lines: ['The nest is lined with all the things eagles like, such as a spoon, three buttons, somebody\u2019s spectacles and a scatter of old coins. *The eagle is out.*'],
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
    text: { about: ['Somebody has left a pickets\u2019 fire burning by the Baron\u2019s road, and nobody is minding it.', '*A note is nailed to the nearest pine.*'] },
    pages: [
      {
        id: 'note',
        lines: [
          '*"PICKETS. If the King\u2019s man comes, shout. If he doesn\u2019t come, shout anyway, every hour, so I know you\u2019re awake. G."*',
          'Underneath, somebody else has written, *"Gone after rabbits. Back soon. Shout if you need us."*',
        ],
        choices: [],
      },
    ],
  },
  // The Baron's pickets (#239), the climb's fifth ring: back from their rabbits, and walking Darkwood's west road.
  {
    id: 'pickets',
    kind: 'patrol',
    name: 'The Baron\u2019s Pickets',
    at: [276, 1690],
    done: false,
    enemy: {
      look: 'soldiers',
      ring: 5,
      behaviour: 'roam',
      range: 120,
      lines: ['The Baron\u2019s pickets are back from their rabbits, and are walking the road through Darkwood in their best plate.', '*Every one of them has a brace of rabbits on his belt, and none of them is sharing.*'],
      army: [{ troop: 'menAtArms', count: 21 }, { troop: 'pikemen', count: 25 }, { troop: 'crossbowmen', count: 22 }, { troop: 'picketCaptain', count: 1, level: 8 }],
      reward: 300,
      threat: '*"Told you he\u2019d come,"* says one of the pickets, and the rest level their pikes.',
      lastWords: 'I knew we should have stayed out after rabbits.',
      flees: 'The pickets run for the stockade, dropping rabbits.',
      loot: 'Among the rabbits they dropped you find {gold}, the pickets\u2019 pay.',
    },
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
      about: ['A wicker hamper lies in the ditch by the Baron\u2019s road, with **B.G.** on the lid in gold.', '*It fell off somebody\u2019s pony.*'],
      visit: ['It is the Baron\u2019s lunch. Inside you find a pork pie, a pot of goose grease for her feathers, and {gold} in a silk purse. The note in with the pie says, *"More pie. G."*'],
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
      about: ['A pedlar\u2019s pack has washed up against the stepping stones of the ford.'],
      visit: ['It holds ribbons, buttons, a tin whistle, and {gold} in a sock. *Somewhere downstream, a pedlar is having a very bad week.*'],
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
    text: { about: ['A drystone fold on the downs is half full of sheep, and an old shepherd is leaning on his crook beside it.', '*The other half of the fold is very empty.*'] },
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
      ring: 2,
      behaviour: 'roam',
      range: 80,
      lines: ['Rustlers are lying low in a hollow of the downs with a flock that isn\u2019t theirs, waiting for dark.', '*The sheep have a look of Old Tam\u2019s about them.*'],
      army: [{ troop: 'bandits', count: 39 }, { troop: 'cutpurses', count: 25 }, { troop: 'highwaymanCaptain', count: 1, level: 2 }],
      reward: 120,
      threat: '*"These are our sheep,"* says the biggest. *"We\u2019ve had them for hours."*',
      parleys: [
        {
          id: 'buy',
          label: 'Buy the ewes back',
          needs: { gold: 150 },
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
      loot: 'Their pockets hold {gold}. The forty ewes set off home to Old Tam\u2019s fold without being asked.',
    },
  },
  {
    id: 'eelcatcher',
    kind: 'event',
    look: 'boat',
    name: 'The Eel-catcher',
    at: [1792, 770],
    done: false,
    text: { about: ['An eel-catcher is mending a net beside his boat, with his eel traps drying on the bank.'] },
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
      ring: 2,
      behaviour: 'roam',
      range: 90,
      lines: ['The Baron\u2019s tax collectors are going from farm to farm with a very large ledger, and pikes to make their point.', '*They are collecting the taxes the Baron owes the King, from the King\u2019s own farmers.*'],
      army: [{ troop: 'swordsmen', count: 29 }, { troop: 'pikemen', count: 23 }, { troop: 'crossbowmen', count: 21 }, { troop: 'sergeant', count: 1, level: 2 }],
      reward: 150,
      threat: 'The one with the ledger licks his pencil. *"Name? Farm? Arrears?"*',
      parleys: [
        {
          id: 'pay',
          label: 'Pay what they say you owe',
          needs: { gold: 200 },
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
      loot: 'Their strongbox holds {gold}, and the Baron\u2019s ledger. *"Owed to the King: three years\u2019 taxes. Pay later. One goose. NEVER. G."*',
    },
  },
  {
    id: 'hayrick',
    kind: 'event',
    look: 'hayrick',
    name: 'The Hayrick',
    at: [2690, 1290],
    done: false,
    text: { about: ['A hayrick stands in the stubble, with a pitchfork stuck in it and a pair of boots sticking out of the top.'] },
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
    text: { about: ['There is a pond at the bottom of Westmere green, and a great many geese on it, every one of them looking at you.'] },
    pages: [
      {
        id: 'thanks',
        when: { flag: 'geese', notFlag: 'gooseGirl' },
        lines: [
          'The goose-girl counts the geese on the pond, pointing at each one with her stick. *"Every one of them home, and not a feather missing. The royal goose will hear of this."*',
          'She takes the feather out of her hat and gives it to you. It has brought her luck all her life, she says, and now it can bring you some.',
        ],
        choices: [{ id: 'feather', label: 'Take her lucky feather', effects: { artifact: 'luckyFeather', flags: { gooseGirl: true } } }],
      },
      {
        id: 'geese',
        lines: [
          'The goose-girl says every goose in Aldmoor is some cousin of the royal goose, and they all know it.',
          '*"The Baron came by once, with her under his arm. Every goose on the pond hissed him all the way to the bridge. Geese don\u2019t forget."*',
          '*"Seven of mine have wandered off, and I can\u2019t leave the rest to go looking. If you see one, send her home."*',
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
    text: { about: ['Straw beehives hum in a row on the heather, and a widow in a veil is tending them.'] },
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
    text: { about: ['There is a ring of old standing stones on the heath. They are older than the King, older than the old King, and older than the heath.'] },
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
            lines: ['From the top you can see half the heath, with the old watchtower, smoke over the kennels, and a very great deal of heather.'],
          },
          { id: 'leave', label: 'Leave them be' },
        ],
      },
      { id: 'after', when: { flag: 'wethers' }, lines: ['The stones stand where they stood. *Probably.*'], choices: [] },
    ],
  },
  // --- Lookouts (#192): one in each land that had none, each lifting the mist round it as the Grey Wethers do ---
  {
    id: 'beacon',
    kind: 'event',
    look: 'beacon',
    name: 'The Beacon on the Downs',
    at: [2840, 600],
    done: false,
    text: { about: ['An old beacon stands on the top of the downs, where they lit a fire to warn the castle. Somebody still keeps it burning.'] },
    pages: [
      {
        id: 'climb',
        when: { notFlag: 'beacon' },
        lines: ['The beacon stands on the highest point of the downs. On a clear day, they say, you can see the sea from here. You can\u2019t, but you can see a great deal of Aldmoor.'],
        choices: [
          {
            id: 'look',
            label: 'Climb up beside the fire',
            effects: { reveal: { at: [2840, 600], radius: 440 }, flags: { beacon: true } },
            lines: ['From up here you can see the downs rolling away to the castle, the King\u2019s road, and sheep in every direction.'],
          },
          { id: 'leave', label: 'Leave it be' },
        ],
      },
      { id: 'after', when: { flag: 'beacon' }, lines: ['The beacon is still burning. Nobody has come to see why.'], choices: [] },
    ],
  },
  {
    id: 'lonePine',
    kind: 'event',
    look: 'lonePine',
    name: 'The Lone Pine',
    at: [264, 1224],
    done: false,
    guard: 'spiders',
    text: {
      about: ['One pine stands head and shoulders above the rest of Darkwood, with rungs nailed up its trunk and webs strung between the rungs.', '*They are not small webs.*'],
      later: [{ when: { used: 'spiders' }, about: ['One pine stands head and shoulders above the rest of Darkwood, and somebody has nailed rungs up its trunk.'] }],
    },
    pages: [
      {
        id: 'climb',
        when: { notFlag: 'lonePine' },
        lines: ['The rungs go up a long way. The old King\u2019s foresters used to watch for fires from the top.'],
        choices: [
          {
            id: 'look',
            label: 'Climb the pine',
            effects: { reveal: { at: [264, 1224], radius: 400 }, flags: { lonePine: true } },
            lines: ['From the top you can see over Darkwood to the heath, and smoke rising far off in the south, where the Baron keeps his stockade.'],
          },
          { id: 'leave', label: 'Stay on the ground' },
        ],
      },
      { id: 'after', when: { flag: 'lonePine' }, lines: ['The pine sways a little in the wind. Better it than you.'], choices: [] },
    ],
  },
  {
    id: 'huntStand',
    kind: 'event',
    look: 'stand',
    name: 'The Old King\u2019s Hunting Stand',
    at: [2216, 1976],
    done: false,
    text: { about: ['A little wooden pavilion stands on a rise in the King\u2019s chase, where the old King sat to watch the hunt go by.'] },
    pages: [
      {
        id: 'climb',
        when: { notFlag: 'huntStand' },
        lines: ['The old King had a good eye for a view. The steps up to it are rotten, but the seat at the top is still sound.'],
        choices: [
          {
            id: 'look',
            label: 'Climb up to his seat',
            when: { notUsed: 'bears' },
            effects: { reveal: { at: [2216, 1976], radius: 420 }, flags: { huntStand: true } },
            lines: ['From the old King\u2019s seat you can see the chase laid out below you, its rides, its clearings and its oaks, and something large asleep on the track to the lodge.'],
          },
          // Once the bears have gone from the track (tamed, beaten or paid off), the view says so.
          {
            id: 'lookClear',
            label: 'Climb up to his seat',
            when: { used: 'bears' },
            effects: { reveal: { at: [2216, 1976], radius: 420 }, flags: { huntStand: true } },
            lines: ['From the old King\u2019s seat you can see the chase laid out below you, its rides, its clearings and its oaks, and the track to the lodge, clear all the way now.'],
          },
          { id: 'leave', label: 'Leave it be' },
        ],
      },
      { id: 'after', when: { flag: 'huntStand' }, lines: ['The old King\u2019s seat is still there. It is a very good seat.'], choices: [] },
    ],
  },
  {
    id: 'cairn',
    kind: 'event',
    look: 'cairn',
    name: 'The Old Cairn',
    at: [792, 440],
    done: false,
    text: { about: ['Somebody piled stones into a cairn on the crags above the heath, a long time ago, and every traveller since has added one.'] },
    pages: [
      {
        id: 'climb',
        when: { notFlag: 'cairn' },
        lines: ['There is a path of sorts up to the cairn, and a fine view from the top of it.'],
        choices: [
          {
            id: 'look',
            label: 'Climb up and add a stone',
            effects: { reveal: { at: [792, 440], radius: 420 }, flags: { cairn: true } },
            lines: ['You add your stone to the cairn. From up here you can see the heath spread out below you, the old watchtower, and somebody\u2019s men digging a great many holes in it.'],
          },
          { id: 'leave', label: 'Leave it be' },
        ],
      },
      { id: 'after', when: { flag: 'cairn' }, lines: ['Your stone is still on the cairn, near the top. It looks very well there.'], choices: [] },
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
      about: ['Somebody has dropped a tinker\u2019s pack in the heather in a hurry.', '*Something made him run, and by the tracks it had a great many feet.*'],
      visit: ['You find pots, pans, a kettle with no bottom, and {gold} that fell out of it.'],
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
    text: { about: ['A charcoal clamp is smoking at the edge of the King\u2019s chase, and two burners as black as their charcoal are watching it.'] },
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
    text: { about: ['This is a little shrine to St Hubert, the patron saint of hunters, with a stag\u2019s antlers nailed over it.'] },
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
      { id: 'after', when: { flag: 'hubert' }, lines: ['There are two apples on the step now. Something has had a bite out of one.'], choices: [] },
    ],
  },
];
