/**
 * Where the battle's hexes are on the screen, apart from the drawing, so the rules of pointing at
 * them can be tested without a page.
 */
import { COLS, colOf, HEXES, rowOf } from '../rules/battle/hex';
import { MAP_VIEW } from './frame';

/** Pointy-top hexes, squashed for HoMM2's oblique view: 64 wide, rows 44 apart. */
export const HEX_W = 64;
export const ROW_H = 44;
export const HALF_H = 29;
export const FIELD_W = COLS * HEX_W + HEX_W / 2;
export const X0 = MAP_VIEW.x + (MAP_VIEW.width - FIELD_W) / 2;
export const Y0 = MAP_VIEW.y + 34;

export function hexCentre(i: number): [number, number] {
  const row = rowOf(i);
  return [X0 + HEX_W / 2 + colOf(i) * HEX_W + (row % 2 === 1 ? HEX_W / 2 : 0), Y0 + HALF_H + row * ROW_H];
}

/** Whether (x, y) falls inside the hex centred at (cx, cy). */
export function insideHex(x: number, y: number, cx: number, cy: number) {
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  return dx <= HEX_W / 2 && dy <= HALF_H - (dx / (HEX_W / 2)) * (HALF_H / 2);
}

export function hexAt(x: number, y: number): number | null {
  for (let i = 0; i < HEXES; i++) {
    const [cx, cy] = hexCentre(i);
    if (insideHex(x, y, cx, cy)) return i;
  }
  return null;
}

/** How much flatter the field's rows are than a true hex grid's, seen from HoMM2's oblique view. */
const SQUASH = ROW_H / ((HEX_W * Math.sqrt(3)) / 2);
/** How near a stack's middle a pointer is "in the middle" of it, on a true hex grid: about a third of the way out. */
const MIDDLE = HEX_W * 0.18;

/**
 * Which of `sides`, the hexes round a stack at `target` a blow could come from, a pointer at (x, y)
 * means: the one it points towards from the stack's middle, as on a true hex grid, so a pointer on
 * the stack's left strikes from its left (#211). In the middle, where it points nowhere much, a stack
 * that stands beside it already (`stand`) strikes from where it stands.
 */
export function sideAt(x: number, y: number, target: number, sides: readonly number[], stand?: number): number | null {
  if (!sides.length) return null;
  const [tx, ty] = hexCentre(target);
  if (stand !== undefined && sides.includes(stand) && Math.hypot(x - tx, (y - ty) / SQUASH) < MIDDLE) return stand;
  const away = (side: number) => {
    const [sx, sy] = hexCentre(side);
    return Math.hypot(sx - x, (sy - y) / SQUASH);
  };
  return sides.reduce((best, side) => (away(side) < away(best) ? side : best));
}
