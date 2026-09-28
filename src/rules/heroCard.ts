import { BACKGROUNDS } from '../content/backgrounds';
import { PERKS, RANKS, SKILLS, type SkillId } from '../content/skills';
import { MAP_SPELLS } from '../content/spells';
import { CAMPAIGN_LENGTH } from './campaign';
import { heroStats, LEVELS } from './hero';
import { manaNote } from './heroSheet';
import { armyLine, close, LAST_DAY, leadershipUsed, roman, type Card, type GameState } from './state';

/** The hero's card: who he is, what he has learned, and his army. */
export function describeHero(state: GameState): Card {
  const h = state.hero;
  const s = heroStats(state);
  const b = BACKGROUNDS[h.background];
  const next = LEVELS[h.level + 1];
  const skills = (Object.entries(h.skills) as [SkillId, number][]).map(([id, rank]) => `${RANKS[rank - 1]} ${SKILLS[id].name}`);
  const perks = [b.signature.name, ...h.perks.map((p) => PERKS[p].name)];
  return {
    title: b.title,
    lines: [
      `*Level ${roman(h.level)}* \u00b7 ${next ? `${h.xp} / ${next} experience` : `${h.xp} experience`} \u00b7 Day ${roman(state.day)} of ${LAST_DAY}`,
      `**Attack ${s.attack}, Defence ${s.defence}, Spell power ${s.spellPower}, Knowledge ${s.knowledge}**`,
      `**${manaNote(state)}**`,
      armyLine(state.army),
      `Leadership **${leadershipUsed(state.army)} / ${s.leadership}** \u00b7 **${Math.floor(state.movement)}** movement left today`,
      skills.length ? `Skills: ${skills.join(', ')}` : 'Skills: none yet',
      `Perks: ${perks.join(', ')}`,
      `Pieces of the old map: **${state.campaign.record.length + (state.bounty === 'paid' ? 1 : 0)} of ${CAMPAIGN_LENGTH}**`,
    ],
    choices: [
      ...s.mapSpells.map((id) => ({ label: `Cast ${MAP_SPELLS[id].name} (${MAP_SPELLS[id].mana} mana)`, action: { type: 'mapSpell' as const, spell: id }, ...(h.mana < MAP_SPELLS[id].mana ? { disabled: true } : {}) })),
      { label: 'Equipment', action: { type: 'gear' } },
      { label: 'End the day', action: { type: 'endDay' } },
      close,
    ],
  };
}
