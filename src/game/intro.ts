import { BACKGROUNDS, type BackgroundId } from '../content/backgrounds';
import { COMMISSIONS } from '../content/campaign';
import { SPELLS } from '../content/spells';
import { troops } from '../content/troops';
import { campaignLines, commissionOf, hasNextCommission, roman, type Card, type GameState } from '../rules/game';

/** The title screen's menu: carry on with a save, or begin again. */
export function titleCard(resume: GameState | null): Card {
  const onward = resume && { label: 'Continue', detail: `Day ${roman(resume.day)} of Commission ${roman(resume.campaign.chapter + 1)}${resume.over === 'lost' ? ', lost' : ''}`, action: { type: 'close' as const } };
  return {
    title: '',
    lines: ['*Five villains, one lost sceptre, and a stolen goose.*'],
    choices: [...(onward ? [onward] : []), { label: 'New campaign', detail: resume ? 'Replaces your save once you ride out.' : 'The King is waiting.', action: { type: 'restart' } }],
  };
}

/** King Osric, from his throne, before anything else. */
export const kingCard = (): Card => ({
  title: 'King Osric',
  portrait: 'king',
  lines: [
    '"Aldric! Come in, come in. The realm is in a shocking state."',
    '"Five villains have carved up my provinces. The Sceptre of Order has been lost since my father\u2019s day. And my goose has been stolen."',
    '"I need an officer who can raise an army, pay it, and point it at people. You\u2019ll do."',
  ],
  choices: [{ label: 'At your service, Majesty.', action: { type: 'close' } }],
});

/** The first villain, on a poster the King's clerk has had printed. */
export const wantedCard = (): Card => {
  const first = COMMISSIONS[0];
  return {
    title: 'WANTED',
    portrait: 'grimsby',
    poster: true,
    lines: [`**${first.villain}** of Aldmoor`, 'for three years of unpaid taxes, one goose (royal), and general baronial behaviour.', `Reward: **${first.reward.toLocaleString('en-GB')} gold**, alive. The goose also alive, please.`],
    choices: [{ label: 'I\u2019ll bring him in.', action: { type: 'close' } }],
  };
};

/** Who Aldric was before the King found him: four faces, and how each one wins. */
export function backgroundCard(): Card {
  return {
    title: 'Who were you, before the King found you?',
    lines: ['Each plays differently. Choose how you like to win.'],
    choices: Object.values(BACKGROUNDS).map((b) => ({ label: b.name, detail: b.playstyle, portrait: b.id, action: { type: 'background', id: b.id } })),
    tiles: true,
  };
}

/** Aldric's army and spells, and how to play. `briefed` means the King has already told him who to catch. */
export function storyCard(background: BackgroundId, briefed = false): Card {
  const b = BACKGROUNDS[background];
  return {
    title: briefed ? b.title : 'The King\u2019s Commission',
    portrait: background,
    lines: [
      ...(briefed ? [] : [`${b.title}: ${COMMISSIONS[0].brief.join(' ')}`]),
      `You ride out with ${b.army.map((s) => troops(s.troop, s.count)).join(' and ')}${b.spells.length ? `, and ${b.spells.map((s) => SPELLS[s].name).join(', ')} in your spellbook` : ''}.`,
      'Click the map to ride, and click anything that looks interesting. Red marks on your route are for tomorrow.',
      `The hourglass (or **E**) ends the day. Every seventh day is payday. Click ${b.short} to see what he has learned. **M** turns the sound off.`,
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
