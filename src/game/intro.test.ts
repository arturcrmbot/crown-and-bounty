import { describe, expect, it } from 'vitest';
import { keysCard, storyCard } from './intro';

describe('the first commission briefing', () => {
  it('introduces the hero without front-loading the controls', () => {
    const card = storyCard('courtier');
    expect(card.lines).toHaveLength(3);
    expect(card.lines.join(' ')).toContain('Silver Tongue');
    expect(card.lines.join(' ')).not.toMatch(/click|shift|hourglass|payday|every key/i);
  });

  it('keeps the complete key reference on ?', () => {
    const text = keysCard().lines.join(' ');
    for (const key of ['Shift', 'Esc', 'WASD', 'Space', 'E', 'H', 'M', 'S', 'W', 'D', 'A', 'R', 'Delete']) expect(text).toContain(`**${key}**`);
  });
});
