import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { animLength, bodyHeight, hitTime, standingFigure, troopFigure, type AnimName } from '../src/render/battleSprites';
import { loadMapArt, paintedAnimation, paintedFigure } from '../src/render/mapArt';

describe('the approved battle-only Wizard scale', () => {
  beforeAll(() => loadMapArt(async file => new Uint8Array(readFileSync(`public/assets/${file.includes('/') ? file : `map/${file}`}`))));

  it('enlarges every painted battle pose by one fixed factor around its original ground anchor', () => {
    for (const anim of ['stand', 'idle', 'move', 'ranged', 'cast'] as const) {
      const sequence = paintedAnimation('heroWizard', 'battle', anim)!;
      expect(sequence).not.toBeNull();
      let ms = 0;
      for (const frame of sequence.frames) {
        const right = troopFigure('heroWizard', 'blue', 1, { anim, ms }, 'battle');
        const left = troopFigure('heroWizard', 'blue', -1, { anim, ms }, 'battle');
        expect(right.sprite.width).toBe(Math.round((frame.sprite.width + 2) * 1.30));
        expect(right.sprite.height).toBe(Math.round((frame.sprite.height + 6) * 1.30));
        expect(right.x).toBe(-Math.round((sequence.foot[0] + 1) * 1.30));
        expect(right.y).toBe(-Math.round((sequence.foot[1] + 6) * 1.30));
        expect(left.x + left.sprite.width).toBe(-right.x);
        expect(left.y).toBe(right.y);
        expect(troopFigure('heroWizard', 'blue', 1, { anim, ms }, 'battle').sprite).toBe(right.sprite);
        ms += frame.ms;
      }
      expect(animLength('heroWizard', anim)).toBe(ms);
    }
    expect(bodyHeight('heroWizard', 'battle')).toBe(94);
    for (const anim of ['melee', 'charge', 'defend', 'defendRanged', 'death'] as AnimName[]) {
      const figure = troopFigure('heroWizard', 'blue', 1, { anim, ms: 100 }, 'battle');
      const base = paintedFigure('heroWizard', 'battle')!;
      expect(figure.sprite.width).toBe(Math.round((base.width + 2) * 1.30));
      expect(figure.sprite.height).toBe(Math.round((base.height + 6) * 1.30));
    }
    expect(hitTime('heroWizard', 'ranged')).toBe(paintedAnimation('heroWizard', 'battle', 'ranged')!.hit);
  });

  it('does not promote the map Wizard, any other figure, or the UI portrait', () => {
    const map = paintedAnimation('heroWizard', 'map', 'move')!;
    const walking = troopFigure('heroWizard', 'blue', 1, { anim: 'move', ms: 0 }, 'map');
    expect(walking.sprite.width).toBe(map.frames[0].sprite.width + 2);
    expect(walking.sprite.height).toBe(map.frames[0].sprite.height + 6);
    expect(walking.x).toBe(-map.foot[0] - 1);
    expect(walking.y).toBe(-map.foot[1] - 6);
    expect(bodyHeight('heroWizard', 'map')).toBe(48);
    expect(standingFigure('heroWizard', 'blue', 1)).toBe(paintedFigure('heroWizard', 'battle'));
    for (const id of ['heroKnight', 'heroRanger', 'heroCourtier', 'knights', 'archers', 'peasants'] as const) {
      const sequence = paintedAnimation(id, 'battle', 'move')!;
      const figure = troopFigure(id, 'blue', 1, { anim: 'move', ms: 0 }, 'battle');
      expect(figure.sprite.width).toBe(sequence.frames[0].sprite.width + 2);
      expect(figure.sprite.height).toBe(sequence.frames[0].sprite.height + 6);
      expect(figure.x).toBe(-sequence.foot[0] - 1);
      expect(figure.y).toBe(-sequence.foot[1] - 6);
    }
  });
});
