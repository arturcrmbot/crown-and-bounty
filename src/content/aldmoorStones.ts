import type { Location } from '../rules/state';
import { SPELLS, type SpellId } from './spells';

/** How the stones of each circle are sealed: the 3rd circle's spells are the strongest, and lie furthest out. */
const CIRCLES = { 1: ['first', 'red wax'], 2: ['second', 'blue wax'], 3: ['third', 'gold'] } as const;

/**
 * A scroll stone (#240), as HoMM2's shrines of the 1st, 2nd and 3rd circle: a standing stone with a
 * scroll bound to it that teaches one spell, to any hero. One who knows the spell already reads the
 * notes in its margins instead, as at the river chest.
 */
export function scrollStone(id: string, at: Location['at'], spell: SpellId, circle: 1 | 2 | 3, guard?: string): Location {
  const [nth, seal] = CIRCLES[circle];
  const name = SPELLS[spell].name;
  return {
    id,
    kind: 'event',
    look: `stone${circle}`,
    name: `A Stone of the ${nth[0].toUpperCase()}${nth.slice(1)} Circle`,
    at,
    done: false,
    ...(guard ? { guard } : {}),
    text: {
      about: [`A standing stone of the ${nth} circle has a scroll bound to it, under a seal of ${seal}.`],
      done: ['The scroll is gone from the stone, and only its cord is left.'],
    },
    pages: [
      {
        id: 'scroll',
        when: { notSpell: spell },
        lines: [`You break the seal of ${seal}. The scroll on the stone teaches a spell, **${name}**. ${SPELLS[spell].note}`],
        choices: [{ id: 'learn', label: `Learn ${name}`, effects: { spell, done: true }, lines: ['You read the words aloud, and the scroll crumbles to dust as they go into your memory.'] }],
      },
      {
        id: 'known',
        lines: [`You break the seal of ${seal}. The scroll teaches **${name}**, which you know already, and somebody has filled its margins with notes.`],
        choices: [{ id: 'notes', label: 'Read the notes in its margins', effects: { xp: 100, done: true }, lines: ['The notes are better than the spell.'] }],
      },
    ],
  };
}

/**
 * Aldmoor's scroll stones (#240). The 1st circle's lie near the castle, free for the taking. The
 * Lightning Bolt's, of the 3rd circle, stands by the river behind its outlaws, and Curse's, of the 2nd,
 * on the heath: both come with #239's bands.
 */
export const STONES: Location[] = [
  scrollStone('stoneBless', [2850, 1010], 'bless', 1),
  scrollStone('stoneArrow', [2600, 560], 'arrow', 1),
];
