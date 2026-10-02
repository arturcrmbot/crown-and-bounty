import { needsTarget, SPELLS, STATUSES, type SpellId, type StatusDef } from '../content/spells';
import { isBeast, TROOPS, troops } from '../content/troops';
import { BLOW_HITS, CONTACT, hitOn, SHOT_HITS, TROOP_SOUNDS } from '../audio/blows';
import { chooseAction, finishEstimate, sergeantsAct } from '../rules/battle/ai';
import { manaInBattle, signedShare, spiritsOf, uneasyWords } from '../rules/heroSheet';
import { grumbleLine } from '../rules/army';
import { capital, coins, listed, roman } from '../rules/state';
import { activeFighter, bardOf, battleAct, battleEnd, blessesAll, bribeOffer, canCast, canJoin, casterOf, castsLeft, chargeOf, fighterById, heroHelp, isCharge, isLeader, onField, options, ridesOut, spellCost, spellDamage, spellsOf, spellVictims, unitOf, wound, type BattleAction, type BattleEvent, type BattleState, type Fighter } from '../rules/battle/battle';
import { aimTag, bardTag, forecastOf, type AimTag } from '../rules/battle/forecast';
import { paintBanner } from '../render/banner';
import { BattleScreen, BUTTONS, FIRE_FALL, FLOAT_LIFE, FLOAT_RISE, hexAt, hexCentre, leaderAt, LOG_BOTTOM, sideAt, spotOf, stripBottom, type BattleView, type Shot } from '../render/battleScreen';
import { CUE_PING, cueBounce, FLASH_GAP, FLASH_TIME, FRAME, holdFrames, kickLeft, kickOf, POP_LIFE, ROLL, TOPPLE_TIME, toppleAngle, victoryHop, volleyOf, type Blow } from '../render/juice';
import { hash } from '../render/noise';
import { animLength, bodyHeight, hitTime, STAND, type AnimName } from '../render/battleSprites';
import { cursorIcon, type CursorKind, type Heading } from '../render/cursors';
import { ART, type Missile } from '../render/units';
import { MAP_VIEW } from '../render/frame';
import { BLUE, GOLD, NEUTRAL, RED } from '../render/palette';
import { paintSpeech } from '../render/speech';
import { CardView } from '../ui/card';
import { HoverLabel } from '../ui/label';
import { bitmapUrl } from '../ui/pixels';
import { play, speak } from '../ui/sound';
import { ForecastTag, type PageBox, type TagSide } from '../ui/tag';
import { touch } from '../ui/touch';
import { isGentle } from '../ui/gentle';
import type { Display } from './display';
import type { Screen, SideButton } from './screen';

type Step = { duration: number; elapsed: number; started: boolean; start?: () => void; tick?: (t: number) => void; end?: () => void };
/** How much of a Magic Arrow's flight passes before it strikes. */
const MISSILE_FLIGHT = 0.9;

/** What is left of each stack as an action's events play out: its count, and its top troop's health. */
type Left = Map<number, { count: number; hp: number }>;
/** What a click on a hex would do, for the stack whose turn it is. */
type Intent = { action: BattleAction; kind: 'move' | 'melee' | 'shoot' | 'spell' | 'bard' };
/** What pointing at an intent shows, worked out once for each: the tag by the stack, the stacks lit, and the ribbon's line. */
type Aim = { battle: BattleState; key: string; tag: AimTag | null; lit: Map<number, 'target' | 'danger'>; line: string | null; charge: boolean };

/** Nothing lit. */
const UNLIT: ReadonlyMap<number, 'target' | 'danger'> = new Map();
const cursors = new Map<string, string>();
/** A pointer from `render/cursors.ts`, twice its size with its hot spot in the middle, as the map's crossed swords are. */
function cursorCss(kind: CursorKind, heading?: Heading) {
  const key = `${kind}:${heading ?? ''}`;
  let css = cursors.get(key);
  if (!css) cursors.set(key, (css = `url("${bitmapUrl(cursorIcon(kind, heading), 0, 2)}") 16 16, ${kind === 'no' ? 'not-allowed' : 'pointer'}`));
  return css;
}
/** Which way a blow goes in, from the hex it is struck from to the one it lands on. */
function headingOf(from: number, to: number): Heading {
  const [fx, fy] = hexCentre(from);
  const [tx, ty] = hexCentre(to);
  const across = tx >= fx ? 'e' : 'w';
  return Math.abs(ty - fy) < 1 ? across : ty < fy ? `n${across}` : `s${across}`;
}
/** Played by touch, what the second tap does, under the tag the first one showed. */
const SECOND_TAP = { move: 'Tap again to go.', melee: 'Tap again to attack.', shoot: 'Tap again to shoot.', spell: 'Tap again to cast.', bard: '' } as const;

/** "1 perishes", "5 perish". */
const perish = (n: number) => `${n} ${n === 1 ? 'perishes' : 'perish'}`;

const ENEMY_THINK = 0.35;
/** Floaters start at least this low, so they rise and fade under the ribbon and the strip of next turns, never into them (#211). */
const floatTop = () => stripBottom() + FLOAT_RISE + 2;
/** Wesnoth's animation milliseconds as our seconds: its own timing, a touch brisker. */
const MS = 0.00085;
/** Wesnoth's flinch starts a little before the blow lands. */
const FLINCH_EARLY = 126;
/** Wesnoth pulses a unit red twice when it is hit: on for each of these stretches of the first 300 ms. */
const pulse = (k: number) => (k > 0.05 && k < 0.35) || (k > 0.55 && k < 0.85);
/** How long a villain's last words stay up, in seconds whatever the battle's pace: the fight stops on them, till a click. */
const LAST_WORDS = 3.2;
/** What a bard shouts at a stack he jeers. */
const JEERS = ['Call that a sword?', 'Boo! Hiss!', 'Go home to mother!', 'Nice hat!', 'Is that all?', 'My goose fights better!'];
/** What an outlaw captain shouts at a stack of yours (#239). */
const HECKLES = ['Run home to the King!', 'Call that an army?', 'Nice horse! Is it stolen?', 'I\u2019ve seen fiercer sheep!', 'Your mother wants you home!', 'Is that the best the King could find?'];
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
  /** Played by touch, what a tap on the field would do, in words big enough to read (the bar's are small on a phone). */
  private readonly label = new HoverLabel();
  /** What a click would do, beside the stack it would land on. */
  private readonly tag = new ForecastTag();
  /** The pointer the canvas has now, and its name, for scripts. */
  private cursor = '';
  private pointerName = 'default';
  private aim: Aim | null = null;
  private readonly display: Display;
  private readonly hooks: { onChange: (b: BattleState) => void; onDone: (b: BattleState) => void };
  private readonly pace: number;
  private auto = false;
  private finishState: BattleState | null = null;
  private finishLine: string | null = null;
  private sparks: Shot[] = [];
  /** The arrows of a volley after the first (#190), each on its own clock: `delay` seconds after the first is loosed, `flight` long. */
  private flights: { shot: Shot; delay: number; age: number; flight: number; hits: boolean; bolt: boolean }[] = [];
  /** Leaders reacting as a stack is wiped out (#190): a hop for joy, or a sag. */
  private reactions = new Map<number, { joy: boolean; age: number }>();
  /** When the field last flashed for Lightning, on the battle's clock: never more than once a second (#190). */
  private flashed = -Infinity;
  /** The last turn of yours the cue played for (#190), and whether anything has happened yet: the first turn of a fight has none. */
  private cued: string | null = null;
  private acted = false;
  /** Sir Aldric letting a turn pass with nobody in his reach (#211), as it plays: quietly on the fight's first turn, where the ribbon teaches. */
  private passing: { fighter: number; quiet: boolean } | null = null;
  /** A Fireball's light on the ground, fading over the burst. */
  private lightAge = 0;
  private think = 0;
  private finished = false;
  /** The stack whose move is playing out: it keeps the gold hex until its blows have landed. */
  private acting: number | null = null;
  private pointer: [number, number] | null = null;
  /**
   * Played by touch, a finger can't hover: a first tap on a hex shows what a tap there would do (the
   * forecast), and a second tap on the same hex does it, while nothing else has happened.
   */
  private armed: { hex: number; intent: Intent; battle: BattleState; targeting: string | null } | null = null;

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
      whites: new Set(),
      dying: new Set(),
      topple: new Map(),
      fallen: new Map(),
      lifts: new Map(),
      front: new Map(),
      ending: { fast: false, dip: 0, fall: 0, dusk: 0 },
      flash: 0,
      light: null,
      cue: null,
      hidden: new Set(),
      looks: new Map(),
      reach: new Set(),
      hover: null,
      lit: UNLIT,
      floaters: [],
      pops: [],
      rolls: new Map(),
      shots: [],
      log: this.startLine(),
      active: activeFighter(battle)?.id ?? null,
      inspect: null,
      preview: null,
      targeting: null,
      bard: false,
      time: 0,
      shake: 0,
      kick: [0, 0],
      banner: null,
      speech: null,
      finishOffer: false,
      touch: touch(),
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
    return (first && this.turnLine(first.id)) ?? (touch() ? 'To battle! Tap a hex to move, or an enemy to attack, and tap it again to go.' : 'To battle! Click a hex to move, or an enemy to attack.');
  }

  /** What one of your leaders can do as his turn comes: he never walks the field. Sir Aldric with nobody in his reach does nothing, and lets the turn pass. */
  private turnLine(id: number): string | null {
    const f = fighterById(this.battle, id);
    if (f.side !== 'player' || !isLeader(f)) return null;
    if (bardOf(f)) return `${this.fighterName(id)} can pay or jeer any of their stacks. ${touch() ? 'Tap' : 'Click'} one, or ${touch() ? '' : 'press '}Sing. Or Wait.`;
    if (activeFighter(this.battle)?.id === id && this.idleRider(f)) return null;
    return `${this.fighterName(id)} ${ridesOut(f) ? 'can ride out at any stack in reach, strike, and ride back' : 'can shoot any stack from behind the line'}. Or Wait.`;
  }

  /**
   * Sir Aldric, when he rides out, on his turn with nobody in his reach and nothing to shoot: there is
   * nothing for him to do but wait, so his turn passes by itself (#211). The spellbook is open on every
   * one of your stacks' turns, so nothing is lost.
   */
  private idleRider(f: Fighter): boolean {
    // Asked while the view is still being built, too, for the fight's first words.
    if (f.side !== 'player' || this.auto || !isLeader(f) || !ridesOut(f) || this.view?.targeting || this.cards.isOpen) return false;
    const opts = options(this.battle);
    return opts.melee.length === 0 && opts.shoot.length === 0;
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

  /**
   * A leader says something aloud: a bubble over his head, his babble, and the ribbon says it too.
   * It stays up `LAST_WORDS` seconds at any pace, or until a click.
   */
  private say(id: number, words: string) {
    const f = fighterById(this.battle, id);
    const hold = LAST_WORDS * this.pace * (this.auto ? 2.5 : 1);
    this.step(hold, {
      start: () => {
        this.view.speech = { fighter: id, bubble: paintSpeech(`\u201c${words}\u201d`), age: 0, life: LAST_WORDS };
        this.view.log = `${this.fighterName(id)}: \u201c${words}\u201d`;
        this.view.poses.set(id, { anim: 'defend', ms: 0 });
        speak(TROOPS[f.troop].voice ?? 150, words);
      },
      tick: (t) => {
        if (this.view.speech) this.view.speech.age = t * LAST_WORDS;
      },
      end: () => {
        this.view.speech = null;
        this.view.poses.delete(id);
      },
    });
  }

  /** The forecast for a bard's moves on one of their stacks: what paying them off would cost, and what a jeer does. */
  private bardLine(id: number) {
    const f = activeFighter(this.battle)!;
    const target = fighterById(this.battle, id);
    const leave = bribeOffer(this.battle, f, target);
    const join = bribeOffer(this.battle, f, target, true);
    const jeer = `or jeer them (${spirits(STATUSES[bardOf(f)!.jeer])})`;
    if (!leave) return `${this.fighterName(id)} take no gold, but you can ${jeer.slice(3)}.`;
    if (!leave.count) return `${this.fighterName(id)} take no gold from an army no stronger than theirs, but you can ${jeer.slice(3)}.`;
    const some = leave.count < target.count ? ` for ${leave.count} of them` : '';
    return `${this.fighterName(id)}: ${coins(leave.price)} gold to go home${some}${join?.count && canJoin(this.battle, target, join.count) ? `, ${coins(join.price)} to join you` : ''}, ${jeer}.`;
  }

  /** A bard's moves on one of their stacks, each with its price or what it does, before he makes it. */
  private bardCard(id: number) {
    const f = activeFighter(this.battle)!;
    const art = bardOf(f)!;
    const target = fighterById(this.battle, id);
    const gold = this.battle.hero.gold ?? 0;
    const leave = bribeOffer(this.battle, f, target);
    const join = bribeOffer(this.battle, f, target, true);
    const room = Boolean(join?.count) && canJoin(this.battle, target, join!.count);
    const off = this.battle.hero.bribes ? `, with ${pct(this.battle.hero.bribes)} off` : '';
    const them = leave && leave.count < target.count ? `${leave.count} of them` : 'them';
    const jeer = STATUSES[art.jeer];
    // Turncoats of a people his army won't march beside would be grumbled at: the card says so first.
    const ours = this.battle.fighters.filter((x) => x.side === 'player' && onField(x)).map((x) => ({ troop: x.troop, count: x.count }));
    const quarrel = room ? grumbleLine(ours, [target.troop]) : null;
    const lines =
      !leave || !join
        ? [`*${TROOPS[target.troop].name} take no gold.*`]
        : !leave.count
          ? [`*${TROOPS[target.troop].name} take no gold from an army no stronger than theirs. Make yours stronger, or theirs weaker, and ask again.*`]
          : [
            `Pay ${them} **${coins(leave.price)} gold**${off}, and they go home.`,
            room ? `Pay ${them} **${coins(join.price)} gold**${off}, and they fight for you, and ride on with you after.` : '*You have no room under your banner for them to come over.*',
            ...(leave.count < target.count ? [`*Only ${leave.count} of the ${target.count} will take your gold. The stronger your army is than theirs, the more of them would.*`] : []),
            ...(quarrel ? [quarrel] : []),
            '*Bought, not beaten, they teach you half what beating them would.*',
            `You carry **${coins(gold)} gold**.`,
          ];
    lines.push(`Jeer them, and they lose heart, with ${spirits(jeer)} for ${jeer.rounds} rounds and a chance they lose their turn.`);
    this.cards.show({
      title: this.fighterName(id, target.count),
      lines,
      choices: [
        ...(!leave?.count ? [] : [{ label: `Pay ${them} to go (${coins(leave.price)} gold)`, action: { type: 'bard' as const, move: 'bribe' as const, target: id }, disabled: leave.price > gold }]),
        ...(!join?.count || !room ? [] : [{ label: `Pay ${them} to join you (${coins(join.price)} gold)`, action: { type: 'bard' as const, move: 'buy' as const, target: id }, disabled: join.price > gold }]),
        { label: 'Jeer them', action: { type: 'bard', move: 'jeer', target: id } },
        { label: 'Close', action: { type: 'close' } },
      ],
    });
  }

  /** A bard's songs, and what each does for every stack of yours, before he sings. */
  private songCard() {
    const bard = activeFighter(this.battle)!;
    const art = bardOf(bard)!;
    // A song still on his stacks says how long it has left, so he doesn't sing it again not knowing (#231).
    const running = art.songs.flatMap((id) => {
      const until = this.battle.fighters.filter((x) => x.side === bard.side && onField(x) && x.status.includes(id)).map((x) => x.until?.[id] ?? 0);
      if (!until.length) return [];
      const left = Math.max(...until) - this.battle.round;
      return [`*Your ${STATUSES[id].song!.replace(/^a /, '')} is still on your stacks ${left > 1 ? 'for this round and the next' : 'for the rest of this round'}.*`];
    });
    this.cards.show({
      title: 'Sing',
      lines: [
        ...art.songs.map((id) => {
          const s = STATUSES[id];
          const what = s.luck ? 'which gives each blow a chance to land twice as hard' : 'which gives each stack a chance to go again before the round moves on';
          return `**${s.song![0].toUpperCase()}${s.song!.slice(1)}** gives every stack of yours ${spirits(s)} for ${s.rounds} rounds, ${what}.`;
        }),
        ...running,
      ],
      choices: [...art.songs.map((id) => ({ label: `Sing ${STATUSES[id].song}`, action: { type: 'sing' as const, song: id } })), { label: 'Close', action: { type: 'close' } }],
    });
  }

  /** One thing the hero brought, and whom it touches, in words. */
  private openingLine(o: NonNullable<BattleState['opening']>[number]) {
    const names = o.fighters.map((id) => {
      const f = fighterById(this.battle, id);
      return this.named(id) ? TROOPS[f.troop].name : `${f.side === 'player' ? 'your' : 'the'} ${TROOPS[f.troop].name}`;
    });
    const who = listed(names);
    const status = STATUSES[o.status].name;
    const one = o.fighters.length === 1 && this.named(o.fighters[0]);
    // "start slowed", but "start with Stone Skin".
    return `Thanks to ${o.source}, ${who} ${one ? 'starts' : 'start'} ${/ed$/.test(status) ? status.toLowerCase() : `with ${status}`}.`;
  }

  dispose() {
    this.cards.dispose();
    this.label.dispose();
    this.tag.dispose();
    this.setCursor('default');
  }

  private fighterName(id: number, count?: number) {
    const f = fighterById(this.battle, id);
    if (this.named(id)) return capital(TROOPS[f.troop].name);
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

  /** "their Trolls" and "the Sergeant" mid-sentence, but "Mother Mirrow" keeps her capital. */
  private objectName(id: number) {
    return this.fighterName(id).replace(/^(Your|Their|The) /, (m) => m.toLowerCase());
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
    const ceiling = floatTop();
    const top = Math.max(ceiling, y + 12 - bodyHeight(f.troop, 'battle') - 16);
    // Words are 8 px a letter and 16 px a line, and all rise together, so where they are now is where they stay apart.
    const clash = (at: number) => this.view.floaters.some((o) => Math.abs(o.x - x) < ((o.text.length + text.length) * 8) / 2 + 4 && Math.abs(o.y - o.age * FLOAT_RISE - at) < 16);
    const lines = [0, 1, 2, 3, 4, 5].map((k) => top - k * 16).filter((at) => at >= ceiling);
    const at = [...lines, ...[1, 2, 3, 4, 5, 6].map((k) => top + k * 16)].find((a) => !clash(a)) ?? top;
    this.view.floaters.push({ x, y: at, text, color, age: 0 });
  }

  /** Where on the field a sound comes from: your side on the left, theirs on the right, as far across as it is. */
  private panAt(x: number) {
    const half = MAP_VIEW.width / 2;
    return Math.max(-0.7, Math.min(0.7, ((x - MAP_VIEW.x - half) / half) * 0.7));
  }

  /**
   * What a blow or a shot sounds like as it lands: the attacker's weapon (a knight's charge is his
   * lance), or the shot hitting home; what it lands on, flesh or the target's steel (#257); and its
   * cry, if it's hurt and still standing (one that falls gives its death cry as it goes).
   */
  private landSound(e: Extract<BattleEvent, { type: 'hit' }>, missile: Missile | null, dies: boolean, x: number) {
    const pan = this.panAt(x);
    const attacker = fighterById(this.battle, e.attacker);
    const target = TROOP_SOUNDS[fighterById(this.battle, e.target).troop];
    const blow = e.charge && ART[attacker.troop].charge ? 'lance' : TROOP_SOUNDS[attacker.troop].blow;
    if (missile) play(`land:${missile}`, pan);
    else play(`blow:${blow}`, pan);
    const lands = missile ? 0 : CONTACT;
    // Weight under the blow, as heavy as what it did (#190).
    play(e.charge || dies ? 'thump:huge' : e.killed ? 'thump:heavy' : 'thump:light', pan, lands);
    const hit = missile ? SHOT_HITS[missile] : BLOW_HITS[blow];
    if (hit) play(hitOn(hit, target.armour), pan, lands);
    if (!dies && e.damage > 0) play(`hurt:${target.cry}`, pan, lands + 0.06);
  }

  /** A stack's death cry, as the last of it falls, `delay` seconds from now. */
  private deathCry(id: number, delay = 0) {
    play(`dies:${TROOP_SOUNDS[fighterById(this.battle, id).troop].cry}`, this.panAt(this.spot(id)[0]), delay);
  }

  /**
   * A burst where a blow lands, as big as what it did, with chips flung the way it went, blood for
   * the wounded, and the field kicked that way too (#190), springing back in a moment.
   */
  private impact(target: number, blow: Blow, heavy: boolean, heading: [number, number]) {
    const f = fighterById(this.battle, target);
    const [x, y] = this.spot(target);
    const chest = y + 12 - Math.round(bodyHeight(f.troop, 'battle') * 0.5);
    const size = blow.charge || blow.wiped ? 1.7 : blow.killed > 0 || blow.lucky ? 1.35 : heavy ? 1.1 : 0.9;
    for (const kind of ['spark', 'blood'] as const) {
      const shot: Shot = { from: [x, chest], to: [x, chest], t: 0, kind, ...(kind === 'spark' ? { size, heading: Math.atan2(heading[1], heading[0]) } : {}) };
      this.view.shots.push(shot);
      this.sparks.push(shot);
    }
    const [kx, ky] = kickOf(heading, blow, isGentle());
    this.view.kick = [this.view.kick[0] + kx, this.view.kick[1] + ky];
    // Blood on the grass at its feet (#190), but not from a beast's hide or a leader behind the line.
    if (!isLeader(f) && !isBeast(f.troop)) this.screen.markBlood(f.at, f.id * 31 + this.battle.round * 7 + Math.round(size * 10));
  }

  /** A stack's count and health as a blow lands: its badge rolls down to the new count, white for a frame (#190). */
  private counted(id: number, left: { count: number; hp: number }) {
    const v = this.view;
    const was = v.counts.get(id) ?? fighterById(this.battle, id).count;
    v.counts.set(id, left.count);
    v.health.set(id, left.hp);
    if (was !== left.count) v.rolls.set(id, { from: was, to: left.count, age: 0 });
  }

  /** How many fell, or the damage when nobody did, popping out of the stack's badge (#190): gold for their losses, red for yours. */
  private pop(id: number, killed: number, damage: number) {
    const f = fighterById(this.battle, id);
    if (isLeader(f) || (!killed && !damage)) return;
    this.view.pops.push({ fighter: id, words: killed ? `\u2212${killed}` : `\u2212${damage} hp`, colour: f.side === 'player' ? RED[5] : GOLD[6], skull: killed > 0, age: 0 });
  }

  /**
   * The last of a stack falling over (#190): away from the way it faces, over a third of a second,
   * landing in a puff of dust, then lying dimmed where it fell. Its side's leaders sag,
   * and the other side's hop for joy. `tick` takes the seconds since it began to fall.
   */
  private faller(id: number) {
    const v = this.view;
    let landed = false;
    return {
      start: () => {
        const f = fighterById(this.battle, id);
        v.fallen.set(id, v.facings.get(id) ?? this.facingOf(f));
        v.offsets.delete(id);
        v.topple.set(id, toppleAngle(0));
        this.react(f.side);
      },
      tick: (elapsed: number) => {
        const angle = toppleAngle(elapsed);
        v.topple.set(id, angle);
        if (!landed && angle >= 90) {
          landed = true;
          this.landed(id);
        }
      },
      end: () => {
        if (!landed) this.landed(id);
        v.topple.delete(id);
        v.dying.delete(id);
        v.poses.delete(id);
        v.facings.delete(id);
      },
    };
  }

  /** A fallen stack hits the ground: dust along it, and the field jolts down a little. Its death cry ends in the thud. */
  private landed(id: number) {
    const f = fighterById(this.battle, id);
    // What it carried lies in the grass beside it (#190): a helmet from those in steel, a shield from other folk.
    if (!isBeast(f.troop) && !isLeader(f)) this.screen.markDropped(f.at, TROOP_SOUNDS[f.troop].armour ? 'helmet' : 'shield', f.side === 'player', this.view.fallen.get(id) ?? this.facingOf(f));
    const [x, y] = this.spot(id);
    const dust: Shot = { from: [x, y + 12], to: [x, y + 12], t: 0, kind: 'dust', size: 56, rate: 2.2 };
    this.view.shots.push(dust);
    this.sparks.push(dust);
    if (!isGentle()) this.view.kick = [this.view.kick[0], this.view.kick[1] + 2];
  }

  /** A burst that plays out by itself over `seconds`, at the battle's pace, without holding up the queue. */
  private burst(kind: Shot['kind'], at: [number, number], seconds: number, extra: Partial<Shot> = {}) {
    const shot: Shot = { from: at, to: at, t: 0, kind, rate: 1 / seconds, ...extra };
    this.view.shots.push(shot);
    this.sparks.push(shot);
  }

  /** The leaders behind each line react as a stack is wiped out, as HoMM2's heroes do: the other side's hop for joy, and its own sag. */
  private react(lost: string) {
    for (const f of this.battle.fighters) if (isLeader(f) && f.count > 0) this.reactions.set(f.id, { joy: f.side !== lost, age: 0 });
  }

  /** The battle's pace now: Auto plays everything two and a half times as fast. */
  private get speed() {
    return this.pace * (this.auto ? 2.5 : 1);
  }

  /**
   * One more arrow of a volley (#190), loosed `k` beats after the first on its own arc. Odd ones
   * strike the stack, even ones (and every one, if the first blow kills it) stick in the ground at
   * its feet, inside its own hex, and stay there.
   */
  private volley(k: number, first: Shot, flight: number, missile: 'arrow' | 'quarrel', target: Fighter, dies: boolean) {
    const [tx, ty] = this.spot(target.id);
    const hits = !dies && k % 2 === 1;
    const jitter = (n: number) => hash(k, n, target.id * 7 + this.battle.round) - 0.5;
    // Misses come down in front of the stack and behind it, by turns.
    const near = first.from[0] < tx ? -1 : 1;
    // A miss lands clear of the stack's badge, between its feet and the edge of its hex.
    const to: [number, number] = hits ? [first.to[0] + jitter(1) * 14, first.to[1] + jitter(2) * 18] : [tx + (k % 4 === 2 ? near : -near) * (21 + Math.abs(jitter(3)) * 12), ty + 3 + jitter(4) * 8];
    const arc = (missile === 'quarrel' ? 14 : 44) + jitter(5) * 14;
    const shot: Shot = { from: [first.from[0] + jitter(6) * 6, first.from[1] + jitter(7) * 4], to, t: 0, kind: missile, arc };
    const delay = k * 0.05;
    this.flights.push({ shot, delay, age: 0, flight, hits, bolt: missile === 'quarrel' });
    play(`loose:${missile}`, this.panAt(first.from[0]), delay / this.speed);
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
          v.log = `${this.casterName(by)} ${shout.verb}, \u201c${shout.words}\u201d`;
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
    if (spell.effect.kind === 'mass' || (spell.effect.kind === 'status' && stacks > 1)) return `${who} casts ${spell.name} on ${stacks === 1 ? this.objectName(e.target) : `all ${stacks} of ${fighterById(this.battle, e.target).side === 'player' ? 'your' : 'their'} stacks`}.`;
    if (e.healed) return `${who} casts ${spell.name} on ${this.objectName(e.target)}. They get ${e.healed} health back${e.raised ? `, and ${e.raised} ${e.raised === 1 ? 'gets' : 'get'} up again` : ''}.`;
    return `${who} casts ${spell.name} on ${this.objectName(e.target)}${e.damage ? ` for ${e.damage} damage${e.killed ? `, and ${perish(e.killed)}` : ''}` : ''}.`;
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
    // A company of archers or crossbowmen looses a volley, not one arrow (#190).
    const extra = missile === 'arrow' || missile === 'quarrel' ? volleyOf(attacker.count, isLeader(attacker)) - 1 : 0;
    const release = missile ? Math.max(0, hit - 150) : hit;
    // The ribbon names the blow as it starts, and says what it did when it lands.
    const blow = `${this.fighterName(e.attacker)} ${this.verb(e.attacker, e.ranged ? 'shoot' : e.retaliation ? 'strike back at' : e.charge ? 'charge' : 'hit')} ${this.objectName(e.target)}`;
    if (e.lucky) {
      // Good luck shines on it, as in HoMM2 (#190): a rainbow comes down onto the stack with a chime before its blow.
      this.step(0.35, {
        start: () => {
          turn();
          const head: [number, number] = [ax, ay + 12 - bodyHeight(attacker.troop, 'battle') - 2];
          const side = attacker.side === 'player' ? -1 : 1;
          const sky: [number, number] = [Math.max(MAP_VIEW.x + 20, Math.min(MAP_VIEW.x + MAP_VIEW.width - 20, head[0] + side * 170)), MAP_VIEW.y + 40];
          const rainbow: Shot = { from: sky, to: head, t: 0, kind: 'rainbow', rate: 1 / 0.9 };
          v.shots.push(rainbow);
          this.sparks.push(rainbow);
          play('luck', this.panAt(ax));
          v.log = `Good luck shines on ${this.objectName(e.attacker)}!`;
        },
      });
    }
    this.step(release * MS, {
      start: () => {
        turn();
        v.log = `${blow}...`;
        // Struck at close quarters, the target stands in front of whoever strikes it, so its flash shows (#190).
        if (!e.ranged) v.front.set(e.target, e.attacker);
      },
      tick: (t) => {
        swing(t * release);
        if (!missile && t * release >= hit - FLINCH_EARLY) v.poses.set(e.target, { anim: flinch(), ms: 0 });
      },
    });
    if (missile) {
      // The release frame holds while the shot flies, however far.
      const shot: Shot = { from: [ax + ux * 12, ay - bodyHeight(attacker.troop, 'battle') * 0.55], to: [tx, ty + 12 - bodyHeight(target.troop, 'battle') * 0.5], t: 0, kind: missile };
      const flight = 0.16 + len / 1500;
      this.step(flight, {
        start: () => {
          v.shots.push(shot);
          play(`loose:${missile}`, this.panAt(ax));
          for (let k = 1; k <= extra; k++) this.volley(k, shot, flight, missile as 'arrow' | 'quarrel', target, dies);
        },
        tick: (t) => {
          shot.t = t;
          swing(release + (hit - release) * t);
          if (t > 0.8) v.poses.set(e.target, { anim: flinch(), ms: 0 });
        },
        end: () => v.shots.splice(v.shots.indexOf(shot), 1),
      });
    }
    const reel = (e.ranged ? 4 : 8) * (e.charge ? 2.2 : 1);
    // The blow lands, and the field holds still on it for a moment (#190): the target a white shape
    // for a frame, then red, the field kicked the way the blow went, and the kill popping out of the badge.
    const landed: Blow = { killed: e.killed, charge: e.charge, lucky: e.lucky, wiped: dies };
    const gentle = isGentle();
    const hold = holdFrames(landed, gentle) * FRAME;
    // The white shape shows for a frame at least, even when Auto hurries the hold along.
    let ticks = 0;
    this.step(hold, {
      start: () => {
        v[gentle ? 'flashing' : 'whites'].add(e.target);
        v.poses.set(e.target, { anim: flinch(), ms: 0 });
        this.counted(e.target, left);
        this.landSound(e, missile, dies, tx);
        if (dies) this.deathCry(e.target, (missile ? 0 : CONTACT) + 0.06);
        this.impact(e.target, landed, !e.ranged, [ux, uy]);
        if (e.charge) {
          this.float(e.attacker, 'Charge!', GOLD[6], from);
          play('charge');
        }
        if (e.lucky) this.float(e.attacker, 'Lucky!', GOLD[5], from);
        if (e.backstab) this.float(e.attacker, 'Backstab!', GOLD[6], from);
        if (e.braced) this.float(e.target, 'Pikes set!', GOLD[6]);
        if (e.plate) this.float(e.target, 'Glances off!', GOLD[5]);
        this.pop(e.target, e.killed, e.damage);
        // Said as a spell's line is: "for 156 damage, and 7 perish."
        const fell = e.killed ? `, and ${perish(e.killed)}` : '';
        v.log = `${blow} for ${e.damage} damage${fell}.${e.lucky ? ' A lucky blow!' : ''}${e.backstab ? ' A backstab!' : ''}${e.braced ? ' The pikes stop the charge.' : ''}${e.plate ? ' Half of it glances off their plate.' : ''}${e.status ? ` ${STATUSES[e.status].onHit ?? ''}` : ''}`;
      },
      tick: (t) => {
        swing(hit);
        if (++ticks > 1 && t * hold >= FRAME && v.whites.delete(e.target)) v.flashing.add(e.target);
      },
      end: () => {
        if (v.whites.delete(e.target)) v.flashing.add(e.target);
      },
    });
    // The last of a stack falls over as the attacker draws back, instead of reeling (#190).
    const falls = dies ? this.faller(e.target) : null;
    const length = Math.max(after * MS, falls ? TOPPLE_TIME + FRAME : 0);
    this.step(length, {
      start: () => falls?.start(),
      tick: (t) => {
        const ms = Math.min(after, (t * length) / MS);
        swing(hit + ms);
        if (falls) {
          // One red pulse as it goes over.
          v.flashing[pulse(ms / 300) && ms < 120 ? 'add' : 'delete'](e.target);
          falls.tick(t * length);
          return;
        }
        v.flashing[pulse(ms / 300) ? 'add' : 'delete'](e.target);
        const k = Math.sin(Math.min(1, (ms / after) * 1.8) * Math.PI) * (1 - (ms / after) * 0.4);
        v.offsets.set(e.target, [ux * reel * k, uy * reel * k]);
      },
      end: () => {
        for (const map of [v.poses, v.offsets, v.facings]) map.delete(e.attacker);
        v.flashing.delete(e.target);
        v.offsets.delete(e.target);
        v.front.delete(e.target);
        if (falls) return falls.end();
        v.poses.delete(e.target);
        v.facings.delete(e.target);
      },
    });
  }

  /** Does an action through the rules (one your sergeants chose, if `sergeants`: the mana it costs, they spent), then queues the animations for what happened. */
  perform(action: BattleAction, sergeants = false): boolean {
    const before = this.battle;
    const { battle, events } = (sergeants ? sergeantsAct : battleAct)(before, action);
    if (events.length === 0) return false;
    this.acted = true;
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
          const feet = `feet:${TROOP_SOUNDS[f.troop].feet}` as const;
          // A charge's run-up (#190): dust flies from the hooves on every hex of it.
          const charging = !back && events.some((n) => n.type === 'hit' && n.charge && n.attacker === e.fighter);
          for (const [n, to] of path.entries()) {
            const a = n === 0 ? start : path[n - 1];
            // A hex a step for a stack; a leader gallops, however far his first and last stretches are.
            const length = leader ? Math.max(0.06, Math.hypot(to[0] - a[0], to[1] - a[1]) / 640) : 0.12;
            this.step(length, {
              start: () => {
                if (n === 0 && !back) v.log = `${this.fighterName(e.fighter)} ${this.verb(e.fighter, leader ? 'ride out' : 'advance')}...`;
                if (to[0] !== a[0]) v.facings.set(e.fighter, to[0] > a[0] ? 1 : -1);
                play(feet, this.panAt(to[0]));
                if (charging) this.burst('dust', [Math.round(a[0]), Math.round(a[1]) + 12], 0.45, { size: 30 });
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
          break;
        }
        case 'regen': {
          const healed = left.get(e.fighter)!;
          left.set(e.fighter, { count: healed.count, hp: healed.hp + e.healed });
          this.step(0.3, {
            start: () => {
              v.health.set(e.fighter, healed.hp + e.healed);
              this.float(e.fighter, `+${e.healed}`, GOLD[6]);
              v.log = `${this.fighterName(e.fighter)} ${this.verb(e.fighter, 'regenerate')}, and the wounds close up.`;
            },
          });
          break;
        }
        case 'morale': {
          // Good spirits win a stack another turn, and it jumps for joy.
          this.step(0.35, {
            start: () => {
              play('cheer');
              const [x, y] = this.spot(e.fighter);
              this.burst('ring', [x, y + 12], 0.9);
              this.float(e.fighter, 'Morale!', GOLD[6]);
              v.log = `${this.fighterName(e.fighter)} ${this.verb(e.fighter, 'cheer')}, and ${this.named(e.fighter) ? 'goes' : 'go'} again before the round moves on.`;
            },
            tick: (t) => v.offsets.set(e.fighter, [0, -Math.round(Math.sin(t * Math.PI) * 8)]),
            end: () => v.offsets.delete(e.fighter),
          });
          break;
        }
        case 'poison': {
          const hurt = left.get(e.fighter)!;
          left.set(e.fighter, { count: hurt.count, hp: hurt.hp - e.hurt });
          this.step(0.3, {
            start: () => {
              v.health.set(e.fighter, hurt.hp - e.hurt);
              this.pop(e.fighter, 0, e.hurt);
              play(`hurt:${TROOP_SOUNDS[fighterById(this.battle, e.fighter).troop].cry}`, this.panAt(this.spot(e.fighter)[0]));
              v.log = `${this.fighterName(e.fighter)} ${this.verb(e.fighter, 'wince')} as the poison bites deep.`;
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
          const struck = spell.effect.kind === 'mass' || (spell.effect.kind === 'status' && victims.length > 1) ? victims.map((x) => fighterById(this.battle, x.h.target)) : [target];
          // A missile flies from whoever cast it, behind his line; the rest come down from the sky.
          const caster = e.by ?? this.battle.fighters.find((f) => f.side === 'player' && isLeader(f))?.id;
          const shots = struck.map((x) => {
            const [tx, ty] = hexCentre(x.at);
            if (look.kind === 'missile' && caster !== undefined) {
              const [cx, cy] = this.spot(caster);
              return { from: [cx, cy - 20] as [number, number], to: [tx, ty - 10] as [number, number], t: 0, kind: 'magic' as const, color: colour };
            }
            return { from: [tx, 0] as [number, number], to: [tx, ty - 10] as [number, number], t: 0, kind: look.kind === 'missile' ? ('bolt' as const) : look.kind, color: colour };
          });
          const status = spell.effect.kind === 'status' || spell.effect.kind === 'mass' ? STATUSES[spell.effect.status] : null;
          // A stack turned into something else stays itself till the spell lands, then goes in a puff.
          const changes = status?.look ? victims.map((x) => x.h.target) : [];
          for (const id of changes) v.looks.set(id, before.fighters.find((o) => o.id === id)?.status.map((st) => STATUSES[st].look).find(Boolean) ?? null);
          // A fireball has to fall before it bursts: the sound, the numbers, the flinch and the jolt land with the burst.
          const land = look.kind === 'fire' ? FIRE_FALL : look.kind === 'missile' ? MISSILE_FLIGHT : 0;
          let landed = false;
          let sinceLanding = 0;
          const impact = () => {
            landed = true;
            play(look.kind === 'sparkle' ? 'spell' : look.kind === 'fire' ? 'boom' : look.kind === 'missile' ? 'land:magic' : 'bolt');
            const [sx, sy] = hexCentre(target.at);
            if (look.kind === 'bolt' && e.damage) {
              // Lightning lights the whole field for a moment (#190), never more than once a second, and
              // not at all with gentle effects; its thunder rolls in the same recording, and it leaves a scorch.
              if (!isGentle() && v.time - this.flashed >= FLASH_GAP) {
                v.flash = FLASH_TIME;
                this.flashed = v.time;
              }
              this.screen.markScorch(sx, sy + 12, false);
              this.burst('spark', [sx, sy + 12 - bodyHeight(target.troop, 'battle') * 0.5], 0.3, { size: 1.3, heading: Math.PI / 2 });
            }
            if (look.kind === 'fire') {
              // A Fireball throws its light on the ground round it, and leaves smoke and a scorched ring (#190).
              v.light = { x: sx, y: sy + 8, radius: 96, strength: 1 };
              this.lightAge = 0;
              this.screen.markScorch(sx, sy + 12, true);
              this.burst('smoke', [sx, sy + 4], 1.4);
            }
            // The stacks it hurts cry out (two at most, not a whole choir); those it kills cry as they fall.
            for (const { h } of victims.filter((x) => x.h.damage > 0 && !x.dies).slice(0, 2)) {
              play(`hurt:${TROOP_SOUNDS[fighterById(this.battle, h.target).troop].cry}`, this.panAt(this.spot(h.target)[0]), 0.08);
            }
            for (const id of changes) {
              v.looks.delete(id);
              this.puff(id);
            }
            for (const { h, remaining } of victims) {
              this.counted(h.target, remaining);
              if (h.healed) this.float(h.target, h.raised && !this.named(h.target) ? `+${h.raised}` : `+${h.healed} hp`, GOLD[6]);
              if (status) this.float(h.target, status.name, BLUE[6]);
              if (!h.damage) continue;
              v.poses.set(h.target, { anim: 'defendRanged', ms: 0 });
              if (!isGentle()) v.whites.add(h.target);
              this.pop(h.target, h.killed, h.damage);
            }
            if (e.damage && look.kind !== 'sparkle') {
              if (!isGentle()) v.shake = Math.max(v.shake, look.kind === 'fire' ? 5 : 4);
              play(victims.some((x) => x.h.killed) ? 'thump:heavy' : 'thump:light', this.panAt(this.spot(e.target)[0]));
            }
          };
          const length = look.kind === 'fire' ? 0.95 : look.kind === 'missile' ? 0.55 : 0.4;
          // Stacks it wipes out fall over before the spell is done (#190), together, crying out as
          // they go (two at most, not a whole choir): as the flames thin, or as the bolt strikes.
          const dead = victims.filter((x) => x.dies).map((x) => x.h.target);
          const fallers = dead.map((id) => this.faller(id));
          const fallFrom = Math.max(land, 1 - (TOPPLE_TIME + FRAME) / length);
          let falling = false;
          this.step(length, {
            start: () => {
              v.shots.push(...shots);
              if (look.kind === 'fire') play('whoosh', this.panAt(hexCentre(target.at)[0]));
              // An order was bellowed for all to hear: the ribbon keeps his words.
              if (!spell.shout) v.log = this.spellLine(e, victims.length);
              if (!land) impact();
            },
            tick: (t) => {
              for (const shot of shots) shot.t = t;
              if (!landed && t >= land) impact();
              if (!falling && fallers.length && t >= fallFrom) {
                falling = true;
                for (const id of dead.slice(0, 2)) this.deathCry(id);
                for (const f of fallers) f.start();
              }
              if (falling) for (const f of fallers) f.tick((t - fallFrom) * length);
              // The spell lands white for a frame (#190), then burns in two red pulses, as Wesnoth flashes a unit that is hit.
              const k = landed ? ((t - land) / (1 - land)) * 0.95 : 0;
              const white = landed && (sinceLanding++ < 1 || (t - land) * length < FRAME);
              for (const { h } of victims) {
                if (!h.damage) continue;
                if (!white) v.whites.delete(h.target);
                v.flashing[!white && pulse(k) ? 'add' : 'delete'](h.target);
              }
            },
            end: () => {
              for (const shot of shots) v.shots.splice(v.shots.indexOf(shot), 1);
              for (const { h, dies } of victims) {
                v.flashing.delete(h.target);
                v.whites.delete(h.target);
                if (!dies) v.poses.delete(h.target);
              }
              for (const f of fallers) f.end();
            },
          });
          break;
        }
        case 'wait':
        case 'defend': {
          // A leader has nothing to defend against: he lets his turn pass.
          const passes = e.type === 'defend' && isLeader(fighterById(this.battle, e.fighter));
          // Sir Aldric with nobody in his reach says so, unless the ribbon is still teaching the fight's first turn.
          const idle = this.passing?.fighter === e.fighter ? this.passing : null;
          const words = idle ? `Nobody is within ${this.fighterName(e.fighter)}\u2019s reach${e.type === 'wait' ? ' yet, so he waits' : ', so he bides his time'}.` : null;
          // On the fight's first turn it goes by unseen, so the first of your stacks is ready the moment the field opens.
          if (idle?.quiet) break;
          this.step(e.type === 'defend' && !passes ? 0.45 : 0.25, {
            start: () => {
              this.float(e.fighter, e.type === 'wait' || passes ? 'waits' : 'defends', NEUTRAL[7]);
              v.log = words ?? `${this.fighterName(e.fighter)} ${this.verb(e.fighter, e.type === 'wait' ? 'wait for a better moment' : passes ? 'bide his time' : this.named(e.fighter) ? 'stand guard' : 'raise their shields')}.`;
              if (e.type === 'defend' && !passes) v.poses.set(e.fighter, { anim: 'defend', ms: 0 });
            },
            end: () => v.poses.delete(e.fighter),
          });
          break;
        }
        case 'round':
          this.step(0.05, { start: () => (v.log = `Round ${e.round}.`) });
          break;
        case 'falter': {
          // Low spirits: a jeer, or the company it keeps ("uneasy beside the Wolves").
          const why = uneasyWords(spiritsOf(this.battle, fighterById(this.battle, e.fighter)));
          this.step(0.6, {
            start: () => {
              play('falter');
              const f = fighterById(this.battle, e.fighter);
              const [x, y] = this.spot(e.fighter);
              // A little grey cloud sits over it and drizzles (#190): the ribbon says why.
              this.burst('cloud', [x, y + 12 - bodyHeight(f.troop, 'battle') - 6], 1.2);
              if (!isLeader(f)) v.offsets.set(e.fighter, [0, 2]);
              v.log = `${this.fighterName(e.fighter)} ${this.verb(e.fighter, 'lose')} heart${why ? `, ${why},` : ''} and ${this.named(e.fighter) ? 'his' : 'their'} turn.`;
              v.poses.set(e.fighter, { anim: 'defend', ms: 0 });
            },
            end: () => {
              v.poses.delete(e.fighter);
              v.offsets.delete(e.fighter);
            },
          });
          break;
        }
        case 'bribe': {
          // They stay as they were till the coins change hands: then they go home, or come over in your colours.
          const target = fighterById(this.battle, e.target);
          const [tx, ty] = hexCentre(target.at);
          const joined = e.joined;
          if (target.count > 0) {
            // Only some of them took the gold: they slip away, or over to his edge of the field, and the rest stand.
            v.counts.set(e.target, target.count + e.count);
            if (joined !== undefined) v.hidden.add(joined);
            this.flourish(e.fighter, 'idle', () => {
              play('coins');
              this.float(e.fighter, `\u2212${coins(e.gold)} gold`, GOLD[6]);
              v.log = `${this.fighterName(e.fighter)} pays ${e.count} of ${this.objectName(e.target)} ${coins(e.gold)} gold, ${joined === undefined ? 'and they shoulder their weapons and go home.' : 'and they turn their coats and fight for you!'}`;
            });
            this.step(0.35, {
              start: () => {
                v.counts.delete(e.target);
                this.float(e.target, `\u2212${e.count}`, GOLD[6]);
                if (joined === undefined) return;
                v.hidden.delete(joined);
                this.puff(joined);
                this.float(joined, `+${e.count}`, GOLD[6]);
              },
            });
            break;
          }
          v.dying.add(e.target);
          v.counts.set(e.target, e.count);
          if (joined !== undefined) v.hidden.add(joined);
          this.flourish(e.fighter, 'idle', () => {
            play('coins');
            this.float(e.fighter, `\u2212${coins(e.gold)} gold`, GOLD[6]);
            v.log = `${this.fighterName(e.fighter)} pays ${this.objectName(e.target)} ${coins(e.gold)} gold, ${joined === undefined ? 'and they shoulder their weapons and go home.' : 'and they turn their coats and fight for you!'}`;
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
          const said = fighterById(this.battle, e.fighter).side === 'player' ? JEERS : HECKLES;
          const jeer = said[(e.target + this.battle.round) % said.length];
          this.flourish(e.fighter, 'cast', () => {
            play('jeer');
            this.float(e.fighter, jeer, NEUTRAL[7]);
            v.log = `${this.fighterName(e.fighter)} jeers at ${this.objectName(e.target)}, \u201c${jeer}\u201d They lose heart.`;
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
            const whose = fighterById(this.battle, e.fighter).side === 'player' ? 'your' : 'their';
            v.log = `${this.fighterName(e.fighter)} strikes up ${status.song}, and ${whose} stacks ${status.luck ? 'feel lucky' : 'take heart'}.`;
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
        case 'skip': {
          const status = STATUSES[e.status];
          if (status.look) v.looks.set(e.fighter, status.look);
          this.step(0.8, {
            start: () => {
              this.float(e.fighter, status.name, GOLD[6]);
              v.log = `${this.fighterName(e.fighter)} ${this.named(e.fighter) ? 'loses a turn' : 'lose their turn'}, because ${status.name.toLowerCase()} can\u2019t do much. Then the spell wears off.`;
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
          // Your stacks still standing, who cheer at a victory, one after another from the top of the field.
          const cheering = this.battle.fighters
            .filter((f) => f.side === 'player' && f.count > 0 && !isLeader(f))
            .sort((x, y) => hexCentre(x.at)[1] - hexCentre(y.at)[1])
            .map((f) => f.id);
          // A villain taken has the last word, in his own voice, and the fight stops on it; one with his
          // walls to run to has a parting shot before he goes.
          const words = e.result === 'won' && leaders.length ? this.battle.lastWords : undefined;
          if (words && this.battle.flees) this.say(leaders[0].id, words);
          this.step(2.2, {
            start: () => {
              const [title, line] =
                e.result === 'won' ? ['VICTORY', end?.leader ?? (e.rout ? 'The rest of them run for it' : 'The field is yours')] : e.result === 'lost' ? ['DEFEAT', end?.leader ?? 'Your army breaks and scatters'] : ['RETREAT', 'You live to fight another day'];
              v.banner = { sprite: paintBanner(title, capital(line)), age: 0, life: 2.2 };
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
              for (const f of leaders) this.float(f.id, e.result === 'won' ? (this.battle.flees ? 'Flees!' : 'Taken!') : 'Retreats!', e.result === 'won' ? GOLD[6] : RED[5]);
              if (e.result !== 'fled') play(e.result === 'won' ? 'victory' : 'defeat');
              // A victory you can feel (#190): your stacks cheer, the King's star flaps hard, theirs falls, and gold drifts up over the field.
              if (e.result === 'won') {
                v.ending.fast = true;
                this.burst('motes', [0, 0], 2.2);
                this.react('enemy');
              }
            },
            tick: (t) => {
              const seconds = t * 2.2;
              if (e.result === 'won') {
                // Theirs tips over and comes to rest leaning on the trees, not flat across the field.
                v.ending.fall = toppleAngle(Math.max(0, seconds - 0.3)) * 0.8;
                cheering.forEach((id, i) => {
                  const hop = victoryHop(seconds, i);
                  if (hop) v.offsets.set(id, [0, -hop]);
                  else v.offsets.delete(id);
                });
              } else if (e.result === 'lost') {
                // A defeat: your standard dips, and the field darkens a shade.
                v.ending.dip = Math.min(1, seconds / 0.6) * 35;
                v.ending.dusk = Math.min(1, seconds / 1.2);
              }
              for (const f of leaders) {
                // The villain throws up his hands, or, with his walls to run to, turns and flees; Aldric turns and rides off the field.
                if (e.result === 'won' && !this.battle.flees) {
                  v.poses.set(f.id, { anim: 'defend', ms: 0 });
                  continue;
                }
                const [x, y] = this.spot(f.id);
                const k = Math.min(1, t / 0.4);
                const hop = ART[f.troop].move ? 0 : Math.abs(Math.sin(k * Math.PI * 5)) * 3;
                const away = f.side === 'player' ? -1 : 1;
                const edge = away < 0 ? MAP_VIEW.x - 70 : MAP_VIEW.x + MAP_VIEW.width + 70;
                v.facings.set(f.id, away);
                v.positions.set(f.id, [x + (edge - x) * k, y - hop]);
                v.poses.set(f.id, ART[f.troop].move ? { anim: 'move', ms: t * 2200 } : STAND);
                if (k >= 1) v.hidden.add(f.id);
              }
            },
          });
          if (words && !this.battle.flees) this.say(leaders[0].id, words);
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
    v.floaters = v.floaters.filter((f) => f.age < FLOAT_LIFE);
    for (const p of v.pops) p.age += dt;
    v.pops = v.pops.filter((p) => p.age < POP_LIFE);
    for (const [id, roll] of v.rolls) if ((roll.age += dt * pace) >= ROLL + FRAME) v.rolls.delete(id);
    v.time += dt;
    v.flash = Math.max(0, v.flash - dt);
    if (v.light) {
      this.lightAge += dt * pace;
      v.light.strength = Math.max(0, 1 - this.lightAge / 0.6);
      if (!v.light.strength) v.light = null;
    }
    if (v.cue) {
      v.cue.age += dt;
      const bounce = cueBounce(v.cue.age);
      if (bounce) v.lifts.set(v.cue.fighter, bounce);
      else if (!this.reactions.has(v.cue.fighter)) v.lifts.delete(v.cue.fighter);
      if (v.cue.age >= CUE_PING) v.cue = null;
    }
    v.shake = isGentle() ? 0 : Math.max(0, v.shake - dt * 20);
    v.kick = kickLeft(v.kick, dt);
    if (v.banner) v.banner.age += dt * pace;
    for (const spark of this.sparks) spark.t += dt * pace * (spark.rate ?? 4);
    // The rest of a volley: in flight once its beat comes, landing on the stack or in the ground.
    for (const f of this.flights) {
      f.age += dt * pace;
      const t = (f.age - f.delay) / f.flight;
      if (t <= 0) continue;
      if (!v.shots.includes(f.shot)) v.shots.push(f.shot);
      f.shot.t = Math.min(1, t);
      if (t < 1) continue;
      v.shots.splice(v.shots.indexOf(f.shot), 1);
      const at: [number, number] = [Math.round(f.shot.to[0]), Math.round(f.shot.to[1])];
      const burst: Shot = f.hits ? { from: at, to: at, t: 0, kind: 'spark', size: 0.6, heading: Math.atan2(f.shot.to[1] - f.shot.from[1], f.shot.to[0] - f.shot.from[0]) } : { from: at, to: at, t: 0, kind: 'dust', size: 12, rate: 3 };
      v.shots.push(burst);
      this.sparks.push(burst);
      if (!f.hits) this.screen.markArrow(f.shot.from, at, f.shot.arc ?? 44, f.bolt);
    }
    this.flights = this.flights.filter((f) => (f.age - f.delay) / f.flight < 1);
    for (const [id, r] of this.reactions) {
      r.age += dt * pace;
      const done = r.age >= (r.joy ? 0.5 : 0.7);
      if (done) {
        this.reactions.delete(id);
        v.lifts.delete(id);
      } else v.lifts.set(id, r.joy ? Math.round(Math.abs(Math.sin((r.age / 0.5) * Math.PI * 2)) * 6) : -2);
    }
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
          this.perform(chooseAction(this.battle), f.side === 'player');
        }
      } else if (f && this.idleRider(f)) {
        // Nobody in Sir Aldric's reach: he waits, and once he has waited, the rules let the round go by (#211).
        // It isn't one of your moves, so the fight's first turn of yours still has no cue, and the ribbon still says what to do.
        const first = !this.acted;
        this.passing = { fighter: f.id, quiet: first };
        this.perform({ type: 'wait' });
        this.passing = null;
        this.acted = !first;
      }
    }
    if (this.queue.length === 0) this.updateFinishOffer();
    const mine = !!f && f.side === 'player' && !this.auto && this.queue.length === 0 && !this.battle.volley;
    // One of your stacks is ready for orders (#190): it bounces, its hex pings, and a soft tap says so.
    // Not on the fight's first turn, where the ribbon says what to do, nor while the sergeants have command.
    const turn = mine && f && !this.battle.result ? `${this.battle.round}/${f.id}/${this.battle.order.length}` : null;
    if (turn && turn !== this.cued) {
      this.cued = turn;
      if (this.acted) {
        v.cue = { fighter: f!.id, age: 0 };
        play('ready');
      }
    }
    // Where the acting stack can walk to, or how far a leader who rides out can ride.
    const opts = mine && !v.targeting ? options(this.battle) : null;
    v.reach = opts ? new Set([...opts.moves.keys(), ...(opts.rides?.keys() ?? [])]) : new Set();
    // A bard's Defend button sings instead.
    v.bard = mine && !!f && !!bardOf(f);
    // What a first tap showed goes as soon as anything happens: a second tap there would mean something else now.
    if (this.armed && (this.armed.battle !== this.battle || this.armed.targeting !== v.targeting)) {
      this.armed = null;
      this.pointer = null;
      this.label.hide();
      this.unaim();
      v.inspect = null;
    }
    if (this.pointer && mine) this.hoverAt(...this.pointer);
    else if (!mine) this.unaim();
  }

  /** Nothing aimed at: no hex outlined, no stack lit, no tag, and the plain pointer. */
  private unaim() {
    this.view.hover = null;
    this.view.preview = null;
    this.view.lit = UNLIT;
    this.tag.hide();
    this.setCursor('default');
  }

  /** Sets the canvas's pointer, and its name for scripts. */
  private setCursor(css: string, name = css) {
    this.pointerName = name;
    if (css === this.cursor) return;
    this.cursor = css;
    this.display.canvas.style.cursor = css;
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
  private intent(hex: number, x: number, y: number): Intent | null {
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
        const from = sideAt(x, y, occupant.at, sides.map((m) => m.from), f.at)!;
        return { action: { type: 'melee', target: occupant.id, from }, kind: 'melee' };
      }
      return null;
    }
    if (!occupant && opts.moves.has(hex)) return { action: { type: 'move', to: hex }, kind: 'move' };
    return null;
  }

  private hoverAt(x: number, y: number) {
    const v = this.view;
    const hex = hexAt(x, y);
    const intent = hex === null ? null : this.intent(hex, x, y);
    v.hover = intent && hex !== null ? { hex, kind: intent.kind, ...(intent.action.type === 'melee' ? { from: intent.action.from } : {}) } : null;
    // A stack on its hex, or a leader behind the line: the bar shows who he is.
    const leader = leaderAt(this.battle, x, y);
    v.inspect = leader ? leader.id : hex === null ? null : (this.battle.fighters.find((f) => onField(f) && f.at === hex)?.id ?? null);
    const under = v.inspect === null ? null : fighterById(this.battle, v.inspect);
    const aim = this.aimAt(intent);
    v.preview = aim ? aim.line : under?.book || under?.level ? this.leaderLine(under.id) : under ? this.spiritsLine(under.id) : null;
    v.lit = aim?.lit ?? UNLIT;
    const pointer = this.pointerFor(intent, aim, hex !== null || leader !== null, x, y);
    this.setCursor(pointer.css, pointer.name);
    this.showTag(intent, aim, hex);
  }

  /** What pointing at `intent` shows, worked out once for each thing a click could do. */
  private aimAt(intent: Intent | null): Aim | null {
    if (!intent) return null;
    const key = JSON.stringify(intent.action);
    if (this.aim?.battle === this.battle && this.aim.key === key) return this.aim;
    const { action } = intent;
    const f = activeFighter(this.battle)!;
    // Everyone a spell would catch is lit, and your own it would hurt are lit red.
    const lit = new Map<number, 'target' | 'danger'>();
    if (action.type === 'cast' && action.target !== undefined) {
      const harms = SPELLS[action.spell].on === 'enemy';
      for (const caught of spellVictims(this.battle, action.spell, fighterById(this.battle, action.target), action.by)) lit.set(caught.id, harms && caught.side === f.side ? 'danger' : 'target');
    } else if (action.type === 'melee' || action.type === 'shoot' || action.type === 'jeer') lit.set(action.target, 'target');
    const tag = action.type === 'jeer' ? bardTag(this.battle, fighterById(this.battle, action.target)) : action.type === 'move' ? { title: 'Move here', lines: [] } : aimTag(this.battle, action);
    const charge = action.type === 'melee' && isCharge(this.battle, f, action.from, undefined, fighterById(this.battle, action.target));
    this.aim = { battle: this.battle, key, tag, lit, line: this.forecast(action), charge };
    return this.aim;
  }

  /**
   * The pointer for what a click would do (#156): a sword or a lance pointing the way the blow goes
   * in, a bow, boots (a horseshoe for riders, a paw for beasts), the spell's sign, a bard's lute, and
   * on your turn, "no" wherever on the field a click would do nothing.
   */
  private pointerFor(intent: Intent | null, aim: Aim | null, onTheField: boolean, x: number, y: number): { name: string; css: string } {
    const f = activeFighter(this.battle);
    const mine = !!f && f.side === 'player' && !this.auto && this.queue.length === 0 && !this.battle.volley;
    const icon = (kind: CursorKind, heading?: Heading) => ({ name: heading ? `${kind}:${heading}` : kind, css: cursorCss(kind, heading) });
    if (!intent || !f) {
      if (BUTTONS.some(({ rect: r }) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height)) return { name: 'pointer', css: 'pointer' };
      return mine && onTheField ? icon('no') : { name: 'default', css: 'default' };
    }
    const { action } = intent;
    if (action.type === 'move') {
      const feet = TROOP_SOUNDS[f.troop].feet;
      return icon(feet === 'hooves' ? 'horseshoe' : feet === 'paws' || feet === 'trotters' ? 'paw' : 'boot');
    }
    if (action.type === 'melee') return icon(aim?.charge ? 'lance' : 'sword', headingOf(action.from, fighterById(this.battle, action.target).at));
    if (action.type === 'shoot') return icon('bow');
    if (action.type === 'cast') {
      const look = SPELLS[action.spell].look.kind;
      return icon(look === 'fire' ? 'flame' : look === 'bolt' ? 'lightning' : 'wand');
    }
    return icon('lute');
  }

  /**
   * The tag beside what a click would land on (#156): the stacks it lights, or played by touch, the
   * hex a stack would move to, and after a first tap, what the second does. Not over a card.
   */
  private showTag(intent: Intent | null, aim: Aim | null, hex: number | null) {
    const moving = intent?.action.type === 'move';
    // A move gets only its pointer from a mouse; a finger's first tap (on any screen) gets the tag too.
    if (!intent || !aim?.tag || hex === null || (moving && !touch() && this.armed?.hex !== hex) || this.cards.isOpen) return this.tag.hide();
    // Round the stacks aimed at, each from its head to its feet, or round the hex it would move to.
    const boxes = moving
      ? [[...hexCentre(hex), 26, 26] as const]
      : [...aim.lit.keys()].map((id) => {
          const f = fighterById(this.battle, id);
          const [cx, cy] = hexCentre(f.at);
          return [cx, cy, bodyHeight(f.troop, 'battle') - 12, 22] as const;
        });
    const from = this.display.toPage(Math.min(...boxes.map(([cx]) => cx)) - 30, Math.min(...boxes.map(([, cy, up]) => cy - up)));
    const to = this.display.toPage(Math.max(...boxes.map(([cx]) => cx)) + 30, Math.max(...boxes.map(([, cy, , down]) => cy + down)));
    const box: PageBox = { left: from.x, top: from.y, right: to.x, bottom: to.y };
    const top = this.display.toPage(MAP_VIEW.x, LOG_BOTTOM + 24);
    const end = this.display.toPage(MAP_VIEW.x + MAP_VIEW.width, MAP_VIEW.y + MAP_VIEW.height);
    // Clear of a blow's way in: across the stack from the hex it is struck from, first to the side, then above or below.
    const sides: TagSide[] = ['right', 'left', 'above', 'below'];
    if (intent.action.type === 'melee') {
      const [[fx, fy], [tx, ty]] = [hexCentre(intent.action.from), hexCentre(hex)];
      const [away, toward] = fx > tx ? (['left', 'right'] as const) : (['right', 'left'] as const);
      sides.splice(0, 4, away, ...(fy < ty ? (['below', 'above'] as const) : (['above', 'below'] as const)), toward);
    }
    const hint = this.armed?.hex === hex ? (aim.charge ? 'Tap again to charge.' : SECOND_TAP[intent.kind]) : '';
    this.tag.show(aim.tag, hint || null, box, sides, { left: top.x, top: top.y, right: end.x, bottom: end.y });
  }

  /** A stack's luck and morale, and why, for when you look it over: nothing if it has neither. */
  private spiritsLine(id: number): string | null {
    const s = spiritsOf(this.battle, fighterById(this.battle, id));
    const shares = [s.luck ? `luck ${signedShare(s.luck)}` : '', s.morale || s.uneasy.length ? `morale ${signedShare(s.morale)}` : ''].filter(Boolean);
    if (!shares.length) return null;
    // One gift is named; several are Aldric's, and his hero screen says which. Songs and jeers are named too.
    const gifts = s.gifts.length === 1 ? s.gifts[0].source : s.gifts.length ? `from ${this.battle.hero.name ?? 'Aldric'}` : '';
    const why = [gifts, ...s.moods.map((m) => m.source), uneasyWords(s)].filter(Boolean).join('; ');
    return `${this.fighterName(id)}: ${shares.join(', ')}${why ? ` (${why})` : ''}.`;
  }

  /**
   * A villain's or an enemy hero's spells and orders, for when you look him over, and a hero's level and
   * what it lends his men (#239): "The Sergeant, level V: +2 attack and +2 defence for his men. Orders Shield wall!"
   */
  private leaderLine(id: number) {
    const f = fighterById(this.battle, id);
    const book = f.book;
    const spells = (book?.spells ?? []).map((s) => SPELLS[s].name);
    const orders = (book?.charges ?? []).filter((c) => c.uses > 0 && c.spell in SPELLS).map((c) => `${SPELLS[c.spell].shout?.words ?? SPELLS[c.spell].name}${c.uses > 1 ? ` x${c.uses}` : ''}`);
    // His mana is on the bar below while you look him over, so a hero's line leaves it out and fits the ribbon.
    const magic = (mana: boolean) => [spells.length ? `spells ${spells.join(', ')}${mana ? ` (${book!.mana} mana)` : ''}` : '', orders.length ? `orders ${orders.join(' ')}` : ''].filter(Boolean).join('; ');
    if (!f.level) return `${this.fighterName(id)}: ${magic(true)}`;
    const { attack, defence } = heroHelp(f.level);
    const lends = listed([attack ? `+${attack} attack` : '', defence ? `+${defence} defence` : ''].filter(Boolean));
    const knows = magic(false);
    return `${this.fighterName(id)}, level ${roman(f.level)}: ${lends ? `${lends} for his men` : 'nothing yet for his men'}.${knows ? ` ${capital(knows)}${/[.!?]$/.test(knows) ? '' : '.'}` : ''}`;
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
      if (!damage) return `${SPELLS[action.spell].name} on ${blessesAll(this.battle, action.spell, action.by) ? 'every stack of yours' : whom}.`;
      const [, ...caught] = spellVictims(this.battle, action.spell, target);
      const ours = caught.filter((c) => c.side === 'player').map((c) => TROOPS[c.troop].name.toLowerCase());
      const theirs = caught.length - ours.length;
      const more = [theirs ? `${theirs} more of theirs` : '', ours.length ? `your own ${listed(ours)}!` : ''].filter(Boolean).join(', and ');
      const killed = wound(target, damage).killed;
      const fell = killed ? `${killed} of ${whom} ${killed === 1 ? 'perishes' : 'perish'}` : `none of ${whom} perish`;
      return `${SPELLS[action.spell].name}: ${damage} damage, and ${fell}.${more ? ` It also hits ${more}` : ''}`;
    }
    if (action.type !== 'melee' && action.type !== 'shoot') return null;
    // The rules' own reckoning, first strikes and all: the tag by the pointer says the same.
    const forecast = forecastOf(this.battle, action);
    if (!forecast) return null;
    const ranged = action.type === 'shoot';
    const leader = isLeader(f);
    const { charge } = forecast;
    const first = forecast.first ? ' They will strike first.' : '';
    const back = forecast.back ? ' They will strike back.' : '';
    // A leader's blow gets no answer: nothing can reach him, and he's back behind the line before they turn.
    // The ribbon has room for one line: the tag by the stack says what a charge costs the chargers.
    const after = leader && !ranged ? ` ${this.fighterName(f.id)} rides back behind the line, and nobody can strike back.` : charge ? ' Nobody can strike back at a charge.' : '';
    return `${charge ? 'Charge! ' : ''}${ranged ? 'Shoot' : 'Attack'} ${whom}: about ${forecast.target.damage} damage, ${perish(forecast.target.killed)}.${first}${back}${after}`;
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
      const costs = estimate?.losses.map(({ troop, count }) => `~${troops(troop, count)}`);
      this.finishLine = estimate
        ? `Finish it? The sergeants take over, and you\u2019d likely lose ${costs!.length ? listed(costs!) : 'nobody'}.`
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

  /**
   * The spellbook: each spell is its own button, with its price on it as the armoury's wares have
   * theirs, and what it does under it (#226). One he can't cast now shows greyed, and its price says
   * how much mana he is short.
   */
  private openSpellbook() {
    const { hero } = this.battle;
    const spells = spellsOf(this.battle).map((id) => SPELLS[id]);
    const left = castsLeft(this.battle);
    // A charge (a wand's bolt) costs no mana: its button says how many are left instead.
    const price = (id: SpellId) => {
      const charge = chargeOf(this.battle, id);
      return charge ? `${charge.uses} ${charge.uses === 1 ? 'charge' : 'charges'} left` : `${spellCost(this.battle, id)} mana`;
    };
    const short = (id: SpellId) => (left > 0 && !chargeOf(this.battle, id) ? spellCost(this.battle, id) - hero.mana : 0);
    const casts = (hero.casts ?? 1) > 1 ? (left > 0 ? `You can cast two spells a round, and have ${left} left this round.` : 'You can cast two spells a round, and you have cast both this round.') : left > 0 ? 'You can cast one spell a round.' : 'You can cast one spell a round, and you have cast it.';
    this.cards.show({
      title: 'Spellbook',
      lines: [manaInBattle(hero.mana, hero.maxMana), casts],
      choices: [
        ...spells.map((s) => ({
          // Too dear, the price says how far short he is, so the book still fits without scrolling.
          label: `Cast ${s.name} (${price(s.id)}${short(s.id) > 0 ? `, ${short(s.id)} short` : ''})`,
          detail: s.note,
          disabled: !canCast(this.battle, s.id),
          action: { type: 'spell' as const, spell: s.id },
        })),
        { label: 'Close', action: { type: 'close' } },
      ],
    });
  }

  /**
   * Played by touch, down the sides: Spells, Wait and Defend (or Sing) on the left, Retreat and Auto
   * (or Finish) on the right, as on the battle bar. While a spell waits for its target, Spells cancels it.
   */
  buttons(): SideButton[] {
    const f = activeFighter(this.battle);
    const mine = !!f && f.side === 'player' && this.queue.length === 0 && !this.auto && !this.battle.volley && !this.battle.result;
    const bard = mine && !!bardOf(f);
    const aiming = Boolean(this.view.targeting);
    const castable = Object.values(SPELLS).some((spell) => canCast(this.battle, spell.id));
    return [
      { id: 'spells', label: aiming ? 'Cancel' : 'Spells', icon: 'spells', side: 'left', enabled: mine && (aiming || castable), on: aiming, press: () => (aiming ? this.input.key('escape') : this.button('spells')) },
      { id: 'wait', label: 'Wait', icon: 'wait', side: 'left', enabled: mine, press: () => this.button('wait') },
      { id: 'defend', label: bard ? 'Sing' : 'Defend', icon: bard ? 'sing' : 'defend', side: 'left', enabled: mine, press: () => this.button('defend') },
      { id: 'retreat', label: 'Retreat', icon: 'retreat', side: 'right', enabled: mine, press: () => this.button('retreat') },
      { id: 'auto', label: this.view.finishOffer ? 'Finish' : 'Auto', icon: 'auto', side: 'right', enabled: !this.battle.result, on: this.auto, press: () => this.button('auto') },
    ];
  }

  /**
   * Played by touch, a tap on a stack a click wouldn't touch says who it is, over the field in words.
   * Anything a tap would do, the tag beside it says, and what a second tap does.
   */
  private tell(x: number, y: number, intent: Intent | null) {
    if (intent && this.tag.text) return;
    const v = this.view;
    const under = v.inspect === null ? null : fighterById(this.battle, v.inspect);
    const who = under ? (this.named(under.id) ? capital(TROOPS[under.troop].name) : this.fighterName(under.id, under.count)) : null;
    // Without the tag, the label says it all, and what a second tap does.
    const text = [intent?.kind === 'move' ? 'Move here.' : (v.preview ?? who), intent ? SECOND_TAP[intent.kind] : ''].filter(Boolean).join(' ');
    if (!text) return;
    const at = this.display.toPage(x, y);
    this.label.show(text, at.x, at.y);
  }

  /** Does what a click (or a second tap) on a hex means: a bard's turn asks what to do with them first. */
  private act(intent: Intent) {
    if (intent.kind === 'bard' && intent.action.type === 'jeer') this.bardCard(intent.action.target);
    else this.perform(intent.action);
  }

  readonly input = {
    click: (x: number, y: number, tapped?: boolean) => {
      // A click moves on from a villain's last words.
      if (this.view.speech && this.queue.length) {
        this.queue[0].elapsed = this.queue[0].duration;
        return;
      }
      const button = BUTTONS.find((b) => x >= b.rect.x && x < b.rect.x + b.rect.width && y >= b.rect.y && y < b.rect.y + b.rect.height);
      if (button) return this.button(button.id);
      const hex = hexAt(x, y);
      const intent = hex === null ? null : this.intent(hex, x, y);
      if (tapped && intent?.kind !== 'bard') {
        // The second tap on a hex does what the first showed, if nothing has happened since.
        const armed = this.armed;
        this.armed = null;
        this.label.hide();
        if (armed && armed.hex === hex && armed.battle === this.battle && armed.targeting === this.view.targeting) {
          this.pointer = null;
          this.unaim();
          return this.act(armed.intent);
        }
        this.pointer = [x, y];
        if (intent && hex !== null) this.armed = { hex, intent, battle: this.battle, targeting: this.view.targeting };
        this.hoverAt(x, y);
        this.tell(x, y, intent);
        return;
      }
      if (intent) this.act(intent);
    },
    hover: (x: number, y: number) => {
      this.pointer = [x, y];
      this.hoverAt(x, y);
    },
    drag: () => {},
    leave: () => {
      // What a first tap showed stays up for the second.
      if (this.armed) return;
      this.label.hide();
      this.pointer = null;
      this.unaim();
      this.view.inspect = null;
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
      // Sir Aldric's turn with nobody in his reach passes by itself, so a script waits for it as for any move.
      busy: () => {
        const f = activeFighter(this.battle);
        return this.queue.length > 0 || (!!f && !this.battle.result && !this.battle.volley && this.idleRider(f));
      },
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
      /** Where a hex's middle is on the page, for a script to tap it as a finger would. */
      hexOnPage: (hex: number) => this.display.toPage(...hexCentre(hex)),
      /** What the battle says about what's under a finger: the tag beside what a tap would do, or else the label. */
      label: () => this.tag.text ?? this.label.text,
      /** The tag beside what a click would land on, while it shows, and the pointer's name ("sword:e", "bow", "no"). */
      tag: () => this.tag.text,
      pointer: () => this.pointerName,
      /** The stacks lit by what the pointer is aimed at: `target` or `danger`. */
      lit: () => Object.fromEntries(this.view.lit),
    };
  }
}
