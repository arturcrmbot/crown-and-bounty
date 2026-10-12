import { describe, expect, it, vi } from 'vitest';
import { CourtScreen } from './courtScreen';
import { MAP_VIEW, SCREEN } from './frame';

// Lettering is checked in the browser; these frames have no caption.
vi.mock('./text', () => ({ drawText: vi.fn() }));

function changedPixels(before: Uint8Array, after: Uint8Array) {
  const changed: [number, number][] = [];
  for (let i = 0; i < before.length; i++) {
    if (before[i] !== after[i]) changed.push([i % SCREEN.width - MAP_VIEW.x, Math.floor(i / SCREEN.width) - MAP_VIEW.y]);
  }
  return changed;
}

describe('the people at court', () => {
  it('lets the King blink without moving the room or anyone else', () => {
    const court = new CourtScreen();
    court.goose = false;
    const open = court.draw(0).data.slice();
    const blink = changedPixels(open, court.draw(6.25).data);
    expect(blink.length).toBeGreaterThan(0);
    expect(blink.length).toBeLessThan(64);
    expect(blink.every(([x, y]) => Math.abs(x - MAP_VIEW.width / 2) < 16 && y > 105 && y < 134)).toBe(true);
    expect(court.draw(0).data).toEqual(open);
  });

  it('keeps feet and laid-down weapons still while Aldric breathes', () => {
    const court = new CourtScreen();
    court.goose = false;
    for (const background of ['knight', 'wizard', 'ranger', 'courtier'] as const) {
      court.kneel(background);
      const still = court.draw(0).data.slice();
      const breath = changedPixels(still, court.draw(1.4).data);
      expect(breath.length, background).toBeGreaterThan(0);
      expect(breath.length, background).toBeLessThan(500);
      expect(breath.every(([x, y]) => Math.abs(x - MAP_VIEW.width / 2) < 42 && y > 350 && y < 415), background).toBe(true);
      expect(court.draw(0).data).toEqual(still);
    }
  });

  it('keeps all four backgrounds distinct when Aldric changes who he was', () => {
    const court = new CourtScreen();
    court.goose = false;
    const knight = court.draw(0).data.slice();
    const figures = new Set<string>();
    for (const background of ['knight', 'wizard', 'ranger', 'courtier'] as const) {
      court.kneel(background);
      const frame = court.draw(0).data;
      figures.add(frame.slice((MAP_VIEW.y + 350) * SCREEN.width, (MAP_VIEW.y + 438) * SCREEN.width).join());
    }
    expect(figures.size).toBe(4);
    court.kneel('knight');
    expect(court.draw(0).data).toEqual(knight);
  });
});
