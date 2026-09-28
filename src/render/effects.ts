import { Bitmap } from './bitmap';
import type { Point } from '../rules/map/geometry';
import { bayer } from './noise';
import { DIRT, GOLD, INK, NEUTRAL, STONE } from './palette';
import { textMask } from './text';

type Mote = { x: number; y: number; vx: number; vy: number; age: number; life: number };
/** Words that rise off the map and fade: "+250 gold". `age` starts below 0 when it waits its turn. */
type Floater = { x: number; y: number; sprite: Bitmap; age: number };
/** A burst at a point: dust where a foe went down, glitter where treasure was, a golden ring for a level. */
type Puff = { x: number; y: number; age: number; life: number; kind: 'dust' | 'sparkle' | 'glow' };
const FLOAT_LIFE = 1.7;
/** Seconds between words rising from the same spot. */
const FLOAT_GAP = 0.35;

type Bird = { home: Point; angle: number; radius: number; x: number; y: number; vx: number; vy: number; fleeing: boolean; flap: number };

const DUST = [DIRT[7], DIRT[6], DIRT[5], DIRT[4]];

/** Small touches of life: dust behind the horse on roads, and crows that scatter when he comes near. */
export class Effects {
  private readonly motes: Mote[] = [];
  private readonly birds: Bird[] = [];
  private floaters: Floater[] = [];
  private puffs: Puff[] = [];

  /** Words rising from map point (x, y), outlined so they read over anything; `delay` seconds later. */
  floatText(x: number, y: number, text: string, colour: number, delay = 0) {
    const mask = textMask(text, 16);
    const sprite = new Bitmap(mask.width + 2, mask.height + 2);
    for (let j = -1; j <= mask.height; j++) {
      for (let i = -1; i <= mask.width; i++) {
        if (mask.solid(i, j)) sprite.set(i + 1, j + 1, colour);
        else if ([-1, 0, 1].some((dj) => [-1, 0, 1].some((di) => mask.solid(i + di, j + dj)))) sprite.set(i + 1, j + 1, INK);
      }
    }
    // Words rising from the same spot keep apart: each waits a moment after the one before.
    for (const f of this.floaters) if (Math.abs(f.x + f.sprite.width / 2 - x) < 48 && Math.abs(f.y - y) < 48) delay = Math.max(delay, FLOAT_GAP - f.age);
    this.floaters.push({ x: x - sprite.width / 2, y, sprite, age: -delay });
  }

  puff(x: number, y: number, kind: Puff['kind']) {
    this.puffs.push({ x, y, age: 0, life: kind === 'glow' ? 1.2 : kind === 'sparkle' ? 0.8 : 0.6, kind });
  }

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
    for (const f of this.floaters) f.age += dt;
    this.floaters = this.floaters.filter((f) => f.age < FLOAT_LIFE);
    for (const p of this.puffs) p.age += dt;
    this.puffs = this.puffs.filter((p) => p.age < p.life);
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
    for (const p of this.puffs) this.drawPuff(put, ox + p.x, oy + p.y, p);
    for (const f of this.floaters) {
      if (f.age < 0) continue;
      const fade = Math.max(0, (f.age - FLOAT_LIFE + 0.5) / 0.5);
      const x0 = Math.round(ox + f.x);
      const y0 = Math.round(oy + f.y - Math.min(1, f.age / 0.9) * 22);
      for (let j = 0; j < f.sprite.height; j++) {
        for (let i = 0; i < f.sprite.width; i++) {
          const v = f.sprite.data[j * f.sprite.width + i];
          if (v && bayer(i, j) >= fade) put(x0 + i, y0 + j, v);
        }
      }
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

  private drawPuff(put: (x: number, y: number, c: number) => void, cx: number, cy: number, p: Puff) {
    const t = p.age / p.life;
    if (p.kind === 'dust') {
      for (let k = 0; k < 6; k++) {
        const px = cx + (k - 2.5) * 6 + Math.sin(k * 2.3) * 2;
        const py = cy - 4 - t * 14 - (k % 3) * 4;
        const r = 3 + t * 6 + (k % 2);
        for (let y = Math.floor(py - r); y <= py + r; y++) {
          for (let x = Math.floor(px - r); x <= px + r; x++) {
            const d = Math.hypot(x - px, (y - py) * 1.2) / r;
            if (d <= 1 && bayer(x, y) >= t * 0.9) put(x, y, d > 0.6 ? STONE[3] : STONE[5]);
          }
        }
      }
    } else if (p.kind === 'sparkle') {
      for (let k = 0; k < 12; k++) {
        const a = k * 0.52 + 0.3;
        const r = 4 + t * 22 * (0.6 + (k % 3) * 0.2);
        const x = Math.round(cx + Math.cos(a) * r);
        const y = Math.round(cy - 10 + Math.sin(a) * r * 0.6 - t * 10);
        if ((k + Math.floor(p.age * 20)) % 3 === 0) continue;
        put(x, y, k % 2 ? GOLD[6] : NEUTRAL[7]);
        if (t < 0.5) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(x + dx, y + dy, GOLD[4]);
      }
    } else {
      // A golden ring swelling out from his feet, and rays going up.
      const r = 6 + t * 44;
      for (let a = 0; a < Math.PI * 2; a += 0.02) {
        const x = Math.round(cx + Math.cos(a) * r);
        const y = Math.round(cy + Math.sin(a) * r * 0.4);
        if (bayer(x, y) >= t) put(x, y, t < 0.5 ? GOLD[6] : GOLD[4]);
      }
      for (let k = 0; k < 10; k++) {
        const x = Math.round(cx + (k - 4.5) * 7);
        const top = cy - 20 - t * 60 - (k % 3) * 8;
        for (let y = Math.floor(top); y < top + 10 * (1 - t); y++) if (bayer(x, y) >= t * 0.8) put(x, y, k % 2 ? GOLD[6] : NEUTRAL[7]);
      }
    }
  }
}
