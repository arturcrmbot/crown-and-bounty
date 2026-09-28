import { describe, expect, it } from 'vitest';
import { Bitmap } from './bitmap';
import { FogMask } from './fog';
import { MAP_VIEW } from './frame';
import { GOLD, GRAIN_LUT, INK, RED, WOOD } from './palette';
import { AdventureScreen } from './adventureScreen';

const region = (screen: Bitmap, x: number, y: number, radius: number) => {
  const pixels: number[] = [];
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) pixels.push(screen.get(MAP_VIEW.x + x + dx, MAP_VIEW.y + y + dy));
  return pixels;
};

describe('adventure routes', () => {
  it('draws bold day colours and a tent at tonight’s camp', () => {
    const map = new Bitmap(MAP_VIEW.width, MAP_VIEW.height);
    const cells = Math.ceil(map.width / 8) * Math.ceil(map.height / 8);
    const fog = new FogMask(map.width, map.height, new Array(Math.ceil(cells / 32)).fill(0xffffffff));
    const view = new AdventureScreen(map, map, fog);
    view.route = [
      { at: [100, 100], today: true },
      { at: [120, 100], today: false },
    ];
    view.camp = [110, 100];

    const frame = view.compose(0);
    const today = region(frame, 100, 100, 2);
    const tomorrow = region(frame, 120, 100, 2);
    const tent = region(frame, 110, 92, 6);

    expect(today.filter((pixel) => pixel === GOLD[6] || pixel === GRAIN_LUT[GOLD[6]])).toHaveLength(9);
    expect(tomorrow.filter((pixel) => pixel === RED[5] || pixel === GRAIN_LUT[RED[5]])).toHaveLength(9);
    expect(tent.some((pixel) => pixel === RED[4] || pixel === GRAIN_LUT[RED[4]])).toBe(true);
    expect(tent.some((pixel) => pixel === WOOD[2] || pixel === GRAIN_LUT[WOOD[2]])).toBe(true);
    expect(tent).toContain(INK);
  });
});
