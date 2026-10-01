import { Bitmap, outline, SHADOW } from './bitmap';
import { hash, noise, rng } from './noise';
import { BLUE, DIRT, EARTH, FOG, GOLD, INK, LEAF, NEUTRAL, PARCHMENT, PINE, PLUM, RED, REED, ROCK, SKIN, STONE, WATER, WOOD } from './palette';

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
export function hero(phase = 0, selected = true, walking = false, S = 1.4): Bitmap {
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
  if (S > 2) each(12, 1, 17, 6, (x, y) => inEllipse(x, y, 14.6, 3.2, 2.4, 1.3, -0.4) && sprite.set(x, y, flat(RED4, 0.7 - ((y - bob) / S - 2) * 0.1, x, y)));
  dot(19.6, 10.2, SKIN[3]);
  // Lance and the blue banner with a gold star.
  const pole = Math.round(21.5 * S);
  for (let y = 0; y < 30 * S; y++) for (let w = 0; w < Math.max(1, Math.round(S / 1.6)); w++) sprite.set(pole - w, y + bob, y < 1 ? GOLD[5] : w ? WOOD[1] : WOOD[2]);
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

/**
 * A treasure chest, about two-thirds of a tile across: an arched lid, iron bands and a gold lock.
 * `open`, its lid stands up behind the box, and it is empty.
 */
export function chest(open = false): Bitmap {
  const sprite = new Bitmap(26, 22);
  const [x0, x1, top, lidEdge, bottom] = [3, 22, 4, 11, 19];
  for (let y = top; y < bottom; y++) {
    for (let x = x0; x < x1; x++) {
      const lid = y < lidEdge;
      // The lid bulges: its corners are cut round. Open, it stands up behind the box, thinner.
      if (lid && open && y < lidEdge - 4) continue;
      if (lid && !open && y < top + 2 && (x < x0 + 2 - (y - top) || x >= x1 - 2 + (y - top))) continue;
      const band = x === x0 + 4 || x === x1 - 5;
      let color = flat(WOOD4, (lid ? 0.82 : 0.56) - (x - x0) * 0.018 - (lid ? (y - top) * 0.02 : 0), x, y);
      if (band) color = lid ? STONE[5] : STONE[3];
      if (y === lidEdge) color = open ? WOOD[0] : GOLD[4];
      if (open && y === lidEdge + 1 && x > x0 && x < x1 - 1) color = WOOD[1];
      if (y === bottom - 1) color = WOOD[1];
      sprite.set(x, y, color);
    }
  }
  const mid = Math.floor((x0 + x1) / 2);
  if (!open) for (let y = lidEdge - 1; y < lidEdge + 3; y++) for (let x = mid - 1; x <= mid + 1; x++) sprite.set(x, y, y === lidEdge + 1 && x === mid ? INK : GOLD[x < mid ? 6 : 5]);
  const shaped = outline(sprite, INK);
  shadowOval(shaped, 15, 19.5, 11, 2.4);
  return shaped;
}

/**
 * Small things lying by the road, each half a tile across (#192): a purse with a coin beside it, a
 * sheaf of oats tied round its middle, a few blue crystals, and a folded letter with a red seal.
 */
export function wayside(look: 'purse' | 'oats' | 'crystals' | 'letter'): Bitmap {
  const sprite = new Bitmap(18, 15);
  if (look === 'letter') {
    for (let y = 5; y < 12; y++) for (let x = 3; x < 15; x++) sprite.set(x, y, flat(PARCHMENT, 0.92 - (y - 5) * 0.035 - (x - 3) * 0.012, x, y));
    // The flap folds down to the seal.
    for (let i = 0; i < 6; i++) {
      sprite.set(3 + i, 5 + Math.floor(i * 0.55), PARCHMENT[2]);
      sprite.set(14 - i, 5 + Math.floor(i * 0.55), PARCHMENT[2]);
    }
    for (const [x, y, c] of [[8, 8, RED[4]], [9, 8, RED[3]], [8, 9, RED[3]], [9, 9, RED[2]]] as const) sprite.set(x, y, c);
  } else if (look === 'purse') {
    for (let y = 4; y < 13; y++) {
      for (let x = 3; x < 13; x++) {
        const light = sphere(x, y, 8, 9, 5);
        if (light === OUTSIDE) continue;
        sprite.set(x, y, flat(WOOD, clamp01(0.25 + light * 0.6), x, y));
      }
    }
    for (let x = 6; x < 10; x++) sprite.set(x, 4, WOOD[1]);
    for (const [x, y] of [[7, 2], [8, 3], [6, 3]]) sprite.set(x, y, WOOD[3]);
    for (const [x, y, c] of [[13, 11, GOLD[5]], [14, 11, GOLD[4]], [13, 12, GOLD[3]], [14, 12, GOLD[6]]] as const) sprite.set(x, y, c);
  } else if (look === 'oats') {
    for (let x = 4; x < 14; x++) {
      const top = 2 + Math.round(Math.abs(x - 8.5) * 0.6);
      for (let y = top; y < 13; y++) sprite.set(x, y, flat(GOLD, clamp01(0.75 - (x - 4) * 0.04 + (y < top + 2 ? 0.15 : 0) - (x % 2 ? 0.08 : 0)), x, y));
    }
    for (let x = 4; x < 14; x++) sprite.set(x, 8, WOOD[2]);
  } else {
    for (const [cx, h, w] of [[6, 9, 2], [9, 12, 3], [12, 8, 2]] as const) {
      for (let y = 13 - h; y < 13; y++) {
        const half = Math.min(w, Math.round(((y - (13 - h)) / 3) * w));
        for (let x = cx - half; x <= cx + half; x++) sprite.set(x, y, WATER[x < cx ? 8 : x === cx ? 9 : 5]);
      }
    }
  }
  const shaped = outline(sprite, INK);
  shadowOval(shaped, 10, 13.5, 7, 1.6);
  return shaped;
}

/** A heap of gold coins, a little wider than a chest. */
export function goldPile(): Bitmap {
  const sprite = new Bitmap(30, 18);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 30; x++) {
      const light = sphere(x, y * 1.55, 14, 22, 14);
      if (light === OUTSIDE || y < 4) continue;
      const coin = hash(x >> 1, y, 5) < 0.3 ? 0.18 : 0;
      sprite.set(x, y, flat(GOLD4, clamp01(0.3 + light * 0.7 + coin), x, y));
    }
  }
  for (const [x, y] of [[9, 7], [16, 5], [20, 9], [12, 11]]) sprite.set(x, y, NEUTRAL[7]);
  const shaped = outline(sprite, GOLD[0]);
  shadowOval(shaped, 17, 15.5, 12, 2.2);
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

/**
 * Holes dug in the heather, each with its heap of spoil thrown up behind it, and a spade left standing
 * in one: where Grimsby's men are digging for the old King's treasure. The foot is at the bottom.
 */
export function holes(seed: number): Bitmap {
  const sprite = new Bitmap(50, 26);
  const random = rng(seed);
  const pits: [number, number, number][] = [];
  for (let n = 0; n < 3; n++) pits.push([8 + n * 16 + Math.floor(random() * 4), 13 + Math.floor(random() * 8), 5 + Math.floor(random() * 2)]);
  for (const [cx, cy, r] of pits) {
    // The spoil heap, thrown up behind the hole and to its right, lit from the top left.
    for (let y = cy - r - 5; y <= cy - 1; y++) {
      for (let x = cx - 2; x <= cx + r + 5; x++) {
        const light = sphere(x, y, cx + r * 0.5 + 1, cy - 2, r * 0.8 + 2);
        if (light !== OUTSIDE) sprite.set(x, y, flat(four(EARTH, 2, 3, 4, 5), 0.3 + light * 0.7, x, y));
      }
    }
    // The hole: its far wall in shadow, black at the bottom, and a lit lip of fresh earth at the near edge.
    for (let y = cy - 3; y <= cy + 3; y++) {
      for (let x = cx - r - 1; x <= cx + r + 1; x++) {
        const u = (x + 0.5 - cx) / (r + 1);
        const v = (y + 0.5 - cy) / 3.4;
        const d = u * u + v * v;
        if (d > 1) continue;
        const rim = d > 0.62;
        sprite.set(x, y, rim ? (v > 0 ? EARTH[5] : EARTH[2]) : v < -0.2 ? EARTH[1] : INK);
      }
    }
  }
  // A spade, stuck upright in the middle heap.
  const [sx, sy, sr] = pits[1];
  const hx = sx + Math.round(sr * 0.5) + 1;
  for (let y = sy - 15; y < sy - 7; y++) sprite.set(hx, y, WOOD[3]);
  for (let x = hx - 1; x <= hx + 1; x++) sprite.set(x, sy - 16, WOOD[4]);
  for (let y = sy - 7; y < sy - 3; y++) for (let x = hx - 1; x <= hx + 1; x++) sprite.set(x, y, STONE[x === hx - 1 ? 6 : 4]);
  const shaped = outline(sprite, INK);
  castShadow(shaped, 2, 1, 6);
  return shaped;
}

/** A plain cottage on the green, with a sergeant's red coat and a shirt pegged out on the washing line: Mrs Pike's. */
export function washingCottage(seed: number): Bitmap {
  const sprite = new Bitmap(58, 32);
  const house = hut(seed);
  for (let y = 0; y < house.height; y++) for (let x = 0; x < house.width; x++) if (house.data[y * house.width + x]) sprite.set(x, y, house.data[y * house.width + x]);
  // Two posts and the line between them.
  for (const px of [36, 55]) for (let y = 13; y < 28; y++) sprite.set(px, y, WOOD[y === 13 ? 4 : 2]);
  for (let x = 37; x < 55; x++) sprite.set(x, 14 + (x > 42 && x < 50 ? 1 : 0), NEUTRAL[5]);
  // The coat: shoulders, sleeves and skirts, in the King's red.
  const coat = ['.rrrrr.', 'rrRrRrr', 'r.RRR.r', 'r.RrR.r', '..RrR..', '..RrR..', '.RRrRR.', '.RR.RR.'];
  coat.forEach((row, dy) => [...row].forEach((ch, dx) => ch !== '.' && sprite.set(39 + dx, 15 + dy, ch === 'R' ? RED[3] : RED[2])));
  // A shirt beside it.
  for (let y = 16; y < 21; y++) for (let x = 48; x < 53; x++) sprite.set(x, y, NEUTRAL[y === 16 || x === 48 ? 7 : 6]);
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

const WILLOW4 = [LEAF[1], LEAF[2], FOG[7], FOG[8]];
const TROLL4 = four(FOG, 3, 5, 7, 8);
const GOBLIN4 = four(LEAF, 3, 5, 7, 8);
const REED4 = four(REED, 1, 2, 3, 4);

/** Weeping willow: a lit dome of leaves with long strands hanging down to the ground. */
export function willow(seed: number, size = 30): Bitmap {
  const random = rng(seed);
  size += Math.floor(random() * size * 0.2);
  const sprite = new Bitmap(Math.round(size * 1.3) + 6, size + 8);
  const cx = sprite.width / 2 - 1;
  const r = size * 0.36;
  const cy = 3 + r;
  const foot = sprite.height - 6;
  for (let y = Math.floor(cy); y < foot; y++) for (let x = Math.floor(cx - 1.5); x < cx + 1.5; x++) sprite.set(x, y, flat(WOOD4, 0.7 - (x - cx + 1.5) * 0.25, x, y));
  for (let y = 0; y < sprite.height; y++) {
    for (let x = 0; x < sprite.width; x++) {
      const v = sphere(x, y, cx, cy, r);
      if (v === OUTSIDE) continue;
      const clumps = (noise(x / 2.2, y / 3.5, seed) - 0.5) * 0.45;
      sprite.set(x, y, flat(WILLOW4, clamp01(0.1 + v * 0.85 + clumps), x, y));
    }
  }
  // Strands fall from the lower half of the dome, longer at the sides.
  for (let k = 0; k < size * 1.6; k++) {
    const a = Math.PI * (0.02 + random() * 0.96);
    const sx = cx + Math.cos(a) * r * (0.55 + random() * 0.45) * (random() < 0.5 ? 1 : -1);
    const sy = cy + Math.sin(a) * r * 0.5;
    const length = size * (0.25 + random() * 0.4) * (0.6 + Math.abs(sx - cx) / r);
    const left = sx < cx;
    for (let j = 0; j < length && sy + j < foot - 1; j++) {
      const x = Math.round(sx + Math.sin(j / 5 + k) * 0.6);
      sprite.set(x, Math.round(sy + j), flat(WILLOW4, left ? 0.72 - j / length * 0.3 : 0.35 - j / length * 0.2, x, j));
    }
  }
  const shaped = outline(sprite, LEAF[0]);
  shadowOval(shaped, cx + size * 0.16, foot, r * 1.1, Math.max(1.6, size * 0.1));
  return shaped;
}

/** St Wendel's Abbey: a roofless nave with a tall broken arch window, and a squat bell tower. */
export function abbey(): Bitmap {
  const sprite = new Bitmap(84, 66);
  // Nave wall, broken along the top.
  for (let x = 6; x < 62; x++) {
    const top = 22 + Math.round((noise(x / 5, 0, 61) - 0.3) * 10) + (x > 44 ? 6 : 0);
    for (let y = top; y < 60; y++) sprite.set(x, y, masonry(x, y, 0.78 - (x - 6) * 0.006 - (y > 54 ? 0.1 : 0), 62));
  }
  // The great window: a pointed arch, open to the sky, with a broken tracery mullion.
  for (let y = 26; y < 50; y++) {
    for (let x = 18; x < 38; x++) {
      const dx = Math.abs(x - 27.5);
      const inArch = y > 34 ? dx < 7 : Math.hypot(dx + 5, y - 35) < 12 && Math.hypot(dx - 5, y - 35) < 12 && dx < 7;
      if (inArch) sprite.set(x, y, x === 27 && y > 38 ? STONE[5] : 0);
    }
  }
  // Two lancet windows and a door.
  for (const wx of [44, 52]) for (let y = 38; y < 48; y++) for (let x = wx; x < wx + 3; x++) sprite.set(x, y, y === 38 ? STONE[5] : INK);
  for (let y = 48; y < 60; y++) for (let x = 10; x < 16; x++) sprite.set(x, y, y < 50 ? STONE[6] : flat(WOOD4, 0.3, x, y));
  // Bell tower on the east end, still roofed.
  for (let y = 12; y < 60; y++) for (let x = 62; x < 78; x++) sprite.set(x, y, masonry(x, y, 0.7 - (x - 62) * 0.025, 63));
  for (let y = 2; y < 13; y++) for (let x = 60 + Math.round((12 - y) * 0.7); x < 80 - Math.round((12 - y) * 0.7); x++) sprite.set(x, y, flat(STONE4, 0.5 - (x - 60) * 0.015, x, y));
  for (let y = 18; y < 25; y++) for (let x = 67; x < 73; x++) sprite.set(x, y, y === 18 ? STONE[6] : x === 69 || x === 70 ? GOLD[4] : INK);
  // Ivy creeping up the ruin.
  for (let n = 0; n < 90; n++) {
    const x = 6 + Math.floor(hash(n, 1, 64) * 56);
    const y = 40 + Math.floor(hash(n, 2, 64) * 20) - Math.floor(hash(n, 3, 64) * 14);
    if (sprite.get(x, y) !== 0) sprite.set(x, y, hash(n, 4, 64) < 0.5 ? LEAF[3] : LEAF[5]);
  }
  const shaped = outline(sprite, INK);
  castShadow(shaped, 9, 3, 40);
  return shaped;
}

/** The peat cutters' hut: turf roof, sinking gently, with peat stacked beside it. */
export function peatHut(): Bitmap {
  const sprite = new Bitmap(56, 38);
  for (let y = 16; y < 32; y++) for (let x = 6; x < 32; x++) sprite.set(x, y, timber(x, y, 6, 32, 0.66 - (x - 6) * 0.012));
  for (let y = 22; y < 32; y++) for (let x = 16; x < 21; x++) sprite.set(x, y, y === 22 ? WOOD[1] : flat(WOOD4, 0.3, x, y));
  for (let y = 7; y < 17; y++) {
    const k = (y - 7) / 10;
    for (let x = 4 - Math.round(k * 2); x < 34 + Math.round(k * 2); x++) sprite.set(x, y, flat(GOBLIN4, 0.25 + (noise(x / 2, y / 2, 65) - 0.5) * 0.5 + (1 - k) * 0.2 - (x - 4) * 0.006, x, y));
  }
  // Stacked peat bricks.
  for (let row = 0; row < 3; row++) {
    for (let b = 0; b < 4 - row; b++) {
      const x0 = 36 + b * 5 + row * 2;
      const y0 = 30 - row * 4;
      for (let y = y0; y < y0 + 4; y++) for (let x = x0; x < x0 + 5; x++) sprite.set(x, y, x === x0 || y === y0 + 3 ? EARTH[0] : flat([EARTH[1], EARTH[2], EARTH[3], EARTH[4]], 0.6 - (y - y0) * 0.1, x, y));
    }
  }
  const shaped = outline(sprite, INK);
  castShadow(shaped, 5, 2, 24);
  return shaped;
}

/** Archery butts: two straw targets on posts with painted rings, a bow rack, and a pennant. */
export function butts(): Bitmap {
  const sprite = new Bitmap(56, 40);
  const STRAW4 = [DIRT[3], DIRT[5], DIRT[6], DIRT[7]];
  // A low rail fence behind.
  for (let x = 2; x < 54; x++) for (const y of [20, 25]) sprite.set(x, y, flat(WOOD4, 0.5 - (y - 20) * 0.04, x, y));
  for (let x = 4; x < 54; x += 12) for (let y = 18; y < 32; y++) sprite.set(x, y, flat(WOOD4, 0.35, x, y));
  // Two targets: straw bosses, rings of red, white and gold.
  for (const [cx, cy] of [[16, 20], [38, 22]] as const) {
    for (let y = cy + 6; y < cy + 14; y++) for (const dx of [-5, 5]) sprite.set(cx + dx, y, WOOD[2]);
    for (let y = cy - 8; y <= cy + 8; y++) {
      for (let x = cx - 8; x <= cx + 8; x++) {
        const d = Math.hypot(x - cx, (y - cy) * 1.05);
        if (d > 8) continue;
        const colour = d < 1.8 ? GOLD[5] : d < 3.6 ? RED[4] : d < 5.4 ? NEUTRAL[7] : d < 7 ? RED[3] : flat(STRAW4, 0.7 - (x - cx) * 0.03, x, y);
        sprite.set(x, y, colour);
      }
    }
    // An arrow in each.
    for (let k = 0; k < 7; k++) sprite.set(cx + 2 + k, cy - 1 - Math.floor(k / 3), k < 5 ? WOOD[3] : NEUTRAL[7]);
  }
  // A pennant on a tall pole.
  for (let y = 2; y < 34; y++) sprite.set(52, y, WOOD[1]);
  for (let j = 0; j < 7; j++) for (let i = 0; i < 9 - j; i++) sprite.set(51 - i, 3 + j, j === 0 ? GOLD[5] : LEAF[5]);
  const shaped = outline(sprite, INK);
  castShadow(shaped, 5, 2, 26);
  return shaped;
}

/** A ring of old standing stones on the heath, two of them with a lintel across, moss at their feet. */
export function standingStones(): Bitmap {
  const sprite = new Bitmap(60, 42);
  // [middle x, foot y, half width, height]: the back of the ring first, so the front stands over it.
  const stones: [number, number, number, number][] = [
    [17, 22, 3.5, 15], [30, 20, 4, 17], [43, 22, 3.5, 15],
    [8, 28, 3.5, 13], [52, 28, 3.5, 13],
    [19, 34, 4, 13], [41, 34, 4, 13], [30, 36, 3.5, 10],
  ];
  const STONE5 = [ROCK[2], ROCK[3], ROCK[5], ROCK[6], ROCK[7]];
  for (const [cx, foot, half, tall] of stones) {
    for (let y = foot - tall; y < foot; y++) {
      const taper = y < foot - tall + 3 ? (foot - tall + 3 - y) * 0.6 : 0;
      for (let x = Math.floor(cx - half + taper * 0.5); x < cx + half - taper * 0.5; x++) {
        const u = (x + 0.5 - (cx - half)) / (half * 2);
        const moss = y > foot - 4 && hash(x, y, 51) < 0.45;
        sprite.set(x, y, moss ? LEAF[3 + Math.floor(hash(x, y, 52) * 2)] : flat(STONE5, 0.78 - u * 0.55 + (noise(x / 2, y / 3, 53) - 0.5) * 0.25, x, y));
      }
    }
  }
  // The lintel across the two tallest at the back.
  for (let y = 3; y < 7; y++) for (let x = 14; x < 34; x++) sprite.set(x, y, flat(STONE5, 0.75 - (y - 3) * 0.12 - (x - 14) * 0.008, x, y));
  const shaped = outline(sprite, INK);
  castShadow(shaped, 5, 2, 18);
  return shaped;
}

/**
 * Old Nan's cottage at the edge of the wood: a leaning whitewashed cottage under a shaggy thatch, a
 * crooked chimney puffing purple smoke with `phase`, and a cauldron by the door.
 */
export function cottage(phase = 0): Bitmap {
  const sprite = new Bitmap(48, 50);
  const REED4 = [REED[1], REED[2], REED[3], REED[4]];
  // Walls, leaning a pixel as they rise.
  for (let y = 26; y < 44; y++) {
    const lean = Math.round((44 - y) / 12);
    for (let x = 7 + lean; x < 33 + lean; x++) sprite.set(x, y, timber(x, y, 7 + lean, 33 + lean, 0.86 - (x - 7) * 0.012));
  }
  for (let y = 33; y < 44; y++) for (let x = 17; x < 23; x++) sprite.set(x, y, y === 33 ? WOOD[1] : flat(WOOD4, 0.35 + (x === 21 ? 0.3 : 0), x, y));
  for (let y = 29; y < 33; y++) for (let x = 10; x < 14; x++) sprite.set(x, y, y === 29 || x === 10 ? WOOD[2] : GOLD[5]);
  // The chimney, at a slant.
  for (let y = 6; y < 24; y++) {
    const x0 = 27 + Math.round((24 - y) / 7);
    for (let x = x0; x < x0 + 4; x++) sprite.set(x, y, flat(STONE4, 0.6 - (x - x0) * 0.12 + (y % 3 === 0 ? -0.15 : 0), x, y));
  }
  roof(sprite, 5, 36, 12, 28, REED4);
  // The cauldron, bubbling green.
  for (let y = 38; y < 45; y++) for (let x = 36; x < 45; x++) if (((x - 40.5) / 4.6) ** 2 + ((y - 40) / 4) ** 2 <= 1) sprite.set(x, y, y < 39 ? LEAF[6] : flat(STONE4, 0.25 - (x - 36) * 0.02, x, y));
  const shaped = outline(sprite, INK);
  castShadow(shaped, 5, 2, 30);
  // Purple smoke, curling off to the east.
  for (let k = 0; k < 3; k++) {
    const t = (phase + k / 3) % 1;
    const cx = 30 + t * 12 + Math.sin(t * 6 + k) * 2;
    const cy = 5 - t * 5;
    const r = 1.4 + t * 2.4;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (y < 0 || ((x - cx) / r) ** 2 + ((y - cy) / r) ** 2 > 1 || shaped.get(x, y) !== 0) continue;
        if (t > 0.6 && (x + y) % 2 === 0) continue;
        shaped.set(x, y, t < 0.35 ? PLUM[4] : PLUM[3]);
      }
    }
  }
  return shaped;
}

/** A fen windmill: a tarred timber tower with a white cap, sails turned to `turn` (0 to 1 round). */
export function windmill(turn: number): Bitmap {
  const sprite = new Bitmap(64, 72);
  const cx = 32;
  for (let y = 26; y < 66; y++) {
    const half = 7 + (y - 26) * 0.18;
    for (let x = Math.floor(cx - half); x < cx + half; x++) {
      const u = (x - (cx - half)) / (half * 2);
      sprite.set(x, y, y % 5 === 0 ? WOOD[0] : flat(WOOD4, 0.6 - u * 0.5, x, y));
    }
  }
  for (let y = 54; y < 66; y++) for (let x = cx - 3; x < cx + 3; x++) sprite.set(x, y, y === 54 ? WOOD[3] : INK);
  for (let y = 38; y < 43; y++) for (let x = cx - 2; x < cx + 1; x++) sprite.set(x, y, GOLD[5]);
  for (let y = 18; y < 28; y++) for (let x = cx - 10; x < cx + 10; x++) if (Math.hypot((x - cx) / 10, (y - 27) / 9) < 1) sprite.set(x, y, flat(PLASTER4, 0.8 - (x - cx + 10) * 0.025, x, y));
  // Four sails on the hub, each a lattice of cloth.
  const hub: [number, number] = [cx, 24];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4 + turn * 0.25) * Math.PI * 2;
    const [dx, dy] = [Math.cos(a), Math.sin(a)];
    for (let t = 2; t < 28; t++) {
      for (let w = 0; w < 6; w++) {
        const x = Math.round(hub[0] + dx * t - dy * w);
        const y = Math.round(hub[1] + dy * t + dx * w);
        const lattice = w === 0 || t % 4 === 0;
        if (w === 0 || t > 6) sprite.set(x, y, lattice ? WOOD[2] : flat(PLASTER4, 0.85 - w * 0.06, x, y));
      }
    }
  }
  for (let y = 22; y < 27; y++) for (let x = cx - 2; x < cx + 3; x++) sprite.set(x, y, WOOD[1]);
  const shaped = outline(sprite, INK);
  castShadow(shaped, 7, 2, 50);
  return shaped;
}

/** Mother Mirrow's hut, up on two scaly chicken legs, with green smoke from a crooked chimney. */
export function stiltHut(phase = 0): Bitmap {
  const sprite = new Bitmap(76, 86);
  const shift = Math.sin(phase) > 0.7 ? 1 : 0;
  // Legs: thighs, knees bent back, three-toed feet.
  for (const [lx, bend] of [[28, 1], [44, -1]] as const) {
    for (let y = 46; y < 78; y++) {
      const k = (y - 46) / 32;
      const x = lx + Math.round(Math.sin(k * Math.PI) * 5 * bend) + (y > 60 ? shift * bend : 0);
      const thick = k < 0.4 ? 3 : 2;
      for (let i = 0; i < thick; i++) sprite.set(x + i, y, flat(GOLD4, y % 4 === 0 ? 0.2 : 0.55 - i * 0.2, x + i, y));
    }
    const fx = lx + shift * bend;
    for (const toe of [-5, 0, 5]) for (let i = 0; i < 5; i++) sprite.set(fx + 1 + Math.round((toe * i) / 5), 78 + Math.min(2, i >> 1), GOLD[3]);
  }
  // The hut: grey boards, a sagging thatch, a round window with a candle.
  for (let y = 22; y < 48; y++) for (let x = 16; x < 58; x++) sprite.set(x, y, (x - 16) % 5 === 0 ? WOOD[0] : flat(TROLL4, 0.62 - (x - 16) * 0.008 + (noise(x / 3, y / 6, 66) - 0.5) * 0.2, x, y));
  for (let y = 8; y < 24; y++) {
    const k = (y - 8) / 16;
    const sag = Math.round(Math.sin(k * Math.PI) * 2);
    for (let x = 14 - Math.round(k * 4); x < 60 + Math.round(k * 4); x++) sprite.set(x, y + sag, flat(REED4, 0.8 - (x - 14) * 0.008 - k * 0.3 + (noise(x / 1.5, y / 3, 67) - 0.5) * 0.3, x, y));
  }
  for (let y = 28; y < 38; y++) for (let x = 30; x < 42; x++) if (Math.hypot(x - 35.5, y - 32.5) < 5) sprite.set(x, y, Math.hypot(x - 35, y - 33) < 2 ? GOLD[6] : GOLD[4]);
  for (let y = 36; y < 48; y++) for (let x = 46; x < 52; x++) sprite.set(x, y, y === 36 ? WOOD[3] : flat(WOOD4, 0.35, x, y));
  // A crooked chimney, and smoke of an unwholesome green.
  for (let y = 0; y < 14; y++) for (let x = 48 + Math.round(y * 0.2); x < 53 + Math.round(y * 0.2); x++) sprite.set(x, y + 4, masonry(x, y, 0.55, 68));
  for (let k = 0; k < 5; k++) {
    const cx = 50 - k * 3 + Math.round(Math.sin(phase + k) * 1.5);
    const cy = 2 - k * 0;
    if (k < 3) for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 4) sprite.set(cx + x, cy + y + (k === 0 ? 0 : 0), k === 0 ? LEAF[6] : LEAF[4]);
  }
  for (const [x, y] of [[20, 44], [22, 45], [24, 44]]) sprite.set(x, y, PLUM[3]);
  const shaped = outline(sprite, INK);
  shadowOval(shaped, 40, 80, 22, 3);
  return shaped;
}

/** A wayside shrine: a little stone house for a saint, with a candle, on a step. */
export function shrine(): Bitmap {
  const sprite = new Bitmap(28, 34);
  for (let y = 26; y < 32; y++) for (let x = 3; x < 25; x++) sprite.set(x, y, masonry(x, y, y === 26 ? 0.85 : 0.6 - (x - 3) * 0.01, 71));
  for (let y = 9; y < 26; y++) for (let x = 7; x < 21; x++) sprite.set(x, y, masonry(x, y, 0.75 - (x - 7) * 0.025, 72));
  for (let y = 2; y < 10; y++) for (let x = 14 - (y - 2) * 1.1; x <= 14 + (y - 2) * 1.1; x++) sprite.set(Math.round(x), y, flat(STONE4, 0.55 - (x - 7) * 0.02, Math.round(x), y));
  for (let y = 13; y < 23; y++) for (let x = 11; x < 17; x++) sprite.set(x, y, y < 15 && (x === 11 || x === 16) ? STONE[4] : INK);
  sprite.set(13, 19, GOLD[6]);
  sprite.set(14, 19, GOLD[5]);
  sprite.set(13, 20, NEUTRAL[7]);
  sprite.set(14, 20, NEUTRAL[6]);
  for (let y = 0; y < 3; y++) sprite.set(14, y, GOLD[5]);
  sprite.set(13, 1, GOLD[5]);
  sprite.set(15, 1, GOLD[5]);
  const shaped = outline(sprite, INK);
  castShadow(shaped, 4, 1, 26);
  return shaped;
}

/**
 * The old King's hunt hall: a long timber hall under a steep shingle roof, with a gabled porch and a
 * stag's antlers over the door. Shut up, its shutters are closed and an iron bar holds the door; once
 * the huntsmen are back the door stands open, the windows glow, smoke rises from the chimney with
 * `phase` and the King's pennant flies from the gable again.
 */
export function huntHall(open = false, phase = 0): Bitmap {
  const sprite = new Bitmap(88, 70);
  const foot = 62;
  // A stone plinth, then timber walls lit from the left.
  for (let y = foot - 5; y < foot; y++) for (let x = 8; x < 80; x++) sprite.set(x, y, masonry(x, y, 0.66 - (x - 8) * 0.005, 81));
  for (let y = 38; y < foot - 5; y++) for (let x = 10; x < 78; x++) sprite.set(x, y, timber(x, y, 10, 78, 0.8 - (x - 10) * 0.006));
  roof(sprite, 10, 78, 14, 39, WOOD4);
  // The stone chimney at the east end of the ridge.
  for (let y = 4; y < 20; y++) for (let x = 66; x < 72; x++) sprite.set(x, y, masonry(x, y, 0.62 - (x - 66) * 0.06, 82));
  // The porch: a dark gable of its own over the door, edged with pale bargeboards.
  for (let y = 24; y < foot - 5; y++) {
    const half = y < 40 ? (y - 24) * 0.95 + 1 : 14;
    for (let x = Math.round(44 - half) - (y < 40 ? 1 : 0); x < 44 + half + (y < 40 ? 1 : 0); x++) {
      const edge = y < 40 && (x <= Math.round(44 - half) || x >= Math.round(44 + half) - 1);
      sprite.set(x, y, y < 40 ? (edge ? (x < 44 ? WOOD[5] : WOOD[4]) : flat(WOOD4, 0.3 - (x - 30) * 0.008, x, y)) : timber(x, y, 30, 58, 0.86 - (x - 30) * 0.01));
    }
  }
  for (let x = 29; x < 59; x++) sprite.set(x, 40, x < 44 ? WOOD[5] : WOOD[4]);
  // The door: shut and barred, or open onto a warm hall.
  for (let y = 44; y < foot - 5; y++) {
    for (let x = 38; x < 50; x++) {
      const post = x === 38 || x === 49 || y === 44;
      if (post) sprite.set(x, y, WOOD[1]);
      else if (open) sprite.set(x, y, y > foot - 10 ? GOLD[3] : x < 41 || x > 46 ? flat(WOOD4, 0.5, x, y) : INK);
      else sprite.set(x, y, x === 44 ? WOOD[1] : flat(WOOD4, 0.45 + (x < 44 ? 0.1 : 0), x, y));
    }
  }
  if (!open) {
    for (let x = 36; x < 52; x++) sprite.set(x, 50, x === 36 || x === 51 ? INK : STONE[5]);
    for (let y = 51; y < 55; y++) for (let x = 42; x < 46; x++) sprite.set(x, y, y === 51 ? STONE[6] : GOLD[3]);
  }
  // Windows either side: shutters closed, or lamplight.
  for (const wx of [15, 24, 62, 71]) {
    for (let y = 44; y < 50; y++) {
      for (let x = wx; x < wx + 4; x++) {
        if (open) sprite.set(x, y, y === 44 || x === wx ? WOOD[1] : GOLD[5]);
        else sprite.set(x, y, y === 44 ? WOOD[1] : x - wx === y - 45 || x - wx === 48 - y ? WOOD[1] : WOOD[3]);
      }
    }
  }
  // A stag's skull and antlers on the gable, over the door.
  const bone = [NEUTRAL[7], PARCHMENT[5], PARCHMENT[3]];
  for (const side of [-1, 1]) {
    const tines: [number, number][] = [[1, 0], [2, -1], [3, -2], [4, -3], [5, -4], [6, -5], [3, -4], [3, -5], [5, -6], [5, -7], [6, -3], [7, -3], [7, -6]];
    for (const [dx, dy] of tines) sprite.set(44 + (side < 0 ? -dx : dx - 1), 37 + dy, bone[Math.min(2, Math.abs(dy) >> 2)]);
  }
  for (const [x, y, c] of [[43, 37, 1], [44, 37, 1], [43, 38, 0], [44, 38, 0], [43, 39, 2], [44, 39, 2]] as const) sprite.set(x, y, bone[c]);
  // The pole on the porch's peak: the King's pennant flies from it again once the huntsmen are back.
  if (open) pennant(sprite, 44, 24, phase * Math.PI * 2);
  else for (let y = 16; y < 24; y++) sprite.set(44, y, WOOD[1]);
  const shaped = outline(sprite, INK);
  castShadow(shaped, 8, 3, 40);
  // Smoke from the chimney, curling off to the east.
  if (open) {
    for (let k = 0; k < 3; k++) {
      const t = (phase + k / 3) % 1;
      const cx = 69 + t * 12 + Math.sin(t * 6 + k) * 1.5;
      const cy = 3 - t * 3;
      const r = 1.3 + t * 2.2;
      for (let y = Math.floor(cy - r); y <= cy + r; y++) {
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          if (y < 0 || ((x - cx) / r) ** 2 + ((y - cy) / r) ** 2 > 1 || shaped.get(x, y) !== 0) continue;
          if (t > 0.6 && (x + y) % 2 === 0) continue;
          shaped.set(x, y, t < 0.35 ? NEUTRAL[6] : NEUTRAL[5]);
        }
      }
    }
  }
  return shaped;
}

/** The old King's hunting lodge, deep in the chase: log walls, a mossy roof, antlers over the door and a woodpile. */
export function lodge(): Bitmap {
  const sprite = new Bitmap(62, 52);
  const foot = 46;
  // Log walls: round logs laid one on another, lit from the left.
  for (let y = 26; y < foot; y++) {
    for (let x = 8; x < 44; x++) {
      const log = (y - 26) % 4;
      const light = 0.78 - (x - 8) * 0.012 - (log === 3 ? 0.4 : log === 0 ? -0.08 : 0);
      sprite.set(x, y, flat(WOOD4, clamp01(light), x, y));
    }
    // The log ends stick out at the corners.
    if ((y - 26) % 4 < 3) for (const x of [6, 7, 44, 45]) sprite.set(x, y, (y - 26) % 4 === 1 ? PARCHMENT[2] : WOOD[3]);
  }
  roof(sprite, 8, 44, 10, 27, DIRT4);
  for (let n = 0; n < 60; n++) {
    const x = 7 + Math.floor(hash(n, 1, 83) * 39);
    const y = 11 + Math.floor(hash(n, 2, 83) * 16);
    if (hash(n, 3, 83) < 0.8) sprite.set(x, y, hash(n, 4, 83) < 0.5 ? LEAF[3] : LEAF[5]);
  }
  // A cold stone chimney.
  for (let y = 4; y < 16; y++) for (let x = 13; x < 18; x++) sprite.set(x, y, masonry(x, y, 0.64 - (x - 13) * 0.08, 84));
  // The door, and a little window.
  for (let y = 33; y < foot; y++) for (let x = 22; x < 30; x++) sprite.set(x, y, x === 22 || y === 33 ? WOOD[0] : flat(WOOD4, 0.3 + (x === 28 ? 0.25 : 0), x, y));
  for (let y = 32; y < 36; y++) for (let x = 34; x < 38; x++) sprite.set(x, y, y === 32 || x === 34 ? WOOD[0] : NEUTRAL[1]);
  // Antlers over the door.
  const bone = [NEUTRAL[7], PARCHMENT[5]];
  for (const side of [-1, 1]) {
    for (const [dx, dy] of [[1, 0], [2, -1], [3, -2], [4, -3], [2, -3], [4, -5], [5, -2]] as const) sprite.set(26 + (side < 0 ? -dx : dx - 1), 30 + dy, bone[dy < -2 ? 1 : 0]);
  }
  // Split logs stacked by the wall.
  for (let row = 0; row < 3; row++) {
    for (let b = 0; b < 4 - row; b++) {
      const cx = 49 + b * 4 + row * 2;
      const cy = foot - 2 - row * 4;
      for (let y = cy - 2; y <= cy + 1; y++) for (let x = cx - 2; x <= cx + 1; x++) sprite.set(x, y, Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < 1 ? PARCHMENT[3] : WOOD[2]);
    }
  }
  const shaped = outline(sprite, INK);
  castShadow(shaped, 6, 2, 30);
  return shaped;
}

/**
 * The old King's falconer's bothy on the open heath: dry-stone walls under a turf roof, a door, a
 * little window, and his last hawk on her block perch outside, watching.
 */
export function mews(): Bitmap {
  const sprite = new Bitmap(54, 42);
  const foot = 36;
  const TURF = [LEAF[2], LEAF[3], LEAF[4], LEAF[5]];
  // Dry-stone walls, lit on the left.
  for (let y = 20; y < foot; y++) for (let x = 6; x < 36; x++) sprite.set(x, y, masonry(x, y, 0.72 - (x - 6) * 0.012, 85));
  // A turf roof, heavy and a little shaggy at the eaves.
  for (let y = 9; y < 21; y++) {
    const k = (y - 9) / 12;
    for (let x = 4 - Math.round(k * 2); x < 38 + Math.round(k * 2); x++) {
      const shag = y === 20 && hash(x, y, 86) < 0.4 ? -0.3 : 0;
      sprite.set(x, y, flat(TURF, clamp01(0.7 - (x - 4) * 0.01 - k * 0.25 + (noise(x / 2, y / 2, 87) - 0.5) * 0.35 + shag), x, y));
    }
  }
  // The door and a window with a candle in it.
  for (let y = 25; y < foot; y++) for (let x = 14; x < 20; x++) sprite.set(x, y, x === 14 || y === 25 ? WOOD[0] : flat(WOOD4, 0.35, x, y));
  for (let y = 25; y < 29; y++) for (let x = 26; x < 30; x++) sprite.set(x, y, y === 25 || x === 26 ? STONE[2] : GOLD[5]);
  // The block perch: a post, and on it the hawk, her pale breast to the light.
  for (let y = 24; y < foot; y++) for (let x = 43; x < 49; x++) sprite.set(x, y, y === 24 ? PARCHMENT[2] : flat(WOOD4, 0.7 - (x - 43) * 0.12, x, y));
  const hawk: [number, number, number][] = [
    [45, 15, 2], [46, 15, 2], [44, 16, 2], [45, 16, 3], [46, 16, 2], [47, 16, 1],
    [44, 17, 3], [45, 17, 4], [46, 17, 2], [47, 17, 1], [44, 18, 4], [45, 18, 4], [46, 18, 2], [47, 18, 1],
    [44, 19, 4], [45, 19, 4], [46, 19, 2], [47, 19, 1], [44, 20, 3], [45, 20, 4], [46, 20, 2], [47, 20, 1],
    [45, 21, 3], [46, 21, 2], [47, 21, 1], [46, 22, 1], [47, 22, 1], [48, 22, 1], [45, 23, 0], [46, 23, 0],
  ];
  const FEATHER = [INK, WOOD[1], WOOD[3], PARCHMENT[3], PARCHMENT[5]];
  for (const [x, y, c] of hawk) sprite.set(x, y, FEATHER[c]);
  sprite.set(44, 15, GOLD[5]);
  sprite.set(43, 16, GOLD[4]);
  const shaped = outline(sprite, INK);
  castShadow(shaped, 5, 2, 24);
  return shaped;
}

/** Where the grain cart's wheel and the ox's hooves meet the ground, from the top of its sprite. */
export const CART_GROUND = 37;

/**
 * Westmere's grain cart on its way west to Grimsby's stockade: an ox in the shafts, a two-wheeled
 * cart piled with sacks of grain, and its wheel.
 */
export function grainCart(): Bitmap {
  const sprite = new Bitmap(62, 42);
  const HIDE = [EARTH[2], EARTH[3], EARTH[4], EARTH[5]];
  const SACK = [PARCHMENT[1], PARCHMENT[2], PARCHMENT[4], PARCHMENT[5]];
  // The ox: a heavy body, head down to the road, legs planted.
  for (let y = 18; y < 30; y++) {
    for (let x = 6; x < 26; x++) {
      const u = (x + 0.5 - 16) / 10;
      const v = (y + 0.5 - 24) / 6;
      if (u * u + v * v <= 1) sprite.set(x, y, flat(HIDE, clamp01(0.75 - u * 0.2 - v * 0.35), x, y));
    }
  }
  for (let y = 20; y < 29; y++) for (let x = 1; x < 8; x++) if (((x + 0.5 - 4.5) / 3.6) ** 2 + ((y + 0.5 - 24.5) / 4.4) ** 2 <= 1) sprite.set(x, y, flat(HIDE, 0.62 - (y - 20) * 0.05, x, y));
  for (const [x, y] of [[1, 19], [2, 18], [3, 18], [7, 18], [8, 17], [9, 17]]) sprite.set(x, y, NEUTRAL[6]);
  sprite.set(2, 24, INK);
  for (const [lx, lean] of [[9, -1], [12, 1], [19, -1], [22, 1]]) for (let y = 29; y < CART_GROUND; y++) sprite.set(lx + (y > 33 ? lean : 0), y, y >= CART_GROUND - 1 ? INK : EARTH[2]);
  for (let y = 21; y < 27; y++) sprite.set(26 + (y > 24 ? 1 : 0), y, EARTH[2]);
  // The shafts and the yoke.
  for (let x = 12; x < 32; x++) sprite.set(x, 21 + Math.round((x - 12) * 0.15), WOOD[4]);
  for (let y = 17; y < 22; y++) sprite.set(12, y, WOOD[2]);
  // The cart's bed, and the sacks piled on it.
  for (let y = 24; y < 29; y++) for (let x = 28; x < 60; x++) sprite.set(x, y, y === 24 ? WOOD[5] : flat(WOOD4, 0.6 - (y - 24) * 0.1, x, y));
  for (const [cx, cy, rx, ry] of [[33, 19, 5, 5], [42, 19, 5, 5], [51, 19, 5, 5], [37, 12, 5, 5], [47, 12, 5, 5], [42, 6, 4, 4]] as const) {
    for (let y = cy - ry; y <= cy + ry; y++) {
      for (let x = cx - rx; x <= cx + rx; x++) {
        const u = (x + 0.5 - cx) / rx;
        const v = (y + 0.5 - cy) / ry;
        if (u * u + v * v <= 1) sprite.set(x, y, flat(SACK, clamp01(0.7 - u * 0.3 - v * 0.25 + (hash(x, y, 91) - 0.5) * 0.1), x, y));
      }
    }
    sprite.set(cx, cy - ry, WOOD[1]);
  }
  // The wheel, side on, with its spokes.
  const [wx, wy, r] = [44, CART_GROUND - 8, 8];
  for (let y = wy - r; y <= wy + r; y++) {
    for (let x = wx - r; x <= wx + r; x++) {
      const d = Math.hypot(x + 0.5 - wx, y + 0.5 - wy);
      if (d > r) continue;
      const spoke = d < r - 1.5 && Math.abs(Math.sin(Math.atan2(y + 0.5 - wy, x + 0.5 - wx) * 3)) < 0.28;
      if (d > r - 1.6) sprite.set(x, y, flat(WOOD4, 0.55 - (y - wy) * 0.04, x, y));
      else if (spoke || d < 1.6) sprite.set(x, y, WOOD[1]);
    }
  }
  const shaped = outline(sprite, INK);
  castShadow(shaped, 5, 2, 26);
  return shaped;
}

/** A camp: two canvas tents, a cooking fire, and a pennant on a pole. */
export function camp(phase = 0): Bitmap {
  const sprite = new Bitmap(62, 40);
  const tent = (cx: number, base: number, half: number, height: number) => {
    for (let y = base - height; y < base; y++) {
      const w = ((y - (base - height)) / height) * half;
      for (let x = Math.round(cx - w); x <= cx + w; x++) sprite.set(x, y, x === Math.round(cx) ? WOOD[2] : flat(PLASTER4, x < cx ? 0.8 : 0.45, x, y));
    }
    for (let y = base - 7; y < base; y++) sprite.set(Math.round(cx), y, INK);
  };
  tent(18, 34, 13, 22);
  tent(42, 30, 11, 19);
  for (let y = 4; y < 30; y++) sprite.set(54, y, WOOD[2]);
  for (let i = 1; i < 8; i++) {
    const wave = Math.round(Math.sin(i * 0.8 + phase) * 0.9);
    for (let j = 0; j < 6 - Math.floor(i / 3); j++) sprite.set(54 - i, 5 + j + wave, flat(RED4, 0.7 - j * 0.05, i, j));
  }
  for (const [x, y] of [[29, 36], [31, 35], [33, 36], [30, 37], [32, 37]]) sprite.set(x, y, WOOD[1]);
  sprite.set(31, 34, GOLD[6]);
  sprite.set(30, 35, RED[5]);
  sprite.set(32, 35, GOLD[5]);
  const shaped = outline(sprite, INK);
  castShadow(shaped, 5, 2, 26);
  return shaped;
}

/** A big red X painted on the ground, with a shovel stuck in beside it. */
export function xMark(phase = 0): Bitmap {
  const sprite = new Bitmap(40, 34);
  const glow = Math.sin(phase) > 0 ? RED[5] : RED[4];
  for (let t = 0; t < 1; t += 0.02) {
    for (const [ax, ay, bx, by] of [[6, 14, 32, 28], [32, 14, 6, 28]]) {
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      for (let d = -1.4; d <= 1.4; d += 0.7) sprite.set(Math.round(x + d), Math.round(y), glow);
    }
  }
  for (let y = 0; y < 22; y++) sprite.set(34, y, WOOD[3]);
  for (let y = 20; y < 27; y++) for (let x = 32; x < 37; x++) sprite.set(x, y, STONE[5]);
  for (let x = 31; x < 38; x++) sprite.set(x, 1, WOOD[2]);
  const shaped = outline(sprite, INK);
  shadowOval(shaped, 20, 30, 16, 2.4);
  return shaped;
}

/** Smoke curling off to the east from (x, y) with `phase`, in puffs that grow as they rise, over whatever isn't drawn yet. */
function smoke(sprite: Bitmap, x: number, y: number, phase: number, rise: number, shades: readonly [number, number]) {
  for (let k = 0; k < 3; k++) {
    const t = (phase + k / 3) % 1;
    const cx = x + t * rise * 0.6 + Math.sin(t * 6 + k) * 1.2;
    const cy = y - t * rise;
    const r = 0.8 + t * 1.8;
    for (let py = Math.floor(cy - r); py <= cy + r; py++) {
      for (let px = Math.floor(cx - r); px <= cx + r; px++) {
        if (((px - cx) / r) ** 2 + ((py - cy) / r) ** 2 > 1 || sprite.get(px, py) !== 0) continue;
        if (t > 0.6 && (px + py) % 2 === 0) continue;
        sprite.set(px, py, t < 0.35 ? shades[0] : shades[1]);
      }
    }
  }
}

/**
 * A pack dropped by the road: a lumpy leather sack with a blanket rolled and strapped across its top.
 * As a `hamper`, the Baron's wicker picnic hamper instead, with a handle and a gold clasp. The foot is at 18.
 */
export function pack(hamper = false): Bitmap {
  const sprite = new Bitmap(30, 22);
  const foot = 18;
  if (hamper) {
    const STRAW = [DIRT[4], DIRT[5], DIRT[6], DIRT[7]];
    for (let y = 7; y < foot; y++) {
      for (let x = 4; x < 25; x++) {
        const lid = y < 11;
        const weave = ((x >> 1) + (y >> 1)) % 2 === 0 ? 0.14 : -0.14;
        sprite.set(x, y, y === 11 ? DIRT[2] : flat(STRAW, clamp01((lid ? 0.62 : 0.5) - (x - 4) * 0.02 + weave - (y === foot - 1 ? 0.3 : 0)), x, y));
      }
    }
    for (const sx of [9, 20]) for (let y = 7; y < foot; y++) sprite.set(sx, y, WOOD[2]);
    for (let y = 10; y < 13; y++) for (let x = 14; x < 16; x++) sprite.set(x, y, GOLD[y === 10 ? 6 : 5]);
    // The handle, arching over the lid.
    for (let x = 10; x < 20; x++) sprite.set(x, x < 12 || x > 17 ? 5 : 4, WOOD[3]);
    for (const hx of [10, 19]) sprite.set(hx, 6, WOOD[3]);
  } else {
    // The sack, lit from the top left.
    for (let y = 6; y < foot; y++) {
      for (let x = 3; x < 26; x++) {
        const light = sphere(x, (y - 12) * 1.3 + 12, 14, 12, 10.5);
        if (light === OUTSIDE) continue;
        sprite.set(x, y, flat(four(EARTH, 3, 4, 5, 6), clamp01(0.12 + light * 0.8 + (noise(x / 2, y / 2, 93) - 0.5) * 0.25), x, y));
      }
    }
    // The blanket, rolled and strapped across the top, in the King's blue.
    for (let y = 3; y < 9; y++) {
      for (let x = 5; x < 24; x++) {
        const edge = x === 5 || x === 23;
        sprite.set(x, y, edge ? BLUE[2] : flat(BLUE4, clamp01(0.9 - Math.abs((y - 3) / 6 - 0.3) * 1.3 - (x - 5) * 0.012), x, y));
      }
    }
    for (const sx of [10, 18]) for (let y = 3; y < foot - 1; y++) sprite.set(sx, y, WOOD[1]);
    sprite.set(18, 12, GOLD[5]);
  }
  const shaped = outline(sprite, INK);
  shadowOval(shaped, 16, foot, 12, 2.2);
  return shaped;
}

/**
 * A cold campfire by the road: a ring of stones round grey ash and a last ember, a log to sit on,
 * a letter weighed down with a stone, and a thread of smoke with `phase`. The foot is at 30.
 */
export function campfire(phase = 0): Bitmap {
  const sprite = new Bitmap(44, 34);
  const [cx, cy] = [18, 25];
  // The log behind the fire, its sawn end towards you.
  for (let y = 16; y < 21; y++) {
    for (let x = 25; x < 41; x++) {
      const end = x === 25 || x === 26;
      sprite.set(x, y, end ? (Math.hypot(x - 26, y - 18.5) < 1.6 ? PARCHMENT[4] : PARCHMENT[2]) : flat(WOOD4, clamp01(0.85 - ((y - 16) / 5) * 0.75 + (hash(x >> 2, y, 94) - 0.5) * 0.1), x, y));
    }
  }
  // The ash, and two charred sticks across it.
  for (let y = cy - 3; y <= cy + 3; y++) {
    for (let x = cx - 8; x <= cx + 8; x++) {
      if (((x + 0.5 - cx) / 8) ** 2 + ((y + 0.5 - cy) / 3.4) ** 2 > 1) continue;
      sprite.set(x, y, hash(x, y, 95) < 0.45 ? NEUTRAL[3] : NEUTRAL[4]);
    }
  }
  for (let t = 0; t <= 1; t += 0.1) {
    sprite.set(Math.round(cx - 5 + t * 10), Math.round(cy + 1 - t * 3), INK);
    sprite.set(Math.round(cx - 4 + t * 9), Math.round(cy - 2 + t * 3), WOOD[0]);
  }
  // A last ember, that glows and fades.
  const glow = Math.sin(phase * Math.PI * 2) > 0;
  sprite.set(cx, cy, glow ? GOLD[5] : RED[4]);
  sprite.set(cx + 1, cy, glow ? RED[5] : RED[3]);
  // The ring of stones, each a lumpy grey pebble lit from the top left.
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + 0.3;
    const [sx, sy] = [cx + Math.cos(a) * 10, cy + Math.sin(a) * 4.8];
    for (let y = Math.floor(sy - 2); y <= sy + 2; y++) {
      for (let x = Math.floor(sx - 2); x <= sx + 2; x++) {
        const light = sphere(x, (y - sy) * 1.4 + sy, sx, sy, 2.2);
        if (light !== OUTSIDE) sprite.set(x, y, flat(ROCK4, clamp01(0.3 + light * 0.75), x, y));
      }
    }
  }
  // The letter, under a stone on the near side.
  for (let y = 28; y < 32; y++) for (let x = 29; x < 36; x++) sprite.set(x, y, y === 28 ? PARCHMENT[6] : x === 35 ? PARCHMENT[3] : PARCHMENT[5]);
  for (const [x, y] of [[31, 29], [32, 30], [33, 29]]) sprite.set(x, y, NEUTRAL[3]);
  for (let y = 27; y < 30; y++) for (let x = 33; x < 37; x++) sprite.set(x, y, flat(ROCK4, 0.7 - (x - 33) * 0.15, x, y));
  const shaped = outline(sprite, INK);
  castShadow(shaped, 3, 1, 18);
  smoke(shaped, cx + 1, cy - 4, phase, 18, [NEUTRAL[5], NEUTRAL[4]]);
  return shaped;
}

/** A sheep, facing left or right (`facing`), its woolly back lit from the top left. */
function sheep(sprite: Bitmap, x: number, y: number, facing: number) {
  for (let py = y - 4; py <= y + 2; py++) {
    for (let px = x - 5; px <= x + 5; px++) {
      const light = sphere(px, (py - y) * 1.4 + y, x, y, 5.2);
      if (light === OUTSIDE) continue;
      sprite.set(px, py, flat([NEUTRAL[4], NEUTRAL[5], NEUTRAL[6], NEUTRAL[7]], clamp01(0.3 + light * 0.75 + (hash(px, py, 97) - 0.5) * 0.25), px, py));
    }
  }
  const head = x + facing * 6;
  for (let py = y - 3; py <= y; py++) for (let px = head - 1; px <= head + 1; px++) sprite.set(px, py, INK);
  sprite.set(head - facing, y - 4, INK);
  for (const lx of [x - 3, x + 3]) for (let py = y + 3; py <= y + 4; py++) sprite.set(lx, py, INK);
}

/** A drystone sheepfold on the downs, with a gap for a gate, sheep inside it and a shepherd's crook leaning on the wall. */
export function fold(): Bitmap {
  const sprite = new Bitmap(62, 38);
  const [cx, cy, rx, ry] = [30, 23, 26, 10];
  const wall = (front: boolean) => {
    for (let a = 0; a < Math.PI * 2; a += 0.004) {
      if (Math.sin(a) > 0 !== front) continue;
      // The gate: a gap in the near wall, on the right.
      if (front && Math.abs(Math.cos(a) - 0.55) < 0.14) continue;
      const x = Math.round(cx + Math.cos(a) * rx);
      const y = Math.round(cy + Math.sin(a) * ry);
      for (let h = 0; h < 6; h++) sprite.set(x, y - h, h === 5 ? STONE[6] : masonry(x, y - h, 0.72 - Math.cos(a) * 0.18 - (front ? 0.08 : 0.2), 96));
    }
  };
  wall(false);
  for (const [sx, sy, facing] of [[16, 19, 1], [30, 16, -1], [42, 19, -1], [24, 25, 1], [37, 26, 1]] as const) sheep(sprite, sx, sy, facing);
  wall(true);
  // The crook, leaning on the wall by the gate.
  for (let y = 12; y < 34; y++) sprite.set(52 + Math.round((y - 12) * 0.12), y, WOOD[3]);
  for (const [x, y] of [[51, 11], [51, 10], [52, 9], [53, 9], [54, 10], [54, 11]]) sprite.set(x, y, WOOD[3]);
  const shaped = outline(sprite, INK);
  castShadow(shaped, 4, 2, 20);
  return shaped;
}

/** An eel-catcher's rowing boat, pulled up on the bank with its oars shipped, and wicker eel traps drying beside it. */
export function boat(): Bitmap {
  const sprite = new Bitmap(58, 30);
  const [x0, x1] = [4, 42];
  // The hull, pointed at both ends: a pale rim, the dark hollow inside it with the thwarts across, and its planked side below.
  for (let x = x0; x < x1; x++) {
    const u = (x - x0) / (x1 - x0 - 1);
    const beam = 1 - Math.abs(2 * u - 1) ** 1.7;
    const [rim, near, keel] = [Math.round(15 - beam * 6), Math.round(15 + beam * 1.2), Math.round(16 + beam * 6)];
    for (let y = rim; y <= keel; y++) {
      let colour: number;
      if (y === rim || y === near) colour = y === rim ? WOOD[5] : WOOD[6];
      else if (y < near) colour = (x - x0) % 9 === 5 && beam > 0.45 ? WOOD[5] : y === rim + 1 ? WOOD[0] : flat([WOOD[0], WOOD[1], WOOD[2], WOOD[3]], clamp01(0.3 + (y - rim) * 0.08), x, y);
      else colour = (y - near) % 3 === 0 ? WOOD[1] : flat(WOOD4, clamp01(0.75 - (y - near) * 0.07 - u * 0.25), x, y);
      sprite.set(x, y, colour);
    }
  }
  // The oars, shipped along the thwarts.
  for (let x = 9; x < 36; x++) sprite.set(x, 12 + Math.round((x - 9) * 0.04), WOOD[6]);
  for (let x = 34; x < 39; x++) for (let y = 11; y < 14; y++) sprite.set(x, y, WOOD[5]);
  // Eel traps: long wicker cones lying on the bank, bound with hoops.
  const WICKER = [REED[1], REED[2], REED[3], REED[4]];
  for (const [bx, by] of [[43, 24], [45, 18]] as const) {
    for (let x = bx; x < bx + 12; x++) {
      const half = 0.8 + (x - bx) * 0.24;
      for (let y = Math.round(by - half); y <= by + half; y++) sprite.set(x, y, (x - bx) % 4 === 3 ? WOOD[1] : flat(WICKER, clamp01(0.8 - (y - by + half) / (half * 2) * 0.6), x, y));
    }
    for (let y = Math.round(by - 3.5); y <= by + 3.5; y++) sprite.set(bx + 12, y, INK);
  }
  const shaped = outline(sprite, INK);
  castShadow(shaped, 4, 1, 16);
  return shaped;
}

/** Beehives on the heath: straw skeps in a row on a plank bench, and their bees out and about with `phase`. */
export function skeps(phase = 0): Bitmap {
  const sprite = new Bitmap(48, 34);
  const bench = 23;
  for (let y = bench; y < bench + 3; y++) for (let x = 3; x < 44; x++) sprite.set(x, y, flat(WOOD4, 0.75 - (y - bench) * 0.25 - (x - 3) * 0.004, x, y));
  for (const lx of [6, 40]) for (let y = bench + 3; y < bench + 8; y++) sprite.set(lx, y, WOOD[2]);
  const STRAW = [GOLD[2], GOLD[3], GOLD[4], GOLD[5]];
  for (const [cx, r] of [[12, 7], [24, 8.5], [36, 7]] as const) {
    const tall = r * 1.5;
    for (let y = Math.floor(bench - tall); y < bench; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const light = sphere(x, (y - bench) / 1.5 + bench, cx, bench, r);
        if (light === OUTSIDE) continue;
        const coil = (y - bench) % 3 === 0 ? -0.22 : 0;
        sprite.set(x, y, flat(STRAW, clamp01(0.15 + light * 0.8 + coil), x, y));
      }
    }
    for (let y = bench - 3; y < bench; y++) for (let x = Math.round(cx) - 1; x <= Math.round(cx) + 1; x++) sprite.set(x, y, INK);
  }
  const shaped = outline(sprite, INK);
  castShadow(shaped, 4, 2, 16);
  // Bees, drifting round the hives.
  for (let k = 0; k < 7; k++) {
    const a = phase * Math.PI * 2 + k * 2.1;
    const x = Math.round(24 + Math.cos(a * (k % 2 ? 1 : -1) + k) * (10 + k * 1.8));
    const y = Math.round(9 + Math.sin(a * 2 + k) * 4 + (k % 3));
    if (shaped.get(x, y) === 0) shaped.set(x, y, INK);
  }
  return shaped;
}

/** A hayrick in the stubble: a round stack of hay under a thatched cap, a pitchfork stuck in it, and a pair of boots sticking out of the top. */
export function hayrick(): Bitmap {
  const sprite = new Bitmap(44, 46);
  const foot = 42;
  const HAY = [GOLD[2], GOLD[3], GOLD[4], GOLD[5]];
  // The stack: straight-sided and a little wider at the foot, the hay stroked downwards, lit from the left.
  for (let y = 18; y < foot; y++) {
    const half = 15 + (y - 18) * 0.12;
    for (let x = Math.round(21 - half); x <= 21 + half; x++) {
      const u = (x - 21) / half;
      sprite.set(x, y, flat(HAY, clamp01(0.62 - u * 0.4 - Math.abs(u) ** 4 * 0.3 + (noise(x / 1.1, y / 6, 98) - 0.5) * 0.4 - (y > foot - 3 ? 0.2 : 0)), x, y));
    }
  }
  // The thatched cap: a low cone, darker, its eaves ragged over the stack.
  for (let y = 6; y < 21; y++) {
    const half = 2 + (y - 6) * 1.12;
    for (let x = Math.round(21 - half); x <= 21 + half; x++) if (y < 19 || hash(x, y, 99) < 0.55) sprite.set(x, y, flat(four(DIRT, 2, 3, 4, 5), clamp01(0.78 - ((x - 21) / half) * 0.35 - (y - 6) * 0.015 + (noise(x / 1.2, y / 3, 100) - 0.5) * 0.3), x, y));
  }
  // A pair of legs sticking out of the top, boots and all, toes turned out: the farmhand, guarding the hay.
  for (const [bx, out] of [[17, -1], [23, 1]] as const) {
    for (let y = 3; y < 9; y++) for (let dx = 0; dx < 2; dx++) sprite.set(bx + dx, y, flat(four(EARTH, 2, 3, 4, 5), 0.7 - dx * 0.3 - (y - 3) * 0.04, bx + dx, y));
    for (let dx = 0; dx < 4; dx++) sprite.set(out < 0 ? bx + 1 - dx : bx + dx, 2, dx === 3 ? EARTH[1] : EARTH[3]);
    for (let dx = 0; dx < 4; dx++) sprite.set(out < 0 ? bx + 1 - dx : bx + dx, 1, EARTH[1]);
  }
  // The pitchfork, stuck in at a slant, tines in the hay.
  for (let t = 0; t < 24; t++) sprite.set(Math.round(36 + t * 0.3), 16 + t, WOOD[4]);
  for (const dx of [-2, 0, 2]) for (let t = 0; t < 4; t++) sprite.set(35 + dx, 12 + t, STONE[6]);
  for (let x = 33; x < 38; x++) sprite.set(x, 16, STONE[5]);
  const shaped = outline(sprite, INK);
  castShadow(shaped, 6, 2, 26);
  return shaped;
}

/** A goose, white and indignant, facing left or right (`facing`). */
function goose(sprite: Bitmap, x: number, y: number, facing: number) {
  for (let py = y - 3; py <= y + 1; py++) for (let px = x - 4; px <= x + 4; px++) if (((px - x) / 4.4) ** 2 + ((py - y + 1) / 2.6) ** 2 <= 1) sprite.set(px, py, py < y - 1 ? NEUTRAL[7] : NEUTRAL[6]);
  const neck = x + facing * 3;
  for (let py = y - 6; py < y - 1; py++) sprite.set(neck, py, NEUTRAL[7]);
  sprite.set(neck + facing, y - 6, GOLD[5]);
  sprite.set(neck + facing * 2, y - 6, RED[5]);
  sprite.set(neck, y - 6, INK);
}

/** A goose pond: still water inside a reedy edge, geese on it and on the bank, every one of them watching you. */
export function pond(): Bitmap {
  const sprite = new Bitmap(66, 34);
  const [cx, cy, rx, ry] = [32, 22, 27, 9];
  for (let y = cy - ry - 1; y <= cy + ry + 1; y++) {
    for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) + (noise(x / 3, y / 3, 101) - 0.5) * 0.12;
      if (d > 1.06) continue;
      sprite.set(x, y, d > 0.92 ? (y < cy ? EARTH[4] : EARTH[5]) : y < cy - ry * 0.4 ? WATER[3] : (x + y * 3) % 11 === 0 ? WATER[7] : WATER[5]);
    }
  }
  // Reeds at the far edge, and a clump at the near one.
  for (let k = 0; k < 16; k++) {
    const a = Math.PI + (k / 15) * Math.PI;
    const x = Math.round(cx + Math.cos(a) * rx * (0.9 + hash(k, 1, 102) * 0.1));
    const base = Math.round(cy + Math.sin(a) * ry * 0.9);
    if (hash(k, 2, 102) < 0.35) continue;
    for (let h = 0; h < 4 + Math.floor(hash(k, 3, 102) * 4); h++) sprite.set(x, base - h, h > 4 ? REED[4] : k % 2 ? LEAF[5] : LEAF[4]);
  }
  for (const [x, y, facing] of [[20, 21, 1], [36, 24, -1], [46, 19, -1], [9, 30, 1]] as const) goose(sprite, x, y, facing);
  return outline(sprite, INK);
}

/** A charcoal clamp at the edge of the chase: a low turf mound smoking from its vents with `phase`, and cordwood stacked beside it. */
export function kiln(phase = 0): Bitmap {
  const sprite = new Bitmap(56, 46);
  const foot = 40;
  const TURF = [EARTH[1], EARTH[2], EARTH[3], LEAF[3]];
  for (let y = 18; y < foot; y++) {
    for (let x = 3; x < 41; x++) {
      const light = sphere(x, (y - foot) * 1.35 + foot, 22, foot, 18.5);
      if (light === OUTSIDE) continue;
      sprite.set(x, y, flat(TURF, clamp01(0.1 + light * 0.75 + (noise(x / 2.5, y / 2.5, 103) - 0.5) * 0.35), x, y));
    }
  }
  const vents: [number, number][] = [[13, 31], [25, 28]];
  for (const [x, y] of vents) for (let py = y; py < y + 2; py++) for (let px = x; px < x + 3; px++) sprite.set(px, py, INK);
  // Cordwood, stacked by the clamp: rows of log ends.
  for (let row = 0; row < 3; row++) {
    for (let b = 0; b < 4 - row; b++) {
      const [lx, ly] = [43 + b * 4 + row * 2, foot - 2 - row * 4];
      for (let y = ly - 2; y <= ly + 1; y++) for (let x = lx - 2; x <= lx + 1; x++) sprite.set(x, y, Math.hypot(x + 0.5 - lx, y + 0.5 - ly) < 1 ? PARCHMENT[4] : WOOD[2]);
    }
  }
  const shaped = outline(sprite, INK);
  castShadow(shaped, 5, 2, 28);
  for (const [i, [x, y]] of vents.entries()) smoke(shaped, x + 1, y - 2, (phase + i * 0.5) % 1, 18, [NEUTRAL[6], NEUTRAL[5]]);
  return shaped;
}

/** An eagle's nest on top of a crag, a great tangle of sticks with something in it that glints with `phase`. */
export function nest(phase = 0): Bitmap {
  const rock = crag(34, 30, 104);
  const sprite = new Bitmap(rock.width, rock.height + 8);
  for (let y = 0; y < rock.height; y++) for (let x = 0; x < rock.width; x++) sprite.set(x, y + 8, rock.data[y * rock.width + x]);
  // Where the rock tops out, the nest sits: a bowl of sticks, dark in the hollow, with a few poking out.
  let top = sprite.height;
  for (let y = 0; y < sprite.height && top === sprite.height; y++) if (sprite.get(Math.floor(rock.width / 2), y) !== 0) top = y;
  const [cx, cy] = [Math.floor(rock.width / 2), top + 1];
  const TWIGS = [WOOD[1], WOOD[2], WOOD[3], WOOD[4], WOOD[5]];
  for (let y = cy - 5; y <= cy + 3; y++) {
    for (let x = cx - 10; x <= cx + 10; x++) {
      const d = Math.hypot((x + 0.5 - cx) / 9.5, (y + 0.5 - cy + 1) / 4);
      if (d > 1) continue;
      const hollow = d < 0.55 && y < cy;
      sprite.set(x, y, hollow ? (y < cy - 2 ? WOOD[0] : INK) : TWIGS[Math.floor(hash(x, y, 105) * (y < cy - 1 ? 5 : 3))]);
    }
  }
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI + hash(k, 1, 106) * 0.4;
    for (let t = 0; t < 4; t++) sprite.set(Math.round(cx + Math.cos(a) * (9 + t)), Math.round(cy - 1 - Math.sin(a) * (3 + t * 0.6)), WOOD[hash(k, 2, 106) < 0.5 ? 2 : 4]);
  }
  const shaped = outline(sprite, INK);
  // The glint: gold in the hollow, catching the sun now and then.
  const glint = Math.sin(phase * Math.PI * 2) > 0.6;
  for (const [dx, dy] of [[-1, 0], [0, 0], [2, 1]]) shaped.set(cx + dx, cy - 2 + dy, GOLD[glint ? 6 : 5]);
  if (glint) for (const [dx, dy] of [[0, -1], [0, -2], [-1, -1], [1, -1]]) shaped.set(cx + dx, cy - 2 + dy, NEUTRAL[7]);
  return shaped;
}

export { BLUE4, castShadow, COAT4, DIRT4, flat, GOLD4, OAK4, PLASTER4, RED4, shadowOval, sphere, STONE4, WOOD4 };
