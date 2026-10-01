import { describe, expect, it } from 'vitest';
import json from '../../public/assets/music/band.json';
import binary from '../../public/assets/music/band.bin?inline';
import script from '../../scripts/soundfont.py?raw';
import { decodeAdpcm, KIT, MELODIC, RANGES, zoneFor, type BandData } from './band';
import { TUNES } from './score';

const band = json as unknown as BandData;
const pack = Uint8Array.from(atob(binary.split(',')[1]), (c) => c.charCodeAt(0));

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

  it('decodes every sample, and every loop lies inside its sample', () => {
    for (const s of band.samples) {
      const data = decodeAdpcm(pack, s);
      expect(data.length).toBe(s.length);
      expect(data.every((v) => Number.isFinite(v) && Math.abs(v) <= 1)).toBe(true);
      expect(s.loopStart >= 0 && s.loopStart <= s.loopEnd && s.loopEnd <= s.length).toBe(true);
      expect(s.offset + Math.ceil(s.length / 2)).toBeLessThanOrEqual(pack.length);
    }
  });

  it('stays light enough for a phone to fetch', () => {
    expect(pack.length).toBeLessThan(1_000_000);
  });
});
