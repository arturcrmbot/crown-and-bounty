import { SPELLS, type SpellId } from '../content/spells';
import { TROOPS, troops } from '../content/troops';
import { chooseAction } from '../rules/battle/ai';
import { activeFighter, battleAct, canCast, castsLeft, CHARGE_BONUS, fighterById, isCharge, options, spellCost, spellDamage, spellVictims, strike, wound, type BattleAction, type BattleEvent, type BattleState } from '../rules/battle/battle';
import { paintBanner } from '../render/banner';
import { BattleScreen, BUTTONS, FIRE_FALL, FLOAT_RISE, hexAt, hexCentre, LOG_BOTTOM, type BattleView, type Shot } from '../render/battleScreen';
import { animLength, bodyHeight, hitTime, type AnimName } from '../render/battleSprites';
import { ART } from '../render/units';
import { MAP_VIEW } from '../render/frame';
import { BLUE, GOLD, NEUTRAL, RED } from '../render/palette';
import { CardView } from '../ui/card';
import { play } from '../ui/sound';
import type { Display } from './display';
import type { Screen } from './screen';

type Step = { duration: number; elapsed: number; started: boolean; start?: () => void; tick?: (t: number) => void; end?: () => void };

const ENEMY_THINK = 0.35;
/** Floaters start at least this low, so they rise and fade under the message ribbon, never into it. */
const FLOAT_TOP = LOG_BOTTOM + FLOAT_RISE + 2;
/** Wesnoth's animation milliseconds as our seconds: its own timing, a touch brisker. */
const MS = 0.00085;
/** Wesnoth's flinch starts a little before the blow lands. */
const FLINCH_EARLY = 126;
/** Wesnoth pulses a unit red twice when it is hit: on for each of these stretches of the first 300 ms. */
const pulse = (k: number) => (k > 0.05 && k < 0.35) || (k > 0.55 && k < 0.85);

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
      if (action.type === 'spell') this.view.targeting = action.spell;
      else if (action.type === 'retreat') this.perform({ type: 'retreat' });
    });
    this.view = {
      positions: new Map(),
      offsets: new Map(),
      facings: new Map(),
      counts: new Map(),
      poses: new Map(),
      flashing: new Set(),
      dying: new Set(),
      reach: new Set(),
      hover: null,
      floaters: [],
      shots: [],
      log: 'To battle! Click a hex to move, or an enemy to attack.',
      active: activeFighter(battle)?.id ?? null,
      inspect: null,
      preview: null,
      targeting: null,
      time: 0,
      shake: 0,
      banner: null,
    };
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

  private step(duration: number, parts: Omit<Step, 'duration' | 'elapsed' | 'started'>) {
    this.queue.push({ duration, elapsed: 0, started: false, ...parts });
  }

  /**
   * Words that rise from a stack and fade. Ones that come close together stack up instead of
   * overlapping, however long the words; near the top of the field, where there's no room above,
   * they stack down over the stack.
   */
  private float(id: number, text: string, color: number) {
    const f = fighterById(this.battle, id);
    // Over the stack's own hex, not wherever a blow has knocked it, so it never lands on the attacker.
    const [x, y] = hexCentre(f.at);
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
    const [x, y] = hexCentre(f.at);
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

  /** Which way a stack looks when nothing turns it: towards the enemy's side. */
  private facingOf(f: { side: string }): 1 | -1 {
    return f.side === 'player' ? 1 : -1;
  }

  /** A stack that goes down leaves a puff of dust, then its fallen. */
  private poof(target: number) {
    const [x, y] = hexCentre(fighterById(this.battle, target).at);
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

  /** Takes `killed` from what is left of a stack; true when that was the last of them. */
  private wound(left: Map<number, number>, id: number, killed: number): boolean {
    const was = left.get(id) ?? 0;
    left.set(id, Math.max(0, was - killed));
    return was > 0 && was - killed <= 0;
  }

  /**
   * One blow or shot, played as Wesnoth plays it. The attacker runs its attack frames (lunging in at
   * close quarters); at the frame where the blow lands, and not before, come the flash, the sound,
   * the numbers and the jolt; the target flinches, reels and pulses red twice.
   */
  private strike(e: Extract<BattleEvent, { type: 'hit' }>, left: number, dies: boolean) {
    const v = this.view;
    const attacker = fighterById(this.battle, e.attacker);
    const target = fighterById(this.battle, e.target);
    const [ax, ay] = hexCentre(attacker.at);
    const [tx, ty] = hexCentre(target.at);
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
    this.step(release * MS, {
      start: turn,
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
          play(missile === 'hex' ? 'spell' : 'shoot');
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
        v.counts.set(e.target, left);
        if (!e.ranged) play('hit');
        this.impact(e.target, e.damage, !e.ranged);
        if (e.charge) {
          this.float(e.attacker, 'Charge!', GOLD[6]);
          play('charge');
          v.shake = Math.max(v.shake, 6);
        }
        this.float(e.target, e.killed ? `-${e.killed}` : `-${e.damage} hp`, e.killed ? RED[5] : RED[6]);
        const fell = !e.killed ? '.' : this.named(e.target) ? `. ${this.fighterName(e.target)} falls.` : `. ${e.killed} perish.`;
        v.log = `${this.fighterName(e.attacker)} ${this.verb(e.attacker, e.ranged ? 'shoot' : e.retaliation ? 'strike back at' : e.charge ? 'charge' : 'hit')} ${this.objectName(e.target)} for ${e.damage}${fell}${e.hexed ? ' The hex slows them down.' : ''}`;
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
    this.acting = action.type === 'volley' ? null : (activeFighter(before)?.id ?? null);
    this.battle = battle;
    this.view.targeting = null;
    this.view.hover = null;
    this.hooks.onChange(battle);
    this.animate(events, before);
    return true;
  }

  private animate(events: BattleEvent[], before: BattleState) {
    const v = this.view;
    // Who is left in each stack as the events play: a stack falls at the blow that kills it, and its
    // badge keeps its count from before the action until each blow lands.
    const left = new Map(before.fighters.map((f) => [f.id, v.counts.get(f.id) ?? f.count]));
    for (const e of events) if (e.type === 'hit' || e.type === 'spell') v.counts.set(e.target, left.get(e.target)!);
    for (const e of events) {
      switch (e.type) {
        case 'move': {
          const f = fighterById(this.battle, e.fighter);
          const path = e.path.map(hexCentre);
          // The rules already have the stack at the end of its path; start drawing it where it stood.
          const start = hexCentre(fighterById(before, e.fighter).at);
          v.positions.set(e.fighter, start);
          // Riders gallop and beasts lope, in their own frames; folk on foot hop from hex to hex.
          const frames = !!ART[f.troop].move;
          for (const [n, to] of path.entries()) {
            const a = n === 0 ? start : path[n - 1];
            this.step(0.12, {
              start: () => to[0] !== a[0] && v.facings.set(e.fighter, to[0] > a[0] ? 1 : -1),
              tick: (t) => {
                const hop = frames ? 0 : Math.sin(t * Math.PI) * 4;
                v.positions.set(e.fighter, [a[0] + (to[0] - a[0]) * t, a[1] + (to[1] - a[1]) * t - hop]);
                v.poses.set(e.fighter, frames ? { anim: 'move', ms: (n + t) * 120 } : { anim: 'stand', ms: 0 });
              },
            });
          }
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
          const dies = this.wound(left, e.target, e.killed);
          if (dies) v.dying.add(e.target);
          this.strike(e, left.get(e.target) ?? 0, dies);
          if (dies) this.fall(e.target);
          break;
        }
        case 'regen':
          this.step(0.3, {
            start: () => {
              this.float(e.fighter, `+${e.healed}`, GOLD[6]);
              v.log = `${this.fighterName(e.fighter)} ${this.verb(e.fighter, 'regenerate')}: the wounds close up.`;
            },
          });
          break;
        case 'spell': {
          // Stacks caught in a burst beside the target take their damage with it, at the same moment.
          if (e.splash) break;
          const from = events.indexOf(e) + 1;
          const stop = events.findIndex((n, k) => k >= from && !(n.type === 'spell' && n.splash));
          const caught = events.slice(from, stop < 0 ? events.length : stop).filter((n) => n.type === 'spell');
          const victims = [e, ...caught].map((h) => {
            const dies = this.wound(left, h.target, h.killed);
            if (dies) v.dying.add(h.target);
            return { h, dies, remaining: left.get(h.target) ?? 0, ours: fighterById(this.battle, h.target).side === 'player' };
          });
          const target = fighterById(this.battle, e.target);
          const [tx, ty] = hexCentre(target.at);
          const look = SPELLS[e.spell].look;
          const colour = look.colour === 'blue' ? BLUE[6] : look.colour === 'red' ? RED[5] : GOLD[6];
          const shot = { from: [tx, 0] as [number, number], to: [tx, ty - 10] as [number, number], t: 0, kind: look.kind, color: colour };
          // A fireball has to fall before it bursts: the sound, the numbers, the flinch and the jolt land with the burst.
          const land = look.kind === 'fire' ? FIRE_FALL : 0;
          let landed = false;
          const impact = () => {
            landed = true;
            play(look.kind === 'sparkle' ? 'spell' : 'bolt');
            for (const { h, remaining, ours } of victims) {
              v.counts.set(h.target, remaining);
              if (!h.damage) continue;
              v.poses.set(h.target, { anim: 'defendRanged', ms: 0 });
              this.float(h.target, h.killed ? `-${h.killed}` : `-${h.damage} hp`, ours ? RED[5] : GOLD[6]);
            }
            if (e.damage && look.kind !== 'sparkle') v.shake = Math.max(v.shake, look.kind === 'fire' ? 5 : 4);
          };
          this.step(look.kind === 'fire' ? 0.95 : 0.4, {
            start: () => {
              v.shots.push(shot);
              v.log = `${this.battle.hero.name ?? 'Aldric'} casts ${SPELLS[e.spell].name} on ${this.objectName(e.target)}${e.damage ? `: ${e.damage} damage${e.killed ? (this.named(e.target) ? `, and ${this.fighterName(e.target)} falls` : `, ${e.killed} perish`) : ''}` : ''}.`;
              if (!land) impact();
            },
            tick: (t) => {
              shot.t = t;
              if (!landed && t >= land) impact();
              // The spell burns in two red pulses, as Wesnoth flashes a unit that is hit.
              const k = landed ? ((t - land) / (1 - land)) * 0.95 : 0;
              for (const { h } of victims) if (h.damage) v.flashing[pulse(k) ? 'add' : 'delete'](h.target);
            },
            end: () => {
              v.shots.splice(v.shots.indexOf(shot), 1);
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
        case 'defend':
          this.step(e.type === 'defend' ? 0.45 : 0.25, {
            start: () => {
              this.float(e.fighter, e.type === 'wait' ? 'waits' : 'defends', NEUTRAL[7]);
              v.log = `${this.fighterName(e.fighter)} ${this.verb(e.fighter, e.type === 'wait' ? 'wait for a better moment' : this.named(e.fighter) ? 'stand guard' : 'raise their shields')}.`;
              if (e.type === 'defend') v.poses.set(e.fighter, { anim: 'defend', ms: 0 });
            },
            end: () => v.poses.delete(e.fighter),
          });
          break;
        case 'round':
          this.step(0.05, { start: () => (v.log = `Round ${e.round}.`) });
          break;
        case 'volley':
          this.step(0.3, { start: () => (v.log = 'From the treeline, your archers loose a volley before anyone moves!') });
          break;
        case 'end':
          this.step(2.2, {
            start: () => {
              const [title, line] =
                e.result === 'won' ? ['VICTORY', e.rout ? 'The rest of them run for it' : 'The field is yours'] : e.result === 'lost' ? ['DEFEAT', 'Your army breaks and scatters'] : ['RETREAT', 'You live to fight another day'];
              v.banner = { sprite: paintBanner(title, line), age: 0, life: 2.2 };
              v.log = e.rout
                ? e.result === 'won'
                  ? 'The rest of them give up and run for it. The field is yours.'
                  : 'Nobody can land a blow. Your men fall back.'
                : e.result === 'won'
                  ? 'Victory! The field is yours.'
                  : e.result === 'lost'
                    ? 'Your army breaks and scatters.'
                    : 'You sound the retreat.';
              if (e.result !== 'fled') play(e.result === 'won' ? 'victory' : 'defeat');
            },
          });
          break;
        case 'turn':
          break;
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
    if (this.queue.length === 0) v.counts.clear();
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
    const mine = !!f && f.side === 'player' && !this.auto && this.queue.length === 0 && !this.battle.volley;
    v.reach = mine && !v.targeting ? new Set(options(this.battle).moves.keys()) : new Set();
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
  private intent(hex: number, x: number, y: number): { action: BattleAction; kind: 'move' | 'melee' | 'shoot' | 'spell' } | null {
    const f = activeFighter(this.battle);
    if (!f || f.side !== 'player' || this.auto || this.queue.length > 0) return null;
    const occupant = this.battle.fighters.find((o) => o.count > 0 && o.at === hex);
    if (this.view.targeting) {
      const spell = SPELLS[this.view.targeting as SpellId];
      if (occupant && (occupant.side === 'enemy') === (spell.on === 'enemy')) return { action: { type: 'cast', spell: spell.id, target: occupant.id }, kind: 'spell' };
      return null;
    }
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
    this.view.inspect = hex === null ? null : (this.battle.fighters.find((f) => f.count > 0 && f.at === hex)?.id ?? null);
    this.view.preview = intent ? this.forecast(intent.action) : null;
    this.display.canvas.style.cursor = intent ? 'pointer' : 'default';
  }

  /** What an attack would probably do: average damage, how many fall, and whether they strike back. */
  private forecast(action: BattleAction): string | null {
    const f = activeFighter(this.battle);
    if (!f) return null;
    const target = 'target' in action ? fighterById(this.battle, action.target) : null;
    if (!target) return null;
    const t = TROOPS[target.troop];
    const one = this.named(target.id);
    const whom = one ? t.name : `${target.side === 'player' ? 'your' : 'their'} ${t.name.toLowerCase()}`;
    const losses = (killed: number) => (one ? (killed ? `, and ${t.name} falls` : '') : `, ${killed} perish`);
    if (action.type === 'cast') {
      const damage = spellDamage(this.battle, action.spell);
      if (!damage) return `${SPELLS[action.spell].name} on ${whom}.`;
      const [, ...caught] = spellVictims(this.battle, action.spell, target);
      const ours = caught.filter((c) => c.side === 'player').map((c) => TROOPS[c.troop].name.toLowerCase());
      const theirs = caught.length - ours.length;
      const more = [theirs ? `${theirs} more of theirs` : '', ours.length ? `your own ${ours.join(' and ')}!` : ''].filter(Boolean).join(', and ');
      const killed = wound(target, damage).killed;
      return `${SPELLS[action.spell].name}: ${damage} damage${one ? losses(killed) : `, ${killed} of ${whom} perish`}.${more ? ` It also hits ${more}` : ''}`;
    }
    if (action.type !== 'melee' && action.type !== 'shoot') return null;
    const ranged = action.type === 'shoot';
    const charge = action.type === 'melee' && isCharge(this.battle, f, action.from);
    const from = action.type === 'melee' ? { ...f, at: action.from } : f;
    const damage = strike(this.battle, from, target, ranged, undefined, charge ? CHARGE_BONUS : 1).damage;
    const left = wound(target, damage);
    const back = !ranged && !charge && left.count > 0 && !target.retaliated ? ` ${one ? `${t.name} will` : 'They will'} strike back.` : '';
    return `${charge ? 'Charge! ' : ''}${ranged ? 'Shoot' : 'Attack'} ${whom}: about ${damage} damage${losses(left.killed)}.${back}${charge ? ' No one can strike back at a charge.' : ''}`;
  }

  private button(id: (typeof BUTTONS)[number]['id']) {
    const f = activeFighter(this.battle);
    const mine = !!f && f.side === 'player' && this.queue.length === 0;
    if (id === 'auto') {
      this.auto = !this.auto;
      this.view.log = this.auto ? 'Your sergeants take over. Press Auto again to take back command.' : 'You take command again.';
      return;
    }
    if (!mine || this.auto) return;
    if (id === 'wait') this.perform({ type: 'wait' });
    else if (id === 'defend') this.perform({ type: 'defend' });
    else if (id === 'retreat') this.confirmRetreat();
    else this.openSpellbook();
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
    const spells = hero.spells.map((id) => SPELLS[id]);
    this.cards.show({
      title: 'Spellbook',
      lines: [`**${hero.mana}** mana. ${(hero.casts ?? 1) > 1 ? `Two spells a round: ${castsLeft(this.battle)} left this round.` : 'One spell a round.'}`, ...spells.map((s) => `**${s.name}** (${spellCost(this.battle, s.id)}): ${s.note}`)],
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
      if (intent) this.perform(intent.action);
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
      intent: (hex: number) => {
        const [x, y] = hexCentre(hex);
        return this.intent(hex, x, y)?.action ?? null;
      },
    };
  }
}
