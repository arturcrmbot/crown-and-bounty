import { Bitmap, blit } from './bitmap';
import type { Point } from '../rules/map/geometry';
import { COIN } from './hud';
import { bayer } from './noise';
import { DIRT, GOLD, INK, NEUTRAL, STONE } from './palette';
import { textMask } from './text';

type Mote = { x: number; y: number; vx: number; vy: number; age: number; life: number };
/**
 * Words that rise off the map and fade: "+250 gold". `age` starts below 0 when it waits its turn.
 * `above` is how far it stands over its own rise to make room for the words that came after it from
 * the same spot, and `lift` how far it has got there.
 */
type Floater = { x: number; y: number; sprite: Bitmap; age: number; above: number; lift: number };
/** A burst at a point: dust where a foe went down, glitter where treasure was, a golden ring for a level, a twinkle on treasure still lying there. */
type Puff = { x: number; y: number; age: number; life: number; kind: 'dust' | 'sparkle' | 'glow' | 'twinkle' | 'glint' | 'feathers' };
/**
 * A coin flying from where gold was found to the gold on the bar, in screen pixels, on a curve
 * through `via`. It pays its share of the gold into the bar's count as it lands.
 */
type Coin = { from: Point; via: Point; to: Point; age: number; gold: number; land: (gold: number) => void };
/** Seconds a coin takes to reach the bar, and between one coin and the next. */
const COIN_TIME = 0.6;
const COIN_GAP = 0.07;
const FLOAT_LIFE = 1.7;
/** Seconds between words rising from the same spot. */
const FLOAT_GAP = 0.35;
/** How far words rise, in pixels, and in how many seconds. */
const FLOAT_RISE = 22;
const FLOAT_RISE_TIME = 0.9;
/** A line of rising words, outline and all, from the tops of its capitals to the tails of its g's and p's. */
const FLOAT_LINE = 18;
/** Seconds a word waits while the words already rising from its spot move up to make room for it. */
const MAKE_ROOM = 0.2;

type Bird = { home: Point; angle: number; radius: number; x: number; y: number; vx: number; vy: number; fleeing: boolean; flap: number };

const DUST = [DIRT[7], DIRT[6], DIRT[5], DIRT[4]];

/** Small touches of life: dust behind the horse on roads, and crows that scatter when he comes near. */
export class Effects {
  private readonly motes: Mote[] = [];
  private readonly birds: Bird[] = [];
  private floaters: Floater[] = [];
  private puffs: Puff[] = [];
  private coins: Coin[] = [];

  /** Words rising from map point (x, y), outlined so they read over anything; `delay` seconds later, with a `picture` before them (gear found). */
  floatText(x: number, y: number, text: string, colour: number, delay = 0, picture?: Bitmap) {
    const mask = textMask(text, 16);
    const left = picture ? picture.width + 3 : 0;
    const sprite = new Bitmap(left + mask.width + 2, Math.max(mask.height + 2, picture?.height ?? 0));
    if (picture) blit(sprite, picture, 0, Math.floor((sprite.height - picture.height) / 2));
    for (let j = -1; j <= mask.height; j++) {
      for (let i = -1; i <= mask.width; i++) {
        if (mask.solid(i, j)) sprite.set(left + i + 1, j + 1, colour);
        else if ([-1, 0, 1].some((dj) => [-1, 0, 1].some((di) => mask.solid(i + di, j + dj)))) sprite.set(left + i + 1, j + 1, INK);
      }
    }
    // Words rising from the same spot keep apart: each waits a moment after the one before, and those
    // already there move up to make room, so they stack in the order they came, top to bottom.
    let below = y;
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      if (Math.abs(f.x + f.sprite.width / 2 - x) >= 48 || Math.abs(f.y - y) >= 48) continue;
      delay = Math.max(delay, FLOAT_GAP - f.age, MAKE_ROOM);
      f.above = Math.max(f.above, f.y - below + FLOAT_LINE);
      below = f.y - f.above;
    }
    this.floaters.push({ x: x - sprite.width / 2, y, sprite, age: -delay, above: 0, lift: 0 });
  }

  puff(x: number, y: number, kind: Puff['kind']) {
    const life = { glow: 1.2, sparkle: 0.8, twinkle: 0.5, glint: 0.6, feathers: 1.4, dust: 0.6 }[kind];
    this.puffs.push({ x, y, age: 0, life, kind });
  }

  /**
   * Gold flying from `from` to `to` (screen pixels) as a handful of coins, `delay` seconds from now,
   * each paying its share into `land` as it gets there, so the count on the bar rolls up as they land.
   */
  flyCoins(from: Point, to: Point, gold: number, delay: number, land: (gold: number) => void) {
    const count = Math.max(3, Math.min(10, Math.ceil(gold / 40)));
    let left = gold;
    for (let i = 0; i < count; i++) {
      const share = i === count - 1 ? left : Math.floor(gold / count);
      left -= share;
      const via: Point = [from[0] + (to[0] - from[0]) * 0.25 + ((i % 3) - 1) * 14, Math.min(from[1], to[1]) - 46 - (i % 2) * 16];
      this.coins.push({ from, via, to, age: -(delay + i * COIN_GAP), gold: share, land });
    }
  }

  /** Whether any coins are still on their way to the bar. */
  get flying() {
    return this.coins.length > 0;
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
    for (const f of this.floaters) {
      f.age += dt;
      f.lift += (f.above - f.lift) * Math.min(1, dt * 10);
    }
    this.floaters = this.floaters.filter((f) => f.age < FLOAT_LIFE);
    for (const p of this.puffs) p.age += dt;
    this.puffs = this.puffs.filter((p) => p.age < p.life);
    for (const c of this.coins) {
      c.age += dt;
      if (c.age >= COIN_TIME) c.land(c.gold);
    }
    this.coins = this.coins.filter((c) => c.age < COIN_TIME);
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

  /** Coins on their way to the bar, over everything: the map, its frame and the bar itself. */
  drawFlights(screen: Bitmap) {
    for (const c of this.coins) {
      if (c.age < 0) continue;
      // They speed up as they go, as if the purse pulled them in.
      const t = Math.min(1, c.age / COIN_TIME) ** 2;
      const x = (1 - t) ** 2 * c.from[0] + 2 * (1 - t) * t * c.via[0] + t * t * c.to[0];
      const y = (1 - t) ** 2 * c.from[1] + 2 * (1 - t) * t * c.via[1] + t * t * c.to[1];
      blit(screen, COIN, Math.round(x - COIN.width / 2), Math.round(y - COIN.height / 2));
    }
  }

  /** The words rising off the map, drawn last of all so no light or weather dims them. */
  drawWords(screen: Bitmap, ox: number, oy: number, clip: { x: number; y: number; width: number; height: number }) {
    for (const f of this.floaters) {
      if (f.age < 0) continue;
      const fade = Math.max(0, (f.age - FLOAT_LIFE + 0.5) / 0.5);
      const x0 = Math.round(ox + f.x);
      const y0 = Math.round(oy + f.y - Math.min(1, f.age / FLOAT_RISE_TIME) * FLOAT_RISE - f.lift);
      for (let j = 0; j < f.sprite.height; j++) {
        for (let i = 0; i < f.sprite.width; i++) {
          const v = f.sprite.data[j * f.sprite.width + i];
          const x = x0 + i;
          const y = y0 + j;
          if (v && bayer(i, j) >= fade && x >= clip.x && y >= clip.y && x < clip.x + clip.width && y < clip.y + clip.height) screen.set(x, y, v);
        }
      }
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
    } else if (p.kind === 'glint') {
      // Through the edge of the mist: a smaller star, in gold alone, so it reads as something far off (#192).
      const arm = Math.round(Math.sin(t * Math.PI) * 2);
      put(Math.round(cx), Math.round(cy), GOLD[6]);
      for (let k = 1; k <= arm; k++) for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k]]) put(Math.round(cx) + dx, Math.round(cy) + dy, GOLD[4]);
    } else if (p.kind === 'feathers') {
      // A lost goose going home (#192): white feathers thrown up, drifting down and swaying as they fall.
      for (let k = 0; k < 9; k++) {
        const a = -Math.PI / 2 + (k - 4) * 0.32;
        const up = Math.min(t * 3, 1);
        const x = Math.round(cx + Math.cos(a) * (6 + k * 1.5) * up + Math.sin(p.age * 6 + k) * 2 * t);
        const y = Math.round(cy - 8 + Math.sin(a) * 16 * up + t * t * 22);
        if (bayer(x, y) < t * 0.7) continue;
        put(x, y, NEUTRAL[7]);
        put(x + (k % 2 ? 1 : -1), y, NEUTRAL[5]);
      }
    } else if (p.kind === 'twinkle') {
      // A little four-pointed star that opens and closes again, white at its heart so it shows on gold.
      const arm = Math.round(Math.sin(t * Math.PI) * 4);
      put(Math.round(cx), Math.round(cy), NEUTRAL[7]);
      for (let k = 1; k <= arm; k++) {
        const colour = k === arm ? GOLD[5] : k === 1 ? NEUTRAL[7] : GOLD[6];
        for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k]]) put(Math.round(cx) + dx, Math.round(cy) + dy, colour);
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
