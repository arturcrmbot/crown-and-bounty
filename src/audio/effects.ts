/**
 * Every sound effect, as data: how it sits in the mix, and how it's made, in code with no files.
 * Each plays into any context (the live one, or one rendered offline to be measured by
 * `npm run listen`) at a given time, and its `level` brings it to its mark there: `soft` under the
 * music (clicks, pages, footfalls), `firm` level with it (coins, blows, cries), `loud` over it (the
 * heralds' fanfare). The sounds of a fight, by kind of troop, are in `blows.ts`.
 */
import { BATTLE_EFFECTS } from './blows';
import { playNote } from './instruments';
import { burst, crackle, rand, swish, tone, voice } from './synth';

export type Loudness = 'faint' | 'soft' | 'firm' | 'loud';
export type EffectDef = {
  /** Its mark in the mix: `npm run listen` says how far from it each effect sits. */
  loud: Loudness;
  /** Scales the whole effect, to bring it to its mark. */
  level: number;
  /** An effect that is music itself (the heralds' fanfare, the bard's songs) ducks the score a little for this long, so the two don't clash. */
  duck?: number;
  play: (ctx: BaseAudioContext, dest: AudioNode, at: number) => void;
};
type Play = EffectDef['play'];

/** What the hero's feet (or his horse's hooves) fall on as he rides the map. */
export type Ground = 'road' | 'bridge' | 'ford' | 'forest' | 'grass';

/** One footfall, coloured by the ground: a crunch on the road, hollow boards on a bridge, a splash in the ford, leaves in the wood, a thud on grass. */
const footfall =
  (ground: Ground, loud: number): Play =>
  (ctx, dest, t) => {
    switch (ground) {
      case 'road':
        return burst(ctx, dest, t, 0.05, 'bandpass', 1300, 0.55 * loud, 0.6);
      case 'bridge':
        burst(ctx, dest, t, 0.05, 'bandpass', 900, 0.4 * loud);
        return tone(ctx, dest, t, 200, 0.08, 0.22 * loud, 'triangle', 0.7);
      case 'ford':
        // Wading the ford: a splash, and the water running off.
        burst(ctx, dest, t, 0.12, 'bandpass', 2100, 0.34 * loud, 0.45);
        return burst(ctx, dest, t + 0.04, 0.2, 'bandpass', 4200, 0.1 * loud, 1, 0.8);
      case 'forest':
        // A soft fall, with a leaf or twig underfoot.
        burst(ctx, dest, t, 0.06, 'lowpass', 400, 0.8 * loud, 0.5);
        return burst(ctx, dest, t + 0.01, 0.03, 'bandpass', 2600, 0.12 * loud, 1, 1.2);
      case 'grass':
        return burst(ctx, dest, t, 0.07, 'lowpass', 320, 1.1 * loud, 0.5);
    }
  };
/** A hoofbeat is two quick clops, the fore and the hind foot; a footstep one softer fall. */
const hoofbeat =
  (ground: Ground): Play =>
  (ctx, dest, t) => {
    footfall(ground, 1)(ctx, dest, t);
    footfall(ground, 1)(ctx, dest, t + 0.09);
  };

/**
 * A card opening, like a letter unfolded: the parchment crackles and creaks as it opens, and lies
 * flat with a soft slap as the card's 170 ms unfold ends.
 */
const unfold: Play = (ctx, dest, t) => {
  crackle(ctx, dest, t, 0.2, 0.35, 900, 0.55, 'bandpass', 3200, 0.7);
  crackle(ctx, dest, t, 0.18, 0.3, 260, 0.45, 'bandpass', 1100, 1);
  swish(ctx, dest, t, 0.16, 600, 1500, 0.1, 0.7);
  burst(ctx, dest, t + 0.16, 0.05, 'lowpass', 300, 0.4);
};
/** A card put away: a quicker crackle as it's folded, and a pat as it's laid down. */
const fold: Play = (ctx, dest, t) => {
  crackle(ctx, dest, t, 0.13, 0.5, 1100, 0.45, 'bandpass', 2900, 0.7);
  swish(ctx, dest, t, 0.1, 1500, 600, 0.08, 0.7);
  burst(ctx, dest, t + 0.1, 0.04, 'lowpass', 360, 0.28);
};

const brass = (ctx: BaseAudioContext, dest: AudioNode, t: number, calls: readonly (readonly [midi: number, at: number, length: number])[], volume: number) => {
  for (const [midi, at, length] of calls) playNote(ctx, dest, 'brass', t + at, midi, length, volume);
};

const effect = (loud: Loudness, play: Play, level = 1, duck?: number): EffectDef => ({ loud, level, play, ...(duck ? { duck } : {}) });

/** The vowels a babble is made of (their formants, in Hz): ah, eh, ee, oh, oo. */
const VOWELS = [
  [730, 1090, 2440],
  [530, 1840, 2480],
  [300, 2200, 2900],
  [570, 840, 2410],
  [320, 900, 2300],
] as const;

/**
 * Words said aloud, the way a storybook game's people talk: a babble of `syllables` on the vowels
 * above, around `pitch` (Hz), the last one falling as a sentence does. A pompous baron rumbles; a
 * witch cackles high.
 */
export const babble =
  (pitch: number, syllables: number): Play =>
  (ctx, dest, t) => {
    let at = t;
    for (let i = 0; i < syllables; i++) {
      const length = rand(0.07, 0.13);
      const f = pitch * rand(0.85, 1.3) * (i === syllables - 1 ? 0.8 : 1);
      voice(ctx, dest, at, { pitch: [[0, f], [1, f * rand(0.8, 1.1)]], length, vowel: VOWELS[Math.floor(Math.random() * VOWELS.length)], breath: 0.25, volume: 1 });
      at += length + 0.03 + (Math.random() < 0.2 ? 0.08 : 0);
    }
  };

/** The effects of the map, the cards and the hero screen. */
const EVERYDAY = {
  click: effect('soft', (ctx, dest, t) => tone(ctx, dest, t, 520, 0.05, 0.12, 'square', 0.7), 3.8),
  // A page of the hero's book turning.
  page: effect('soft', (ctx, dest, t) => burst(ctx, dest, t, 0.16, 'bandpass', 2600, 0.35, 0.45), 3),
  lift: effect('soft', (ctx, dest, t) => burst(ctx, dest, t, 0.05, 'bandpass', 1400, 0.3, 1.6), 7.5),
  // Buckles and a little ring of metal.
  equip: effect('soft', (ctx, dest, t) => {
    burst(ctx, dest, t, 0.04, 'highpass', 3000, 0.25);
    tone(ctx, dest, t + 0.02, 1760, 0.1, 0.22, 'triangle');
    tone(ctx, dest, t + 0.06, 2637, 0.18, 0.14);
  }, 1.1),
  unfold: effect('soft', unfold, 0.8),
  // A rubber stamp slammed down on the poster: a thump, a rap of wood, and the coins it stands for.
  stamp: effect('firm', (ctx, dest, t) => {
    burst(ctx, dest, t, 0.16, 'lowpass', 420, 1, 0.5);
    tone(ctx, dest, t, 82, 0.18, 0.8, 'sine', 0.6);
    burst(ctx, dest, t + 0.005, 0.04, 'bandpass', 1800, 0.45);
    [1760, 2349].forEach((f, i) => tone(ctx, dest, t + 0.14 + i * 0.07, f, 0.3, 0.16));
  }, 1.7),
  // Someone speaking, at a middling pitch: a villain's last words use his own (`speak` in ui/sound.ts).
  speech: effect('firm', babble(150, 8), 1.3),
  fold: effect('soft', fold, 0.9),
  coins: effect('firm', (ctx, dest, t) => [1320, 1760, 1480, 1980].forEach((f, i) => tone(ctx, dest, t + i * 0.055, f, 0.12, 0.35)), 1.3),
  day: effect('firm', (ctx, dest, t) => {
    tone(ctx, dest, t, 392, 1.1, 0.4);
    tone(ctx, dest, t, 784, 0.8, 0.15);
  }),
  dig: effect('firm', (ctx, dest, t) => {
    for (const d of [0, 0.25, 0.5]) burst(ctx, dest, t + d, 0.1, 'lowpass', 500, 0.8);
    tone(ctx, dest, t + 0.8, 1568, 0.9, 0.35);
  }, 0.76),
  // Boots going off down the road.
  march: effect('soft', (ctx, dest, t) => [0, 0.14, 0.28, 0.42].forEach((d, i) => burst(ctx, dest, t + d, 0.06, 'lowpass', 600, 0.55 - i * 0.12)), 6),
  // Three quick calls up the chord of G, then the whole chord held, on the drum.
  fanfare: effect('loud', (ctx, dest, t) => {
    brass(ctx, dest, t, [[55, 0, 0.15], [59, 0.16, 0.15], [62, 0.32, 0.15], [67, 0.5, 1.2], [62, 0.5, 1.2], [59, 0.5, 1.2]], 0.3);
    playNote(ctx, dest, 'tabor', t + 0.5, 43, 0.3, 0.7);
  }, 1, 1.5),
  // A hunting horn: two quick calls and a long one, and hooves.
  charge: effect('loud', (ctx, dest, t) => {
    brass(ctx, dest, t, [[67, 0, 0.1], [67, 0.12, 0.1], [74, 0.24, 0.45]], 0.34);
    for (const d of [0, 0.09, 0.18, 0.27]) burst(ctx, dest, t + d, 0.06, 'lowpass', 700, 0.5);
  }, 1.5),
  // A raspberry on the brass: two notes sliding down, and a sour one to finish.
  jeer: effect('firm', (ctx, dest, t) => brass(ctx, dest, t, [[62, 0, 0.14], [58, 0.16, 0.14], [53, 0.32, 0.5]], 0.3), 1.1),
  // A marching song on the lute: up the chord of G and a stamp on the drum.
  song: effect('firm', (ctx, dest, t) => {
    [55, 59, 62, 67, 62, 67].forEach((midi, i) => playNote(ctx, dest, 'lute', t + i * 0.13, midi, 0.3, 0.45));
    playNote(ctx, dest, 'tabor', t + 0.52, 43, 0.3, 0.5);
  }, 0.22, 1),
  // A lucky song: a lilting run on the lute, and a bell at the end.
  luckySong: effect('firm', (ctx, dest, t) => {
    [64, 67, 69, 72, 69, 76].forEach((midi, i) => playNote(ctx, dest, 'lute', t + i * 0.11, midi, 0.28, 0.42));
    playNote(ctx, dest, 'bell', t + 0.7, 84, 0.8, 0.18);
  }, 0.26, 1),
  // Spirits sinking: a low drone that sags.
  falter: effect('firm', (ctx, dest, t) => tone(ctx, dest, t, 196, 0.5, 0.35, 'triangle', 0.7), 2.1),
  // A short call rising on the brass: good spirits, and a stack goes again.
  cheer: effect('firm', (ctx, dest, t) => brass(ctx, dest, t, [[62, 0, 0.09], [67, 0.1, 0.3]], 0.28), 1.1),
  spell: effect('firm', (ctx, dest, t) => [660, 880, 1100, 1320].forEach((f, i) => tone(ctx, dest, t + i * 0.06, f, 0.25, 0.3)), 1.2),
  bolt: effect('firm', (ctx, dest, t) => {
    burst(ctx, dest, t, 0.35, 'highpass', 1800, 0.8, 0.5);
    tone(ctx, dest, t, 880, 0.3, 0.25, 'sawtooth', 0.25);
  }, 0.78),
  // Footfalls under hoofbeats, and softer on grass and leaves than on a road or a bridge's boards.
  'foot:road': effect('faint', footfall('road', 0.65), 2),
  'foot:bridge': effect('faint', footfall('bridge', 0.65), 1.1),
  'foot:ford': effect('faint', footfall('ford', 0.65)),
  'foot:forest': effect('faint', footfall('forest', 0.65), 2.6),
  'foot:grass': effect('faint', footfall('grass', 0.65), 2.5),
  'hoof:road': effect('faint', hoofbeat('road'), 1.2),
  'hoof:bridge': effect('faint', hoofbeat('bridge'), 0.8),
  'hoof:ford': effect('faint', hoofbeat('ford'), 0.75),
  'hoof:forest': effect('faint', hoofbeat('forest'), 1.4),
  'hoof:grass': effect('faint', hoofbeat('grass'), 1.1),
} satisfies Record<string, EffectDef>;

export const EFFECTS = { ...EVERYDAY, ...BATTLE_EFFECTS };
export type EffectId = keyof typeof EFFECTS;
