import type { MapModel } from '../rules/map/model';
import type { GameState } from '../rules/game';
import { AdventureController } from './adventure';
import { BattleController } from './battle';
import type { Display } from './display';
import type { InputHandlers } from './input';

/** Which screen is up: the adventure map, or a battle on top of it. */
export class Game {
  readonly adventure: AdventureController;
  battle: BattleController | null = null;
  private readonly display: Display;
  private readonly speed: number;

  constructor(display: Display, map: MapModel, state: GameState, speed = 1) {
    this.display = display;
    this.speed = speed;
    this.adventure = new AdventureController(display, map, state, speed);
    this.adventure.onBattle = () => this.openBattle();
    if (state.battle && !state.battle.result) this.openBattle();
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

  update(dt: number, held: Set<string>) {
    if (this.battle) this.battle.update(dt);
    else this.adventure.update(dt, held);
  }

  frame(tick: number): Uint8Array {
    return this.battle ? this.battle.render() : this.adventure.view.compose(tick).data;
  }

  placeCards() {
    this.adventure.placeCard();
    this.battle?.placeCard();
  }

  readonly input: InputHandlers = {
    click: (x, y) => (this.battle ? this.battle.input.click(x, y) : this.adventure.input.click(x, y)),
    hover: (x, y, cx, cy) => (this.battle ? this.battle.input.hover(x, y) : this.adventure.input.hover(x, y, cx, cy)),
    drag: (dx, dy) => (this.battle ? this.battle.input.drag() : this.adventure.input.drag(dx, dy)),
    leave: () => (this.battle ? this.battle.input.leave() : this.adventure.input.leave()),
    key: (key) => (this.battle ? this.battle.input.key(key) : this.adventure.input.key(key)),
  };

  debug() {
    const adventure = this.adventure.debug();
    return {
      ...adventure,
      screen: () => (this.battle ? 'battle' : 'adventure'),
      battle: () => this.battle?.debug() ?? null,
      frameHash: () => {
        const data = this.battle ? this.battle.screenBitmap.data : this.adventure.view.screen.data;
        let h = 0x811c9dc5;
        for (const v of data) h = Math.imul(h ^ v, 0x01000193);
        return (h >>> 0).toString(16);
      },
    };
  }
}
