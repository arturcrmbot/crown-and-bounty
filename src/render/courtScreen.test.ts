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
    expect(blink.length).toBeLessThan(180);
    expect(blink.every(([x, y]) => x > 180 && x < 260 && y > 90 && y < 165)).toBe(true);
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
      expect(breath.length, background).toBeLessThan(1400);
      expect(breath.every(([x, y]) => x > 240 && x < 370 && y > 290 && y < 410), background).toBe(true);
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
      const audience = [];
      for (let y = 290; y < 450; y++) audience.push(...frame.slice((MAP_VIEW.y + y) * SCREEN.width + MAP_VIEW.x, (MAP_VIEW.y + y) * SCREEN.width + MAP_VIEW.x + 380));
      figures.add(audience.join());
    }
    expect(figures.size).toBe(4);
    court.kneel('knight');
    expect(court.draw(0).data).toEqual(knight);
  });

  it('stages the actual story visitors beside Aldric, clear of the cards', () => {
    const court = new CourtScreen();
    court.goose = false;
    const alone = court.draw(0).data.slice();
    const figures = new Set<string>();
    for (const visitor of ['pike', 'nan', 'dwarf', 'anselm'] as const) {
      court.setGuests([visitor]);
      const frame = court.draw(0).data;
      const changes = changedPixels(alone, frame);
      expect(changes.length, visitor).toBeGreaterThan(500);
      expect(changes.every(([x, y]) => x > 50 && x < 250 && y > 270 && y < 450), visitor).toBe(true);
      figures.add(changes.map(([x, y]) => frame[(y + MAP_VIEW.y) * SCREEN.width + x + MAP_VIEW.x]).join());
    }
    expect(figures.size).toBe(4);
    court.setGuests([]);
    expect(court.draw(0).data).toEqual(alone);
  });

  it('answers a new welcome once without moving the room or the hero', () => {
    const court = new CourtScreen();
    court.goose = false;
    const resting = court.draw(4).data.slice();
    const sameMoment = court.draw(2).data.slice();
    court.welcome(2);
    const greeting = changedPixels(sameMoment, court.draw(2).data);
    expect(greeting.length).toBeGreaterThan(0);
    expect(greeting.every(([x, y]) => x > 140 && x < 310 && y > 70 && y < 280)).toBe(true);
    expect(court.draw(4).data).toEqual(resting);
  });
});
