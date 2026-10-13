import { describe, expect, it } from 'vitest';
import { newGame, heroStats, type GameState } from '../rules/game';
import { previewGear } from './heroGear';

const kitted = (): GameState => {
  const state = newGame(1066, undefined, 'wizard');
  return {
    ...state,
    opening: undefined,
    army: [...state.army, { troop: 'peasants', count: 40 }],
    hero: {
      ...state.hero,
      gear: { weapon: 'twinWand', helm: 'crystalBall', armour: 'greenwoodCloak', banner: 'oldBanner', trinket: 'poachersHorn', trinket2: 'silverSignet', trinket3: 'luckyHorseshoe' },
      pack: ['brannocsLance', 'astrolabe', 'fenBanner'],
    },
  };
};

describe('gear inspected before it is changed', () => {
  it('uses the real replacement rules without changing the original state or seed', () => {
    const state = kitted();
    const saved = JSON.stringify(state);
    const preview = previewGear(state, { kind: 'pack', index: 0 });
    expect(preview?.action).toEqual({ type: 'wear', from: 0, slot: 'weapon' });
    expect(preview?.current).toBe('twinWand');
    expect(preview?.candidate).toBe('brannocsLance');
    expect(preview?.after.attack).toBe(preview!.before.attack + 1);
    expect(preview?.after.spellPower).toBe(preview!.before.spellPower - 1);
    expect(preview?.before.casts).toBe(2);
    expect(preview?.after.casts).toBe(2);
    expect(preview?.rows.find(row => row.name === 'Spells each round')).toMatchObject({ before: '2', after: '2', change: 'same' });
    expect(preview?.state.hero.gear.weapon).toBe('brannocsLance');
    expect(preview?.state.hero.pack[0]).toBe('twinWand');
    expect(preview?.state.seed).toBe(state.seed);
    expect(JSON.stringify(state)).toBe(saved);
  });

  it('targets each of the three trinket slots and compares the one actually replaced', () => {
    const state = kitted();
    for (const slot of ['trinket', 'trinket2', 'trinket3'] as const) {
      const preview = previewGear(state, { kind: 'pack', index: 1 }, slot)!;
      expect(preview.current).toBe(state.hero.gear[slot]);
      expect(preview.target).toBe(slot);
      expect(preview.state.hero.gear[slot]).toBe('astrolabe');
      expect(preview.state.hero.pack[1]).toBe(state.hero.gear[slot]);
      expect(preview.after).toEqual(heroStats(preview.state));
    }
    expect(previewGear(state, { kind: 'pack', index: 1 })?.target).toBe('trinket');
  });

  it('rejects absent items and incompatible destinations without inventing a preview', () => {
    const state = kitted();
    const saved = JSON.stringify(state);
    expect(previewGear(state, { kind: 'pack', index: 99 })).toBeNull();
    expect(previewGear(state, { kind: 'pack', index: 0 }, 'armour')).toBeNull();
    expect(previewGear({ ...state, hero: { ...state.hero, gear: {} } }, { kind: 'slot', slot: 'helm' })).toBeNull();
    expect(JSON.stringify(state)).toBe(saved);
  });

  it('shows lost mana and riding today, not just tomorrow, when gear comes off', () => {
    const state = kitted();
    const withBall = { ...state, movement: 160, hero: { ...state.hero, mana: 40, gear: { ...state.hero.gear, trinket3: 'astrolabe' as const } } };
    const preview = previewGear(withBall, { kind: 'slot', slot: 'trinket3' })!;
    expect(preview.state.hero.mana).toBe(preview.after.maxMana);
    expect(preview.rows.find(row => row.name === 'Mana left')).toMatchObject({ before: '40', after: '30' });
    const slower = previewGear({ ...state, movement: 160 }, { kind: 'slot', slot: 'trinket3' })!;
    expect(slower.rows.find(row => row.name === 'Movement left today')).toMatchObject({ before: '160', after: '140' });
  });

  it('includes troop-specific gains and losses and actual wages', () => {
    const state = kitted();
    const preview = previewGear(state, { kind: 'pack', index: 2 })!;
    expect(preview.rows.find(row => row.name === 'Leadership')).toMatchObject({ before: '130', after: '145' });
    expect(preview.rows.find(row => row.name === 'Archers attack bonus')).toMatchObject({ before: '1', after: '0' });
    expect(preview.rows.find(row => row.name === 'Archers extra shots')).toMatchObject({ before: '3', after: '0' });
    const loaf = { ...state, hero: { ...state.hero, pack: ['millersLoaf' as const] } };
    const paid = previewGear(loaf, { kind: 'pack', index: 0 }, 'trinket3')!;
    expect(paid.rows.find(row => row.name === 'Wages each payday')).toMatchObject({ before: '170', after: '153', change: 'up' });
  });
});
