import { needsTarget, SPELLS, STATUSES, type SpellId, type StatusDef } from '../content/spells';
import { TROOPS, troops } from '../content/troops';
import { chooseAction, finishEstimate } from '../rules/battle/ai';
import { manaInBattle } from '../rules/heroSheet';
import { coins } from '../rules/state';
import { activeFighter, bardOf, battleAct, battleEnd, bribePrice, canCast, canJoin, casterOf, castsLeft, chargeOf, CHARGE_BONUS, fighterById, isCharge, isLeader, onField, options, ridesOut, spellCost, spellDamage, spellsOf, spellVictims, strike, unitOf, wound, type BattleAction, type BattleEvent, type BattleState } from '../rules/battle/battle';
import { paintBanner } from '../render/banner';
import { BattleScreen, BUTTONS, FIRE_FALL, FLOAT_RISE, hexAt, hexCentre, leaderAt, LOG_BOTTOM, spotOf, type BattleView, type Shot } from '../render/battleScreen';
import { animLength, bodyHeight, hitTime, STAND, type AnimName } from '../render/battleSprites';
import { ART } from '../render/units';
import { MAP_VIEW } from '../render/frame';
import { BLUE, GOLD, NEUTRAL, RED } from '../render/palette';
import { CardView } from '../ui/card';
import { play } from '../ui/sound';
import type { Display } from './display';
import type { Screen } from './screen';

type Step = { duration: number; elapsed: number; started: boolean; start?: () => void; tick?: (t: number) => void; end?: () => void };
/** What is left of each stack as an action's events play out: its count, and its top troop's health. */
type Left = Map<number, { count: number; hp: number }>;

const ENEMY_THINK = 0.35;
/** Floaters start at least this low, so they rise and fade under the message ribbon, never into it. */
const FLOAT_TOP = LOG_BOTTOM + FLOAT_RISE + 2;
/** Wesnoth's animation milliseconds as our seconds: its own timing, a touch brisker. */
const MS = 0.00085;
/** Wesnoth's flinch starts a little before the blow lands. */
const FLINCH_EARLY = 126;
/** Wesnoth pulses a unit red twice when it is hit: on for each of these stretches of the first 300 ms. */
const pulse = (k: number) => (k > 0.05 && k < 0.35) || (k > 0.55 && k < 0.85);
/** What a bard shouts at a stack he jeers. */
const JEERS = ['Call that a sword?', 'Boo! Hiss!', 'Go home to mother!', 'Nice hat!', 'Is that all?', 'My goose fights better!'];
/** A share as a whole percentage: "25%". */
const pct = (x: number) => `${Math.round(Math.abs(x) * 100)}%`;
/** What a song or a jeer does to spirits, in words: "+25% morale", "−30% morale", "+20% luck". */
const spirits = (s: StatusDef) => [s.morale ? `${s.morale > 0 ? '+' : '\u2212'}${pct(s.morale)} morale` : '', s.luck ? `+${pct(s.luck)} luck` : ''].filter(Boolean).join(', ');

/**
 * A battle on screen. The rules decide everything; this plays each event as a little animation,
 * lets the player point and click on their stacks' turns, and runs the AI on the enemy's.
 */
export class BattleController implements Screen {
  readonly name = 'battle';
  readonly music = 'battle' as const;
  readonly ambience = null;
  battle: BattleState;
  private readonly screen: BattleScreen;
  private readonly view: BattleView;
  private readonly queue: Step[] = [];
  private readonly cards: CardView;
  private readonly display: Display;
  private readonly hooks: { onChange: (b: BattleState) => void; onDone: (b: BattleState) => void };
  private readonly pace: number;
  private auto = false;
  private finishState: BattleState | null = null;
  private finishLine: string | null = null;
  private sparks: Shot[] = [];
  private think = 0;
  private finished = false;
  /** The stack whose move is playing out: it keeps the gold hex until its blows have landed. */
  private acting: number | null = null;
  private pointer: [number, number] | null = null;

  constructor(display: Display, battle: BattleState, hooks: BattleController['hooks'], pace = 1) {
    this.display = display;
    this.battle = battle;
    this.hooks = hooks;
    this.pace = pace;
    this.screen = new BattleScreen(battle);
    this.cards = new CardView((action) => {
      this.cards.hide();
      // A spell aimed at a stack waits for its target; one that takes the whole field goes at once.
      if (action.type === 'spell' && needsTarget(action.spell)) this.view.targeting = action.spell;
      else if (action.type === 'spell') this.perform({ type: 'cast', spell: action.spell });
      else if (action.type === 'retreat') this.perform({ type: 'retreat' });
      else if (action.type === 'bard') this.perform(action.move === 'jeer' ? { type: 'jeer', target: action.target } : { type: 'bribe', target: action.target, join: action.move === 'buy' });
      else if (action.type === 'sing') this.perform({ type: 'sing', song: action.song });
    });
    this.view = {
      positions: new Map(),
      offsets: new Map(),
      facings: new Map(),
      counts: new Map(),
      health: new Map(),
      poses: new Map(),
      flashing: new Set(),
      dying: new Set(),
      hidden: new Set(),
      looks: new Map(),
      reach: new Set(),
      hover: null,
      floaters: [],
      shots: [],
      log: this.startLine(),
      active: activeFighter(battle)?.id ?? null,
      inspect: null,
      preview: null,
      targeting: null,
      bard: false,
      time: 0,
      shake: 0,
      banner: null,
      finishOffer: false,
    };
    // What the hero brought to the field is said as the battle opens: "Advanced Archery: the Wolves start slowed."
    const opening = battle.round === 1 && !battle.struck ? (battle.opening ?? []) : [];
    for (const o of opening) {
      this.step(1.2, {
        start: () => {
          this.view.log = this.openingLine(o);
          for (const id of o.fighters) this.float(id, STATUSES[o.status].name, GOLD[6]);
        },
      });
    }
    if (opening.length) this.step(0.01, { start: () => (this.view.log = this.startLine()) });
  }

  /** The first words on the ribbon: what the first of your fighters to act can do. */
  private startLine() {
    const first = activeFighter(this.battle);
    return (first && this.turnLine(first.id)) ?? 'To battle! Click a hex to move, or an enemy to attack.';
  }

  /** What one of your leaders can do as his turn comes: he never walks the field. */
  private turnLine(id: number): string | null {
    const f = fighterById(this.battle, id);
    if (f.side !== 'player' || !isLeader(f)) return null;
    if (bardOf(f)) return `${this.fighterName(id)}: click one of their stacks to pay or jeer it, or press Sing. Or Wait.`;
    return `${this.fighterName(id)} ${ridesOut(f) ? 'can ride out at any stack in reach, strike, and ride back' : 'can shoot any stack from behind the line'}. Or Wait.`;
  }

  /**
   * A bard's flourish as he makes his move, and `start` as it begins (the words, the sound): his
   * fidget (a bow, hat off) or his casting frames, the first moments of them.
   */
  private flourish(id: number, anim: 'idle' | 'cast', start: () => void) {
    const f = fighterById(this.battle, id);
    const length = ART[f.troop][anim] ? Math.min(700, animLength(f.troop, anim)) : 0;
    this.step(Math.max(0.3, length * MS), {
      start,
      tick: (t) => length && this.view.poses.set(id, { anim, ms: Math.min(length, (t * Math.max(0.3, length * MS)) / MS) }),
      end: () => this.view.poses.delete(id),
    });
  }

  /** The forecast for a bard's moves on one of their stacks: what paying them off would cost, and what a jeer does. */
  private bardLine(id: number) {
    const f = activeFighter(this.battle)!;
    const target = fighterById(this.battle, id);
    const leave = bribePrice(this.battle, f, target);
    const join = bribePrice(this.battle, f, target, true);
    const jeer = `or jeer them (${spirits(STATUSES[bardOf(f)!.jeer])})`;
    if (leave === null) return `${this.fighterName(id)} take no gold: ${jeer.slice(3)}.`;
    return `${this.fighterName(id)}: ${coins(leave)} gold to go home${join !== null && canJoin(this.battle, target) ? `, ${coins(join)} to join you` : ''}; ${jeer}.`;
  }

  /** A bard's moves on one of their stacks, each with its price or what it does, before he makes it. */
  private bardCard(id: number) {
    const f = activeFighter(this.battle)!;
    const art = bardOf(f)!;
    const target = fighterById(this.battle, id);
    const gold = this.battle.hero.gold ?? 0;
    const leave = bribePrice(this.battle, f, target);
    const join = bribePrice(this.battle, f, target, true);
    const room = canJoin(this.battle, target);
    const off = this.battle.hero.bribes ? `, less ${pct(this.battle.hero.bribes)}` : '';
    const jeer = STATUSES[art.jeer];
    const lines =
      leave === null || join === null
        ? [`*${TROOPS[target.troop].name} take no gold.*`]
        : [
            `Pay them **${coins(leave)} gold** (${art.weeks.leave} weeks\u2019 wages${off}), and they go home.`,
            room ? `Pay them **${coins(join)} gold** (${art.weeks.join} weeks\u2019 wages${off}), and they fight for you, and ride on with you after.` : '*You have no room under your banner for them to come over.*',
            `You carry **${coins(gold)} gold**.`,
          ];
    lines.push(`Jeer them, and they lose heart: ${spirits(jeer)} for ${jeer.rounds} rounds, a chance they lose their turn.`);
    this.cards.show({
      title: this.fighterName(id, target.count),
      lines,
      choices: [
        ...(leave === null ? [] : [{ label: `Pay them to go (${coins(leave)} gold)`, action: { type: 'bard' as const, move: 'bribe' as const, target: id }, disabled: leave > gold }]),
        ...(join === null || !room ? [] : [{ label: `Pay them to join you (${coins(join)} gold)`, action: { type: 'bard' as const, move: 'buy' as const, target: id }, disabled: join > gold }]),
        { label: 'Jeer them', action: { type: 'bard', move: 'jeer', target: id } },
        { label: 'Close', action: { type: 'close' } },
      ],
    });
  }

  /** A bard's songs, and what each does for every stack of yours, before he sings. */
  private songCard() {
    const art = bardOf(activeFighter(this.battle)!)!;
    this.cards.show({
      title: 'Sing',
      lines: art.songs.map((id) => {
        const s = STATUSES[id];
        const what = s.luck ? 'a chance each blow lands twice as hard' : 'a chance each stack goes again before the round moves on';
        return `**${s.song![0].toUpperCase()}${s.song!.slice(1)}**: ${spirits(s)} for every stack of yours, for ${s.rounds} rounds: ${what}.`;
      }),
      choices: [...art.songs.map((id) => ({ label: `Sing ${STATUSES[id].song}`, action: { type: 'sing' as const, song: id } })), { label: 'Close', action: { type: 'close' } }],
    });
  }

  /** One thing the hero brought, and whom it touches, in words. */
  private openingLine(o: NonNullable<BattleState['opening']>[number]) {
    const names = o.fighters.map((id) => {
      const f = fighterById(this.battle, id);
      return this.named(id) ? TROOPS[f.troop].name : `${f.side === 'player' ? 'your' : 'the'} ${TROOPS[f.troop].name}`;
    });
    const who = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
    const status = STATUSES[o.status].name;
    const one = o.fighters.length === 1 && this.named(o.fighters[0]);
    // "start slowed", but "start with Stone Skin".
    return `${o.source}: ${who} ${one ? 'starts' : 'start'} ${/ed$/.test(status) ? status.toLowerCase() : `with ${status}`}.`;
  }

  dispose() {
    this.cards.dispose();
  }

  private fighterName(id: number, count?: number) {
    const f = fighterById(this.battle, id);
    if (this.named(id)) return TROOPS[f.troop].name;
    const who = f.side === 'player' ? 'Your' : 'Their';
    return count === undefined ? `${who} ${TROOPS[f.troop].name}` : `${who} ${troops(f.troop, count)}`;
  }

  /** One of a kind, like Mother Mirrow or Baron Grimsby, so "she shoots", not "their Mother Mirrow shoot". */
  private named(id: number) {
    const t = TROOPS[fighterById(this.battle, id).troop];
    return t.name === t.one;
  }

  /** "shoot" for a stack, "shoots" for a named foe. */
  private verb(id: number, phrase: string) {
    return this.named(id) ? phrase.replace(/^(\w+)/, '$1s') : phrase;
  }

  /** "their Trolls" mid-sentence, but "Mother Mirrow" keeps her capital. */
  private objectName(id: number) {
    return this.fighterName(id).replace(/^(Your|Their) /, (m) => m.toLowerCase());
  }

  /** Who casts from a book: Aldric (no `by`), or the villain. */
  private casterName(by?: number) {
    return by === undefined ? (this.battle.hero.name ?? 'Aldric') : this.fighterName(by);
  }

  private step(duration: number, parts: Omit<Step, 'duration' | 'elapsed' | 'started'>) {
    this.queue.push({ duration, elapsed: 0, started: false, ...parts });
  }

  /** Where a fighter stands on screen: his hex, or a leader's place behind the line. */
  private spot(id: number): [number, number] {
    return spotOf(this.battle, fighterById(this.battle, id));
  }

  /**
   * Words that rise from a stack and fade. Ones that come close together stack up instead of
   * overlapping, however long the words; near the top of the field, where there's no room above,
   * they stack down over the stack. `from` is where a leader who rode out is now.
   */
  private float(id: number, text: string, color: number, from?: [number, number]) {
    const f = fighterById(this.battle, id);
    // Over the stack's own hex, not wherever a blow has knocked it, so it never lands on the attacker.
    // Words over a leader at the edge of the field are nudged in, so none are cut off.
    const [spotX, y] = from ?? this.spot(id);
    const half = text.length * 4 + 4;
    const x = Math.min(Math.max(spotX, MAP_VIEW.x + half), MAP_VIEW.x + MAP_VIEW.width - half);
    const top = Math.max(FLOAT_TOP, y + 12 - bodyHeight(f.troop, 'battle') - 16);
    // Words are 8 px a letter and 16 px a line, and all rise together, so where they are now is where they stay apart.
    const clash = (at: number) => this.view.floaters.some((o) => Math.abs(o.x - x) < ((o.text.length + text.length) * 8) / 2 + 4 && Math.abs(o.y - o.age * FLOAT_RISE - at) < 16);
    const lines = [0, 1, 2, 3, 4, 5].map((k) => top - k * 16).filter((at) => at >= FLOAT_TOP);
    const at = [...lines, ...[1, 2, 3, 4, 5, 6].map((k) => top + k * 16)].find((a) => !clash(a)) ?? top;
    this.view.floaters.push({ x, y: at, text, color, age: 0 });
  }

  /** A burst where a blow lands, blood for the wounded, and a jolt that grows with the damage. */
  private impact(target: number, damage: number, heavy: boolean) {
    const f = fighterById(this.battle, target);
    const [x, y] = this.spot(target);
    const chest = y + 12 - Math.round(bodyHeight(f.troop, 'battle') * 0.5);
    for (const kind of ['spark', 'blood'] as const) {
      const shot = { from: [x, chest] as [number, number], to: [x, chest] as [number, number], t: 0, kind };
      this.view.shots.push(shot);
      this.sparks.push(shot);
    }
    this.view.shake = Math.max(this.view.shake, Math.min(8, (heavy ? 2 : 0.8) + damage / 40));
  }

  /**
   * A stack that goes down: it plays its death where Wesnoth drew one, and a puff of dust where it
   * didn't. Then its fallen stay on the field.
   */
  private fall(target: number) {
    const f = fighterById(this.battle, target);
    if (!ART[f.troop].death) return this.poof(target);
    const length = animLength(f.troop, 'death');
    this.step(length * MS, {
      start: () => this.view.facings.set(target, this.facingOf(f)),
      tick: (t) => this.view.poses.set(target, { anim: 'death', ms: t * length }),
      end: () => {
        this.view.poses.delete(target);
        this.view.facings.delete(target);
        this.view.dying.delete(target);
      },
    });
  }

  /**
   * A caster casts from behind his men: he raises his hands (in his casting frames, if Wesnoth drew
   * him any) and the magic gathers round him before it flies. An order is bellowed instead, for
   * all to hear. Nothing plays for a hero with no fighter of his own (a battle saved before he had one).
   */
  private cast(spell: SpellId, before: BattleState, by?: number) {
    const v = this.view;
    const caster = casterOf(before, by);
    if (!caster || caster.count <= 0) return;
    const [x, y] = this.spot(caster.id);
    const art = ART[caster.troop];
    const { look, shout } = SPELLS[spell];
    const hands: [number, number] = [x + 4 * this.facingOf(caster), y + 12 - bodyHeight(caster.troop, 'battle') * 0.5];
    const glow: Shot = { from: hands, to: hands, t: 0, kind: 'gather', color: look.colour === 'blue' ? BLUE[6] : look.colour === 'red' ? RED[5] : GOLD[6] };
    const frames = art.cast ? art.cast.reduce((t, f) => t + f.ms, 0) : 300;
    // An order takes long enough to be heard.
    const length = shout ? Math.max(frames, 900) : frames;
    this.step(length * MS, {
      start: () => {
        if (!shout) v.shots.push(glow);
        if (shout) {
          v.log = `${this.casterName(by)} ${shout.verb}: ${shout.words}`;
          this.float(caster.id, shout.words, GOLD[6]);
          play('charge');
        } else v.log = by === undefined ? `${this.casterName(by)} raises his hands...` : `${this.casterName(by)} mutters a spell...`;
      },
      tick: (t) => {
        glow.t = t;
        if (art.cast) v.poses.set(caster.id, { anim: 'cast', ms: Math.min(frames, t * length) });
      },
      end: () => {
        if (!shout) v.shots.splice(v.shots.indexOf(glow), 1);
        v.poses.delete(caster.id);
      },
    });
  }

  /** A stack called to the field marches in from its side's edge. */
  private marchIn(e: Extract<BattleEvent, { type: 'summon' }>) {
    const v = this.view;
    const f = fighterById(this.battle, e.fighter);
    const [x, y] = hexCentre(f.at);
    const edge = f.side === 'player' ? MAP_VIEW.x + 8 : MAP_VIEW.x + MAP_VIEW.width - 8;
    const frames = !!ART[f.troop].move;
    const length = 0.25 + Math.abs(edge - x) / 160;
    v.hidden.add(f.id);
    this.step(length, {
      start: () => {
        v.hidden.delete(f.id);
        v.facings.set(f.id, this.facingOf(f));
        play('march');
        v.log = `${this.fighterName(f.id, f.count)} march in from the edge of the field!`;
      },
      tick: (t) => {
        const hop = frames ? 0 : Math.abs(Math.sin(t * Math.PI * 4)) * 3;
        v.positions.set(f.id, [edge + (x - edge) * t, y - hop]);
        v.poses.set(f.id, frames ? { anim: 'move', ms: t * length * 1000 } : { anim: 'stand', ms: 0 });
      },
      end: () => {
        v.positions.delete(f.id);
        v.poses.delete(f.id);
        v.facings.delete(f.id);
        this.float(f.id, `+${f.count}`, f.side === 'player' ? GOLD[6] : RED[5]);
      },
    });
  }

  /** Which way a stack looks when nothing turns it: towards the enemy's side. */
  private facingOf(f: { side: string }): 1 | -1 {
    return f.side === 'player' ? 1 : -1;
  }

  /** A puff of smoke where a stack changes shape, over the next moment (it doesn't hold up the queue). */
  private puff(id: number) {
    const [x, y] = this.spot(id);
    const dust: Shot = { from: [x, y], to: [x, y], t: 0, kind: 'poof' };
    this.view.shots.push(dust);
    this.sparks.push(dust);
  }

  /** A stack that goes down leaves a puff of dust, then its fallen. */
  private poof(target: number) {
    const [x, y] = this.spot(target);
    const dust = { from: [x, y] as [number, number], to: [x, y] as [number, number], t: 0, kind: 'poof' as const };
    this.step(0.4, {
      start: () => {
        this.view.shots.push(dust);
        this.view.dying.delete(target);
      },
      tick: (t) => (dust.t = t),
      end: () => this.view.shots.splice(this.view.shots.indexOf(dust), 1),
    });
  }

  /** Gives health back to what is left of a stack, raising its fallen. */
  private mend(left: Left, id: number, healed: number) {
    const was = left.get(id)!;
    const full = unitOf(fighterById(this.battle, id)).hp;
    const total = Math.max(0, was.count - 1) * full + (was.count > 0 ? was.hp : 0) + healed;
    const count = Math.ceil(total / full);
    left.set(id, { count, hp: total - (count - 1) * full });
  }

  /** What the ribbon says as a spell lands. */
  private spellLine(e: Extract<BattleEvent, { type: 'spell' }>, stacks: number) {
    const spell = SPELLS[e.spell];
    const who = this.casterName(e.by);
    if (spell.effect.kind === 'mass') return `${who} casts ${spell.name} on ${stacks === 1 ? this.objectName(e.target) : `all ${stacks} of ${fighterById(this.battle, e.target).side === 'player' ? 'your' : 'their'} stacks`}.`;
    if (e.healed) return `${who} casts ${spell.name} on ${this.objectName(e.target)}: ${e.healed} health back${e.raised ? `, and ${e.raised} get up again` : ''}.`;
    return `${who} casts ${spell.name} on ${this.objectName(e.target)}${e.damage ? `: ${e.damage} damage${e.killed ? `, ${e.killed} perish` : ''}` : ''}.`;
  }

  /** Takes a blow from what is left of a stack (its count, and its top troop's health); true when that was the last of them. */
  private wound(left: Left, id: number, damage: number): boolean {
    const was = left.get(id)!;
    const w = wound({ ...fighterById(this.battle, id), count: was.count, hp: was.hp }, damage);
    left.set(id, { count: w.count, hp: w.hp });
    return was.count > 0 && w.count <= 0;
  }

  /**
   * One blow or shot, played as Wesnoth plays it. The attacker runs its attack frames (lunging in at
   * close quarters); at the frame where the blow lands, and not before, come the flash, the sound,
   * the numbers and the jolt; the target flinches, reels and pulses red twice. `from` is where a
   * leader who rode out strikes from.
   */
  private strike(e: Extract<BattleEvent, { type: 'hit' }>, left: { count: number; hp: number }, dies: boolean, from?: [number, number]) {
    const v = this.view;
    const attacker = fighterById(this.battle, e.attacker);
    const target = fighterById(this.battle, e.target);
    const [ax, ay] = from ?? this.spot(attacker.id);
    const [tx, ty] = this.spot(target.id);
    const len = Math.hypot(tx - ax, ty - ay) || 1;
    const [ux, uy] = [(tx - ax) / len, (ty - ay) / len];
    const art = ART[attacker.troop];
    const anim = e.ranged ? 'ranged' : e.charge && art.charge ? 'charge' : 'melee';
    const hit = hitTime(attacker.troop, anim);
    const total = Math.max(animLength(attacker.troop, anim), hit + 1);
    const after = Math.max(300, total - hit);
    // Lunge in: still at first, then hard to about half way at the blow, then back to its hex.
    const reach = e.ranged ? 0 : Math.min(30, len * 0.45);
    const lunge = (ms: number) => (ms < hit ? reach * Math.max(0, (ms - hit * 0.4) / (hit * 0.6)) ** 2 : reach * Math.max(0, 1 - (ms - hit) / after));
    const swing = (ms: number) => {
      v.poses.set(e.attacker, { anim, ms });
      v.offsets.set(e.attacker, [ux * lunge(ms), uy * lunge(ms)]);
    };
    const flinch = (): AnimName => (e.ranged ? 'defendRanged' : 'defend');
    const turn = () => {
      // Each turns to the other for the exchange, whichever side of it they stand.
      if (Math.abs(tx - ax) > 1) {
        v.facings.set(e.attacker, tx > ax ? 1 : -1);
        v.facings.set(e.target, tx > ax ? -1 : 1);
      }
    };
    const missile = e.ranged ? (art.ranged?.missile ?? 'arrow') : null;
    const release = missile ? Math.max(0, hit - 150) : hit;
    // The ribbon names the blow as it starts, and says what it did when it lands.
    const blow = `${this.fighterName(e.attacker)} ${this.verb(e.attacker, e.ranged ? 'shoot' : e.retaliation ? 'strike back at' : e.charge ? 'charge' : 'hit')} ${this.objectName(e.target)}`;
    this.step(release * MS, {
      start: () => {
        turn();
        v.log = `${blow}...`;
      },
      tick: (t) => {
        swing(t * release);
        if (!missile && t * release >= hit - FLINCH_EARLY) v.poses.set(e.target, { anim: flinch(), ms: 0 });
      },
    });
    if (missile) {
      // The release frame holds while the shot flies, however far.
      const shot: Shot = { from: [ax + ux * 12, ay - bodyHeight(attacker.troop, 'battle') * 0.55], to: [tx, ty + 12 - bodyHeight(target.troop, 'battle') * 0.5], t: 0, kind: missile };
      this.step(0.16 + len / 1500, {
        start: () => {
          v.shots.push(shot);
          play(missile === 'hex' || missile === 'magic' ? 'spell' : 'shoot');
        },
        tick: (t) => {
          shot.t = t;
          swing(release + (hit - release) * t);
          if (t > 0.8) v.poses.set(e.target, { anim: flinch(), ms: 0 });
        },
        end: () => v.shots.splice(v.shots.indexOf(shot), 1),
      });
    }
    const reel = (e.ranged ? 4 : 8) * (e.charge ? 1.6 : 1);
    this.step(after * MS, {
      start: () => {
        v.flashing.add(e.target);
        v.poses.set(e.target, { anim: flinch(), ms: 0 });
        v.counts.set(e.target, left.count);
        v.health.set(e.target, left.hp);
        if (!e.ranged) play('hit');
        this.impact(e.target, e.damage, !e.ranged);
        if (e.charge) {
          this.float(e.attacker, 'Charge!', GOLD[6], from);
          play('charge');
          v.shake = Math.max(v.shake, 6);
        }
        if (e.lucky) this.float(e.attacker, 'Lucky!', GOLD[5], from);
        this.float(e.target, e.killed ? `-${e.killed}` : `-${e.damage} hp`, e.killed ? RED[5] : RED[6]);
        const fell = !e.killed ? '.' : `. ${e.killed} perish.`;
        v.log = `${blow} for ${e.damage}${fell}${e.lucky ? ' A lucky blow!' : ''}${e.status ? ` ${STATUSES[e.status].onHit ?? ''}` : ''}`;
      },
      tick: (t) => {
        const ms = t * after;
        swing(hit + ms);
        v.flashing[pulse(ms / 300) ? 'add' : 'delete'](e.target);
        const k = Math.sin(Math.min(1, t * 1.8) * Math.PI) * (1 - t * 0.4);
        v.offsets.set(e.target, [ux * reel * k, uy * reel * k]);
      },
      end: () => {
        for (const map of [v.poses, v.offsets, v.facings]) map.delete(e.attacker);
        v.flashing.delete(e.target);
        v.offsets.delete(e.target);
        if (dies) return;
        v.poses.delete(e.target);
        v.facings.delete(e.target);
      },
    });
  }

  /** Does an action through the rules, then queues the animations for what happened. */
  perform(action: BattleAction): boolean {
    const before = this.battle;
    const { battle, events } = battleAct(before, action);
    if (events.length === 0) return false;
    // A villain's spell or order is his to show, whoever's turn it is.
    this.acting = action.type === 'volley' ? null : action.type === 'cast' && action.by !== undefined ? action.by : (activeFighter(before)?.id ?? null);
    this.battle = battle;
    this.finishState = null;
    this.finishLine = null;
    this.view.finishOffer = false;
    this.view.targeting = null;
    this.view.hover = null;
    this.hooks.onChange(battle);
    this.animate(events, before);
    return true;
  }

  private animate(events: BattleEvent[], before: BattleState) {
    const v = this.view;
    // Where a leader who rode out is, between his ride in and his ride back.
    const out = new Map<number, [number, number]>();
    // Who is left in each stack as the events play: a stack falls at the blow that kills it, and its
    // badge (or health bar) keeps what it showed before the action until each blow lands.
    const left: Left = new Map(this.battle.fighters.map((now) => {
      const f = before.fighters.find((o) => o.id === now.id) ?? now;
      return [f.id, { count: v.counts.get(f.id) ?? f.count, hp: v.health.get(f.id) ?? f.hp }];
    }));
    for (const e of events) {
      if (e.type !== 'hit' && e.type !== 'spell') continue;
      v.counts.set(e.target, left.get(e.target)!.count);
      v.health.set(e.target, left.get(e.target)!.hp);
    }
    for (const e of events) {
      switch (e.type) {
        case 'move':
        case 'back': {
          const f = fighterById(this.battle, e.fighter);
          const leader = isLeader(f);
          const back = e.type === 'back';
          // A stack walks from the hex it stood on (the rules already have it at the end of its path).
          // A leader rides in from his place behind the line, and after his blow rides back to it.
          const start = back ? hexCentre(e.path[0]) : leader ? this.spot(f.id) : hexCentre(fighterById(before, e.fighter).at);
          const path = back ? [...e.path.slice(1).map(hexCentre), this.spot(f.id)] : e.path.map(hexCentre);
          if (!back) v.positions.set(e.fighter, start);
          if (leader && !back) out.set(e.fighter, path[path.length - 1]);
          // Riders gallop and beasts lope, in their own frames; folk on foot hop from hex to hex.
          const frames = !!ART[f.troop].move;
          for (const [n, to] of path.entries()) {
            const a = n === 0 ? start : path[n - 1];
            // A hex a step for a stack; a leader gallops, however far his first and last stretches are.
            const length = leader ? Math.max(0.06, Math.hypot(to[0] - a[0], to[1] - a[1]) / 640) : 0.12;
            this.step(length, {
              start: () => {
                if (n === 0 && !back) v.log = `${this.fighterName(e.fighter)} ${this.verb(e.fighter, leader ? 'ride out' : 'advance')}...`;
                if (to[0] !== a[0]) v.facings.set(e.fighter, to[0] > a[0] ? 1 : -1);
              },
              tick: (t) => {
                const hop = frames ? 0 : Math.sin(t * Math.PI) * 4;
                v.positions.set(e.fighter, [a[0] + (to[0] - a[0]) * t, a[1] + (to[1] - a[1]) * t - hop]);
                v.poses.set(e.fighter, frames ? { anim: 'move', ms: (n + t) * 120 } : { anim: 'stand', ms: 0 });
              },
            });
          }
          // A leader who rode out stays where he got to until his blow lands, and rides back after it.
          if (leader && !back) break;
          if (back) out.delete(e.fighter);
          this.step(0.01, {
            end: () => {
              v.positions.delete(e.fighter);
              v.poses.delete(e.fighter);
              v.facings.delete(e.fighter);
            },
          });
          break;
        }
        case 'hit': {
          const dies = this.wound(left, e.target, e.damage);
          if (dies) v.dying.add(e.target);
          this.strike(e, { ...left.get(e.target)! }, dies, out.get(e.attacker));
          if (dies) this.fall(e.target);
          break;
        }
        case 'regen': {
          const healed = left.get(e.fighter)!;
          left.set(e.fighter, { count: healed.count, hp: healed.hp + e.healed });
          this.step(0.3, {
            start: () => {
              v.health.set(e.fighter, healed.hp + e.healed);
              this.float(e.fighter, `+${e.healed}`, GOLD[6]);
              v.log = `${this.fighterName(e.fighter)} ${this.verb(e.fighter, 'regenerate')}: the wounds close up.`;
            },
          });
          break;
        }
        case 'morale': {
          this.step(0.3, {
            start: () => {
              this.float(e.fighter, 'Morale!', GOLD[6]);
              v.log = `${this.fighterName(e.fighter)} ${this.verb(e.fighter, 'cheer')}: good spirits win them another turn.`;
            },
          });
          break;
        }
        case 'poison': {
          const hurt = left.get(e.fighter)!;
          left.set(e.fighter, { count: hurt.count, hp: hurt.hp - e.hurt });
          this.step(0.3, {
            start: () => {
              v.health.set(e.fighter, hurt.hp - e.hurt);
              this.float(e.fighter, `-${e.hurt}`, RED[6]);
              v.log = `${this.fighterName(e.fighter)} ${this.verb(e.fighter, 'wince')}: the poison bites deep.`;
            },
          });
          break;
        }
        case 'spell': {
          // Stacks caught in a burst beside the target take their damage with it, at the same moment;
          // a spell on a whole side lands on every stack of it together.
          if (e.splash) break;
          const from = events.indexOf(e) + 1;
          const stop = events.findIndex((n, k) => k >= from && !(n.type === 'spell' && n.splash));
          const caught = events.slice(from, stop < 0 ? events.length : stop).filter((n) => n.type === 'spell');
          const victims = [e, ...caught].map((h) => {
            const dies = this.wound(left, h.target, h.damage);
            if (dies) v.dying.add(h.target);
            if (h.healed) this.mend(left, h.target, h.healed);
            return { h, dies, remaining: { ...left.get(h.target)! }, ours: fighterById(this.battle, h.target).side === 'player' };
          });
          this.cast(e.spell, before, e.by);
          const spell = SPELLS[e.spell];
          const target = fighterById(this.battle, e.target);
          const look = spell.look;
          const colour = look.colour === 'blue' ? BLUE[6] : look.colour === 'red' ? RED[5] : GOLD[6];
          // One bolt or fireball at the target; a sparkle on each stack a spell on a whole side lands on.
          const struck = spell.effect.kind === 'mass' ? victims.map((x) => fighterById(this.battle, x.h.target)) : [target];
          const shots = struck.map((x) => {
            const [tx, ty] = hexCentre(x.at);
            return { from: [tx, 0] as [number, number], to: [tx, ty - 10] as [number, number], t: 0, kind: look.kind, color: colour };
          });
          const status = spell.effect.kind === 'status' || spell.effect.kind === 'mass' ? STATUSES[spell.effect.status] : null;
          // A stack turned into something else stays itself till the spell lands, then goes in a puff.
          const changes = status?.look ? victims.map((x) => x.h.target) : [];
          for (const id of changes) v.looks.set(id, before.fighters.find((o) => o.id === id)?.status.map((st) => STATUSES[st].look).find(Boolean) ?? null);
          // A fireball has to fall before it bursts: the sound, the numbers, the flinch and the jolt land with the burst.
          const land = look.kind === 'fire' ? FIRE_FALL : 0;
          let landed = false;
          const impact = () => {
            landed = true;
            play(look.kind === 'sparkle' ? 'spell' : 'bolt');
            for (const id of changes) {
              v.looks.delete(id);
              this.puff(id);
            }
            for (const { h, remaining, ours } of victims) {
              v.counts.set(h.target, remaining.count);
              v.health.set(h.target, remaining.hp);
              if (h.healed) this.float(h.target, h.raised && !this.named(h.target) ? `+${h.raised}` : `+${h.healed} hp`, GOLD[6]);
              if (status) this.float(h.target, status.name, BLUE[6]);
              if (!h.damage) continue;
              v.poses.set(h.target, { anim: 'defendRanged', ms: 0 });
              this.float(h.target, h.killed && !this.named(h.target) ? `-${h.killed}` : `-${h.damage} hp`, ours ? RED[5] : GOLD[6]);
            }
            if (e.damage && look.kind !== 'sparkle') v.shake = Math.max(v.shake, look.kind === 'fire' ? 5 : 4);
          };
          this.step(look.kind === 'fire' ? 0.95 : 0.4, {
            start: () => {
              v.shots.push(...shots);
              // An order was bellowed for all to hear: the ribbon keeps his words.
              if (!spell.shout) v.log = this.spellLine(e, victims.length);
              if (!land) impact();
            },
            tick: (t) => {
              for (const shot of shots) shot.t = t;
              if (!landed && t >= land) impact();
              // The spell burns in two red pulses, as Wesnoth flashes a unit that is hit.
              const k = landed ? ((t - land) / (1 - land)) * 0.95 : 0;
              for (const { h } of victims) if (h.damage) v.flashing[pulse(k) ? 'add' : 'delete'](h.target);
            },
            end: () => {
              for (const shot of shots) v.shots.splice(v.shots.indexOf(shot), 1);
              for (const { h, dies } of victims) {
                v.flashing.delete(h.target);
                if (!dies) v.poses.delete(h.target);
              }
            },
          });
          for (const { h, dies } of victims) if (dies) this.fall(h.target);
          break;
        }
        case 'wait':
        case 'defend': {
          // A leader has nothing to defend against: he lets his turn pass.
          const passes = e.type === 'defend' && isLeader(fighterById(this.battle, e.fighter));
          this.step(e.type === 'defend' && !passes ? 0.45 : 0.25, {
            start: () => {
              this.float(e.fighter, e.type === 'wait' || passes ? 'waits' : 'defends', NEUTRAL[7]);
              v.log = `${this.fighterName(e.fighter)} ${this.verb(e.fighter, e.type === 'wait' ? 'wait for a better moment' : passes ? 'bide his time' : this.named(e.fighter) ? 'stand guard' : 'raise their shields')}.`;
              if (e.type === 'defend' && !passes) v.poses.set(e.fighter, { anim: 'defend', ms: 0 });
            },
            end: () => v.poses.delete(e.fighter),
          });
          break;
        }
        case 'round':
          this.step(0.05, { start: () => (v.log = `Round ${e.round}.`) });
          break;
        case 'falter':
          this.step(0.6, {
            start: () => {
              play('falter');
              this.float(e.fighter, 'Falters', RED[6]);
              v.log = `${this.fighterName(e.fighter)} ${this.verb(e.fighter, 'lose')} heart, and ${this.named(e.fighter) ? 'his' : 'their'} turn.`;
              v.poses.set(e.fighter, { anim: 'defend', ms: 0 });
            },
            end: () => v.poses.delete(e.fighter),
          });
          break;
        case 'bribe': {
          // They stay as they were till the coins change hands: then they go home, or come over in your colours.
          const target = fighterById(this.battle, e.target);
          const [tx, ty] = hexCentre(target.at);
          const joined = e.joined;
          v.dying.add(e.target);
          v.counts.set(e.target, e.count);
          if (joined !== undefined) v.hidden.add(joined);
          this.flourish(e.fighter, 'idle', () => {
            play('coins');
            this.float(e.fighter, `\u2212${coins(e.gold)} gold`, GOLD[6]);
            v.log = `${this.fighterName(e.fighter)} pays ${this.objectName(e.target)} ${coins(e.gold)} gold: ${joined === undefined ? 'they shoulder their weapons and go home.' : 'they turn their coats, and fight for you!'}`;
          });
          if (joined === undefined) {
            const edge = target.side === 'player' ? MAP_VIEW.x - 40 : MAP_VIEW.x + MAP_VIEW.width + 40;
            const frames = !!ART[target.troop].move;
            const length = 0.3 + Math.abs(edge - tx) / 240;
            this.step(length, {
              start: () => {
                v.facings.set(e.target, target.side === 'player' ? -1 : 1);
                play('march');
              },
              tick: (t) => {
                const hop = frames ? 0 : Math.abs(Math.sin(t * Math.PI * 6)) * 3;
                v.positions.set(e.target, [tx + (edge - tx) * t, ty - hop]);
                v.poses.set(e.target, frames ? { anim: 'move', ms: t * length * 1000 } : STAND);
              },
              end: () => {
                v.dying.delete(e.target);
                for (const map of [v.positions, v.poses, v.facings, v.counts]) map.delete(e.target);
              },
            });
          } else {
            this.step(0.35, {
              start: () => {
                this.puff(e.target);
                v.dying.delete(e.target);
                v.counts.delete(e.target);
                v.hidden.delete(joined);
                this.float(joined, `+${e.count}`, GOLD[6]);
              },
            });
          }
          break;
        }
        case 'jeer': {
          const jeer = JEERS[(e.target + this.battle.round) % JEERS.length];
          this.flourish(e.fighter, 'cast', () => {
            play('jeer');
            this.float(e.fighter, jeer, NEUTRAL[7]);
            v.log = `${this.fighterName(e.fighter)} jeers at ${this.objectName(e.target)}: \u201c${jeer}\u201d They lose heart.`;
          });
          this.step(0.5, {
            start: () => {
              this.float(e.target, STATUSES[e.status].name, RED[5]);
              v.poses.set(e.target, { anim: 'defend', ms: 0 });
            },
            end: () => v.poses.delete(e.target),
          });
          break;
        }
        case 'song': {
          const status = STATUSES[e.status];
          // Gold motes swirl over every stack the song reaches.
          const motes = e.targets.map((id): Shot => {
            const [x, y] = this.spot(id);
            return { from: [x, y], to: [x, y - 14], t: 0, kind: 'sparkle', color: GOLD[6] };
          });
          this.flourish(e.fighter, 'idle', () => {
            play(status.luck ? 'luckySong' : 'song');
            v.log = `${this.fighterName(e.fighter)} strikes up ${status.song}: ${status.luck ? 'your stacks feel lucky' : 'your stacks take heart'}.`;
          });
          this.step(0.9, {
            start: () => {
              v.shots.push(...motes);
              for (const id of e.targets) this.float(id, status.name, GOLD[6]);
            },
            tick: (t) => {
              for (const mote of motes) mote.t = t;
            },
            end: () => {
              for (const mote of motes) v.shots.splice(v.shots.indexOf(mote), 1);
            },
          });
          break;
        }
        case 'volley':
          // An order: he bellows it, and the shots that follow are his men's.
          if (e.spell) this.cast(e.spell, before, e.by);
          else this.step(0.3, { start: () => (v.log = 'From the treeline, your archers loose a volley before anyone moves!') });
          break;
        case 'summon':
          this.cast(e.spell, before, e.by);
          this.marchIn(e);
          break;
        case 'skip': {
          const status = STATUSES[e.status];
          if (status.look) v.looks.set(e.fighter, status.look);
          this.step(0.8, {
            start: () => {
              this.float(e.fighter, status.name, GOLD[6]);
              v.log = `${this.fighterName(e.fighter)} ${this.named(e.fighter) ? 'loses a turn' : 'lose their turn'}: ${status.name.toLowerCase()} can't do much. Then the spell wears off.`;
            },
            end: () => {
              if (!status.look) return;
              v.looks.delete(e.fighter);
              this.puff(e.fighter);
            },
          });
          break;
        }
        case 'end': {
          // A beaten side's leader: the villain taken, or Aldric turning for home. The card will say it in the same words.
          const end = battleEnd(this.battle);
          const beaten = e.result === 'won' ? 'enemy' : e.result === 'lost' ? 'player' : null;
          const leaders = end ? this.battle.fighters.filter((f) => f.side === beaten && isLeader(f) && f.count > 0) : [];
          this.step(2.2, {
            start: () => {
              const [title, line] =
                e.result === 'won' ? ['VICTORY', end?.leader ?? (e.rout ? 'The rest of them run for it' : 'The field is yours')] : e.result === 'lost' ? ['DEFEAT', end?.leader ?? 'Your army breaks and scatters'] : ['RETREAT', 'You live to fight another day'];
              v.banner = { sprite: paintBanner(title, line), age: 0, life: 2.2 };
              v.log = end
                ? `${end.army}, and ${end.leader}.`
                : e.rout
                  ? e.result === 'won'
                    ? 'The rest of them give up and run for it. The field is yours.'
                    : 'Nobody can land a blow. Your men fall back.'
                  : e.result === 'won'
                    ? 'Victory! The field is yours.'
                    : e.result === 'lost'
                      ? 'Your army breaks and scatters.'
                      : 'You sound the retreat.';
              for (const f of leaders) this.float(f.id, e.result === 'won' ? 'Taken!' : 'Retreats!', e.result === 'won' ? GOLD[6] : RED[5]);
              if (e.result !== 'fled') play(e.result === 'won' ? 'victory' : 'defeat');
            },
            tick: (t) => {
              for (const f of leaders) {
                // The villain throws up his hands; Aldric turns and rides off the field.
                if (e.result === 'won') {
                  v.poses.set(f.id, { anim: 'defend', ms: 0 });
                  continue;
                }
                const [x, y] = this.spot(f.id);
                const k = Math.min(1, t / 0.4);
                const hop = ART[f.troop].move ? 0 : Math.abs(Math.sin(k * Math.PI * 5)) * 3;
                v.facings.set(f.id, -1);
                v.positions.set(f.id, [x + (MAP_VIEW.x - 70 - x) * k, y - hop]);
                v.poses.set(f.id, ART[f.troop].move ? { anim: 'move', ms: t * 2200 } : STAND);
                if (k >= 1) v.hidden.add(f.id);
              }
            },
          });
          break;
        }
        case 'turn': {
          const line = this.auto ? null : this.turnLine(e.fighter);
          if (line) this.step(0.01, { start: () => (v.log = line) });
          break;
        }
      }
    }
  }

  update(dt: number, _held?: ReadonlySet<string>) {
    const v = this.view;
    const pace = this.pace * (this.auto ? 2.5 : 1);
    for (const f of v.floaters) f.age += dt;
    v.floaters = v.floaters.filter((f) => f.age < 1);
    v.time += dt;
    v.shake = Math.max(0, v.shake - dt * 20);
    if (v.banner) v.banner.age += dt * pace;
    for (const spark of this.sparks) spark.t += dt * pace * 4;
    for (const spark of this.sparks.filter((k) => k.t >= 1)) v.shots.splice(v.shots.indexOf(spark), 1);
    this.sparks = this.sparks.filter((k) => k.t < 1);
    let budget = dt * pace;
    while (budget > 0 && this.queue.length > 0) {
      const s = this.queue[0];
      if (!s.started) {
        s.started = true;
        s.start?.();
      }
      const use = Math.min(budget, s.duration - s.elapsed);
      s.elapsed += use;
      budget -= use;
      s.tick?.(Math.min(1, s.elapsed / s.duration));
      if (s.elapsed >= s.duration - 1e-9) {
        s.end?.();
        this.queue.shift();
      }
    }
    // Once every blow has landed, the badges read the rules' counts again.
    if (this.queue.length === 0) {
      v.counts.clear();
      v.health.clear();
      v.looks.clear();
    }
    const f = activeFighter(this.battle);
    v.active = this.queue.length > 0 ? this.acting : (f?.id ?? null);
    if (this.queue.length === 0) {
      if (this.battle.result) {
        if (!this.finished) {
          this.finished = true;
          this.dispose();
          this.hooks.onDone(this.battle);
        }
      } else if (this.battle.volley) {
        this.think += dt * pace;
        if (this.think >= ENEMY_THINK * 1.5) {
          this.think = 0;
          this.perform({ type: 'volley' });
        }
      } else if (f && (f.side === 'enemy' || this.auto)) {
        this.think += dt * pace;
        if (this.think >= ENEMY_THINK) {
          this.think = 0;
          this.perform(chooseAction(this.battle));
        }
      }
    }
    if (this.queue.length === 0) this.updateFinishOffer();
    const mine = !!f && f.side === 'player' && !this.auto && this.queue.length === 0 && !this.battle.volley;
    // Where the acting stack can walk to, or how far a leader who rides out can ride.
    const opts = mine && !v.targeting ? options(this.battle) : null;
    v.reach = opts ? new Set([...opts.moves.keys(), ...(opts.rides?.keys() ?? [])]) : new Set();
    // A bard's Defend button sings instead.
    v.bard = mine && !!f && !!bardOf(f);
    if (this.pointer && mine) this.hoverAt(...this.pointer);
    else if (!mine) {
      v.hover = null;
      v.preview = null;
    }
  }

  render(_tick?: number): Uint8Array {
    return this.screen.draw(this.battle, this.view).data;
  }

  get bitmap() {
    return this.screenBitmap;
  }

  placeCards() {
    this.placeCard();
  }

  get screenBitmap() {
    return this.screen.screen;
  }

  placeCard() {
    this.cards.place(null, this.display.toPage(0, MAP_VIEW.y).y, this.display.toPage(0, MAP_VIEW.y + MAP_VIEW.height).y);
  }

  /** What clicking a hex would do, for the stack whose turn it is. */
  private intent(hex: number, x: number, y: number): { action: BattleAction; kind: 'move' | 'melee' | 'shoot' | 'spell' | 'bard' } | null {
    const f = activeFighter(this.battle);
    if (!f || f.side !== 'player' || this.auto || this.queue.length > 0) return null;
    const occupant = this.battle.fighters.find((o) => onField(o) && o.at === hex);
    if (this.view.targeting) {
      const spell = SPELLS[this.view.targeting as SpellId];
      if (occupant && (occupant.side === 'enemy') === (spell.on === 'enemy')) return { action: { type: 'cast', spell: spell.id, target: occupant.id }, kind: 'spell' };
      return null;
    }
    // A bard's turn: a click on one of theirs asks what to do with them (pay them, or jeer them).
    if (bardOf(f)) return occupant && occupant.side === 'enemy' ? { action: { type: 'jeer', target: occupant.id }, kind: 'bard' } : null;
    const opts = options(this.battle);
    if (occupant && occupant.side === 'enemy') {
      if (opts.shoot.includes(occupant.id)) return { action: { type: 'shoot', target: occupant.id }, kind: 'shoot' };
      const sides = opts.melee.filter((m) => m.target === occupant.id);
      if (sides.length > 0) {
        const best = sides.reduce((a, b) => {
          const [ax, ay] = hexCentre(a.from);
          const [bx, by] = hexCentre(b.from);
          return Math.hypot(ax - x, ay - y) <= Math.hypot(bx - x, by - y) ? a : b;
        });
        return { action: { type: 'melee', target: occupant.id, from: best.from }, kind: 'melee' };
      }
      return null;
    }
    if (!occupant && opts.moves.has(hex)) return { action: { type: 'move', to: hex }, kind: 'move' };
    return null;
  }

  private hoverAt(x: number, y: number) {
    const hex = hexAt(x, y);
    const intent = hex === null ? null : this.intent(hex, x, y);
    this.view.hover = intent && hex !== null ? { hex, kind: intent.kind } : null;
    // A stack on its hex, or a leader behind the line: the bar shows who he is.
    const leader = leaderAt(this.battle, x, y);
    this.view.inspect = leader ? leader.id : hex === null ? null : (this.battle.fighters.find((f) => onField(f) && f.at === hex)?.id ?? null);
    const under = this.view.inspect === null ? null : fighterById(this.battle, this.view.inspect);
    this.view.preview = intent ? this.forecast(intent.action) : under?.book ? this.bookLine(under.id) : null;
    this.display.canvas.style.cursor = intent ? 'pointer' : 'default';
  }

  /** A villain's spells and orders, for when you look him over. */
  private bookLine(id: number) {
    const book = fighterById(this.battle, id).book!;
    const spells = book.spells.map((s) => SPELLS[s].name);
    const orders = (book.charges ?? []).filter((c) => c.uses > 0).map((c) => `${SPELLS[c.spell].shout?.words ?? SPELLS[c.spell].name}${c.uses > 1 ? ` x${c.uses}` : ''}`);
    return `${this.fighterName(id)}: ${[spells.length ? `spells ${spells.join(', ')} (${book.mana} mana)` : '', orders.length ? `orders ${orders.join(' ')}` : ''].filter(Boolean).join('; ')}`;
  }

  /**
   * What an attack would probably do: average damage, how many fall, and whether they strike back.
   * Only stacks can be aimed at: nothing reaches a leader behind the line.
   */
  private forecast(action: BattleAction): string | null {
    const f = activeFighter(this.battle);
    if (!f) return null;
    if (action.type === 'jeer' || action.type === 'bribe') return this.bardLine(action.target);
    const target = 'target' in action && action.target !== undefined ? fighterById(this.battle, action.target) : null;
    if (!target) return null;
    const t = TROOPS[target.troop];
    const whom = `${target.side === 'player' ? 'your' : 'their'} ${t.name.toLowerCase()}`;
    if (action.type === 'cast') {
      const damage = spellDamage(this.battle, action.spell);
      if (!damage) return `${SPELLS[action.spell].name} on ${whom}.`;
      const [, ...caught] = spellVictims(this.battle, action.spell, target);
      const ours = caught.filter((c) => c.side === 'player').map((c) => TROOPS[c.troop].name.toLowerCase());
      const theirs = caught.length - ours.length;
      const more = [theirs ? `${theirs} more of theirs` : '', ours.length ? `your own ${ours.join(' and ')}!` : ''].filter(Boolean).join(', and ');
      return `${SPELLS[action.spell].name}: ${damage} damage, ${wound(target, damage).killed} of ${whom} perish.${more ? ` It also hits ${more}` : ''}`;
    }
    if (action.type !== 'melee' && action.type !== 'shoot') return null;
    const ranged = action.type === 'shoot';
    const leader = isLeader(f);
    const charge = action.type === 'melee' && isCharge(this.battle, f, action.from);
    const from = action.type === 'melee' ? { ...f, at: action.from } : f;
    const damage = strike(this.battle, from, target, ranged, undefined, charge ? CHARGE_BONUS : 1).damage;
    const left = wound(target, damage);
    const back = !ranged && !charge && !leader && left.count > 0 && !target.retaliated ? ' They will strike back.' : '';
    // A leader's blow gets no answer: nothing can reach him, and he's back behind the line before they turn.
    const after = leader && !ranged ? ` ${this.fighterName(f.id)} rides back behind the line, and nobody can strike back.` : charge ? ' No one can strike back at a charge.' : '';
    return `${charge ? 'Charge! ' : ''}${ranged ? 'Shoot' : 'Attack'} ${whom}: about ${damage} damage, ${left.killed} perish.${back}${after}`;
  }

  private button(id: (typeof BUTTONS)[number]['id']) {
    const f = activeFighter(this.battle);
    const mine = !!f && f.side === 'player' && this.queue.length === 0;
    if (id === 'auto') {
      this.auto = !this.auto;
      this.view.finishOffer = false;
      this.view.log = this.auto ? 'Your sergeants take over. Press Auto again to take back command.' : 'You take command again.';
      return;
    }
    if (!mine || this.auto) return;
    if (id === 'wait') this.perform({ type: 'wait' });
    // A bard has nothing to defend against: the button sings instead.
    else if (id === 'defend' && bardOf(f)) this.songCard();
    else if (id === 'defend') this.perform({ type: 'defend' });
    else if (id === 'retreat') this.confirmRetreat();
    else this.openSpellbook();
  }

  private updateFinishOffer() {
    if (this.finishState !== this.battle) {
      this.finishState = this.battle;
      const acting = activeFighter(this.battle);
      const estimate = acting?.side === 'player' && !this.battle.volley ? finishEstimate(this.battle) : null;
      const costs = estimate?.losses.map(({ troop, count }) => `~${count} ${TROOPS[troop].name}`);
      this.finishLine = estimate
        ? `Finish it: sergeants take over; likely lose ${costs!.length ? costs!.join(', ') : 'no troops'}.`
        : null;
    }
    this.view.finishOffer = !this.auto && this.finishLine !== null;
    if (this.view.finishOffer) this.view.log = this.finishLine!;
  }

  private confirmRetreat() {
    this.cards.show({
      title: 'Sound the retreat?',
      lines: ['Your men fall back to the map, and every company loses a quarter of its number on the way.', 'The enemy stays where it is.'],
      choices: [
        { label: 'Retreat', action: { type: 'retreat' } },
        { label: 'Stay and fight', action: { type: 'close' } },
      ],
    });
  }

  private openSpellbook() {
    const { hero } = this.battle;
    const spells = spellsOf(this.battle).map((id) => SPELLS[id]);
    // A charge (a wand's bolt) costs no mana: the book says how many are left instead.
    const cost = (id: SpellId) => {
      const charge = chargeOf(this.battle, id);
      return charge ? `${charge.uses} left` : `${spellCost(this.battle, id)}`;
    };
    this.cards.show({
      title: 'Spellbook',
      lines: [manaInBattle(hero.mana, hero.maxMana), `${(hero.casts ?? 1) > 1 ? `Two spells a round: ${castsLeft(this.battle)} left this round.` : 'One spell a round.'}`, ...spells.map((s) => `**${s.name}** (${cost(s.id)}): ${s.note}`)],
      choices: [
        ...spells.filter((s) => canCast(this.battle, s.id)).map((s) => ({ label: `Cast ${s.name}`, action: { type: 'spell' as const, spell: s.id } })),
        { label: 'Close', action: { type: 'close' } },
      ],
    });
  }

  readonly input = {
    click: (x: number, y: number) => {
      const button = BUTTONS.find((b) => x >= b.rect.x && x < b.rect.x + b.rect.width && y >= b.rect.y && y < b.rect.y + b.rect.height);
      if (button) return this.button(button.id);
      const hex = hexAt(x, y);
      const intent = hex === null ? null : this.intent(hex, x, y);
      if (intent?.kind === 'bard' && intent.action.type === 'jeer') this.bardCard(intent.action.target);
      else if (intent) this.perform(intent.action);
    },
    hover: (x: number, y: number) => {
      this.pointer = [x, y];
      this.hoverAt(x, y);
    },
    drag: () => {},
    leave: () => {
      this.pointer = null;
      this.view.hover = null;
      this.view.inspect = null;
      this.view.preview = null;
    },
    key: (key: string) => {
      if (key === 'escape') {
        this.view.targeting = null;
        this.cards.hide();
      } else if (key === 'w') this.button('wait');
      else if (key === 'd') this.button('defend');
      else if (key === 's' || key === 'c') this.button('spells');
      else if (key === 'a') this.button('auto');
      else if (key === 'r') this.button('retreat');
    },
  };

  debug() {
    return {
      battle: () => this.battle,
      auto: () => this.button('auto'),
      busy: () => this.queue.length > 0,
      log: () => this.view.log,
      act: (action: BattleAction) => this.perform(action),
      moves: () => [...options(this.battle).moves.keys()],
      /** The blows the acting stack could strike, with the length of the ride to each (a charge needs 3). */
      melee: () => {
        const opts = options(this.battle);
        return opts.melee.map((m) => ({ ...m, run: m.from === activeFighter(this.battle)?.at ? 0 : (opts.moves.get(m.from)?.length ?? 0) }));
      },
      /** What the forecast line would say for an action, as when pointing at it. */
      forecast: (action: BattleAction) => this.forecast(action),
      /** Whether the sergeants have command. */
      isAuto: () => this.auto,
      intent: (hex: number) => {
        const [x, y] = hexCentre(hex);
        return this.intent(hex, x, y)?.action ?? null;
      },
    };
  }
}
