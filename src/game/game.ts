import { heard, setAmbience } from '../audio/ambience';
import { nowPlaying, setMusic, setMusicMood } from '../audio/music';
import { battleMood, battleTune, CALM } from './tunes';
import { sting, type StingId } from '../audio/stings';
import { SCREEN } from '../render/frame';
import { Transition, type TransitionStyle } from '../render/transition';
import { setVeil } from '../ui/veil';
import { effectsHeard } from '../ui/sound';
import { mapOf } from '../rules/map/maps';
import { hasNextCommission, newGame, toCourt, type Action, type Card, type GameEvent, type GameState } from '../rules/game';
import { AdventureController } from './adventure';
import { BattleController } from './battle';
import { CourtController } from './court';
import { FeastController, type FeastEnd } from './feast';
import { HeroController } from './hero';
import { PrologueController } from './prologue';
import { TitleController } from './title';
import type { Display } from './display';
import type { InputHandlers } from './input';
import { saveGame } from './save';
import { count, NEW_CAMPAIGN } from './counter';
import { whenUnitArt } from '../render/wesnoth';
import type { Screen, SideButton } from './screen';

const hashOf = (data: Uint8Array) => {
  let h = 0x811c9dc5;
  for (const v of data) h = Math.imul(h ^ v, 0x01000193);
  return (h >>> 0).toString(16);
};

/**
 * The screens, as a stack: the title or the map at the bottom, and a battle or the court open over
 * the map until it closes back. Only the top screen runs, draws and hears input.
 *
 * Every change of screen is a change of scene: the old picture gives way to the new (see
 * `render/transition.ts`), a sting marks it, and the new screen's cards wait until its picture is in.
 */
export class Game {
  private readonly stack: Screen[] = [];
  private readonly display: Display;
  private readonly speed: number;
  /** Whether screens change with a transition; not when frozen, so screenshots catch the screen settled. */
  private readonly transitions: boolean;
  private transition: Transition | null = null;
  /** What was last put on screen: the top screen's frame, or a transition's mix of two. */
  private shown: Uint8Array | null = null;
  private readonly mixed = new Uint8Array(SCREEN.width * SCREEN.height);
  /** What waits for the new screen's picture to be in: a province's name across the sky, its first card. */
  private revealed: (() => void)[] = [];
  /** How the title's menu begins a new campaign: `main.ts` says, with the page's seed; a debug start that never showed the title gets a plain one. */
  private fresh: () => GameState = () => newGame();

  constructor(display: Display, speed = 1, transitions = true) {
    this.display = display;
    this.speed = speed;
    this.transitions = transitions;
  }

  /**
   * Changes screens: `act` swaps them, the old picture gives way to the new in `style`, and `cue`
   * sounds (holding the new screen's music until it has rung).
   */
  private change(style: TransitionStyle, cue: StingId | null, act: () => void) {
    if (this.transitions && this.shown) {
      this.transition = new Transition(this.shown.slice(), style);
      setVeil(true);
    }
    act();
    if (cue) sting(cue);
    if (!this.transition) this.reveal();
  }

  /** Runs `f` once the screen change under way is far enough in, or at once if there is none. */
  private whenRevealed(f: () => void) {
    if (this.transition && !this.transition.revealed) this.revealed.push(f);
    else f();
  }

  private reveal() {
    setVeil(false);
    const waiting = this.revealed;
    this.revealed = [];
    for (const f of waiting) f();
  }

  /** A click or key skips the change under way. */
  private skip() {
    if (!this.transition) return false;
    this.transition = null;
    this.reveal();
    return true;
  }

  /**
   * The title, with its menu: carry on with `resume`, or hear the King out and begin `fresh`. With
   * `menu` the menu is open at once, for a player coming back to it who has already clicked.
   */
  showTitle(resume: GameState | null, fresh: () => GameState = this.fresh, menu = false) {
    this.fresh = fresh;
    this.clear();
    this.push(
      new TitleController(
        this.display,
        resume,
        {
          onNew: () => {
            count(NEW_CAMPAIGN);
            // The painting gives way to the throne room, and a harp sweeps up into the court's tune.
            this.change('fade', 'curtain', () => {
              this.clear();
              this.push(new PrologueController(this.display, fresh(), (state) => whenUnitArt(() => this.change('dissolve', null, () => this.beginCommission(state, [])))));
            });
          },
          onContinue: () =>
            whenUnitArt(() =>
              this.change('fade', null, () => {
                this.resume(resume!);
                if (this.top === this.stack[0]) this.adventure.resumeFacing();
              }),
            ),
        },
        menu,
      ),
    );
  }

  showProgress(card: Card) {
    const title = this.top;
    if (title instanceof TitleController) title.showProgress(card);
  }

  /** Straight onto the map, as the state left it: in the middle of a battle, or on the way to court. */
  resume(state: GameState) {
    this.clear();
    this.push(this.makeAdventure(state));
    if (state.battle && !state.battle.result) this.pushBattle();
    else if (state.over === 'won' && hasNextCommission(state)) this.pushCourt();
  }

  /** The map, if one is open: it's always at the bottom of the stack. */
  get adventure(): AdventureController {
    const map = this.stack[0];
    if (!(map instanceof AdventureController)) throw new Error('no map is open');
    return map;
  }

  get top(): Screen {
    return this.stack[this.stack.length - 1];
  }

  /** The rules state of whichever screen is up, or null on the title. */
  get state(): GameState | null {
    const top = this.top;
    if (top instanceof CourtController || top instanceof PrologueController) return top.state;
    return this.stack[0] instanceof AdventureController ? this.stack[0].state : null;
  }

  /** What to keep when the page closes: only a campaign that has ridden out. */
  get saveable(): GameState | null {
    return this.stack[0] instanceof AdventureController ? this.state : null;
  }

  private push(screen: Screen) {
    this.stack.push(screen);
  }

  /** Closes the top screen, back to the one under it. */
  private pop() {
    if (this.stack.length > 1) this.stack.pop()!.dispose();
  }

  private clear() {
    while (this.stack.length) this.stack.pop()!.dispose();
  }

  private makeAdventure(state: GameState): AdventureController {
    const adventure = new AdventureController(this.display, mapOf(state), state, this.speed);
    // Into battle with a drum roll and a clash of steel; to court with the heralds' trumpets.
    adventure.onBattle = () => this.change('clash', 'battle', () => this.pushBattle());
    adventure.onCourt = () => this.change('fade', 'court', () => this.pushCourt());
    // Trying a lost commission again: the map sinks into the dark and rises fresh.
    adventure.onCommission = (next, rest) => this.change('fade', null, () => this.beginCommission(next, rest));
    adventure.onHero = (stack) => this.openHero(stack);
    adventure.onFeast = (card) => this.openFeast(card);
    return adventure;
  }

  /** The hero screen over the map, maybe with a stack's card open; closing it goes back to the map. */
  private openHero(stack: number | null) {
    if (this.top !== this.adventure) return;
    this.push(new HeroController(this.display, this.adventure, () => this.top instanceof HeroController && this.pop(), stack));
  }

  /** The payday feast (#191): the night sinks into the camp with payday's ta-da, and the card comes once it's in. */
  private openFeast(card: Card) {
    const feast = new FeastController(this.display, this.adventure, card, (end, then) => this.closeFeast(end, then));
    this.change('fade', 'payday', () => this.push(feast));
    this.whenRevealed(() => feast.open());
  }

  /** The feast dissolves into the morning; E or the hourglass ends the next day at once, as on the map. */
  private closeFeast(end: FeastEnd, then?: Action) {
    if (!(this.top instanceof FeastController)) return;
    this.change('dissolve', null, () => this.pop());
    if (end === 'endDay') this.adventure.choose({ type: 'endDay' });
    else if (then) this.adventure.choose(then);
  }

  private pushBattle() {
    const battle = this.adventure.state.battle!;
    this.push(
      new BattleController(
        this.display,
        battle,
        {
          onChange: (b) => this.adventure.updateBattle(b),
          // Back to the map: a win dissolves into it, a defeat or a retreat sinks through the dark.
          onDone: (b) =>
            this.change(b.result === 'won' ? 'dissolve' : 'fade', null, () => {
              this.pop();
              this.adventure.finishBattle(b);
            }),
        },
        this.speed,
      ),
    );
  }

  private pushCourt() {
    if (this.top instanceof CourtController) return;
    // A save made just after the win may not have reached court yet.
    const now = this.adventure.state;
    const state = now.campaign.court ? now : (toCourt(now)?.state ?? now);
    this.adventure.hideCard();
    saveGame(state);
    this.push(
      new CourtController(this.display, state, {
        onChange: (next) => saveGame(next),
        onDone: (next, rest) =>
          this.change('fade', null, () => {
            this.pop();
            this.beginCommission(next, rest);
          }),
        // After the last open commission: the throne room sinks into the dark, and the title rises with its menu open.
        onTitle: (next) => this.change('fade', null, () => this.showTitle(next, this.fresh, true)),
      }),
    );
  }

  /**
   * A new commission: a fresh map for its province, then, once it's in view, its name across the sky
   * and whatever the rules still had to say.
   */
  private beginCommission(state: GameState, rest: GameEvent[]) {
    this.clear();
    const adventure = this.makeAdventure(state);
    this.stack.push(adventure);
    saveGame(state);
    this.whenRevealed(() => {
      if (this.stack[0] !== adventure) return;
      adventure.announce();
      adventure.play(rest);
      if (!rest.some((event) => event.type === 'card')) adventure.welcome();
    });
  }

  update(dt: number, held: ReadonlySet<string>) {
    if (this.transition) {
      this.transition.age += dt * this.speed;
      if (this.transition.revealed) this.reveal();
      if (this.transition.done) this.transition = null;
    }
    this.top.update(dt, held);
    // A battle's music is the villain's theme in his own fight, and follows how the fight goes.
    const fight = this.top instanceof BattleController ? this.top.battle : null;
    setMusic(fight ? battleTune(fight) : (this.top.music ?? null));
    setMusicMood(fight ? battleMood(fight) : CALM);
    // On the map (and with the hero screen over it) the land makes its own sounds around the view.
    const map = this.stack[0] instanceof AdventureController && (this.top === this.stack[0] || this.top instanceof HeroController) ? this.stack[0] : null;
    setAmbience(this.top.ambience ?? null, map?.place ?? null);
  }

  frame(tick: number): Uint8Array {
    const frame = this.top.render(tick);
    if (this.transition) this.transition.compose(frame, this.mixed);
    this.shown = this.transition ? this.mixed : frame;
    return this.shown;
  }

  placeCards() {
    this.top.placeCards();
  }

  /** The buttons down the sides for the screen on top, played by touch; null if it takes the whole window. */
  buttons(): SideButton[] | null {
    return this.top.buttons ? this.top.buttons() : [];
  }

  /** A button down the side, pressed: like its key, it skips a change of screen under way and still counts. */
  pressButton(button: SideButton) {
    this.skip();
    button.press();
  }

  readonly input: InputHandlers = {
    // A press waits for the screen to change; a click while it changes only skips the change; a key skips it and still counts.
    press: (x, y) => this.transition || this.top.input.press?.(x, y),
    click: (x, y, touch) => this.skip() || this.top.input.click(x, y, touch),
    look: (x, y) => this.skip() || this.top.input.look?.(x, y),
    wheel: (dx, dy) => this.top.input.wheel?.(dx, dy),
    hover: (x, y, cx, cy) => this.top.input.hover(x, y, cx, cy),
    drag: (dx, dy, x, y) => this.top.input.drag(dx, dy, x, y),
    leave: () => this.top.input.leave(),
    key: (key) => {
      this.skip();
      return this.top.input.key(key);
    },
  };

  /** Hooks for scripts. They reach whichever map is current, and do nothing while there is none. */
  debug() {
    const adventure = () => (this.stack[0] instanceof AdventureController ? this.stack[0].debug() : null);
    return {
      click: (x: number, y: number) => adventure()?.click(x, y),
      /** Presses the first button that can be pressed on the card (or the hero screen) on screen whose text starts with `label`. */
      choose: (label: string) => {
        const button = [...document.querySelectorAll<HTMLButtonElement>('.kc-card-wrap:not([hidden]) .kc-card button, .kc-hero button.act')].find((b) => !b.disabled && b.textContent?.startsWith(label));
        button?.click();
        return Boolean(button);
      },
      state: () => this.state,
      idle: () => adventure()?.idle() ?? true,
      status: () => adventure()?.status() ?? null,
      centre: (id: string) => adventure()?.centre(id) ?? null,
      /** Scrolls the map to centre on a map point, as a player would before clicking something far off. */
      view: (x: number, y: number) => adventure()?.view(x, y),
      /** Where the map's view looks: its top left, in map pixels. */
      camera: () => adventure()?.camera() ?? null,
      /** Where a map point is on the page, on the view and on the minimap, for a script to tap it. */
      onPage: (x: number, y: number) => adventure()?.onPage(x, y) ?? null,
      /** Where a thing on the map's bottom bar is on the page. */
      barOnPage: (kind: string) => adventure()?.barOnPage(kind) ?? null,
      hover: () => adventure()?.hover() ?? null,
      /** Whether the map's minimap is out (true), folded away (false), or there's no map (null). */
      minimap: () => adventure()?.minimap() ?? null,
      screen: () => this.top.name,
      battle: () => (this.top instanceof BattleController ? this.top.debug() : null),
      /** What the hero screen shows, while it's open. */
      hero: () => (this.top instanceof HeroController ? this.top.sheet.describe() : null),
      frameHash: () => hashOf(this.top.bitmap.data),
      /** What's playing, what the land sounds like, and the last effects asked for, once sound is awake. */
      sound: () => ({ music: nowPlaying(), ambience: heard(), effects: effectsHeard() }),
      /** The sky over the map: the day's light, mist, rain, wind and night (see `render/weather.ts`). */
      sky: () => (this.stack[0] instanceof AdventureController ? this.stack[0].view.sky : null),
      /** Moves the clock on by hand, even when frozen: for frame-by-frame screenshots of an animation. */
      advance: (seconds: number) => this.update(seconds, new Set()),
    };
  }
}
