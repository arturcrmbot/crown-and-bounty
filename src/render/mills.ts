import { Bitmap, SHADOW } from './bitmap';
import { piece } from './mapArt';
import { WOOD } from './palette';
import { windmillSails } from './sprites';

type MillName = 'watermill' | 'windmill';
type MillArt = { frames: Bitmap[]; foot: number; animated: true; mechanism: true };
const mills: Partial<Record<MillName, MillArt>> = {};

/** The existing paintings, with only their mechanisms turning on the 120 ms map clock. */
export function paintedMill(name: MillName): MillArt | null {
  if (mills[name]) return mills[name];
  const painting = piece(name);
  if (!painting) return null;
  const { sprite } = painting;
  const padding = name === 'windmill' ? 12 : 0;
  const body = new Bitmap(sprite.width + padding * 2, sprite.height + padding);
  for (let y = 0; y < sprite.height; y++) {
    for (let x = 0; x < sprite.width; x++) {
      let colour = sprite.get(x, y);
      if (name === 'windmill' && y < 54) {
        const dx = x - 26;
        const dy = y - 26;
        const inside = y >= 30 ? x >= 17 && x <= 39 : y >= 13 && Math.abs(dx) <= Math.min(12, y - 12);
        if (!inside) colour = 0;
        // Uncover the boards beneath the baked sails from the painting's own timber columns.
        else if (Math.abs(Math.abs(dx) - Math.abs(dy)) <= 7 && Math.hypot(dx, dy) > 6) {
          colour = sprite.get(Math.max(18, Math.min(38, x)), 54 + y % 4);
        }
      }
      body.set(x + padding, y + padding, colour);
    }
  }
  const frames = Array.from({ length: 64 }, (_, i) => {
    const frame = new Bitmap(body.width, body.height);
    frame.data.set(body.data);
    const turn = i / 64;
    if (name === 'watermill') {
      const [cos, sin] = [Math.cos(turn * Math.PI * 2), Math.sin(turn * Math.PI * 2)];
      for (let y = 31; y < 53; y++) {
        for (let x = 39; x < 60; x++) {
          const u = (x - 49 + (y - 41) * 0.25) / 9.5;
          const v = (y - 41) / 11.5;
          if (u * u + v * v >= 0.72 || Math.abs(x - 49) <= 1 && Math.abs(y - 41) <= 1) continue;
          const sy = (v * cos - u * sin) * 11.5;
          const sx = (u * cos + v * sin) * 9.5 - sy * 0.25;
          const colour = sprite.get(Math.round(49 + sx), Math.round(41 + sy));
          if (colour && colour !== SHADOW) frame.set(x, y, colour);
        }
      }
    } else {
      windmillSails(frame, [26 + padding, 26 + padding], turn, 33);
      frame.fill(25 + padding, 25 + padding, 3, 3, WOOD[1]);
    }
    return [frame, frame];
  }).flat();
  // One full turn in 15.36 seconds; the common canvas and ground anchor never change.
  return mills[name] = { frames, foot: painting.foot + padding, animated: true, mechanism: true };
}
