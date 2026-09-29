/**
 * Little sounds made on the spot with Web Audio: no files. Browsers only allow sound after the
 * player has clicked or pressed a key, so the audio starts then. M mutes it, and that sticks.
 */
import { audio, isMuted } from '../audio/context';
import { playNote } from '../audio/instruments';
import { sting } from '../audio/stings';
import { Terrain } from '../rules/map/model';

export type Sound = 'click' | 'coins' | 'hit' | 'shoot' | 'bolt' | 'spell' | 'day' | 'levelUp' | 'victory' | 'defeat' | 'dig' | 'fanfare' | 'charge' | 'page' | 'lift' | 'equip' | 'march' | 'jeer' | 'song' | 'luckySong' | 'falter' | 'cheer';

/** Sound effects go to the effects bus of the shared audio context (see `audio/context.ts`). */
export { toggleMute, wakeAudio as wakeSound } from '../audio/context';

/** A plucked or struck note: a wave that starts at `volume` and dies away. */
function tone(frequency: number, at: number, length: number, type: OscillatorType = 'triangle', volume = 1, slide = 1) {
  const { ctx: c, sfx: master } = audio()!;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);
  if (slide !== 1) osc.frequency.exponentialRampToValueAtTime(frequency * slide, at + length);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(master);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

/** A burst of noise through a filter: thumps, whooshes and crackles. */
function noise(at: number, length: number, filter: BiquadFilterType, frequency: number, volume = 1, sweep = 1) {
  const { ctx: c, sfx: master } = audio()!;
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * length), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const source = c.createBufferSource();
  source.buffer = buffer;
  const shape = c.createBiquadFilter();
  shape.type = filter;
  shape.frequency.setValueAtTime(frequency, at);
  if (sweep !== 1) shape.frequency.exponentialRampToValueAtTime(frequency * sweep, at + length);
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  source.connect(shape).connect(gain).connect(master);
  source.start(at);
}

export function play(sound: Sound) {
  const a = audio();
  if (!a || isMuted()) return;
  if (sound === 'victory' || sound === 'defeat' || sound === 'levelUp') return sting(sound);
  try {
    const t = a.ctx.currentTime + 0.01;
    switch (sound) {
      case 'click':
        tone(520, t, 0.05, 'square', 0.12, 0.7);
        break;
      case 'coins':
        [1320, 1760, 1480, 1980].forEach((f, i) => tone(f, t + i * 0.055, 0.12, 'sine', 0.35));
        break;
      case 'hit':
        noise(t, 0.12, 'lowpass', 900, 0.9, 0.4);
        tone(110, t, 0.12, 'sine', 0.6, 0.6);
        break;
      case 'shoot':
        noise(t, 0.22, 'bandpass', 2400, 0.35, 0.3);
        break;
      case 'bolt':
        noise(t, 0.35, 'highpass', 1800, 0.8, 0.5);
        tone(880, t, 0.3, 'sawtooth', 0.25, 0.25);
        break;
      case 'spell':
        [660, 880, 1100, 1320].forEach((f, i) => tone(f, t + i * 0.06, 0.25, 'sine', 0.3));
        break;
      case 'day':
        tone(392, t, 1.1, 'sine', 0.4);
        tone(784, t, 0.8, 'sine', 0.15);
        break;
      case 'fanfare': {
        // Three quick calls up the chord of G, then the whole chord held, on the drum.
        const calls: [number, number, number][] = [[55, 0, 0.15], [59, 0.16, 0.15], [62, 0.32, 0.15], [67, 0.5, 1.2], [62, 0.5, 1.2], [59, 0.5, 1.2]];
        for (const [midi, at, length] of calls) playNote(a.ctx, a.sfx, 'brass', t + at, midi, length, 0.3);
        playNote(a.ctx, a.sfx, 'tabor', t + 0.5, 43, 0.3, 0.7);
        break;
      }
      case 'charge':
        // A hunting horn: two quick calls and a long one, and hooves.
        for (const [midi, at, length] of [[67, 0, 0.1], [67, 0.12, 0.1], [74, 0.24, 0.45]] as [number, number, number][]) playNote(a.ctx, a.sfx, 'brass', t + at, midi, length, 0.34);
        for (const d of [0, 0.09, 0.18, 0.27]) noise(t + d, 0.06, 'lowpass', 700, 0.5);
        break;
      case 'page':
        // A page of the hero's book turning.
        noise(t, 0.16, 'bandpass', 2600, 0.35, 0.45);
        break;
      case 'lift':
        noise(t, 0.05, 'bandpass', 1400, 0.3, 1.6);
        break;
      case 'equip':
        // Buckles and a little ring of metal.
        noise(t, 0.04, 'highpass', 3000, 0.25);
        tone(1760, t + 0.02, 0.1, 'triangle', 0.22);
        tone(2637, t + 0.06, 0.18, 'sine', 0.14);
        break;
      case 'march':
        // Boots going off down the road.
        [0, 0.14, 0.28, 0.42].forEach((d, i) => noise(t + d, 0.06, 'lowpass', 600, 0.55 - i * 0.12));
        break;
      case 'jeer':
        // A raspberry on the brass: two notes sliding down, and a sour one to finish.
        for (const [midi, at, length] of [[62, 0, 0.14], [58, 0.16, 0.14], [53, 0.32, 0.5]] as [number, number, number][]) playNote(a.ctx, a.sfx, 'brass', t + at, midi, length, 0.3);
        break;
      case 'song':
        // A marching song on the lute: up the chord of G and a stamp on the drum.
        [55, 59, 62, 67, 62, 67].forEach((midi, i) => playNote(a.ctx, a.sfx, 'lute', t + i * 0.13, midi, 0.3, 0.45));
        playNote(a.ctx, a.sfx, 'tabor', t + 0.52, 43, 0.3, 0.5);
        break;
      case 'luckySong':
        // A lucky song: a lilting run on the lute, and a bell at the end.
        [64, 67, 69, 72, 69, 76].forEach((midi, i) => playNote(a.ctx, a.sfx, 'lute', t + i * 0.11, midi, 0.28, 0.42));
        playNote(a.ctx, a.sfx, 'bell', t + 0.7, 84, 0.8, 0.18);
        break;
      case 'falter':
        // Spirits sinking: a low drone that sags.
        tone(196, t, 0.5, 'triangle', 0.35, 0.7);
        break;
      case 'cheer':
        // A short call rising on the brass: good spirits, and a stack goes again.
        for (const [midi, at, length] of [[62, 0, 0.09], [67, 0.1, 0.3]] as [number, number, number][]) playNote(a.ctx, a.sfx, 'brass', t + at, midi, length, 0.28);
        break;
      case 'dig':
        [0, 0.25, 0.5].forEach((d) => noise(t + d, 0.1, 'lowpass', 500, 0.8));
        tone(1568, t + 0.8, 0.9, 'sine', 0.35);
        break;
    }
  } catch {
    // A sound that can't be made is not worth stopping the game for.
  }
}

/** One footfall (or hoofbeat, mounted), coloured by the terrain underfoot. */
export function playStep(terrain: Terrain, rides: boolean) {
  const a = audio();
  if (!a || isMuted()) return;
  try {
    const t = a.ctx.currentTime + 0.01;
    // A hoofbeat is two quick clops (the fore and hind foot); a footstep is one, softer fall.
    const beats = rides ? [0, 0.09] : [0];
    const loud = rides ? 1 : 0.55;
    for (const d of beats) {
      switch (terrain) {
        case Terrain.Road:
          noise(t + d, 0.05, 'bandpass', 1300, 0.55 * loud, 0.6);
          break;
        case Terrain.Bridge:
          // Hollow boards underfoot.
          noise(t + d, 0.05, 'bandpass', 900, 0.4 * loud);
          tone(200, t + d, 0.08, 'triangle', 0.22 * loud, 0.7);
          break;
        case Terrain.Ford:
          // Wading the ford: a splash, and the water running off.
          noise(t + d, 0.12, 'bandpass', 2100, 0.34 * loud, 0.45);
          noise(t + d + 0.04, 0.2, 'highpass', 3600, 0.1 * loud);
          break;
        case Terrain.Forest:
          // A soft fall, with a leaf or twig underfoot.
          noise(t + d, 0.06, 'lowpass', 400, 0.35 * loud, 0.5);
          noise(t + d + 0.01, 0.03, 'highpass', 2600, 0.12 * loud);
          break;
        default:
          // Grass, and anywhere else: a dull thud.
          noise(t + d, 0.07, 'lowpass', 320, 0.4 * loud, 0.5);
      }
    }
  } catch {
    // A step that can't be made is not worth stopping the game for.
  }
}
