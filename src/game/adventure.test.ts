import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import type { BackgroundId } from '../content/backgrounds';
import { update, type GameState } from '../rules/game';
import { mapOf } from '../rules/map/maps';
import { cellCentre, Terrain } from '../rules/map/model';
import { newGame } from '../rules/scenario';
import { campLine, tiredResult } from './adventureCards';

describe('the tired card', () => {
  it.each([2, 8])('still appears on day %i', (day) => {
    const state = { ...newGame(), day, flags: { 'hint:rest': true } };
    const result = tiredResult(state, false, [10, 20]);
    const event = result.events.find((item) => item.type === 'card');

    expect(event?.type === 'card' && event.card.title).toBe('Your legs are spent');
    expect(event?.type === 'card' && event.card.choices.map((choice) => choice.label)).toEqual(['End the day (E)', 'Not yet']);
  });

  it('tells a ranger with a band on his trail whether he camps among the trees or in the open (#217)', () => {
    const start = (background: BackgroundId): GameState => ({ ...newGame(1066, ALDMOOR, background), opening: undefined });
    const map = mapOf(start('ranger'));
    const trees = cellCentre(map, map.terrain.findIndex((t) => t === Terrain.Forest));
    const open = cellCentre(map, map.terrain.findIndex((t) => t === Terrain.Grass));
    const at = (state: GameState, point: readonly number[]): GameState => ({ ...state, hero: { ...state.hero, at: [point[0], point[1]] } });
    const trailed = (state: GameState) => update(state, 'wolves', { enemy: { ...state.locations.find((l) => l.id === 'wolves')!.enemy!, trailing: true } });
    const lines = (state: GameState) => {
      const event = tiredResult(state, false, [10, 20]).events.find((item) => item.type === 'card');
      return event?.type === 'card' ? event.card.lines : [];
    };

    expect(campLine(at(trailed(start('ranger')), open))).toBe('You camp in the open tonight, and **Rook\u2019s Wolves** are on your trail.');
    expect(lines(at(trailed(start('ranger')), trees))).toContain('You camp among the trees tonight, where nothing on the map can follow you.');
    // Nobody on his trail, nothing to say; and the trees hide nobody but a hero who rides through them.
    expect(campLine(at(start('ranger'), open))).toBeNull();
    expect(campLine(at(trailed(start('knight')), trees))).toBeNull();
    expect(lines(at(trailed(start('knight')), open))).toHaveLength(1);
  });
});
