import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { animLength, bodyHeight, hitTime, standingFigure, troopFigure, type AnimName } from '../src/render/battleSprites';
import { loadMapArt, paintedAnimation, paintedFigure } from '../src/render/mapArt';

describe('the approved battle-only Wizard scale', () => {
  beforeAll(() => loadMapArt(async file => new Uint8Array(readFileSync(`public/assets/${file.includes('/') ? file : `map/${file}`}`))));

  it('cuts every painted battle pose at the larger size from its sheet, never enlarging it as the game runs (#311)', () => {
    const standing = paintedAnimation('heroWizard', 'battle', 'stand')!.frames[0].sprite;
    const rows = [...Array(standing.height).keys()].filter((y) => standing.data.subarray(y * standing.width, (y + 1) * standing.width).some((v) => v !== 0));
    // His standing painting is 72 px; his battle poses are 1.3 times that, as tall as the old enlargement.
    expect(Math.abs(rows[rows.length - 1] + 1 - rows[0] - 94)).toBeLessThanOrEqual(2);
    for (const anim of ['stand', 'idle', 'move', 'ranged', 'cast'] as const) {
      const sequence = paintedAnimation('heroWizard', 'battle', anim)!;
      expect(sequence).not.toBeNull();
      let ms = 0;
      for (const frame of sequence.frames) {
        const right = troopFigure('heroWizard', 'blue', 1, { anim, ms }, 'battle');
        const left = troopFigure('heroWizard', 'blue', -1, { anim, ms }, 'battle');
        expect(right.sprite.width).toBe(frame.sprite.width + 2);
        expect(right.sprite.height).toBe(frame.sprite.height + 6);
        expect(right.x).toBe(-(sequence.foot[0] + 1));
        expect(right.y).toBe(-(sequence.foot[1] + 6));
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
