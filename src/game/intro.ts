import { BACKGROUNDS, type BackgroundId } from '../content/backgrounds';
import { COMMISSIONS } from '../content/campaign';
import { SPELLS } from '../content/spells';
import { troops } from '../content/troops';
import { campaignLines, commissionOf, hasNextCommission, roman, type Card, type GameState } from '../rules/game';

/** The very first card: who Aldric was before the King found him. Wide, so all four fit on a small screen. */
export function backgroundCard(): Card {
  const all = Object.values(BACKGROUNDS);
  return {
    title: 'Who were you, before the King found you?',
    lines: all.map((b) => `**${b.name}.** ${b.pitch.split('. ')[0].replace(/\.$/, '')}. *${b.signature.note}*`),
    choices: all.map((b) => ({ label: b.name, action: { type: 'background', id: b.id } })),
    wide: true,
  };
}

export function storyCard(background: BackgroundId): Card {
  const b = BACKGROUNDS[background];
  return {
    title: 'The King\u2019s Commission',
    lines: [
      `${b.title}: ${COMMISSIONS[0].brief.join(' ')}`,
      `You ride out with ${b.army.map((s) => troops(s.troop, s.count)).join(' and ')}${b.spells.length ? `, and ${b.spells.map((s) => SPELLS[s].name).join(', ')} in your spellbook` : ''}.`,
      'Click the map to ride, and click anything that looks interesting. Red marks on your route are for tomorrow.',
      `The hourglass (or **E**) ends the day. Every seventh day is payday. Click ${b.short} to see what he has learned.`,
    ],
    choices: [{ label: 'Ride out', action: { type: 'close' } }],
  };
}

export const welcomeBackCard = (state: GameState): Card => ({
  title: 'Welcome back',
  lines: [`Day ${roman(state.day)} of Commission ${roman(state.campaign.chapter + 1)}. ${state.bounty === 'paid' ? 'The map is whole, and the X is waiting.' : `${commissionOf(state).villain} is still at large.`}`],
  choices: [{ label: 'Ride on', action: { type: 'close' } }, { label: 'Start a new campaign', action: { type: 'restart' } }],
});

/** A save from a lost commission: try it again, or begin a new campaign. */
export const failedCard = (state: GameState): Card => ({
  title: 'The commission failed',
  lines: [commissionOf(state).timeout],
  choices: [{ label: 'Try this commission again', action: { type: 'retry' } }, { label: 'Start a new campaign', action: { type: 'restart' } }],
});

/** After a commission ends, if its card was put away: what comes next. */
export function endCard(state: GameState): Card {
  if (state.over === 'lost') return failedCard(state);
  if (hasNextCommission(state)) return { title: 'The bounty is paid!', lines: [`${commissionOf(state).villain} is on the way to the King.`], choices: [{ label: 'Ride to the King\u2019s court', action: { type: 'court' } }] };
  return { title: 'The campaign is won!', lines: campaignLines(state).slice(1), choices: [{ label: 'Start a new campaign', action: { type: 'restart' } }] };
}
