/**
 * The game as it's shared (#146): how many commissions are open to play, who the King lets slip is
 * next, and where to follow for the rest and say what you thought. After the last open commission
 * the court says more are coming (`closingCard` in `rules/campaign.ts`) instead of reading the next
 * one out. The debug routes still ride on past it: `?commission=` and `?chapter=`, and `?court=`
 * after a later commission. To open another commission, raise `open` and have the King tease the
 * one after it.
 */
export const LAUNCH = {
  open: 1,
  next: '\u201cThere is one more thing, Aldric,\u201d says the King. \u201cA bandit called Black Hollis is robbing my roads in the Fenmarch, and he calls himself the Bandit King. He burnt down Tuttle Mill, and he has held my tax collector to ransom. Twice. I will send for you when your next commission is ready.\u201d',
  /** Artur's LinkedIn: follow him for the next commissions, and tell him what you thought. */
  follow: 'https://www.linkedin.com/in/arturzielinski/',
};
