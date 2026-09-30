/**
 * The odds worker (see `odds.ts`): works out the sergeants' odds for the bands on the map off the
 * page's thread, one band at a time, and sends each back as soon as it's done. A newer state takes
 * over from the last between bands.
 */
import { oddsFor, type Odds } from '../rules/fight';
import type { GameState } from '../rules/state';

type Job = { state: GameState; ids: string[] };
const scope = self as unknown as { onmessage: ((e: MessageEvent<Job>) => void) | null; postMessage(odds: Odds): void };

let job: Job | null = null;
let busy = false;

function next() {
  const id = job?.ids.shift();
  if (!job || id === undefined) {
    busy = false;
    return;
  }
  try {
    const odds = oddsFor(job.state, id);
    if (odds) scope.postMessage(odds);
  } catch {
    // The page works these odds out itself when they're asked for.
  }
  setTimeout(next);
}

scope.onmessage = (e) => {
  job = { state: e.data.state, ids: [...e.data.ids] };
  if (busy) return;
  busy = true;
  next();
};
