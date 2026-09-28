import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import type { BackgroundId } from '../content/backgrounds';
import { FENMARCH } from '../content/fenmarch';
import { MAP_SPELLS, SPELLS, STATUSES, type SpellId } from '../content/spells';
import { battleAct, createBattle, fighterById, speedOf, spellDamage, statsOf } from './battle/battle';
import { withNewPlaces } from './campaign';
import { apply, commissionAt, endDay, heroInBattle, heroStats, levelUpCard, locationById, manaNote, visit, type Card, type GameState, type Result } from './game';
import { canRead, gainXp, knowsSpell, learn, LEVELS } from './hero';
import { beginCommission, newGame } from './scenario';

const fresh = (background: BackgroundId = 'knight'): GameState => ({ ...newGame(1066, ALDMOOR, background), opening: undefined });
const cardOf = (result: Result): Card => {
  const e = result.events.find((x) => x.type === 'card');
  if (!e || e.type !== 'card') throw new Error('no card');
  return e.card;
};
const choose = (state: GameState, id: string, choice: string) => apply(state, { type: 'choose', id, choice });
const withSpell = (state: GameState, spell: SpellId) => ({ ...state, hero: { ...state.hero, spells: [...state.hero.spells, spell], mana: 200 } });
/** A battle where the hero casts `spell` on the first stack of `side`. */
function cast(spell: SpellId, side: 'player' | 'enemy') {
  const hero = { ...heroInBattle(withSpell(fresh('wizard'), spell)), mana: 200 };
  const b = createBattle({ place: 'x', seed: 1, player: [{ troop: 'knights', count: 10 }, { troop: 'archers', count: 20 }], enemy: [{ troop: 'swordsmen', count: 30 }, { troop: 'wolves', count: 20 }], hero, obstacles: 0 });
  const target = b.fighters.find((f) => f.side === side)!;
  return { before: b, after: battleAct(b, { type: 'cast', spell, target: target.id }).battle, target: target.id };
}

describe('spells', () => {
  it('all have a circle: the old six are the first', () => {
    for (const s of Object.values(SPELLS)) expect([1, 2, 3]).toContain(s.circle);
    for (const id of ['bolt', 'bless', 'slow', 'haste', 'fireball', 'stoneskin'] as const) expect(SPELLS[id].circle).toBe(1);
    for (const m of Object.values(MAP_SPELLS)) expect([1, 2, 3]).toContain(m.circle);
    for (const s of Object.values(SPELLS)) if (s.effect.kind === 'status') expect(STATUSES[s.effect.status]).toBeDefined();
  });

  it('new statuses change the numbers the engine already reads', () => {
    const rust = cast('rust', 'enemy');
    expect(statsOf(rust.after, fighterById(rust.after, rust.target)).defence).toBe(statsOf(rust.before, fighterById(rust.before, rust.target)).defence - 3);
    const fury = cast('fury', 'player');
    const furious = fighterById(fury.after, fury.target);
    expect(furious.status).toContain('fury');
    expect(speedOf(furious)).toBe(speedOf(fighterById(fury.before, fury.target)) + 2);
    expect(statsOf(fury.after, furious).defence).toBe(statsOf(fury.before, fighterById(fury.before, fury.target)).defence - 4);
    const mire = cast('quagmire', 'enemy');
    expect(speedOf(fighterById(mire.after, mire.target))).toBe(Math.ceil(speedOf(fighterById(mire.before, mire.target)) / 2));
    const wall = cast('bulwark', 'player');
    expect(statsOf(wall.after, fighterById(wall.after, wall.target)).defence).toBe(statsOf(wall.before, fighterById(wall.before, wall.target)).defence + 6);
    const wither = cast('wither', 'enemy');
    expect(statsOf(wither.after, fighterById(wither.after, wither.target)).defence).toBe(statsOf(wither.before, fighterById(wither.before, wither.target)).defence - 6);
    const clap = cast('thunderclap', 'enemy');
    expect(spellDamage(clap.before, 'thunderclap')).toBe(32 * clap.before.hero.spellPower);
  });
});

describe('circles and Wisdom', () => {
  it('a knight reads the first circle; Wisdom opens the second, then the third; a wizard reads them all', () => {
    const knight = fresh();
    expect([canRead(knight, 'rust'), canRead(knight, 'fury'), canRead(knight, 'meteor')]).toEqual([true, false, false]);
    const basic = { ...knight, hero: { ...knight.hero, skills: { wisdom: 1 } } };
    expect([canRead(basic, 'fury'), canRead(basic, 'meteor')]).toEqual([true, false]);
    const advanced = { ...knight, hero: { ...knight.hero, skills: { wisdom: 2 } } };
    expect(canRead(advanced, 'meteor')).toBe(true);
    expect(heroStats(advanced).maxMana).toBe(heroStats(knight).maxMana + 10);
    expect(canRead(fresh('wizard'), 'meteor')).toBe(true);
    expect(canRead(fresh('wizard'), 'recall')).toBe(true);
  });

  it('Expert Wisdom: every level-up teaches a spell he can read', () => {
    const sage = { ...fresh(), hero: { ...fresh().hero, skills: { wisdom: 3 } } };
    const grown = gainXp(sage, LEVELS[2]).state;
    const lesson = grown.hero.offers[0].lesson!;
    expect(lesson).toBeDefined();
    expect(knowsSpell(grown, lesson)).toBe(true);
    expect(levelUpCard(grown)!.lines.some((l) => l.startsWith('Your studies pay off'))).toBe(true);
    expect(gainXp(fresh(), LEVELS[2]).state.hero.offers[0].lesson).toBeUndefined();
  });
});

describe('the mage guild', () => {
  it('teaches for gold, greying out what he can\u2019t read yet', () => {
    const knight = { ...fresh(), gold: 5000 };
    expect(cardOf(visit(knight, 'castle')).choices.map((c) => c.label)).toContain('Visit the mage guild');
    const guild = cardOf(choose(knight, 'castle', 'guild')!);
    const fury = guild.choices.find((c) => c.label.startsWith('Learn Fury'))!;
    expect(fury.disabled).toBe(true);
    expect(fury.detail).toContain('Beyond you for now: circle II: Basic Wisdom.');
    expect(choose(knight, 'castle', 'learn:fury')).toBeNull();
    const taught = choose(knight, 'castle', 'learn:rust')!.state;
    expect(taught.hero.spells).toContain('rust');
    expect(taught.gold).toBe(4700);
    expect(cardOf(choose(taught, 'castle', 'guild')!).choices.some((c) => c.label.startsWith('Learn Rust'))).toBe(false);
    const road = choose(taught, 'castle', 'learn:swiftroad')!.state;
    expect(heroStats(road).mapSpells).toContain('swiftroad');
    const wizard = { ...fresh('wizard'), gold: 5000 };
    expect(choose(wizard, 'castle', 'learn:fury')!.state.hero.spells).toContain('fury');
  });

  it('is in every castle, and in old saves too', () => {
    const fen = beginCommission(FENMARCH, 1066, fresh().campaign.start, 1, []);
    expect(locationById(fen, 'keep').guild).toEqual(['quagmire', 'dowsing', 'thunderclap', 'scry']);
    for (const chapter of [2, 3, 4]) {
      const province = commissionAt(fresh().campaign, chapter).province;
      const guild = province.locations.find((l) => l.kind === 'castle')!.guild!;
      expect(guild).toHaveLength(4);
      expect(guild.some((id) => (id in SPELLS ? SPELLS[id as SpellId].circle : MAP_SPELLS[id as keyof typeof MAP_SPELLS].circle) === 3)).toBe(true);
      expect(province.locations.find((l) => l.id === 'chest0')!.scroll).toBeDefined();
    }
    const old = { ...fresh(), locations: fresh().locations.map((l) => (l.id === 'castle' ? { ...l, seen: true, guild: undefined } : l.id === 'well' ? null : l)).filter(Boolean) } as GameState;
    const loaded = withNewPlaces(JSON.parse(JSON.stringify(old)));
    expect(locationById(loaded, 'castle').guild).toEqual(['rust', 'swiftroad', 'bulwark', 'fury']);
    expect(loaded.locations.some((l) => l.id === 'well')).toBe(true);
  });
});

describe('scrolls', () => {
  it('a wizard reads one at once; a knight keeps it until Wisdom lets him read it', () => {
    const fen = (background: BackgroundId) => beginCommission(FENMARCH, 1066, fresh(background).campaign.start, 1, []);
    const wizard = choose(fen('wizard'), 'chest', 'keep')!;
    expect(wizard.state.hero.spells).toContain('fury');
    const knight = choose(fen('knight'), 'chest', 'keep')!;
    expect(knight.state.hero.spells).not.toContain('fury');
    expect(knight.state.hero.scrolls).toEqual(['fury']);
    expect(cardOf(knight).lines.some((l) => l.includes('You keep the scroll until you can read it'))).toBe(true);
    const offered = { ...knight.state, hero: { ...knight.state.hero, offers: [{ level: 2, stat: 'attack' as const, options: ['skill:wisdom', 'skill:archery', 'perk:warchest'] }] } };
    const wise = learn(offered, 'skill:wisdom')!;
    expect(wise.state.hero.spells).toContain('fury');
    expect(wise.state.hero.scrolls).toEqual([]);
    expect(cardOf(wise).lines[0]).toContain('At last you can make sense of the scroll');
  });
});

describe('map spells', () => {
  const caster = (spells: (keyof typeof MAP_SPELLS)[], base = fresh('wizard')): GameState => ({ ...base, hero: { ...base.hero, mapSpells: spells, mana: 60 } });

  it('Swift Road, Dowsing, Scry and Recall, each paid in mana', () => {
    const road = apply(caster(['swiftroad']), { type: 'mapSpell', spell: 'swiftroad' })!.state;
    expect(road.movement).toBe(caster([]).movement + 50);
    expect(road.hero.mana).toBe(52);
    const dowsed = apply(caster(['dowsing']), { type: 'mapSpell', spell: 'dowsing' })!;
    const treasure = caster([]).locations.filter((l) => !l.done && ['chest', 'gold', 'mine'].includes(l.kind));
    expect(dowsed.events.filter((e) => e.type === 'reveal')).toHaveLength(treasure.length);
    const scried = apply(caster(['scry'], { ...fresh('wizard') }), { type: 'mapSpell', spell: 'scry' })!;
    const lair = locationById(fresh(), 'hideout');
    expect(scried.events).toContainEqual({ type: 'reveal', at: lair.at, radius: 90 });
    expect(cardOf(scried).lines.some((l) => l.includes('56 Swordsmen'))).toBe(true);
    const home = apply(caster(['recall']), { type: 'mapSpell', spell: 'recall' })!.state;
    const castle = locationById(fresh(), 'castle');
    expect(home.hero.at).toEqual([castle.at[0], castle.at[1] + 14]);
    expect(home.movement).toBe(0);
    expect(apply(caster([]), { type: 'mapSpell', spell: 'recall' })).toBeNull();
    expect(apply({ ...caster(['recall']), hero: { ...caster(['recall']).hero, mana: 5 } }, { type: 'mapSpell', spell: 'recall' })).toBeNull();
  });
});

describe('wells and the mana line', () => {
  it('a well fills his mana once a day', () => {
    const tired = { ...fresh('wizard'), hero: { ...fresh('wizard').hero, mana: 4 } };
    const drunk = visit(tired, 'well').state;
    expect(drunk.hero.mana).toBe(heroStats(tired).maxMana);
    const again = visit({ ...drunk, hero: { ...drunk.hero, mana: 4 } }, 'well').state;
    expect(again.hero.mana).toBe(4);
    const tomorrow = endDay({ ...again, hero: { ...again.hero } }).state;
    expect(visit({ ...tomorrow, hero: { ...tomorrow.hero, mana: 4 } }, 'well').state.hero.mana).toBe(heroStats(tired).maxMana);
    // Full already: no need, and the well waits for a day he needs it.
    const full = visit(fresh('wizard'), 'well').state;
    expect(full.flags?.['drank:well']).toBeUndefined();
  });

  it('the mana line says how it comes back', () => {
    const mystic = { ...fresh('wizard'), hero: { ...fresh('wizard').hero, skills: { mysticism: 2 } } };
    expect(manaNote(mystic)).toContain('a point back for every 15 movement you ride');
    const seen = visit(fresh('wizard'), 'well').state;
    expect(manaNote(seen)).toContain('St Aldhelm\u2019s Well fills it, once a day');
    expect(manaNote(fresh('wizard'))).toBe('Mana 30/30 · it fills up again every dawn');
  });
});
