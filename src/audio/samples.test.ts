import { describe, expect, it } from 'vitest';
import credits from '../../public/assets/CREDITS.md?raw';
import battleJson from '../../public/assets/sfx/battle.json';
import battleFlac from '../../public/assets/sfx/battle.flac?inline';
import mapJson from '../../public/assets/sfx/map.json';
import mapFlac from '../../public/assets/sfx/map.flac?inline';
import script from '../../scripts/sfx.py?raw';
import { RECORDED_EFFECTS } from './blows';
import { MAP_SAMPLES } from './effects';
import { STING_SAMPLES } from './stings';
import type { SamplePack } from './samples';

const bytesOf = (inline: string) => Uint8Array.from(atob(inline.split(',')[1]), (c) => c.charCodeAt(0));

/** Each pack, its bytes, and what it must hold. */
const PACKS = {
  // The fight's sounds, the war horn into battle, and the gallop under the charge's horn call.
  battle: { pack: battleJson as unknown as SamplePack, bytes: bytesOf(battleFlac), holds: [...RECORDED_EFFECTS, ...STING_SAMPLES, 'charge:gallop'] },
  // The map's, the cards' and the hero screen's.
  map: { pack: mapJson as unknown as SamplePack, bytes: bytesOf(mapFlac), holds: MAP_SAMPLES },
};

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

describe.each(Object.entries(PACKS))('the %s pack of recorded sounds', (_, { pack, bytes, holds }) => {
  it('holds every sound it plays, each with a take or more', () => {
    expect(Object.keys(pack.effects).sort()).toEqual([...holds].sort());
    for (const [id, takes] of Object.entries(pack.effects)) {
      expect(takes.length, id).toBeGreaterThan(0);
      // None runs on and on: the longest is Lightning's roll of thunder.
      for (const t of takes) expect(t.length / pack.rate, id).toBeLessThan(4);
    }
  });

  it('keeps its takes one after another, losslessly', () => {
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

  it('stays light enough for a phone to fetch', () => {
    expect(bytes.length).toBeLessThan(2_500_000);
  });
});

describe('the recorded sound effects', () => {
  it('credit every recording they are cut from', () => {
    const named = [
      ...[...script.matchAll(/wesnoth\('([^']+)'\)/g)].map((m) => m[1]),
      ...[...script.matchAll(/leamon\('([^']+)'\)/g)].map((m) => `${m[1]}.wav`),
      ...[...script.matchAll(/kenney\('\w+', '([^']+)'\)/g)].map((m) => `${m[1]}.ogg`),
      ...[...script.matchAll(/freesound\((\d+)\)/g)].map((m) => `freesound.org/s/${m[1]}`),
      ...[...script.matchAll(/lrsf\('([^']+)'\)/g)].map((m) => `${m[1]}.wav`),
      ...[...script.matchAll(/rubberduck\('\w+', '([^']+)'\)/g)].map((m) => `${m[1]}.ogg`),
      ...[...script.matchAll(/oga\('([^']+)'\)/g)].map((m) => m[1]),
    ];
    expect(named.length).toBeGreaterThan(40);
    // A take made in a loop names its file with the loop's letters in it: each of those is credited too.
    const looped = [...script.matchAll(/f'([\w-]+)\{k\}([\w.-]*)'/g)].map((m) => [m[1], m[2]]);
    for (const name of named.filter((n) => !n.includes('{'))) expect(credits, name).toContain(name);
    for (const [before, after] of looped) expect(credits, `${before}…${after}`).toMatch(new RegExp(`${before.replace(/[.]/g, '\\.')}\\w${after.replace(/[.]/g, '\\.')}`));
  });
});
