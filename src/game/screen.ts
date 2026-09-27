import type { Bitmap } from '../render/bitmap';
import type { InputHandlers } from './input';

/**
 * One screen of the game: the map, a battle, the court, the title. The game keeps a stack of them
 * and runs the one on top; a battle or the court opens over the map and closes back to it.
 */
export interface Screen {
  /** What scripts and music call it. */
  readonly name: string;
  /** Moves the clock on: animations, riding, the AI's turn. */
  update(dt: number, held: ReadonlySet<string>): void;
  /** The indexed frame to show, for palette tick `tick`. */
  render(tick: number): Uint8Array;
  /** The frame as last drawn, for exact screenshots. */
  readonly bitmap: Bitmap;
  /** Keeps its cards next to what they describe as the page scrolls and scales. */
  placeCards(): void;
  readonly input: InputHandlers;
  /** Takes its cards and labels off the page for good. */
  dispose(): void;
}

/** Input for a screen that only has cards. */
export const NO_INPUT: InputHandlers = { click() {}, hover() {}, drag() {}, leave() {}, key() {} };
