import { buildMap } from '../rules/map/model';
import { hasNextCommission, provinceOf, toCourt, type GameEvent, type GameState } from '../rules/game';
import { AdventureController } from './adventure';
import { BattleController } from './battle';
import { CourtController } from './court';
import type { Display } from './display';
import type { InputHandlers } from './input';
import { saveGame } from './save';

const hashOf = (data: Uint8Array) => {
  let h = 0x811c9dc5;
  for (const v of data) h = Math.imul(h ^ v, 0x01000193);
  return (h >>> 0).toString(16);
};

/** Which screen is up: the adventure map, a battle on top of it, or the King's court between commissions. */
export class Game {
  adventure: AdventureController;
  battle: BattleController | null = null;
  court: CourtController | null = null;
  private readonly display: Display;
  private readonly speed: number;

  constructor(display: Display, state: GameState, speed = 1) {
    this.display = display;
    this.speed = speed;
    this.adventure = this.makeAdventure(state);
    if (state.battle && !state.battle.result) this.openBattle();
    else if (state.over === 'won' && hasNextCommission(state)) this.openCourt();
  }

  /** The rules state of whichever screen is up. */
  get state(): GameState {
    return this.court?.state ?? this.adventure.state;
  }

  private makeAdventure(state: GameState): AdventureController {
    const adventure = new AdventureController(this.display, buildMap(provinceOf(state)), state, this.speed);
    adventure.onBattle = () => this.openBattle();
    adventure.onCourt = () => this.openCourt();
    adventure.onCommission = (next, rest) => this.beginCommission(next, rest);
    return adventure;
  }

  private openBattle() {
    const battle = this.adventure.state.battle!;
    this.battle = new BattleController(
      this.display,
      battle,
      {
        onChange: (b) => this.adventure.updateBattle(b),
        onDone: (b) => {
          this.battle = null;
          this.adventure.finishBattle(b);
        },
      },
      this.speed,
    );
  }

  private openCourt() {
    // A save made just after the win may not have reached court yet.
    const now = this.adventure.state;
    const state = now.campaign.court ? now : (toCourt(now)?.state ?? now);
    this.adventure.hideCard();
    saveGame(state);
    this.court = new CourtController(this.display, state, {
      onChange: (next) => saveGame(next),
      onDone: (next, rest) => {
        this.court?.dispose();
        this.court = null;
        this.beginCommission(next, rest);
      },
    });
  }

  /** A new commission: a fresh map for its province, then whatever the rules still had to say. */
  private beginCommission(state: GameState, rest: GameEvent[]) {
    this.adventure.dispose();
    this.adventure = this.makeAdventure(state);
    saveGame(state);
    this.adventure.play(rest);
  }

  update(dt: number, held: Set<string>) {
    if (this.court) this.court.update(dt);
    else if (this.battle) this.battle.update(dt);
    else this.adventure.update(dt, held);
  }

  frame(tick: number): Uint8Array {
    if (this.court) return this.court.render();
    return this.battle ? this.battle.render() : this.adventure.view.compose(tick).data;
  }

  placeCards() {
    if (this.court) return this.court.placeCard();
    this.adventure.placeCard();
    this.battle?.placeCard();
  }

  private get screen(): 'court' | 'battle' | 'adventure' {
    return this.court ? 'court' : this.battle ? 'battle' : 'adventure';
  }

  readonly input: InputHandlers = {
    click: (x, y) => {
      if (this.screen === 'battle') this.battle!.input.click(x, y);
      else if (this.screen === 'adventure') this.adventure.input.click(x, y);
    },
    hover: (x, y, cx, cy) => {
      if (this.screen === 'battle') this.battle!.input.hover(x, y);
      else if (this.screen === 'adventure') this.adventure.input.hover(x, y, cx, cy);
    },
    drag: (dx, dy) => {
      if (this.screen === 'battle') this.battle!.input.drag();
      else if (this.screen === 'adventure') this.adventure.input.drag(dx, dy);
    },
    leave: () => {
      if (this.screen === 'battle') this.battle!.input.leave();
      else this.adventure.input.leave();
    },
    key: (key) => {
      if (this.screen === 'battle') this.battle!.input.key(key);
      else if (this.screen === 'adventure') this.adventure.input.key(key);
    },
  };

  /** Hooks for scripts. They always reach whichever adventure map is current. */
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
      screen: () => this.screen,
      battle: () => this.battle?.debug() ?? null,
      frameHash: () => hashOf(this.court ? this.court.screenBitmap.data : this.battle ? this.battle.screenBitmap.data : this.adventure.view.screen.data),
    };
  }
}
