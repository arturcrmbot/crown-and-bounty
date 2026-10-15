import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CourtScreen } from '../src/render/courtScreen';
import { MAP_VIEW, SCREEN } from '../src/render/frame';
import { backdrop, courtPiece, loadSceneArt } from '../src/render/mapArt';
import { SHADOW } from '../src/render/bitmap';
import { COURT_PIECES } from '../src/render/mapPieces';

// Lettering is checked in the browser; these frames have no caption.
vi.mock('../src/render/text', () => ({ drawText: vi.fn() }));

function changedPixels(before: Uint8Array, after: Uint8Array) {
  const changed: [number, number][] = [];
  for (let i = 0; i < before.length; i++) {
    if (before[i] !== after[i]) changed.push([i % SCREEN.width - MAP_VIEW.x, Math.floor(i / SCREEN.width) - MAP_VIEW.y]);
  }
  return changed;
}

describe('the people at court', () => {
  beforeAll(() => loadSceneArt(async (file) => new Uint8Array(readFileSync(`public/assets/${file.includes('/') ? file : `map/${file}`}`))));

  it('paints everyone at court from the court sheet, none of them in code (#311)', () => {
    for (const name of COURT_PIECES) expect(courtPiece(name), name).not.toBeNull();
  });

  it('lays the painted hall and the title land at the view size, in the palette alone', () => {
    for (const name of ['court', 'title'] as const) {
      const picture = backdrop(name);
      expect(picture, name).not.toBeNull();
      expect([picture!.width, picture!.height], name).toEqual([MAP_VIEW.width, MAP_VIEW.height]);
      // Opaque all over: nothing in it is clear or shadow.
      expect(picture!.data.every((c) => c > 0 && c !== SHADOW), name).toBe(true);
    }
    const hall = new CourtScreen().draw(0).data;
    expect(hall[(MAP_VIEW.y + 40) * SCREEN.width + MAP_VIEW.x + 600]).toBe(backdrop('court')!.data[40 * MAP_VIEW.width + 600]);
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
