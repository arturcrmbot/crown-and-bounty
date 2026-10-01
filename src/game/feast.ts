import { FeastScene } from '../render/feastScene';
import { MAP_VIEW } from '../render/frame';
import { feastLine, type Action, type Card } from '../rules/game';
import { CardView } from '../ui/card';
import type { AdventureController } from './adventure';
import type { Display } from './display';
import { NO_INPUT, type Screen, type SideButton } from './screen';

/** What puts the feast away: its card closed, or the next day ended straight away (E, or the hourglass on the bar). */
export type FeastEnd = 'close' | 'endDay';

/** How far into the picture the payday card's room reaches: the left third, which the feast keeps quiet for it. */
const CARD_ROOM = 330;

/**
 * The payday feast (#191). Once a week, on the night that brings payday, the night falls into Aldric's camp
 * celebrating round the fire, with the payday card beside it and a tune of its own (the one screen over the map with
 * its own music, because Artur asked for music at camp). The map stands still underneath, so the bands take their
 * night's walk when it comes back. Closing the card brings the morning, and E ends the next day at once, as either
 * would with the card on the map.
 */
export class FeastController implements Screen {
  readonly name = 'feast';
  readonly music = 'feast' as const;
  readonly ambience = 'fire' as const;
  private readonly display: Display;
  private readonly adventure: AdventureController;
  private readonly scene: FeastScene;
  private readonly cards: CardView;
  private readonly card: Card;
  private readonly onEnd: (end: FeastEnd, then?: Action) => void;
  private time = 0;
  private ended = false;

  constructor(display: Display, adventure: AdventureController, card: Card, onEnd: (end: FeastEnd, then?: Action) => void) {
    this.display = display;
    this.adventure = adventure;
    this.card = card;
    this.onEnd = onEnd;
    this.scene = new FeastScene(adventure.state, feastLine(adventure.state), adventure.barGold);
    this.cards = new CardView((action) => this.end('close', action.type === 'close' ? undefined : action));
  }

  /** The payday card, once the feast's picture is in. */
  open() {
    if (this.ended) return;
    this.cards.show(this.card);
    this.placeCards();
  }

  /** Puts the feast away, once; anything the card asked for besides closing it is done on the map, after. */
  private end(end: FeastEnd, then?: Action) {
    if (this.ended) return;
    this.ended = true;
    this.cards.hide();
    this.onEnd(end, then);
  }

  update(dt: number) {
    this.time += dt;
  }

  render(): Uint8Array {
    return this.scene.draw(this.time).data;
  }

  get bitmap() {
    return this.scene.screen;
  }

  /** The card stands in the left third of the picture, which the feast keeps clear of the fire for it. */
  placeCards() {
    const page = (x: number, y: number) => this.display.toPage(x, y);
    const top = page(0, MAP_VIEW.y).y;
    const bottom = page(0, MAP_VIEW.y + MAP_VIEW.height).y;
    const sides = { left: page(MAP_VIEW.x, 0).x, right: page(MAP_VIEW.x + CARD_ROOM, 0).x };
    this.cards.place(page(MAP_VIEW.x + CARD_ROOM / 2, MAP_VIEW.y + MAP_VIEW.height - 8), top, bottom, undefined, sides);
  }

  dispose() {
    this.cards.dispose();
  }

  /** Played by touch, the card's Close does it all: down the sides there's only Sound and Full screen. */
  buttons(): SideButton[] {
    return [];
  }

  readonly input = {
    ...NO_INPUT,
    // The hourglass on the bar ends the next day, as on the map.
    click: (x: number, y: number) => {
      if (this.adventure.barAt(x, y) === 'hourglass') this.end('endDay');
    },
    key: (key: string) => {
      if (key === 'e') this.end('endDay');
      else if (key === 'escape') this.end('close');
      else this.cards.key(key);
    },
  };
}
