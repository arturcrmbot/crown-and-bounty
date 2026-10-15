import type { BackgroundId } from '../content/backgrounds';
import { FRIENDS, type FriendId } from '../content/friends';
import { Bitmap, blit, outline, scaleBitmap, SHADOW } from './bitmap';
import { backdrop, courtPiece } from './mapArt';
import type { CourtPieceName } from './mapPieces';
import { mirror } from './sprites';
import { BAR, MAP_VIEW, paintFrame, SCREEN } from './frame';
import { bayer, hash, noise, shade } from './noise';
import { BLUE, EARTH, GOLD, INK, LIGHT_LUT, NEUTRAL, PARCHMENT, PLUM, RED, SAND, SHADOW_LUT, SKIN, STONE, WOOD } from './palette';
import { portrait } from './portraits';
import { drawText } from './text';

/** Where the wall meets the floor, and where the lines of the floor meet, in room pixels. */
const WALL_FOOT = 308;
const VANISH: [number, number] = [228, 168];
const MID = 228;
/** Framebuffer coordinates shared by the welcome and homecoming controllers. */
export const COURT_CARD = { left: 380, right: MAP_VIEW.x + MAP_VIEW.width - 8 };
const MASONRY = [EARTH[1], EARTH[2], EARTH[3], SAND[0], SAND[1], SAND[2], SAND[3]];

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
  /**
   * Darkens (or lights) a pixel through a lookup table where `share` is high: solid over most of it, with an ordered
   * dither only across the edge, never the random speckle that read as dirt on the stone (#311).
   */
  tint(x: number, y: number, lut: Uint8Array, share: number) {
    if (bayer(x, y) < (share - 0.25) * 2) this.set(x, y, lut[this.get(x, y)]);
  }
}

function wall(room: Room) {
  for (let y = 0; y < WALL_FOOT; y++) {
    const row = Math.floor(y / 34);
    const shift = (row % 2) * 42;
    for (let x = 0; x < MAP_VIEW.width; x++) {
      const col = Math.floor((x + shift) / 84);
      const mortar = y % 34 === 0 || (x + shift) % 84 === 0;
      const light = Math.exp(-(((x - MID) / 260) ** 2 + ((y - 150) / 240) ** 2));
      const level = 0.25 + light * 0.3 + (hash(col, row, 31) - 0.5) * 0.07 + (noise(x / 9, y / 9, 32) - 0.5) * 0.05;
      room.set(x, y, shade(MASONRY, level - (mortar ? 0.08 : 0), x, y));
    }
  }
  // A vaulted recess draws the eye to the audience rather than the far wall.
  for (let y = 8; y < WALL_FOOT; y++) {
    for (let x = MID - 184; x <= MID + 184; x++) {
      const dx = Math.abs(x - MID);
      const arch = y >= 162 || inEllipse(x, y, MID, 162, 184, 154);
      const inside = dx < 168 && (y >= 162 || inEllipse(x, y, MID, 162, 168, 138));
      if (!arch) continue;
      if (!inside) room.set(x, y, shade(SAND, 0.5 - (x - MID) / 650 + (y % 27 < 2 ? -0.12 : 0), x, y));
      else room.tint(x, y, SHADOW_LUT, 1);
    }
  }
  for (let y = WALL_FOOT - 12; y < WALL_FOOT; y++) for (let x = 0; x < MAP_VIEW.width; x++) room.set(x, y, shade(MASONRY, y === WALL_FOOT - 12 ? 0.56 : 0.2, x, y));
}

function pillar(room: Room, cx: number) {
  const half = 21;
  for (let y = 0; y < WALL_FOOT + 6; y++) {
    for (let x = cx - half; x < cx + half; x++) {
      const u = (x - cx) / half;
      const lit = 0.5 - u * 0.28 + Math.sqrt(1 - u * u) * 0.12 + (noise(x / 5, y / 14, 41) - 0.5) * 0.08;
      const band = y % 78 < 2 ? -0.12 : 0;
      room.set(x, y, shade(SAND, lit + band - (1 - y / WALL_FOOT) * 0.12, x, y));
    }
  }
  // Base block.
  for (let y = WALL_FOOT - 18; y < WALL_FOOT + 8; y++) for (let x = cx - half - 5; x < cx + half + 5; x++) room.set(x, y, shade(SAND, y < WALL_FOOT - 15 ? 0.66 : 0.4 - (x - cx) / 200, x, y));
}

function windowPane(room: Room, cx: number) {
  const [top, bottom, half] = [40, 178, 30];
  const inside = (x: number, y: number, grow: number) => Math.abs(x - cx) <= half + grow && y <= bottom + grow && (y >= top + half || Math.hypot(x - cx, y - (top + half)) <= half + grow);
  for (let y = top - 8; y <= bottom + 8; y++) {
    for (let x = cx - half - 8; x <= cx + half + 8; x++) {
      if (inside(x, y, 0)) {
        const lead = (x - cx + 60) % 15 === 0 || (y - top + 60) % 15 === 0;
        const sky = (y - top) / (bottom - top);
        room.set(x, y, lead ? EARTH[2] : sky < 0.35 ? PARCHMENT[6] : sky < 0.7 ? GOLD[6] : BLUE[6]);
      } else if (inside(x, y, 6)) room.set(x, y, shade(SAND, x < cx ? 0.72 : 0.5, x, y));
    }
  }
  // Sill.
  for (let x = cx - half - 10; x <= cx + half + 10; x++) for (let y = bottom + 6; y < bottom + 11; y++) room.set(x, y, shade(SAND, y === bottom + 6 ? 0.8 : 0.45, x, y));
}

/** A long red banner with a gold border, a gold crown and a swallowtail. */
function banner(room: Room, cx: number) {
  const [top, bottom, half] = [14, 254, 23];
  for (let y = top; y < bottom; y++) {
    for (let x = cx - half; x < cx + half; x++) {
      const notch = bottom - 22 + Math.abs(x - cx) * (22 / half);
      if (y > notch) continue;
      const fold = Math.sin((x - cx) / 5.5) * 0.12;
      const edge = x < cx - half + 4 || x >= cx + half - 4 || y > notch - 4;
      const crown = crownAt(x - cx, y - 112);
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
      room.set(x, y, core ? GOLD[6] : h < 0.45 ? GOLD[5] : RED[5]);
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
      const centre = MID + (y - WALL_FOOT) * 0.5;
      const half = 50 + (y - WALL_FOOT) * 0.27;
      const edge = Math.abs(x - centre) / half;
      const carpet = edge < 1;
      let c: number;
      if (carpet) {
        const trim = edge > 0.9;
        c = trim ? shade(GOLD, 0.54 - edge * 0.08, x, y) : shade(RED, 0.34 + (noise(x / 3, y / 3, 12) - 0.5) * 0.08 + (y - WALL_FOOT) * 0.0006, x, y);
      } else {
        const tone = (row + col) % 2 === 0 ? 0.4 : 0.36;
        c = shade(MASONRY, (grout ? 0.22 : tone) + (hash(row, col, 7) - 0.5) * 0.05 + (noise(x / 6, y / 6, 8) - 0.5) * 0.05, x, y);
      }
      room.set(x, y, c);
    }
  }
  // Window light: long pale slants across the floor.
  for (const cx of [40, 728]) {
    for (let y = WALL_FOOT; y < MAP_VIEW.height; y++) {
      const t = (y - WALL_FOOT) / (MAP_VIEW.height - WALL_FOOT);
      const left = cx + 20 + t * 170;
      for (let x = Math.floor(left - 36 - t * 30); x < left + 36 + t * 30; x++) room.tint(x, y, LIGHT_LUT, 0.55 - t * 0.25);
    }
  }
}

/** The dais: three steps, carpeted up the middle. */
function dais(room: Room) {
  for (let step = 0; step < 3; step++) {
    const top = 268 + step * 14;
    const half = 108 + step * 24;
    for (let y = top; y < top + 14; y++) {
      for (let x = MID - half; x < MID + half; x++) {
        const tread = y < top + 5;
        const carpet = Math.abs(x - MID) < 46 + step * 3;
        const c = carpet ? (Math.abs(x - MID) > 40 + step * 3 ? GOLD[tread ? 5 : 3] : RED[tread ? 4 : 2]) : shade(SAND, tread ? 0.66 : 0.38 - (x - MID) / 900, x, y);
        room.set(x, y, c);
      }
    }
  }
}

/** The cloth of estate: a blue velvet hanging with a gold border and the crown, behind the King's throne. */
function clothOfEstate(room: Room) {
  const [top, bottom, half] = [92, 270, 56];
  for (let y = top; y < bottom; y++) {
    for (let x = MID - half; x <= MID + half; x++) {
      const dx = Math.abs(x - MID);
      if (y < top + half && !inEllipse(x, y, MID, top + half, half, half)) continue;
      const inner = dx < half - 7 && (y >= top + half || inEllipse(x, y, MID, top + half, half - 7, half - 7));
      const lit = 0.7 - (x - MID) / 230;
      room.set(x, y, inner ? shade(BLUE, 0.27 + Math.sin((x - MID) / 12) * 0.05, x, y) : shade(GOLD, lit, x, y));
    }
  }
  for (let y = 106; y < 130; y++) for (let x = MID - 22; x <= MID + 22; x++) if (crownAt((x - MID) / 1.6, (y - 118) / 1.6)) room.set(x, y, x < MID ? GOLD[5] : GOLD[3]);
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

function guest(id: FriendId): Bitmap {
  const height = id === 'dwarf' ? 84 : 100;
  const s = new Bitmap(56, height);
  const cloth = id === 'nan' ? PLUM : id === 'pike' ? RED : WOOD;
  for (let y = 32; y < height - 9; y++) {
    const half = id === 'dwarf' ? 17 - Math.abs(y - 52) * 0.07 : y < 52 ? 13 + (y - 32) * 0.08 : 14 + (y - 52) * (id === 'nan' ? 0.12 : id === 'anselm' ? 0.05 : 0.01);
    for (let x = 7; x < 49; x++) {
      if (Math.abs(x - 28) >= half || y > height - 14 && Math.abs(x - 28) < 2) continue;
      const fold = Math.sin((x - 28) / 3.8 + Math.max(0, y - 52) * 0.02) * 0.12;
      s.set(x, y, shade(cloth, 0.56 - (x - 28) / 55 + fold - Math.max(0, y - 52) * 0.003, x, y));
    }
  }
  for (const side of [-1, 1]) {
    for (let y = 35; y < 63; y++) {
      const arm = 28 + side * (13 + (y - 35) * 0.17);
      for (let x = Math.floor(arm - 4); x <= arm + 4; x++) if (inEllipse(x, y, arm, 49, 4, 15)) s.set(x, y, shade(cloth, 0.61 - (x - arm) / 17 - side * 0.1, x, y));
    }
    for (let y = 60; y < 67; y++) for (let x = 28 + side * 18 - 4; x <= 28 + side * 18 + 4; x++) if (inEllipse(x, y, 28 + side * 18, 63, 3.5, 3.5)) s.set(x, y, shade(SKIN, 0.67 - side * 0.15, x, y));
    for (let y = height - 13; y < height - 3; y++) for (let x = 28 + side * 8 - 5; x < 28 + side * 8 + 6; x++) if (y > height - 8 || Math.abs(x - 28 - side * 8) < 3) s.set(x, y, y === height - 13 ? EARTH[3] : EARTH[1]);
  }
  if (id === 'pike') {
    s.fill(12, 53, 33, 3, EARTH[1]);
    s.fill(26, 53, 4, 3, GOLD[4]);
    for (let y = 59; y < height - 11; y++) s.set(46, y, STONE[5]), s.set(47, y, STONE[2]);
  } else if (id === 'dwarf' || id === 'nan') {
    for (let y = 32; y < height - 3; y++) s.set(47, y, WOOD[4]), s.set(48, y, WOOD[1]);
    if (id === 'dwarf') s.fill(37, 30, 18, 3, STONE[5]);
  } else {
    for (let y = 44; y < 62; y += 4) s.set(31, y, GOLD[3]);
  }
  if (id === 'nan') for (let y = 34; y < 51; y++) for (let x = 12; x <= 44; x++) if (inEllipse(x, y, 28, 37, 17, 12) && !inEllipse(x, y, 28, 29, 12, 11)) s.set(x, y, shade(RED, 0.34 - (x - 28) / 65, x, y));
  const face = portrait(FRIENDS[id].portrait);
  const head = new Bitmap(42, 47);
  for (let y = 0; y < head.height; y++) for (let x = 0; x < head.width; x++) head.set(x, y, face.get(x + 11, y));
  blit(s, scaleBitmap(head, 0.72), 13, 4);
  const shaped = outline(s, INK);
  for (let x = 10; x < 48; x++) shaped.under(x + 2, height - 2, SHADOW);
  return shaped;
}

/** A painted figure standing with its feet at `x, y` in the room, facing right as drawn or `flip`ped to face left. */
function stand(b: Bitmap, sprite: Bitmap | null, x: number, y: number, flip = false) {
  if (!sprite) return;
  const shown = flip ? mirror(sprite) : sprite;
  for (let i = 4; i < shown.width - 4; i++) b.under(MAP_VIEW.x + x - Math.round(shown.width / 2) + i + 3, MAP_VIEW.y + y, SHADOW);
  blit(b, shown, MAP_VIEW.x + x - Math.round(shown.width / 2), MAP_VIEW.y + y - shown.height);
}

const KNEELING: Record<BackgroundId, CourtPieceName> = { knight: 'kneelKnight', wizard: 'kneelWizard', ranger: 'kneelRanger', courtier: 'kneelCourtier' };
/** Where Aldric kneels on the carpet, facing the throne, and where the King's throne stands on the dais. */
const KNEEL = { x: 300, y: 418 };
const THRONE = { left: MID - 41, foot: 278 };

/** The King's court, between commissions: throne, banners, torchlight and the royal goose. */
export class CourtScreen {
  readonly screen = new Bitmap(SCREEN.width, SCREEN.height);
  /** The throne room with nobody kneeling in it yet. */
  private readonly room: Bitmap;
  private readonly overlay: Bitmap;
  private readonly geese = [goose(0), goose(1)];
  private kneeler: Bitmap | null = null;
  private guests: { sprite: Bitmap; x: number; y: number }[] = [];
  private greetedAt = -Infinity;
  caption = '';
  /** The royal goose, at the King's feet. Before the first commission, Grimsby has it. */
  goose = true;

  constructor(background: BackgroundId = 'knight') {
    const { frame, overlay } = paintFrame([]);
    this.overlay = overlay;
    const room = new Room();
    room.bitmap.data.set(frame.data);
    wall(room);
    for (const x of [24, 728]) windowPane(room, x);
    for (const x of [28, 414, 866]) pillar(room, x);
    for (const x of [102, 354]) banner(room, x);
    floor(room);
    dais(room);
    clothOfEstate(room);
    for (const x of [58, 414]) torch(room, x, 172);
    // Corners fall into shadow.
    for (let y = 0; y < MAP_VIEW.height; y++) {
      for (let x = 0; x < MAP_VIEW.width; x++) {
        const edge = Math.max(Math.abs(x - MAP_VIEW.width / 2) / (MAP_VIEW.width / 2), Math.abs(y - 220) / 264);
        if (edge > 0.85) room.tint(x, y, SHADOW_LUT, (edge - 0.85) * 2.2);
      }
    }
    const b = room.bitmap;
    // The hall painted whole, over the code's own, once it has loaded.
    const hall = backdrop('court');
    if (hall) blit(b, hall, MAP_VIEW.x, MAP_VIEW.y);
    // The royal guard stands either side of the dais, facing the carpet.
    stand(b, courtPiece('guard'), 92, 312);
    stand(b, courtPiece('guard'), 334, 312, true);
    this.room = b;
    this.kneel(background);
  }

  /** Aldric on the carpet before the throne, as who he was, facing the King. */
  kneel(background: BackgroundId) {
    // Each was drawn kneeling to the left, towards the throne, but the Wizard, who is turned round to face it.
    const figure = courtPiece(KNEELING[background]);
    this.kneeler = figure && background === 'wizard' ? mirror(figure) : figure;
  }

  setGuests(ids: readonly FriendId[]) {
    this.guests = ids.slice(0, 2).map((id, i) => ({ sprite: guest(id), x: 120 + i * 80, y: 424 - i * 12 })).reverse();
  }

  welcome(time: number) {
    this.greetedAt = time;
  }

  draw(phase: number): Bitmap {
    this.screen.data.set(this.room.data);
    const greeting = phase >= this.greetedAt && phase - this.greetedAt < 1.4;
    // The King bounces on his throne to welcome a new page.
    const king = courtPiece('king');
    if (king) blit(this.screen, king, MAP_VIEW.x + THRONE.left, MAP_VIEW.y + THRONE.foot - king.height - (greeting && phase - this.greetedAt < 0.5 ? 3 : 0));
    if (this.goose) blit(this.screen, this.geese[Math.sin(phase * 1.7) > 0.6 ? 1 : 0], MAP_VIEW.x + MID - 84, MAP_VIEW.y + THRONE.foot - 38);
    for (const { sprite, x, y } of this.guests) blit(this.screen, sprite, MAP_VIEW.x + x - Math.round(sprite.width / 2), MAP_VIEW.y + y - sprite.height);
    if (this.kneeler) stand(this.screen, this.kneeler, KNEEL.x, KNEEL.y);
    if (this.caption) drawText(this.screen, this.caption, BAR.x + 12, BAR.y + 5, PARCHMENT[6], INK);
    blit(this.screen, this.overlay, 0, 0);
    return this.screen;
  }
}
