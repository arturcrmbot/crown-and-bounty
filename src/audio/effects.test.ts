import { describe, expect, it } from 'vitest';
import { TROOPS, type TroopId } from '../content/troops';
import { UNIT_ART } from '../render/units';
import { TROOP_SOUNDS } from './blows';
import { EFFECTS } from './effects';
import { playNote } from './instruments';
import { midiOf } from './score';
import { STINGS } from './stings';

/**
 * A stand-in for Web Audio, as strict as a browser: an exponential ramp to nothing, a time before
 * zero, a note stopped before it starts or started twice, a frequency no one can hear. In a browser
 * each would throw (and the sound would fail in silence, caught so the game goes on) or quietly
 * play nothing, so here each is written down as a fault.
 */
function fakeContext(faults: string[]) {
  const time = (what: string, t: number) => {
    if (!Number.isFinite(t) || t < 0) faults.push(`${what}: at ${t}`);
  };
  const param = (name: string, value: number) => ({
    value,
    setValueAtTime(v: number, t: number) {
      time(`${name}.setValueAtTime`, t);
      if (!Number.isFinite(v)) faults.push(`${name}.setValueAtTime(${v})`);
      this.value = v;
    },
    linearRampToValueAtTime(v: number, t: number) {
      time(`${name}.linearRamp`, t);
      if (!Number.isFinite(v)) faults.push(`${name}.linearRamp(${v})`);
      this.value = v;
    },
    exponentialRampToValueAtTime(v: number, t: number) {
      time(`${name}.exponentialRamp`, t);
      if (!Number.isFinite(v) || v === 0) faults.push(`${name}.exponentialRamp to ${v}`);
      if (this.value === 0 || Math.sign(this.value) !== Math.sign(v)) faults.push(`${name}.exponentialRamp from ${this.value}: it would stay put`);
      this.value = v;
    },
    setTargetAtTime(v: number, t: number, constant: number) {
      time(`${name}.setTarget`, t);
      if (!Number.isFinite(v) || !(constant > 0)) faults.push(`${name}.setTarget(${v}, ${constant})`);
    },
    cancelScheduledValues() {},
  });
  const node = () => ({ connect: <T>(to: T) => to, disconnect() {} });
  const scheduled = (name: string) => {
    let from: number | null = null;
    return {
      ...node(),
      start(t = 0, offset = 0, length?: number) {
        time(`${name}.start`, t);
        if (from !== null) faults.push(`${name} started twice`);
        if (offset < 0 || (length !== undefined && !(length > 0))) faults.push(`${name}.start(${t}, ${offset}, ${length})`);
        from = t;
      },
      stop(t = 0) {
        time(`${name}.stop`, t);
        if (from === null || t < from) faults.push(`${name} stopped at ${t}, before it started (${from})`);
      },
    };
  };
  const audible = (name: string, value: number) => {
    const p = param(name, value);
    const set = p.setValueAtTime.bind(p);
    const ramp = p.exponentialRampToValueAtTime.bind(p);
    const hear = (v: number) => v > 20000 && faults.push(`${name} at ${Math.round(v)} Hz: too high to hear`);
    return Object.assign(p, {
      setValueAtTime: (v: number, t: number) => (hear(v), set(v, t)),
      exponentialRampToValueAtTime: (v: number, t: number) => (hear(v), ramp(v, t)),
    });
  };
  const sampleRate = 48000;
  return {
    sampleRate,
    currentTime: 0,
    createGain: () => ({ ...node(), gain: param('gain', 1) }),
    createOscillator: () => ({ ...scheduled('oscillator'), type: 'sine', frequency: audible('oscillator.frequency', 440), detune: param('detune', 0) }),
    createBiquadFilter: () => ({ ...node(), type: 'lowpass', frequency: param('filter.frequency', 350), Q: param('filter.Q', 1), gain: param('filter.gain', 0) }),
    createBufferSource: () => ({ ...scheduled('buffer'), buffer: null, loop: false, playbackRate: param('playbackRate', 1) }),
    createStereoPanner: () => ({ ...node(), pan: param('pan', 0) }),
    createBuffer: (channels: number, length: number, rate: number) => {
      if (!(length >= 1) || !Number.isInteger(length)) faults.push(`createBuffer(${channels}, ${length})`);
      const data = new Float32Array(Math.max(1, Math.floor(length)));
      return { sampleRate: rate, length, duration: length / rate, numberOfChannels: channels, getChannelData: () => data };
    },
  } as unknown as BaseAudioContext;
}

describe('the sound effects', () => {
  it('each plays cleanly, with nothing a browser would refuse', () => {
    for (const [id, effect] of Object.entries(EFFECTS)) {
      // Most have a little chance in them: play each a few times.
      for (let i = 0; i < 5; i++) {
        const faults: string[] = [];
        const ctx = fakeContext(faults);
        effect.play(ctx, ctx.createGain(), 0.05);
        expect(faults, id).toEqual([]);
      }
    }
  });

  it('each has its mark in the mix and a level to bring it there', () => {
    for (const [id, effect] of Object.entries(EFFECTS)) {
      expect(['faint', 'soft', 'firm', 'loud'], id).toContain(effect.loud);
      expect(effect.level > 0.05 && effect.level <= 10, `${id}: ${effect.level}`).toBe(true);
    }
  });

  it('the stings play cleanly too', () => {
    for (const [id, sting] of Object.entries(STINGS)) {
      const faults: string[] = [];
      const ctx = fakeContext(faults);
      for (const [instrument, at, note, length, volume] of sting.hits) playNote(ctx, ctx.createGain(), instrument, 0.05 + at, instrument === 'tabor' || instrument === 'rim' ? 0 : midiOf(note), length, volume);
      expect(faults, id).toEqual([]);
    }
  });
});

describe('the sounds of a fight', () => {
  it('every troop strikes, cries and walks like what it is, and its shots loose and land', () => {
    for (const id of Object.keys(TROOPS) as TroopId[]) {
      const s = TROOP_SOUNDS[id];
      expect(s, id).toBeDefined();
      for (const effect of [`blow:${s.blow}`, `hurt:${s.cry}`, `dies:${s.cry}`, `feet:${s.feet}`]) expect(EFFECTS, `${id}: ${effect}`).toHaveProperty([effect]);
      const missile = UNIT_ART[id].ranged?.missile;
      if (missile) for (const effect of [`loose:${missile}`, `land:${missile}`]) expect(EFFECTS, `${id}: ${effect}`).toHaveProperty([effect]);
    }
  });

  it('beasts cry as beasts, and blows ring on the armoured', () => {
    expect(TROOP_SOUNDS.wolves.cry).toBe('wolf');
    expect(TROOP_SOUNDS.trolls.blow).toBe('fist');
    expect(TROOP_SOUNDS.knights.armour).toBe(true);
    expect(TROOP_SOUNDS.peasants.armour).toBeUndefined();
  });
});
