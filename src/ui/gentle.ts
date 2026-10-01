/**
 * Gentle effects (#190): in battle, no kick or shake, no white flash, a blow barely held and no
 * flash of the whole field, for players who are sensitive to motion or flashing light. It's
 * remembered like the sound's mute, and starts on when the device asks for reduced motion.
 */
const KEY = 'kings-commission/gentle';

/** Whether effects are gentle, from what was stored ('1', '0' or nothing yet) and the device's wish for reduced motion. */
export function gentleFrom(stored: string | null, reducedMotion: boolean): boolean {
  return stored === null ? reducedMotion : stored === '1';
}

let gentle: boolean | null = null;

export function isGentle(): boolean {
  if (gentle === null) {
    let stored: string | null = null;
    try {
      stored = globalThis.localStorage?.getItem(KEY) ?? null;
    } catch {
      // Storage refused (a private window): the device's wish decides.
    }
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    gentle = gentleFrom(stored, reduced);
  }
  return gentle;
}

export function setGentle(on: boolean) {
  gentle = on;
  try {
    globalThis.localStorage?.setItem(KEY, on ? '1' : '0');
  } catch {
    // Storage refused: it lasts the visit.
  }
}
