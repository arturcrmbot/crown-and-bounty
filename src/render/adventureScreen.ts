import { Bitmap, blit } from './bitmap';
import { MAP_VIEW, paintFrame, SCREEN } from './frame';
import { MAP_HEIGHT, MAP_WIDTH } from './lookTestMap';

/** `x` and `y` are the sprite's top-left in map pixels. `frames` animate it (flags, wheels). */
export type Placed = { sprite: Bitmap; frames?: Bitmap[]; x: number; y: number };

const footY = (o: Placed) => o.y + o.sprite.height;

/**
 * The adventure screen. Static objects are baked into the map once, back to front, and only the
 * animated ones are drawn each frame, so scrolling is just copying rows.
 */
export class AdventureScreen {
  readonly screen = new Bitmap(SCREEN.width, SCREEN.height);
  readonly frame: Bitmap;
  private readonly overlay: Bitmap;
  private readonly map: Bitmap;
  private readonly animated: Placed[] = [];
  readonly camera = { x: 0, y: 0 };

  constructor(map: Bitmap) {
    const { frame, overlay } = paintFrame();
    this.frame = frame;
    this.overlay = overlay;
    this.map = map;
  }

  bake(objects: Placed[]) {
    for (const o of [...objects].sort((a, b) => footY(a) - footY(b))) blit(this.map, o.sprite, Math.round(o.x), Math.round(o.y));
  }

  animate(object: Placed) {
    this.animated.push(object);
    this.animated.sort((a, b) => footY(a) - footY(b));
  }

  scrollTo(x: number, y: number) {
    this.camera.x = Math.max(0, Math.min(MAP_WIDTH - MAP_VIEW.width, x));
    this.camera.y = Math.max(0, Math.min(MAP_HEIGHT - MAP_VIEW.height, y));
  }

  centreOn(x: number, y: number) {
    this.scrollTo(x - MAP_VIEW.width / 2, y - MAP_VIEW.height / 2);
  }

  compose(tick: number): Bitmap {
    const { screen, map } = this;
    screen.data.set(this.frame.data);
    const cx = Math.round(this.camera.x);
    const cy = Math.round(this.camera.y);
    for (let y = 0; y < MAP_VIEW.height; y++) {
      const from = (cy + y) * MAP_WIDTH + cx;
      screen.data.set(map.data.subarray(from, from + MAP_VIEW.width), (MAP_VIEW.y + y) * SCREEN.width + MAP_VIEW.x);
    }
    for (const { sprite, frames, x, y } of this.animated) {
      const image = frames ? frames[tick % frames.length] : sprite;
      blit(screen, image, MAP_VIEW.x + Math.round(x) - cx, MAP_VIEW.y + Math.round(y) - cy, MAP_VIEW);
    }
    blit(screen, this.overlay, 0, 0);
    return screen;
  }
}
