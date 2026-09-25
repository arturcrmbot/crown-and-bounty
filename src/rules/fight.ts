import { again, armyPower, close, coins, locationById, LOSS_ORDER, roll, roman, show, TROOPS, update, VANISHES, type Army, type GameEvent, type GameState, type Result } from './state';

/** Removes `amount` of fighting power from the army, weakest troops first. */
function takeLosses(army: Army, amount: number): { army: Army; lost: string[] } {
  const next = { ...army };
  const lost: string[] = [];
  let left = amount;
  for (const troop of LOSS_ORDER) {
    if (left <= 0) break;
    const dead = Math.min(next[troop], Math.ceil(left / TROOPS[troop].power));
    if (dead <= 0) continue;
    next[troop] -= dead;
    left -= dead * TROOPS[troop].power;
    lost.push(`**${dead} ${TROOPS[troop].name}**`);
  }
  return { army: next, lost };
}

/** Auto-resolved for now: power against power, with a little luck either way. */
export function fight(state: GameState, id: string): Result {
  const place = locationById(state, id);
  const enemy = place.enemy!;
  const [luck, seed] = roll(state.seed);
  const ours = armyPower(state.army) * (0.85 + luck * 0.3);
  if (ours > enemy.power) {
    const { army, lost } = takeLosses(state.army, enemy.power * (enemy.power / ours) * 0.45);
    const lostLine = lost.length ? `You lost ${lost.join(' and ')}.` : 'Nobody on your side so much as stubbed a toe.';
    let next: GameState = update({ ...state, seed, army, gold: state.gold + enemy.reward }, id, { done: true });
    const events: GameEvent[] = VANISHES.has(place.kind) ? [{ type: 'removed', id }] : [];
    if (place.kind === 'hideout') {
      next = { ...next, bounty: 'paid', over: 'won' };
      events.push({ type: 'over', result: 'won' });
      events.push(
        show(
          {
            title: 'The bounty is paid!',
            lines: ['Baron Grimsby surrenders, still clutching the goose.', lostLine, `The Crown pays **${coins(enemy.reward)} gold**. The royal goose is going home.`, `*Commission complete on day ${roman(next.day)}.*`],
            choices: [again, close],
          },
          place.at,
        ),
      );
      return { state: next, events };
    }
    events.push(show({ title: 'Victory!', lines: [enemy.flees, lostLine, enemy.loot.replace('{gold}', `**${coins(enemy.reward)} gold**`)], choices: [close] }, place.at));
    return { state: next, events };
  }
  const { army, lost } = takeLosses(state.army, armyPower(state.army) * 0.25);
  return {
    state: { ...state, seed, army, movement: 0 },
    events: [show({ title: 'Retreat!', lines: ['Your men fall back in good order, mostly.', lost.length ? `You lost ${lost.join(' and ')}.` : '', 'Recruit more troops and try again.'].filter(Boolean), choices: [close] }, place.at)],
  };
}
