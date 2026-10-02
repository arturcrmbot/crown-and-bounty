/**
 * The sounds of a fight, by kind of troop (#257: recorded, by people). The blow each strikes is its
 * own Battle for Wesnoth unit's weapon (a pitchfork's jab, a sword's cut, a wolf's bite, a troll's
 * club), landing on flesh or, on a troop in steel, on armour (Will Leamon's hits); the shot each
 * looses and the sound of it landing; the cry each gives when it's hurt and when it falls, and the
 * body falling after it; its feet as it crosses the field; and the weight under a blow, as heavy as
 * what it did. Which troop makes which is `TROOP_SOUNDS`; the recordings and how they're cut are
 * `scripts/sfx.py`, and each is credited in `public/assets/CREDITS.md`.
 */
import type { TroopId } from '../content/troops';
import type { EffectDef, Loudness } from './effects';
import { playSample } from './samples';

export type BlowKind = 'fork' | 'blade' | 'lance' | 'bite' | 'club' | 'mace' | 'fist' | 'spear' | 'tusk' | 'dagger' | 'staff';
export type ShotKind = 'arrow' | 'quarrel' | 'hex' | 'magic';
export type CryKind = 'man' | 'woman' | 'wolf' | 'goblin' | 'spider' | 'troll' | 'bear' | 'boar';
export type FeetKind = 'boots' | 'hooves' | 'paws' | 'stomp' | 'trotters' | 'patter';
/** What a blow or a shot lands as: a cut, a crushing blow, a point going in, or a punch. */
export type HitKind = 'sword' | 'hammer' | 'pierce' | 'punch';

/** What a troop sounds like in a fight: its blow, its cry and its feet, and whether it wears steel, which blows land on. Its shot is its missile (see `render/units.ts`). */
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
  // A bear bites like a wolf, roars as Wesnoth's bear does, and pads about on big soft paws.
  bears: { blow: 'bite', cry: 'bear', feet: 'paws' },
  huntsmen: { blow: 'dagger', cry: 'man', feet: 'boots' },
  rook: { blow: 'dagger', cry: 'man', feet: 'boots' },
  pikemen: { blow: 'spear', cry: 'man', feet: 'boots', armour: true },
  // Men-at-arms carry maces, as Wesnoth's Heavy Infantrymen do.
  menAtArms: { blow: 'mace', cry: 'man', feet: 'boots', armour: true },
  cutpurses: { blow: 'dagger', cry: 'man', feet: 'boots' },
  // A giant spider bites, hisses as Wesnoth's does, and patters about on all eight feet.
  spiders: { blow: 'bite', cry: 'spider', feet: 'patter' },
  // The enemy's heroes (#239) strike no blows from behind their line, but sound like what they carry.
  sergeant: { blow: 'blade', cry: 'man', feet: 'boots', armour: true },
  pike: { blow: 'spear', cry: 'man', feet: 'boots', armour: true },
  foreman: { blow: 'club', cry: 'man', feet: 'boots' },
  picketCaptain: { blow: 'mace', cry: 'man', feet: 'boots', armour: true },
  cutpurseCaptain: { blow: 'dagger', cry: 'man', feet: 'boots' },
  highwaymanCaptain: { blow: 'club', cry: 'man', feet: 'boots' },
  poacherCaptain: { blow: 'dagger', cry: 'man', feet: 'boots' },
  heroKnight: { blow: 'lance', cry: 'man', feet: 'hooves', armour: true },
  heroWizard: { blow: 'staff', cry: 'man', feet: 'boots' },
  heroRanger: { blow: 'blade', cry: 'man', feet: 'boots' },
  heroCourtier: { blow: 'blade', cry: 'man', feet: 'boots' },
};

/** A blow's swing leads in: this long after it starts, it lands, and the hit, the weight and the cry come with it. */
export const CONTACT = 0.05;

/** What each blow lands as. */
export const BLOW_HITS: Record<BlowKind, HitKind> = {
  fork: 'pierce',
  blade: 'sword',
  lance: 'punch',
  bite: 'pierce',
  club: 'hammer',
  mace: 'hammer',
  fist: 'punch',
  spear: 'pierce',
  tusk: 'pierce',
  dagger: 'sword',
  staff: 'hammer',
};

/** What each shot lands as, if anything: a spell's bolt lands as itself. */
export const SHOT_HITS: Record<ShotKind, HitKind | null> = { arrow: 'pierce', quarrel: 'pierce', hex: null, magic: null };

type BattleEffectId =
  | `blow:${BlowKind}`
  | `loose:${ShotKind}`
  | `land:${ShotKind}`
  | `hurt:${CryKind}`
  | `dies:${CryKind}`
  | `feet:${FeetKind}`
  | `thump:${'light' | 'heavy' | 'huge'}`
  | `hit:${HitKind}`
  | `hit:${Exclude<HitKind, 'punch'>}:armour`
  | 'spell'
  | 'bolt'
  | 'whoosh'
  | 'boom'
  | 'luck'
  | 'ready';

/** The hit a blow or a shot lands with, on flesh or on steel: a punch on steel rings as a crushing blow does. */
export const hitOn = (hit: HitKind, armour: boolean | undefined): BattleEffectId => (armour ? `hit:${hit === 'punch' ? 'hammer' : hit}:armour` : `hit:${hit}`);

/**
 * Each recorded effect's mark in the mix, the level that brings it there (see
 * `npm run listen -- effects`), and how far its pitch wanders from one time to the next (semitones).
 * A blow, a shot landing and a death cry stand over the music (`hit`); the release of a shot, a hit on
 * flesh or steel and a wince sit level with it; feet are faint.
 */
const RECORDED: Record<BattleEffectId, [loud: Loudness, level: number, spread: number]> = {
  'blow:fork': ['hit', 1.5, 0.8],
  'blow:blade': ['hit', 1.6, 0.8],
  'blow:lance': ['hit', 1.7, 0.6],
  'blow:bite': ['hit', 1.5, 0.8],
  'blow:club': ['hit', 1.4, 0.8],
  'blow:mace': ['hit', 1.7, 0.8],
  'blow:fist': ['hit', 1.4, 0.6],
  'blow:spear': ['hit', 1.7, 0.8],
  'blow:tusk': ['hit', 1.4, 0.8],
  'blow:dagger': ['hit', 1.7, 0.8],
  'blow:staff': ['hit', 1.6, 0.8],
  'hit:sword': ['firm', 1.3, 1],
  'hit:sword:armour': ['firm', 1.4, 1],
  'hit:hammer': ['firm', 1.2, 1],
  'hit:hammer:armour': ['firm', 1.4, 1],
  'hit:pierce': ['firm', 1.1, 1],
  'hit:pierce:armour': ['firm', 1.3, 1],
  'hit:punch': ['firm', 1.3, 1],
  'thump:light': ['faint', 0.18, 1],
  'thump:heavy': ['soft', 0.54, 1],
  'thump:huge': ['firm', 0.92, 0.6],
  'loose:arrow': ['firm', 1.2, 0.8],
  'loose:quarrel': ['firm', 1.2, 0.6],
  'loose:hex': ['firm', 0.91, 0.6],
  'loose:magic': ['firm', 0.98, 0.6],
  'land:arrow': ['hit', 1.7, 1],
  'land:quarrel': ['hit', 1.9, 0.8],
  'land:hex': ['hit', 1.5, 0.6],
  'land:magic': ['hit', 2.1, 0.8],
  'hurt:man': ['firm', 0.99, 1],
  'hurt:woman': ['firm', 1.1, 1],
  'hurt:wolf': ['firm', 0.92, 1],
  'hurt:goblin': ['firm', 1.1, 1],
  'hurt:spider': ['firm', 0.89, 1],
  'hurt:troll': ['firm', 0.97, 1],
  'hurt:bear': ['firm', 0.88, 1],
  'hurt:boar': ['firm', 0.94, 1],
  'dies:man': ['hit', 1.5, 0.8],
  'dies:woman': ['hit', 1.6, 0.8],
  'dies:wolf': ['hit', 1.5, 0.8],
  'dies:goblin': ['hit', 1.5, 0.8],
  'dies:spider': ['hit', 1.5, 0.8],
  'dies:troll': ['hit', 1.4, 0.6],
  'dies:bear': ['hit', 1.4, 0.6],
  'dies:boar': ['hit', 1.4, 0.8],
  'feet:boots': ['faint', 0.16, 1.5],
  'feet:hooves': ['faint', 0.14, 1],
  'feet:paws': ['faint', 0.16, 1.5],
  'feet:stomp': ['faint', 0.12, 1],
  'feet:trotters': ['faint', 0.16, 1.5],
  'feet:patter': ['faint', 0.17, 1.5],
  spell: ['firm', 0.9, 0.5],
  bolt: ['loud', 1.6, 0.3],
  whoosh: ['soft', 0.47, 0.5],
  boom: ['loud', 1.6, 0.3],
  luck: ['firm', 0.88, 0.3],
  ready: ['faint', 0.16, 1],
};

/** Every sound of a fight, as effects: `blow:blade`, `hit:sword:armour`, `loose:arrow`, `land:arrow`, `hurt:wolf`, `dies:troll`, `feet:hooves`, `thump:heavy`, and the spells'. */
export const BATTLE_EFFECTS = Object.fromEntries(
  Object.entries(RECORDED).map(([id, [loud, level, spread]]) => [id, { loud, level, play: (ctx, dest, at) => playSample(ctx, dest, at, id, spread) } satisfies EffectDef]),
) as Record<BattleEffectId, EffectDef>;

/** The recorded effects of a fight, by id: what `scripts/sfx.py` must pack. */
export const RECORDED_EFFECTS = Object.keys(RECORDED) as BattleEffectId[];
