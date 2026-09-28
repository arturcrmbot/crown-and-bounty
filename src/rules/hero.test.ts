import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { BACKGROUNDS } from '../content/backgrounds';
import { autoResolve } from './battle/ai';
import { createBattle, strike } from './battle/battle';
import { apply, heroInBattle, heroStats, levelUpCard, visit, winChance, type GameState } from './game';
import { equip, gainXp, giveArtifact, learn, LEVELS } from './hero';
import { newGame } from './scenario';

const knight = () => newGame(1, ALDMOOR, 'knight');

describe('backgrounds', () => {
  it('start each hero with their own army, purse, stats and spells', () => {
    for (const b of Object.values(BACKGROUNDS)) {
      const state = newGame(1, ALDMOOR, b.id);
      expect(state.army).toEqual(b.army);
      expect(state.gold).toBe(b.gold);
      expect(state.hero.spells).toEqual(b.spells);
      expect(heroStats(state).attack).toBe(b.stats.attack);
    }
  });

  it('give each signature perk its effect', () => {
    expect(heroStats(newGame(1, ALDMOOR, 'ranger')).movement).toBe(heroStats(knight()).movement + 30);
    expect(heroStats(newGame(1, ALDMOOR, 'wizard')).manaDiscount).toBe(2);
    expect(heroStats(knight()).troops.knights).toEqual({ attack: 1, defence: 1, shots: 0 });
    const courtier = newGame(1, ALDMOOR, 'courtier');
    expect(visit(courtier, 'village').events.some((e) => e.type === 'card' && e.card.lines[0].includes('**8 gold** each'))).toBe(true);
  });

  it('can be chosen on the opening card', () => {
    const wizard = apply(knight(), { type: 'background', id: 'wizard' })!.state;
    expect(wizard.hero.background).toBe('wizard');
    expect(wizard.hero.spells).toContain('haste');
  });
});

describe('levels', () => {
  it('raises a stat and offers three different things to learn', () => {
    const { state, events } = gainXp(knight(), LEVELS[3]);
    expect(state.hero.level).toBe(3);
    expect(events.filter((e) => e.type === 'levelUp')).toHaveLength(2);
    expect(state.hero.offers).toHaveLength(2);
    for (const offer of state.hero.offers) expect(new Set(offer.options).size).toBe(3);
    const stats = state.hero.attack + state.hero.defence + state.hero.spellPower + state.hero.knowledge;
    const before = knight().hero;
    expect(stats).toBe(before.attack + before.defence + before.spellPower + before.knowledge + 2);
  });

  it('learns a skill rank or a perk, then offers the next level', () => {
    const levelled = gainXp(knight(), LEVELS[3]).state;
    const first = levelled.hero.offers[0].options[0];
    const after = learn(levelled, first)!.state;
    expect(after.hero.offers).toHaveLength(1);
    const [kind, id] = first.split(':');
    if (kind === 'skill') expect(after.hero.skills[id as keyof typeof after.hero.skills]).toBe(1);
    else expect(after.hero.perks).toContain(id);
    expect(levelUpCard(after)!.choices).toHaveLength(3);
    expect(learn(after, 'skill:not-offered')).toBeNull();
  });

  it('pays experience for beating an enemy and for finding places', () => {
    const won = apply(knight(), { type: 'choose', id: 'highwaymen', choice: 'auto' })!.state;
    expect(won.hero.xp).toBeGreaterThan(80);
    const seen = visit(knight(), 'signpost').state;
    expect(seen.hero.xp).toBe(40);
    expect(visit(seen, 'signpost').state.hero.xp).toBe(40);
  });
});

describe('skills and gear', () => {
  it('make the numbers in battle bigger', () => {
    const plain = knight();
    const archer: GameState = { ...plain, hero: { ...plain.hero, skills: { archery: 2 } } };
    const b0 = createBattle({ place: 'x', seed: 1, player: [{ troop: 'archers', count: 20 }], enemy: [{ troop: 'swordsmen', count: 20 }], hero: heroInBattle(plain), obstacles: 0 });
    const b1 = createBattle({ place: 'x', seed: 1, player: [{ troop: 'archers', count: 20 }], enemy: [{ troop: 'swordsmen', count: 20 }], hero: heroInBattle(archer), obstacles: 0 });
    const d0 = strike(b0, b0.fighters[0], b0.fighters[1], true).damage;
    const d1 = strike(b1, b1.fighters[0], b1.fighters[1], true).damage;
    expect(d1 / d0).toBeCloseTo(1.3, 1);
  });

  it('wear artifacts in their slots, swapping from the pack', () => {
    let state = giveArtifact(knight(), 'luckyHorseshoe');
    expect(state.hero.gear.trinket).toBe('luckyHorseshoe');
    state = giveArtifact(state, 'wizardsButton');
    state = giveArtifact(state, 'astrolabe');
    expect(state.hero.gear).toMatchObject({ trinket: 'luckyHorseshoe', trinket2: 'wizardsButton', trinket3: 'astrolabe' });
    state = giveArtifact(state, 'goldenFeather');
    expect(state.hero.pack).toEqual(['goldenFeather']);
    const worn = equip(state, 'goldenFeather')!.state;
    expect(worn.hero.gear.trinket).toBe('goldenFeather');
    expect(worn.hero.pack).toEqual(['luckyHorseshoe']);
    expect(heroStats(worn).spellPower).toBe(heroStats(knight()).spellPower + 2);
  });

  it('grant luck and morale from a perk and a trinket', () => {
    expect(heroStats(knight()).luck).toBe(0);
    expect(heroStats(knight()).morale).toBe(0);
    const diced = giveArtifact(knight(), 'bonesDice');
    expect(heroStats(diced).luck).toBeCloseTo(0.12);
    expect(heroStats(diced).morale).toBeCloseTo(0.12);
    const favoured = { ...knight(), hero: { ...knight().hero, perks: ['fortunesFavour' as const] } };
    expect(heroStats(favoured).luck).toBeCloseTo(0.1);
    expect(heroStats(favoured).morale).toBeCloseTo(0.1);
  });

  it('sell the castle\u2019s wares for gold', () => {
    const rich = { ...knight(), gold: 5000 };
    const bought = apply(rich, { type: 'choose', id: 'castle', choice: 'buy:swordOfAldmoor' })!.state;
    expect(bought.gold).toBe(4100);
    expect(bought.hero.gear.weapon).toBe('swordOfAldmoor');
    expect(apply(bought, { type: 'choose', id: 'castle', choice: 'buy:swordOfAldmoor' })).toBeNull();
  });

  it('let the Goose Whisperer slow Baron Grimsby from the start', () => {
    const whisperer: GameState = { ...knight(), hero: { ...knight().hero, perks: ['gooseWhisperer'] } };
    const hideout = ALDMOOR.locations.find((l) => l.id === 'hideout')!;
    const b = createBattle({ place: 'hideout', seed: 1, player: whisperer.army, enemy: hideout.enemy!.army, hero: heroInBattle(whisperer) });
    expect(b.fighters.find((f) => f.troop === 'baron')!.status).toContain('slowed');
    expect(autoResolve(b).result).toBeDefined();
    expect(winChance(whisperer, 'hideout')).toBeGreaterThanOrEqual(winChance(knight(), 'hideout'));
  });
});
