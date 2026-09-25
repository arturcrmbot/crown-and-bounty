import { Bitmap, outline, SHADOW } from './bitmap';
import { hash, noise, rng } from './noise';
import { BLUE, DIRT, GOLD, INK, LEAF, NEUTRAL, PARCHMENT, PINE, RED, ROCK, SKIN, STONE, WATER, WOOD } from './palette';

/** Light comes from the top left and a little towards the viewer, as on the painted HoMM2 maps. */
const L = (() => {
  const v = [-0.62, -0.55, 0.56];
  const n = Math.hypot(...v);
  return v.map((c) => c / n);
})();

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const OUTSIDE = -9;

const four = (ramp: readonly number[], a: number, b: number, c: number, d: number) => [ramp[a], ramp[b], ramp[c], ramp[d]];
const OAK4 = four(LEAF, 2, 4, 6, 8);
const PINE4 = four(PINE, 1, 3, 5, 7);
const ROCK4 = four(ROCK, 2, 4, 6, 7);
const STONE4 = four(STONE, 2, 3, 5, 6);
const WOOD4 = four(WOOD, 1, 2, 4, 5);
const RED4 = four(RED, 1, 2, 3, 5);
const BLUE4 = four(BLUE, 1, 2, 4, 5);
const GOLD4 = four(GOLD, 2, 3, 5, 6);
const COAT4 = four(NEUTRAL, 3, 5, 6, 7);
const PLASTER4 = four(PARCHMENT, 2, 3, 5, 6);
const DIRT4 = four(DIRT, 1, 3, 5, 6);

/** Four flat shades per material, like hand-placed pixels: no gradients, ragged band edges. */
function flat(shades: readonly number[], level: number, x: number, y: number): number {
  const v = clamp01(level + (hash(x, y, 999) - 0.5) * 0.08);
  return shades[Math.min(3, Math.floor(v * 4))];
}

/** Lambert light on a sphere of radius r centred at (cx, cy), or OUTSIDE if the pixel misses it. */
function sphere(x: number, y: number, cx: number, cy: number, r: number): number {
  const dx = (x + 0.5 - cx) / r;
  const dy = (y + 0.5 - cy) / r;
  const d2 = dx * dx + dy * dy;
  if (d2 > 1) return OUTSIDE;
  const dz = Math.sqrt(1 - d2);
  return dx * L[0] + dy * L[1] + dz * L[2];
}

/** A soft oval shadow to the lower right of an object's foot. */
function shadowOval(sprite: Bitmap, cx: number, cy: number, rx: number, ry: number) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const u = (x + 0.5 - cx) / rx;
      const v = (y + 0.5 - cy) / ry;
      if (u * u + v * v <= 1) sprite.under(x, y, SHADOW);
    }
  }
}

/** Casts the sprite's silhouette as a shadow offset by (dx, dy), only below `fromY`. */
function castShadow(sprite: Bitmap, dx: number, dy: number, fromY: number) {
  const body = sprite.data.slice();
  const { width, height } = sprite;
  for (let y = Math.max(0, Math.floor(fromY)); y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = x - dx;
      const sy = y - dy;
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
      if (body[sy * width + sx] !== 0 && body[y * width + x] === 0) sprite.data[y * width + x] = SHADOW;
    }
  }
}

/** Round broadleaf tree: a few leafy blobs lit from the top left, a trunk and a shadow. */
export function oak(seed: number, size = 30): Bitmap {
  const random = rng(seed);
  size += Math.floor(random() * size * 0.2);
  const sprite = new Bitmap(size + 8, size + 6);
  const cx = sprite.width / 2 - 2;
  const top = 4;
  const r = size * 0.3;
  const blobs = [{ x: cx, y: top + r, r }];
  for (let i = 0; i < 4; i++) {
    const a = random() * Math.PI * 2;
    blobs.push({ x: cx + Math.cos(a) * r * 0.55, y: top + r * 1.15 + Math.sin(a) * r * 0.45, r: r * (0.55 + random() * 0.25) });
  }
  const trunkTop = top + r * 1.7;
  const foot = sprite.height - 6;
  const trunk = size < 20 ? 1 : 2;
  for (let y = Math.floor(trunkTop); y < foot; y++) {
    for (let x = Math.floor(cx - trunk); x < cx + trunk; x++) {
      const t = (x + 0.5 - (cx - trunk)) / (trunk * 2);
      sprite.set(x, y, flat(WOOD4, 0.75 - t * 0.6 + (hash(x, y, seed) - 0.5) * 0.2, x, y));
    }
  }
  for (let y = 0; y < sprite.height; y++) {
    for (let x = 0; x < sprite.width; x++) {
      let best = OUTSIDE;
      for (const b of blobs) best = Math.max(best, sphere(x, y, b.x, b.y, b.r));
      if (best === OUTSIDE) continue;
      const clumps = (noise(x / 2.6, y / 2.6, seed) - 0.5) * 0.55 + (hash(x, y, seed + 1) - 0.5) * 0.14;
      sprite.set(x, y, flat(OAK4, clamp01(0.08 + best * 0.9 + clumps), x, y));
    }
  }
  const shaped = outline(sprite, LEAF[0]);
  shadowOval(shaped, cx + size * 0.16, foot, r * 1.05, Math.max(1.6, size * 0.1));
  return shaped;
}

/** Conifer: stacked jagged tiers, lit on the left. */
export function pine(seed: number, height = 34): Bitmap {
  const random = rng(seed);
  height += Math.floor(random() * height * 0.25);
  const scale = height / 38;
  const sprite = new Bitmap(Math.ceil(28 * scale) + 4, height + 4);
  const cx = sprite.width / 2 - 1.5;
  const foot = height - 1;
  const trunkLength = Math.max(2, Math.round(5 * scale));
  for (let y = foot - trunkLength; y < foot; y++) {
    for (let x = Math.floor(cx - 1); x < cx + 1; x++) sprite.set(x, y, flat(WOOD4, 0.6 - (x - cx + 1) * 0.3, x, y));
  }
  const tiers = height < 22 ? 3 : 4;
  for (let t = 0; t < tiers; t++) {
    const tierTop = 1 + t * (height - trunkLength - 4) * (0.8 / tiers);
    const tierBottom = tierTop + (height - trunkLength - 4) * (1.7 / tiers);
    const halfBase = (5 + t * 2.3) * scale + 1;
    for (let y = Math.floor(tierTop); y < tierBottom; y++) {
      const k = (y - tierTop) / (tierBottom - tierTop);
      const half = halfBase * k + (hash(Math.floor(y), t, seed) - 0.5) * 1.6;
      for (let x = Math.floor(cx - half); x <= cx + half; x++) {
        const u = (x + 0.5 - cx) / Math.max(half, 1);
        const light = 0.62 - u * 0.42 - (1 - k) * 0.05 + k * 0.08 - (k > 0.85 ? 0.28 : 0);
        sprite.set(x, y, flat(PINE4, clamp01(light + (hash(x, y, seed + t) - 0.5) * 0.3 - 0.08), x, y));
      }
    }
  }
  const shaped = outline(sprite, PINE[0]);
  shadowOval(shaped, cx + 5 * scale, foot, 8 * scale + 1, Math.max(1.4, 2.4 * scale));
  return shaped;
}

/** A lone boulder. */
export function boulder(seed: number, size: number): Bitmap {
  const random = rng(seed);
  const sprite = new Bitmap(size + 6, Math.ceil(size * 0.8) + 4);
  const cx = size / 2 + 1;
  const cy = size * 0.45 + 1;
  const squash = 0.75 + random() * 0.2;
  for (let y = 0; y < sprite.height; y++) {
    for (let x = 0; x < sprite.width; x++) {
      const light = sphere(x, (y - cy) / squash + cy, cx, cy, size / 2);
      if (light === OUTSIDE) continue;
      const facets = (noise(x / 2, y / 2, seed) - 0.5) * 0.4;
      sprite.set(x, y, flat(ROCK4, clamp01(0.25 + light * 0.75 + facets), x, y));
    }
  }
  const shaped = outline(sprite, ROCK[0]);
  castShadow(shaped, 3, 1, cy);
  return shaped;
}

/**
 * A chunky rock outcrop: a few blocky crags, each with a lit top, a lit left face and a dark
 * right face, plus a crack or two. Reads as rock from far away, like the painted HoMM2 hills.
 */
export function crag(width: number, height: number, seed: number): Bitmap {
  const random = rng(seed);
  const sprite = new Bitmap(width + 12, height + 6);
  const count = 3 + Math.floor(random() * 3);
  const blocks = Array.from({ length: count }, (_, i) => {
    const middle = 1 - Math.abs((i + 0.5) / count - 0.5) * 1.6;
    const w = width * (0.28 + random() * 0.2);
    return {
      cx: width * ((i + 0.5) / count) + (random() - 0.5) * width * 0.12 + 4,
      base: height - random() * height * 0.22,
      w,
      h: height * (0.45 + middle * 0.45 + random() * 0.15),
      lean: (random() - 0.5) * 0.5,
    };
  }).sort((a, b) => a.base - b.base);
  for (const [n, b] of blocks.entries()) {
    const peak = b.cx + b.w * (b.lean * 0.4 - 0.05);
    const top = (x: number) => {
      const u = (x - (b.cx - b.w / 2)) / b.w;
      if (u < 0 || u > 1) return Infinity;
      const shoulder = u < 0.45 ? 1 - Math.pow((0.45 - u) / 0.45, 1.6) * 0.55 : 1 - Math.pow((u - 0.45) / 0.55, 1.3) * 0.65;
      return b.base - b.h * shoulder + (noise(x / 2.2, n, seed) - 0.5) * 3;
    };
    for (let x = Math.floor(b.cx - b.w / 2); x <= b.cx + b.w / 2; x++) {
      const t = top(x);
      for (let y = Math.floor(t); y < b.base; y++) {
        const ridge = peak + (y - (b.base - b.h)) * b.lean;
        let level = x < ridge ? 0.6 : 0.3;
        if (y - t < 2.5) level = 0.9;
        if (Math.abs(x - ridge) < 0.8 && y - t > 3) level = 0.45;
        level += (noise(x / 3, y / 3, seed + n) - 0.5) * 0.25 - ((y - t) / b.h) * 0.12;
        sprite.set(x, y, flat(ROCK4, level, x, y));
      }
    }
    // A crack running down the lit face.
    let cx = b.cx - b.w * 0.2;
    for (let y = Math.ceil(b.base - b.h * 0.7); y < b.base - 2; y++) {
      cx += (hash(Math.floor(cx), y, seed + n) - 0.5) * 1.4;
      if (sprite.get(Math.round(cx), y) !== 0) sprite.set(Math.round(cx), y, ROCK[1]);
    }
  }
  const shaped = outline(sprite, ROCK[0]);
  castShadow(shaped, 7, 2, height * 0.35);
  return shaped;
}

/** Stone courses with staggered joints, lit by `light` in [0, 1]. */
function masonry(x: number, y: number, light: number, seed: number): number {
  const row = Math.floor(y / 3);
  const joint = (x + (row % 2) * 3) % 6 === 0;
  if (y % 3 === 2 || joint) return flat(STONE4, clamp01(light - 0.32), x, y);
  const brick = hash(Math.floor((x + (row % 2) * 3) / 6), row, seed);
  return flat(STONE4, clamp01(light + (brick - 0.5) * 0.22), x, y);
}

function tower(sprite: Bitmap, cx: number, top: number, bottom: number, r: number, roofHeight: number, flag: number) {
  for (let y = top; y < bottom; y++) {
    for (let x = Math.floor(cx - r); x < cx + r; x++) {
      const u = (x + 0.5 - cx) / r;
      const light = 0.74 - u * 0.42 - u * u * 0.3;
      sprite.set(x, y, masonry(x, y, light, 7));
    }
  }
  for (let y = top + 6; y < top + 11; y++) sprite.set(Math.round(cx - 1), y, INK);
  // Conical roof.
  const roofTop = top - roofHeight;
  for (let y = roofTop; y < top + 1; y++) {
    const k = (y - roofTop) / roofHeight;
    const half = (r + 2) * k;
    for (let x = Math.floor(cx - half); x <= cx + half; x++) {
      const u = (x + 0.5 - cx) / Math.max(half, 0.5);
      const stripe = (x + y) % 4 === 0 ? -0.12 : 0;
      sprite.set(x, y, flat(RED4, clamp01(0.78 - u * 0.5 + stripe - (k > 0.92 ? 0.3 : 0)), x, y));
    }
  }
  pennant(sprite, Math.round(cx), roofTop, flag);
}

/** A small flag on a pole. `phase` makes it wave. */
function pennant(sprite: Bitmap, x: number, y: number, phase: number) {
  for (let j = y - 9; j < y; j++) sprite.set(x, j, WOOD[1]);
  for (let i = 1; i < 8; i++) {
    const wave = Math.round(Math.sin(i * 0.8 + phase) * 0.8);
    for (let j = 0; j < 4 - (i > 5 ? 1 : 0); j++) sprite.set(x + i, y - 9 + j + wave, j === 0 ? BLUE[5] : BLUE[3]);
  }
}

/** The King's castle: walls with crenellations, four round towers with red roofs, a keep and a gate. */
export function castle(phase = 0): Bitmap {
  const w = 128;
  const h = 112;
  const sprite = new Bitmap(w, h);
  const wallTop = 58;
  const wallBottom = h - 8;
  const crenellate = (x0: number, x1: number, y: number, light: number) => {
    for (let x = x0; x < x1; x++) {
      const merlon = Math.floor((x - x0) / 4) % 2 === 0;
      for (let j = merlon ? y - 4 : y; j < y; j++) sprite.set(x, j, masonry(x, j, light + 0.12, 3));
    }
  };
  // Back wall and keep.
  for (let y = wallTop - 18; y < wallTop; y++) for (let x = 22; x < w - 22; x++) sprite.set(x, y, masonry(x, y, 0.48, 5));
  crenellate(22, w - 22, wallTop - 18, 0.5);
  for (let y = 22; y < wallTop; y++) {
    for (let x = 50; x < 78; x++) {
      const u = (x - 50) / 28;
      sprite.set(x, y, masonry(x, y, u < 0.5 ? 0.72 : 0.5, 9));
    }
  }
  for (let y = 4; y < 23; y++) {
    const k = (y - 4) / 19;
    const half = 16 * k;
    for (let x = Math.floor(64 - half); x <= 64 + half; x++) {
      const u = (x + 0.5 - 64) / Math.max(half, 0.5);
      sprite.set(x, y, flat(RED4, clamp01(0.8 - u * 0.45 - (k > 0.9 ? 0.35 : 0)), x, y));
    }
  }
  for (const wx of [56, 63, 70]) for (let y = 30; y < 38; y++) sprite.set(wx, y, y === 30 ? STONE[6] : INK);
  pennant(sprite, 64, 4, phase);
  tower(sprite, 26, 34, wallTop, 9, 16, phase + 1);
  tower(sprite, w - 26, 34, wallTop, 9, 16, phase + 2);
  // Front wall with the gate.
  for (let y = wallTop; y < wallBottom; y++) {
    for (let x = 14; x < w - 14; x++) sprite.set(x, y, masonry(x, y, 0.62 - (y - wallTop) * 0.006, 1));
  }
  crenellate(14, w - 14, wallTop, 0.66);
  const gateX = w / 2;
  for (let y = wallBottom - 24; y < wallBottom; y++) {
    for (let x = gateX - 10; x < gateX + 10; x++) {
      const dx = x + 0.5 - gateX;
      const arch = y - (wallBottom - 24) >= 10 - Math.sqrt(Math.max(0, 100 - dx * dx));
      if (!arch) continue;
      const bars = (x - gateX + 10) % 4 === 0 || (y - wallBottom) % 5 === 0;
      sprite.set(x, y, bars ? STONE[2] : Math.abs(dx) > 8.5 ? STONE[6] : INK);
    }
  }
  tower(sprite, 18, 62, wallBottom + 2, 11, 20, phase + 3);
  tower(sprite, w - 18, 62, wallBottom + 2, 11, 20, phase + 4);
  const shaped = outline(sprite, INK);
  castShadow(shaped, 8, 4, 40);
  return shaped;
}

/**
 * The hero: a knight in a red cape on a white horse, carrying the player's blue banner with a gold
 * star. `phase` animates the banner, a gentle bob and the tail; `selected` adds a gold ring.
 */
export function hero(phase = 0, selected = true, walking = false): Bitmap {
  const S = 1.4;
  const sprite = new Bitmap(Math.ceil(40 * S), Math.ceil(46 * S));
  const bob = walking ? (Math.sin(phase * 4) > 0 ? 1 : 0) : Math.sin(phase * 2) > 0.3 ? 1 : 0;
  const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number, a = 0) => {
    const dx = (x + 0.5) / S - cx;
    const dy = (y + 0.5 - bob) / S - cy;
    const u = (dx * Math.cos(a) + dy * Math.sin(a)) / rx;
    const v = (-dx * Math.sin(a) + dy * Math.cos(a)) / ry;
    return u * u + v * v <= 1;
  };
  const each = (x0: number, y0: number, x1: number, y1: number, paint: (x: number, y: number) => void) => {
    for (let y = Math.floor(y0 * S); y < y1 * S + 2; y++) for (let x = Math.floor(x0 * S); x < x1 * S; x++) paint(x, y);
  };
  const lit = (x: number, y: number, cx: number, cy: number, r: number) => {
    const v = sphere(x / S, (y - bob) / S, cx, cy, r);
    return v === OUTSIDE ? 0.4 : 0.35 + v * 0.65;
  };
  // Tail, swishing.
  const swish = Math.sin(phase) * 0.25;
  each(3, 21, 10, 34, (x, y) => {
    if (inEllipse(x, y, 7.6 - ((y / S - 22) * (0.18 + swish * 0.3)), 27.5, 1.7, 6, 0.25 + swish)) sprite.set(x, y, COAT4[0]);
  });
  // Legs trot in diagonal pairs when walking: each swings and lifts in turn.
  const leg = (x0: number, far: boolean, shift: number) => {
    const swing = walking ? Math.sin(phase * Math.PI * 2 + shift) : 0;
    const lift = swing > 0.35 ? 1.2 : 0;
    each(x0 - 3, 30, x0 + 5, 40, (x, y) => {
      const u = x / S - swing * 1.5 * ((y / S - 30) / 10);
      if (u < x0 || u >= x0 + 2 || y / S > 40 - lift) return;
      sprite.set(x, y, y / S > 38 - lift ? INK : flat(COAT4, far ? 0.3 : 0.75 - ((u - x0) / 2) * 0.4, x, y));
    });
  };
  leg(11, true, 0);
  leg(24, true, Math.PI);
  each(6, 18, 30, 34, (x, y) => {
    if (inEllipse(x, y, 18, 27, 10.5, 5.2)) sprite.set(x, y, flat(COAT4, lit(x, y, 16, 24, 12), x, y));
  });
  leg(14, false, Math.PI);
  leg(27, false, 0);
  each(21, 11, 37, 28, (x, y) => {
    const neck = inEllipse(x, y, 27.2, 20.5, 3.4, 6.5, -0.55);
    const head = inEllipse(x, y, 31.5, 15.2, 4.1, 2.4, 0.5);
    if (neck || head) sprite.set(x, y, flat(COAT4, head ? 0.85 - (x / S - 28) * 0.06 : 0.72 - (x / S - 24) * 0.05, x, y));
  });
  each(24, 12, 28, 22, (x, y) => {
    if (inEllipse(x, y, 25.4, 16.8, 0.9, 5, -0.3)) sprite.set(x, y, NEUTRAL[2]);
  });
  const dot = (x: number, y: number, color: number) => sprite.set(Math.round(x * S), Math.round(y * S) + bob, color);
  dot(30, 11, NEUTRAL[5]);
  dot(30, 10, NEUTRAL[4]);
  dot(33, 14, INK);
  // Blue caparison with a gold hem.
  each(10, 24, 25, 32, (x, y) => {
    if (!inEllipse(x, y, 18, 27, 10.5, 5.2) || (y - bob) / S < 24) return;
    const hem = (y - bob) / S > 30.6;
    sprite.set(x, y, hem ? GOLD[4] : flat(BLUE4, 0.62 - ((y - bob) / S - 24) * 0.05, x, y));
  });
  // Rider: cape, armoured body, helmet with a red plume.
  each(8, 11, 17, 27, (x, y) => {
    if (inEllipse(x, y, 13.5 - ((y - bob) / S - 11) * 0.12, 19, 3.2 + ((y - bob) / S - 11) * 0.12, 8)) {
      sprite.set(x, y, flat(RED4, 0.62 - ((y - bob) / S - 11) * 0.03, x, y));
    }
  });
  each(13, 12, 22, 24, (x, y) => {
    if (inEllipse(x, y, 17.4, 18, 3.2, 6)) sprite.set(x, y, flat(STONE4, lit(x, y, 16.4, 16, 5), x, y));
  });
  each(13, 5, 22, 12, (x, y) => {
    if (inEllipse(x, y, 17.4, 8.6, 2.8, 3.2)) sprite.set(x, y, flat(STONE4, lit(x, y, 16.6, 7.6, 3.4) + 0.1, x, y));
  });
  for (let x = 17.6; x < 20.4; x += 0.5) dot(x, 9, INK);
  for (const [x, y] of [[16, 4], [15, 3], [16, 3], [14, 2], [15, 2], [13, 2], [14, 3]]) dot(x, y, RED[4]);
  dot(19.6, 10.2, SKIN[3]);
  // Lance and the blue banner with a gold star.
  const pole = Math.round(21.5 * S);
  for (let y = 0; y < 30 * S; y++) sprite.set(pole, y + bob, y < 1 ? GOLD[5] : WOOD[2]);
  for (let i = 1; i < 13 * S; i++) {
    const wave = Math.round(Math.sin(i / S * 0.65 + phase) * 1.3);
    const depth = 8 * S - (i / S) * 0.35 * S;
    for (let j = 0; j < depth; j++) {
      const u = i / S - 6;
      const v = j / S - 4;
      const star = Math.hypot(u, v) < 1.3 + 0.9 * Math.pow(Math.abs(Math.cos(Math.atan2(v, u) * 2.5)), 6);
      sprite.set(pole + i, Math.round(2 * S) + j + wave + bob, star ? GOLD[5] : flat(BLUE4, j === 0 ? 0.95 : 0.55 - j * 0.02, i, j));
    }
  }
  const shaped = outline(sprite, INK);
  const footY = Math.round(40.5 * S);
  if (selected) {
    for (let a = 0; a < Math.PI * 2; a += 0.01) {
      const x = Math.round(19 * S + Math.cos(a) * 15 * S);
      const y = Math.round(footY + Math.sin(a) * 4 * S);
      if (shaped.get(x, y) === 0) shaped.set(x, y, GOLD[5]);
    }
  }
  shadowOval(shaped, 21 * S, footY, 12 * S, 2.6 * S);
  return shaped;
}

/** A left-right mirror image, for heroes riding west. */
export function mirror(sprite: Bitmap): Bitmap {
  const out = new Bitmap(sprite.width, sprite.height);
  for (let y = 0; y < sprite.height; y++) {
    for (let x = 0; x < sprite.width; x++) out.data[y * sprite.width + x] = sprite.data[y * sprite.width + sprite.width - 1 - x];
  }
  return out;
}

/** Wooden plank bridge running east to west. */
export function bridge(length: number): Bitmap {
  const sprite = new Bitmap(length, 26);
  for (let y = 6; y < 22; y++) {
    for (let x = 0; x < length; x++) {
      const plank = Math.floor(x / 3);
      const seam = x % 3 === 0;
      const light = 0.55 + (hash(plank, 0, 3) - 0.5) * 0.3 - (y > 18 ? 0.3 : 0) + (y < 8 ? 0.15 : 0);
      sprite.set(x, y, seam ? WOOD[1] : flat(WOOD4, clamp01(light), x, y));
    }
  }
  for (const railY of [3, 19]) {
    for (let x = 0; x < length; x++) {
      sprite.set(x, railY, WOOD[5]);
      sprite.set(x, railY + 1, WOOD[3]);
    }
    for (let x = 1; x < length; x += 8) {
      for (let y = railY - 1; y < railY + 6; y++) sprite.set(x, y, y === railY - 1 ? WOOD[6] : WOOD[2]);
      sprite.set(x + 1, railY + 1, WOOD[1]);
    }
  }
  const shaped = outline(sprite, INK);
  for (let x = 2; x < length; x++) for (let y = 23; y < 26; y++) shaped.under(x, y, SHADOW);
  return shaped;
}

export function chest(): Bitmap {
  const sprite = new Bitmap(18, 16);
  for (let y = 3; y < 13; y++) {
    for (let x = 2; x < 15; x++) {
      const band = x === 5 || x === 11;
      const lid = y < 7;
      let color = flat(WOOD4, (lid ? 0.8 : 0.55) - (x - 2) * 0.02, x, y);
      if (band) color = lid ? GOLD[5] : GOLD[3];
      if (y === 7) color = GOLD[4];
      sprite.set(x, y, color);
    }
  }
  sprite.set(8, 8, GOLD[6]);
  sprite.set(8, 9, INK);
  const shaped = outline(sprite, INK);
  shadowOval(shaped, 11, 13.5, 8, 2);
  return shaped;
}

export function goldPile(): Bitmap {
  const sprite = new Bitmap(22, 14);
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 22; x++) {
      const light = sphere(x, y * 1.6, 10, 16, 10);
      if (light === OUTSIDE || y < 3) continue;
      const coin = hash(x >> 1, y, 5) < 0.3 ? 0.18 : 0;
      sprite.set(x, y, flat(GOLD4, clamp01(0.3 + light * 0.7 + coin), x, y));
    }
  }
  for (const [x, y] of [[7, 5], [12, 4], [14, 7]]) sprite.set(x, y, NEUTRAL[7]);
  const shaped = outline(sprite, GOLD[0]);
  shadowOval(shaped, 13, 12, 9, 1.8);
  return shaped;
}

/** Timber-framed walls: white plaster between dark beams, lit on the left. */
function timber(x: number, y: number, x0: number, x1: number, light: number): number {
  const beam = x === x0 || x === x1 - 1 || (x - x0) % 7 === 0 || y % 6 === 0;
  return beam ? flat(WOOD4, 0.3, x, y) : flat(PLASTER4, clamp01(light), x, y);
}

/** Steep roof: thatch or slate, drawn as a gable seen from the south. */
function roof(sprite: Bitmap, x0: number, x1: number, top: number, bottom: number, shades: readonly number[]) {
  for (let y = top; y < bottom; y++) {
    const k = (y - top) / (bottom - top);
    for (let x = x0 - 2; x < x1 + 2; x++) {
      const u = (x - x0) / (x1 - x0);
      const straw = (noise(x / 1.5, y / 4, 81) - 0.5) * 0.3 + (y % 3 === 0 ? -0.1 : 0);
      const level = 0.75 - u * 0.35 - k * 0.2 + straw - (y === bottom - 1 ? 0.3 : 0);
      sprite.set(x, y, flat(shades, level, x, y));
    }
  }
}

export function hut(seed: number): Bitmap {
  const sprite = new Bitmap(34, 32);
  const random = rng(seed);
  const wallTop = 14 + Math.floor(random() * 2);
  for (let y = wallTop; y < 28; y++) for (let x = 5; x < 27; x++) sprite.set(x, y, timber(x, y, 5, 27, 0.8 - (x - 5) * 0.012));
  for (let y = 20; y < 28; y++) for (let x = 14; x < 19; x++) sprite.set(x, y, y === 20 ? WOOD[1] : flat(WOOD4, 0.45, x, y));
  for (const wx of [8, 22]) for (let y = 18; y < 22; y++) for (let x = wx; x < wx + 3; x++) sprite.set(x, y, y === 18 ? WOOD[2] : GOLD[5]);
  roof(sprite, 5, 27, 3, wallTop + 1, DIRT4);
  const shaped = outline(sprite, INK);
  castShadow(shaped, 5, 2, 20);
  return shaped;
}

/** The watermill with its wheel turned to `turn` (0 to 1 round). */
export function mill(turn: number): Bitmap {
  const sprite = new Bitmap(56, 50);
  for (let y = 20; y < 44; y++) for (let x = 16; x < 48; x++) sprite.set(x, y, timber(x, y, 16, 48, 0.8 - (x - 16) * 0.01));
  for (let y = 32; y < 44; y++) for (let x = 36; x < 42; x++) sprite.set(x, y, y === 32 ? WOOD[1] : flat(WOOD4, 0.4, x, y));
  roof(sprite, 16, 48, 4, 21, WOOD4);
  // Wheel on the west wall, seen edge-on: a rim and paddles that roll downwards as it turns.
  const cx = 11;
  const cy = 34;
  const rx = 5;
  const ry = 12;
  for (let k = 0; k < 10; k++) {
    const a = (k / 10 + turn) * Math.PI * 2;
    const y = Math.round(cy + Math.sin(a) * ry);
    const front = Math.cos(a) > 0;
    for (let x = cx - rx; x <= cx + rx; x++) sprite.set(x, y, front ? flat(WOOD4, 0.8 - (x - cx + rx) * 0.05, x, y) : WOOD[1]);
  }
  for (let y = cy - ry; y <= cy + ry; y++) {
    const half = rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2));
    sprite.set(Math.round(cx - half), y, WOOD[2]);
    sprite.set(Math.round(cx + half), y, WOOD[1]);
  }
  for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) sprite.set(x, y, INK);
  for (let x = cx - rx - 3; x <= cx + rx + 3; x++) {
    sprite.set(x, cy + ry + 1, hash(x, Math.floor(turn * 40), 9) < 0.6 ? WATER[9] : WATER[8]);
    if (hash(x, Math.floor(turn * 40), 10) < 0.3) sprite.set(x, cy + ry, WATER[9]);
  }
  const shaped = outline(sprite, INK);
  castShadow(shaped, 6, 2, 30);
  return shaped;
}

/** Square stone watchtower with battlements and a blue flag, on a rocky knoll. */
export function watchtower(phase = 0): Bitmap {
  const sprite = new Bitmap(40, 84);
  const x0 = 10;
  const x1 = 30;
  for (let y = 18; y < 74; y++) {
    for (let x = x0; x < x1; x++) {
      const u = (x - x0) / (x1 - x0);
      sprite.set(x, y, masonry(x, y, 0.78 - u * 0.4 - (y > 64 ? 0.1 : 0), 13));
    }
  }
  for (let x = x0 - 2; x < x1 + 2; x++) {
    for (let y = 12; y < 18; y++) {
      const merlon = Math.floor((x - x0 + 2) / 3) % 2 === 0;
      if (y < 15 && !merlon) continue;
      sprite.set(x, y, masonry(x, y, 0.85 - ((x - x0) / (x1 - x0)) * 0.4, 14));
    }
  }
  for (const [x, y] of [[15, 28], [23, 42], [15, 54]]) for (let j = 0; j < 5; j++) sprite.set(x, y + j, INK);
  for (let y = 64; y < 74; y++) for (let x = 17; x < 23; x++) sprite.set(x, y, y === 64 ? STONE[6] : flat(WOOD4, 0.35, x, y));
  pennant(sprite, 20, 12, phase);
  const shaped = outline(sprite, INK);
  castShadow(shaped, 10, 3, 40);
  return shaped;
}

/** Grey stone bridge with a parapet on each side, running east to west. */
export function stoneBridge(length: number): Bitmap {
  const sprite = new Bitmap(length, 24);
  for (let y = 4; y < 20; y++) {
    for (let x = 0; x < length; x++) {
      const u = x / length;
      const arch = y > 15 && Math.abs(u - 0.5) < 0.3;
      if (arch) {
        sprite.set(x, y, WATER[1]);
        continue;
      }
      const light = y < 7 || y > 15 ? 0.78 - (y > 15 ? 0.3 : 0) : 0.52 + (hash(x >> 2, y >> 1, 91) - 0.5) * 0.2;
      sprite.set(x, y, y < 7 || y > 15 ? masonry(x, y, light, 92) : flat(DIRT4, light, x, y));
    }
  }
  const shaped = outline(sprite, INK);
  for (let x = 2; x < length; x++) for (let y = 21; y < 24; y++) shaped.under(x, y, SHADOW);
  return shaped;
}

export const MINIMAP_COLOURS = { forest: PINE[4], mountain: ROCK[5], castle: BLUE[4], hero: BLUE[6], road: DIRT[5] };

/** One of Baron Grimsby's footmen: red tabard, round shield, spear. */
function footman(sprite: Bitmap, x0: number, y0: number, step: number) {
  const px = (x: number, y: number, c: number) => sprite.set(x0 + x, y0 + y, c);
  for (let y = 14; y < 20; y++) {
    px(4, y + (step && y > 17 ? -1 : 0), WOOD4[0]);
    px(7, y, WOOD4[0]);
  }
  for (let y = 7; y < 15; y++) for (let x = 3; x < 9; x++) px(x, y, x === 5 && y > 8 && y < 13 ? GOLD[5] : flat(RED4, 0.75 - (x - 3) * 0.1, x, y));
  for (let y = 2; y < 7; y++) for (let x = 4; x < 8; x++) px(x, y, y === 5 && x > 5 ? INK : flat(STONE4, 0.8 - (x - 4) * 0.15, x, y));
  for (let y = 9; y < 15; y++) for (let x = 0; x < 4; x++) if (Math.hypot(x - 1.5, y - 11.8) < 2.6) px(x, y, flat(RED4, 0.35 + (x < 2 ? 0.2 : 0), x, y));
  for (let y = -5; y < 17; y++) px(10, y, y < -3 ? STONE[6] : WOOD[3]);
  px(9, 10, SKIN[3]);
}

/** Baron Grimsby's patrol: three footmen under his red banner. */
export function patrol(phase = 0): Bitmap {
  const sprite = new Bitmap(44, 42);
  const march = Math.sin(phase) > 0 ? 1 : 0;
  footman(sprite, 2, 18, march);
  footman(sprite, 24, 16, 1 - march);
  footman(sprite, 13, 22, march);
  for (let y = 0; y < 22; y++) sprite.set(36, y, WOOD[2]);
  for (let i = 1; i < 8; i++) {
    const wave = Math.round(Math.sin(i * 0.8 + phase) * 0.9);
    for (let j = 0; j < 8 - Math.floor(i / 3); j++) sprite.set(36 - i, 1 + j + wave, j === 3 && i > 2 && i < 6 ? GOLD[5] : flat(RED4, 0.7 - j * 0.04, i, j));
  }
  const shaped = outline(sprite, INK);
  shadowOval(shaped, 26, 40, 17, 2.4);
  return shaped;
}

/** A mine mouth in the rock: timber frame, dark shaft, a little cart of ore on rails. */
export function mine(): Bitmap {
  const sprite = crag(64, 44, 77);
  const mouth = { x: 24, y: 22, w: 16, h: 18 };
  for (let y = mouth.y; y < mouth.y + mouth.h; y++) {
    for (let x = mouth.x; x < mouth.x + mouth.w; x++) {
      const post = x < mouth.x + 2 || x >= mouth.x + mouth.w - 2 || y < mouth.y + 2;
      sprite.set(x, y, post ? flat(WOOD4, 0.6 - (x - mouth.x) * 0.02, x, y) : y > mouth.y + 12 ? NEUTRAL[1] : INK);
    }
  }
  for (let x = 20; x < 48; x++) {
    sprite.set(x, 42, x % 3 === 0 ? WOOD[2] : STONE[4]);
    sprite.set(x, 44, STONE[3]);
  }
  for (let y = 35; y < 42; y++) for (let x = 42; x < 52; x++) sprite.set(x, y, y < 37 ? (hash(x, y, 5) < 0.5 ? ROCK[6] : ROCK[4]) : flat(WOOD4, 0.5, x, y));
  return outline(sprite, INK);
}

export function signpost(): Bitmap {
  const sprite = new Bitmap(22, 26);
  for (let y = 4; y < 24; y++) for (let x = 10; x < 12; x++) sprite.set(x, y, x === 10 ? WOOD[4] : WOOD[2]);
  for (let x = 3; x < 19; x++) for (let y = 5; y < 9; y++) sprite.set(x + (y > 6 ? 1 : 0), y, flat(WOOD4, 0.75 - (y - 5) * 0.1, x, y));
  for (let x = 4; x < 17; x++) for (let y = 11; y < 14; y++) sprite.set(x, y, flat(WOOD4, 0.65 - (y - 11) * 0.1, x, y));
  const shaped = outline(sprite, INK);
  shadowOval(shaped, 14, 24, 5, 1.4);
  return shaped;
}

export function well(): Bitmap {
  const sprite = new Bitmap(24, 28);
  for (let y = 16; y < 24; y++) for (let x = 3; x < 19; x++) sprite.set(x, y, y === 16 ? STONE[6] : masonry(x, y, 0.72 - (x - 3) * 0.02, 21));
  for (let x = 5; x < 17; x++) sprite.set(x, 17, INK);
  for (const px of [4, 17]) for (let y = 6; y < 16; y++) sprite.set(px, y, WOOD[2]);
  for (let y = 2; y < 7; y++) for (let x = 1 + (6 - y); x < 22 - (6 - y); x++) sprite.set(x, y, flat(RED4, 0.7 - (x - 1) * 0.02, x, y));
  const shaped = outline(sprite, INK);
  castShadow(shaped, 4, 1, 18);
  return shaped;
}

/** Baron Grimsby's hideout: a muddy log stockade round a timber keep, under his red banner. */
export function hideout(phase = 0): Bitmap {
  const sprite = new Bitmap(76, 70);
  for (let y = 12; y < 44; y++) for (let x = 22; x < 50; x++) sprite.set(x, y, timber(x, y, 22, 50, 0.72 - (x - 22) * 0.012));
  roof(sprite, 22, 50, 0, 14, DIRT4);
  pennant(sprite, 36, 1, phase);
  for (let y = 18; y < 23; y++) for (let x = 33; x < 38; x++) sprite.set(x, y, y === 18 ? WOOD[1] : GOLD[5]);
  // Palisade: sharpened logs, lit on the left, with a gate in the middle.
  for (let x = 2; x < 74; x += 4) {
    const top = 36 + Math.floor(hash(x, 1, 51) * 4);
    const gate = x >= 30 && x < 42;
    for (let y = top; y < 64; y++) {
      for (let i = 0; i < 4; i++) {
        const point = y - top < 2 && (i === 0 || i === 3);
        if (point) continue;
        const color = gate && y > 46 ? (i === 0 ? WOOD[2] : WOOD[1]) : flat(WOOD4, 0.8 - i * 0.18 - (y - top) * 0.005, x + i, y);
        sprite.set(x + i, y, color);
      }
    }
  }
  for (let x = 30; x < 42; x++) sprite.set(x, 46, WOOD[3]);
  const shaped = outline(sprite, INK);
  castShadow(shaped, 7, 3, 44);
  return shaped;
}
