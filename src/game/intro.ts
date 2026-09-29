import { BACKGROUNDS, type BackgroundId } from '../content/backgrounds';
import { COMMISSIONS } from '../content/campaign';
import { SPELLS } from '../content/spells';
import { troops } from '../content/troops';
import { ARTIFACTS, type ArtifactId } from '../content/artifacts';
import { PERKS, RANKS, SKILLS } from '../content/skills';
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

/** Aldric's army, spells and signature. `briefed` means the King has already told him who to catch. */
export function storyCard(background: BackgroundId, briefed = false): Card {
  const b = BACKGROUNDS[background];
  return {
    title: briefed ? b.title : 'The King\u2019s Commission',
    portrait: background,
    lines: [
      ...(briefed ? [] : [`${b.title}: ${COMMISSIONS[0].brief.join(' ')}`]),
      `You ride out with ${b.army.map((s) => troops(s.troop, s.count)).join(' and ')}${b.spells.length ? `, and ${b.spells.map((s) => SPELLS[s].name).join(', ')} in your spellbook` : ''}.`,
      `**${b.signature.name}.** ${b.signature.note}`,
    ],
    choices: [{ label: 'Ride out', action: { type: 'close' } }],
    wide: true,
  };
}

export const botRideCard = (chapter: number, target: number): Card => ({
  title: 'The bot is riding ahead',
  lines: [`He is riding Commission ${roman(chapter + 1)} for you. Then you take the reins in Commission ${roman(target)}.`],
  choices: [],
  wide: true,
});

export function chapterStartCard(state: GameState): Card {
  const hero = state.hero;
  const skills = Object.entries(hero.skills).filter((entry): entry is [keyof typeof hero.skills, number] => Boolean(entry[1]))
    .map(([id, rank]) => `${SKILLS[id].name} (${RANKS[rank - 1]})`);
  const perks = hero.perks.map((id) => PERKS[id].name);
  const spells = hero.spells.map((id) => SPELLS[id].name);
  const worn = Object.values(hero.gear).filter((id): id is ArtifactId => Boolean(id)).map((id) => ARTIFACTS[id].name);
  const pack = hero.pack.map((id) => ARTIFACTS[id].name);
  const army = state.army.map((stack) => troops(stack.troop, stack.count));
  const flags = Object.entries(state.flags ?? {}).map(([flag, value]) => `${flag}: ${value}`);
  return {
    title: `Commission ${roman(state.campaign.chapter + 1)}: your turn`,
    lines: [
      `The bot rode ${state.campaign.record.length} earlier commission${state.campaign.record.length === 1 ? '' : 's'} and took the King\u2019s court boons. Now the reins are yours.`,
      `Level ${hero.level}. Attack ${hero.attack}, defence ${hero.defence}, spell power ${hero.spellPower}, knowledge ${hero.knowledge}. Leadership ${state.leadership}.`,
      `Skills: ${skills.join(', ') || 'none'}. Perks: ${perks.join(', ') || 'none'}.`,
      `Spellbook: ${spells.join(', ') || 'empty'}.`,
      `Wearing: ${worn.join(', ') || 'nothing'}. Pack: ${pack.join(', ') || 'empty'}.`,
      `Army: ${army.join(', ') || 'none'}.`,
      `Gold: ${state.gold.toLocaleString('en-GB')}. Map pieces: ${state.campaign.record.length} of 5.`,
      `Story flags: ${flags.join(', ') || 'none in this chapter yet'}.`,
    ],
    choices: [{ label: 'Ride out', action: { type: 'close' } }],
    wide: true,
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

/** Every key, on one card: press ? on the map. */
export function keysCard(): Card {
  return {
    title: 'Keys',
    wide: true,
    lines: [
      '**On cards.** **Enter** or **Space** presses a card\u2019s only button, the number keys press the first, second or third, and **Esc** puts it away.',
      '**On the map.** Click to ride: rest the pointer on the ground first to see how many days it is. Hold **Shift** to gallop, and **Esc** (or a click on him) stops. Click anything to look at it, and click it again to go there; a right-click only looks. Drag, scroll, the arrows or **WASD** look around, and **Space** brings the view back to him. **E** ends the day, **H** opens the hero and his army, **M** turns the sound off.',
      '**In battle.** Click a hex to move, or an enemy to attack. **S** opens the spellbook, **W** waits, **D** defends, **A** hands over to the sergeants, and **R** retreats.',
      '**On the hero screen.** Drag an artifact or a stack where you want it, or click it, then click where it goes. A double-click wears an artifact or takes it off. The arrows move between squares, **Enter** picks up and puts down, **Shift** and an arrow moves what\u2019s there, and **Delete** dismisses a stack. **H** or **Esc** closes it.',
    ],
    choices: [{ label: 'Close', action: { type: 'close' } }],
  };
}
