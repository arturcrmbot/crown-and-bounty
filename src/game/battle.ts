import { SPELLS, type SpellId } from '../content/spells';
import { TROOPS, troops } from '../content/troops';
import { chooseAction } from '../rules/battle/ai';
import { activeFighter, battleAct, canCast, castsLeft, CHARGE_BONUS, fighterById, isCharge, options, spellCost, spellDamage, strike, wound, type BattleAction, type BattleEvent, type BattleState } from '../rules/battle/battle';
import { paintBanner } from '../render/banner';
import { BattleScreen, BUTTONS, hexAt, hexCentre, type BattleView, type Shot } from '../render/battleScreen';
import { FIGHTER_FOOT } from '../render/battleSprites';
import { MAP_VIEW } from '../render/frame';
import { BLUE, GOLD, NEUTRAL, RED } from '../render/palette';
import { CardView } from '../ui/card';
import { play } from '../ui/sound';
import type { Display } from './display';
import type { Screen } from './screen';

type Step = { duration: number; elapsed: number; started: boolean; start?: () => void; tick?: (t: number) => void; end?: () => void };

const ENEMY_THINK = 0.35;

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
    const who = f.side === 'player' ? 'Your' : 'Their';
    return count === undefined ? `${who} ${TROOPS[f.troop].name}` : `${who} ${troops(f.troop, count)}`;
  }

  private step(duration: number, parts: Omit<Step, 'duration' | 'elapsed' | 'started'>) {
    this.queue.push({ duration, elapsed: 0, started: false, ...parts });
  }

  /** Words that rise from a stack and fade. Ones that come close together stack up instead of overlapping. */
  private float(id: number, text: string, color: number) {
    const f = fighterById(this.battle, id);
    const [x, y] = this.view.positions.get(id) ?? hexCentre(f.at);
    const top = y + 12 - FIGHTER_FOOT(f.troop) - 14;
    const crowd = this.view.floaters.filter((o) => o.age < 0.6 && Math.abs(o.x - x) < 44 && Math.abs(o.y - top) < 40).length;
    this.view.floaters.push({ x, y: top - crowd * 16, text, color, age: 0 });
  }

  /** A burst where a blow lands, and a jolt for a heavy one. */
  private impact(target: number, damage: number, heavy: boolean) {
    const [x, y] = hexCentre(fighterById(this.battle, target).at);
    const spark = { from: [x, y - 22] as [number, number], to: [x, y - 22] as [number, number], t: 0, kind: 'spark' as const };
    this.view.shots.push(spark);
    this.sparks.push(spark);
    if (heavy) this.view.shake = Math.max(this.view.shake, Math.min(6, 1.5 + damage / 50));
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

  /** Does an action through the rules, then queues the animations for what happened. */
  perform(action: BattleAction): boolean {
    const before = this.battle;
    const { battle, events } = battleAct(before, action);
    if (events.length === 0) return false;
    this.battle = battle;
    this.view.targeting = null;
    this.view.hover = null;
    this.hooks.onChange(battle);
    this.animate(events, before);
    return true;
  }

  private animate(events: BattleEvent[], before: BattleState) {
    const v = this.view;
    for (const e of events) {
      switch (e.type) {
        case 'move': {
          const path = e.path.map(hexCentre);
          // The rules already have the stack at the end of its path; start drawing it where it stood.
          const start = hexCentre(fighterById(before, e.fighter).at);
          v.positions.set(e.fighter, start);
          for (const [n, to] of path.entries()) {
            const a = n === 0 ? start : path[n - 1];
            this.step(0.12, {
              tick: (t) => {
                v.positions.set(e.fighter, [a[0] + (to[0] - a[0]) * t, a[1] + (to[1] - a[1]) * t]);
                v.poses.set(e.fighter, t < 0.5 ? 'step' : 'idle');
              },
            });
          }
          this.step(0.01, { end: () => v.positions.delete(e.fighter) });
          break;
        }
        case 'hit': {
          const target = fighterById(this.battle, e.target);
          if (target.count === 0) v.dying.add(e.target);
          const [ax, ay] = hexCentre(fighterById(this.battle, e.attacker).at);
          const [tx, ty] = hexCentre(target.at);
          if (e.ranged) {
            const shot = { from: [ax, ay - 20] as [number, number], to: [tx, ty - 18] as [number, number], t: 0, kind: 'arrow' as const };
            this.step(0.3, {
              start: () => {
                v.shots.push(shot);
                play('shoot');
              },
              tick: (t) => (shot.t = t),
              end: () => v.shots.splice(v.shots.indexOf(shot), 1),
            });
          } else {
            const len = Math.hypot(tx - ax, ty - ay) || 1;
            this.step(0.18, {
              tick: (t) => {
                const k = Math.sin(t * Math.PI) * 9;
                v.positions.set(e.attacker, [ax + ((tx - ax) / len) * k, ay + ((ty - ay) / len) * k]);
                v.poses.set(e.attacker, 'strike');
              },
              end: () => {
                v.positions.delete(e.attacker);
                v.poses.delete(e.attacker);
              },
            });
          }
          this.step(0.2, {
            start: () => {
              v.flashing.add(e.target);
              if (!e.ranged) play('hit');
              this.impact(e.target, e.damage, !e.ranged);
              if (e.charge) {
                this.float(e.attacker, 'Charge!', GOLD[6]);
                play('charge');
                v.shake = Math.max(v.shake, 6);
              }
              this.float(e.target, e.killed ? `-${e.killed}` : `-${e.damage} hp`, e.killed ? RED[5] : RED[6]);
              v.log = `${this.fighterName(e.attacker)} ${e.ranged ? 'shoot' : e.retaliation ? 'strike back at' : e.charge ? 'charge' : 'hit'} ${this.fighterName(e.target).replace(/^(Your|Their) /, (m) => m.toLowerCase())} for ${e.damage}${e.killed ? `. ${e.killed} perish.` : '.'}${e.hexed ? ' The hex slows them down.' : ''}`;
            },
            end: () => {
              v.flashing.delete(e.target);
              if (!target.count) return;
              v.dying.delete(e.target);
            },
          });
          if (target.count === 0) this.poof(e.target);
          break;
        }
        case 'regen':
          this.step(0.3, {
            start: () => {
              this.float(e.fighter, `+${e.healed}`, GOLD[6]);
              v.log = `${this.fighterName(e.fighter)} regenerate: the wounds close up.`;
            },
          });
          break;
        case 'spell': {
          const target = fighterById(this.battle, e.target);
          if (target.count === 0) v.dying.add(e.target);
          const [tx, ty] = hexCentre(target.at);
          const look = SPELLS[e.spell].look;
          const shot = { from: [tx, 0] as [number, number], to: [tx, ty - 10] as [number, number], t: 0, kind: look.kind, color: look.colour === 'blue' ? BLUE[6] : GOLD[6] };
          this.step(0.4, {
            start: () => {
              v.shots.push(shot);
              play(look.kind === 'bolt' ? 'bolt' : 'spell');
              v.log = `${this.battle.hero.name ?? 'Aldric'} casts ${SPELLS[e.spell].name} on ${this.fighterName(e.target).toLowerCase()}${e.damage ? `: ${e.damage} damage${e.killed ? `, ${e.killed} perish` : ''}` : ''}.`;
              if (e.damage) {
                v.flashing.add(e.target);
                this.float(e.target, e.killed ? `-${e.killed}` : `-${e.damage} hp`, GOLD[6]);
                if (look.kind === 'bolt') v.shake = Math.max(v.shake, 4);
              }
            },
            tick: (t) => (shot.t = t),
            end: () => {
              v.shots.splice(v.shots.indexOf(shot), 1);
              v.flashing.delete(e.target);
              if (target.count) v.dying.delete(e.target);
            },
          });
          if (target.count === 0) this.poof(e.target);
          break;
        }
        case 'wait':
        case 'defend':
          this.step(0.25, {
            start: () => {
              this.float(e.fighter, e.type === 'wait' ? 'waits' : 'defends', NEUTRAL[7]);
              v.log = `${this.fighterName(e.fighter)} ${e.type === 'wait' ? 'wait for a better moment' : 'raise their shields'}.`;
            },
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
    const f = activeFighter(this.battle);
    v.active = f?.id ?? null;
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
    const name = TROOPS[target.troop].name.toLowerCase();
    if (action.type === 'cast') {
      const damage = spellDamage(this.battle, action.spell);
      if (!damage) return `${SPELLS[action.spell].name} on their ${name}.`;
      return `${SPELLS[action.spell].name}: ${damage} damage, ${wound(target, damage).killed} of their ${name} perish.`;
    }
    if (action.type !== 'melee' && action.type !== 'shoot') return null;
    const ranged = action.type === 'shoot';
    const charge = action.type === 'melee' && isCharge(this.battle, f, action.from);
    const from = action.type === 'melee' ? { ...f, at: action.from } : f;
    const damage = strike(this.battle, from, target, ranged, undefined, charge ? CHARGE_BONUS : 1).damage;
    const left = wound(target, damage);
    const back = !ranged && !charge && left.count > 0 && !target.retaliated ? ' They will strike back.' : '';
    return `${charge ? 'Charge! ' : ''}${ranged ? 'Shoot' : 'Attack'} their ${name}: about ${damage} damage, ${left.killed} perish.${back}${charge ? ' No one can strike back at a charge.' : ''}`;
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
