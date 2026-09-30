import type { MapSpellId } from '../content/spells';
import type { Action } from '../rules/game';
import type { AdventureController } from './adventure';
import type { Display } from './display';
import { HeroScreen, SHEET } from '../ui/heroScreen';
import type { Screen, SideButton } from './screen';

/**
 * The hero screen, open over the map: the map stands still underneath, and every change goes
 * through the map's rules, so it's saved as it's made. H, Escape or Close shuts it.
 */
export class HeroController implements Screen {
  readonly name = 'hero';
  private readonly display: Display;
  private readonly adventure: AdventureController;
  readonly sheet: HeroScreen;
  private readonly onClose: () => void;

  constructor(display: Display, adventure: AdventureController, onClose: () => void, stack: number | null = null) {
    this.display = display;
    this.adventure = adventure;
    this.onClose = onClose;
    this.sheet = new HeroScreen(
      adventure.state,
      {
        act: (action: Action) => {
          const done = adventure.act(action);
          if (done) this.sheet.update(adventure.state);
          return done;
        },
        castMapSpell: (spell: MapSpellId) => this.closeThen({ type: 'mapSpell', spell }),
        endDay: () => this.closeThen({ type: 'endDay' }),
        close: () => this.close(),
      },
      stack,
    );
    this.placeCards();
  }

  get music() {
    return this.adventure.music;
  }

  get ambience() {
    return this.adventure.ambience;
  }

  get bitmap() {
    return this.adventure.bitmap;
  }

  /** Time stands still on the map while the hero looks himself over. */
  update() {}

  render(tick: number): Uint8Array {
    return this.adventure.render(tick);
  }

  /** Over the map at the canvas's scale; played by touch, across the whole window (see `HeroScreen.place`). */
  placeCards() {
    const { x, y } = this.display.toPage(SHEET.x, SHEET.y);
    this.sheet.place(x, y, this.display.scale);
  }

  close() {
    this.onClose();
  }

  /** Shuts the sheet, then does something on the map: casting Far Sight, or ending the day. */
  private closeThen(action: Action | (() => void)) {
    this.close();
    if (typeof action === 'function') action();
    else this.adventure.choose(action);
  }

  dispose() {
    this.sheet.dispose();
  }

  /** Played by touch, the sheet takes the whole window, as big as it will go: the rails step aside. */
  buttons(): SideButton[] | null {
    return null;
  }

  readonly input = {
    // A click on the map around the sheet shuts it; on the bar, the hourglass still ends the day.
    click: (x: number, y: number) => {
      const bar = this.adventure.barAt(x, y);
      if (bar === 'hourglass') this.closeThen({ type: 'endDay' });
      else if (!bar) this.close();
    },
    hover: () => {},
    drag: () => {},
    leave: () => {},
    key: (key: string) => {
      if (key === 'h' || key === 'escape') {
        if (key === 'escape' && this.sheet.cancel()) return;
        this.close();
      } else if (key === 'e') this.closeThen({ type: 'endDay' });
    },
  };
}
