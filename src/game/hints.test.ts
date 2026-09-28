import { describe, expect, it } from 'vitest';
import { BACKGROUNDS } from '../content/backgrounds';
import { FirstTimeHints } from './hints';
import { storyCard } from './intro';

const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

describe('first-time hints', () => {
  it('shows each hint once, including after the controller is rebuilt', () => {
    const storage = memory();
    const first = new FirstTimeHints(storage);
    expect(first.take('ride')).toBe(true);
    expect(first.take('ride')).toBe(false);
    expect(new FirstTimeHints(storage).take('ride')).toBe(false);
    expect(new FirstTimeHints(storage).take('place')).toBe(true);
  });

  it('keeps the prologue card about Aldric, not controls', () => {
    const card = storyCard('knight');
    expect(card.lines).toHaveLength(3);
    expect(card.lines.join(' ')).toContain(BACKGROUNDS.knight.signature.name);
    expect(card.lines.join(' ')).not.toMatch(/click|Shift|hourglass|payday|\*\*H\*\*|\*\*M\*\*|\*\*\?\*\*/i);
  });
});
