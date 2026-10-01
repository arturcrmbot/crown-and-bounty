import type { Point } from '../rules/map/geometry';
import type { Effects, Location, PlaceLook } from '../rules/state';

/**
 * Small things lying by Aldmoor's roads and tracks (#192), which Aldric takes as he rides by, with no
 * card and no stop: purses, sheaves of oats, blue crystals by the crags and in Darkwood, and lost
 * letters, whose words go in the journal (each commission's `heard`, in `content/campaign.ts`). They
 * lie about a quarter of a day apart along the roads, and on the tracks across open land.
 */
type Lying = { id: string; at: Point; about: string; gives: Effects; reads?: string };

/** One of a kind of thing lying by the way. A letter `reads` what he stops to read when he picks it up. */
const lying =
  (look: PlaceLook, name: string) =>
  ({ id, at, about, gives, reads }: Lying): Location => ({ id, kind: 'pickup', look, name, at, done: false, gives, text: { about: [about], ...(reads ? { visit: [reads] } : {}) } });

const PURSES: Lying[] = [
  { id: 'purseKingsRoad', at: [3062, 1008], about: 'Somebody has dropped a purse by the King\u2019s road.', gives: { treasure: 25 } },
  { id: 'purseSignpost', at: [2379, 1012], about: 'A purse lies in the ditch, with a few coins spilling out of it.', gives: { treasure: 20 } },
  { id: 'purseDownsLane', at: [2826, 777], about: 'A shepherd has dropped his purse on the lane up into the downs.', gives: { treasure: 30 } },
  { id: 'purseFields', at: [2092, 764], about: 'A purse lies at the edge of a field, where somebody sat down to eat his dinner.', gives: { treasure: 15 } },
  { id: 'purseCrossroads', at: [1508, 1469], about: 'Somebody has lost a purse by the crossroads. It might have been anybody.', gives: { treasure: 35 } },
  { id: 'purseHeath', at: [1263, 981], about: 'A purse lies in the heather. Its owner must be kicking himself.', gives: { treasure: 20 } },
  { id: 'purseToll', at: [622, 692], about: 'A purse lies in the road below the Baron\u2019s toll-board. Somebody paid the toll the quick way.', gives: { treasure: 25 } },
  { id: 'purseFord', at: [2080, 452], about: 'A purse lies in the grass by the road to the ford.', gives: { treasure: 15 } },
  { id: 'purseChase', at: [2516, 1796], about: 'A huntsman\u2019s purse lies on the track, its strings chewed through by something.', gives: { treasure: 30 } },
  { id: 'purseHayrick', at: [2468, 1356], about: 'A purse lies on the track across the fields, half trodden into the mud.', gives: { treasure: 20 } },
  { id: 'purseKennels', at: [1153, 1474], about: 'Somebody dropped a purse by the road to the kennels and didn\u2019t stop to pick it up.', gives: { treasure: 15 } },
];

const OATS: Lying[] = [
  { id: 'oatsKingsRoad', at: [2666, 940], about: 'A sheaf of oats has fallen off a cart. Your horses would make short work of it.', gives: { movement: 20 } },
  { id: 'oatsWestmere', at: [2141, 1325], about: 'A sheaf of oats has fallen off a cart on its way to Westmere.', gives: { movement: 20 } },
  { id: 'oatsNan', at: [2116, 1575], about: 'Somebody has left a sheaf of oats by the road, and the horses have noticed.', gives: { movement: 20 } },
  { id: 'oatsMill', at: [1984, 1244], about: 'A sheaf of oats lies by the mill road, waiting to be ground.', gives: { movement: 20 } },
  { id: 'oatsWell', at: [1452, 1306], about: 'A sheaf of oats has been left by the road for any horse that passes.', gives: { movement: 20 } },
  { id: 'oatsHeath', at: [1516, 964], about: 'A sheaf of oats lies out on the heath, a long way from any field.', gives: { movement: 20 } },
  { id: 'oatsDowns', at: [2377, 732], about: 'A sheaf of oats has fallen off a cart on the long road to the ford.', gives: { movement: 20 } },
  { id: 'oatsFold', at: [2420, 540], about: 'A sheaf of oats lies on the downs. The sheep have been at it, but there\u2019s plenty left.', gives: { movement: 20 } },
  { id: 'oatsChase', at: [1692, 1764], about: 'A sheaf of oats lies on the track, left out for the old King\u2019s deer.', gives: { movement: 20 } },
  { id: 'oatsFalconer', at: [396, 1027], about: 'A sheaf of oats has fallen off the Baron\u2019s cart on its way north.', gives: { movement: 20 } },
  { id: 'oatsTinker', at: [668, 1300], about: 'Somebody has left a sheaf of oats on the track over the heath.', gives: { movement: 20 } },
];

const CRYSTALS: Lying[] = [
  { id: 'crystalsFord', at: [1686, 340], about: 'Blue crystals grow out of the rock by the ford. They hum when you put your ear to them.', gives: { mana: 5 } },
  { id: 'crystalsMine', at: [1340, 365], about: 'Blue crystals glitter on the spoil heap below the old mine.', gives: { mana: 5 } },
  { id: 'crystalsCrags', at: [949, 482], about: 'A cluster of blue crystals grows in a crack at the foot of the crags.', gives: { mana: 5 } },
  { id: 'crystalsNest', at: [1516, 412], about: 'Blue crystals stick out of the rock below the crags, as cold as ice.', gives: { mana: 5 } },
  { id: 'crystalsDelving', at: [627, 1878], about: 'Blue crystals glow faintly among the roots by the Darkwood road.', gives: { mana: 5 } },
  { id: 'crystalsDarkwood', at: [756, 1348], about: 'A cluster of blue crystals grows on an old stump, where nothing else will grow.', gives: { mana: 5 } },
];

const LETTERS: Lying[] = [
  {
    id: 'letterPike',
    at: [1929, 1419],
    about: 'A letter lies in the road, trodden into the mud. It is addressed to Westmere.',
    gives: { xp: 25 },
    reads: 'It is from a lad in the Baron\u2019s patrol to his mother, and it never reached her. *"Dear Mum, I am a sergeant now, with my own crossbow. We hold the old bridge for the Baron, and nobody gets over it. Don\u2019t worry about me."*',
  },
  {
    id: 'letterBaron',
    at: [945, 745],
    about: 'A letter with a broken seal lies in the heather by the road.',
    gives: { xp: 25 },
    reads: 'It is in the Baron\u2019s own hand, and he never sent it. *"To His Majesty the King. The taxes are on their way, and so is the goose. The goose is being difficult. Your loyal servant, G."*',
  },
  {
    id: 'letterTam',
    at: [2596, 644],
    about: 'Somebody has left a note on the downs, under a stone so it won\u2019t blow away.',
    gives: { xp: 25 },
    reads: 'It is a note for Old Tam. *"Tam, I counted them twice. Half your ewes are gone, and the tracks go off east over the downs. Don\u2019t do anything daft. Jack."*',
  },
  {
    id: 'letterRook',
    at: [887, 1573],
    about: 'A notice lies by the road at the edge of Darkwood, where the wind has torn it off a tree.',
    gives: { xp: 25 },
    reads: 'You pick up the notice and read it. *"By order of Baron Grimsby, Rook keeps the old King\u2019s chase now. Anybody found in it will be fed to his wolves."*',
  },
  {
    id: 'letterGameBook',
    at: [2382, 1971],
    about: 'A page torn from a book lies on the track, curled up by the rain.',
    gives: { xp: 25 },
    reads: 'It is a page from the old King\u2019s game book, in his own hand. *"A stag of nine points, taken by the river. A boar, taken by the lodge. The goose, not taken. The goose won."*',
  },
  {
    id: 'letterList',
    at: [307, 1419],
    about: 'A scrap of paper has blown off a cart and caught in a bush.',
    gives: { xp: 25 },
    reads: 'It is a list in the Baron\u2019s hand. *"Goose fat. A bigger hat. Forty more swordsmen. Find out what the King\u2019s man is afraid of."*',
  },
];

export const PICKUPS: Location[] = [
  ...PURSES.map(lying('purse', 'A Purse')),
  ...OATS.map(lying('oats', 'A Sheaf of Oats')),
  ...CRYSTALS.map(lying('crystals', 'Blue Crystals')),
  ...LETTERS.map(lying('letter', 'A Lost Letter')),
];
