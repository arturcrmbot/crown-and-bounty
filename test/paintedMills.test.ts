import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ALDMOOR } from '../src/content/aldmoor';
import { FENMARCH } from '../src/content/fenmarch';
import { buildAdventureScene, refreshPlace } from '../src/render/adventureScene';
import { SHADOW } from '../src/render/bitmap';
import { MAP_VIEW } from '../src/render/frame';
import { loadMapArt, piece } from '../src/render/mapArt';
import { CYCLING, PALETTE_SIZE, SILHOUETTE } from '../src/render/palette';
import { commissionAt } from '../src/rules/campaign';
import { mapOf } from '../src/rules/map/maps';
import { beginCommission, newGame } from '../src/rules/scenario';

vi.mock('../src/render/text', () => ({
  drawText: () => {},
  drawOutlined: () => {},
  textMask: (text: string, size: number) => ({ width: text.length * 7, height: size + 6, solid: () => false }),
  lettered: (size: number) => size,
  bigLettering: () => false,
}));

const mills = [
  ['mill', ALDMOOR, 'watermill'],
  ['windmill', FENMARCH, 'windmill'],
] as const;

describe('the painted mills', () => {
  beforeAll(() => loadMapArt(async (file) => new Uint8Array(readFileSync(`public/assets/${file.includes('/') ? file : `map/${file}`}`))));

  it.each(mills)('%s operates on the map clock without moving its painted anchor or changing state', (id, province, name) => {
    const state = newGame(1066, province);
    const before = structuredClone(state);
    const painting = piece(name)!;
    const original = painting.sprite.data.slice();
    const location = state.locations.find((place) => place.id === id)!;
    const scene = buildAdventureScene(mapOf(state), state);
    const object = scene.parts.get(id)![0];
    expect(object.frames, 'the painted lookup must not freeze the mechanism').toBeDefined();
    expect(object.foot).toBeDefined();
    expect(object.frames!.length).toBe(128);
    expect(object.frames!.every((frame, i, frames) => i % 2 === 0 || frame === frames[i - 1])).toBe(true);
    expect(new Set(object.frames!.map((frame) => [...frame.data].join(','))).size).toBeGreaterThan(2);
    expect(object.frames!.every((frame) => frame.width === object.sprite.width && frame.height === object.sprite.height)).toBe(true);
    expect(object.frames!.every((frame) => frame.data.every((colour) => colour === SHADOW || colour < PALETTE_SIZE && !CYCLING.has(colour)))).toBe(true);
    expect(object.x + object.sprite.width / 2).toBe(location.at[0]);
    expect(object.y + object.foot!).toBe(location.at[1]);
    const dx = (object.sprite.width - painting.sprite.width) / 2;
    const dy = object.foot! - painting.foot;
    const hub = name === 'watermill' ? [49, 41] : [26 + dx, 26 + dy];
    expect(new Set(object.frames!.map((frame) => frame.get(hub[0], hub[1]))).size).toBe(1);
    for (const frame of object.frames!) {
      for (let y = name === 'watermill' ? 0 : 63; y < (name === 'watermill' ? 30 : painting.sprite.height); y++) {
        for (let x = 0; x < painting.sprite.width; x++) {
          expect(frame.get(x + dx, y + dy), `the painted body at ${x},${y}`).toBe(painting.sprite.get(x, y));
        }
      }
    }
    expect(scene.sights.get(id) === object).toBe(true);
    const box = scene.hitboxes.find((hit) => hit.id === id);
    refreshPlace(scene, location);
    expect(scene.hitboxes.find((hit) => hit.id === id)).toEqual(box);
    expect(object.frames).toBeDefined();
    expect(painting.sprite.data).toEqual(original);
    expect(state).toEqual(before);
  });

  it.each(mills)('%s still has a stationary landmark shape under unexplored fog', (id, province, name) => {
    const start = newGame(1066, province);
    const state = { ...start, explored: start.explored.map(() => 0) };
    const scene = buildAdventureScene(mapOf(state), state);
    const object = scene.parts.get(id)![0];
    expect(object.foot).toBeDefined();
    const painting = piece(name)!;
    const x = Math.round(object.x) + (object.sprite.width - painting.sprite.width) / 2 + 20;
    const y = Math.round(object.y) + object.foot! - painting.foot + 40;
    const tile = scene.view.tiles.tile(Math.floor(x / 128), Math.floor(y / 128));
    expect(tile.wild.get(x - tile.x, y - tile.y)).toBe(SILHOUETTE);
  });

  it('leaves watermills of other provinces in their existing code-drawn frames', () => {
    const start = newGame(1066, FENMARCH);
    const state = { ...start, locations: [...start.locations, {
      id: 'other-mill', kind: 'mill' as const, name: 'Another mill', at: [200, 200] as const, done: false,
    }] };
    const scene = buildAdventureScene(mapOf(state), state);
    const object = scene.parts.get('other-mill')![0];
    expect([object.sprite.width, object.sprite.height, object.frames?.length]).toEqual([56, 50, 8]);
    expect(object.foot).toBeUndefined();
    expect(object.foreground).toBeUndefined();
  });

  it('leaves windmills of generated provinces in their existing code-drawn frames', () => {
    const start = newGame();
    const province = commissionAt(start.campaign, 2).province;
    const state = beginCommission(province, 1066, start.campaign.start, 2, []);
    const scene = buildAdventureScene(mapOf(state), state);
    const object = scene.parts.get('mill')![0];
    expect([object.sprite.width, object.sprite.height, object.frames?.length]).toEqual([64, 72, 8]);
    expect(object.foot).toBeUndefined();
    expect(object.foreground).toBeUndefined();
  });

  it.each(mills)('%s stays behind foreground scenery while it turns', (id, province) => {
    const start = newGame(1066, province);
    const location = start.locations.find((place) => place.id === id)!;
    const state = {
      ...start,
      explored: start.explored.map(() => 1),
      locations: [...start.locations, {
        id: 'foreground', kind: 'event' as const, look: 'stones', name: 'Foreground stones',
        at: [location.at[0] + 10, location.at[1] + 16] as const, done: false,
      }],
    };
    const scene = buildAdventureScene(mapOf(state), state);
    const mill = scene.parts.get(id)![0];
    const stones = scene.parts.get('foreground')![0];
    expect(scene.sights.get(id) === mill).toBe(true);
    scene.view.centreOn(...location.at);
    for (const tick of [0, 5, 11]) {
      const shown = scene.view.compose(tick).data.slice();
      mill.hidden = true;
      const hidden = scene.view.compose(tick).data.slice();
      mill.hidden = false;
      let overlap = 0;
      for (let y = 0; y < stones.sprite.height; y++) {
        for (let x = 0; x < stones.sprite.width; x++) {
          const colour = stones.sprite.get(x, y);
          const mx = Math.round(stones.x) + x;
          const my = Math.round(stones.y) + y;
          if (!colour || colour === SHADOW || mx < mill.x || mx >= mill.x + mill.sprite.width || my < mill.y || my >= mill.y + mill.sprite.height) continue;
          const sx = MAP_VIEW.x + mx - Math.round(scene.view.camera.x);
          const sy = MAP_VIEW.y + my - Math.round(scene.view.camera.y);
          const pixel = sy * scene.view.screen.width + sx;
          expect(shown[pixel], `foreground pixel ${x},${y} at tick ${tick}`).toBe(hidden[pixel]);
          overlap++;
        }
      }
      expect(overlap).toBeGreaterThan(0);
    }
  });
});
