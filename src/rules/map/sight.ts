/**
 * What the hero sees (#125). As in HoMM2, land he has seen stays explored for good (`fog.ts`). What
 * moves is the one exception: the map shows a band on the move only while he knows where it is. One
 * that moves in the night where he can't see it from his camp is out of sight (`unseen`), and gone
 * from the map, until he sees it again: within his sight as he rides or camps, or wherever the mist
 * lifts (a tower's view, Far Sight, his scouts at dawn). A hunter on his trail he sees at dawn: the
 * news says so. Bands only move at night, so one he has seen since is where he saw it.
 */
import { heroStats } from '../hero';
import type { GameState, Location } from '../state';
import { revealDisc } from './fog';
import type { Point } from './geometry';

const within = (l: Location, [x, y]: Point, radius: number) => Math.hypot(l.at[0] - x, l.at[1] - y) <= radius;

/** Bands out of sight that stand within `radius` of `at` are seen: back on the map where they stand. */
export function seeBands(state: GameState, at: Point, radius: number): GameState {
  if (!state.locations.some((l) => l.enemy?.unseen && within(l, at, radius))) return state;
  const locations = state.locations.map((l) => {
    if (!l.enemy?.unseen || !within(l, at, radius)) return l;
    const { unseen: _, ...enemy } = l.enemy;
    return { ...l, enemy };
  });
  return { ...state, locations };
}

/** What the hero sees round a point: the land, for good, and any band there. `changed` is whether any land is new. */
export function look(state: GameState, at: Point, radius: number): { state: GameState; changed: boolean } {
  const seen = revealDisc(state.explored, state.world, at[0], at[1], radius);
  return { state: seeBands({ ...state, explored: seen.bits }, at, radius), changed: seen.changed };
}

/**
 * Dawn, after the night's moves (`before` is how things stood at nightfall): a band that has moved,
 * or come out, is seen if it stands within the hero's sight of his camp or is on his trail, and is
 * out of sight if not. Bands that stayed put are as he last knew them.
 */
export function loseSight(before: GameState, after: GameState): GameState {
  const was = new Map(before.locations.map((l) => [l.id, l]));
  const sight = heroStats(after).sight;
  let changed = false;
  const locations = after.locations.map((l) => {
    const old = was.get(l.id);
    if (!l.enemy || l.done || (old && !old.done && old.at[0] === l.at[0] && old.at[1] === l.at[1])) return l;
    const unseen = !l.enemy.trailing && !within(l, after.hero.at, sight);
    if (Boolean(l.enemy.unseen) === unseen) return l;
    changed = true;
    const { unseen: _, ...enemy } = l.enemy;
    return { ...l, enemy: unseen ? { ...enemy, unseen } : enemy };
  });
  return changed ? { ...after, locations } : after;
}
