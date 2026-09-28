import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { newGame } from '../rules/scenario';
import { loadGame } from './save';

describe('saved games', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads a v5 save with its trinket in the first of the new slots', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    const previous = newGame(1066, ALDMOOR, 'knight');
    previous.hero.gear = { trinket: 'luckyHorseshoe' };
    values.set('kings-commission/save/v5-g2', JSON.stringify(previous));

    const loaded = loadGame();

    expect(loaded?.hero.gear.trinket).toBe('luckyHorseshoe');
    expect(loaded?.hero.gear.trinket2).toBeUndefined();
    expect(loaded?.hero.gear.trinket3).toBeUndefined();
  });
});
