import type { Bitmap } from './bitmap';
import type { Rect } from './frame';
import type { Point } from '../rules/map/geometry';
import { GOLD, INK, RED, WOOD } from './palette';

/** A mark on the road ahead: gold while today's movement lasts, red for later days. */
export type RouteMark = { at: Point; today: boolean };

/**
 * Draws the road ahead into `screen`, clipped to `clip`: outlined marks every few steps, and a tent
 * where the hero will make camp tonight. `ox` and `oy` turn map pixels into screen pixels.
 */
export function drawRoute(screen: Bitmap, clip: Rect, ox: number, oy: number, route: RouteMark[], camp: Point | null) {
  const dot = (x: number, y: number, color: number) => {
    if (x >= clip.x && y >= clip.y && x < clip.x + clip.width && y < clip.y + clip.height) screen.set(x, y, color);
  };
  for (const { at: [x, y], today } of route) {
    const sx = ox + x;
    const sy = oy + y;
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) dot(sx + i, sy + j, Math.abs(i) === 2 || Math.abs(j) === 2 ? INK : today ? GOLD[6] : RED[5]);
  }
  if (!camp) return;
  const x = ox + camp[0];
  const top = oy + camp[1] - 11;
  for (let row = 0; row < 7; row++) {
    const half = Math.min(4, row);
    for (let dx = -half; dx <= half; dx++) {
      const edge = Math.abs(dx) === half || row === 6;
      dot(x + dx, top + row, edge ? INK : RED[4]);
    }
  }
  for (let row = 2; row < 6; row++) dot(x, top + row, WOOD[2]);
  for (let dx = -5; dx <= 5; dx++) dot(x + dx, top + 7, INK);
}
