import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { apply, finished, locationById, placeNote, update, visit, type GameState } from './game';
import { newGame } from './scenario';

const fresh = (): GameState => ({ ...newGame(1066, ALDMOOR, 'knight'), opening: undefined });
const take = (state: GameState, id: string, choice: string) => {
  const result = apply(state, { type: 'choose', id, choice });
  expect(result, `${id} ${choice}`).not.toBeNull();
  return result!.state;
};
const isFinished = (state: GameState, id: string) => finished(state, locationById(state, id));
const flagged = (state: GameState, flags: Record<string, string | boolean>): GameState => ({ ...state, flags: { ...state.flags, ...flags } });

describe('places the hero has done with fly the King\u2019s pennant (#256)', () => {
  it('none at the start', () => {
    const state = fresh();
    expect(state.locations.filter((l) => finished(state, l)).map((l) => l.id)).toEqual([]);
  });

  it('a shrine once you have chosen its gift, and its label says so', () => {
    const there = visit(fresh(), 'shrine').state;
    expect(isFinished(there, 'shrine')).toBe(false);
    const prayed = take(there, 'shrine', 'start/pray');
    expect(isFinished(prayed, 'shrine')).toBe(true);
    expect(placeNote(prayed, 'shrine')).toBe('Shrine of St Aldhelm: you have done all there is here');
  });

  it('a lookout once you have climbed it, a tower once you have searched it, a scroll stone once it is read, and a chest once it is opened', () => {
    const climbed = take(visit(fresh(), 'huntStand').state, 'huntStand', 'climb/look');
    expect(isFinished(climbed, 'huntStand')).toBe(true);
    const searched = take(visit(fresh(), 'tower').state, 'tower', 'top/banner');
    expect(isFinished(searched, 'tower')).toBe(true);
    const read = take(visit(fresh(), 'stoneBless').state, 'stoneBless', 'scroll/learn');
    expect(isFinished(read, 'stoneBless')).toBe(true);
    const opened = take(visit(fresh(), 'chest').state, 'chest', 'keep');
    expect(isFinished(opened, 'chest')).toBe(true);
  });

  it('the old mine once its gold is taken, but not once the dwarf has opened the way to the delving', () => {
    expect(isFinished(take(visit(fresh(), 'mine').state, 'mine', 'cart/take'), 'mine')).toBe(true);
    expect(isFinished(take(visit(fresh(), 'mine').state, 'mine', 'cart/help'), 'mine')).toBe(false);
  });

  it('a place with only something to read, once it is read, but not one waiting for something to happen', () => {
    expect(isFinished(fresh(), 'diggersCamp')).toBe(false);
    expect(isFinished(visit(fresh(), 'diggersCamp').state, 'diggersCamp')).toBe(true);
    // Old Tam has nothing for you until his ewes come home, and then he thanks you.
    const fold = visit(fresh(), 'shepherd').state;
    expect(isFinished(fold, 'shepherd')).toBe(false);
    const thanked = take(visit(flagged(fold, { ewes: true }), 'shepherd').state, 'shepherd', 'home/thanks');
    expect(isFinished(thanked, 'shepherd')).toBe(true);
  });

  it('comes down when something new opens there: Mrs Pike, once you find her son\u2019s letter', () => {
    const fed = flagged(fresh(), { mrsPike: true });
    expect(isFinished(fed, 'mrsPike')).toBe(true);
    expect(isFinished(update(fed, 'letterPike', { done: true }), 'mrsPike')).toBe(false);
  });

  it('never while its guard is still over it', () => {
    const climbed = flagged(fresh(), { lonePine: true });
    expect(isFinished(climbed, 'lonePine')).toBe(false);
    expect(isFinished(update(climbed, 'spiders', { done: true }), 'lonePine')).toBe(true);
  });

  it('never at a place you can always come back to: your castle, a village, a well, the mill or a signpost', () => {
    for (const id of ['castle', 'village', 'well', 'mill', 'signpost', 'hall', 'butts']) {
      const visited = update(visit(fresh(), id).state, id, { done: true });
      expect(isFinished(visited, id), id).toBe(false);
    }
  });
});
