import { BACKGROUNDS, type BackgroundId } from '../content/backgrounds';
import { commissionOf, roman, type GameEvent, type GameState } from '../rules/game';

/**
 * The visitor counter (#157): GoatCounter, which sets no cookies, counts the page view and a handful of
 * milestones, so Artur can see how many people play and how far they get. Nothing personal is sent: no
 * save, no IDs, no names. A milestone sends only its name, with what GoatCounter's script sends for
 * every count: the page, where the player came from, and the screen's size, which tells a phone from a
 * desktop.
 *
 * It's off unless the build has a site code (`VITE_GOATCOUNTER_CODE`). CI gives it only to main's build,
 * the live site's, from the repository variable `GOATCOUNTER_CODE`, so the dev server, the tests, CI's
 * play-throughs and every script load nothing and send nothing.
 */
const CODE = String(import.meta.env.VITE_GOATCOUNTER_CODE ?? '').trim();

/** GoatCounter's script, pinned to a version with its hash, so a browser refuses it if it ever changes. */
const SCRIPT = { src: 'https://gc.zgo.at/count.v5.js', integrity: 'sha384-atnOLvQb9t+jTSipvd75X2yginT4PjVbqDdlJAmxMm+wYElFmeR6EmLP5bYeoRVQ' };
/** How long after the game's first frame the script loads: the first paint, on a phone, comes first. */
const AFTER_PAINT_MS = 1000;
/** The days whose dawn is a milestone. */
const DAYS = [5, 10, 20];

/** A milestone as GoatCounter lists it: an event's name (its path), and the words beside it. */
export type Milestone = { path: string; title: string };

export const NEW_CAMPAIGN: Milestone = { path: 'new-campaign', title: 'New campaign' };
export const CLOSING_CARD: Milestone = { path: 'closing-card', title: 'Closing card seen' };
export const heroChosen = (id: BackgroundId): Milestone => ({ path: `hero-${id}`, title: `Hero chosen: ${BACKGROUNDS[id].name}` });

declare global {
  interface Window {
    /** GoatCounter's script, once it's in. */
    goatcounter?: { count?: (vars: Milestone & { event: true }) => void };
  }
}

/** What's been counted this visit: each milestone counts once, so a battle won is the first one won. */
const counted = new Set<string>();
/** Milestones reached before the script is in. */
const waiting: Milestone[] = [];

const send = (m: Milestone) => window.goatcounter?.count?.({ ...m, event: true });

/** Loads GoatCounter's script a moment after the game's first frame. It counts the page view, then whatever is waiting. */
export function startCounter() {
  if (!CODE) return;
  requestAnimationFrame(() =>
    setTimeout(() => {
      const script = document.createElement('script');
      script.async = true;
      script.src = SCRIPT.src;
      script.integrity = SCRIPT.integrity;
      script.crossOrigin = 'anonymous';
      script.dataset.goatcounter = `https://${CODE}.goatcounter.com/count`;
      script.addEventListener('load', () => waiting.splice(0).forEach(send));
      document.head.append(script);
    }, AFTER_PAINT_MS),
  );
}

/** Counts a milestone, once a visit: at once if the script is in, or as soon as it is. With no site code, nothing happens. */
export function count(m: Milestone) {
  if (!CODE || counted.has(m.path)) return;
  counted.add(m.path);
  if (window.goatcounter?.count) send(m);
  else waiting.push(m);
}

/**
 * The milestones in what the rules say just happened on the map: a battle won or lost (a villain taken
 * in battle is a battle won), the dawn of day 5, 10 or 20, and a commission won (Commission I's is
 * Baron Grimsby taken).
 */
export function milestonesIn(state: GameState, events: readonly GameEvent[]): Milestone[] {
  const won = events.some((e) => e.type === 'over' && e.result === 'won');
  const found: Milestone[] = [];
  for (const e of events) {
    if (e.type === 'card' && e.card.battleResult) {
      if (e.card.title === 'Victory!' || won) found.push({ path: 'first-battle-won', title: 'First battle won' });
      else if (e.card.title === 'Defeat') found.push({ path: 'first-battle-lost', title: 'First battle lost' });
    } else if (e.type === 'day' && DAYS.includes(e.day)) found.push({ path: `day-${e.day}`, title: `Day ${e.day} reached` });
    else if (e.type === 'over' && e.result === 'won') {
      const n = state.campaign.chapter + 1;
      found.push({ path: `commission-${n}-won`, title: `Commission ${roman(n)} won: ${commissionOf(state).villain} taken` });
    }
  }
  return found;
}

/** Counts the milestones in what the rules say just happened on the map. */
export const countEvents = (state: GameState, events: readonly GameEvent[]) => milestonesIn(state, events).forEach(count);
