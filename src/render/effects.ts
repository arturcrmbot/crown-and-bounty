import type { Bitmap } from './bitmap';
import type { Point } from '../rules/map/geometry';
import { DIRT, INK, NEUTRAL } from './palette';

type Mote = { x: number; y: number; vx: number; vy: number; age: number; life: number };
type Bird = { home: Point; angle: number; radius: number; x: number; y: number; vx: number; vy: number; fleeing: boolean; flap: number };

const DUST = [DIRT[7], DIRT[6], DIRT[5], DIRT[4]];

/** Small touches of life: dust behind the horse on roads, and crows that scatter when he comes near. */
export class Effects {
  private readonly motes: Mote[] = [];
  private readonly birds: Bird[] = [];

  /** A few crows circling above `home`, until someone rides within `shyness` pixels. */
  addFlock(home: Point, count: number, seed = 1) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + seed;
      this.birds.push({ home, angle, radius: 14 + ((i * 7 + seed) % 11), x: home[0], y: home[1], vx: 0, vy: 0, fleeing: false, flap: i * 0.37 });
    }
  }

  dust(x: number, y: number, facing: number) {
    for (let i = 0; i < 2; i++) {
      this.motes.push({ x: x + (Math.random() - 0.5) * 4, y: y - Math.random() * 2, vx: -facing * (6 + Math.random() * 10), vy: -4 - Math.random() * 6, age: 0, life: 0.45 + Math.random() * 0.35 });
    }
  }

  update(dt: number, rider: Point, shyness = 80) {
    for (const m of this.motes) {
      m.age += dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.vy += 14 * dt;
    }
    for (let i = this.motes.length - 1; i >= 0; i--) if (this.motes[i].age >= this.motes[i].life) this.motes.splice(i, 1);
    for (const b of this.birds) {
      b.flap += dt * (b.fleeing ? 9 : 5);
      if (!b.fleeing && Math.hypot(rider[0] - b.home[0], rider[1] - b.home[1]) < shyness) {
        b.fleeing = true;
        const away = Math.atan2(b.y - rider[1], b.x - rider[0]);
        b.vx = Math.cos(away) * 70;
        b.vy = Math.sin(away) * 40 - 50;
      }
      if (b.fleeing) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      } else {
        b.angle += dt * 0.9;
        b.x = b.home[0] + Math.cos(b.angle) * b.radius;
        b.y = b.home[1] + Math.sin(b.angle) * b.radius * 0.45;
      }
    }
    for (let i = this.birds.length - 1; i >= 0; i--) if (this.birds[i].fleeing && this.birds[i].y < -40) this.birds.splice(i, 1);
  }

  /** Draws into `screen`, where map point (0, 0) lands at (ox, oy). `visible` hides dust under fog. */
  draw(screen: Bitmap, ox: number, oy: number, clip: { x: number; y: number; width: number; height: number }, visible: (x: number, y: number) => boolean) {
    const put = (x: number, y: number, c: number) => {
      if (x >= clip.x && y >= clip.y && x < clip.x + clip.width && y < clip.y + clip.height) screen.set(x, y, c);
    };
    for (const m of this.motes) {
      if (!visible(m.x, m.y)) continue;
      put(Math.round(ox + m.x), Math.round(oy + m.y), DUST[Math.min(DUST.length - 1, Math.floor((m.age / m.life) * DUST.length))]);
    }
    // Birds show even over fog: circling crows are how you spot the old watchtower from afar.
    for (const b of this.birds) {
      const x = Math.round(ox + b.x);
      const y = Math.round(oy + b.y);
      const up = Math.sin(b.flap * Math.PI) > 0;
      put(x, y, INK);
      put(x - 1, y + (up ? -1 : 0), INK);
      put(x + 1, y + (up ? -1 : 0), INK);
      put(x - 2, y + (up ? -1 : 1), NEUTRAL[1]);
      put(x + 2, y + (up ? -1 : 1), NEUTRAL[1]);
    }
  }
}
