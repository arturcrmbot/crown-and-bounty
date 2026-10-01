/**
 * The numbers behind the battle's juice (#190): how long a blow holds the field still as it lands,
 * which way and how far it kicks the field, and how a stack's count rolls down. Pure, so the
 * controller and the screen share them and the tests can pin them down.
 */

/** What a blow did, for how hard it lands on the screen. */
export type Blow = { killed: number; charge?: boolean; lucky?: boolean; wiped?: boolean };

/** One frame at 30 frames a second, the beat the holds are counted in. */
export const FRAME = 1 / 30;

/**
 * Frames a blow holds still as it lands (the hit-stop): 2 for a scratch, 3 when someone dies, 4 for
 * a lucky blow, 5 for a charge or a stack wiped out. Gentle effects hold any blow for 1.
 */
export function holdFrames(b: Blow, gentle = false): number {
  if (gentle) return 1;
  if (b.charge || b.wiped) return 5;
  if (b.lucky) return 4;
  return b.killed > 0 ? 3 : 2;
}

/**
 * How far the field is kicked the way the blow goes, in pixels: 2 for a scratch, 3 when someone
 * dies or a blow is lucky, 5 for a charge or a stack wiped out. The field is seen from above at a
 * slant, so a kick up or down the screen is a little shorter. Gentle effects don't kick.
 */
export function kickOf(heading: readonly [number, number], b: Blow, gentle = false): [number, number] {
  if (gentle) return [0, 0];
  const px = b.charge || b.wiped ? 5 : b.killed > 0 || b.lucky ? 3 : 2;
  const n = Math.hypot(heading[0], heading[1]) || 1;
  return [(heading[0] / n) * px, (heading[1] / n) * px * 0.6];
}

/** How much of a kick is left after `dt` seconds: it springs back, most of the way in a tenth of a second. */
export const KICK_BACK = 18;
export function kickLeft(kick: readonly [number, number], dt: number): [number, number] {
  const k = Math.exp(-dt * KICK_BACK);
  const [x, y] = [kick[0] * k, kick[1] * k];
  return Math.abs(x) < 0.2 && Math.abs(y) < 0.2 ? [0, 0] : [x, y];
}

/** Seconds a stack's count takes to roll down to its new number. */
export const ROLL = 4 * FRAME;

/** The count a badge shows `t` seconds into rolling from `from` down (or up) to `to`. */
export function rolled(from: number, to: number, t: number): number {
  if (t >= ROLL) return to;
  return Math.round(from + ((to - from) * Math.max(0, t)) / ROLL);
}

/** How big a number is drawn `age` seconds after it popped: large at first, settling to its size in three frames. */
export function popScale(age: number): number {
  const frame = Math.floor(age / FRAME);
  return frame <= 0 ? 1.6 : frame === 1 ? 1.3 : frame === 2 ? 1.1 : 1;
}

/** How long a popped number lasts, how long it holds before it rises, how far it rises, and how long it takes to fade. */
export const POP_LIFE = 1.25;
export const POP_HOLD = 0.35;
export const POP_RISE = 20;
export const POP_FADE = 0.3;

/** How far a popped number has risen `age` seconds in. */
export function popRise(age: number): number {
  return age <= POP_HOLD ? 0 : Math.min(POP_RISE, ((age - POP_HOLD) / (POP_LIFE - POP_HOLD - POP_FADE / 2)) * POP_RISE);
}

/** How much of a popped number still shows (1 to 0), as it dithers away at the end. */
export function popShown(age: number): number {
  return Math.max(0, Math.min(1, (POP_LIFE - age) / POP_FADE));
}
