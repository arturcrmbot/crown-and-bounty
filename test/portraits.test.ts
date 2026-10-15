import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadMapArt, paintedPortrait } from '../src/render/mapArt';
import { PAINTED_PORTRAITS } from '../src/render/mapPieces';
import { PORTRAIT_SIZE, portraitOf } from '../src/render/portraits';

describe('the faces on the cards (#311)', () => {
  beforeAll(() => loadMapArt(async (file) => new Uint8Array(readFileSync(`public/assets/${file.includes('/') ? file : `map/${file}`}`))));

  it('shows the painted face where there is one, at the portrait size, standing on its bottom edge', () => {
    for (const id of PAINTED_PORTRAITS) {
      const face = portraitOf(id);
      expect(face).toBe(paintedPortrait(id));
      expect([face.width, face.height]).toEqual([PORTRAIT_SIZE, PORTRAIT_SIZE]);
      expect(face.data.subarray(face.width * (face.height - 1)).some((v) => v !== 0)).toBe(true);
    }
  });

  it('paints every face on the cards', () => {
    for (const id of ['king', 'knight', 'wizard', 'ranger', 'courtier', 'grimsby', 'mirrow', 'bramble', 'anselm', 'sergeant', 'nan', 'dwarf', 'goose', 'rook', 'foreman', 'warren'] as const) expect(paintedPortrait(id)).not.toBeNull();
  });
});
