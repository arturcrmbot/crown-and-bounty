import { setAmbience } from '../audio/ambience';
import { setMusic } from '../audio/music';
import { mapOf } from '../rules/map/maps';
import { hasNextCommission, toCourt, type GameEvent, type GameState } from '../rules/game';
import { AdventureController } from './adventure';
import { BattleController } from './battle';
import { CourtController } from './court';
import { PrologueController } from './prologue';
import { TitleController } from './title';
import type { Display } from './display';
import type { InputHandlers } from './input';
import { saveGame } from './save';
import { whenUnitArt } from '../render/wesnoth';
import { heroArtId } from '../render/units';
import type { Screen } from './screen';

const hashOf = (data: Uint8Array) => {
  let h = 0x811c9dc5;
  for (const v of data) h = Math.imul(h ^ v, 0x01000193);
  return (h >>> 0).toString(16);
};

/**
 * The screens, as a stack: the title or the map at the bottom, and a battle or the court open over
 * the map until it closes back. Only the top screen runs, draws and hears input.
 */
export class Game {
  private readonly stack: Screen[] = [];
  private readonly display: Display;
  private readonly speed: number;

  constructor(display: Display, speed = 1) {
    this.display = display;
    this.speed = speed;
  }

  /** The title, with its menu: carry on with `resume`, or hear the King out and begin `fresh`. */
  showTitle(resume: GameState | null, fresh: () => GameState) {
    this.clear();
    this.push(
      new TitleController(this.display, resume, {
        onNew: () => {
          this.clear();
          this.push(new PrologueController(this.display, fresh(), (state) => whenUnitArt(() => this.beginCommission(state, []))));
        },
        onContinue: () => whenUnitArt(() => this.resume(resume!)),
      }),
    );
  }

  /** Straight onto the map, as the state left it: in the middle of a battle, or on the way to court. */
  resume(state: GameState) {
    this.clear();
    this.push(this.makeAdventure(state));
    if (state.battle && !state.battle.result) this.openBattle();
    else if (state.over === 'won' && hasNextCommission(state)) this.openCourt();
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
    adventure.onBattle = () => this.openBattle();
    adventure.onCourt = () => this.openCourt();
    adventure.onCommission = (next, rest) => this.beginCommission(next, rest);
    return adventure;
  }

  private openBattle() {
    const battle = this.adventure.state.battle!;
    this.push(
      new BattleController(
        this.display,
        battle,
        {
          onChange: (b) => this.adventure.updateBattle(b),
          onDone: (b) => {
            this.pop();
            this.adventure.finishBattle(b);
          },
        },
        this.speed,
        heroArtId(this.adventure.state.hero.background),
      ),
    );
  }

  private openCourt() {
    if (this.top instanceof CourtController) return;
    // A save made just after the win may not have reached court yet.
    const now = this.adventure.state;
    const state = now.campaign.court ? now : (toCourt(now)?.state ?? now);
    this.adventure.hideCard();
    saveGame(state);
    this.push(
      new CourtController(this.display, state, {
        onChange: (next) => saveGame(next),
        onDone: (next, rest) => {
          this.pop();
          this.beginCommission(next, rest);
        },
      }),
    );
  }

  /** A new commission: a fresh map for its province, its name across the sky, then whatever the rules still had to say. */
  private beginCommission(state: GameState, rest: GameEvent[]) {
    this.clear();
    const adventure = this.makeAdventure(state);
    this.stack.push(adventure);
    saveGame(state);
    adventure.announce();
    adventure.play(rest);
  }

  update(dt: number, held: ReadonlySet<string>) {
    this.top.update(dt, held);
    setMusic(this.top.music ?? null);
    setAmbience(this.top.ambience ?? null);
  }

  frame(tick: number): Uint8Array {
    return this.top.render(tick);
  }

  placeCards() {
    this.top.placeCards();
  }

  readonly input: InputHandlers = {
    click: (x, y) => this.top.input.click(x, y),
    hover: (x, y, cx, cy) => this.top.input.hover(x, y, cx, cy),
    drag: (dx, dy) => this.top.input.drag(dx, dy),
    leave: () => this.top.input.leave(),
    key: (key) => this.top.input.key(key),
  };

  /** Hooks for scripts. They reach whichever map is current, and do nothing while there is none. */
  debug() {
    const adventure = () => (this.stack[0] instanceof AdventureController ? this.stack[0].debug() : null);
    return {
      click: (x: number, y: number) => adventure()?.click(x, y),
      /** Presses the first button on the card on screen whose text starts with `label`. */
      choose: (label: string) => {
        const button = [...document.querySelectorAll<HTMLButtonElement>('.kc-card-wrap:not([hidden]) .kc-card button')].find((b) => b.textContent?.startsWith(label));
        button?.click();
        return Boolean(button);
      },
      state: () => this.state,
      idle: () => adventure()?.idle() ?? true,
      status: () => adventure()?.status() ?? null,
      centre: (id: string) => adventure()?.centre(id) ?? null,
      hover: () => adventure()?.hover() ?? null,
      screen: () => this.top.name,
      battle: () => (this.top instanceof BattleController ? this.top.debug() : null),
      frameHash: () => hashOf(this.top.bitmap.data),
      /** Moves the clock on by hand, even when frozen: for frame-by-frame screenshots of an animation. */
      advance: (seconds: number) => this.update(seconds, new Set()),
    };
  }
}
