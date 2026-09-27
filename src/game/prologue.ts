import { CourtScreen } from '../render/courtScreen';
import { MAP_VIEW } from '../render/frame';
import { apply, type Action, type GameState } from '../rules/game';
import { CardView } from '../ui/card';
import type { Display } from './display';
import { backgroundCard, kingCard, storyCard, wantedCard } from './intro';
import { NO_INPUT, type Screen } from './screen';

/**
 * Before the first commission: the King's court, where Osric explains the trouble, his clerk
 * hands over a WANTED poster, and Aldric says who he was. Then he rides out.
 */
export class PrologueController implements Screen {
  readonly name = 'prologue';
  readonly music = 'court' as const;
  readonly ambience = 'fire' as const;
  readonly input = NO_INPUT;
  state: GameState;
  private readonly display: Display;
  private readonly screen = new CourtScreen();
  private readonly cards: CardView;
  private readonly onDone: (state: GameState) => void;
  private readonly pages = [kingCard(), wantedCard()];
  private page = 0;
  private time = 0;

  constructor(display: Display, state: GameState, onDone: (state: GameState) => void) {
    this.display = display;
    this.state = state;
    this.onDone = onDone;
    this.screen.caption = 'The King\u2019s Court';
    this.screen.goose = false;
    this.cards = new CardView((action) => this.choose(action));
    this.cards.show(this.pages[0]);
  }

  private choose(action: Action) {
    if (action.type === 'background') {
      const result = apply(this.state, action);
      if (!result) return;
      this.state = result.state;
      this.cards.show(storyCard(action.id, true));
      this.page = this.pages.length + 1;
    } else if (action.type === 'close') {
      this.page++;
      if (this.page < this.pages.length) this.cards.show(this.pages[this.page]);
      else if (this.page === this.pages.length) this.cards.show(backgroundCard());
      else this.onDone(this.state);
    }
  }

  update(dt: number) {
    this.time += dt;
  }

  render(): Uint8Array {
    return this.screen.draw(this.time).data;
  }

  get bitmap() {
    return this.screen.screen;
  }

  /** Cards hang to the right of the throne, so the King stays in view; the wide choice of hero sits in the middle. */
  placeCards() {
    const top = this.display.toPage(0, MAP_VIEW.y).y;
    const bottom = this.display.toPage(0, MAP_VIEW.y + MAP_VIEW.height).y;
    const wide = this.page === this.pages.length;
    this.cards.place(wide ? null : this.display.toPage(MAP_VIEW.x + MAP_VIEW.width * 0.8, MAP_VIEW.y + MAP_VIEW.height - 8), top, bottom);
  }

  dispose() {
    this.cards.dispose();
  }
}
