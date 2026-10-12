import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { bodyHeight, STAND, troopFigure } from '../src/render/battleSprites';
import { loadMapArt, paintedAnimation } from '../src/render/mapArt';
import { FIGURES } from '../src/render/mapPieces';
import type { Bitmap } from '../src/render/bitmap';

const picture = (sprite: Bitmap) => [...sprite.data].join(',');
const walk = () => Array.from({ length: 6 }, (_, i) => troopFigure('heroWizard', 'blue', 1, { anim: 'move', ms: i * 100 }, 'map'));

describe('painted walking figures', () => {
  beforeAll(() => loadMapArt(async (file) => new Uint8Array(readFileSync(`public/assets/${file.includes('/') ? file : `map/${file}`}`))));

  it('gives the wizard six distinct painted walk poses rather than lifting a still picture', () => {
    expect(new Set(walk().map((frame) => picture(frame.sprite))).size).toBe(6);
  });

  it('keeps the wizard on the same foot anchor throughout his stride', () => {
    const frames = walk();
    expect(new Set(frames.map((frame) => frame.y)).size).toBe(1);
    expect(new Set(frames.map((frame) => frame.x)).size).toBe(1);
  });

  it('keeps the wizard standing at his established scale', () => {
    expect(bodyHeight('heroWizard', 'map')).toBe(48);
    const still = troopFigure('heroWizard', 'blue', 1, STAND, 'map');
    expect(still.y).toBeLessThan(0);
  });

  it('loops a painted move and mirrors each pose about the same foot anchor', () => {
    const right = troopFigure('heroWizard', 'blue', 1, { anim: 'move', ms: 100 }, 'map');
    const looped = troopFigure('heroWizard', 'blue', 1, { anim: 'move', ms: 700 }, 'map');
    const left = troopFigure('heroWizard', 'blue', -1, { anim: 'move', ms: 100 }, 'map');
    expect(looped.sprite).toBe(right.sprite);
    expect(left.x + left.sprite.width).toBe(-right.x);
    expect(left.y).toBe(right.y);
    for (let y = 0; y < right.sprite.height; y++) {
      for (let x = 0; x < right.sprite.width; x++) {
        expect(left.sprite.get(left.sprite.width - 1 - x, y)).toBe(right.sprite.get(x, y));
      }
    }
  });

  it.each(['heroKnight', 'heroRanger', 'heroCourtier'] as const)('gives %s genuine painted steps on a fixed anchor', (id) => {
    const first = troopFigure(id, 'blue', 1, { anim: 'move', ms: 0 }, 'map');
    const later = troopFigure(id, 'blue', 1, { anim: 'move', ms: 100 }, 'map');
    expect(later.sprite).not.toBe(first.sprite);
    expect(later.y).toBe(first.y);
    expect(later.x).toBe(first.x);
  });

  it.each(FIGURES.filter((id) => id !== 'hero'))('keeps %s battle travel and idle on their own fixed canvas and ground anchor', (id) => {
    for (const anim of ['move', 'idle'] as const) {
      const sequence = paintedAnimation(id, 'battle', anim);
      expect(sequence, `${id} needs its loaded painted ${anim}`).not.toBeNull();
      let ms = 0;
      const frames = sequence!.frames.map((frame) => {
        const figure = troopFigure(id, 'blue', 1, { anim, ms }, 'battle');
        ms += frame.ms;
        return figure;
      });
      expect(new Set(frames.map((frame) => picture(frame.sprite))).size).toBeGreaterThan(1);
      expect(new Set(frames.map((frame) => `${frame.x},${frame.y},${frame.sprite.width},${frame.sprite.height}`)).size).toBe(1);
    }
  });

  it.each([
    ['swordsmen', 'melee'],
    ['archers', 'ranged'],
    ['wolves', 'melee'],
    ['heroWizard', 'ranged'],
    ['heroWizard', 'cast'],
    ['heroRanger', 'ranged'],
    ['heroCourtier', 'cast'],
  ] as const)('gives %s a painted %s preparation, contact and recovery', (id, anim) => {
    const sequence = paintedAnimation(id, 'battle', anim);
    expect(sequence?.frames).toHaveLength(4);
    expect(new Set(sequence!.frames.map((frame) => picture(frame.sprite))).size).toBe(4);
    expect(sequence!.hit).toBeGreaterThan(0);
    expect(sequence!.hit).toBeLessThan(sequence!.frames.reduce((total, frame) => total + frame.ms, 0));
  });

  it.each([
    ['archers', 'ranged', [24, -43]],
    ['heroRanger', 'ranged', [26, -43]],
    ['heroWizard', 'ranged', [28, -69]],
    ['heroWizard', 'cast', [28, -69]],
    ['heroCourtier', 'cast', [31, -50]],
  ] as const)('launches %s %s from its visible bow, staff or hand', (id, anim, launch) => {
    expect(paintedAnimation(id, 'battle', anim)?.launch).toEqual(launch);
  });

  describe('optional painted sequences', () => {
    it('uses a painted attack contact and duration rather than the unrelated Wesnoth timing', async () => {
      vi.resetModules();
      vi.doMock('../src/render/mapPieces', async () => {
        const pieces = await vi.importActual<typeof import('../src/render/mapPieces')>('../src/render/mapPieces');
        return {
          ...pieces,
          FIGURE_ANIMATIONS: {
            heroKnight: {
              melee: {
                frames: [{ name: 'heroKnight', ms: 100 }, { name: 'heroWizard', ms: 300 }],
                feet: { battle: [20, 96] },
                hit: 125,
              },
            },
          },
        };
      });
      try {
        const art = await import('../src/render/mapArt');
        const figures = await import('../src/render/battleSprites');
        await art.loadMapArt(async (file) => new Uint8Array(readFileSync(`public/assets/${file.includes('/') ? file : `map/${file}`}`)));
        expect(figures.hitTime('heroKnight', 'melee')).toBe(125);
        expect(figures.animLength('heroKnight', 'melee')).toBe(400);
        const atContact = figures.troopFigure('heroKnight', 'blue', 1, { anim: 'melee', ms: 125 }, 'battle');
        const after = figures.troopFigure('heroKnight', 'blue', 1, { anim: 'melee', ms: 900 }, 'battle');
        expect(after.sprite).toBe(atContact.sprite);
      } finally {
        vi.doUnmock('../src/render/mapPieces');
        vi.resetModules();
      }
    });

    it('warns and retains the standing painted fallback if any optional walk frame fails to load', async () => {
      vi.resetModules();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const art = await import('../src/render/mapArt');
        const figures = await import('../src/render/battleSprites');
        await art.loadMapArt(async (file) => {
          if (file === 'troops/heroWizard-move-4-map.png') throw new Error('503');
          return new Uint8Array(readFileSync(`public/assets/${file.includes('/') ? file : `map/${file}`}`));
        });
        expect(warn).toHaveBeenCalledWith(expect.objectContaining({ message: '503' }));
        expect(art.paintedAnimation('heroWizard', 'map', 'move')).toBeNull();
        const first = figures.troopFigure('heroWizard', 'blue', 1, { anim: 'move', ms: 0 }, 'map');
        const later = figures.troopFigure('heroWizard', 'blue', 1, { anim: 'move', ms: 100 }, 'map');
        expect(later.sprite).toBe(first.sprite);
        expect(later.y).toBeLessThan(first.y);
      } finally {
        warn.mockRestore();
        vi.resetModules();
      }
    });
  });
});
