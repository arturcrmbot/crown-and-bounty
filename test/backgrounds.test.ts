import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ALDMOOR } from '../src/content/aldmoor';
import { mapOf } from '../src/rules/map/maps';
import { newGame } from '../src/rules/scenario';
import { AdventureScreen } from '../src/render/adventureScreen';
import { Bitmap, SHADOW } from '../src/render/bitmap';
import { FogMask } from '../src/render/fog';
import { MAP_VIEW } from '../src/render/frame';
import * as art from '../src/render/mapArt';
import { MapTiles } from '../src/render/mapTiles';
import * as palette from '../src/render/palette';
import { TerrainPainter } from '../src/render/terrain';

vi.mock('../src/render/text', () => ({
  drawText: () => {},
  drawOutlined: () => {},
  textMask: (text: string, size: number) => ({ width: text.length * 7, height: size + 6, solid: () => false }),
  lettered: (size: number) => size,
  bigLettering: () => false,
}));

const luma = (index: number) => {
  const [r, g, b] = palette.COLORS[index];
  return 0.3 * r + 0.59 * g + 0.11 * b;
};

describe('the ground behind the figures', () => {
  beforeAll(() => art.loadMapArt(async (file) => new Uint8Array(readFileSync(`public/assets/${file.includes('/') ? file : `map/${file}`}`))));

  it('lights rolling land more gently than reachable hexes', () => {
    expect(palette).toHaveProperty('GROUND_LIGHT_LUT');
    for (const colour of [...palette.LEAF.slice(3, 6), ...palette.GRASS.slice(3, 6)]) {
      const lift = luma(palette.GROUND_LIGHT_LUT[colour]) - luma(colour);
      expect(lift).toBeGreaterThan(0);
      expect(lift).toBeLessThan((luma(palette.LIGHT_LUT[colour]) - luma(colour)) * 0.7);
    }
    for (const colour of palette.CYCLING) expect(palette.GROUND_LIGHT_LUT[colour]).toBe(colour);
  });

  it('subdues decoration without moving it or changing the original painting', () => {
    expect(art).toHaveProperty('subduedPiece');
    for (const name of ['bedYellow', 'decor8', 'decor15'] as const) {
      const original = art.piece(name)!;
      const before = original.sprite.data.slice();
      const subdued = art.subduedPiece(name)!;
      expect([subdued.sprite.width, subdued.sprite.height, subdued.foot]).toEqual([original.sprite.width, original.sprite.height, original.foot]);
      const painted = (data: Uint8Array) => [...data].filter((colour) => colour !== 0 && colour !== SHADOW);
      const brightness = (data: Uint8Array) => painted(data).reduce((sum, colour) => sum + luma(colour), 0) / painted(data).length;
      expect(brightness(subdued.sprite.data)).toBeLessThan(brightness(before) * 0.9);
      for (let i = 0; i < before.length; i++) {
        if (before[i] === 0 || before[i] === SHADOW) expect(subdued.sprite.data[i]).toBe(before[i]);
        else expect(subdued.sprite.data[i]).not.toBe(0);
      }
      expect(original.sprite.data).toEqual(before);
      expect(art.subduedPiece(name)!.sprite).toBe(subdued.sprite);
    }
  });

  it('does not lay screen-wide grain over a figure on the map', () => {
    const state = newGame();
    const tiles = new MapTiles(new TerrainPainter(mapOf(state)), []);
    const view = new AdventureScreen(tiles, new FogMask(ALDMOOR.width, ALDMOOR.height, state.explored));
    const [x, y] = state.hero.at;
    view.centreOn(x, y);
    const sprite = new Bitmap(80, 80);
    sprite.data.fill(palette.RED[4]);
    view.animate({ sprite, x: x - 40, y: y - 80 });
    const screen = view.compose(0);
    const colours = new Set<number>();
    const sx = MAP_VIEW.x + x - Math.round(view.camera.x) - 40;
    const sy = MAP_VIEW.y + y - Math.round(view.camera.y) - 80;
    for (let dy = 0; dy < sprite.height; dy++) for (let dx = 0; dx < sprite.width; dx++) colours.add(screen.get(sx + dx, sy + dy));
    expect([...colours]).toEqual([palette.RED[4]]);
  });
});
