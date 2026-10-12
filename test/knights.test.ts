import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { animLength, hitTime, troopFigure } from '../src/render/battleSprites';
import { loadMapArt, paintedAnimation } from '../src/render/mapArt';

describe('the Knights painted gait and attacks', () => {
  beforeAll(() => loadMapArt(async (file) => new Uint8Array(readFileSync(`public/assets/${file.includes('/') ? file : `map/${file}`}`))));

  it('has four real gait poses on one ground anchor, with no added hop', () => {
    const frames = [0, 90, 180, 270].map((ms) => troopFigure('knights', 'blue', 1, { anim: 'move', ms }, 'battle'));
    expect(new Set(frames.map((frame) => frame.sprite.data.join(','))).size).toBe(4);
    expect(new Set(frames.map((frame) => `${frame.x},${frame.y}`)).size).toBe(1);
    expect(troopFigure('knights', 'blue', 1, { anim: 'move', ms: 360 }, 'battle').sprite).toBe(frames[0].sprite);
    expect(paintedAnimation('knights', 'battle', 'move')?.footfalls).toEqual([0, 180]);
  });

  it('puts sword contact on its painted contact pose and holds the recovery', () => {
    const frames = [0, 160, 270, 370].map((ms) => troopFigure('knights', 'blue', 1, { anim: 'melee', ms }, 'battle'));
    expect(new Set(frames.map((frame) => frame.sprite.data.join(','))).size).toBe(4);
    expect(new Set(frames.map((frame) => `${frame.x},${frame.y}`)).size).toBe(1);
    expect(hitTime('knights', 'melee')).toBe(160);
    expect(animLength('knights', 'melee')).toBe(570);
    expect(troopFigure('knights', 'blue', 1, { anim: 'melee', ms: 2000 }, 'battle').sprite).toBe(frames[3].sprite);
  });

  it('has four couched-lance approach poses before distinct contact and recovery', () => {
    const frames = [0, 80, 160, 240, 320, 420].map((ms) => troopFigure('knights', 'blue', 1, { anim: 'charge', ms }, 'battle'));
    expect(new Set(frames.map((frame) => frame.sprite.data.join(','))).size).toBe(6);
    expect(new Set(frames.map((frame) => `${frame.x},${frame.y}`)).size).toBe(1);
    expect(hitTime('knights', 'charge')).toBe(320);
    expect(animLength('knights', 'charge')).toBe(640);
    expect(paintedAnimation('knights', 'battle', 'charge')?.footfalls).toEqual([0, 160]);
    expect(troopFigure('knights', 'blue', 1, { anim: 'charge', ms: 2000 }, 'battle').sprite).toBe(frames[5].sprite);
  });

  it('keeps the same anchor through standing, movement and weapon changes', () => {
    const frames = (['stand', 'idle', 'move', 'melee', 'charge'] as const).map((anim) => troopFigure('knights', 'blue', 1, { anim, ms: 0 }, 'battle'));
    expect(new Set(frames.map((frame) => `${frame.x},${frame.y}`)).size).toBe(1);
    const right = frames[2];
    const left = troopFigure('knights', 'red', -1, { anim: 'move', ms: 0 }, 'battle');
    expect(left.x + left.sprite.width).toBe(-right.x);
    expect(left.y).toBe(right.y);
  });
});
