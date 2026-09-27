import { setAmbience } from '../audio/ambience';
import { setMusic } from '../audio/music';
import { mapOf } from '../rules/map/maps';
import { hasNextCommission, toCourt, type GameEvent, type GameState } from '../rules/game';
import { AdventureController } from './adventure';
import { BattleController } from './battle';
import { CourtController } from './court';
import type { Display } from './display';
import type { InputHandlers } from './input';
import { saveGame } from './save';
import type { Screen } from './screen';

const hashOf = (data: Uint8Array) => {
  let h = 0x811c9dc5;
  for (const v of data) h = Math.imul(h ^ v, 0x01000193);
  return (h >>> 0).toString(16);
};

/**
 * The screens, as a stack: the map at the bottom, and a battle or the court open over it until
 * it closes back. Only the top screen runs, draws and hears input.
 */
export class Game {
  private readonly stack: Screen[] = [];
  private readonly display: Display;
  private readonly speed: number;

  constructor(display: Display, state: GameState, speed = 1) {
    this.display = display;
    this.speed = speed;
    this.stack.push(this.makeAdventure(state));
    if (state.battle && !state.battle.result) this.openBattle();
    else if (state.over === 'won' && hasNextCommission(state)) this.openCourt();
  }

  /** The map: always at the bottom of the stack. */
  get adventure(): AdventureController {
    return this.stack[0] as AdventureController;
  }

  get top(): Screen {
    return this.stack[this.stack.length - 1];
  }

  /** The rules state of whichever screen is up. */
  get state(): GameState {
    return this.top instanceof CourtController ? this.top.state : this.adventure.state;
  }

  private push(screen: Screen) {
    this.stack.push(screen);
  }

  /** Closes the top screen, back to the one under it. */
  private pop() {
    if (this.stack.length > 1) this.stack.pop()!.dispose();
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

  /** A new commission: a fresh map for its province, then whatever the rules still had to say. */
  private beginCommission(state: GameState, rest: GameEvent[]) {
    while (this.stack.length) this.stack.pop()!.dispose();
    const adventure = this.makeAdventure(state);
    this.stack.push(adventure);
    saveGame(state);
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

  /** Hooks for scripts. They always reach whichever map is current. */
  debug() {
    const adventure = () => this.adventure.debug();
    return {
      click: (x: number, y: number) => adventure().click(x, y),
      choose: (label: string) => adventure().choose(label),
      state: () => this.state,
      idle: () => adventure().idle(),
      status: () => adventure().status(),
      centre: (id: string) => adventure().centre(id),
      hover: () => adventure().hover(),
      screen: () => this.top.name,
      battle: () => (this.top instanceof BattleController ? this.top.debug() : null),
      frameHash: () => hashOf(this.top.bitmap.data),
    };
  }
}
