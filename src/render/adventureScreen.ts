import { Bitmap, blit } from './bitmap';
import { MAP_VIEW, paintFrame, SCREEN } from './frame';
import { MAP_HEIGHT, MAP_WIDTH, type Point } from './lookTestMap';
import { bayer, hash, noise } from './noise';
import { FOG_LUT, GOLD, GRAIN_LUT, INK, RED } from './palette';

/**
 * `x` and `y` are the sprite's top-left in map pixels. `frames` animate it (flags, wheels);
 * `frame` pins the frame instead of following the clock (a walking hero steps with distance).
 */
export type Placed = { sprite: Bitmap; frames?: Bitmap[]; frame?: number; x: number; y: number };

const footY = (o: Placed) => o.y + o.sprite.height;

/**
 * The adventure screen. Static objects are baked into the map once, and only animated ones are
 * drawn each frame. Fogged pixels show the roadless `wild` map through the fog colour table.
 */
export class AdventureScreen {
  readonly screen = new Bitmap(SCREEN.width, SCREEN.height);
  readonly frame: Bitmap;
  private readonly overlay: Bitmap;
  private readonly grain: Uint32Array;
  private readonly animated: Placed[] = [];
  readonly camera = { x: 0, y: 0 };
  /** The route still ahead of the hero: gold dots for today, red for later days. */
  route: { at: Point; today: boolean }[] = [];
  private readonly map: Bitmap;
  private readonly wild: Bitmap;
  readonly fog: Uint8Array;

  constructor(map: Bitmap, wild: Bitmap, fog: Uint8Array) {
    const { frame, overlay } = paintFrame();
    this.frame = frame;
    this.overlay = overlay;
    this.map = map;
    this.wild = wild;
    this.fog = fog;
    const specks: number[] = [];
    for (let y = MAP_VIEW.y; y < MAP_VIEW.y + MAP_VIEW.height; y++) {
      for (let x = MAP_VIEW.x; x < MAP_VIEW.x + MAP_VIEW.width; x++) {
        if (hash(x, y, 201) < 0.035 + noise(x / 26, y / 26, 202) * 0.07) specks.push(y * SCREEN.width + x);
      }
    }
    this.grain = Uint32Array.from(specks);
  }

  animate(object: Placed) {
    this.animated.push(object);
  }

  remove(object: Placed) {
    const i = this.animated.indexOf(object);
    if (i >= 0) this.animated.splice(i, 1);
  }

  isFogged(x: number, y: number) {
    return this.fog[Math.round(y) * MAP_WIDTH + Math.round(x)] === 1;
  }

  /** Lifts the fog in a circle, with the same dithered edge as the starting fog. */
  reveal(cx: number, cy: number, radius: number) {
    const edge = 30;
    for (let y = Math.max(0, Math.floor(cy - radius - edge)); y < Math.min(MAP_HEIGHT, cy + radius + edge); y++) {
      for (let x = Math.max(0, Math.floor(cx - radius - edge)); x < Math.min(MAP_WIDTH, cx + radius + edge); x++) {
        const i = y * MAP_WIDTH + x;
        if (!this.fog[i]) continue;
        const fog = Math.min(1, Math.max(0, (Math.hypot(x - cx, y - cy) - radius + 12) / edge));
        if (fog <= bayer(x, y)) this.fog[i] = 0;
      }
    }
  }

  scrollTo(x: number, y: number) {
    this.camera.x = Math.max(0, Math.min(MAP_WIDTH - MAP_VIEW.width, x));
    this.camera.y = Math.max(0, Math.min(MAP_HEIGHT - MAP_VIEW.height, y));
  }

  centreOn(x: number, y: number) {
    this.scrollTo(x - MAP_VIEW.width / 2, y - MAP_VIEW.height / 2);
  }

  /** Map coordinates under a point of the screen, or null outside the map view. */
  toMap(screenX: number, screenY: number): Point | null {
    const x = screenX - MAP_VIEW.x;
    const y = screenY - MAP_VIEW.y;
    if (x < 0 || y < 0 || x >= MAP_VIEW.width || y >= MAP_VIEW.height) return null;
    return [x + Math.round(this.camera.x), y + Math.round(this.camera.y)];
  }

  compose(tick: number): Bitmap {
    const { screen, fog } = this;
    const map = this.map.data;
    const wild = this.wild.data;
    screen.data.set(this.frame.data);
    const cx = Math.round(this.camera.x);
    const cy = Math.round(this.camera.y);
    for (let y = 0; y < MAP_VIEW.height; y++) {
      const row = (cy + y) * MAP_WIDTH + cx;
      let o = (MAP_VIEW.y + y) * SCREEN.width + MAP_VIEW.x;
      for (let x = 0; x < MAP_VIEW.width; x++, o++) {
        const i = row + x;
        screen.data[o] = fog[i] ? FOG_LUT[wild[i]] : map[i];
      }
    }
    for (const { at: [x, y], today } of this.route) {
      const sx = MAP_VIEW.x + x - cx;
      const sy = MAP_VIEW.y + y - cy;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) this.dot(sx + i, sy + j, i === 0 && j === 0 ? (today ? GOLD[6] : RED[4]) : INK);
    }
    this.animated.sort((a, b) => footY(a) - footY(b));
    for (const o of this.animated) {
      if (this.isFogged(o.x + o.sprite.width / 2, footY(o) - 2)) continue;
      const image = o.frames ? o.frames[(o.frame ?? tick) % o.frames.length] : o.sprite;
      blit(screen, image, MAP_VIEW.x + Math.round(o.x) - cx, MAP_VIEW.y + Math.round(o.y) - cy, MAP_VIEW);
    }
    for (const i of this.grain) screen.data[i] = GRAIN_LUT[screen.data[i]];
    blit(screen, this.overlay, 0, 0);
    return screen;
  }

  private dot(x: number, y: number, color: number) {
    if (x >= MAP_VIEW.x && y >= MAP_VIEW.y && x < MAP_VIEW.x + MAP_VIEW.width && y < MAP_VIEW.y + MAP_VIEW.height) this.screen.set(x, y, color);
  }
}
