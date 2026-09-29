import type { FlagValue, KingsBoonId } from '../rules/state';
import { ALDMOOR } from './aldmoor';
import { FENMARCH } from './fenmarch';
import type { FriendId } from './friends';
import type { PortraitId } from './portraits';
import type { Province } from './types';

/**
 * Story flags as they must stand for something to count as having happened: `true` is any value at
 * all, anything else must match exactly (`false` is a flag spent, like the goose's hymn once whistled).
 */
export type Happened = Record<string, FlagValue>;

/** Something the King has heard you did on a commission, in his own words at court. */
export type Memory = { when?: Happened; line: string };

/** One of the King's commissions: a province, a villain, and what everyone says about it. */
export type Commission = {
  province: Province;
  villain: string;
  /** His face, on the WANTED poster and the card that says he's taken. */
  face?: PortraitId;
  /** What the poster wants him for: "for three years of unpaid taxes...". */
  wanted?: string;
  /** Read out when the commission is given. */
  brief: string[];
  /** What he says as his army is beaten and he's taken: the fight stops on it. */
  lastWords?: string;
  /** What the villain does once he's taken, on the bounty card after the words the field said it in. */
  surrender: string;
  homecoming: string;
  /** A picture of what comes home, beside the homecoming line on the stamped poster (the goose). */
  returned?: PortraitId;
  /** Day 100 comes and goes with the villain still at large. */
  timeout: string;
  /** What the King says at court afterwards. */
  praise: string;
  /** The card on riding into the province, for every commission after the first. */
  arrival: string[];
  /** Gold the King adds at court, on top of the bounty. */
  reward: number;
  /**
   * What the King remembers at court, the most telling first: he says up to three whose flags stand.
   * One with no `when` is said only when none of the others can be.
   */
  memories?: Memory[];
  /** People met here who would ride on with Aldric: offered at court as boons, when their flags stand. */
  friends?: { id: FriendId; when: Happened }[];
};

export const COMMISSIONS: Commission[] = [
  {
    province: ALDMOOR,
    villain: 'Baron Grimsby',
    face: 'grimsby',
    wanted: 'for three years of unpaid taxes, one goose (royal), and general baronial behaviour.',
    brief: ['Baron Grimsby owes the Crown three years of taxes and one goose. Bring him in.'],
    lastWords: 'Unhand me, sir! This doublet is Flemish!',
    surrender: 'He comes quietly, still clutching the goose.',
    homecoming: 'The royal goose is going home.',
    returned: 'goose',
    timeout: 'The King\u2019s patience has run out. So has the goose\u2019s.',
    praise: '"Grimsby in irons, and my goose home!" King Osric beams. "Splendid. Simply splendid."',
    arrival: ['The heather of Aldmoor, and somewhere in Darkwood, a goose.'],
    reward: 1500,
    memories: [
      { when: { lullaby: false }, line: '"Grimsby came quietly to a lullaby, I hear, and half his bounty went to his old nanny. Well. She did bring him up."' },
      { when: { pike: false }, line: '"Sergeant Pike is home with his mother, I hear. She has written to thank me: four pages, mostly about you."' },
      { when: { goose: false }, line: '"And the goose tells me somebody whistled St Aldhelm\u2019s hymn under the Baron\u2019s walls. She has honked it at me all through breakfast."' },
      { when: { wolfpelt: false }, line: '"Old Nan sends her thanks for the wolf pelt. She says she hasn\u2019t been so warm since my father\u2019s day."' },
      { when: { dig: 'raided' }, line: '"Grimsby had his men digging holes in my heath, I hear. Forty of them." The King is quiet for a moment. "Well. He won\u2019t find it there."' },
      { when: { dwarf: 'friend' }, line: '"A dwarf came to the gate this morning with a message for my officer: *\u2018The kettle\u2019s on.\u2019* Nobody here knows what it means."' },
      { when: { dwarf: 'robbed' }, line: '"A dwarf has written to complain about an ore cart. In runes. On a rock. Through my window."' },
      { when: { poachers: 'spared' }, line: '"The poachers of Aldmoor have sworn off my deer, I\u2019m told. They\u2019ve taken up rabbits instead. It\u2019s a start."' },
      { when: { orders: false }, line: '"Grimsby\u2019s own orders, turned on his own patrol! I shall have them framed."' },
      { when: { venison: false }, line: '"My huntsman says a haunch of my venison went to the wolves. We shan\u2019t speak of it again."' },
      { when: { tower: 'banner' }, line: '"And you found old Pike\u2019s banner in the watchtower! He carried it for my father. Look after it."' },
      { when: { mrsPike: true }, line: '"Mrs Pike has sent me a pie, with her thanks. It is the size of a cartwheel."' },
      { when: { lullaby: true }, line: '"Old Nan says she sang you the Baron\u2019s lullaby. I do hope you didn\u2019t sing it to him. He\u2019d cry for a week."' },
      { when: { goose: true }, line: '"The goose says somebody prayed for her at St Aldhelm\u2019s shrine. She was very touched, and bit only one footman."' },
      { when: { aldhelm: 'crown' }, line: '"St Aldhelm has lent you his crown, I hear. He has never lent it to me."' },
      { when: { aldhelm: 'hat' }, line: '"A pilgrim\u2019s hat! Very fetching. The Archbishop will be furious."' },
      { when: { miller: 'loaf' }, line: '"The miller\u2019s loaf, still warm after forty years? Keep it away from my cook."' },
      { when: { miller: 'wind' }, line: '"The miller whistled you his mother\u2019s wind charm, I hear. She whistled it to mine."' },
      { line: '"You went straight at him, and no nonsense. I like that in an officer."' },
    ],
    friends: [
      { id: 'pike', when: { pike: false } },
      { id: 'nan', when: { wolfpelt: false } },
      { id: 'dwarf', when: { dwarf: 'friend' } },
    ],
  },
  {
    province: FENMARCH,
    villain: 'Mother Mirrow',
    face: 'mirrow',
    wanted: 'for turning the King\u2019s tax collector into a newt, and not turning him back.',
    lastWords: 'Mind my cauldron, dearie! It\u2019s older than your King!',
    brief: [
      'Mother Mirrow, a bog witch of the Fenmarch, has turned the King\u2019s tax collector into a newt.',
      '"He was a very good tax collector," says the King. "Bring him back. Un-newted, ideally."',
    ],
    surrender: 'She throws down her ladle. "Fine! Take your newt." The newt looks relieved.',
    homecoming: 'The tax collector is un-newted by teatime, and only slightly damp.',
    timeout: 'Word comes from court: the tax collector has settled into newt life. The King is not pleased.',
    praise: '"The fen is quiet, and my tax collector is dry," says King Osric. "Well done, well done."',
    arrival: ['Reeds to the horizon, and the smell of eels.', 'Your boots find something that squelches, and your men give you a look.'],
    reward: 2500,
    memories: [
      { when: { anselm: false }, line: '"Brother Anselm writes that his sister sent half her goblins home to their mothers. He wants to know what you said to her. So do I."' },
      { when: { anselm: true }, line: '"Brother Anselm asks whether his letter ever reached his sister. I said I would ask you."' },
      { when: { peat: 'punt' }, line: '"The troll is livid, I\u2019m told. Somebody went past him in a punt."' },
      { when: { abbey: 'bolt' }, line: '"You prayed down a thunderbolt at St Wendel\u2019s, I hear. In moderation, I trust."' },
      { when: { abbey: 'staff' }, line: '"The old abbot\u2019s staff! Mind the eels don\u2019t get you too."' },
      { when: { windmill: 'sons' }, line: '"The windmiller writes that his boys eat more on campaign than at home. He has sent me the bill."' },
      { when: { windmill: 'charm' }, line: '"A goblin\u2019s lucky charm? Everybody count the spoons after dinner."' },
      { when: { peat: 'wages' }, line: '"The peat cutters have their wages back, and have sent me a peat with their thanks. I have no idea what to do with it."' },
      { when: { peat: 'boots' }, line: '"Eelskin boots! They squeak on my floor, you know."' },
      { line: '"Straight through the fen, and no fuss. I like that in an officer."' },
    ],
    friends: [{ id: 'anselm', when: { anselm: false } }],
  },
];

/** What the King himself can give at court, besides gold. */
export const BOONS: Record<KingsBoonId, { name: string; note: string }> = {
  fencing: { name: 'The fencing master', note: 'Lessons with the fencing master: **+1 attack**.' },
  armourer: { name: 'The royal armourer', note: 'Your armour refitted by the King\u2019s smith: **+1 defence**.' },
  library: { name: 'The royal library', note: 'Evenings among the grimoires: **+1 spell power**.' },
  astronomer: { name: 'The court astronomer', note: 'Late nights with the stars: **+1 knowledge**.' },
  warrant: { name: 'A royal warrant', note: 'Troops follow the King\u2019s seal: **+40 leadership**.' },
  purse: { name: 'A heavy purse', note: '**+1,500 gold**, and the treasurer\u2019s disapproval.' },
};

export const BOON_IDS = Object.keys(BOONS) as KingsBoonId[];
