/**
 * Whether the game is played by touch: a phone or a tablet, whose main pointer is a finger. Then
 * the page gets `kc-touch` on its root, buttons down both sides (`rail.ts`), bigger things to tap,
 * and, held upright, a card asking for the phone to be turned sideways (`turn.ts`). A mouse, even on
 * a touch screen, keeps the game as it always was. `?touch=1` (or `0`) says which, for checking.
 */
import './touch.css';

// Outside a page (the unit tests) there's no touch, and nothing to mark.
const page = typeof window !== 'undefined' && typeof matchMedia === 'function';
const coarse = page ? matchMedia('(pointer: coarse)') : null;
const portrait = page ? matchMedia('(orientation: portrait)') : null;
const asked = page ? new URLSearchParams(window.location.search).get('touch') : null;
const forced = asked === '1' ? true : asked === '0' ? false : null;

export const touch = () => forced ?? coarse?.matches ?? false;
/** A touch screen held upright: the game waits for it to be turned sideways. */
export const upright = () => touch() && Boolean(portrait?.matches);
/** How wide a strip each side of the picture keeps for the rails' buttons, played by touch (CSS pixels). */
export const SIDE = 56;

const watchers: (() => void)[] = [];
/** Calls `f` whenever touch or the way the screen is held changes. */
export const whenTouchChanges = (f: () => void) => watchers.push(f);

function mark() {
  document.documentElement.classList.toggle('kc-touch', touch());
  document.documentElement.classList.toggle('kc-upright', upright());
  for (const f of watchers) f();
}
if (page) {
  mark();
  coarse!.addEventListener('change', mark);
  portrait!.addEventListener('change', mark);
  // Safari lets a pinch zoom the page whatever the viewport says: not in a game played by touch.
  document.addEventListener('gesturestart', (e) => touch() && e.preventDefault());
}
