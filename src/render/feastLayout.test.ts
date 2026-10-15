import { describe, expect, it } from 'vitest';
import { feastLayout, feasts, feastStacks, FEAST_STACKS, type FeastSpot } from './feastLayout';

const pieces = (spots: FeastSpot[]) => spots.map((s) => ('feast' in s ? s.feast : 'map' in s ? `map:${s.map}` : `battle:${s.battle}`));

describe('who sits where at the payday feast', () => {
  it('Aldric comes as his background, with a figure for each of his biggest stacks', () => {
    const knight = pieces(feastLayout('knight', [{ troop: 'knights', count: 10 }, { troop: 'archers', count: 20 }, { troop: 'peasants', count: 30 }]));
    expect(knight).toEqual(expect.arrayContaining(['heroKnight', 'knightsRest', 'archersRest', 'peasants', 'fire', 'chest']));
    expect(pieces(feastLayout('courtier', [{ troop: 'swordsmen', count: 20 }]))).toContain('heroCourtier');
    expect(pieces(feastLayout('ranger', [{ troop: 'archers', count: 20 }]))).toContain('heroRanger');
    expect(pieces(feastLayout('wizard', [{ troop: 'knights', count: 8 }]))).toContain('heroWizard');
  });

  it('the biggest stacks come first, by what they are worth in a fight, and only so many', () => {
    expect(feastStacks([{ troop: 'peasants', count: 50 }, { troop: 'knights', count: 10 }])).toEqual(['knights', 'peasants']);
    const many = feastStacks(['peasants', 'archers', 'knights', 'swordsmen', 'wolves'].map((troop) => ({ troop: troop as never, count: 10 })));
    expect(many).toHaveLength(FEAST_STACKS);
  });

  it('a troop with no figure of its own at the feast comes in its battle figure', () => {
    expect(feasts('knights')).toBe(true);
    expect(feasts('witch')).toBe(false);
    expect(pieces(feastLayout('ranger', [{ troop: 'archers', count: 20 }, { troop: 'witch', count: 3 }]))).toContain('battle:witch');
  });

  it('the peasants dance, and the horses graze only where there are knights or the Knight', () => {
    const spots = feastLayout('wizard', [{ troop: 'peasants', count: 30 }]);
    expect(spots.some((s) => 'feast' in s && s.feast === 'peasants' && s.dances)).toBe(true);
    expect(pieces(spots).some((p) => p.startsWith('horse'))).toBe(false);
    expect(pieces(feastLayout('knight', [{ troop: 'archers', count: 20 }]))).toContain('horseWhite');
    expect(pieces(feastLayout('wizard', [{ troop: 'knights', count: 8 }]))).toContain('horseBrown');
  });

  it('never sits two cup-raisers side by side: those beside the toast and across the fire sit quietly (#311)', () => {
    const toasts = ['knights', 'archers'];
    for (const army of [[{ troop: 'knights' as const, count: 10 }, { troop: 'archers' as const, count: 20 }], [{ troop: 'archers' as const, count: 20 }, { troop: 'knights' as const, count: 10 }, { troop: 'peasants' as const, count: 40 }]]) {
      expect(pieces(feastLayout('knight', army)).filter((p) => toasts.includes(p)).length).toBeLessThanOrEqual(1);
    }
  });

  it('everything is drawn back to front, and the left third stays clear for the payday card', () => {
    const spots = feastLayout('knight', [{ troop: 'knights', count: 10 }, { troop: 'archers', count: 20 }, { troop: 'peasants', count: 30 }]);
    expect(spots.map((s) => s.y)).toEqual([...spots.map((s) => s.y)].sort((a, b) => a - b));
    for (const s of spots) if (!('feast' in s && s.feast === 'tent')) expect(s.x, pieces([s])[0]).toBeGreaterThan(300);
  });

  it('brings the painted party closer and leaves native phone-card room beside it', () => {
    const army = [{ troop: 'archers' as const, count: 20 }, { troop: 'peasants' as const, count: 40 }];
    const desktop = feastLayout('ranger', army);
    const phone = feastLayout('ranger', army, true);
    const fire = phone.find(s => 'feast' in s && s.feast === 'fire')!;
    const hero = phone.find(s => 'feast' in s && s.feast === 'heroRanger')!;
    expect(fire.x).toBeGreaterThanOrEqual(700);
    expect(hero.x).toBeGreaterThanOrEqual(630);
    expect(hero.scale).toBeGreaterThan(1);
    expect(fire.x).toBeGreaterThan(desktop.find(s => 'feast' in s && s.feast === 'fire')!.x);
    expect(phone.map(s => s.y)).toEqual(phone.map(s => s.y).sort((a, b) => a - b));
  });
});
