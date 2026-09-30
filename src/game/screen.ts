import type { AmbienceId } from '../audio/ambience';
import type { TrackId } from '../audio/score';
import type { Bitmap } from '../render/bitmap';
import type { RailIcon } from '../ui/rail';
import type { InputHandlers } from './input';

/**
 * A button down the side of the picture, played by touch (`ui/rail.ts`): what a key does on the
 * keyboard, a finger can press there.
 */
export type SideButton = {
  id: string;
  label: string;
  /** Its picture, drawn in code (`ui/rail.ts`). */
  icon: RailIcon;
  side: 'left' | 'right';
  /** Greyed out while it would do nothing. */
  enabled: boolean;
  /** Lit while what it works is on or open: the minimap out, the hero screen open, the sergeants in command. */
  on?: boolean;
  press(): void;
};

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
  /** The music and the sound of the place, while this screen is on top. */
  readonly music?: TrackId | null;
  readonly ambience?: AmbienceId | null;
  /**
   * Its buttons down the sides, played by touch; Sound and Full screen are always there. Null if it
   * takes the whole window, the rails and all (the hero screen).
   */
  buttons?(): SideButton[] | null;
}

/** Input for a screen that only has cards. */
export const NO_INPUT: InputHandlers = { click() {}, hover() {}, drag() {}, leave() {}, key() {} };
