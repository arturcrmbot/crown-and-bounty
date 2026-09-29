import { describe, expect, it } from 'vitest';
import { BACKGROUNDS } from '../content/backgrounds';
import { keysCard, storyCard } from './intro';

describe('the first commission briefing', () => {
  it('introduces the hero without front-loading the controls', () => {
    for (const background of Object.values(BACKGROUNDS)) {
      const text = storyCard(background.id).lines.join(' ');
      for (const control of ['Click the map', 'Shift', 'hourglass', 'lists every key', '**E**', '**H**']) expect(text).not.toContain(control);
    }
  });

  it('keeps the complete key reference on ?', () => {
    const text = keysCard().lines.join(' ');
    for (const key of ['Shift', 'Esc', 'WASD', 'Space', 'E', 'H', 'M', 'S', 'W', 'D', 'A', 'R', 'Delete']) expect(text).toContain(`**${key}**`);
  });

  it('says what he rides out with as lists in words (#115)', () => {
    expect(storyCard('wizard').lines.join(' ')).toContain('Archers, and Lightning Bolt, Bless, Slow and Haste in your spellbook.');
  });
});
