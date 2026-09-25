import { Bitmap, outline, SHADOW } from './bitmap';
import { hash, noise, rng, shade } from './noise';
import { BLUE, DIRT, GOLD, INK, LEAF, NEUTRAL, PARCHMENT, PINE, RED, ROCK, SKIN, STONE, WATER, WOOD } from './palette';

/** Light comes from the top left and a little towards the viewer, as on the painted HoMM2 maps. */
const L = (() => {
  const v = [-0.62, -0.55, 0.56];
  const n = Math.hypot(...v);
  return v.map((c) => c / n);
})();

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const OUTSIDE = -9;

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
      sprite.set(x, y, shade(WOOD, 0.75 - t * 0.6 + (hash(x, y, seed) - 0.5) * 0.2, x, y));
    }
  }
  for (let y = 0; y < sprite.height; y++) {
    for (let x = 0; x < sprite.width; x++) {
      let best = OUTSIDE;
      for (const b of blobs) best = Math.max(best, sphere(x, y, b.x, b.y, b.r));
      if (best === OUTSIDE) continue;
      const clumps = (noise(x / 2.6, y / 2.6, seed) - 0.5) * 0.55 + (hash(x, y, seed + 1) - 0.5) * 0.14;
      sprite.set(x, y, shade(LEAF, clamp01(0.08 + best * 0.9 + clumps), x, y));
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
    for (let x = Math.floor(cx - 1); x < cx + 1; x++) sprite.set(x, y, shade(WOOD, 0.6 - (x - cx + 1) * 0.3, x, y));
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
        sprite.set(x, y, shade(PINE, clamp01(light + (hash(x, y, seed + t) - 0.5) * 0.3 - 0.08), x, y));
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
      sprite.set(x, y, shade(ROCK, clamp01(0.25 + light * 0.75 + facets), x, y));
    }
  }
  const shaped = outline(sprite, ROCK[0]);
  castShadow(shaped, 3, 1, cy);
  return shaped;
}

/** A rocky range: overlapping jagged crags lit on their left faces, with ridges and gullies. */
export function mountain(width: number, height: number, seed: number): Bitmap {
  const random = rng(seed);
  const sprite = new Bitmap(width + 14, height + 6);
  const base = height;
  const peaks = [0.24, 0.5, 0.74, 0.38, 0.62]
    .map((p, i) => ({
      x: width * (p + (random() - 0.5) * 0.08),
      top: height * (i === 1 ? 0.02 : 0.14 + random() * 0.3),
      left: width * (0.2 + random() * 0.12),
      right: width * (0.16 + random() * 0.12),
      foot: base - (i > 2 ? 0 : 5 + random() * 10),
    }))
    .sort((a, b) => a.foot - b.foot || b.top - a.top);
  for (const [n, peak] of peaks.entries()) {
    for (let y = Math.floor(peak.top); y < peak.foot; y++) {
      const k = (y - peak.top) / (peak.foot - peak.top);
      const jag = (noise(y / 2.5, n * 13.1, seed) - 0.5) * 7 * Math.min(1, k * 3);
      const left = peak.left * Math.pow(k, 0.8) + jag;
      const right = peak.right * Math.pow(k, 0.8) - jag * 0.7;
      for (let x = Math.floor(peak.x - left); x <= peak.x + right; x++) {
        const u = x + 0.5 < peak.x ? (x + 0.5 - peak.x) / Math.max(left, 1) : (x + 0.5 - peak.x) / Math.max(right, 1);
        const gully = 1 - Math.abs(noise(x / 4 + y / 9, y / 6, seed + n) * 2 - 1);
        const detail = (gully - 0.55) * 0.5 + (noise(x / 1.7, y / 1.7, seed + 4) - 0.5) * 0.22;
        let light = (u < 0 ? 0.66 + u * 0.12 : 0.44 - u * 0.3) - k * 0.26 + detail;
        if (u > -0.08 && u < 0.05) light += 0.12;
        sprite.set(x, y, shade(ROCK, clamp01(light), x, y));
      }
    }
  }
  const shaped = outline(sprite, ROCK[0]);
  castShadow(shaped, 9, 3, height * 0.45);
  return shaped;
}

/** Stone courses with staggered joints, lit by `light` in [0, 1]. */
function masonry(x: number, y: number, light: number, seed: number): number {
  const row = Math.floor(y / 3);
  const joint = (x + (row % 2) * 3) % 6 === 0;
  if (y % 3 === 2 || joint) return shade(STONE, clamp01(light - 0.32), x, y);
  const brick = hash(Math.floor((x + (row % 2) * 3) / 6), row, seed);
  return shade(STONE, clamp01(light + (brick - 0.5) * 0.22), x, y);
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
      sprite.set(x, y, shade(RED, clamp01(0.78 - u * 0.5 + stripe - (k > 0.92 ? 0.3 : 0)), x, y));
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
      sprite.set(x, y, shade(RED, clamp01(0.8 - u * 0.45 - (k > 0.9 ? 0.35 : 0)), x, y));
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

/** The hero: a knight in a red cape on a white horse, carrying the player's blue flag. */
export function hero(phase = 0): Bitmap {
  const sprite = new Bitmap(38, 44);
  const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number, a = 0) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    const u = (dx * Math.cos(a) + dy * Math.sin(a)) / rx;
    const v = (-dx * Math.sin(a) + dy * Math.cos(a)) / ry;
    return u * u + v * v <= 1;
  };
  const coat = (x: number, y: number, level: number) => shade(NEUTRAL, clamp01(level), x, y);
  // Tail, far legs, body, near legs, neck and head.
  for (let y = 22; y < 34; y++) for (let x = 5; x < 10; x++) if (inEllipse(x, y, 8.2 - (y - 22) * 0.18, 27.5, 1.6, 5.8, 0.25)) sprite.set(x, y, NEUTRAL[4]);
  const leg = (x0: number, dark: boolean) => {
    for (let y = 30; y < 40; y++) {
      for (let x = x0; x < x0 + 2; x++) sprite.set(x, y, y > 37 ? INK : coat(x, y, dark ? 0.45 : 0.8 - (x - x0) * 0.2));
    }
  };
  leg(11, true);
  leg(24, true);
  for (let y = 18; y < 34; y++) {
    for (let x = 6; x < 30; x++) {
      if (!inEllipse(x, y, 18, 27, 10.5, 5.2)) continue;
      const light = sphere(x, y, 16, 24, 12);
      sprite.set(x, y, coat(x, y, 0.35 + light * 0.65));
    }
  }
  leg(14, false);
  leg(27, false);
  for (let y = 12; y < 28; y++) {
    for (let x = 22; x < 36; x++) {
      const neck = inEllipse(x, y, 27.2, 20.5, 3.4, 6.5, -0.55);
      const head = inEllipse(x, y, 31.5, 15.2, 4.1, 2.4, 0.5);
      if (!neck && !head) continue;
      sprite.set(x, y, coat(x, y, head ? 0.78 - (x - 28) * 0.05 : 0.7 - (x - 24) * 0.04));
    }
  }
  for (let y = 12; y < 22; y++) sprite.set(Math.round(25 + (y - 12) * 0.28), y, NEUTRAL[2]);
  sprite.set(30, 11, NEUTRAL[5]);
  sprite.set(30, 10, NEUTRAL[4]);
  sprite.set(33, 14, INK);
  // Blue caparison with a gold hem.
  for (let y = 24; y < 32; y++) {
    for (let x = 10; x < 25; x++) {
      if (!inEllipse(x, y, 18, 27, 10.5, 5.2)) continue;
      sprite.set(x, y, y === 31 || (y === 30 && x % 2 === 0) ? GOLD[4] : shade(BLUE, 0.62 - (y - 24) * 0.05, x, y));
    }
  }
  // Rider: cape, armoured body, helmet with a red plume.
  for (let y = 11; y < 27; y++) {
    for (let x = 9; x < 17; x++) {
      if (!inEllipse(x, y, 13.5 - (y - 11) * 0.12, 19, 3.2 + (y - 11) * 0.12, 8)) continue;
      sprite.set(x, y, shade(RED, clamp01(0.62 - (y - 11) * 0.03 + (x % 3 === 0 ? -0.15 : 0)), x, y));
    }
  }
  for (let y = 12; y < 24; y++) {
    for (let x = 14; x < 21; x++) {
      if (!inEllipse(x, y, 17.4, 18, 3.2, 6)) continue;
      const light = sphere(x, y, 16.4, 16, 5);
      sprite.set(x, y, shade(STONE, clamp01(0.45 + light * 0.55), x, y));
    }
  }
  for (let y = 5; y < 12; y++) {
    for (let x = 14; x < 21; x++) {
      if (!inEllipse(x, y, 17.4, 8.6, 2.8, 3.2)) continue;
      const light = sphere(x, y, 16.6, 7.6, 3.4);
      sprite.set(x, y, y === 9 && x > 17 ? INK : shade(STONE, clamp01(0.5 + light * 0.5), x, y));
    }
  }
  for (const [x, y] of [[16, 4], [15, 3], [16, 3], [14, 2], [15, 2], [13, 2]]) sprite.set(x, y, RED[4]);
  sprite.set(19, 10, SKIN[3]);
  // Lance with the blue banner.
  for (let y = 0; y < 30; y++) sprite.set(21, y, y < 1 ? GOLD[5] : WOOD[2]);
  for (let i = 1; i < 12; i++) {
    const wave = Math.round(Math.sin(i * 0.65 + phase) * 1.1);
    for (let j = 0; j < 7 - Math.floor(i / 4); j++) {
      const emblem = i > 3 && i < 7 && j > 1 && j < 5;
      sprite.set(21 + i, 2 + j + wave, emblem ? GOLD[5] : j === 0 ? BLUE[5] : shade(BLUE, 0.55 - j * 0.04, i, j));
    }
  }
  const shaped = outline(sprite, INK);
  shadowOval(shaped, 21, 40, 13, 2.6);
  return shaped;
}

/** Wooden plank bridge running east to west. */
export function bridge(length: number): Bitmap {
  const sprite = new Bitmap(length, 26);
  for (let y = 6; y < 22; y++) {
    for (let x = 0; x < length; x++) {
      const plank = Math.floor(x / 3);
      const seam = x % 3 === 0;
      const light = 0.55 + (hash(plank, 0, 3) - 0.5) * 0.3 - (y > 18 ? 0.3 : 0) + (y < 8 ? 0.15 : 0);
      sprite.set(x, y, seam ? WOOD[1] : shade(WOOD, clamp01(light), x, y));
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
      let color = shade(WOOD, (lid ? 0.8 : 0.55) - (x - 2) * 0.02, x, y);
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
      sprite.set(x, y, shade(GOLD, clamp01(0.3 + light * 0.7 + coin), x, y));
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
  return beam ? shade(WOOD, 0.3, x, y) : shade(PARCHMENT, clamp01(light), x, y);
}

/** Steep roof: thatch or slate, drawn as a gable seen from the south. */
function roof(sprite: Bitmap, x0: number, x1: number, top: number, bottom: number, ramp: readonly number[]) {
  for (let y = top; y < bottom; y++) {
    const k = (y - top) / (bottom - top);
    for (let x = x0 - 2; x < x1 + 2; x++) {
      const u = (x - x0) / (x1 - x0);
      const straw = (noise(x / 1.5, y / 4, 81) - 0.5) * 0.3 + (y % 3 === 0 ? -0.1 : 0);
      const level = 0.75 - u * 0.35 - k * 0.2 + straw - (y === bottom - 1 ? 0.3 : 0);
      sprite.set(x, y, shade(ramp, clamp01(level), x, y));
    }
  }
}

export function hut(seed: number): Bitmap {
  const sprite = new Bitmap(34, 32);
  const random = rng(seed);
  const wallTop = 14 + Math.floor(random() * 2);
  for (let y = wallTop; y < 28; y++) for (let x = 5; x < 27; x++) sprite.set(x, y, timber(x, y, 5, 27, 0.8 - (x - 5) * 0.012));
  for (let y = 20; y < 28; y++) for (let x = 14; x < 19; x++) sprite.set(x, y, y === 20 ? WOOD[1] : shade(WOOD, 0.45, x, y));
  for (const wx of [8, 22]) for (let y = 18; y < 22; y++) for (let x = wx; x < wx + 3; x++) sprite.set(x, y, y === 18 ? WOOD[2] : GOLD[5]);
  roof(sprite, 5, 27, 3, wallTop + 1, DIRT);
  const shaped = outline(sprite, INK);
  castShadow(shaped, 5, 2, 20);
  return shaped;
}

/** The watermill with its wheel turned to `turn` (0 to 1 round). */
export function mill(turn: number): Bitmap {
  const sprite = new Bitmap(56, 50);
  for (let y = 20; y < 44; y++) for (let x = 16; x < 48; x++) sprite.set(x, y, timber(x, y, 16, 48, 0.8 - (x - 16) * 0.01));
  for (let y = 32; y < 44; y++) for (let x = 36; x < 42; x++) sprite.set(x, y, y === 32 ? WOOD[1] : shade(WOOD, 0.4, x, y));
  roof(sprite, 16, 48, 4, 21, WOOD);
  // Wheel on the west wall, facing the river.
  const cx = 12;
  const cy = 36;
  for (let y = cy - 12; y <= cy + 12; y++) {
    for (let x = cx - 7; x <= cx + 7; x++) {
      const u = (x - cx) / 7;
      const v = (y - cy) / 12;
      const r = Math.hypot(u, v);
      if (r > 1) continue;
      const angle = Math.atan2(v, u) / (Math.PI * 2) + turn;
      const spoke = Math.abs(((angle * 8) % 1 + 1) % 1 - 0.5) < 0.12;
      if (r > 0.82) sprite.set(x, y, shade(WOOD, 0.55 - u * 0.3, x, y));
      else if (spoke || r < 0.2) sprite.set(x, y, shade(WOOD, 0.4 - u * 0.2, x, y));
      else if (y > cy + 5) sprite.set(x, y, WATER[8]);
    }
  }
  for (let x = cx - 6; x <= cx + 6; x++) sprite.set(x, cy + 13, WATER[9]);
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
  for (let y = 64; y < 74; y++) for (let x = 17; x < 23; x++) sprite.set(x, y, y === 64 ? STONE[6] : shade(WOOD, 0.35, x, y));
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
      sprite.set(x, y, y < 7 || y > 15 ? masonry(x, y, light, 92) : shade(DIRT, light, x, y));
    }
  }
  const shaped = outline(sprite, INK);
  for (let x = 2; x < length; x++) for (let y = 21; y < 24; y++) shaped.under(x, y, SHADOW);
  return shaped;
}

export const MINIMAP_COLOURS = { forest: PINE[4], mountain: ROCK[5], castle: BLUE[4], hero: BLUE[6], road: DIRT[5] };
