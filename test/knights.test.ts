import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { animLength, hitTime, troopFigure } from '../src/render/battleSprites';
import { loadMapArt, paintedAnimation } from '../src/render/mapArt';
import { TROOP_SOUNDS } from '../src/audio/blows';
import { ART } from '../src/render/units';

describe('the Knights painted gait and attacks', () => {
  beforeAll(() => loadMapArt(async (file) => new Uint8Array(readFileSync(`public/assets/${file.includes('/') ? file : `map/${file}`}`))));

  it('has four real gait poses on one ground anchor, with no added hop', () => {
    const frames = [0, 90, 180, 270].map((ms) => troopFigure('knights', 'blue', 1, { anim: 'move', ms }, 'battle'));
    expect(new Set(frames.map((frame) => frame.sprite.data.join(','))).size).toBe(4);
    expect(new Set(frames.map((frame) => `${frame.x},${frame.y}`)).size).toBe(1);
    expect(troopFigure('knights', 'blue', 1, { anim: 'move', ms: 360 }, 'battle').sprite).toBe(frames[0].sprite);
    expect(paintedAnimation('knights', 'battle', 'move')?.footfalls).toEqual([0, 180]);
  });

  it('puts the short lance thrust on its contact pose and holds the recovery', () => {
    const frames = [0, 140, 240, 340].map((ms) => troopFigure('knights', 'blue', 1, { anim: 'melee', ms }, 'battle'));
    expect(new Set(frames.map((frame) => frame.sprite.data.join(','))).size).toBe(4);
    expect(new Set(frames.map((frame) => `${frame.x},${frame.y}`)).size).toBe(1);
    expect(hitTime('knights', 'melee')).toBe(240);
    expect(animLength('knights', 'melee')).toBe(540);
    expect(troopFigure('knights', 'blue', 1, { anim: 'melee', ms: 2000 }, 'battle').sprite).toBe(frames[3].sprite);
  });

  it('keeps the lance sound and lance fallback for ordinary melee too', () => {
    expect(TROOP_SOUNDS.knights.blow).toBe('lance');
    expect(ART.knights.melee).toEqual(ART.knights.charge);
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

  it('mirrors every mounted pose about its own grounded foot anchor', () => {
    for (const anim of ['stand', 'idle', 'move', 'melee', 'charge'] as const) {
      const right = troopFigure('knights', 'blue', 1, { anim, ms: 0 }, 'battle');
      const left = troopFigure('knights', 'red', -1, { anim, ms: 0 }, 'battle');
      expect(left.x + left.sprite.width).toBe(-right.x);
      expect(left.y).toBe(right.y);
    }
  });

  it('keeps the registered battle stand when a new idle exists only at map size', async () => {
    vi.resetModules();
    vi.doMock('../src/render/mapPieces', async () => {
      const pieces = await vi.importActual<typeof import('../src/render/mapPieces')>('../src/render/mapPieces');
      const knight = pieces.FIGURE_ANIMATIONS.knights;
      const idle = knight.idle!;
      return {
        ...pieces,
        FIGURE_ANIMATIONS: {
          ...pieces.FIGURE_ANIMATIONS,
          knights: { ...knight, idle: { ...idle, feet: { map: idle.feet.map } } },
        },
      };
    });
    try {
      const art = await import('../src/render/mapArt');
      const figures = await import('../src/render/battleSprites');
      await art.loadMapArt(async (file) => new Uint8Array(readFileSync(`public/assets/${file.includes('/') ? file : `map/${file}`}`)));
      expect(art.paintedAnimation('knights', 'battle', 'idle')?.frames[0].name).toBe('knights-stand-0');
      expect(figures.animLength('knights', 'idle')).toBe(100);
      const still = figures.troopFigure('knights', 'blue', 1, { anim: 'stand', ms: 0 }, 'battle');
      const waiting = figures.troopFigure('knights', 'blue', 1, { anim: 'idle', ms: 500 }, 'battle');
      expect(waiting).toEqual(still);
    } finally {
      vi.doUnmock('../src/render/mapPieces');
      vi.resetModules();
    }
  });
});
