import type { Army } from '../rules/state';
import type { Bonus } from './backgrounds';
import type { PortraitId } from './portraits';

/**
 * People Aldric helped on a commission, who would ride on with him into the next. The King offers
 * them at court as boons (see `friends` in content/campaign.ts), and once taken they stay with him
 * for the rest of the campaign: their bonus counts wherever his skills and gear do.
 */
export type FriendId = 'pike' | 'nan' | 'dwarf' | 'anselm';

export type Friend = {
  id: FriendId;
  name: string;
  portrait: PortraitId;
  /** The boon as the King offers it, under its button. */
  offer: string;
  /** What they do on the road, in a line, for the hero screen. */
  note: string;
  bonus: Bonus;
  /** Troops who come along into the next commission, as many as his leadership allows. */
  brings?: Army;
  /** What they say as the next commission begins. */
  arrival: string;
};

export const FRIENDS: Record<FriendId, Friend> = {
  pike: {
    id: 'pike',
    name: 'Sergeant Pike',
    portrait: 'sergeant',
    offer: 'His mother says he\u2019s under her feet. He brings his old patrol, **20 swordsmen** if you can lead them, and drills yours: **+1 attack and defence**.',
    note: 'Drills your swordsmen every morning: +1 attack and +1 defence. They complain every morning too.',
    bonus: { troops: { swordsmen: { attack: 1, defence: 1 } } },
    brings: [{ troop: 'swordsmen', count: 20 }],
    arrival: 'Sergeant Pike falls in behind you with his lads. *"Mum packed sandwiches, sir. For everyone."*',
  },
  nan: {
    id: 'nan',
    name: 'Old Nan',
    portrait: 'nan',
    offer: 'She\u2019ll ride in your baggage cart, wrapped in your wolf pelt. After every battle you win, her charms put **a tenth of your fallen** back on their feet.',
    note: 'After every battle you win, her charms put a tenth of your fallen back on their feet. The soup helps.',
    bonus: { mend: 0.1 },
    arrival: 'Old Nan\u2019s cauldron rattles along in the baggage cart. *"Don\u2019t mind me, dearie. I\u2019ll sit here and knit."*',
  },
  dwarf: {
    id: 'dwarf',
    name: 'The Old Mine\u2019s dwarf',
    portrait: 'dwarf',
    offer: 'He can smell gold: every dawn the mist lifts over **treasure within 300 paces**, and he digs out **a quarter more** of it.',
    note: 'He smells gold: every dawn the mist lifts over any treasure within 300 paces, and chests, piles and mines give a quarter more.',
    bonus: { smells: 300, loot: 0.25 },
    arrival: 'The dwarf trudges along at the back with his pick on his shoulder, humming. *"Gold round here somewhere. I can smell it."*',
  },
  anselm: {
    id: 'anselm',
    name: 'Brother Anselm',
    portrait: 'anselm',
    offer: 'He\u2019d like to see the world before the damp gets him, and he\u2019ll pray over your men before every battle: **+10% morale**.',
    note: 'He prays over your men before every battle: a 10% chance a stack\u2019s spirits win it another turn before the round moves on.',
    bonus: { morale: 0.1 },
    arrival: 'Brother Anselm rides behind you on a very small mule. *"Is it always this dry, out in the world?"*',
  },
};
