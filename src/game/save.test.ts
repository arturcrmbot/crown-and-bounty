import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { newGame } from '../rules/scenario';
import { clearSave, loadGame, saveGame } from './save';

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

  it('does not restore a v5 campaign after saving and clearing a new one', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    const previous = newGame(1066, ALDMOOR, 'knight');
    values.set('kings-commission/save/v5-g2', JSON.stringify(previous));

    saveGame(previous);
    expect(values.has('kings-commission/save/v5-g2')).toBe(false);
    values.set('kings-commission/save/v5-g2', JSON.stringify(previous));
    clearSave();

    expect(loadGame()).toBeNull();
    expect(values.size).toBe(0);
  });
});
