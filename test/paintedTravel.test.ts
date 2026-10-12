import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as scene from '../src/render/adventureScene';
import { loadMapArt } from '../src/render/mapArt';
import { newGame } from '../src/rules/scenario';
import { mapOf } from '../src/rules/map/maps';
import { ALDMOOR } from '../src/content/aldmoor';

vi.mock('../src/render/text', () => ({
  drawText: () => {},
  drawOutlined: () => {},
  textMask: (text: string, size: number) => ({ width: text.length * 7, height: size + 6, solid: () => false }),
  lettered: (size: number) => size,
  bigLettering: () => false,
}));

describe('the heroes on the road', () => {
  beforeAll(() => loadMapArt(async (file) => new Uint8Array(readFileSync(`public/assets/${file.includes('/') ? file : `map/${file}`}`))));

  it('uses a painted gait on the map instead of the raised standing frames', () => {
    const state = newGame(1066, ALDMOOR, 'wizard');
    const { hero } = scene.buildAdventureScene(mapOf(state), state);
    expect(hero.gait).toEqual({ stride: 48, frames: [8, 16, 24, 32, 40, 48], footfalls: [8, 32] });
    expect(new Set(hero.walk.map((frame) => [...frame.data].join(','))).size).toBe(6);
    expect(hero.walk.every((frame) => frame.width === hero.idle[0].width && frame.height === hero.idle[0].height)).toBe(true);
    expect(new Set(hero.idle.map((frame) => [...frame.data].join(','))).size).toBeGreaterThan(1);
    const ground = (frame: (typeof hero.walk)[number]) => [...frame.data.subarray((hero.foot + 1) * frame.width)].join(',');
    expect(new Set([...hero.idle, ...hero.walk, ...hero.idleLeft, ...hero.walkLeft].map(ground)).size).toBe(1);
  });

  it('gives every background genuine travel and restrained idle poses on one grounded canvas', () => {
    for (const background of ['knight', 'wizard', 'ranger', 'courtier'] as const) {
      const state = newGame(1066, ALDMOOR, background);
      const { hero } = scene.buildAdventureScene(mapOf(state), state);
      expect(hero.gait, background).toBeDefined();
      expect(new Set(hero.walk.map((frame) => [...frame.data].join(','))).size, background).toBeGreaterThan(2);
      expect(new Set(hero.idle.map((frame) => [...frame.data].join(','))).size, background).toBeGreaterThan(1);
      const frames = [...hero.idle, ...hero.walk, ...hero.idleLeft, ...hero.walkLeft];
      expect(new Set(frames.map((frame) => `${frame.width},${frame.height}`)).size, background).toBe(1);
    }
  });

  it('changes gait with the opening choice without moving the hero feet', () => {
    const state = newGame(1066, ALDMOOR, 'wizard');
    const map = scene.buildAdventureScene(mapOf(state), state);
    const feet = map.hero.object.y + map.hero.foot;
    const centre = map.hero.object.x + map.hero.object.sprite.width / 2;
    scene.setHeroFigure(map, 'knight', -1);
    expect(map.hero.gait?.stride).toBeGreaterThan(48);
    expect(map.hero.object.frames).toBe(map.hero.idleLeft);
    expect(map.hero.object.y + map.hero.foot).toBe(feet);
    expect(map.hero.object.x + map.hero.object.sprite.width / 2).toBe(centre);
    scene.setHeroFigure(map, 'wizard', 1);
    expect(map.hero.gait?.stride).toBe(48);
    expect(map.hero.object.y + map.hero.foot).toBe(feet);
    expect(map.hero.object.x + map.hero.object.sprite.width / 2).toBe(centre);
  });

  it('steps by distance through straight travel, bends and Shift travel', () => {
    expect(scene).toHaveProperty('walkFrame');
    const gait = { stride: 48, frames: [8, 16, 24, 32, 40, 48], footfalls: [8, 32] };
    expect([0, 7.9, 8, 16, 47.9, 48, 56].map((distance) => scene.walkFrame(distance, gait))).toEqual([0, 0, 1, 2, 5, 0, 1]);
    expect(scene.walkFrame(25)).toBe(5);
  });

  it('sounds each planted foot once, including a large Shift step across several contacts', () => {
    expect(scene).toHaveProperty('walkFootfalls');
    const gait = { stride: 48, frames: [8, 16, 24, 32, 40, 48], footfalls: [8, 32] };
    expect(scene.walkFootfalls(0, 7.9, gait)).toBe(0);
    expect(scene.walkFootfalls(7.9, 8, gait)).toBe(1);
    expect(scene.walkFootfalls(8, 8.1, gait)).toBe(0);
    expect(scene.walkFootfalls(31.9, 32, gait)).toBe(1);
    expect(scene.walkFootfalls(32, 48, gait)).toBe(0);
    expect(scene.walkFootfalls(0, 144, gait)).toBe(6);
    expect(scene.walkFootfalls(48, 48, gait)).toBe(0);
  });
});
