import { Bitmap, blit, outline, SHADOW } from './bitmap';
import { BAR, MAP_VIEW, paintFrame, SCREEN } from './frame';
import { bayer, hash, noise, shade } from './noise';
import { BLUE, CYCLE_FIRE, GOLD, INK, LIGHT_LUT, NEUTRAL, PARCHMENT, RED, SHADOW_LUT, SKIN, STONE, WOOD } from './palette';
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
function king(room: Room) {
  const [cx, cy] = [MID, 170];
  // Robe.
  for (let y = cy - 40; y < cy + 36; y++) {
    for (let x = cx - 40; x < cx + 40; x++) {
      if (!inEllipse(x, y, cx, cy, 34, 38) || y > 204) continue;
      room.set(x, y, shade(RED, 0.55 - (x - cx) / 90 - (y - cy) / 160, x, y));
    }
  }
  // Ermine: a collar across the shoulders and a strip down the front, white with black tails.
  const ermine = (x: number, y: number) => room.set(x, y, (x * 7 + y * 3) % 23 === 0 ? INK : x < cx ? NEUTRAL[7] : NEUTRAL[6]);
  for (let y = cy - 38; y < cy - 20; y++) for (let x = cx - 34; x < cx + 34; x++) if (inEllipse(x, y, cx, cy - 29, 29, 8)) ermine(x, y);
  for (let y = cy - 20; y < cy + 34; y++) for (let x = cx - 6; x <= cx + 6; x++) ermine(x, y);
  // Sleeves reaching for the sceptre (his right) and the armrest (his left).
  for (const [ax, ay, bx, by] of [[cx - 22, cy - 22, cx - 28, cy + 2], [cx + 22, cy - 22, cx + 30, cy + 6]]) {
    for (let t = 0; t <= 1; t += 0.02) {
      const [x0, y0] = [ax + (bx - ax) * t, ay + (by - ay) * t];
      for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) if (x * x + y * y <= 30) room.set(Math.round(x0 + x), Math.round(y0 + y), shade(RED, 0.45 - x / 20 - (x0 - cx) / 120, x0 + x, y0 + y));
    }
  }
  // Head: a round, kindly face over a great white beard, under the crown.
  const [hx, hy] = [cx, cy - 52];
  for (let y = hy - 14; y < hy + 14; y++) for (let x = hx - 14; x < hx + 14; x++) if (inEllipse(x, y, hx, hy, 12.5, 13.5)) room.set(x, y, shade(SKIN, 0.72 - (x - hx) / 40, x, y));
  for (let y = hy + 1; y < hy + 32; y++) {
    for (let x = hx - 15; x < hx + 16; x++) {
      if (!inEllipse(x, y, hx, hy + 13, 13.5 - Math.max(0, y - hy - 19) * 0.55, 17)) continue;
      if (y < hy + 6 && Math.abs(x - hx) < 5) continue;
      room.set(x, y, (x + y) % 5 === 0 ? NEUTRAL[5] : x < hx ? NEUTRAL[7] : NEUTRAL[6]);
    }
  }
  for (const dx of [-5, 4]) {
    room.set(hx + dx, hy - 2, INK);
    room.set(hx + dx, hy - 1, INK);
    for (let x = hx + dx - 2; x <= hx + dx + 2; x++) room.set(x, hy - 5, NEUTRAL[7]);
    room.set(hx + dx + (dx < 0 ? -1 : 1), hy + 3, RED[5]);
  }
  room.set(hx, hy + 1, SKIN[4]);
  room.set(hx, hy + 2, SKIN[1]);
  for (let x = hx - 6; x <= hx + 6; x++) room.set(x, hy + 5, x === hx - 6 || x === hx + 6 ? NEUTRAL[6] : NEUTRAL[7]);
  for (let y = hy - 27; y < hy - 10; y++) {
    for (let x = hx - 14; x <= hx + 14; x++) {
      if (!crownAt((x - hx) * 0.85, (y - (hy - 19)) * 1.05)) continue;
      room.set(x, y, x < hx ? GOLD[6] : GOLD[4]);
    }
  }
  for (const dx of [-7, 0, 7]) room.set(hx + dx, hy - 15, dx === 0 ? RED[5] : BLUE[5]);
  // Hands, and the sceptre with a gold orb.
  for (const [x0, y0] of [[cx - 33, cy - 2], [cx + 26, cy + 4]]) for (let y = y0; y < y0 + 8; y++) for (let x = x0; x < x0 + 9; x++) if (inEllipse(x, y, x0 + 4.5, y0 + 4, 4.5, 4)) room.set(x, y, shade(SKIN, 0.7, x, y));
  for (let y = cy - 62; y < cy + 12; y++) room.set(cx - 29, y, GOLD[5]), room.set(cx - 28, y, GOLD[3]);
  for (let y = cy - 74; y < cy - 60; y++) for (let x = cx - 35; x < cx - 22; x++) if (inEllipse(x, y, cx - 28.5, cy - 67, 5.5, 5.5)) room.set(x, y, x < cx - 29 ? GOLD[6] : GOLD[4]);
  room.set(cx - 29, cy - 69, NEUTRAL[7]);
  // Shoes peeping out below the robe.
  for (const x0 of [cx - 17, cx + 6]) for (let y = 202; y < 207; y++) for (let x = x0; x < x0 + 11; x++) room.set(x, y, y === 202 ? RED[2] : RED[1]);
}

/** A royal guard with a halberd, facing the carpet. */
function guard(facing: 1 | -1): Bitmap {
  const s = new Bitmap(34, 96);
  const cx = 17;
  for (let y = 36; y < 88; y++) for (let x = cx - 9; x <= cx + 9; x++) if (Math.abs(x - cx) <= 7 + (y - 36) * 0.05) s.set(x, y, y > 76 ? STONE[2] : shade(BLUE, 0.55 - (x - cx) / 30, x, y));
  for (let y = 44; y < 70; y++) s.set(cx, y, GOLD[5]);
  for (let x = cx - 6; x <= cx + 6; x++) s.set(x, 52, GOLD[5]);
  for (let y = 22; y < 38; y++) for (let x = cx - 7; x <= cx + 7; x++) if (inEllipse(x, y, cx, 30, 6, 8)) s.set(x, y, y < 28 ? shade(STONE, 0.75 - (x - cx) / 20, x, y) : SKIN[3]);
  for (let x = cx - 8; x <= cx + 8; x++) s.set(x, 27, STONE[5]);
  s.set(cx + facing * 3, 31, INK);
  for (let y = 88; y < 94; y++) for (let x = cx - 7; x <= cx + 7; x++) if (Math.abs(x - cx) > 1) s.set(x, y, INK);
  const pole = cx + facing * 12;
  for (let y = 2; y < 92; y++) s.set(pole, y, WOOD[3]);
  for (let y = 4; y < 20; y++) for (let x = 0; x < 8; x++) if (x < 7 - Math.abs(y - 12) * 0.5) s.set(pole + facing * (x + 1), y, x === 0 ? STONE[3] : STONE[6 - Math.min(3, x >> 1)]);
  for (let y = 0; y < 5; y++) s.set(pole, y, STONE[6]);
  const shaped = outline(s, INK);
  for (let x = 4; x < 30; x++) shaped.under(x + 4, 94, SHADOW);
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

/** Aldric kneeling on the carpet, seen from behind: red cape, steel helm and pauldrons, sword laid by. */
function kneeling(): Bitmap {
  const s = new Bitmap(60, 70);
  const cx = 30;
  // The cape falls from the shoulders and pools on the floor.
  for (let y = 20; y < 66; y++) {
    for (let x = 2; x < 58; x++) {
      const half = 13 + (y - 20) * 0.34;
      if (Math.abs(x - cx) > half || (y > 60 && Math.abs(x - cx) > half - (y - 60) * 1.5)) continue;
      const fold = Math.sin((x - cx) / 3.4) * 0.12;
      s.set(x, y, shade(RED, 0.52 + fold - (x - cx) / 90 - (y - 20) * 0.004, x, y));
    }
  }
  // Pauldrons on both shoulders.
  for (const px of [cx - 12, cx + 12]) for (let y = 16; y < 28; y++) for (let x = px - 8; x <= px + 8; x++) if (inEllipse(x, y, px, 22, 7.5, 5.5)) s.set(x, y, shade(STONE, 0.8 - (x - px) / 16 - (y - 16) * 0.02, x, y));
  // Helm and plume.
  for (let y = 3; y < 22; y++) for (let x = cx - 9; x <= cx + 9; x++) if (inEllipse(x, y, cx, 12, 8, 9)) s.set(x, y, shade(STONE, 0.82 - (x - cx) / 18 - (y - 3) * 0.012, x, y));
  for (let y = 0; y < 8; y++) for (let x = cx - 2; x <= cx + 3; x++) if (Math.abs(x - cx - 0.5 + (y - 4) * 0.2) < 2.2 - y * 0.12) s.set(x, y, y < 3 ? RED[5] : RED[4]);
  // Boot soles, and the sword laid on the carpet beside him.
  for (let y = 62; y < 68; y++) for (let x = cx + 12; x < cx + 24; x++) if (y > 64 || x < cx + 19) s.set(x, y, STONE[2]);
  for (let x = 2; x < 22; x++) s.set(x, 64, x < 4 ? STONE[4] : STONE[6]);
  for (let y = 61; y < 68; y++) s.set(22, y, GOLD[4]);
  s.set(24, 64, GOLD[5]);
  const shaped = outline(s, INK);
  for (let x = 6; x < 56; x++) shaped.under(x + 3, 68, SHADOW);
  return shaped;
}

/** The King's court, between commissions: throne, banners, torchlight and the royal goose. */
export class CourtScreen {
  readonly screen = new Bitmap(SCREEN.width, SCREEN.height);
  private readonly base: Bitmap;
  private readonly overlay: Bitmap;
  caption = '';

  constructor() {
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
    king(room);
    for (const x of [110, 818]) torch(room, x, 132);
    // Corners fall into shadow.
    for (let y = 0; y < MAP_VIEW.height; y++) {
      for (let x = 0; x < MAP_VIEW.width; x++) {
        const edge = Math.max(Math.abs(x - MID) / MID, Math.abs(y - 200) / 264);
        if (edge > 0.82) room.tint(x, y, SHADOW_LUT, (edge - 0.82) * 3);
      }
    }
    const b = room.bitmap;
    blit(b, guard(1), MAP_VIEW.x + 286, MAP_VIEW.y + 158);
    blit(b, guard(-1), MAP_VIEW.x + 608, MAP_VIEW.y + 158);
    blit(b, kneeling(), MAP_VIEW.x + MID - 30, MAP_VIEW.y + 366);
    this.base = b;
  }

  draw(phase: number): Bitmap {
    this.screen.data.set(this.base.data);
    blit(this.screen, goose(phase), MAP_VIEW.x + MID + 58, MAP_VIEW.y + 176);
    if (this.caption) drawText(this.screen, this.caption, BAR.x + 12, BAR.y + 5, PARCHMENT[6], INK);
    blit(this.screen, this.overlay, 0, 0);
    return this.screen;
  }
}
