import type { BoonId } from '../rules/state';
import { ALDMOOR } from './aldmoor';
import { FENMARCH } from './fenmarch';
import type { Province } from './types';

/** One of the King's commissions: a province, a villain, and what everyone says about it. */
export type Commission = {
  province: Province;
  villain: string;
  /** Read out when the commission is given. */
  brief: string[];
  /** The first lines of the bounty card, when the villain's hideout falls. */
  surrender: string;
  homecoming: string;
  /** Day 100 comes and goes with the villain still at large. */
  timeout: string;
  /** What the King says at court afterwards. */
  praise: string;
  /** The card on riding into the province, for every commission after the first. */
  arrival: string[];
  /** Gold the King adds at court, on top of the bounty. */
  reward: number;
};

export const COMMISSIONS: Commission[] = [
  {
    province: ALDMOOR,
    villain: 'Baron Grimsby',
    brief: ['Baron Grimsby owes the Crown three years of taxes and one goose. Bring him in.'],
    surrender: 'Baron Grimsby surrenders, still clutching the goose.',
    homecoming: 'The royal goose is going home.',
    timeout: 'The King\u2019s patience has run out. So has the goose\u2019s.',
    praise: '"Grimsby in irons, and my goose home!" King Osric beams. "Splendid. Simply splendid."',
    arrival: ['The heather of Aldmoor, and somewhere in Darkwood, a goose.'],
    reward: 1500,
  },
  {
    province: FENMARCH,
    villain: 'Mother Mirrow',
    brief: [
      'Mother Mirrow, a bog witch of the Fenmarch, has turned the King\u2019s tax collector into a newt.',
      '"He was a very good tax collector," says the King. "Bring him back. Un-newted, ideally."',
    ],
    surrender: 'Mother Mirrow throws down her ladle. "Fine! Take your newt." The newt looks relieved.',
    homecoming: 'The tax collector is un-newted by teatime, and only slightly damp.',
    timeout: 'Word comes from court: the tax collector has settled into newt life. The King is not pleased.',
    praise: '"The fen is quiet, and my tax collector is dry," says King Osric. "Well done, well done."',
    arrival: ['Reeds to the horizon, and the smell of eels.', 'Your boots find something that squelches, and your men give you a look.'],
    reward: 2500,
  },
];

/** What the King can give at court, besides gold. */
export const BOONS: Record<BoonId, { name: string; note: string }> = {
  fencing: { name: 'The fencing master', note: 'Lessons with the fencing master: **+1 attack**.' },
  armourer: { name: 'The royal armourer', note: 'Your armour refitted by the King\u2019s smith: **+1 defence**.' },
  library: { name: 'The royal library', note: 'Evenings among the grimoires: **+1 spell power**.' },
  astronomer: { name: 'The court astronomer', note: 'Late nights with the stars: **+1 knowledge**.' },
  warrant: { name: 'A royal warrant', note: 'Troops follow the King\u2019s seal: **+40 leadership**.' },
  purse: { name: 'A heavy purse', note: '**+1,500 gold**, and the treasurer\u2019s disapproval.' },
};

export const BOON_IDS = Object.keys(BOONS) as BoonId[];
