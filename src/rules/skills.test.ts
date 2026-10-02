import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import type { BackgroundId } from '../content/backgrounds';
import { FENMARCH } from '../content/fenmarch';
import { RANKS, SKILLS, type HigherRank, type SkillId } from '../content/skills';
import { createBattle, statsOf } from './battle/battle';
import { apply, battleXp, describe as about, endDay, fightingPower, heroInBattle, heroStats, levelUpCard, locationById, nextArmy, visit, winChance, type Card, type GameState, type Result } from './game';
import { gainXp, giveArtifact, LEVELS } from './hero';
import { heroSheet } from './heroSheet';
import { mapOf } from './map/maps';
import { Terrain } from './map/model';
import { costsFor, planRoute, stepAlong } from './map/movement';
import { hunting } from './map/roaming';
import { hireOffer } from './places/enemy';
import { beginCommission, newGame } from './scenario';

const fresh = (background: BackgroundId = 'knight'): GameState => ({ ...newGame(1066, ALDMOOR, background), opening: undefined });
/** How many of a troop stand in a place's army, as the content has it. */
const inContent = (id: string, troop: string) => ALDMOOR.locations.find((l) => l.id === id)!.enemy!.army.find((x) => x.troop === troop)!.count;
const skilled = (skills: Partial<Record<SkillId, number>>, background: BackgroundId = 'knight', base = fresh(background)): GameState => ({ ...base, hero: { ...base.hero, skills } });
const cardOf = (result: Result): Card => {
  const e = result.events.find((x) => x.type === 'card');
  if (!e || e.type !== 'card') throw new Error('no card');
  return e.card;
};
const labels = (state: GameState, id: string) => cardOf(visit(state, id)).choices.map((c) => `${c.label}${c.disabled ? ' [off]' : ''}`);
const battle = (state: GameState, enemy: GameState['army']) => createBattle({ place: 'x', seed: 1, player: state.army, enemy, hero: heroInBattle(state), obstacles: 0 });
/** An army that could beat anything in Aldmoor. */
const mighty = (state: GameState): GameState => ({ ...state, leadership: 900, army: [{ troop: 'knights', count: 60 }, { troop: 'archers', count: 90 }] });

describe('skills', () => {
  it('have three ranks, each saying everything the skill does at that rank', () => {
    for (const skill of Object.values(SKILLS)) {
      expect(skill.ranks).toHaveLength(RANKS.length);
      for (const rank of skill.ranks) expect(rank.note.length).toBeGreaterThan(10);
      // Advanced and Expert teach more than a number.
      const tricks = (r: number) => Object.keys(skill.ranks[r].bonus).length;
      expect(tricks(1)).toBeGreaterThan(tricks(0));
      expect(tricks(2)).toBeGreaterThanOrEqual(tricks(1));
    }
  });

  it('offer the next rank on a level-up, in words', () => {
    const s = { ...skilled({ archery: 1 }), hero: { ...skilled({ archery: 1 }).hero, offers: [{ level: 2, stat: 'attack' as const, options: ['skill:archery', 'skill:diplomacy', 'perk:warchest'] }] } };
    const choices = levelUpCard(s)!.choices;
    expect(choices).toContainEqual(expect.objectContaining({ label: 'Advanced Archery', detail: SKILLS.archery.ranks[1].adds }));
    expect(choices).toContainEqual(expect.objectContaining({ label: 'Basic Diplomacy', detail: SKILLS.diplomacy.ranks[0].note }));
  });

  it('say on a level-up what Advanced and Expert add to the rank before, and on the hero screen what they do in all (#226)', () => {
    for (const skill of Object.values(SKILLS)) {
      for (const rank of skill.ranks.slice(1) as HigherRank[]) {
        expect(rank.adds).toMatch(/another|\bmore\b/);
        expect(rank.adds).not.toBe(rank.note);
      }
    }
    // A wizard with Advanced Sorcery has +2 spell power and his spells a mana cheaper already: Expert adds one more, and no discount.
    const wizard = skilled({ sorcery: 2 }, 'wizard');
    const offered = { ...wizard, hero: { ...wizard.hero, offers: [{ level: 9, stat: 'knowledge' as const, options: ['skill:sorcery', 'skill:archery', 'perk:warchest'] }] } };
    const expert = levelUpCard(offered)!.choices[0].detail!;
    expect(expert).toContain('another +1 spell power, +3 in all');
    expect(expert).not.toContain('mana less');
    expect(heroStats({ ...wizard, hero: { ...wizard.hero, skills: { sorcery: 3 } } }).spellPower).toBe(heroStats(wizard).spellPower + 1);
    expect(heroSheet(offered).skills).toEqual([{ name: 'Advanced Sorcery', note: SKILLS.sorcery.ranks[1].note }]);
  });

  it('still count for heroes saved with the old nine', () => {
    const old = skilled({ archery: 2, sorcery: 3, mysticism: 1 });
    const s = heroStats(old);
    expect(s.ranged).toBeCloseTo(0.3);
    expect(s.spellPower).toBe(old.hero.spellPower + 3);
    expect(s.knowledge).toBe(old.hero.knowledge + 1);
  });
});

describe('Archery', () => {
  const wolves = [{ troop: 'wolves' as const, count: 40 }, { troop: 'swordsmen' as const, count: 10 }];
  it('Advanced: stakes slow the wolves, boars and goblins from the start', () => {
    const b = battle(skilled({ archery: 2 }), wolves);
    expect(b.fighters.find((f) => f.troop === 'wolves')!.status).toContain('slowed');
    expect(b.fighters.find((f) => f.troop === 'swordsmen')!.status).not.toContain('slowed');
    expect(battle(skilled({ archery: 1 }), wolves).fighters.find((f) => f.troop === 'wolves')!.status).toEqual([]);
  });

  it('Expert: a free volley before every battle, and archers +1 attack', () => {
    const expert = skilled({ archery: 3 });
    const b = battle(expert, wolves);
    expect(b.volley).toBe(true);
    const archers = b.fighters.find((f) => f.side === 'player' && f.troop === 'archers')!;
    expect(statsOf(b, archers).attack).toBe(statsOf(battle(fresh(), wolves), archers).attack + 1);
  });
});

describe('Offence', () => {
  it('Advanced: knights and swordsmen charge; Expert: everyone who fights hand to hand', () => {
    expect(heroStats(skilled({ offence: 2 }, 'wizard')).charge).toEqual(['knights', 'swordsmen']);
    const expert = heroStats(skilled({ offence: 3 }, 'wizard')).charge;
    for (const troop of ['knights', 'peasants', 'wolves', 'boars', 'bandits'] as const) expect(expert).toContain(troop);
    expect(expert).not.toContain('archers');
    expect(heroStats(skilled({ offence: 3 }, 'wizard')).melee).toBeCloseTo(0.3);
  });
});

describe('Armourer', () => {
  it('Advanced: shooters wear mail; Expert: every piece of gear adds defence', () => {
    const b = battle(skilled({ armourer: 2 }), [{ troop: 'wolves', count: 5 }]);
    const archers = b.fighters.find((f) => f.side === 'player' && f.troop === 'archers')!;
    const knights = b.fighters.find((f) => f.side === 'player' && f.troop === 'knights')!;
    const plain = battle(fresh(), [{ troop: 'wolves', count: 5 }]);
    expect(statsOf(b, archers).defence).toBe(statsOf(plain, archers).defence + 2);
    expect(statsOf(b, knights).defence).toBe(statsOf(plain, knights).defence);
    let expert = skilled({ armourer: 3 });
    const bare = heroStats(expert).defence;
    expert = giveArtifact(giveArtifact(expert, 'luckyHorseshoe'), 'helmOfFarSight');
    expect(heroStats(expert).defence).toBe(bare + 2);
  });
});

describe('Logistics', () => {
  const map = mapOf(fresh());
  const grass = map.terrain.findIndex((t) => t === Terrain.Grass);
  const forest = map.terrain.findIndex((t) => t === Terrain.Forest);
  const road = map.terrain.findIndex((t) => t === Terrain.Road);

  it('makes riding off the road cheaper, never cheaper than a road', () => {
    expect(costsFor(skilled({ logistics: 1 }), map)[grass]).toBe(2);
    expect(costsFor(skilled({ logistics: 2 }), map)[grass]).toBe(1.5);
    expect(costsFor(skilled({ logistics: 3 }), map)[grass]).toBe(1);
    expect(costsFor(skilled({ logistics: 3 }), map)[road]).toBe(1);
    // The woods only for those who can ride them.
    expect(costsFor(skilled({ logistics: 3 }), map)[forest]).toBe(Infinity);
    expect(costsFor(skilled({ logistics: 3 }, 'ranger'), map)[forest]).toBe(1.5);
    expect(heroStats(skilled({ logistics: 3 })).movement).toBe(heroStats(fresh()).movement + 60);
  });
});

describe('Scouting', () => {
  it('Basic: counts every enemy exactly', () => {
    const swordsmen = `${inContent('patrol', 'swordsmen')} Swordsmen`;
    expect(about(fresh(), 'patrol').lines.some((l) => l.includes(swordsmen))).toBe(false);
    expect(about(skilled({ scouting: 1 }), 'patrol').lines.some((l) => l.includes(swordsmen))).toBe(true);
  });

  it('Advanced: puts a number on the chances, and says what they carry', () => {
    const scout = skilled({ scouting: 2 });
    const lines = cardOf(visit(scout, 'patrol')).lines;
    expect(lines.some((l) => /chances? in ten/.test(l))).toBe(true);
    expect(lines).toContain('*Your scouts have seen that they carry* **Grimsby\u2019s Carving Knife**. It gives +1 attack and +5% melee damage. The goose flinches when she sees it. *Wear it with his feather and hat, and his men start every battle slowed.*');
    expect(about(scout, 'wolves').lines.some((l) => l.includes('Greenwood Cloak'))).toBe(true);
    expect(cardOf(visit(skilled({ scouting: 1 }), 'patrol')).lines.some((l) => /in ten/.test(l))).toBe(false);
  });

  it('Expert: shadows every band, so none can hunt him, and he sees them all at dawn', () => {
    const fen = (skills: Partial<Record<SkillId, number>>) => {
      const s = beginCommission(FENMARCH, 1066, fresh().campaign.start, 1, []);
      const goblins = locationById(s, 'goblins');
      return { ...s, hero: { ...s.hero, skills, at: [goblins.at[0], goblins.at[1] - 120] as [number, number] } };
    };
    const goblins = (s: GameState) => locationById(s, 'goblins');
    expect(hunting(fen({}), goblins(fen({})))).toBe(true);
    expect(hunting(fen({ scouting: 3 }), goblins(fen({ scouting: 3 })))).toBe(false);
    const dawn = endDay(fen({ scouting: 3 }));
    const bands = dawn.state.locations.filter((l) => l.enemy && !l.done && l.kind !== 'hideout');
    const reveals = dawn.events.filter((e) => e.type === 'reveal');
    expect(reveals.length).toBeGreaterThan(0);
    for (const e of reveals) if (e.type === 'reveal') expect(bands.some((b) => b.at[0] === e.at[0] && b.at[1] === e.at[1])).toBe(true);
    // Never the villain's hideout: that is for the tower's note to find.
    const hut = locationById(dawn.state, 'hideout');
    expect(reveals.some((e) => e.type === 'reveal' && e.at[0] === hut.at[0] && e.at[1] === hut.at[1])).toBe(false);
  });
});

describe('Leadership', () => {
  it('Advanced: a third of every company stays on between commissions', () => {
    const big = { ...fresh(), army: [{ troop: 'knights' as const, count: 30 }, { troop: 'archers' as const, count: 60 }], leadership: 900 };
    const count = (s: GameState, troop: 'knights' | 'archers') => nextArmy(s).find((x) => x.troop === troop)!.count;
    expect(count(big, 'knights')).toBe(10 + 7);
    expect(count({ ...big, hero: { ...big.hero, skills: { leadership: 2 } } }, 'knights')).toBe(10 + 10);
  });

  it('Expert: volunteers join his biggest company every payday', () => {
    const s = { ...skilled({ leadership: 3 }), day: 7 };
    const r = endDay(s);
    expect(r.state.army.find((x) => x.troop === 'knights')!.count).toBe(10 + 4);
    expect(cardOf(r).lines).toContain('**4 Knights** ride in to join you, for your name alone.');
    // Only on payday.
    expect(endDay({ ...s, day: 3 }).state.army).toEqual(s.army);
  });
});

describe('Estates', () => {
  it('Advanced: castles and villages find more volunteers on payday', () => {
    const s = { ...skilled({ estates: 2 }), day: 7 };
    const r = endDay(s);
    const recruits = (x: GameState, id: string) => locationById(x, id).recruits!.count;
    expect(recruits(r.state, 'village')).toBe(recruits(s, 'village') + 15);
    expect(recruits(endDay({ ...fresh(), day: 7 }).state, 'village')).toBe(recruits(s, 'village') + 10);
  });

  it('Expert: every castle and village he has visited pays rent', () => {
    let s = { ...skilled({ estates: 3 }), day: 7 };
    const before = heroStats(s).payday;
    s = visit(s, 'village').state;
    s = visit(s, 'butts').state;
    expect(heroStats(s).payday).toBe(before + 200);
    const r = endDay(s);
    expect(cardOf(r).lines).toContain('Of that, **200 gold** is rent from the castles and villages you have visited.');
  });
});

describe('Sorcery and Mysticism', () => {
  it('Sorcery: cheaper spells, then another cast a round', () => {
    expect(heroStats(skilled({ sorcery: 2 })).manaDiscount).toBe(1);
    expect(heroStats(skilled({ sorcery: 3 })).casts).toBe(2);
    expect(heroInBattle(skilled({ sorcery: 3 })).casts).toBe(2);
  });

  it('nobody casts more than two spells a round, however many ways he learns', () => {
    const wizard = skilled({ sorcery: 3 }, 'wizard');
    const stacked = giveArtifact({ ...wizard, hero: { ...wizard.hero, perks: ['battleMage'] } }, 'twinWand');
    expect(heroStats(stacked).casts).toBe(2);
    expect(heroInBattle(stacked).casts).toBe(2);
    // The wand still gives him something: spell power.
    expect(heroStats(stacked).spellPower).toBe(heroStats({ ...wizard, hero: { ...wizard.hero, perks: ['battleMage'] } }).spellPower + 1);
    // A hero who casts two already is never offered Battle Mage, and Expert Sorcery says its cast changes nothing.
    for (let seed = 1; seed < 13; seed++) {
      const grown = gainXp({ ...fresh('wizard'), seed }, LEVELS[4]).state;
      for (const offer of grown.hero.offers) expect(offer.options).not.toContain('perk:battleMage');
    }
    const offered = { ...skilled({ sorcery: 2 }, 'wizard'), hero: { ...skilled({ sorcery: 2 }, 'wizard').hero, offers: [{ level: 2, stat: 'attack' as const, options: ['skill:sorcery', 'skill:archery', 'perk:warchest'] }] } };
    expect(levelUpCard(offered)!.choices[0].detail).toContain('that part changes nothing for you');
    const knight = { ...skilled({ sorcery: 2 }), hero: { ...skilled({ sorcery: 2 }).hero, offers: offered.hero.offers } };
    expect(levelUpCard(knight)!.choices[0].detail).not.toContain('changes nothing');
  }, 30_000);

  it('Mysticism: mana comes back as he rides, up to what he can hold', () => {
    const mystic = skilled({ mysticism: 2 }, 'wizard');
    // Nothing lying by the way to pick up, so all the mana is what came back on the ride.
    const tired = { ...mystic, hero: { ...mystic.hero, mana: 0 }, locations: mystic.locations.filter((l) => l.kind !== 'pickup') };
    const map = mapOf(tired);
    const village = locationById(tired, 'village');
    let s = tired;
    let route = planRoute(s, map, village.at)!;
    const start = s.movement;
    while (route.length && start - s.movement < 60) {
      s = stepAlong(s, map, route)!.state;
      route = route.slice(1);
    }
    const ridden = start - s.movement;
    expect(s.hero.mana).toBeGreaterThanOrEqual(Math.floor(ridden / 15) - 1);
    expect(s.hero.mana).toBeLessThanOrEqual(Math.ceil(ridden / 15));
    expect(s.hero.mana).toBeGreaterThan(0);
    // Nobody else gets any back, and a full hero stays full.
    const plain = { ...fresh('wizard'), hero: { ...fresh('wizard').hero, mana: 0 } };
    expect(stepAlong(plain, map, planRoute(plain, map, village.at)!)!.state.hero.mana).toBe(0);
    let full = { ...mystic, hero: { ...mystic.hero, mana: heroStats(mystic).maxMana } };
    route = planRoute(full, map, village.at)!;
    for (let i = 0; i < 40 && route.length; i++, route = route.slice(1)) full = stepAlong(full, map, route)!.state;
    expect(full.hero.mana).toBe(heroStats(mystic).maxMana);
  });
});

describe('Diplomacy', () => {
  it('Basic: bands far weaker than him surrender: their gold, their spoils, half the experience', () => {
    const envoy = mighty(skilled({ diplomacy: 1 }));
    expect(labels(envoy, 'highwaymen')).toContain('Demand their surrender');
    const r = apply(envoy, { type: 'choose', id: 'highwaymen', choice: 'surrender' })!;
    const band = locationById(envoy, 'highwaymen');
    expect(locationById(r.state, 'highwaymen').done).toBe(true);
    expect(r.state.gold).toBe(envoy.gold + band.enemy!.reward);
    expect(r.state.hero.xp).toBe(Math.round(battleXp(band.enemy!.army) / 2));
    expect(r.state.army).toEqual(envoy.army);
    expect(r.state.flags?.orders).toBe(true);
    // Not beasts, not a fair fight, and not without the skill.
    expect(labels(envoy, 'boars')).not.toContain('Demand their surrender');
    expect(labels(skilled({ diplomacy: 1 }), 'patrol')).not.toContain('Demand their surrender');
    expect(labels(mighty(fresh()), 'highwaymen')).not.toContain('Demand their surrender');
    expect(apply(skilled({ diplomacy: 1 }), { type: 'choose', id: 'patrol', choice: 'surrender' })).toBeNull();
    expect(winChance(envoy, 'highwaymen')).toBeGreaterThanOrEqual(0.9);
  });

  it('Advanced: small bands take his coin; Expert: gatekeepers too, at six times the price', () => {
    // An army more than twice as strong as the patrol, so that every one of them would come over.
    const rich = (s: GameState) => ({ ...s, gold: 40000, leadership: 900, army: [{ troop: 'knights' as const, count: 80 }, { troop: 'archers' as const, count: 100 }] });
    expect(hireOffer(rich(skilled({ diplomacy: 1 })), locationById(fresh(), 'highwaymen'))).toBeNull();
    const advanced = rich(skilled({ diplomacy: 2 }));
    // Three gold for every point of their power.
    const worth = (id: string) => fightingPower(locationById(fresh(), id).enemy!.army);
    expect(hireOffer(advanced, locationById(advanced, 'highwaymen'))?.price).toBe(Math.round((worth('highwaymen') * 3) / 10) * 10);
    expect(hireOffer(advanced, locationById(advanced, 'patrol'))).toBeNull();
    const expert = rich(skilled({ diplomacy: 3 }));
    const patrol = hireOffer(expert, locationById(expert, 'patrol'))!;
    expect(patrol.all).toBe(true);
    expect(patrol.price).toBe(Math.round((worth('patrol') * 3 * 6) / 10) * 10);
    const hired = apply(expert, { type: 'choose', id: 'patrol', choice: 'hire' })!.state;
    expect(hired.army.find((s) => s.troop === 'swordsmen')?.count).toBe(inContent('patrol', 'swordsmen'));
    expect(locationById(hired, 'patrol').done).toBe(true);
    // Never the villain, never beasts.
    expect(hireOffer(expert, locationById(expert, 'hideout'))).toBeNull();
    expect(hireOffer(expert, locationById(expert, 'wolves'))).toBeNull();
  });
});
