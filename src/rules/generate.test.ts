import { describe, expect, it } from 'vitest';
import { VILLAINS } from '../content/villains';
import { generateCommission, playable } from './generate';

describe('generated provinces', () => {
  it('are always playable: the castle open, every place reachable, the hideout only past its guards', () => {
    for (let seed = 1; seed <= 12; seed++) {
      for (const [i, villain] of VILLAINS.entries()) {
        const c = generateCommission(seed * 101, villain, 2 + i);
        expect(playable(c.province), `${villain.id} ${seed}`).toBe(true);
        expect(c.province.locations.filter((l) => l.kind === 'hideout')).toHaveLength(1);
        expect(c.province.locations.some((l) => l.id === 'guardian')).toBe(true);
      }
    }
  }, 120_000);

  it('are the same for the same seed, and different for another', () => {
    const a = generateCommission(7, VILLAINS[0], 2);
    expect(generateCommission(7, VILLAINS[0], 2)).toEqual(a);
    expect(generateCommission(8, VILLAINS[0], 2).province.hero).not.toEqual(a.province.hero);
  });

  it('get stronger with every commission', () => {
    const power = (chapter: number) => generateCommission(3, VILLAINS[1], chapter).province.locations.find((l) => l.kind === 'hideout')!.enemy!.army.reduce((n, s) => n + s.count, 0);
    expect(power(3)).toBeGreaterThan(power(2));
  });
});
