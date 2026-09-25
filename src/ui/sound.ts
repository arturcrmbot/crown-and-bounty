/**
 * Little sounds made on the spot with Web Audio: no files. Browsers only allow sound after the
 * player has clicked or pressed a key, so the audio starts then. M mutes it, and that sticks.
 */
export type Sound = 'click' | 'coins' | 'hit' | 'shoot' | 'bolt' | 'spell' | 'day' | 'levelUp' | 'victory' | 'defeat' | 'dig';

const MUTE_KEY = 'kings-commission/muted';
let context: AudioContext | null = null;
let master: GainNode | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();

/** Called on the first click or key: only then may a page make sound. */
export function wakeSound() {
  if (context || typeof AudioContext === 'undefined') return;
  try {
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.22;
    master.connect(context.destination);
  } catch {
    context = null;
  }
}

export function toggleMute(): boolean {
  muted = !muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Nowhere to remember it; it still works for now.
  }
  if (master) master.gain.value = muted ? 0 : 0.22;
  return muted;
}

/** A plucked or struck note: a wave that starts at `volume` and dies away. */
function tone(frequency: number, at: number, length: number, type: OscillatorType = 'triangle', volume = 1, slide = 1) {
  const c = context!;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);
  if (slide !== 1) osc.frequency.exponentialRampToValueAtTime(frequency * slide, at + length);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(master!);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

/** A burst of noise through a filter: thumps, whooshes and crackles. */
function noise(at: number, length: number, filter: BiquadFilterType, frequency: number, volume = 1, sweep = 1) {
  const c = context!;
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
  source.connect(shape).connect(gain).connect(master!);
  source.start(at);
}

export function play(sound: Sound) {
  if (!context || !master || muted) return;
  try {
    const t = context.currentTime + 0.01;
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
      case 'levelUp':
        [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.11, 0.35, 'triangle', 0.45));
        break;
      case 'victory':
        [392, 523, 659, 784, 659, 784].forEach((f, i) => tone(f, t + i * 0.13, i === 5 ? 0.6 : 0.2, 'triangle', 0.45));
        break;
      case 'defeat':
        [392, 349, 311, 262].forEach((f, i) => tone(f, t + i * 0.22, 0.4, 'triangle', 0.4));
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
