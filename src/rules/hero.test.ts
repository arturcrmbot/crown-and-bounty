import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { ARTIFACTS } from '../content/artifacts';
import { BACKGROUNDS } from '../content/backgrounds';
import { autoResolve } from './battle/ai';
import { createBattle, strike } from './battle/battle';
import { apply, heroInBattle, heroStats, levelUpCard, visit, winChance, type GameState } from './game';
import { artifactChoices, equip, foundNote, gainXp, giveArtifact, learn, LEVELS, RALLY, RALLY_LEADERSHIP, RENOWN } from './hero';
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
  it('raises a stat and offers three different things to learn, and more leadership', () => {
    const { state, events } = gainXp(knight(), LEVELS[3]);
    expect(state.hero.level).toBe(3);
    expect(events.filter((e) => e.type === 'levelUp')).toHaveLength(2);
    expect(state.hero.offers).toHaveLength(2);
    for (const offer of state.hero.offers) {
      expect(new Set(offer.options).size).toBe(4);
      expect(offer.options.at(-1)).toBe(RALLY);
    }
    const stats = state.hero.attack + state.hero.defence + state.hero.spellPower + state.hero.knowledge;
    const before = knight().hero;
    expect(stats).toBe(before.attack + before.defence + before.spellPower + before.knowledge + 2);
  });

  it('rallies more men in place of learning something, at any level-up (Artur, 30 Sep)', () => {
    const levelled = gainXp(knight(), LEVELS[3]).state;
    const before = heroStats(levelled).leadership;
    const card = levelUpCard(levelled)!;
    expect(card.choices.at(-1)).toMatchObject({ label: `Rally more men (+${RALLY_LEADERSHIP} leadership)`, action: { type: 'learn', option: RALLY } });
    const after = learn(levelled, RALLY)!.state;
    expect(heroStats(after).leadership).toBe(before + RALLY_LEADERSHIP);
    expect(after.hero.skills).toEqual(levelled.hero.skills);
    expect(after.hero.perks).toEqual(levelled.hero.perks);
    // And again at the next one.
    expect(heroStats(learn(after, RALLY)!.state).leadership).toBe(before + 2 * RALLY_LEADERSHIP);
  });

  it('learns a skill rank or a perk, then offers the next level', () => {
    const levelled = gainXp(knight(), LEVELS[3]).state;
    const first = levelled.hero.offers[0].options[0];
    const after = learn(levelled, first)!.state;
    expect(after.hero.offers).toHaveLength(1);
    const [kind, id] = first.split(':');
    if (kind === 'skill') expect(after.hero.skills[id as keyof typeof after.hero.skills]).toBe(1);
    else expect(after.hero.perks).toContain(id);
    expect(levelUpCard(after)!.choices).toHaveLength(4);
    expect(learn(after, 'skill:not-offered')).toBeNull();
  });

  it('keeps a skill\u2019s next rank for a later fight: several level-ups at once never offer it again', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      let s = gainXp({ ...knight(), seed }, LEVELS[6]).state;
      expect(s.hero.offers).toHaveLength(5);
      while (s.hero.offers.length > 1) {
        const skill = s.hero.offers[0].options.find((o) => o.startsWith('skill:')) ?? s.hero.offers[0].options[0];
        s = learn(s, skill)!.state;
        expect(s.hero.offers[0].options).not.toContain(skill);
      }
    }
  });

  it('brings five more leadership every level', () => {
    const levelled = gainXp(knight(), LEVELS[5]).state;
    expect(heroStats(levelled).leadership - heroStats(knight()).leadership).toBe(4 * RENOWN);
    expect(RENOWN).toBe(5);
    expect(levelUpCard(levelled)!.lines[0]).toContain(`your leadership by **${RENOWN}**`);
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
    expect(foundNote(state, 'goldenFeather')).toContain('all three trinket slots are taken');
    const worn = equip(state, 'goldenFeather')!.state;
    expect(worn.hero.gear.trinket).toBe('goldenFeather');
    expect(worn.hero.pack).toEqual(['luckyHorseshoe']);
    expect(heroStats(worn).spellPower).toBe(heroStats(knight()).spellPower + 2);
  });

  it('keeps drawback gear in the pack until the player chooses to wear it', () => {
    for (const id of ['bramblesLadle', 'headsmansAxe', 'kingsPlate', 'friarsHabit', 'blackBanner'] as const) {
      const state = giveArtifact(knight(), id);
      expect(state.hero.gear[ARTIFACTS[id].slot]).toBeUndefined();
      expect(state.hero.pack).toContain(id);
      const choices = artifactChoices(state, id);
      expect(choices.map((choice) => choice.label)).toEqual(['Wear it', 'Keep it in your pack']);
      const worn = apply(state, choices[0].action)!.state;
      expect(worn.hero.gear[ARTIFACTS[id].slot]).toBe(id);
      expect(worn.hero.pack).not.toContain(id);
    }
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
    // One of each on its own: the poachers' rabbit's foot, and the castellan's bagpipes.
    expect(heroStats(giveArtifact(knight(), 'rabbitsFoot'))).toMatchObject({ luck: 0.1, morale: 0 });
    expect(heroStats(giveArtifact(knight(), 'castellansPipes'))).toMatchObject({ luck: 0, morale: 0.1 });
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
