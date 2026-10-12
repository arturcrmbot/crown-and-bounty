import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TROOPS } from '../src/content/troops';
import { FIGURE_ANIMATIONS, FIGURES } from '../src/render/mapPieces';

describe('painted figures (#255)', () => {
  it('paints every troop, captain and Aldric at battle and map size, as #189 painted the first ones', () => {
    const painted = (id: string) => (FIGURES as readonly string[]).includes(id) && ['battle', 'map'].every((size) => existsSync(`public/assets/troops/${id}-${size}.png`));
    const unpainted = [...Object.keys(TROOPS), 'hero'].filter((id) => !painted(id));
    expect(unpainted, 'every troop needs a painted figure: see .github/skills/kings-commission-mapart/SKILL.md').toEqual([]);
  });

  it('gives every possible map figure genuine travel and separate resting poses, with no standing-bitmap coverage fallback', () => {
    const pending = Object.keys(TROOPS).flatMap((id) => {
      const move = FIGURE_ANIMATIONS[id]?.move;
      const idle = FIGURE_ANIMATIONS[id]?.idle;
      const missing = [];
      if (!move?.feet.map || move.frames.length < 4 || !move.stride || !move.footfalls?.length) missing.push(`${id} move`);
      if (!idle?.feet.map || idle.frames.length < 2) missing.push(`${id} idle`);
      for (const frame of [...(move?.frames ?? []), ...(idle?.frames ?? [])]) {
        if (!existsSync(`public/assets/troops/${frame.name}-map.png`)) missing.push(`${frame.name} asset`);
      }
      return missing;
    });
    expect(pending, 'unfinished map poses must be named, not counted as complete').toEqual([]);
    const hash = (name: string) => createHash('sha256').update(readFileSync(`public/assets/troops/${name}-map.png`)).digest('hex');
    for (const id of Object.keys(TROOPS)) {
      const walks = new Set(FIGURE_ANIMATIONS[id].move!.frames.map((frame) => hash(frame.name)));
      const rests = new Set(FIGURE_ANIMATIONS[id].idle!.frames.map((frame) => hash(frame.name)));
      expect(walks.size, `${id} needs different gait poses`).toBeGreaterThan(2);
      expect(rests.size, `${id} needs different resting poses`).toBeGreaterThan(1);
      expect([...rests].some((rest) => walks.has(rest)), `${id} must not freeze a walking bitmap to rest`).toBe(false);
    }
  });
});
