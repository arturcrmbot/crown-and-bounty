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

/** How much of the mist lifts round a hunter on the hero's trail, so he can see it coming. */
export const SPOTTED = 48;

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
 * Dawn, after the night's moves (`before` is how things stood at nightfall): the mist has lifted round
 * every hunter on the hero's trail, as the news says, and whatever stands there is seen, moved or
 * not. Otherwise a band that has moved, or come out, is seen if it stands within the hero's sight of
 * his camp, and is out of sight if not; one that stayed put is as he last knew it.
 */
export function loseSight(before: GameState, after: GameState): GameState {
  const was = new Map(before.locations.map((l) => [l.id, l]));
  const sight = heroStats(after).sight;
  const trails = after.locations.filter((l) => l.enemy?.trailing && !l.done).map((l) => l.at);
  let changed = false;
  const locations = after.locations.map((l) => {
    if (!l.enemy || l.done) return l;
    const old = was.get(l.id);
    const moved = !old || old.done || old.at[0] !== l.at[0] || old.at[1] !== l.at[1];
    const spotted = trails.some((at) => within(l, at, SPOTTED));
    const unseen = spotted ? false : moved ? !within(l, after.hero.at, sight) : Boolean(l.enemy.unseen);
    if (Boolean(l.enemy.unseen) === unseen) return l;
    changed = true;
    const { unseen: _, ...enemy } = l.enemy;
    return { ...l, enemy: unseen ? { ...enemy, unseen } : enemy };
  });
  return changed ? { ...after, locations } : after;
}
