import { Bitmap } from './bitmap';
import { noise, shade } from './noise';
import { GOLD, INK, STONE, WOOD } from './palette';

export type Rect = { x: number; y: number; width: number; height: number };

export const SCREEN = { width: 640, height: 480 };
export const MAP_VIEW: Rect = { x: 16, y: 16, width: 448, height: 448 };
export const MINIMAP: Rect = { x: 480, y: 16, width: 144, height: 144 };
export const HERO_BOX: Rect = { x: 480, y: 176, width: 144, height: 60 };
export const BUTTONS: Rect = { x: 480, y: 252, width: 144, height: 64 };
export const STATUS: Rect = { x: 480, y: 332, width: 144, height: 132 };

/** A carved gold moulding drawn just outside a rectangle: lit from the top left. */
export function trim(screen: Bitmap, { x, y, width, height }: Rect) {
  const ring = (d: number, light: number, dark: number) => {
    for (let i = x - d; i < x + width + d; i++) {
      screen.set(i, y - d, light);
      screen.set(i, y + height - 1 + d, dark);
    }
    for (let j = y - d; j < y + height + d; j++) {
      screen.set(x - d, j, light);
      screen.set(x + width - 1 + d, j, dark);
    }
  };
  ring(1, INK, INK);
  ring(2, GOLD[2], GOLD[5]);
  ring(3, GOLD[4], GOLD[3]);
  ring(4, GOLD[6], GOLD[1]);
  ring(5, INK, INK);
}

/** Raised stone button with a bevel. */
export function button({ x, y, width, height }: Rect, screen: Bitmap) {
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const edge = i === 0 || j === 0 ? 7 : i === width - 1 || j === height - 1 ? 0 : -1;
      const level = edge >= 0 ? edge / 7 : 0.45 + (noise((x + i) / 4, (y + j) / 4, 41) - 0.5) * 0.3 - j * 0.004;
      screen.set(x + i, y + j, edge === 7 ? STONE[6] : edge === 0 ? INK : shade(STONE, level, x + i, y + j));
    }
  }
}

/** Paints the static interface: carved wood around everything, gold trims and the panel boxes. */
export function paintFrame(screen: Bitmap) {
  for (let y = 0; y < screen.height; y++) {
    for (let x = 0; x < screen.width; x++) {
      const plank = Math.floor((x + 3) / 26);
      const seam = (x + 3) % 26 === 0;
      const grain = noise(x / 2.5, y / 34 + plank * 7.3, 31) * 0.55 + noise(x / 1.2, y / 8, 32) * 0.25;
      screen.set(x, y, seam ? WOOD[0] : shade(WOOD, 0.12 + grain * 0.62, x, y));
    }
  }
  // Outer bevel of the whole screen.
  for (let x = 0; x < screen.width; x++) {
    screen.set(x, 0, GOLD[4]);
    screen.set(x, 1, GOLD[2]);
    screen.set(x, screen.height - 1, INK);
    screen.set(x, screen.height - 2, GOLD[1]);
  }
  for (let y = 0; y < screen.height; y++) {
    screen.set(0, y, GOLD[4]);
    screen.set(1, y, GOLD[2]);
    screen.set(screen.width - 1, y, INK);
    screen.set(screen.width - 2, y, GOLD[1]);
  }
  for (const rect of [MAP_VIEW, MINIMAP, HERO_BOX, BUTTONS, STATUS]) trim(screen, rect);
  screen.fill(HERO_BOX.x, HERO_BOX.y, HERO_BOX.width, HERO_BOX.height, WOOD[0]);
  screen.fill(STATUS.x, STATUS.y, STATUS.width, STATUS.height, WOOD[0]);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      button({ x: BUTTONS.x + col * 36, y: BUTTONS.y + row * 32, width: 36, height: 32 }, screen);
    }
  }
}
