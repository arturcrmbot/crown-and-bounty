import { describe, expect, it } from 'vitest';
import json from '../../public/assets/music/band.json';
import flac from '../../public/assets/music/band.flac?inline';
import script from '../../scripts/soundfont.py?raw';
import { KIT, MELODIC, RANGES, zoneFor, type BandData } from './band';
import { TUNES } from './score';

const band = json as unknown as BandData;
const pack = Uint8Array.from(atob(flac.split(',')[1]), (c) => c.charCodeAt(0));

/** A FLAC file's own account of itself (its STREAMINFO): rate, channels, bits a sample, and how many samples. */
function streamInfo(bytes: Uint8Array) {
  const at = 8 + 10;
  const bits = (from: number, count: number) => {
    let v = 0;
    for (let i = 0; i < count; i++) v = v * 2 + ((bytes[at + ((from + i) >> 3)] >> (7 - ((from + i) & 7))) & 1);
    return v;
  };
  return { magic: String.fromCharCode(...bytes.subarray(0, 4)), rate: bits(0, 20), channels: bits(20, 3) + 1, depth: bits(23, 5) + 1, samples: bits(28, 36) };
}

describe('the band', () => {
  it('has every instrument the score plays, every key of each, and every drum', () => {
    for (const instrument of MELODIC) {
      const zones = band.instruments[instrument];
      expect(zones?.length, instrument).toBeGreaterThan(0);
      for (let key = RANGES[instrument][0]; key <= RANGES[instrument][1]; key++) {
        const z = zoneFor(zones, key);
        expect(z.keys[0] <= key && key <= z.keys[1], `${instrument} ${key}`).toBe(true);
      }
    }
    for (const drum of KIT) expect(band.instruments[drum]?.[0]?.drum, drum).toBe(true);
    for (const tune of Object.values(TUNES)) {
      for (const voice of Object.values(tune.parts).flat()) {
        const used = 'drums' in voice ? Object.values(voice.drums) : [voice.instrument];
        for (const instrument of used) expect(band.instruments[instrument], instrument).toBeDefined();
      }
    }
  });

  it('keeps the same keys as the script that cuts it from the SoundFont', () => {
    for (const [instrument, [low, high]] of Object.entries(RANGES)) expect(script, instrument).toContain(`'${instrument}': (${low}, ${high})`);
  });

  it('keeps its samples one after another in a lossless pack, each loop inside its sample', () => {
    const info = streamInfo(pack);
    expect(info).toMatchObject({ magic: 'fLaC', rate: band.rate, channels: 1, depth: 16 });
    let at = 0;
    for (const s of band.samples) {
      expect(s.offset).toBe(at);
      expect(s.loopStart >= 0 && s.loopStart <= s.loopEnd && s.loopEnd <= s.length).toBe(true);
      at += s.length;
    }
    expect(info.samples).toBe(at);
  });

  it('stays light enough for a phone to fetch', () => {
    expect(pack.length).toBeLessThan(2_000_000);
  });
});
