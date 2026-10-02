import { describe, expect, it } from 'vitest';
import credits from '../../public/assets/CREDITS.md?raw';
import json from '../../public/assets/sfx/battle.json';
import flac from '../../public/assets/sfx/battle.flac?inline';
import script from '../../scripts/sfx.py?raw';
import { RECORDED_EFFECTS } from './blows';
import type { SamplePack } from './samples';

const pack = json as unknown as SamplePack;
const bytes = Uint8Array.from(atob(flac.split(',')[1]), (c) => c.charCodeAt(0));

/** A FLAC file's own account of itself (its STREAMINFO): rate, channels, bits a sample, and how many samples. */
function streamInfo(data: Uint8Array) {
  const at = 8 + 10;
  const bits = (from: number, count: number) => {
    let v = 0;
    for (let i = 0; i < count; i++) v = v * 2 + ((data[at + ((from + i) >> 3)] >> (7 - ((from + i) & 7))) & 1);
    return v;
  };
  return { magic: String.fromCharCode(...data.subarray(0, 4)), rate: bits(0, 20), channels: bits(20, 3) + 1, depth: bits(23, 5) + 1, samples: bits(28, 36) };
}

describe('the recorded sound effects', () => {
  it('pack every sound of a fight, each with a take or more', () => {
    expect(Object.keys(pack.effects).sort()).toEqual([...RECORDED_EFFECTS].sort());
    for (const [id, takes] of Object.entries(pack.effects)) {
      expect(takes.length, id).toBeGreaterThan(0);
      // None runs on and on: the longest is Lightning's roll of thunder.
      for (const t of takes) expect(t.length / pack.rate, id).toBeLessThan(4);
    }
  });

  it('keep their takes one after another in a lossless pack', () => {
    const info = streamInfo(bytes);
    expect(info).toMatchObject({ magic: 'fLaC', rate: pack.rate, channels: 1, depth: 16 });
    let at = 0;
    for (const takes of Object.values(pack.effects)) {
      for (const t of takes) {
        expect(t.offset).toBe(at);
        at += t.length;
      }
    }
    expect(info.samples).toBe(at);
  });

  it('stay light enough for a phone to fetch', () => {
    expect(bytes.length).toBeLessThan(2_500_000);
  });

  it('credit every recording they are cut from', () => {
    const named = [
      ...[...script.matchAll(/wesnoth\('([^']+)'\)/g)].map((m) => m[1]),
      ...[...script.matchAll(/leamon\('([^']+)'\)/g)].map((m) => `${m[1]}.wav`),
      ...[...script.matchAll(/kenney\('\w+', '([^']+)'\)/g)].map((m) => `${m[1]}.ogg`),
      ...[...script.matchAll(/freesound\((\d+)\)/g)].map((m) => `freesound.org/s/${m[1]}`),
    ];
    expect(named.length).toBeGreaterThan(40);
    // A take made in a loop names its file with the loop's letters in it: each of those is credited too.
    const looped = [...script.matchAll(/f'([\w-]+)\{k\}([\w.-]*)'/g)].map((m) => [m[1], m[2]]);
    for (const name of named.filter((n) => !n.includes('{'))) expect(credits, name).toContain(name);
    for (const [before, after] of looped) expect(credits, `${before}…${after}`).toMatch(new RegExp(`${before.replace(/[.]/g, '\\.')}\\w${after.replace(/[.]/g, '\\.')}`));
  });
});
