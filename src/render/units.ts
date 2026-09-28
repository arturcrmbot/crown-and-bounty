import type { TroopId } from '../content/troops';

/** One frame of a Wesnoth animation: an image under `units/`, and how long it shows. */
export type Frame = { image: string; ms: number };
/** An attack: its frames, and how far in (ms) the blow lands, as Wesnoth's `start_time` puts it. */
export type Attack = { frames: Frame[]; hit: number };
export type Missile = 'arrow' | 'quarrel' | 'hex';

/**
 * How one of our troops is drawn: a unit from Battle for Wesnoth 1.18, with the frames its `.cfg`
 * gives each animation. Paths are under Wesnoth's `data/core/images/units/`.
 */
export type UnitArt = {
  /** The Wesnoth unit, and its `.cfg` under `data/core/units/`, for the credits. */
  unit: string;
  cfg: string;
  stand: string;
  /** A fidget now and then while it waits its turn, or on the map. */
  idle?: Frame[];
  /** Looped while it walks or rides from hex to hex. */
  move?: Frame[];
  melee: Attack;
  /** The knights' lance, for a charge. */
  charge?: Attack;
  ranged?: Attack & { missile: Missile };
  /** The frame it flinches to when hit (at close quarters, and by a shot or a spell). */
  defend: string;
  defendRanged?: string;
  /** Its fall, ending on the body that stays on the field. */
  death?: Frame[];
};

/**
 * Wesnoth's frame lists, as its `.cfg` files write them: `'bowman-bow-attack-[1~4,1].png'` with
 * times `'75*2,100,130,65'` (or one time for every frame) under `dir`.
 */
export function frames(dir: string, pattern: string, times: string | number): Frame[] {
  const group = pattern.match(/\[([^\]]+)\]/);
  const items = group
    ? group[1].split(',').flatMap((part) => {
        const range = part.match(/^(\d+)~(\d+)$/);
        if (!range) return [part];
        const [a, b] = [Number(range[1]), Number(range[2])];
        return Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => String(a + i * Math.sign(b - a || 1)));
      })
    : [''];
  const ms = String(times)
    .split(',')
    .flatMap((t) => {
      const [value, count] = t.split('*');
      return Array<number>(Number(count ?? 1)).fill(Number(value));
    });
  return items.map((item, i) => ({ image: dir + (group ? pattern.replace(group[0], item) : pattern), ms: ms.length === 1 ? ms[0] : ms[i] }));
}

const one = (dir: string, image: string, ms: number): Frame[] => [{ image: dir + image, ms }];
const attack = (hit: number, ...parts: Frame[][]): Attack => ({ frames: parts.flat(), hit });

const PEASANTS = 'human-peasants/';
const LOYAL = 'human-loyalists/';
const OUTLAW = 'human-outlaws/';
const KNIGHT = 'human-loyalists/knight/';
const DARK = 'undead-necromancers/';

/** Which Wesnoth unit stands for each troop, and its frames (from its 1.18 `.cfg`). */
export const UNIT_ART: Record<TroopId, UnitArt> = {
  peasants: {
    unit: 'Peasant',
    cfg: 'humans/Peasant.cfg',
    stand: PEASANTS + 'peasant.png',
    idle: frames(PEASANTS, 'peasant-idle-[1~7,4,2,1].png', '100*4,200*3,100*3'),
    melee: attack(350, frames(PEASANTS, 'peasant-attack[1,2,3,4,5].png', '100,100,150,100,100')),
    defend: PEASANTS + 'peasant-defend.png',
    death: frames(PEASANTS, 'peasant-die[1~9].png', '100*3,150*3,200*3'),
  },
  archers: {
    unit: 'Bowman',
    cfg: 'humans/Loyalist_Bowman.cfg',
    stand: LOYAL + 'bowman.png',
    melee: attack(275, one(LOYAL, 'bowman-melee-defend-1.png', 50), frames(LOYAL, 'bowman-melee-attack-[1~4].png', 100), one(LOYAL, 'bowman-melee-defend-1.png', 50)),
    ranged: { ...attack(445, one(LOYAL, 'bowman-bow.png', 65), frames(LOYAL, 'bowman-bow-attack-[1~4,1].png', '75*2,100,130,65')), missile: 'arrow' },
    defend: LOYAL + 'bowman-melee-defend-2.png',
    defendRanged: LOYAL + 'bowman-bow-defend.png',
  },
  knights: {
    unit: 'Knight',
    cfg: 'humans/Horse_Knight.cfg',
    stand: KNIGHT + 'knight.png',
    idle: frames(KNIGHT, 'knight-breeze-[1~4,2,5].png', '200,300*3,200*2'),
    move: frames(KNIGHT, 'knight-se-run[1~8].png', 70),
    melee: attack(400, frames(KNIGHT, 'knight-se-slash[1~12].png', '100*3,70*9')),
    charge: attack(400, frames(KNIGHT, 'knight-se-attack[1~12].png', '100*3,70*9')),
    defend: KNIGHT + 'knight-se-defend2.png',
    death: frames(KNIGHT, 'knight-se-die[1~5].png', 100),
  },
  swordsmen: {
    unit: 'Swordsman',
    cfg: 'humans/Loyalist_Swordsman.cfg',
    stand: LOYAL + 'swordsman.png',
    idle: frames(LOYAL, 'swordsman-bob-s-[1~3,2,1].png', '180,120,600,250,350'),
    melee: attack(600, frames(LOYAL, 'swordsman-attack-se-[1~8].png', 100), one(LOYAL, 'swordsman.png', 50)),
    defend: LOYAL + 'swordsman-defend-2.png',
  },
  crossbowmen: {
    unit: 'Sergeant',
    cfg: 'humans/Loyalist_Sergeant.cfg',
    stand: LOYAL + 'sergeant-crossbow.png',
    melee: attack(250, frames(LOYAL, 'sergeant-attack-sword-[1~4].png', '75,150,100,75'), one(LOYAL, 'sergeant.png', 25)),
    ranged: { ...attack(400, one(LOYAL, 'sergeant-crossbow.png', 100), frames(LOYAL, 'sergeant-crossbow-attack[1~2].png', 150)), missile: 'quarrel' },
    defend: LOYAL + 'sergeant-defend-2.png',
    defendRanged: LOYAL + 'sergeant-crossbow-defend.png',
  },
  wolves: {
    unit: 'Wolf',
    cfg: 'monsters/Wolf.cfg',
    stand: 'monsters/wolf.png',
    move: one('monsters/', 'wolf-moving.png', 150),
    melee: attack(350, one('monsters/', 'wolf.png', 100), one('monsters/', 'wolf-attack.png', 200), one('monsters/', 'wolf-moving.png', 250), one('monsters/', 'wolf.png', 50)),
    defend: 'monsters/wolf-defend-2.png',
  },
  baron: {
    unit: 'Grand Marshal',
    cfg: 'humans/Loyalist_Grand_Marshal.cfg',
    stand: LOYAL + 'marshal.png',
    melee: attack(300, one(LOYAL, 'marshal.png', 50), one(LOYAL, 'marshal-defend-1.png', 50), frames(LOYAL, 'marshal-attack-sword[1~5].png', '100,75,100,50,75'), one(LOYAL, 'marshal.png', 75)),
    defend: LOYAL + 'marshal-defend-2.png',
    death: frames(LOYAL, 'marshal-die-[1~10].png', '75*8,175,125'),
  },
  goblins: {
    unit: 'Goblin Spearman',
    cfg: 'goblins/Spearman.cfg',
    stand: 'goblins/spearman.png',
    idle: frames('goblins/', 'spearman-idle-[1~12].png', '150*3,300,150*8'),
    move: frames('goblins/', 'spearman-se-run[1~9].png', 60),
    melee: attack(200, frames('goblins/', 'spearman-attack-se[1,2,1].png', '100,200,100')),
    defend: 'goblins/spearman-defend.png',
    death: frames('goblins/', 'spearman-die-[1~4].png', 240),
  },
  trolls: {
    unit: 'Troll',
    cfg: 'trolls/Troll.cfg',
    stand: 'trolls/grunt.png',
    melee: attack(300, one('trolls/', 'grunt.png', 25), frames('trolls/', 'grunt-attack-[1~4,3].png', '75*3,95,80'), one('trolls/', 'grunt-defend.png', 75)),
    defend: 'trolls/grunt-defend2.png',
  },
  witch: {
    unit: 'Dark Adept (female)',
    cfg: 'undead/Necro_Dark_Adept.cfg',
    stand: DARK + 'adept+female.png',
    melee: attack(160, one(DARK, 'adept+female.png', 30), frames(DARK, 'adept+female-magic-[1~3].png', '35,75,120'), frames(DARK, 'adept+female-magic-[2,1].png', '50,40')),
    ranged: {
      ...attack(450, one(DARK, 'adept+female.png', 30), frames(DARK, 'adept+female-magic-[1~3].png', '35,75,320'), frames(DARK, 'adept+female-magic-[2,1].png', '50,40'), one(DARK, 'adept+female.png', 10)),
      missile: 'hex',
    },
    defend: DARK + 'adept+female-defend-2.png',
  },
  bramble: {
    unit: 'Dark Sorcerer (female)',
    cfg: 'undead/Necro_Dark_Sorcerer.cfg',
    stand: DARK + 'dark-sorcerer+female.png',
    melee: attack(250, one(DARK, 'dark-sorcerer+female.png', 50), frames(DARK, 'dark-sorcerer+female-attack-staff-[1~2].png', '100,200'), one(DARK, 'dark-sorcerer+female-magic-1.png', 75), one(DARK, 'dark-sorcerer+female.png', 75)),
    ranged: { ...attack(355, frames(DARK, 'dark-sorcerer+female-magic-[1,2].png', 75), one(DARK, 'dark-sorcerer+female-magic-3.png', 350), frames(DARK, 'dark-sorcerer+female-magic-[2,1].png', 50)), missile: 'hex' },
    defend: DARK + 'dark-sorcerer+female-defend.png',
  },
  poachers: {
    unit: 'Poacher',
    cfg: 'humans/Woodsman_Poacher.cfg',
    stand: OUTLAW + 'poacher.png',
    melee: attack(220, one(OUTLAW, 'poacher-dagger-defend1.png', 70), one(OUTLAW, 'poacher-attack.png', 180), one(OUTLAW, 'poacher-dagger.png', 250)),
    ranged: { ...attack(550, frames(OUTLAW, 'poacher-bow-attack[1~7].png', '50*4,200,50,100'), one(OUTLAW, 'poacher-bow-attack1.png', 50)), missile: 'arrow' },
    defend: OUTLAW + 'poacher-dagger-defend2.png',
    defendRanged: OUTLAW + 'poacher-bow-defend.png',
  },
  bandits: {
    unit: 'Bandit',
    cfg: 'humans/Outlaw_Bandit.cfg',
    stand: OUTLAW + 'bandit.png',
    idle: frames(OUTLAW, 'bandit-idle-[1~6,5,4,3,2,1].png', 200),
    melee: attack(500, frames(OUTLAW, 'bandit-melee-[1~8].png', 100)),
    defend: OUTLAW + 'bandit-defend-2.png',
  },
  boars: {
    unit: 'Woodland Boar',
    cfg: 'monsters/Boar.cfg',
    stand: 'monsters/boar/woodland.png',
    move: one('monsters/boar/', 'woodland-moving.png', 150),
    melee: attack(600, frames('monsters/boar/', 'woodland-charge[1~3,2,1~4,5].png', '70*7,110,230')),
    defend: 'monsters/boar/woodland-defend2.png',
  },
};

const HORSE = 'human-loyalists/horseman/';

/** The hero, on the map and at the field's edge in battle: a Horseman, with our colours on his lance. */
export const HERO_ART: UnitArt = {
  unit: 'Horseman',
  cfg: 'humans/Horseman.cfg',
  stand: HORSE + 'horseman.png',
  idle: frames(HORSE, 'horseman-breeze-[1~4,2,5].png', '200,300*3,200*2'),
  move: frames(HORSE, 'horseman-se-run[1~8].png', 70),
  melee: attack(400, frames(HORSE, 'horseman-se-attack[1~12].png', '100*3,70*9')),
  defend: HORSE + 'horseman-se-defend2.png',
  death: frames(HORSE, 'horseman-se-die[1~5].png', 100),
};

/** Everyone Wesnoth draws for us: the troops, and the hero. */
export type ArtId = TroopId | 'hero';
export const ART: Record<ArtId, UnitArt> = { ...UNIT_ART, hero: HERO_ART };

/** Every image one unit uses. */
export function artImages(art: UnitArt): string[] {
  const all = [art.stand, art.defend, ...(art.defendRanged ? [art.defendRanged] : [])];
  for (const list of [art.idle, art.move, art.melee.frames, art.charge?.frames, art.ranged?.frames, art.death]) for (const f of list ?? []) all.push(f.image);
  return all;
}

/** Every image the troops and the hero use, once each. */
export function unitImages(): string[] {
  return [...new Set(Object.values(ART).flatMap(artImages))];
}
