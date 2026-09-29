/**
 * The sounds of a fight, by kind of troop: the blow each strikes (a pitchfork's knock, a sword's
 * swish and cut, a wolf's snarl and snap, a troll's fist like a falling tree), the shot each looses
 * and the sound of it landing, the cry each gives when it's hurt and when it falls, and its feet as
 * it crosses the field. A blow on plate or mail rings. Which troop makes which is `TROOP_SOUNDS`.
 */
import type { TroopId } from '../content/troops';
import type { EffectDef, Loudness } from './effects';
import { burst, crackle, rand, ring, STEEL, swish, tone, voice, WOOD } from './synth';

export type BlowKind = 'fork' | 'blade' | 'lance' | 'bite' | 'club' | 'fist' | 'spear' | 'tusk' | 'dagger' | 'staff';
export type ShotKind = 'arrow' | 'quarrel' | 'hex' | 'magic';
export type CryKind = 'man' | 'woman' | 'wolf' | 'goblin' | 'troll' | 'boar';
export type FeetKind = 'boots' | 'hooves' | 'paws' | 'stomp' | 'trotters' | 'patter';

/** What a troop sounds like in a fight: its blow, its cry and its feet, and whether blows ring on its armour. Its shot is its missile (see `render/units.ts`). */
export type TroopSounds = { blow: BlowKind; cry: CryKind; feet: FeetKind; armour?: boolean };

export const TROOP_SOUNDS: Record<TroopId, TroopSounds> = {
  peasants: { blow: 'fork', cry: 'man', feet: 'boots' },
  archers: { blow: 'blade', cry: 'man', feet: 'boots' },
  knights: { blow: 'blade', cry: 'man', feet: 'hooves', armour: true },
  swordsmen: { blow: 'blade', cry: 'man', feet: 'boots', armour: true },
  crossbowmen: { blow: 'blade', cry: 'man', feet: 'boots', armour: true },
  wolves: { blow: 'bite', cry: 'wolf', feet: 'paws' },
  baron: { blow: 'blade', cry: 'man', feet: 'boots', armour: true },
  goblins: { blow: 'spear', cry: 'goblin', feet: 'patter' },
  trolls: { blow: 'fist', cry: 'troll', feet: 'stomp' },
  witch: { blow: 'staff', cry: 'woman', feet: 'boots' },
  bramble: { blow: 'staff', cry: 'woman', feet: 'boots' },
  poachers: { blow: 'dagger', cry: 'man', feet: 'boots' },
  bandits: { blow: 'club', cry: 'man', feet: 'boots' },
  boars: { blow: 'tusk', cry: 'boar', feet: 'trotters' },
  heroKnight: { blow: 'lance', cry: 'man', feet: 'hooves', armour: true },
  heroWizard: { blow: 'staff', cry: 'man', feet: 'boots' },
  heroRanger: { blow: 'blade', cry: 'man', feet: 'boots' },
  heroCourtier: { blow: 'blade', cry: 'man', feet: 'boots' },
};

/** A blow's swing leads in: this long after it starts, it lands, and the armour rings and the cry comes after that. */
export const CONTACT = 0.05;

type Play = EffectDef['play'];

/** Each blow: the swing through the air, then what it sounds like as it lands `CONTACT` later. */
const BLOWS: Record<BlowKind, Play> = {
  // A pitchfork: a short jab, the knock of its shaft, and its tines rattling.
  fork: (ctx, dest, at) => {
    swish(ctx, dest, at, 0.06, 1500, 700, 0.25);
    const t = at + CONTACT;
    ring(ctx, dest, t, rand(290, 350), WOOD, 0.25);
    burst(ctx, dest, t, 0.07, 'lowpass', 700, 0.45, 1, 1, 0.004);
    for (const d of [0, 0.013, 0.027]) burst(ctx, dest, t + d, 0.012, 'bandpass', 3000, 0.35, 1, 2);
  },
  // A sword: a swish, the edge biting, and the weight of the cut behind it.
  blade: (ctx, dest, at) => {
    swish(ctx, dest, at, 0.07, 2800, 1000, 0.35, 1.5);
    const t = at + CONTACT;
    burst(ctx, dest, t, 0.035, 'bandpass', 2500, 0.6, 0.7, 1);
    burst(ctx, dest, t, 0.09, 'lowpass', 900, 0.7);
    tone(ctx, dest, t, 170, 0.1, 0.45, 'sine', 0.45, 0.003);
  },
  // A lance at the gallop: the crash of horse and man, and the shaft splintering.
  lance: (ctx, dest, at) => {
    swish(ctx, dest, at, 0.07, 900, 400, 0.3);
    const t = at + CONTACT;
    tone(ctx, dest, t, 120, 0.25, 0.9, 'sine', 0.4, 0.003);
    burst(ctx, dest, t, 0.2, 'lowpass', 600, 0.9, 0.5);
    crackle(ctx, dest, t, 0.13, 0.15, 700, 0.5, 'bandpass', 2200);
    ring(ctx, dest, t, rand(170, 200), WOOD, 0.4);
  },
  // A wolf: a snarl, and the jaws snapping shut.
  bite: (ctx, dest, at) => {
    voice(ctx, dest, at, { pitch: [[0, 95], [1, 80]], length: CONTACT + 0.04, vowel: [500, 1400, 2600], growl: [28, 0.8], breath: 0.6, volume: 0.8 });
    const t = at + CONTACT;
    burst(ctx, dest, t, 0.015, 'bandpass', 3000, 0.7, 1, 1.5);
    ring(ctx, dest, t, rand(1600, 1800), [[1, 1, 0.025], [2.3, 0.5, 0.015]], 0.3);
    burst(ctx, dest, t, 0.06, 'lowpass', 600, 0.6);
  },
  // A cudgel: a heavy swing, and a dull thud with the knock of the wood in it.
  club: (ctx, dest, at) => {
    swish(ctx, dest, at, 0.08, 1300, 500, 0.3);
    const t = at + CONTACT;
    tone(ctx, dest, t, 130, 0.14, 0.8, 'sine', 0.45, 0.003);
    burst(ctx, dest, t, 0.1, 'lowpass', 450, 0.9);
    ring(ctx, dest, t, rand(210, 260), WOOD, 0.35);
  },
  // A troll's fist: a great arm swinging, a boom like a falling tree, a crunch, and the ground shaking.
  fist: (ctx, dest, at) => {
    swish(ctx, dest, at, 0.09, 700, 250, 0.35);
    const t = at + CONTACT;
    tone(ctx, dest, t, 85, 0.32, 1, 'sine', 0.4, 0.003);
    burst(ctx, dest, t, 0.28, 'lowpass', 260, 1, 0.6);
    crackle(ctx, dest, t, 0.1, 0.1, 700, 0.35, 'bandpass', 1400);
    burst(ctx, dest, t + 0.02, 0.4, 'lowpass', 120, 0.5);
  },
  // A goblin's spear: a quick jab, a thin point going in.
  spear: (ctx, dest, at) => {
    swish(ctx, dest, at, 0.05, 3000, 1600, 0.6);
    const t = at + CONTACT;
    burst(ctx, dest, t, 0.05, 'lowpass', 900, 1.4);
    ring(ctx, dest, t, rand(1100, 1300), [[1, 1, 0.02], [2.6, 0.4, 0.012]], 0.5);
  },
  // A boar: a grunt, and its tusks going in low.
  tusk: (ctx, dest, at) => {
    voice(ctx, dest, at, { pitch: [[0, 110], [1, 85]], length: CONTACT + 0.05, vowel: [400, 1000, 2400], growl: [45, 0.9], breath: 0.4, volume: 0.9 });
    const t = at + CONTACT;
    tone(ctx, dest, t, 150, 0.12, 0.7, 'sine', 0.45, 0.003);
    burst(ctx, dest, t, 0.1, 'lowpass', 550, 0.8);
  },
  // A knife: a quick, high swish and a cut.
  dagger: (ctx, dest, at) => {
    swish(ctx, dest, at, 0.05, 4000, 2000, 0.7, 1.8);
    const t = at + CONTACT;
    burst(ctx, dest, t, 0.035, 'bandpass', 3500, 1.2, 0.7, 1.2);
    burst(ctx, dest, t, 0.06, 'lowpass', 900, 1.1);
  },
  // A staff: a swing, and the crack of hard wood.
  staff: (ctx, dest, at) => {
    swish(ctx, dest, at, 0.07, 1800, 800, 0.3);
    const t = at + CONTACT;
    ring(ctx, dest, t, rand(470, 540), WOOD, 0.3);
    burst(ctx, dest, t, 0.02, 'bandpass', 1800, 0.5, 1, 1.2);
    burst(ctx, dest, t, 0.06, 'lowpass', 800, 0.35, 1, 1, 0.004);
  },
};

/** Each shot leaving: a bowstring, a crossbow's latch, a hex, a mage's bolt. */
const LOOSE: Record<ShotKind, Play> = {
  // The string's twang and thrum, and the arrow hissing away.
  arrow: (ctx, dest, at) => {
    burst(ctx, dest, at, 0.006, 'bandpass', 2500, 0.5, 1, 1);
    tone(ctx, dest, at, rand(170, 190), 0.09, 0.4, 'triangle', 0.8, 0.002);
    tone(ctx, dest, at, 360, 0.05, 0.12, 'sawtooth', 0.8, 0.002);
    burst(ctx, dest, at, 0.25, 'bandpass', 2600, 0.25, 0.5, 2, 0.02);
  },
  // The latch's clack, a heavy string, and the bolt away, faster than an arrow.
  quarrel: (ctx, dest, at) => {
    burst(ctx, dest, at, 0.01, 'bandpass', 2600, 0.9, 1, 3);
    ring(ctx, dest, at, 1900, [[1, 1, 0.03], [2.1, 0.5, 0.02]], 0.25);
    tone(ctx, dest, at, 120, 0.08, 0.5, 'triangle', 0.7, 0.002);
    burst(ctx, dest, at + 0.01, 0.16, 'bandpass', 3000, 0.25, 0.5, 2, 0.01);
  },
  // A hex: a warbling whine that sinks, and a hiss like a pot boiling over.
  hex: (ctx, dest, at) => {
    voice(ctx, dest, at, { pitch: [[0, 420], [1, 180]], length: 0.35, vowel: [], quaver: [11, 0.06], breath: 0.5, volume: 1, wave: 'triangle', attack: 0.05 });
    burst(ctx, dest, at, 0.35, 'bandpass', 1200, 0.2, 2, 3, 0.1);
  },
  // A mage's bolt: a crackle of lightning, falling, over a bright shimmer.
  magic: (ctx, dest, at) => {
    tone(ctx, dest, at, 1400, 0.2, 0.25, 'sawtooth', 0.25, 0.003);
    crackle(ctx, dest, at, 0.2, 0.2, 1500, 0.4, 'bandpass', 3500, 0.7);
    tone(ctx, dest, at, 2100, 0.25, 0.08, 'sine', 1.5);
  },
};

/** Each shot landing: an arrow's thock, a bolt's thunk, a hex bubbling, a bolt bursting. */
const LAND: Record<ShotKind, Play> = {
  arrow: (ctx, dest, at) => {
    burst(ctx, dest, at, 0.03, 'bandpass', 1800, 1.4, 1, 1.5, 0.003);
    ring(ctx, dest, at, rand(560, 640), [[1, 1, 0.05], [2.4, 0.4, 0.03]], 0.4);
    burst(ctx, dest, at, 0.06, 'lowpass', 500, 0.7, 1, 1, 0.004);
  },
  quarrel: (ctx, dest, at) => {
    burst(ctx, dest, at, 0.04, 'bandpass', 1400, 0.7, 1, 1.2);
    tone(ctx, dest, at, 160, 0.09, 0.7, 'sine', 0.5, 0.003);
    burst(ctx, dest, at, 0.08, 'lowpass', 600, 0.6);
  },
  hex: (ctx, dest, at) => {
    for (let i = 0; i < 4; i++) tone(ctx, dest, at + i * 0.03, rand(300, 600), 0.06, 0.25, 'sine', 1.8, 0.004);
    tone(ctx, dest, at, 130, 0.2, 0.5, 'sine', 0.5);
    burst(ctx, dest, at, 0.15, 'bandpass', 900, 0.3, 0.5, 2);
  },
  magic: (ctx, dest, at) => {
    ring(ctx, dest, at, rand(1500, 1700), [[1, 1, 0.3], [1.5, 0.6, 0.25], [2.01, 0.5, 0.2], [3.02, 0.3, 0.12]], 0.2);
    burst(ctx, dest, at, 0.08, 'bandpass', 3000, 0.6, 0.5, 1.5);
    tone(ctx, dest, at, 200, 0.12, 0.4, 'sine', 0.5);
  },
};

/** A body going down: a thud, heavier for a bigger one. */
const thud = (ctx: BaseAudioContext, dest: AudioNode, at: number, weight: number) => {
  burst(ctx, dest, at, 0.12 + weight * 0.1, 'lowpass', 320 - weight * 150, 0.5 + weight * 0.3);
  if (weight > 0.5) tone(ctx, dest, at, 60, 0.25, 0.6 * weight, 'sine', 0.7, 0.004);
};

/** Each kind's cries: a grunt or a yelp when a blow hurts it, and a longer cry as it falls. */
const CRIES: Record<CryKind, { hurt: Play; dies: Play }> = {
  man: {
    hurt: (ctx, dest, at) => {
      const f = rand(105, 150);
      voice(ctx, dest, at, { pitch: [[0, f * 1.08], [0.3, f], [1, f * 0.8]], length: 0.16, vowel: [640, 1190, 2390], breath: 0.25, volume: 1 });
    },
    dies: (ctx, dest, at) => {
      const f = rand(120, 160);
      voice(ctx, dest, at, { pitch: [[0, f], [0.2, f * 1.3], [1, f * 0.7]], length: 0.55, vowel: [730, 1090, 2440], to: [570, 840, 2410], growl: [55, 0.3], breath: 0.35, volume: 1 });
      thud(ctx, dest, at + 0.4, 0.3);
    },
  },
  woman: {
    hurt: (ctx, dest, at) => {
      const f = rand(220, 260);
      voice(ctx, dest, at, { pitch: [[0, f * 1.1], [0.3, f], [1, f * 0.85]], length: 0.16, vowel: [800, 1400, 2800], breath: 0.3, volume: 0.9 });
    },
    dies: (ctx, dest, at) => {
      const f = rand(240, 280);
      voice(ctx, dest, at, { pitch: [[0, f], [0.2, f * 1.35], [1, f * 0.65]], length: 0.6, vowel: [850, 1350, 2900], to: [600, 950, 2700], breath: 0.35, volume: 0.9 });
      thud(ctx, dest, at + 0.45, 0.25);
    },
  },
  // A yelp, and a whimper falling away.
  wolf: {
    hurt: (ctx, dest, at) => voice(ctx, dest, at, { pitch: [[0, 700], [0.2, 1150], [1, 600]], length: 0.16, vowel: [], breath: 0.2, volume: 1 }),
    dies: (ctx, dest, at) => {
      voice(ctx, dest, at, { pitch: [[0, 900], [0.15, 1200], [0.6, 700], [1, 420]], length: 0.7, vowel: [], quaver: [7, 0.03], breath: 0.15, volume: 0.8 });
      thud(ctx, dest, at + 0.5, 0.2);
    },
  },
  // A squeak, and a gibbering screech.
  goblin: {
    hurt: (ctx, dest, at) => voice(ctx, dest, at, { pitch: [[0, 380], [0.3, 520], [1, 300]], length: 0.13, vowel: [300, 2200, 3000], breath: 0.2, volume: 1 }),
    dies: (ctx, dest, at) => {
      voice(ctx, dest, at, { pitch: [[0, 450], [0.25, 700], [1, 220]], length: 0.42, vowel: [350, 2000, 2900], to: [700, 1200, 2600], quaver: [13, 0.05], volume: 1 });
      thud(ctx, dest, at + 0.35, 0.1);
    },
  },
  // A rumbling roar, and a long groan as it topples like a tree.
  troll: {
    hurt: (ctx, dest, at) => voice(ctx, dest, at, { pitch: [[0, 75], [0.3, 85], [1, 55]], length: 0.35, vowel: [450, 800, 2300], growl: [24, 0.7], breath: 0.5, volume: 1.2 }),
    dies: (ctx, dest, at) => {
      voice(ctx, dest, at, { pitch: [[0, 80], [0.2, 90], [1, 42]], length: 1.1, vowel: [500, 850, 2300], to: [320, 700, 2200], growl: [18, 0.6], breath: 0.5, volume: 1.2 });
      thud(ctx, dest, at + 0.75, 1);
    },
  },
  // A squeal, and a long one falling to a grunt.
  boar: {
    hurt: (ctx, dest, at) => voice(ctx, dest, at, { pitch: [[0, 650], [0.3, 950], [1, 700]], length: 0.22, vowel: [1000, 2000, 3200], quaver: [28, 0.06], breath: 0.3, volume: 0.9 }),
    dies: (ctx, dest, at) => {
      voice(ctx, dest, at, { pitch: [[0, 800], [0.2, 1000], [1, 380]], length: 0.6, vowel: [900, 1900, 3000], quaver: [22, 0.07], breath: 0.3, volume: 0.9 });
      thud(ctx, dest, at + 0.5, 0.5);
    },
  },
};

/** Each kind's footfall as it crosses a hex of the field. */
const FEET: Record<FeetKind, Play> = {
  boots: (ctx, dest, at) => {
    burst(ctx, dest, at, 0.05, 'lowpass', 350, 0.5);
    burst(ctx, dest, at + 0.005, 0.015, 'bandpass', 2500, 0.1, 1, 1);
  },
  hooves: (ctx, dest, at) => {
    for (const d of [0, 0.08]) {
      burst(ctx, dest, at + d, 0.035, 'bandpass', 1100, 0.45, 1, 2);
      tone(ctx, dest, at + d, 280, 0.04, 0.25, 'sine', 0.8, 0.002);
    }
  },
  paws: (ctx, dest, at) => {
    burst(ctx, dest, at, 0.03, 'lowpass', 450, 0.3);
    burst(ctx, dest, at + 0.05, 0.03, 'lowpass', 450, 0.25);
  },
  stomp: (ctx, dest, at) => {
    tone(ctx, dest, at, 70, 0.2, 0.8, 'sine', 0.55, 0.004);
    burst(ctx, dest, at, 0.18, 'lowpass', 180, 0.7);
  },
  trotters: (ctx, dest, at) => {
    for (const d of [0, 0.05]) burst(ctx, dest, at + d, 0.025, 'bandpass', 800, 0.35, 1, 2);
  },
  patter: (ctx, dest, at) => {
    for (const d of [0, 0.035, 0.07]) burst(ctx, dest, at + d, 0.02, 'lowpass', 700, 0.25);
  },
};

/** Steel on plate or mail: a clash that rings, played on top of whatever lands on an armoured troop. */
const armour: Play = (ctx, dest, at) => {
  ring(ctx, dest, at, rand(900, 1300), STEEL, 0.18);
  burst(ctx, dest, at, 0.03, 'bandpass', 4500, 0.5, 1, 1.5);
};

type BattleEffectId = `blow:${BlowKind}` | `loose:${ShotKind}` | `land:${ShotKind}` | `hurt:${CryKind}` | `dies:${CryKind}` | `feet:${FeetKind}` | 'armour';

/**
 * The level that brings each to its place in the mix (see `npm run listen -- effects`): blows and
 * shots landing level with the music, a lance or a troll's fist a little heavier and a knife a
 * little lighter, a shot's release under its landing, a cry of pain under the blow, feet faint.
 */
const LEVELS: Record<BattleEffectId, number> = {
  'blow:fork': 3.6,
  'blow:blade': 2.5,
  'blow:lance': 1,
  'blow:bite': 3.4,
  'blow:club': 1.2,
  'blow:fist': 0.95,
  'blow:spear': 2.3,
  'blow:tusk': 1.6,
  'blow:dagger': 2.4,
  'blow:staff': 3,
  'loose:arrow': 3.7,
  'loose:quarrel': 3.1,
  'loose:hex': 1.2,
  'loose:magic': 1.8,
  'land:arrow': 2.7,
  'land:quarrel': 2.5,
  'land:hex': 1.7,
  'land:magic': 1.9,
  'hurt:man': 1,
  'hurt:woman': 0.9,
  'hurt:wolf': 0.8,
  'hurt:goblin': 1.1,
  'hurt:troll': 0.9,
  'hurt:boar': 0.34,
  'dies:man': 1.4,
  'dies:woman': 1.2,
  'dies:wolf': 1.5,
  'dies:goblin': 0.62,
  'dies:troll': 1.4,
  'dies:boar': 0.45,
  'feet:boots': 3.8,
  'feet:hooves': 0.64,
  'feet:paws': 4.3,
  'feet:stomp': 0.34,
  'feet:trotters': 3.3,
  'feet:patter': 3.8,
  armour: 1.5,
};

const entries = (prefix: string, plays: Record<string, Play>, loud: Loudness) =>
  Object.entries(plays).map(([kind, play]) => {
    const id = `${prefix}:${kind}` as BattleEffectId;
    return [id, { loud, level: LEVELS[id], play }] as const;
  });

/** Every sound of a fight, as effects: `blow:blade`, `loose:arrow`, `land:arrow`, `hurt:wolf`, `dies:troll`, `feet:hooves`, `armour`. */
export const BATTLE_EFFECTS = Object.fromEntries([
  ...entries('blow', BLOWS, 'firm'),
  ...entries('loose', LOOSE, 'firm'),
  ...entries('land', LAND, 'firm'),
  ...entries('hurt', Object.fromEntries(Object.entries(CRIES).map(([kind, cry]) => [kind, cry.hurt])), 'soft'),
  ...entries('dies', Object.fromEntries(Object.entries(CRIES).map(([kind, cry]) => [kind, cry.dies])), 'firm'),
  ...entries('feet', FEET, 'faint'),
  ['armour', { loud: 'soft', level: LEVELS.armour, play: armour }],
]) as Record<BattleEffectId, EffectDef>;
