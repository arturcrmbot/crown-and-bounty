import { walkFrame, type HeroRig, type Hitbox } from '../render/adventureScene';
import type { Point } from '../rules/map/geometry';

type Walk = { figure: HeroRig; box?: Hitbox; points: Point[]; lengths: number[]; facing: 1 | -1; t: number; at: Point };

/** How long an enemy's night walk takes to play, in seconds. */
const WALK_TIME = 0.9;

/** Enemy travel poses follow the night's path by distance, with their hit areas moving with them. */
export class Walks {
  private readonly walks = new Map<string, Walk>();

  /** Starts `object` walking from `from` along `path`. A walk still going finishes first. */
  start(id: string, figure: HeroRig, box: Hitbox | undefined, from: Point, path: Point[]) {
    if (path.length === 0) return;
    if (this.walks.has(id)) this.advance(Infinity, id);
    const { object } = figure;
    const points = [from, ...path];
    const lengths = [0];
    for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    const ahead = path.find((point) => point[0] !== from[0]);
    const facing = ahead ? ahead[0] > from[0] ? 1 : -1 : object.frames === figure.idleLeft ? -1 : 1;
    object.frames = facing > 0 ? figure.walk : figure.walkLeft;
    object.frame = walkFrame(0, figure.gait);
    this.walks.set(id, { figure, box, points, lengths, facing, t: 0, at: from });
    this.advance(0, id);
  }

  /** Where a band walking its night's path has got to, if it's walking. */
  where(id: string): Point | null {
    return this.walks.get(id)?.at ?? null;
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
      if (bx !== ax) walk.facing = bx > ax ? 1 : -1;
      walk.at = [ax + (bx - ax) * f, ay + (by - ay) * f];
      const { figure } = walk;
      const { object } = figure;
      const x = walk.at[0] - object.sprite.width / 2;
      const y = walk.at[1] - figure.foot;
      const dx = x - object.x;
      const dy = y - object.y;
      object.x = x;
      object.y = y;
      const stopped = walk.t >= 1;
      object.frames = stopped ? walk.facing > 0 ? figure.idle : figure.idleLeft : walk.facing > 0 ? figure.walk : figure.walkLeft;
      object.frame = stopped ? undefined : walkFrame(walk.lengths[k] + (walk.lengths[k + 1] - walk.lengths[k]) * f, figure.gait);
      if (walk.box) {
        walk.box.x0 += dx;
        walk.box.x1 += dx;
        walk.box.y0 += dy;
        walk.box.y1 += dy;
      }
      if (stopped) this.walks.delete(id);
    }
  }
}
