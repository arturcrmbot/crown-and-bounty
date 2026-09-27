import type { Hitbox } from '../render/adventureScene';
import type { Placed } from '../render/adventureScreen';
import type { Point } from '../rules/map/geometry';

type Walk = { object: Placed; box?: Hitbox; points: Point[]; t: number; offset: Point };

/** How long an enemy's night walk takes to play, in seconds. */
const WALK_TIME = 0.9;

/** Enemy sprites gliding along the paths they walked in the night, their hit areas moving with them. */
export class Walks {
  private readonly walks = new Map<string, Walk>();

  /** Starts `object` walking from `from` along `path`. A walk still going finishes first. */
  start(id: string, object: Placed, box: Hitbox | undefined, from: Point, path: Point[]) {
    if (path.length === 0) return;
    if (this.walks.has(id)) this.advance(Infinity, id);
    this.walks.set(id, { object, box, points: [from, ...path], t: 0, offset: [object.x - from[0], object.y - from[1]] });
  }

  advance(dt: number, only?: string) {
    for (const [id, walk] of this.walks) {
      if (only && id !== only) continue;
      walk.t = Math.min(1, walk.t + dt / WALK_TIME);
      const seg = walk.t * (walk.points.length - 1);
      const k = Math.min(walk.points.length - 2, Math.floor(seg));
      const f = seg - k;
      const [ax, ay] = walk.points[k];
      const [bx, by] = walk.points[k + 1] ?? walk.points[k];
      const dx = ax + (bx - ax) * f + walk.offset[0] - walk.object.x;
      const dy = ay + (by - ay) * f + walk.offset[1] - walk.object.y;
      walk.object.x += dx;
      walk.object.y += dy;
      if (walk.box) {
        walk.box.x0 += dx;
        walk.box.x1 += dx;
        walk.box.y0 += dy;
        walk.box.y1 += dy;
      }
      if (walk.t >= 1) this.walks.delete(id);
    }
  }
}
