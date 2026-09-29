import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { FENMARCH } from '../content/fenmarch';
import { beginCommission, newGame } from '../rules/scenario';
import { clearSave, keepMinimap, loadGame, minimapWanted, saveGame } from './save';

/** A localStorage of its own for each test. */
function storage() {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  return values;
}

/** A campaign out in the Fenmarch, the second commission. */
const inTheFen = () => {
  const first = newGame(1066, ALDMOOR, 'knight');
  return beginCommission(FENMARCH, 7, first.campaign.start, 1, [{ chapter: 0, days: 12, level: 4 }], 1066);
};

describe('saved games', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads a v5 save with its trinket in the first of the new slots', () => {
    const values = storage();
    const previous = inTheFen();
    previous.hero.gear = { trinket: 'luckyHorseshoe' };
    values.set('kings-commission/save/v5-g2', JSON.stringify(previous));

    const loaded = loadGame();

    expect(loaded?.hero.gear.trinket).toBe('luckyHorseshoe');
    expect(loaded?.hero.gear.trinket2).toBeUndefined();
    expect(loaded?.hero.gear.trinket3).toBeUndefined();
  });

  it('begins an Aldmoor commission saved on the old, smaller map again on the new one, with the hero it began with', () => {
    const values = storage();
    const started = newGame(1066, ALDMOOR, 'ranger');
    const old = { ...started, opening: undefined, day: 5, gold: 3000, hero: { ...started.hero, at: [104, 850] as const, level: 3 }, explored: new Array(600).fill(-1), world: { width: 1280, height: 960 } };
    values.set('kings-commission/save/v6-g2', JSON.stringify(old));

    const loaded = loadGame()!;

    expect(loaded.day).toBe(1);
    expect(loaded.hero.background).toBe('ranger');
    expect(loaded.hero.level).toBe(1);
    expect(loaded.gold).toBe(started.gold);
    expect(loaded.hero.at).toEqual(ALDMOOR.hero);
    expect(loaded.world).toEqual({ width: ALDMOOR.width, height: ALDMOOR.height });
    expect(loaded.explored).toEqual(started.explored);
    expect(loaded.opening).toBeUndefined();
  });

  it('carries on with a campaign saved in a later commission, as it was', () => {
    const values = storage();
    const fen = { ...inTheFen(), day: 9, gold: 4321 };
    values.set('kings-commission/save/v6-g2', JSON.stringify(fen));

    const loaded = loadGame()!;

    expect(loaded.campaign.chapter).toBe(1);
    expect(loaded.day).toBe(9);
    expect(loaded.gold).toBe(4321);
  });

  it('keeps the minimap folded away apart from the save, and a frozen page starts with it out and keeps nothing', async () => {
    const values = storage();
    expect(minimapWanted()).toBe(true);
    keepMinimap(false);
    expect(values.get('kings-commission/minimap')).toBe('folded');
    expect(minimapWanted()).toBe(false);
    expect([...values.keys()]).toEqual(['kings-commission/minimap']);
    vi.resetModules();
    const frozen = await import('./save');
    frozen.stopSaving();
    expect(frozen.minimapWanted()).toBe(true);
    frozen.keepMinimap(true);
    expect(values.get('kings-commission/minimap')).toBe('folded');
  });

  it('does not restore an old campaign after saving and clearing a new one', () => {
    const values = storage();
    const previous = newGame(1066, ALDMOOR, 'knight');
    values.set('kings-commission/save/v5-g2', JSON.stringify(previous));
    values.set('kings-commission/save/v6-g2', JSON.stringify(previous));

    saveGame(previous);
    expect(values.has('kings-commission/save/v5-g2')).toBe(false);
    expect(values.has('kings-commission/save/v6-g2')).toBe(false);
    values.set('kings-commission/save/v6-g2', JSON.stringify(previous));
    clearSave();

    expect(loadGame()).toBeNull();
    expect(values.size).toBe(0);
  });
});
