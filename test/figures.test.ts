import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { leads, TROOPS } from '../src/content/troops';
import type { AnimName } from '../src/render/battleSprites';
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

  it('reuses every inspected gait and grounded rest at battle scale', () => {
    const pending = Object.keys(TROOPS).flatMap((id) => (['move', 'idle', 'stand'] as const).flatMap((anim) => {
      const sequence = FIGURE_ANIMATIONS[id]?.[anim];
      if (!sequence?.feet.battle) return [`${id} ${anim}`];
      return sequence.frames.filter((frame) => !existsSync(`public/assets/troops/${frame.name}-battle.png`)).map((frame) => `${frame.name} asset`);
    }));
    expect(pending, 'battle must load the painted poses, not only the map-sized ones').toEqual([]);
  });

  it('covers every remaining legal battle action without pretending a static fallback is finished', () => {
    const pending = Object.values(TROOPS).flatMap((troop) => {
      const actions: AnimName[] = ['move', 'idle', 'stand'];
      if (!leads(troop.id) || troop.id === 'heroKnight') actions.push('melee');
      if (!leads(troop.id) && troop.id !== 'knights') actions.push('defend', 'defendRanged', 'death');
      if (troop.shots) actions.push('ranged');
      if (troop.caster || (troop.hero && troop.id !== 'heroKnight')) actions.push('cast');
      return actions.flatMap((anim) => {
        const sequence = FIGURE_ANIMATIONS[troop.id]?.[anim];
        if (!sequence?.feet.battle || !sequence.frames.length) return [`${troop.id} ${anim}`];
        return sequence.frames.filter(frame => !existsSync(`public/assets/troops/${frame.name}-battle.png`)).map(frame => `${frame.name} asset`);
      });
    });
    expect(pending, 'the approved mounted poses stay in place; every other legal action must really load').toEqual([]);
  });
});
