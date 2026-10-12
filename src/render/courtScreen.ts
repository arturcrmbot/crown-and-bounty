import type { BackgroundId } from '../content/backgrounds';
import { Bitmap, blit, outline, SHADOW } from './bitmap';
import { BAR, MAP_VIEW, paintFrame, SCREEN } from './frame';
import { bayer, hash, noise, shade } from './noise';
import { BLUE, CYCLE_FIRE, EARTH, GOLD, INK, LEAF, LIGHT_LUT, NEUTRAL, PARCHMENT, RED, ROCK, SHADOW_LUT, SKIN, STONE, WOOD } from './palette';
import { drawText } from './text';

/** Where the wall meets the floor, and where the lines of the floor meet, in room pixels. */
const WALL_FOOT = 252;
const VANISH: [number, number] = [464, 128];
const MID = MAP_VIEW.width / 2;

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/** A room-sized bitmap painted in room coordinates (0, 0 is the map view's top left). */
class Room {
  readonly bitmap = new Bitmap(SCREEN.width, SCREEN.height);
  get(x: number, y: number) {
    return this.bitmap.get(MAP_VIEW.x + x, MAP_VIEW.y + y);
  }
  set(x: number, y: number, c: number) {
    if (x >= 0 && y >= 0 && x < MAP_VIEW.width && y < MAP_VIEW.height) this.bitmap.set(MAP_VIEW.x + x, MAP_VIEW.y + y, c);
  }
  /** Darkens (or lights) a pixel through a lookup table, on a dither pattern of `share` of the pixels. */
  tint(x: number, y: number, lut: Uint8Array, share: number) {
    if (bayer(x, y) < share) this.set(x, y, lut[this.get(x, y)]);
  }
}

function wall(room: Room) {
  for (let y = 0; y < WALL_FOOT; y++) {
    const row = Math.floor(y / 22);
    const shift = (row % 2) * 26;
    for (let x = 0; x < MAP_VIEW.width; x++) {
      const col = Math.floor((x + shift) / 52);
      const mortar = y % 22 === 0 || (x + shift) % 52 === 0;
      let level = 0.42 + (hash(col, row, 31) - 0.5) * 0.16 + (noise(x / 9, y / 9, 32) - 0.5) * 0.14;
      level -= (1 - y / WALL_FOOT) * 0.22;
      if (mortar) level -= 0.2;
      else if (y % 22 === 1 || (x + shift) % 52 === 1) level += 0.08;
      room.set(x, y, shade(STONE, level, x, y));
    }
  }
  // A skirting of darker stone where the wall meets the floor.
  for (let y = WALL_FOOT - 10; y < WALL_FOOT; y++) for (let x = 0; x < MAP_VIEW.width; x++) room.set(x, y, shade(STONE, 0.26 + (y - WALL_FOOT + 10) * 0.012, x, y));
}

function pillar(room: Room, cx: number) {
  const half = 24;
  for (let y = 0; y < WALL_FOOT + 6; y++) {
    for (let x = cx - half; x < cx + half; x++) {
      const u = (x - cx) / half;
      const lit = 0.5 - u * 0.28 + Math.sqrt(1 - u * u) * 0.12 + (noise(x / 5, y / 14, 41) - 0.5) * 0.08;
      const band = y % 60 < 3 ? -0.18 : 0;
      room.set(x, y, shade(STONE, lit + band - (1 - y / WALL_FOOT) * 0.18, x, y));
    }
  }
  // Base block.
  for (let y = WALL_FOOT - 18; y < WALL_FOOT + 8; y++) for (let x = cx - half - 5; x < cx + half + 5; x++) room.set(x, y, shade(STONE, y < WALL_FOOT - 15 ? 0.66 : 0.4 - (x - cx) / 200, x, y));
}

function windowPane(room: Room, cx: number) {
  const [top, bottom, half] = [40, 178, 30];
  const inside = (x: number, y: number, grow: number) => Math.abs(x - cx) <= half + grow && y <= bottom + grow && (y >= top + half || Math.hypot(x - cx, y - (top + half)) <= half + grow);
  for (let y = top - 8; y <= bottom + 8; y++) {
    for (let x = cx - half - 8; x <= cx + half + 8; x++) {
      if (inside(x, y, 0)) {
        const lead = (x - cx + 60) % 15 === 0 || (y - top + 60) % 15 === 0;
        const sky = (y - top) / (bottom - top);
        room.set(x, y, lead ? STONE[1] : sky < 0.35 ? NEUTRAL[7] : sky < 0.7 ? BLUE[6] : BLUE[5]);
      } else if (inside(x, y, 6)) room.set(x, y, shade(STONE, x < cx ? 0.72 : 0.5, x, y));
    }
  }
  // Sill.
  for (let x = cx - half - 10; x <= cx + half + 10; x++) for (let y = bottom + 6; y < bottom + 11; y++) room.set(x, y, shade(STONE, y === bottom + 6 ? 0.8 : 0.45, x, y));
}

/** A long red banner with a gold border, a gold crown and a swallowtail. */
function banner(room: Room, cx: number) {
  const [top, bottom, half] = [8, 196, 26];
  for (let y = top; y < bottom; y++) {
    for (let x = cx - half; x < cx + half; x++) {
      const notch = bottom - 22 + Math.abs(x - cx) * (22 / half);
      if (y > notch) continue;
      const fold = Math.sin((x - cx) / 5.5) * 0.12;
      const edge = x < cx - half + 4 || x >= cx + half - 4 || y > notch - 4;
      const crown = crownAt(x - cx, y - 96);
      room.set(x, y, edge || crown ? shade(GOLD, 0.55 + fold, x, y) : shade(RED, 0.5 + fold - (y - top) * 0.0008, x, y));
    }
  }
  // The rod it hangs from.
  for (let x = cx - half - 6; x < cx + half + 6; x++) for (let y = top - 3; y < top; y++) room.set(x, y, y === top - 3 ? GOLD[6] : GOLD[3]);
}

/** A little crown shape, centred on (0, 0). */
function crownAt(x: number, y: number): boolean {
  if (y >= 4 && y < 10 && Math.abs(x) <= 11) return true;
  if (y < -8 || y >= 4 || Math.abs(x) > 11) return false;
  const spike = Math.abs(((x + 11) % 11) - 5.5);
  return y >= -8 + spike * 1.6 - 1;
}

function torch(room: Room, cx: number, cy: number) {
  // A warm glow on the stone around it.
  for (let y = cy - 70; y < cy + 70; y++) {
    for (let x = cx - 70; x < cx + 70; x++) {
      const d = Math.hypot(x - cx, (y - cy) * 1.2) / 70;
      if (d < 1 && y < WALL_FOOT) room.tint(x, y, LIGHT_LUT, (1 - d) * 0.8);
    }
  }
  // Iron bracket and wooden handle.
  for (let y = cy; y < cy + 26; y++) for (let x = cx - 2; x <= cx + 2; x++) room.set(x, y, x === cx - 2 ? WOOD[4] : WOOD[2]);
  for (let x = cx - 7; x <= cx + 7; x++) room.set(x, cy + 18, INK);
  for (let x = cx - 5; x <= cx + 5; x++) room.set(x, cy, STONE[2]);
  // The flame: palette-cycling colours, hotter at the core.
  for (let y = cy - 22; y < cy; y++) {
    for (let x = cx - 7; x <= cx + 7; x++) {
      const h = (cy - y) / 22;
      const w = 6.5 * Math.sin(Math.PI * Math.min(1, 0.25 + h * 0.85)) * (1 - h * 0.35);
      if (Math.abs(x - cx) > w) continue;
      const core = Math.abs(x - cx) < w * 0.45 && h < 0.6;
      room.set(x, y, CYCLE_FIRE[(Math.floor(h * 6) + (core ? 0 : 2) + (x & 1)) % CYCLE_FIRE.length]);
    }
  }
}

/** Perspective flagstones, a red carpet up the middle, and window light across the floor. */
function floor(room: Room) {
  for (let y = WALL_FOOT; y < MAP_VIEW.height; y++) {
    const depth = 2600 / (y - VANISH[1]);
    for (let x = 0; x < MAP_VIEW.width; x++) {
      const across = ((x - VANISH[0]) / (y - VANISH[1])) * 5.2;
      const row = Math.floor(depth / 2.2);
      const col = Math.floor(across + (row % 2) * 0.5);
      const grout = depth / 2.2 - row < 0.07 || across + (row % 2) * 0.5 - col < 0.035 * (y / 200);
      const carpet = Math.abs(across) < 1.35;
      let c: number;
      if (carpet) {
        const trim = Math.abs(across) > 1.12;
        const diamond = Math.abs(across) + Math.abs(((depth * 0.9) % 2) - 1) * 0.9 < 0.45;
        c = trim ? shade(GOLD, 0.5, x, y) : diamond ? shade(GOLD, 0.35, x, y) : shade(RED, 0.4 + (noise(x / 3, y / 3, 12) - 0.5) * 0.15 + (y - WALL_FOOT) * 0.0006, x, y);
      } else {
        const tone = (row + col) % 2 === 0 ? 0.5 : 0.38;
        c = shade(STONE, (grout ? 0.18 : tone) + (hash(row, col, 7) - 0.5) * 0.08 + (noise(x / 6, y / 6, 8) - 0.5) * 0.08 - (1 - (y - WALL_FOOT) / 212) * 0.1, x, y);
      }
      room.set(x, y, c);
    }
  }
  // Window light: long pale slants across the floor.
  for (const cx of [250, 678]) {
    for (let y = WALL_FOOT; y < MAP_VIEW.height; y++) {
      const t = (y - WALL_FOOT) / 212;
      const left = cx + 20 + t * 150;
      for (let x = Math.floor(left - 36 - t * 30); x < left + 36 + t * 30; x++) room.tint(x, y, LIGHT_LUT, 0.55 - t * 0.25);
    }
  }
}

/** The dais: three steps, carpeted up the middle. */
function dais(room: Room) {
  for (let step = 0; step < 3; step++) {
    const top = 200 + step * 16;
    const half = 120 + step * 36;
    for (let y = top; y < top + 16; y++) {
      for (let x = MID - half; x < MID + half; x++) {
        const tread = y < top + 5;
        const carpet = Math.abs(x - MID) < 46 + step * 3;
        const c = carpet ? (Math.abs(x - MID) > 40 + step * 3 ? GOLD[tread ? 5 : 3] : RED[tread ? 4 : 2]) : shade(STONE, tread ? 0.72 : 0.44 - (x - MID) / 900, x, y);
        room.set(x, y, c);
      }
    }
  }
}

function throne(room: Room) {
  const [top, bottom, half] = [74, 204, 44];
  for (let y = top - 22; y < bottom; y++) {
    for (let x = MID - half - 8; x < MID + half + 8; x++) {
      const dx = Math.abs(x - MID);
      const spire = y < top && dx <= (y - (top - 22)) * 1.6 && dx < 18;
      const back = y >= top && dx <= half;
      const arm = y >= 164 && y < 180 && dx <= half + 8;
      if (!spire && !back && !arm) continue;
      const velvet = y >= top + 14 && y < 176 && dx <= half - 10;
      const lit = 0.62 - (x - MID) / 140 + (y < top + 4 ? 0.2 : 0);
      room.set(x, y, velvet ? shade(RED, 0.42 - dx / 300, x, y) : shade(GOLD, lit, x, y));
    }
  }
  // Gold finial on the spire.
  for (let y = top - 30; y < top - 20; y++) for (let x = MID - 4; x <= MID + 4; x++) if (inEllipse(x, y, MID, top - 25, 4, 5)) room.set(x, y, x < MID ? GOLD[6] : GOLD[4]);
}

/** Good King Osric: portly, bearded, with the sceptre in one hand. */
function king(blink: boolean): Bitmap {
  const room = new Bitmap(96, 144);
  const [cx, cy] = [48, 100];
  // The robe hangs from his shoulders over his seated knees.
  for (let y = cy - 40; y < cy + 36; y++) {
    for (let x = cx - 40; x < cx + 40; x++) {
      const dy = y - cy;
      const half = dy < -14 ? 22 + (dy + 40) * 0.35 : dy < 5 ? 31 - (dy + 14) * 0.12 : 29 - (dy - 5) * 0.18;
      if (Math.abs(x - cx) > half || dy > 32) continue;
      const folds = Math.sin((x - cx) / 5 + Math.max(0, dy) * 0.06) * 0.09;
      const lap = inEllipse(x, y, cx - 14, cy + 16, 12, 15) ? 0.1 : inEllipse(x, y, cx + 13, cy + 16, 11, 15) ? -0.08 : 0;
      room.set(x, y, shade(RED, 0.55 + folds + lap - (x - cx) / 110 - dy / 240, x, y));
    }
  }
  const ermine = (x: number, y: number) => room.set(x, y, x % 9 < 2 && y % 12 > 7 ? INK : shade([NEUTRAL[4], NEUTRAL[5], NEUTRAL[6], NEUTRAL[7]], 0.82 - (x - cx) / 100, x, y));
  for (let y = cy - 38; y < cy - 20; y++) for (let x = cx - 34; x < cx + 34; x++) if (inEllipse(x, y, cx, cy - 29, 29, 8)) ermine(x, y);
  for (let y = cy - 20; y < cy + 32; y++) {
    const centre = cx + Math.max(0, y - cy) * 0.1;
    for (let x = Math.floor(centre - 5); x <= centre + 5; x++) ermine(x, y);
    room.set(Math.floor(centre - 6), y, GOLD[3]);
    room.set(Math.floor(centre + 6), y, GOLD[2]);
  }
  for (const [ax, ay, bx, by] of [[cx - 22, cy - 22, cx - 28, cy + 2], [cx + 22, cy - 22, cx + 30, cy + 6]]) {
    for (let t = 0; t <= 1; t += 0.02) {
      const [x0, y0] = [ax + (bx - ax) * t, ay + (by - ay) * t];
      for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) if (x * x + y * y <= 40) room.set(Math.round(x0 + x), Math.round(y0 + y), shade(RED, 0.5 - x / 24 - (x0 - cx) / 140 + (t > 0.6 ? -0.09 : 0), Math.round(x0 + x), Math.round(y0 + y)));
    }
  }
  for (const [x0, y0] of [[cx - 29, cy - 2], [cx + 29, cy + 3]]) {
    for (let y = y0 - 3; y < y0 + 3; y++) for (let x = x0 - 6; x <= x0 + 6; x++) if (inEllipse(x, y, x0, y0, 6, 3)) ermine(x, y);
  }
  // Head: a round, kindly face over a great white beard, under the crown.
  const [hx, hy] = [cx, cy - 52];
  for (const ex of [hx - 12, hx + 12]) for (let y = hy - 3; y < hy + 5; y++) for (let x = ex - 2; x <= ex + 2; x++) if (inEllipse(x, y, ex, hy + 1, 2, 4)) room.set(x, y, ex < hx ? SKIN[3] : SKIN[2]);
  for (let y = hy - 14; y < hy + 14; y++) for (let x = hx - 14; x < hx + 14; x++) if (inEllipse(x, y, hx, hy, 12.5, 13.5)) room.set(x, y, shade(SKIN, 0.72 - (x - hx) / 40, x, y));
  for (let y = hy + 1; y < hy + 32; y++) {
    for (let x = hx - 15; x < hx + 16; x++) {
      if (!inEllipse(x, y, hx, hy + 13, 13.5 - Math.max(0, y - hy - 19) * 0.55, 17)) continue;
      if (y < hy + 6 && Math.abs(x - hx) < 5) continue;
      const locks = Math.sin((x - hx) * 0.7 + (y - hy) * 0.25) * 0.1;
      room.set(x, y, shade([NEUTRAL[4], NEUTRAL[5], NEUTRAL[6], NEUTRAL[7]], 0.77 + locks - (x - hx) / 60 - (y - hy) / 180, x, y));
    }
  }
  for (const dx of [-5, 4]) {
    room.set(hx + dx - 1, hy - 2, blink ? SKIN[2] : NEUTRAL[7]);
    room.set(hx + dx, hy - 2, blink ? SKIN[2] : BLUE[3]);
    room.set(hx + dx, hy - 1, blink ? SKIN[3] : INK);
    for (let x = hx + dx - 2; x <= hx + dx + 2; x++) room.set(x, hy - 5, NEUTRAL[7]);
    room.set(hx + dx + (dx < 0 ? -3 : 3), hy + 3, RED[5]);
    room.set(hx + dx + (dx < 0 ? -2 : 2), hy + 3, SKIN[3]);
  }
  room.set(hx, hy, SKIN[4]);
  room.set(hx + 1, hy + 1, SKIN[2]);
  room.set(hx, hy + 2, SKIN[4]);
  room.set(hx + 1, hy + 3, SKIN[1]);
  room.set(hx, hy + 6, RED[2]);
  for (let x = hx - 6; x <= hx + 6; x++) room.set(x, hy + 5, x === hx - 6 || x === hx + 6 ? NEUTRAL[6] : NEUTRAL[7]);
  for (let y = hy - 27; y < hy - 10; y++) {
    for (let x = hx - 14; x <= hx + 14; x++) {
      if (!crownAt((x - hx) * 0.85, (y - (hy - 19)) * 1.05)) continue;
      room.set(x, y, shade(GOLD, 0.78 - (x - hx) / 45 - (y - hy + 20) / 70, x, y));
    }
  }
  for (const dx of [-7, 0, 7]) {
    room.set(hx + dx, hy - 15, dx === 0 ? RED[4] : BLUE[4]);
    room.set(hx + dx, hy - 16, NEUTRAL[7]);
  }
  // Hands, and the sceptre with a gold orb.
  for (const [x0, y0] of [[cx - 33, cy - 2], [cx + 26, cy + 4]]) for (let y = y0; y < y0 + 8; y++) for (let x = x0; x < x0 + 9; x++) if (inEllipse(x, y, x0 + 4.5, y0 + 4, 4.5, 4)) room.set(x, y, shade(SKIN, 0.7, x, y));
  for (const [x0, y0] of [[cx - 31, cy + 4], [cx + 28, cy + 9]]) for (let x = x0; x < x0 + 6; x += 2) room.set(x, y0, SKIN[2]);
  for (let y = cy - 62; y < cy + 12; y++) room.set(cx - 29, y, GOLD[5]), room.set(cx - 28, y, GOLD[3]);
  for (let y = cy - 74; y < cy - 60; y++) for (let x = cx - 35; x < cx - 22; x++) if (inEllipse(x, y, cx - 28.5, cy - 67, 5.5, 5.5)) room.set(x, y, x < cx - 29 ? GOLD[6] : GOLD[4]);
  room.set(cx - 29, cy - 69, NEUTRAL[7]);
  for (let x = cx - 24; x <= cx + 24; x++) room.set(x, cy + 31 - Math.round(((x - cx) / 24) ** 2 * 2), GOLD[x < cx ? 4 : 2]);
  for (const x0 of [cx - 18, cx + 7]) for (let y = cy + 32; y < cy + 37; y++) for (let x = x0; x < x0 + 12; x++) if (y > cy + 33 || x < x0 + 9) room.set(x, y, y === cy + 32 ? RED[2] : EARTH[1]);
  return outline(room, INK);
}

/** A royal guard with a halberd, facing the carpet. */
function guard(facing: 1 | -1): Bitmap {
  const s = new Bitmap(44, 102);
  const cx = 22;
  for (const side of [-1, 1]) {
    for (let y = 65; y < 95; y++) for (let x = cx + side * 5 - 3; x <= cx + side * 5 + 3; x++) s.set(x, y, shade(STONE, 0.56 - (x - cx - side * 5) / 12 - (y % 12 < 2 ? 0.2 : 0), x, y));
    for (let y = 94; y < 100; y++) for (let x = cx + side * 5 - 4; x <= cx + side * 5 + 4; x++) s.set(x, y, y === 94 ? EARTH[3] : EARTH[0]);
    for (let y = 39; y < 66; y++) {
      const ax = cx + side * (11 - (y - 39) * 0.08);
      for (let x = Math.floor(ax - 3); x <= ax + 3; x++) s.set(x, y, (x + y) % 3 === 0 ? STONE[5] : STONE[2]);
    }
  }
  for (let y = 37; y < 77; y++) for (let x = cx - 11; x <= cx + 11; x++) {
    const half = y < 53 ? 10 - (y - 37) * 0.18 : 7 + (y - 53) * 0.1;
    if (Math.abs(x - cx) > half || (y > 71 && Math.abs(x - cx) < 1)) continue;
    const trim = Math.abs(x - cx) > half - 1.3 || y === 75;
    s.set(x, y, trim ? GOLD[3] : shade(BLUE, 0.58 - (x - cx) / 32 + Math.sin((x - cx) * 0.8) * 0.08, x, y));
    if (crownAt((x - cx) * 2.5, (y - 51) * 2.5)) s.set(x, y, GOLD[5]);
  }
  s.fill(cx - 8, 64, 17, 3, EARTH[1]);
  s.fill(cx - 1, 64, 3, 3, GOLD[5]);
  for (const px of [cx - 9, cx + 9]) for (let y = 34; y < 43; y++) for (let x = px - 4; x <= px + 4; x++) if (inEllipse(x, y, px, 38, 4, 4)) s.set(x, y, shade(STONE, 0.75 - (x - px) / 14 - (y - 34) / 24, x, y));
  for (let y = 22; y < 39; y++) for (let x = cx - 7; x <= cx + 7; x++) if (inEllipse(x, y, cx, 30, 6, 8.5)) s.set(x, y, y < 29 ? shade(STONE, 0.8 - (x - cx) / 20, x, y) : shade(SKIN, 0.72 - (x - cx) / 20, x, y));
  s.fill(cx - 8, 28, 17, 2, STONE[4]);
  for (let y = 23; y < 28; y++) s.set(cx - 1, y, STONE[7]);
  s.set(cx + facing * 3, 32, INK);
  s.set(cx + facing * 6, 34, SKIN[3]);
  s.set(cx + facing * 3, 37, SKIN[1]);
  const pole = cx + facing * 13;
  for (let y = 2; y < 99; y++) s.set(pole, y, WOOD[4]), s.set(pole + 1, y, WOOD[1]);
  for (let y = 4; y < 22; y++) for (let x = 0; x < 6; x++) if (x < 6 - Math.abs(y - 13) * 0.45) s.set(pole + facing * (x + 1), y, x === 0 ? STONE[3] : STONE[7 - Math.min(3, x >> 1)]);
  for (let y = 0; y < 6; y++) s.set(pole, y, STONE[7]);
  for (let y = 59; y < 65; y++) for (let x = pole - 2; x <= pole + 3; x++) s.set(x, y, shade(SKIN, 0.7 - (x - pole) / 12, x, y));
  for (let y = 60; y < 65; y += 2) s.set(pole + 1, y, SKIN[1]);
  const shaped = outline(s, INK);
  for (let x = 10; x < 35; x++) shaped.under(x + 3, 100, SHADOW);
  return shaped;
}

/** The royal goose, home at last, with a tiny crown. `phase` bobs her head. */
export function goose(phase: number): Bitmap {
  const s = new Bitmap(40, 40);
  const bob = Math.sin(phase * 1.7) > 0.6 ? 2 : 0;
  for (let y = 18; y < 36; y++) for (let x = 2; x < 34; x++) if (inEllipse(x, y, 17, 27, 14, 8)) s.set(x, y, y > 30 ? NEUTRAL[5] : x < 15 ? NEUTRAL[7] : NEUTRAL[6]);
  for (let y = 22; y < 27; y++) for (let x = 3; x < 12; x++) if (inEllipse(x, y, 7, 24.5, 5, 2.5)) s.set(x, y, NEUTRAL[5]);
  for (let y = 6 + bob; y < 24; y++) {
    const t = (y - 6 - bob) / (18 - bob);
    const x0 = 27 - Math.sin(t * Math.PI) * 3;
    for (let x = Math.floor(x0 - 2.5); x <= x0 + 2.5; x++) s.set(x, y, x < x0 ? NEUTRAL[7] : NEUTRAL[6]);
  }
  for (let y = 3 + bob; y < 11 + bob; y++) for (let x = 23; x < 33; x++) if (inEllipse(x, y, 27.5, 7 + bob, 4.5, 3.8)) s.set(x, y, NEUTRAL[7]);
  for (let x = 32; x < 38; x++) for (let y = 7 + bob; y < 10 + bob; y++) if (x - 32 < 6 - (y - 7 - bob) * 2) s.set(x, y, RED[5]);
  s.set(29, 6 + bob, INK);
  for (let x = 25; x < 31; x++) s.set(x, 2 + bob, GOLD[5]);
  for (const x of [25, 28, 30]) s.set(x, 1 + bob, GOLD[6]);
  for (const x of [13, 21]) for (let y = 35; y < 39; y++) s.set(x, y, RED[4]);
  for (const x of [12, 14, 20, 22]) s.set(x, 39, RED[4]);
  const shaped = outline(s, INK);
  for (let x = 4; x < 34; x++) shaped.under(x + 3, 39, SHADOW);
  return shaped;
}

/**
 * Aldric kneeling on the carpet, seen from behind, as his figure is on the map: the Knight in a red
 * cape, steel helm and pauldrons, his sword laid by; the Wizard in a grey robe and a blue hood, his
 * staff beside him; the Ranger in his green hooded cloak with a quiver, his bow laid down; the
 * Courtier in his red coat trimmed with gold, brown locks on a lace collar, under a broad red hat
 * with a great yellow plume, his sabre on the carpet.
 */
function kneeling(background: BackgroundId, breath = 0): Bitmap {
  const s = new Bitmap(60, 70);
  const cx = 30;
  const cloth = { knight: RED, wizard: [ROCK[2], ROCK[3], ROCK[4], ROCK[5], ROCK[6]], ranger: [LEAF[0], LEAF[1], LEAF[2], LEAF[3], LEAF[4]], courtier: [RED[0], RED[1], RED[2], RED[3], RED[4]] }[background];
  for (const side of [-1, 1]) {
    for (let y = 27; y < 46; y++) {
      const ax = cx + side * (17 - (y - 27) * 0.12);
      for (let x = Math.floor(ax - 4); x <= ax + 4; x++) s.set(x, y, shade(background === 'knight' ? STONE : cloth, 0.55 - (x - ax) / 18 - (y - 27) / 90, x, y));
    }
    for (let y = 43; y < 48; y++) for (let x = cx + side * 15 - 3; x <= cx + side * 15 + 3; x++) if (inEllipse(x, y, cx + side * 15, 45, 3, 2.5)) s.set(x, y, background === 'knight' ? STONE[4] : SKIN[3]);
  }
  // The cape (or robe, or cloak) falls from the shoulders and pools on the floor.
  for (let y = 20; y < 66; y++) {
    for (let x = 2; x < 58; x++) {
      const half = y < 29 ? 13 + (y - 20) * 0.55 : y < 46 ? 18 - (y - 29) * 0.15 : 15.5 + (y - 46) * 0.5;
      if (Math.abs(x - cx) > half || (y > 60 && Math.abs(x - cx) > half - (y - 60) * 1.5)) continue;
      const fold = Math.sin((x - cx) / (3.4 + (y - 20) * 0.025)) * 0.12 - (Math.abs(x - cx + 3) < 1.3 ? 0.14 : 0);
      s.set(x, y, shade(cloth, 0.52 + fold - (x - cx) / 90 - (y - 20) * 0.004, x, y));
      // The gold trim round the hem of his coat.
      if (background === 'courtier' && y > 57 && y < 60 && Math.abs(x - cx) < half - 1) s.set(x, y, y === 58 ? GOLD[5] : GOLD[3]);
    }
  }
  // One knee is forward; the other leg folds under the cloak.
  for (let y = 51; y < 64; y++) for (let x = cx + 8; x < cx + 27; x++) if (inEllipse(x, y, cx + 17, 57, 9, 6)) s.set(x, y, shade(cloth, 0.49 - (x - cx - 17) / 32 - (y - 51) / 35, x, y));
  for (let x = cx + 10; x < cx + 24; x++) s.set(x, 62, background === 'courtier' ? GOLD[3] : shade(cloth, 0.18, x, 62));
  const hood = (colour: readonly number[]) => {
    // A hood over the head, peaked a little, draped on the shoulders.
    for (let y = 14 + breath; y < 31 + breath; y++) for (let x = cx - 20; x <= cx + 20; x++) if (inEllipse(x, y, cx, 23 + breath, 19, 7)) s.set(x, y, shade(colour, 0.55 - (x - cx) / 40 - (y - 14 - breath) * 0.01, x, y - breath));
    for (let y = 1 + breath; y < 24 + breath; y++) for (let x = cx - 10; x <= cx + 10; x++) if (inEllipse(x, y, cx, 13 + breath, 9, 10) || (y < 6 + breath && Math.abs(x - cx + 1) < (y - 1 - breath) * 0.8)) s.set(x, y, shade(colour, 0.66 - (x - cx) / 26 - (y - 3 - breath) * 0.012, x, y - breath));
    for (let y = 7 + breath; y < 21 + breath; y++) s.set(cx + 5, y, colour[1]);
  };
  if (background === 'knight') {
    // Pauldrons on both shoulders, the helm and its plume.
    for (const px of [cx - 12, cx + 12]) for (let y = 16 + breath; y < 28 + breath; y++) for (let x = px - 8; x <= px + 8; x++) if (inEllipse(x, y, px, 22 + breath, 7.5, 5.5)) s.set(x, y, shade(STONE, 0.8 - (x - px) / 16 - (y - 16 - breath) * 0.02 - (y > 24 + breath ? 0.15 : 0), x, y - breath));
    for (let y = 3 + breath; y < 22 + breath; y++) for (let x = cx - 9; x <= cx + 9; x++) if (inEllipse(x, y, cx, 12 + breath, 8, 9)) s.set(x, y, shade(STONE, 0.82 - (x - cx) / 18 - (y - 3 - breath) * 0.012, x, y - breath));
    for (let y = 5 + breath; y < 20 + breath; y++) s.set(cx - 1, y, STONE[7]), s.set(cx, y, STONE[4]);
    for (let y = breath; y < 8 + breath; y++) for (let x = cx - 2; x <= cx + 3; x++) if (Math.abs(x - cx - 0.5 + (y - 4 - breath) * 0.2) < 2.2 - (y - breath) * 0.12) s.set(x, y, y < 3 + breath ? RED[5] : RED[4]);
  } else if (background === 'wizard') {
    hood([BLUE[0], BLUE[1], BLUE[2], BLUE[3], BLUE[4]]);
    for (let y = 7 + breath; y < 21 + breath; y++) s.set(cx - 6, y, GOLD[y % 3 === 0 ? 3 : 4]);
  } else if (background === 'ranger') {
    // A quiver on his back, fletching over the right shoulder, under the hood.
    for (let y = 8; y < 40; y++) for (let x = cx + 5; x < cx + 11; x++) if (Math.abs(x - (cx + 8) + (y - 24) * 0.25) < 2.6) s.set(x, y, y < 14 ? (x % 2 ? NEUTRAL[7] : RED[4]) : shade(WOOD, 0.45 - (x - cx - 8) / 10, x, y));
    hood([LEAF[0], LEAF[1], LEAF[2], LEAF[3], LEAF[4]]);
    for (let y = 29; y < 52; y++) {
      const x = cx + 9 - Math.floor((y - 29) * 0.7);
      s.set(x, y, EARTH[1]);
      s.set(x + 1, y, WOOD[4]);
    }
  } else {
    // The coat's shoulders and a lace collar, long brown hair over it, and a broad red hat with a gold band and a great yellow plume.
    const coat = [RED[0], RED[1], RED[2], RED[3], RED[4]];
    for (let y = 15; y < 30; y++) for (let x = cx - 20; x <= cx + 20; x++) if (inEllipse(x, y, cx, 22, 19, 6.5)) s.set(x, y, shade(coat, 0.62 - (x - cx) / 36, x, y));
    for (let y = 15; y < 21; y++) for (let x = cx - 12; x <= cx + 12; x++) if (inEllipse(x, y, cx, 18, 11.5, 2.6)) s.set(x, y, (x + y) % 3 === 0 ? NEUTRAL[5] : x < cx ? NEUTRAL[7] : NEUTRAL[6]);
    const hair = [EARTH[1], EARTH[2], EARTH[3], EARTH[4], EARTH[5]];
    for (let y = 8 + breath; y < 28 + breath; y++) for (let x = cx - 10; x <= cx + 10; x++) if (Math.abs(x + 0.5 - cx) < 7.5 + (y - 8 - breath) * 0.12 && y < 25 + breath + ((x >> 1) % 2) + (Math.abs(x - cx) > 5 ? 1 : 0)) s.set(x, y, shade(hair, 0.62 - (x - cx) / 22 - (y - 8 - breath) * 0.01 + (((x >> 1) % 2) - 0.5) * 0.24, x, y - breath));
    for (let y = 1 + breath; y < 15 + breath; y++) for (let x = cx - 18; x <= cx + 18; x++) if (inEllipse(x, y, cx, 11 + breath, 17.5, 3.2) || (inEllipse(x, y, cx, 7 + breath, 8.5, 5.5) && y <= 11 + breath)) s.set(x, y, shade(coat, 0.66 - (x - cx) / 30 - (y - 2 - breath) * 0.02, x, y - breath));
    for (let x = cx - 8; x <= cx + 8; x++) for (const y of [9, 10]) s.set(x, y + breath, y === 9 ? GOLD[5] : GOLD[3]);
    for (let x = cx - 17; x <= cx + 17; x++) s.set(x, 13 + breath, x < cx ? GOLD[4] : GOLD[3]);
    for (let k = 0; k < 18; k++) {
      const t = k / 17;
      const [px, py, r] = [cx + 1 - t * 21, 3.5 + breath - Math.sin(t * Math.PI * 0.7) * 3 + t * t * 9, 2.7 - Math.abs(t - 0.35) * 2];
      for (let y = Math.floor(py - r); y <= py + r; y++) for (let x = Math.floor(px - r); x <= px + r; x++) if (y >= 0 && inEllipse(x, y, px, py, r, r * 0.85)) s.set(x, y, (x - (y - breath) * 2) % 4 === 0 ? GOLD[3] : y < py ? GOLD[6] : GOLD[5]);
    }
  }
  // Boot soles, and what he fights with laid on the carpet beside him.
  for (let y = 62; y < 68; y++) for (let x = cx + 15; x < cx + 27; x++) if (y > 64 || x < cx + 22) s.set(x, y, y === 62 ? EARTH[3] : EARTH[0]);
  if (background === 'wizard') {
    for (let x = 1; x < 26; x++) s.set(x, 64, x < 3 ? GOLD[5] : WOOD[3 + (x % 2)]);
    for (let y = 60; y < 67; y++) for (let x = 0; x < 6; x++) if (inEllipse(x, y, 3, 63, 2.6, 2.6)) s.set(x, y, x < 3 && y < 63 ? NEUTRAL[7] : BLUE[5]);
  } else if (background === 'ranger') {
    for (let x = 2; x < 28; x++) {
      const bow = Math.round(Math.sin(((x - 2) / 26) * Math.PI) * 4);
      s.set(x, 66 - bow, WOOD[4]);
      s.set(x, 67 - bow, WOOD[2]);
      s.set(x, 67, NEUTRAL[5]);
    }
  } else {
    // A sword, or a sabre with its curve.
    const curve = background === 'courtier';
    for (let x = 2; x < 22; x++) s.set(x, 64 - (curve ? Math.round(((x - 12) / 10) ** 2 * 2) : 0), x < 4 ? STONE[4] : STONE[6]);
    for (let y = 61; y < 68; y++) s.set(22, y, GOLD[4]);
    s.set(24, 64, GOLD[5]);
  }
  const shaped = outline(s, INK);
  for (let x = 6; x < 56; x++) shaped.under(x + 3, 68, SHADOW);
  return shaped;
}

/** The King's court, between commissions: throne, banners, torchlight and the royal goose. */
export class CourtScreen {
  readonly screen = new Bitmap(SCREEN.width, SCREEN.height);
  /** The throne room with nobody kneeling in it yet. */
  private readonly room: Bitmap;
  private readonly overlay: Bitmap;
  private readonly kings = [king(false), king(true)];
  private kneelers: [Bitmap, Bitmap];
  caption = '';
  /** The royal goose, at the King's feet. Before the first commission, Grimsby has it. */
  goose = true;

  constructor(background: BackgroundId = 'knight') {
    const { frame, overlay } = paintFrame();
    this.overlay = overlay;
    const room = new Room();
    room.bitmap.data.set(frame.data);
    wall(room);
    for (const x of [250, 678]) windowPane(room, x);
    for (const x of [110, 818]) pillar(room, x);
    for (const x of [372, 556]) banner(room, x);
    floor(room);
    dais(room);
    throne(room);
    for (const x of [110, 818]) torch(room, x, 132);
    // Corners fall into shadow.
    for (let y = 0; y < MAP_VIEW.height; y++) {
      for (let x = 0; x < MAP_VIEW.width; x++) {
        const edge = Math.max(Math.abs(x - MID) / MID, Math.abs(y - 200) / 264);
        if (edge > 0.82) room.tint(x, y, SHADOW_LUT, (edge - 0.82) * 3);
      }
    }
    const b = room.bitmap;
    blit(b, guard(1), MAP_VIEW.x + 281, MAP_VIEW.y + 154);
    blit(b, guard(-1), MAP_VIEW.x + 603, MAP_VIEW.y + 154);
    this.room = b;
    this.kneelers = [kneeling(background), kneeling(background, 1)];
  }

  /** Aldric on the carpet before the throne, as who he was. */
  kneel(background: BackgroundId) {
    this.kneelers = [kneeling(background), kneeling(background, 1)];
  }

  draw(phase: number): Bitmap {
    this.screen.data.set(this.room.data);
    const blink = phase % 6.4 > 6.18 ? 1 : 0;
    blit(this.screen, this.kings[blink], MAP_VIEW.x + MID - 48, MAP_VIEW.y + 70);
    blit(this.screen, this.kneelers[Math.sin(phase * 0.75) > 0.8 ? 1 : 0], MAP_VIEW.x + MID - 30, MAP_VIEW.y + 366);
    if (this.goose) blit(this.screen, goose(phase), MAP_VIEW.x + MID + 58, MAP_VIEW.y + 176);
    if (this.caption) drawText(this.screen, this.caption, BAR.x + 12, BAR.y + 5, PARCHMENT[6], INK);
    blit(this.screen, this.overlay, 0, 0);
    return this.screen;
  }
}
