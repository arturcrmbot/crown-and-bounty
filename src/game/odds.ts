/**
 * The sergeants' odds for every band on the map, worked out ahead of time in a worker, nearest band
 * first, so a hover or a tap on one finds its verdict ready at once. Each takes a few simulated
 * fights, too slow to work out while a finger waits. Until the worker gets to a band (or where there's
 * no worker), the rules work its odds out when they're asked for, as they always have.
 */
import { learnOdds, oddsKnown, type GameState, type Odds } from '../rules/game';
import OddsWorker from './oddsWorker?worker';

let worker: Worker | null | undefined;
let asked: GameState | null = null;

function started(): Worker | null {
  if (worker !== undefined) return worker;
  worker = null;
  if (typeof Worker === 'undefined') return null;
  try {
    const w = new OddsWorker();
    w.onmessage = (e: MessageEvent<Odds>) => learnOdds(e.data);
    w.onerror = () => {
      w.terminate();
      worker = null;
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

/** Sends the worker off after the odds not yet known for the bands still to fight, as things stand, nearest the hero first. */
export function oddsAhead(state: GameState) {
  if (state === asked) return;
  asked = state;
  if (!state.army.length || state.over || state.opening) return;
  const [x, y] = state.hero.at;
  const away = (at: readonly [number, number]) => Math.hypot(at[0] - x, at[1] - y);
  const ids = state.locations
    .filter((l) => l.enemy && !l.done && !oddsKnown(state, l.id))
    .sort((a, b) => away(a.at) - away(b.at))
    .map((l) => l.id);
  if (ids.length) started()?.postMessage({ state, ids });
}
