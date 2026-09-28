import type { ContentChoice, Enemy, Location, PlaceLook } from '../rules/state';
import type { TroopId } from './troops';

/** What a generated province feels like: Aldmoor's heath and woods, or the Fenmarch's meres and reeds. */
export type Land = 'heath' | 'fen';

/** An enemy stack's look and words, with its army given as shares of its strength. */
export type Band = Omit<Enemy, 'army' | 'reward'> & { name: string; troops: [TroopId, number][] };

/**
 * A villain for a generated commission: who they are, what they did, the land they hide in, and
 * the bands that stand between them and the King's officer. Armies are sized by the generator.
 */
export type VillainTemplate = {
  id: string;
  villain: string;
  land: Land;
  brief: string[];
  surrender: string;
  homecoming: string;
  timeout: string;
  praise: string;
  arrival: string[];
  bands: Band[];
  /** Guards the only way to the hideout. */
  guardian: Band;
  hideout: Band & { placeLook?: PlaceLook; bosses: TroopId[]; done: string[] };
  village: NonNullable<Location['recruits']>;
  names: { province: string[]; castle: string[]; village: string[]; tower: string[]; mine: string[]; mill: string[] };
  towerClue: string;
  parleys?: { guardian?: ContentChoice[]; hideout?: ContentChoice[] };
};

export const VILLAINS: VillainTemplate[] = [
  {
    id: 'grimsby-again',
    villain: 'Baron Grimsby',
    land: 'heath',
    brief: [
      'Baron Grimsby has escaped from the Tower, and taken the King\u2019s second-best hat with him.',
      '"It is a very good hat," says the King. "The goose is also looking nervous."',
    ],
    surrender: 'Baron Grimsby surrenders again. He is wearing the hat. It suits him, which somehow makes it worse.',
    homecoming: 'The hat is going home, a little stretched.',
    timeout: 'The King has bought a new hat. He is not pleased about it.',
    praise: '"Grimsby in irons again, and my hat back!" King Osric beams. "Put him somewhere with better locks."',
    arrival: ['Heather, woods, and the smell of a baron on the run.', 'Somebody has nailed a goose feather to every signpost.'],
    bands: [
      { name: 'Grimsby\u2019s Rearguard', look: 'soldiers', troops: [['swordsmen', 0.65], ['crossbowmen', 0.35]], lines: ['Grimsby\u2019s men, guarding his escape. They look embarrassed about it.'], threat: 'They form up across the road.', flees: 'The rearguard breaks and runs after its baron.', loot: 'You find {gold} in their pay chest.' },
      { name: 'Hunting Hounds', look: 'wolves', troops: [['wolves', 1]], lines: ['The Baron\u2019s hounds, loose and very keen.', 'One of them has his other boot.'], threat: 'They bay. It carries for miles.', flees: 'The hounds scatter into the heather.', loot: 'Under a gorse bush: {gold}, and the boot.' },
    ],
    guardian: {
      name: 'The Baron\u2019s Gatekeepers',
      look: 'soldiers',
      troops: [['swordsmen', 0.5], ['wolves', 0.3], ['crossbowmen', 0.2]],
      lines: ['Hand-picked men and hounds, holding the only road to Grimsby\u2019s hideout.'],
      threat: 'The captain lowers his visor. His hounds lower their heads.',
      flees: 'The road to the hideout is open.',
      loot: 'The captain\u2019s purse: {gold}.',
    },
    hideout: {
      name: 'Grimsby\u2019s New Hideout',
      look: 'stockade',
      bosses: ['baron'],
      troops: [['swordsmen', 0.6], ['crossbowmen', 0.4]],
      lines: ['Another muddy stockade. The Baron is nothing if not consistent.'],
      threat: 'The Baron shouts from the palisade: *"This time I have TWO walls!"* He has one wall.',
      charge: 'Storm the stockade',
      flees: 'The gate falls open.',
      loot: 'The Crown pays {gold}.',
      done: ['Nobody here but a hat stand.'],
    },
    village: { troop: 'archers', count: 16, price: 35 },
    names: {
      province: ['Brackenholt', 'Ashmoor', 'the Weald', 'Thornbury Heath', 'Highcombe'],
      castle: ['Castle Brackenholt', 'Ashmoor Keep', 'Castle Thorne', 'Wealdhall'],
      village: ['Nettlefold', 'Dimbleby', 'Upper Tuttle', 'Grimsby-on-Sea'],
      tower: ['Beacon Tower', 'Old Watchtower', 'The Signal Tower'],
      mine: ['Old Tin Mine', 'Deep Delving', 'Copper Hollow'],
      mill: ['Weald Mill', 'Hilltop Mill', 'Old Mill'],
    },
    towerClue: 'A shepherd has left a note for the King\u2019s officer: *"Baron went that way, wearing a hat. Didn\u2019t pay for the sheep."*',
    parleys: {
      hideout: [
        {
          id: 'pardon',
          label: 'Talk the Baron round again',
          needs: { background: 'courtier' },
          effects: { win: true, gold: 1500, xp: 700 },
          lines: ['Another long lunch. You point out that the Tower has a much better cook than his stockade. He hands over the hat with a sigh.'],
        },
      ],
    },
  },
  {
    id: 'bramble',
    villain: 'Aunt Bramble',
    land: 'fen',
    brief: [
      'Aunt Bramble, Mother Mirrow\u2019s big sister, has turned the royal choir into frogs.',
      '"They still sing," says the King, "but only at night, and only about flies."',
    ],
    surrender: 'Aunt Bramble snaps her ladle over her knee. "Take your choir, then!" The frogs hop home, humming.',
    homecoming: 'The choir is un-frogged by Sunday, and sings better than ever.',
    timeout: 'The royal choir has settled in the palace pond. The King has stopped going to chapel.',
    praise: '"My choir is back, and in tune!" says King Osric. "Well, nearly in tune."',
    arrival: ['Meres and reeds again, and somewhere, a great deal of croaking.', 'Your horse sighs, and steps into the mud.'],
    bands: [
      { name: 'Goblin Raiders', look: 'goblins', troops: [['goblins', 1]], lines: ['Bog goblins, raiding for anything shiny.', 'They have taken all the church bells. Nobody knows why.'], threat: 'They giggle and sharpen their spears.', flees: 'The goblins scatter into the reeds.', loot: 'In their sack: {gold}, and a bell.' },
      { name: 'Troll Ford', look: 'troll', troops: [['trolls', 0.7], ['goblins', 0.3]], lines: ['A troll sits in the ford, charging goblins to cross. Business is bad.'], threat: 'The troll gets up, slowly and completely.', flees: 'The troll wades away downstream.', loot: 'In the ford: {gold} in old tolls.' },
    ],
    guardian: {
      name: 'Aunt Bramble\u2019s Trolls',
      look: 'troll',
      troops: [['trolls', 0.75], ['goblins', 0.25]],
      lines: ['Her biggest trolls, sat across the only path to her hut.', '*"No choir practice today,"* says one.'],
      threat: 'The trolls stand up one after another, like a very slow wave.',
      flees: 'The trolls give up and go back to sleep in the mere.',
      loot: 'Under the biggest troll: {gold}, a little flattened.',
    },
    hideout: {
      name: 'Aunt Bramble\u2019s Hut',
      look: 'stockade',
      placeLook: 'stilthut',
      bosses: ['bramble'],
      troops: [['trolls', 0.45], ['goblins', 0.55]],
      lines: ['A hut on chicken legs, bigger than her sister\u2019s. The croaking is coming from inside.'],
      threat: 'Aunt Bramble leans out: *"Frogs are happier, dearie. They told me so."*',
      charge: 'Storm the hut',
      flees: 'The hut sits down with a thump and folds its legs.',
      loot: 'The Crown pays {gold}.',
      done: ['The hut is empty, apart from a great many hymn books.'],
    },
    village: { troop: 'archers', count: 16, price: 40 },
    names: {
      province: ['Mirewater', 'the Sedgelands', 'Eelmarsh', 'the Lowmeres', 'Frogmorton'],
      castle: ['Mirewater Keep', 'Castle Sedge', 'Heronsgate', 'Lowmere Hall'],
      village: ['Dampney', 'Puddleby', 'Wetherby', 'Eeling'],
      tower: ['St Botolph\u2019s Ruins', 'The Drowned Tower', 'Old Lighthouse'],
      mine: ['Peat Diggings', 'The Eel Traps', 'Salt Pans'],
      mill: ['Fen Windmill', 'Pump Mill', 'Drainage Mill'],
    },
    towerClue: 'A frog on the windowsill croaks the same three notes over and over. Brother Anselm\u2019s old map is pinned beneath it, with Aunt Bramble\u2019s hut circled.',
    parleys: {
      hideout: [
        {
          id: 'outhex',
          label: 'Out-hex her',
          needs: { background: 'wizard', spellPower: 10 },
          effects: { win: true, gold: 2500, xp: 1500 },
          lines: ['It takes all afternoon and most of your eyebrows, but your counter-hex holds. Aunt Bramble admits, grudgingly, that you are nearly as good as her sister said.'],
        },
      ],
    },
  },
  {
    id: 'eloped',
    villain: 'Grimsby and Bramble',
    land: 'heath',
    brief: [
      'Baron Grimsby and Aunt Bramble have eloped, and taken the Crown Jewels as a wedding present.',
      '"I don\u2019t mind the wedding," says the King. "I mind the jewels."',
    ],
    surrender: 'The happy couple surrender together, after a portrait. The Baron is wearing the crown. It suits him, which is the worst part.',
    homecoming: 'The Crown Jewels are going home, covered in confetti.',
    timeout: 'The couple have opened a tea shop, with the Crown Jewels in the window. The King is beside himself.',
    praise: '"The jewels back, and those two in irons!" says King Osric. "I shall need a bigger Tower."',
    arrival: ['The hills ring with wedding bells, goblin music and a great deal of honking.', 'Somebody has strung bunting between the trees.'],
    bands: [
      { name: 'Wedding Guests', look: 'soldiers', troops: [['swordsmen', 0.55], ['goblins', 0.45]], lines: ['Grimsby\u2019s men and Bramble\u2019s goblins, singing, a little drunk.'], threat: 'They stop singing and pick up their weapons.', flees: 'The wedding guests stagger off to find the next party.', loot: 'In a hat passed round for the couple: {gold}.' },
      { name: 'The Best Man', look: 'troll', troops: [['trolls', 0.7], ['wolves', 0.3]], lines: ['A troll in a borrowed waistcoat, with the Baron\u2019s hounds for groomsmen.'], threat: 'He clears his throat to make a speech. It is a threat.', flees: 'The best man wanders off, still practising his speech.', loot: 'In his waistcoat pocket: {gold} and the rings.' },
    ],
    guardian: {
      name: 'The Bridesmaids',
      look: 'goblins',
      troops: [['goblins', 0.55], ['crossbowmen', 0.25], ['trolls', 0.2]],
      lines: ['Goblin bridesmaids with crossbows, holding the only road to the honeymoon hut.', 'They are wearing a lot of lace, and all of it is sharp.'],
      threat: 'They throw confetti. Some of it is arrows.',
      flees: 'The bridesmaids scatter, catching the bouquet as they go.',
      loot: 'Among the confetti: {gold}.',
    },
    hideout: {
      name: 'The Honeymoon Hut',
      look: 'stockade',
      placeLook: 'stilthut',
      bosses: ['baron', 'bramble'],
      troops: [['swordsmen', 0.35], ['trolls', 0.3], ['goblins', 0.35]],
      lines: ['A hut on chicken legs, with a wedding bell on the roof and a stockade round its feet.'],
      threat: 'Two voices from the window: *"Go away! We\u2019re on our honeymoon!"*',
      charge: 'Storm the hut',
      flees: 'The hut kneels down with a sigh.',
      loot: 'The Crown pays {gold}.',
      done: ['Confetti, and nothing else.'],
    },
    village: { troop: 'archers', count: 16, price: 40 },
    names: {
      province: ['Honeycombe', 'the High Wold', 'Weddington', 'Bellbury Downs'],
      castle: ['Castle Wold', 'Bellbury Keep', 'Honeycombe Hall'],
      village: ['Little Wedding', 'Confetti Cross', 'Hiccup'],
      tower: ['The Bell Tower', 'Old Signal Tower'],
      mine: ['Old Silver Mine', 'Ring Hollow'],
      mill: ['Wold Mill', 'Bellbury Mill'],
    },
    towerClue: 'The bell-ringer shows you a wedding invitation. The address is circled, with a little heart.',
    parleys: {
      hideout: [
        {
          id: 'speech',
          label: 'Make a best-man speech',
          needs: { background: 'courtier' },
          effects: { win: true, gold: 3000, xp: 1500 },
          lines: ['You make a speech so moving that both of them weep, and hand over the Crown Jewels just to make you stop.'],
        },
        {
          id: 'present',
          label: 'Give them a wedding present',
          needs: { gold: 6000 },
          effects: { win: true, gold: 2000, xp: 600 },
          lines: ['Six thousand gold, in a nice box with a ribbon. Touched, the couple hand over the Crown Jewels and wave you off.'],
        },
      ],
    },
  },
];
