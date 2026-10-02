/**
 * Every sound effect, as data: how it sits in the mix, and how it's made. Each plays into any context
 * (the live one, or one rendered offline to be measured by `npm run listen`) at a given time, and its
 * `level` brings it to its mark there: `faint` (footfalls), `soft` under the music (clicks, pages),
 * `firm` level with it (coins, cries), `hit` over it (a blow landing), `loud` over it (the heralds'
 * fanfare, a Fireball). Since 2 Oct (#257) they are recordings made by people, cut and packed by
 * `scripts/sfx.py`: the sounds of a fight in `blows.ts`, and those of the map, the cards and the hero
 * screen here. What is music plays on the band, and only speech is still made in code.
 */
import { playBand, type BandInstrument } from './band';
import { BATTLE_EFFECTS } from './blows';
import { jingleNotes } from './jingles';
import { playSample } from './samples';
import { rand, voice } from './synth';

export type Loudness = 'faint' | 'soft' | 'firm' | 'hit' | 'loud';
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

/** Notes on the band's own instruments (#257): [instrument, MIDI note, seconds in, seconds long, volume]. A drum's note is its drum. */
type BandNote = readonly [instrument: BandInstrument, key: number, at: number, length: number, volume: number];
const band = (ctx: BaseAudioContext, dest: AudioNode, t: number, notes: readonly BandNote[]) => {
  for (const [instrument, key, at, length, volume] of notes) playBand(ctx, dest, instrument, t + at, key, length, volume);
};
/** A call on one instrument: [MIDI note, seconds in, seconds long] each. */
const call = (instrument: BandInstrument, volume: number, notes: readonly (readonly [key: number, at: number, length: number])[]): BandNote[] =>
  notes.map(([key, at, length]) => [instrument, key, at, length, volume] as const);

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

/**
 * The recorded sounds of the map, the cards and the hero screen (#257), each as one of its takes in
 * the map's pack: its mark in the mix, the level that brings it there (`npm run listen -- effects`),
 * and how far its pitch wanders from one time to the next (semitones). What each is cut from is in
 * `scripts/sfx.py`, and who made it in `public/assets/CREDITS.md`.
 */
const MAP_RECORDED = {
  // A button's click, a card sliding out as it opens and laid down as it's put away.
  click: ['soft', 0.65, 0.5],
  unfold: ['soft', 0.43, 0.5],
  fold: ['soft', 0.4, 0.5],
  // A page of the hero's book turning, cloth as a piece of gear is lifted, a buckle as it's worn.
  page: ['soft', 0.41, 1],
  lift: ['soft', 0.37, 1],
  equip: ['soft', 0.46, 1],
  // Coins in the hand, one coin into the purse on the bar, and PAID stamped on the poster with a heavy knock, then the coins.
  coins: ['firm', 1, 0.5],
  clink: ['soft', 0.47, 1.5],
  stamp: ['firm', 1.4, 0.3],
  // Digging for treasure, and troops joining: a knight's steps in mail going off down the road.
  dig: ['firm', 1.1, 0.3],
  march: ['soft', 0.43, 0.5],
  // Mana: a wand glittering. Movement: a horse breaking into a gallop.
  shimmer: ['firm', 1, 0.5],
  gallop: ['soft', 0.35, 0.5],
  // A chest's lid creaking up on its old hinges.
  creak: ['soft', 0.37, 0.5],
  // A lost goose found (#192), squawking. The mist rolling back from a lookout (#192): a gust of wind.
  honk: ['firm', 0.95, 0.5],
  gust: ['soft', 0.35, 0.5],
  // The hero's feet on the map, or his horse's, on the ground underfoot: a road, a bridge's planks, the ford, the woods and grass.
  'foot:road': ['faint', 0.14, 1.5],
  'foot:bridge': ['faint', 0.17, 1.5],
  'foot:ford': ['faint', 0.12, 1],
  'foot:forest': ['faint', 0.15, 1.5],
  'foot:grass': ['faint', 0.17, 1.5],
  'hoof:road': ['faint', 0.13, 1],
  'hoof:bridge': ['faint', 0.15, 1],
  'hoof:ford': ['faint', 0.12, 1],
  'hoof:forest': ['faint', 0.13, 1],
  'hoof:grass': ['faint', 0.12, 1],
} as const satisfies Record<string, readonly [Loudness, number, number]>;

/** Something picked up by the way (#192): a small bell, rung a step higher up the scale for each one the same day, and its level at each step. */
const PICKS = [
  [-12, 0.38],
  [-10, 0.4],
  [-8, 0.41],
  [-5, 0.44],
  [-3, 0.47],
  [0, 0.5],
] as const;

/** The recordings the map's effects play, which its pack must hold. */
export const MAP_SAMPLES = [...Object.keys(MAP_RECORDED), 'pick'];

const recorded = Object.fromEntries(
  Object.entries(MAP_RECORDED).map(([id, [loud, level, spread]]) => [id, effect(loud, (ctx, dest, t) => playSample(ctx, dest, t, id, spread), level)]),
) as Record<keyof typeof MAP_RECORDED, EffectDef>;
const picks = Object.fromEntries(
  PICKS.map(([semitones, level], i) => [`pick${i}`, effect('soft', (ctx, dest, t) => playSample(ctx, dest, t, 'pick', 0, semitones), level)]),
) as Record<`pick${0 | 1 | 2 | 3 | 4 | 5}`, EffectDef>;

const EVERYDAY = {
  ...recorded,
  ...picks,
  // Someone speaking, at a middling pitch: a villain's last words use his own (`speak` in ui/sound.ts).
  speech: effect('firm', babble(150, 8), 1.3),
  // A new day: the harp runs softly up the chord of G, and a bell rings over it.
  day: effect('firm', (ctx, dest, t) => band(ctx, dest, t, [...call('harp', 0.7, [[55, 0, 1], [59, 0.09, 1], [62, 0.18, 1], [67, 0.27, 1.3]]), ['bells', 79, 0.27, 1.4, 0.3]]), 0.1, 1),
  // Three quick calls up the chord of G on the band's trumpets, then the whole chord held, and the timpani (#257).
  fanfare: effect('loud', (ctx, dest, t) =>
    band(ctx, dest, t, [
      ...call('trumpet', 0.8, [[55, 0, 0.15], [59, 0.16, 0.15], [62, 0.32, 0.15], [67, 0.5, 1.2]]),
      ...call('horn', 0.7, [[62, 0.5, 1.2], [59, 0.5, 1.2]]),
      ['timpani', 43, 0.5, 0.6, 0.9],
    ]), 0.19, 1.5),
  // A hunting horn, two quick calls and a long one, and a horse breaking into a gallop (recorded by StephenSaldanha).
  charge: effect('loud', (ctx, dest, t) => {
    band(ctx, dest, t, call('horn', 0.9, [[67, 0, 0.1], [67, 0.12, 0.1], [74, 0.24, 0.45]]));
    playSample(ctx, dest, t + 0.05, 'charge:gallop', 0.5);
  }, 0.31),
  // A raspberry on the band's trombone: two notes sliding down, and a sour one to finish.
  jeer: effect('firm', (ctx, dest, t) => band(ctx, dest, t, call('trombone', 0.8, [[62, 0, 0.14], [58, 0.16, 0.14], [53, 0.32, 0.5]])), 0.15),
  // A marching song on the band's guitar (for a lute): up the chord of G, and a stamp on the drum.
  song: effect('firm', (ctx, dest, t) =>
    band(ctx, dest, t, [...call('guitar', 0.7, [55, 59, 62, 67, 62, 67].map((key, i) => [key, i * 0.13, 0.3] as const)), ['tom', 0, 0.52, 0.3, 0.7]]), 0.1, 1),
  // A lucky song: a lilting run on the guitar, and a bell at the end.
  luckySong: effect('firm', (ctx, dest, t) =>
    band(ctx, dest, t, [...call('guitar', 0.7, [64, 67, 69, 72, 69, 76].map((key, i) => [key, i * 0.11, 0.28] as const)), ['bells', 72, 0.7, 0.9, 0.4]]), 0.11, 1),
  // Spirits sinking: the horn sags, two notes falling.
  falter: effect('firm', (ctx, dest, t) => band(ctx, dest, t, call('horn', 0.7, [[55, 0, 0.25], [50, 0.25, 0.55]])), 0.24),
  // A short call rising on the horn: good spirits, and a stack goes again.
  cheer: effect('firm', (ctx, dest, t) => band(ctx, dest, t, call('horn', 0.85, [[62, 0, 0.09], [67, 0.1, 0.3]])), 0.18),
  // Gear found: yubatake's Discovery, the harp over the strings.
  find: effect('firm', (ctx, dest, t) => {
    for (const n of jingleNotes('discovery')) playBand(ctx, dest, n.instrument, t + n.at, n.key, n.length, n.volume);
  }, 0.33),
} satisfies Record<string, EffectDef>;

export const EFFECTS = { ...EVERYDAY, ...BATTLE_EFFECTS };
export type EffectId = keyof typeof EFFECTS;
