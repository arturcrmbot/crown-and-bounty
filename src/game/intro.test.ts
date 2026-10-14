import { describe, expect, it, vi } from 'vitest';
import { BACKGROUNDS } from '../content/backgrounds';
import { newGame } from '../rules/game';
import { keysCard, storyCard, titleCard } from './intro';
import { touch } from '../ui/touch';

vi.mock('../ui/touch', () => ({ touch: vi.fn(() => false) }));

describe('the title', () => {
  it('carries on from where the save left off: on the road, or at court once a commission is won (#146)', () => {
    expect(titleCard(newGame()).choices[0]).toMatchObject({ label: 'Continue', detail: 'You are on day I of Commission I.' });
    expect(titleCard({ ...newGame(), over: 'won' }).choices[0]).toMatchObject({ label: 'Continue', detail: 'Commission I is complete, and the King is waiting for you at court.' });
    expect(titleCard(null).choices.map((c) => c.label)).toEqual(['New campaign']);
  });
});

describe('the first commission briefing', () => {
  it('introduces the hero without front-loading the controls', () => {
    for (const background of Object.values(BACKGROUNDS)) {
      const text = storyCard(background.id).lines.join(' ');
      for (const control of ['Click the map', 'Shift', 'hourglass', 'lists every key', '**E**', '**H**']) expect(text).not.toContain(control);
    }
  });

  it('keeps the complete key reference on ?', () => {
    const text = keysCard().lines.join(' ');
    for (const key of ['Shift', 'Esc', 'WASD', 'Space', 'Tab', 'E', 'H', 'J', 'M', 'S', 'W', 'D', 'A', 'R', 'Delete']) expect(text).toContain(`**${key}**`);
  });

  it('describes inspection and explicit equipment actions rather than double-click equipping', () => {
    const line = keysCard().lines.at(-1)!;
    expect(line).toContain('Click an artifact to inspect it');
    expect(line).toContain('**Wear it** or **Take it off**');
    expect(line).toContain('closes the screen when nothing is open');
    expect(line).not.toContain('double-click');
  });

  it('uses tap wording in the character-screen help on a phone', () => {
    vi.mocked(touch).mockReturnValueOnce(true);
    const line = keysCard().lines.at(-1)!;
    expect(line).toContain('Tap an artifact');
    expect(line).toContain('a tap places it');
    expect(line).not.toMatch(/click/i);
  });

  it('says what he rides out with as lists in words (#115)', () => {
    expect(storyCard('wizard').lines.join(' ')).toContain('You ride out with 8 Knights and 22 Archers, and Magic Arrow and Bless in your spellbook.');
  });
});
