import { BACKGROUNDS, type BackgroundId } from '../content/backgrounds';
import { SPELLS } from '../content/spells';
import { troops } from '../content/troops';
import { roman, type Card } from '../rules/game';

/** The very first card: who Aldric was before the King found him. */
export function backgroundCard(): Card {
  const all = Object.values(BACKGROUNDS);
  return {
    title: 'Who were you, before the King found you?',
    lines: all.map((b) => `**${b.name}.** ${b.pitch} *${b.signature.name}: ${b.signature.note}*`),
    choices: all.map((b) => ({ label: b.name, action: { type: 'background', id: b.id } })),
  };
}

export function storyCard(background: BackgroundId): Card {
  const b = BACKGROUNDS[background];
  return {
    title: 'The King\u2019s Commission',
    lines: [
      `${b.title}: Baron Grimsby owes the Crown three years of taxes and one goose. Bring him in.`,
      `You ride out with ${b.army.map((s) => troops(s.troop, s.count)).join(' and ')}${b.spells.length ? `, and ${b.spells.map((s) => SPELLS[s].name).join(', ')} in your spellbook` : ''}.`,
      'Click the map to ride, and click anything that looks interesting. Red marks on your route are for tomorrow.',
      `The hourglass (or **E**) ends the day. Every seventh day is payday. Click ${b.short} to see what he has learned.`,
    ],
    choices: [{ label: 'Ride out', action: { type: 'close' } }],
  };
}

export const welcomeBackCard = (day: number): Card => ({
  title: 'Welcome back',
  lines: [`Day ${roman(day)} of your commission. Baron Grimsby is still at large.`],
  choices: [{ label: 'Ride on', action: { type: 'close' } }, { label: 'Start a new commission', action: { type: 'restart' } }],
});
