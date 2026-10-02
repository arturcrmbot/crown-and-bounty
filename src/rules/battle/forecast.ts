import { SPELLS, STATUSES } from '../../content/spells';
import { TROOPS } from '../../content/troops';
import { coins, listed } from '../state';
import { activeFighter, battleAct, bribeOffer, canJoin, fighterById, isLeader, type BattleAction, type BattleState, type Fighter, type Side } from './battle';

/** One stack's share of what an action would do: the damage it takes, and how many of it perish. */
export type Blow = { fighter: number; damage: number; killed: number };

/**
 * What an action would most likely do, as the rules themselves reckon it (`battleAct` with
 * `expected`): no dice are thrown, and luck is spread over the average. The player sees it before he
 * clicks, in the tag by the pointer and on the ribbon.
 */
export type Forecast = {
  /** The blow, shot or spell on the stack aimed at, and how many it has now. A heal gives health back instead. */
  target: Blow & { count: number; healed?: number; raised?: number };
  /** What the stack that acts takes for it: a first strike before its blow lands, or the blow struck back after. */
  first?: Blow;
  back?: Blow;
  /** Every other stack a spell catches. */
  caught: (Blow & { side: Side })[];
  /** A charge: nobody strikes back at it, and it winds the chargers. */
  charge: boolean;
};

/** What `action` would do, for a blow, a shot or a spell aimed at a stack: null for anything else, or anything the rules wouldn't allow. */
export function forecastOf(b: BattleState, action: BattleAction): Forecast | null {
  const f = activeFighter(b);
  if (!f || (action.type !== 'melee' && action.type !== 'shoot' && action.type !== 'cast') || action.target === undefined) return null;
  const { events } = battleAct(b, action, true);
  if (!events.length) return null;
  const aimed = fighterById(b, action.target);
  const forecast: Forecast = { target: { fighter: aimed.id, damage: 0, killed: 0, count: aimed.count }, caught: [], charge: false };
  for (const e of events) {
    if (e.type === 'hit' && e.attacker === f.id && e.target === aimed.id) {
      forecast.target = { ...forecast.target, damage: e.damage, killed: e.killed };
      forecast.charge = Boolean(e.charge);
    } else if (e.type === 'hit' && e.attacker === aimed.id && e.target === f.id) forecast[e.retaliation ? 'back' : 'first'] = { fighter: f.id, damage: e.damage, killed: e.killed };
    else if (e.type === 'spell' && e.target === aimed.id) forecast.target = { ...forecast.target, damage: e.damage, killed: e.killed, ...(e.healed !== undefined ? { healed: e.healed, raised: e.raised ?? 0 } : {}) };
    else if (e.type === 'spell') forecast.caught.push({ fighter: e.target, damage: e.damage, killed: e.killed, side: fighterById(b, e.target).side });
  }
  return forecast;
}

/** A line of the tag by the pointer. `danger` marks what it costs your own men. */
export type TagLine = { text: string; danger?: boolean };
/** What a click would do, in a few short sentences for the tag by the pointer: what, to whom, and at what cost. */
export type AimTag = { title: string; lines: TagLine[] };

/** "their wolves", "your archers". */
const whose = (f: Fighter) => `${f.side === 'player' ? 'your' : 'their'} ${TROOPS[f.troop].name.toLowerCase()}`;

/** "kills 3 of the 12", "kills all 12", "kills none of the 12", and for a stack of one, "kills the swordsman". */
function kills(killed: number, count: number, aimed: Fighter) {
  const one = `the ${TROOPS[aimed.troop].one.toLowerCase()}`;
  if (count === 1) return killed ? `kills ${one}` : `doesn\u2019t kill ${one}`;
  if (killed >= count) return `kills all ${count}`;
  return killed ? `kills ${killed} of the ${count}` : `kills none of the ${count}`;
}

/** What their answer costs the stack that acts: "They strike back and kill 2 of your knights." */
function answer(verb: 'strike first' | 'strike back', blow: Blow, mine: Fighter): TagLine {
  const yours = `your ${TROOPS[mine.troop].name.toLowerCase()}`;
  if (!blow.killed) return { text: `They ${verb} but kill none of ${yours}.` };
  const dead = blow.killed < mine.count ? `${blow.killed} of ${yours}` : mine.count === 1 ? `your last ${TROOPS[mine.troop].one.toLowerCase()}` : `all ${mine.count} of ${yours}`;
  return { text: `They ${verb} and kill ${dead}.`, danger: true };
}

/** Why a stack that lives through a blow won't answer it, if it won't. */
function noAnswer(f: Fighter, aimed: Fighter, forecast: Forecast): TagLine | null {
  if (forecast.target.killed >= aimed.count) return null;
  if (isLeader(f)) return { text: `Nobody can strike back at ${TROOPS[f.troop].name}.` };
  if (forecast.charge) return { text: 'Nobody can strike back at a charge.' };
  if (aimed.retaliated) return { text: 'They have already struck back this round.' };
  const status = aimed.status.map((s) => STATUSES[s]).find((s) => s.noStrikeBack);
  if (status) return { text: status.look ? `${status.name} can\u2019t strike back.` : `They are ${status.name.toLowerCase()}, so they can\u2019t strike back.` };
  return null;
}

/** The tag for a blow, a shot or a spell aimed at a stack: null for anything else. */
export function aimTag(b: BattleState, action: BattleAction): AimTag | null {
  const f = activeFighter(b);
  const forecast = forecastOf(b, action);
  if (!f || !forecast || (action.type !== 'melee' && action.type !== 'shoot' && action.type !== 'cast')) return null;
  const aimed = fighterById(b, forecast.target.fighter);
  const { damage, killed, count } = forecast.target;
  if (action.type === 'cast') {
    const spell = SPELLS[action.spell];
    const title = `Cast ${spell.name} on ${whose(aimed)}`;
    const effect = spell.effect;
    if (effect.kind === 'status') {
      const status = STATUSES[effect.status];
      const already = aimed.status.includes(effect.status) && !status.rounds;
      return { title, lines: [{ text: already ? (/ed$/.test(status.name) ? `They are already ${status.name.toLowerCase()}.` : `They already have ${status.name}.`) : spell.note }] };
    }
    if (effect.kind === 'heal') {
      const { healed = 0, raised = 0 } = forecast.target;
      return { title, lines: [{ text: healed ? `They get ${healed} health back${raised ? `, and ${raised} ${raised === 1 ? 'gets' : 'get'} up again` : ''}.` : 'They have all their health already.' }] };
    }
    const lines: TagLine[] = [{ text: `${damage} damage ${kills(killed, count, aimed)}.` }];
    const theirs = forecast.caught.filter((c) => c.side !== f.side);
    const ours = forecast.caught.filter((c) => c.side === f.side);
    const dead = (blows: Blow[]) => blows.reduce((n, c) => n + c.killed, 0);
    if (theirs.length) {
      const who = theirs.length === 1 ? whose(fighterById(b, theirs[0].fighter)) : `${theirs.length} more of their stacks`;
      lines.push({ text: `It also hits ${who}${dead(theirs) ? ` and kills ${dead(theirs)}` : ''}.` });
    }
    if (ours.length) {
      const names = ours.map((c) => TROOPS[fighterById(b, c.fighter).troop].name.toLowerCase());
      lines.push({ text: `It hits your own ${listed(names)} too${dead(ours) ? `, and kills ${dead(ours)}` : ''}.`, danger: true });
    }
    return { title, lines };
  }
  const ranged = action.type === 'shoot';
  const title = ranged ? `Shoot ${whose(aimed)}` : forecast.charge ? `Charge ${whose(aimed)}!` : `Attack ${whose(aimed)}`;
  const lines: TagLine[] = [{ text: `About ${damage} damage ${kills(killed, count, aimed)}.` }];
  if (forecast.first) lines.push(answer('strike first', forecast.first, f));
  if (!ranged) {
    const back = forecast.back ? answer('strike back', forecast.back, f) : noAnswer(f, aimed, forecast);
    if (back) lines.push(back);
    if (forecast.charge && !isLeader(f)) lines.push({ text: `The charge winds your ${TROOPS[f.troop].name.toLowerCase()}.` });
  }
  return { title, lines };
}

/** A bard's tag over one of their stacks: what paying them off would cost, before the card asks. */
export function bardTag(b: BattleState, target: Fighter): AimTag | null {
  const f = activeFighter(b);
  if (!f) return null;
  const leave = bribeOffer(b, f, target);
  const join = bribeOffer(b, f, target, true);
  const title = `Pay or jeer ${whose(target)}`;
  if (!leave) return { title, lines: [{ text: 'They take no gold, but you can jeer them.' }] };
  if (!leave.count) return { title, lines: [{ text: 'They take no gold from an army no stronger than theirs, but you can jeer them.' }] };
  const them = leave.count < target.count ? `${leave.count} of them` : 'them';
  return {
    title,
    lines: [
      { text: `${coins(leave.price)} gold sends ${them} home.` },
      ...(join?.count && canJoin(b, target, join.count) ? [{ text: `${coins(join.price)} gold wins ${them} over to your side.` }] : []),
      { text: 'Or you can jeer them, and they lose heart.' },
    ],
  };
}
