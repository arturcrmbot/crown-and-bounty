import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TROOPS } from '../src/content/troops';
import { FIGURES } from '../src/render/mapPieces';

describe('painted figures (#255)', () => {
  it('paints every troop, captain and Aldric at battle and map size, as #189 painted the first ones', () => {
    const painted = (id: string) => (FIGURES as readonly string[]).includes(id) && ['battle', 'map'].every((size) => existsSync(`public/assets/troops/${id}-${size}.png`));
    const unpainted = [...Object.keys(TROOPS), 'hero'].filter((id) => !painted(id));
    expect(unpainted, 'every troop needs a painted figure: see .github/skills/kings-commission-mapart/SKILL.md').toEqual([]);
  });
});
