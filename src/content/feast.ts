import type { TroopId } from './troops';

/**
 * What the camp does at the payday feast (#191): one line under the fire each payday, written to docs/VOICE.md.
 * `{villain}` is the commission's villain. A line with `chapter` is only said in that commission, one with `open`
 * only while his bounty is still open, and one with `troops` only when every one of them is in the army. The first
 * that holds is said on the first payday, the next on the second, and so on round.
 */
export type FeastLine = { words: string; chapter?: number; open?: true; troops?: TroopId[] };

export const FEAST_LINES: readonly FeastLine[] = [
  { words: 'Your men drink to the King, and to the goose you will bring home to him.', chapter: 0, open: true },
  { words: 'Your men drink to the King, and to his tax collector, wherever he is swimming tonight.', chapter: 1, open: true },
  { words: 'Your men drink to the King, and to the day you bring {villain} in.', open: true },
  { words: 'The peasants dance until the fire burns low, and the knights pretend not to watch.', troops: ['peasants', 'knights'] },
  { words: 'Your men drink to the King\u2019s health, and then to his gold.' },
  { words: 'The cook swears the pig was wild, and nobody asks where he found it.' },
];
