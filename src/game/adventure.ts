import { BACKGROUNDS } from '../content/backgrounds';
import { addPlace, buildAdventureScene, refreshPlace, setHeroFigure, type AdventureScene, type Hitbox } from '../render/adventureScene';
import { BANNER_TIME, drawBanner, paintBanner } from '../render/banner';
import type { Bitmap } from '../render/bitmap';
import { BAR, MAP_VIEW as VIEW } from '../render/frame';
import { BLUE, GOLD, LEAF, NEUTRAL, PARCHMENT, PLUM, RED, WATER } from '../render/palette';
import { clickable, GOLD_AT, paintHud, type HudHit } from '../render/hud';
import { feastArtReady } from '../render/mapArt';
import { ART, heroArtId } from '../render/units';
import type { BattleState } from '../rules/battle/battle';
import { ambushCard, apply, bountyCard, commissionOf, describe, finishFight, heardOf, heroStats, journalCard, levelUpCard, locationById, placeNote, placeOdds, roman, VANISHES, visit, whenThere, type Action, type Card, type GameEvent, type GameState, type Result, type Verdict } from '../rules/game';
import { barNote } from '../rules/heroSheet';
import type { Point } from '../rules/map/geometry';
import { CELL, cellCentre, type MapModel, type Terrain } from '../rules/map/model';
import { daysAway, facingEnemy, planRoute, routeCosts, stepAlong } from '../rules/map/movement';
import { artifactIcon, statIcon } from '../render/artifactIcons';
import { CardView } from '../ui/card';
import { bitmapUrl } from '../ui/pixels';
import { play, playStep, type Sound } from '../ui/sound';
import { sting } from '../audio/stings';
import type { Place, Soundscape } from '../audio/ambience';
import { soundscapeOf } from './soundscape';
import { lairTune, provinceTune } from './tunes';
import { skyOf, weatherOf } from './skies';
import type { TrackId } from '../audio/score';
import { HoverLabel } from '../ui/label';
import type { Display } from './display';
import type { Input } from './input';
import type { Screen, SideButton } from './screen';
import { touch } from '../ui/touch';
import { backgroundCard, endCard, keysCard, storyCard } from './intro';
import { clearSave, keepMinimap, minimapWanted, saveGame } from './save';
import { countEvents } from './counter';
import { Walks } from './walks';
import { tiredResult } from './adventureCards';
import { doorsOf, hiddenShare, HIDES, reachOf, type Reach } from './doors';
import { oddsAhead } from './odds';
import { gainsOf, type GainKind } from './gains';
import { hash } from '../rules/noise';

type HintId = Extract<Action, { type: 'hint' }>['id'];

/** Seconds a new province's name holds the sky before cards may cover it. */
const BANNER_HOLD = 2.4;
/** How long night takes to fall and lift at the end of a day, in seconds. */
const NIGHT = 1.4;
/** How dark the map grows once a commission is lost. */
const GLOOM = 0.6;
/** Map pixels per second. */
const RIDE_SPEED = 95;
/** Map pixels per step of the trot cycle, so hooves don't slide. */
const STRIDE = 5;
/** Map pixels between footfalls (or hoofbeats), for the sound of the ride. */
const STEP_PX = 16;
const SCROLL_SPEED = 6;
/** How much faster he rides while Shift is held. */
const GALLOP = 3;

/** The crossed swords, twice their size, for the pointer over an enemy. */
let swords: string | null = null;
const swordsCursor = () => (swords ??= `url("${bitmapUrl(statIcon('attack'), 0, 2)}") 16 16, pointer`);

/** Cuts the corners of a cell-by-cell route so the dots curve like the ride does. */
function curve(points: Point[]): Point[] {
  let out = points;
  for (let pass = 0; pass < 2 && out.length > 2; pass++) {
    const next: Point[] = [out[0]];
    for (let i = 0; i < out.length - 1; i++) {
      const [ax, ay] = out[i];
      const [bx, by] = out[i + 1];
      next.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}

/**
 * The adventure map: turns clicks into rules actions, animates the ride between the cells the
 * rules move the hero through, and shows whatever the rules' events say happened.
 */
/** A gain waiting to rise off the hero: its words, colour, sound and picture, and any gold that flies to the bar. */
type Rising = { text: string; colour: number; sound?: Sound; picture?: Bitmap; gold: number; level: boolean };

/** Each kind of gain's colour as it rises, and its sound (gold has its coins already, and a level its sting). */
const GAIN_LOOKS: Record<GainKind, { colour: number; sound?: Sound }> = {
  gold: { colour: GOLD[6] },
  troops: { colour: PARCHMENT[6], sound: 'march' },
  leadership: { colour: BLUE[6], sound: 'cheer' },
  movement: { colour: LEAF[8], sound: 'gallop' },
  mana: { colour: WATER[8], sound: 'shimmer' },
  spell: { colour: PLUM[4], sound: 'spell' },
  gear: { colour: GOLD[6], sound: 'find' },
  level: { colour: GOLD[6] },
  experience: { colour: NEUTRAL[7] },
};

/** Seconds the journal on the bar stays lit after something new goes into it. */
const BOOK_LIT = 2.5;
/** Treasure still lying on the map twinkles now and then: one twinkle every this many seconds, on one of what's in view. */
const TWINKLE_EVERY = 0.8;
const TWINKLES: ReadonlySet<string> = new Set(['chest', 'gold']);

export class AdventureController implements Screen {
  readonly name = 'adventure';
  state: GameState;
  readonly map: MapModel;
  readonly scene: AdventureScene;
  private readonly display: Display;
  private readonly cards: CardView;
  private readonly label = new HoverLabel();
  private route: number[] = [];
  /** Where the current ride is going, to find the way again when enemies move. */
  private target: Point | null = null;
  /** Enemy sprites walking their night's path. */
  private readonly walks = new Walks();
  private visiting: string | null = null;
  /** Where the hero is drawn; it chases his cell in the rules. */
  private readonly drawn: { x: number; y: number };
  /** How far his figure reaches from his feet, worked out once for each figure he takes. */
  private figure: { sprite: Bitmap; reach: Reach } | null = null;
  private travelled = 0;
  private sinceDust = 0;
  private sinceStep = 0;
  private follow = false;
  /** A point the view glides to (a card's, out of sight when it opened), unless it's following the hero. */
  private focus: Point | null = null;
  /**
   * A route that ran on past nightfall: he rides on at dawn, once the day's card is put away and no
   * enemy is falling on his camp, and the view goes with him.
   */
  private dawnRide = false;
  private tiredShown = false;
  private cardAnchor: Point | null = null;
  private hudMovement = -1;
  /** Where each thing on the bottom bar sits, as last painted, and which one the pointer is on. */
  private hud: HudHit[] = [];
  private hudHover: HudHit | null = null;
  /** Whether the pointer went down on the minimap: then a drag steers the view, as in HoMM2. */
  private steering = false;
  /**
   * What the pointer rests on, open ground or a place: after a moment, its label adds how long the
   * ride there is. `name` is the place's label without it; `place` the place, whose door he rides to.
   */
  private resting: { key: string; point: Point; approach: boolean; place?: string; name: string | null; client: [number, number]; still: number; text?: string; asOf?: string } | null = null;
  /** "Start over?" is on screen: a second Start a new campaign really does. */
  private restartAsked = false;
  /** The place whose card is open because the player clicked it: a second click there goes to it. */
  private looking: { id: string; go: Action; label: string } | null = null;
  /** The journal is the card on screen: J puts it away. */
  private reading = false;
  private readonly speed: number;
  /** How much faster than life scripts run the map (?speed=8). */
  private readonly pace: number;
  private banner: { sprite: Bitmap; age: number; y: number } | null = null;
  /** A card that came while the province's name was up, waiting for its turn. */
  private held: { card: Card; at: Point | null } | null = null;
  /** What the hero just gained, waiting for the card on screen to close before it rises off him. */
  private gains: Rising[] = [];
  /** Gold he has gained that hasn't landed on the bar yet: the count shows his gold less this, and rolls up as the coins land. */
  private goldOwed = 0;
  /** Seconds the journal on the bar stays lit after something new goes into it. */
  private bookLit = 0;
  /** Seconds since untaken treasure last twinkled, and how many times it has. */
  private sinceTwinkle = 0;
  private twinkles = 0;
  /** Seconds left of gains rising: the level-up card waits for them. */
  private celebrating = 0;
  /** Seconds into the night that falls between two days, while it does. */
  private nightfall: number | null = null;
  /** How far the dark has closed over the map since the commission was lost. */
  private gloom = 0;
  /** Where the land makes its sounds. */
  private readonly soundscape: Soundscape;
  /** Settling a battle fought on the field, whose stings have played already. */
  private fromBattle = false;
  /** Seconds on the map, and since this day's dawn, for the weather. */
  private clock = 0;
  private sinceDawn = 0;
  /** The day's full movement, worked out once per state. */
  private fullDay: { state: GameState; movement: number } | null = null;
  /** Called when the rules start a battle; the game switches screens. */
  onBattle: (() => void) | null = null;
  /** Called when the hero rides to court after a won commission. */
  onCourt: (() => void) | null = null;
  /** Called when a new commission begins (maybe in a new province), with the events still to show. */
  onCommission: ((state: GameState, rest: GameEvent[]) => void) | null = null;
  /** Called to open the hero screen, maybe with one stack's card open. */
  onHero: ((stack: number | null) => void) | null = null;
  /** Called on the night that brings payday, with its card: the feast opens over the map (#191). */
  onFeast: ((card: Card) => void) | null = null;

  constructor(display: Display, map: MapModel, state: GameState, speed = 1) {
    this.display = display;
    this.map = map;
    this.state = state;
    this.speed = RIDE_SPEED * speed;
    this.pace = speed;
    this.scene = buildAdventureScene(map, state);
    this.soundscape = soundscapeOf(map, state);
    this.view.weather = weatherOf(map, state);
    this.cards = new CardView((action) => this.choose(action));
    this.drawn = { x: state.hero.at[0], y: state.hero.at[1] };
    const tower = state.locations.find((l) => l.kind === 'tower');
    if (tower) this.scene.view.effects.addFlock([tower.at[0], tower.at[1] - 84], 6, 1);
    for (const [i, home] of (map.province.flocks ?? []).entries()) this.scene.view.effects.addFlock(home, 5, 4 + i);
    // While the opening card asks who he was, he stands low in the view, so the card fits above him.
    this.scene.view.centreOn(state.hero.at[0] + 40, state.hero.at[1] - (state.opening ? 180 : 70));
    this.scene.minimap.shown = minimapWanted();
    this.repaintHud();
  }

  get view() {
    return this.scene.view;
  }

  render(tick: number): Uint8Array {
    const frame = this.view.compose(tick);
    this.scene.minimap.draw(frame);
    if (this.banner) drawBanner(frame, this.banner.sprite, VIEW.x + VIEW.width / 2, this.banner.y, this.banner.age);
    return frame.data;
  }

  /** The province's name across the sky, with a fanfare: a new commission begins. */
  announce() {
    const commission = commissionOf(this.state);
    const sprite = paintBanner(this.map.province.name.toUpperCase(), `Commission ${roman(this.state.campaign.chapter + 1)} \u00b7 ${commission.villain}`);
    // Across the top of the sky, or the bottom if that's where the hero stands.
    const heroY = VIEW.y + this.state.hero.at[1] - this.view.camera.y;
    const y = heroY < VIEW.y + 190 ? VIEW.y + VIEW.height - sprite.height - 40 : VIEW.y + 70;
    this.banner = { sprite, age: 0, y };
    play('fanfare');
  }

  /**
   * The province's own tunes, taking turns; and a villain's theme near his lair. A castle's or a
   * village's card leaves the music as it is: it changes only between the map and a battle.
   */
  get music(): TrackId {
    return lairTune(this.state, [this.drawn.x, this.drawn.y]) ?? provinceTune(this.state.campaign.chapter, Boolean(this.map.province.fen));
  }

  get ambience() {
    return this.map.province.fen ? ('fen' as const) : ('heath' as const);
  }

  /**
   * How far through the day the hero is: 0 with fresh legs in the morning, 1 when his movement is
   * spent. The light and the sounds of the land follow it.
   */
  get dayGone(): number {
    if (this.fullDay?.state !== this.state) this.fullDay = { state: this.state, movement: heroStats(this.state).movement };
    return Math.max(0, Math.min(1, 1 - this.state.movement / Math.max(1, this.fullDay.movement)));
  }

  /**
   * Where the land's sounds are heard from, and when. They follow the hero, or the middle of the
   * view while he's scrolled out of sight. Night comes as the day's riding runs out, and while it
   * falls between days.
   */
  /** How far night has come: as the day's riding runs out, and while it falls between days. */
  private get night(): number {
    return Math.max(Math.min(1, this.view.dusk / 0.8), Math.max(0, Math.min(1, (this.dayGone - 0.8) / 0.17)));
  }

  get place(): Place {
    const gone = this.dayGone;
    const night = this.night;
    const { camera } = this.view;
    const { x, y } = this.drawn;
    const seen = x > camera.x && x < camera.x + VIEW.width && y > camera.y && y < camera.y + VIEW.height;
    const at = seen ? { x, y } : { x: camera.x + VIEW.width / 2, y: camera.y + VIEW.height / 2 };
    return { scape: this.soundscape, listener: { ...at, night, morning: Math.max(0, 1 - gone / 0.2), rain: this.view.sky.rain } };
  }

  get bitmap() {
    return this.view.screen;
  }

  placeCards() {
    this.placeCard();
  }

  /** Takes this screen's cards and labels off the page, when a new province replaces it. */
  dispose() {
    this.cards.dispose();
    this.label.dispose();
  }

  showCard(card: Card, at: Point | null) {
    this.reading = false;
    // A new province's name gets its moment across the sky before any card covers it.
    if (this.banner && this.banner.age < BANNER_HOLD) {
      this.held = { card, at };
      return;
    }
    this.cardAnchor = at;
    this.looking = null;
    this.restartAsked = false;
    this.label.hide();
    this.cards.show(card);
    // A card about something out of sight brings the view to it, so it never opens about nothing.
    if (at && !this.inView(at)) this.focus = at;
  }

  /** Whether a map point is in the view. */
  private inView([x, y]: Point) {
    const { camera } = this.view;
    return x >= camera.x && x < camera.x + VIEW.width && y >= camera.y && y < camera.y + VIEW.height;
  }

  hideCard() {
    this.looking = null;
    this.reading = false;
    this.restartAsked = false;
    this.focus = null;
    this.cards.hide();
  }

  // --- The rules --------------------------------------------------------------------------

  private run(result: Result | null) {
    if (!result) return;
    const before = this.state;
    // The first thing heard on the road says where it has gone.
    const heard = heardOf(result.state).length > heardOf(before).length;
    const told = heard ? this.teach(result, 'journal', touch() ? '**Hint.** What you hear on the road goes in your journal. Tap **Journal**, at the side.' : '**Hint.** What you hear on the road goes in your journal. Press **J**, or click the book on the bar.') : result;
    this.state = told.state;
    if (this.state.gold > before.gold) play('coins');
    // Something new in the journal: a page turns, and the book on the bar lights up for a moment.
    if (heard) {
      play('page');
      this.bookLit = BOOK_LIT;
    }
    // Gains first, so the bar the events repaint already holds back the gold still to fly to it.
    this.floatGains(before, this.state);
    this.handle(told.events);
    saveGame(this.state);
  }

  /** Adds one first-commission hint to the card already being shown, or shows it on its own. */
  private teach(result: Result, id: HintId, line: string, card?: Omit<Card, 'lines'>, at: Point | null = null): Result {
    if (result.state.campaign.chapter !== 0 || result.state.flags?.[`hint:${id}`]) return result;
    const taught = apply(result.state, { type: 'hint', id })!;
    if (card) return { state: taught.state, events: [...result.events, { type: 'card', card: { ...card, lines: [line] }, at }] };
    const events = [...result.events];
    const index = events.findIndex((event) => event.type === 'card');
    if (index >= 0) {
      const event = events[index];
      if (event.type === 'card') events[index] = { ...event, card: { ...event.card, lines: [...event.card.lines, line] } };
    }
    return { state: taught.state, events };
  }

  /**
   * Whatever the hero gained rises off him, one after another, each in its own colour and with its
   * own sound (see `gainsOf`): gold, troops, leadership, movement, mana, a spell, gear with its
   * picture, and his experience or his new level. Gold he gains flies to the bar as coins.
   */
  private floatGains(before: GameState, after: GameState) {
    for (const gain of gainsOf(before, after)) {
      const look = GAIN_LOOKS[gain.kind];
      const gold = gain.kind === 'gold' && gain.amount > 0 ? gain.amount : 0;
      this.goldOwed += gold;
      this.gains.push({
        text: gain.text,
        colour: gain.amount < 0 ? RED[5] : look.colour,
        sound: gain.amount > 0 ? look.sound : undefined,
        picture: gain.artifact ? artifactIcon(gain.artifact) : undefined,
        gold,
        level: gain.kind === 'level',
      });
    }
  }

  /** Gains wait until no card is in the way, then rise one after another; a level-up card waits for them. */
  private releaseGains() {
    if (this.cards.isOpen || !this.gains.length) return;
    const [x, y] = [this.drawn.x, this.drawn.y - this.scene.hero.head - 12];
    const { camera } = this.view;
    for (const [i, gain] of this.gains.entries()) {
      const delay = i * 0.35;
      this.view.effects.floatText(x, y, gain.text, gain.colour, delay, gain.picture);
      if (gain.sound) play(gain.sound, 0, delay);
      if (gain.gold) this.view.effects.flyCoins([VIEW.x + x - camera.x, VIEW.y + y - camera.y + 8], [GOLD_AT.x, GOLD_AT.y], gain.gold, delay + 0.15, (gold) => this.landGold(gold));
    }
    this.celebrating = 0.6 + this.gains.length * 0.35;
    if (this.gains.some((gain) => gain.level)) this.view.effects.puff(this.drawn.x, this.drawn.y, 'glow');
    this.gains = [];
  }

  /** A coin lands in the purse on the bar: a clink, and the count goes up by its share. */
  private landGold(gold: number) {
    this.goldOwed = Math.max(0, this.goldOwed - gold);
    play('clink');
    this.repaintHud();
  }

  /** Now and then, a twinkle on treasure that's still lying where he can see it. */
  private twinkle(dt: number) {
    this.sinceTwinkle += dt;
    if (this.sinceTwinkle < TWINKLE_EVERY) return;
    this.sinceTwinkle = 0;
    const lying = this.state.locations.filter((l) => !l.done && TWINKLES.has(l.kind) && this.inView(l.at) && !this.view.isFogged(l.at[0], l.at[1] - 4));
    if (!lying.length) return;
    const n = ++this.twinkles;
    const place = lying[Math.floor(hash(n, 7, 501) * lying.length)];
    const box = this.scene.hitboxes.find((b) => b.id === place.id);
    if (!box) return;
    this.view.effects.puff(box.x0 + 4 + hash(n, 8, 502) * (box.x1 - box.x0 - 8), box.y0 + 2 + hash(n, 9, 503) * (box.y1 - box.y0) * 0.4, 'twinkle');
  }

  /** Shows events that happened elsewhere, like the arrival card of a new commission. */
  play(events: GameEvent[]) {
    this.handle(events);
  }

  /** The first time the map opens, how to get about on it (#155). It waits for the province's name to cross the sky. */
  welcome() {
    const line = touch() ? 'Tap anything to see what it is, and tap it again to ride there.' : 'Click anything to see what it is, and click it again to ride there.';
    const taught = this.teach({ state: this.state, events: [] }, 'map', line, { title: 'Getting about', choices: [{ label: 'Ride on', action: { type: 'close' } }] });
    if (taught.events.length) this.run(taught);
  }

  /** Back from a save: a hero who stood at an enemy (its fight card up, as like as not) faces it again. */
  resumeFacing() {
    if (this.state.over || this.state.opening || this.state.ambush || this.state.battle) return;
    const foe = facingEnemy(this.state);
    if (foe && !this.view.isFogged(foe.at[0], foe.at[1])) this.run(visit(this.state, foe.id));
  }

  private handle(events: GameEvent[]) {
    countEvents(this.state, events);
    const feast = this.feastCard(events);
    for (const [i, e] of events.entries()) {
      switch (e.type) {
        case 'court':
          this.hideCard();
          this.onCourt?.();
          return;
        case 'commission':
          this.hideCard();
          this.onCommission?.(this.state, events.slice(i + 1));
          return;
        case 'card':
          // Payday's card opens at the feast instead, by the fire.
          if (feast && e.card === feast) {
            this.hideCard();
            this.onFeast?.(feast);
            break;
          }
          this.showCard(e.card, e.place ? this.anchorOf(e.place) : e.at);
          // A fight the sergeants settled gets the same brass, or the same bell, as one fought on the field.
          if (!this.fromBattle && (e.card.title === 'Victory!' || e.card.title === 'Defeat')) sting(e.card.title === 'Defeat' ? 'defeat' : 'victory');
          break;
        case 'reveal':
          this.scene.fog.reveal(this.state.explored, e.at[0], e.at[1], e.radius);
          this.scene.minimap.refog(e);
          break;
        case 'added': {
          // A band that rides out and on in the same night sets off from where it rode out.
          const l = locationById(this.state, e.id);
          const walk = events.slice(i + 1).find((x) => x.type === 'enemyMoved' && x.id === e.id);
          addPlace(this.scene, walk?.type === 'enemyMoved' ? { ...l, at: walk.from } : l);
          break;
        }
        case 'changed':
          refreshPlace(this.scene, locationById(this.state, e.id));
          break;
        case 'removed': {
          const gone = this.state.locations.find((l) => l.id === e.id);
          const object = this.scene.pickups.get(e.id);
          // Out of sight, it goes without anyone seeing it go.
          if (gone && !object?.hidden) this.view.effects.puff(gone.at[0], gone.at[1], gone.enemy ? 'dust' : 'sparkle');
          if (object) this.view.remove(object);
          this.scene.pickups.delete(e.id);
          break;
        }
        case 'day':
          this.tiredShown = false;
          this.sinceDawn = 0;
          // Yesterday's route still ahead: he rides on (see `ride`).
          this.dawnRide = this.route.length > 0;
          play('day');
          // On payday the night falls into the feast, which brings payday's ta-da with it.
          if (!feast) {
            this.nightfall = 0;
            if (e.payday) sting('payday');
          }
          // A quiet dawn has no card: the new day's number rises off the hero as the light comes back.
          if (!events.some((x) => x.type === 'card')) this.view.effects.floatText(this.drawn.x, this.drawn.y - this.scene.hero.head - 12, `Day ${roman(e.day)}`, GOLD[6], NIGHT * 0.55);
          break;
        case 'levelUp':
          play('levelUp');
          break;
        case 'battle':
          this.hideCard();
          this.onBattle?.();
          break;
        case 'moved':
          // Steps are ridden, so only a jump comes this way (a tunnel, or home after a defeat): dust at both ends, and the camera follows.
          this.view.effects.puff(this.drawn.x, this.drawn.y, 'dust');
          this.drawn.x = e.at[0];
          this.drawn.y = e.at[1];
          this.view.effects.puff(e.at[0], e.at[1], 'dust');
          this.route = [];
          this.target = null;
          this.dawnRide = false;
          this.follow = true;
          break;
        case 'enemyMoved':
          {
            const object = this.scene.pickups.get(e.id);
            if (object) this.walks.start(e.id, object, this.scene.hitboxes.find((b) => b.id === e.id), e.from, e.path);
          }
          // Somebody may be standing on the road now: find the way again.
          if (this.target) this.replan();
          break;
        case 'over':
          // The bounty paid: the brass and the bells. The commission failed: the knell, and the light goes.
          sting(e.result === 'won' ? 'bounty' : 'lost');
          break;
      }
    }
    this.repaintHud();
  }

  /** The gold the bar shows: his gold, less any still to fly to it. The feast's bar shows the same. */
  get barGold() {
    return Math.max(0, this.state.gold - this.goldOwed);
  }

  private repaintHud() {
    this.hudMovement = Math.floor(this.state.movement);
    const shown = { gold: this.barGold, rolling: this.goldOwed > 0 && this.view.effects.flying, book: this.bookLit > 0 };
    this.hud = paintHud(this.view.frame, this.state, this.hudHover && this.barClickable(this.hudHover) ? this.hudHover.item : null, shown);
  }

  /**
   * Payday's card, on a night the feast can be held (#191): every payday, however the day was ended, but not when a
   * band falls on the camp at dawn or the commission is lost, and not before the feast's pieces are in.
   */
  private feastCard(events: GameEvent[]): Card | null {
    if (!this.onFeast || !feastArtReady() || this.state.over || this.state.ambush) return null;
    const day = events.find((e) => e.type === 'day');
    const card = events.find((e) => e.type === 'card');
    return day?.type === 'day' && day.payday && card?.type === 'card' ? card.card : null;
  }

  /** The journal: the commission's poster, pinned in, and what's been heard on the road. J, or the book on the bar. */
  private openJournal() {
    if (this.state.opening || this.state.over || this.state.ambush) return;
    this.showCard(journalCard(this.state), null);
    this.reading = true;
  }

  /** Folds the minimap away, or brings it back: Tab, or its button. The choice is kept for next time. */
  private toggleMinimap() {
    const { minimap } = this.scene;
    minimap.shown = !minimap.shown;
    keepMinimap(minimap.shown);
    play(minimap.shown ? 'unfold' : 'fold');
    this.steering = false;
  }

  /** What the minimap's button says under the pointer. */
  private minimapButtonNote() {
    const key = touch() ? '' : ' (Tab)';
    return this.scene.minimap.shown ? `Fold the map away${key}` : `Unfold the map of ${this.map.province.name}${key}`;
  }

  /** Underlines what a click on the bar would work, as the pointer moves over it. */
  private hoverBar(hit: HudHit | null) {
    const key = (h: HudHit | null) => (h ? `${h.item.kind}:${h.item.kind === 'stack' ? h.item.index : ''}` : '');
    if (key(hit) === key(this.hudHover)) return;
    this.hudHover = hit;
    this.repaintHud();
  }

  /** The thing on the bottom bar under a screen point, if any. */
  private onBar(x: number, y: number): HudHit | null {
    if (y < BAR.y || y >= BAR.y + BAR.height) return null;
    return this.hud.find((h) => x >= h.x0 && x < h.x1) ?? null;
  }

  /** Keeps the battle in the saved state as it goes. */
  updateBattle(battle: BattleState) {
    this.state = { ...this.state, battle };
    saveGame(this.state);
  }

  /** Back from the battlefield: the rules settle survivors and rewards, and the card says how it went. */
  finishBattle(battle: BattleState) {
    this.fromBattle = true;
    this.run(finishFight({ ...this.state, battle }));
    this.fromBattle = false;
    this.follow = true;
  }

  choose(action: Action) {
    switch (action.type) {
      case 'close':
        this.hideCard();
        return;
      case 'restart':
        // A whole campaign goes with one click: ask first, unless it's already won.
        if (this.restartAsked || this.state.over === 'won') {
          clearSave();
          window.location.reload();
          return;
        }
        this.showCard(
          {
            title: 'Start over?',
            lines: ['A new campaign begins with the King, and **this one is gone for good**, with the hero, his gear, his army and every commission so far.'],
            choices: [
              { label: 'No, carry on', action: { type: 'close' } },
              { label: 'Yes, start a new campaign', action: { type: 'restart' } },
            ],
          },
          null,
        );
        this.restartAsked = true;
        return;
      case 'go': {
        this.hideCard();
        this.plan(locationById(this.state, action.id).at, action.id);
        return;
      }
      case 'poster':
        // The bounty claimed: his poster comes back, stamped PAID.
        this.showCard(bountyCard(this.state), null);
        return;
      case 'background': {
        // Who he was, not something gained: no gold or troops rise off him for it.
        const chosen = apply(this.state, action);
        if (chosen) this.state = chosen.state;
        saveGame(this.state);
        this.repaintHud();
        setHeroFigure(this.scene, action.id, this.state.hero.facing);
        this.showCard(storyCard(action.id), null);
        return;
      }
      default: {
        // Whatever the action shows replaces this card; if it shows nothing, the card is done.
        this.hideCard();
        const result = apply(this.state, action);
        const payday = action.type === 'endDay' && result?.events.some((event) => event.type === 'day' && event.payday);
        this.run(result && payday ? this.teach(result, 'payday', '**Hint.** Payday comes round every seven days. The King pays you first, and then the army takes its wages.') : result);
      }
    }
  }

  /** Plots a route to `target`. With `visitId`, the hero visits that place when he gets there, from its door (see `doorOf`). */
  plan(target: Point, visitId: string | null) {
    const facing = visitId ? locationById(this.state, visitId) : null;
    const approach = Boolean(facing?.enemy && !facing.done);
    const to = visitId && !approach ? this.doorOf(visitId) : target;
    const route = planRoute(this.state, this.map, to, approach);
    if (!route) {
      this.showCard({ title: 'No way through', lines: ['Not even a goat could get there from here.'], choices: [] }, target);
      return;
    }
    this.route = route;
    this.target = route.length ? to : null;
    this.visiting = visitId;
    this.follow = true;
    this.focus = null;
    this.dawnRide = false;
    this.tiredShown = false;
    if (route.length) {
      const taught = this.teach(
        { state: this.state, events: [] },
        'ride',
        touch() ? 'Tap Aldric to stop. Touch and hold anywhere to see what is there, and how many days\u2019 ride away it is.' : 'Hold **Shift** to gallop. Click Aldric or press **Esc** to stop. **M** mutes the sound, and **?** lists every key.',
        { title: 'On the road', choices: [{ label: 'Ride on', action: { type: 'close' } }] },
      );
      if (taught.events.length) this.run(taught);
    }
    if (route.length === 0 && visitId) this.arrive();
  }

  /** Finds the way to the same place again, keeping what the hero means to do there. */
  private replan() {
    const facing = this.visiting ? locationById(this.state, this.visiting) : null;
    const route = this.target && planRoute(this.state, this.map, facing?.enemy && !facing.done ? facing.at : this.target, Boolean(facing?.enemy && !facing.done));
    if (route) this.route = route;
    else {
      this.route = [];
      this.visiting = null;
      this.target = null;
    }
  }

  private arrive() {
    const id = this.visiting!;
    this.visiting = null;
    this.target = null;
    this.run(this.teach(visit(this.state, id), 'place', touch() ? '**Hint.** Tap Aldric, or **Hero** at the side, whenever you want to see his gear and his army.' : '**Hint.** Click Aldric, or press **H**, whenever you want to see his gear and his army.'));
  }

  /** How far the hero's figure reaches from his feet, as he looks now. */
  private heroReach(): Reach {
    const sprite = this.scene.hero.idle[0];
    if (this.figure?.sprite !== sprite) this.figure = { sprite, reach: reachOf(sprite, this.scene.hero.foot) };
    return this.figure.reach;
  }

  /** Where a route ends: the cell he'd stop in, or where he stands if he's there already. */
  private routeEnd(route: number[]): Point {
    return route.length ? cellCentre(this.map, route[route.length - 1]) : this.state.hero.at;
  }

  /**
   * Where the hero stands to visit a place. Where the rules would stop him, in front of it, he would
   * hide a shrine, a cottage or a signpost under his hat or his horse; then he waits beside it
   * instead, at its door as HoMM2's heroes do, on whichever side is the shorter ride, so that it
   * still shows and a click on it still opens its card. A castle's gate hides nothing much; enemies
   * he rides up to, and treasure he picks up, are as the rules have them.
   */
  private doorOf(id: string): Point {
    const place = locationById(this.state, id);
    const box = this.scene.hitboxes.find((b) => b.id === id);
    if (!box || (place.enemy && !place.done) || VANISHES.has(place.kind)) return place.at;
    const figure = this.heroReach();
    const there = planRoute(this.state, this.map, place.at);
    if (!there || hiddenShare(box, figure, this.routeEnd(there)) < HIDES) return place.at;
    let best: { at: Point; cost: number } | null = null;
    for (const door of doorsOf(box, place.at[1], figure)) {
      const route = planRoute(this.state, this.map, door);
      const end = route && this.routeEnd(route);
      // A door that's blocked (a tree, the river) sends him somewhere else: that's no door.
      if (!route || !end || Math.hypot(end[0] - door[0], end[1] - door[1]) > CELL * 1.5 || hiddenShare(box, figure, end) >= HIDES) continue;
      const cost = route.length ? routeCosts(this.state, this.map, route)[route.length - 1] : 0;
      if (!best || cost < best.cost) best = { at: end, cost };
    }
    return best?.at ?? place.at;
  }

  // --- Each frame -------------------------------------------------------------------------

  /**
   * Choices that must be made wait on screen: the hero's background first, then any level-ups.
   * Once a commission is over, what comes next (court, or trying again) comes back if hidden.
   */
  private promptPending() {
    if (this.cards.isOpen || this.celebrating > 0) return;
    if (this.state.ambush) {
      const foe = locationById(this.state, this.state.ambush);
      return this.showCard(ambushCard(this.state), this.anchorOf(foe.id));
    }
    const card = this.state.over ? endCard(this.state) : this.state.opening ? backgroundCard() : levelUpCard(this.state);
    if (card) this.showCard(card, null);
  }

  update(dt: number, held: ReadonlySet<string>) {
    // The sky keeps its own clock: real seconds, stopped when frozen.
    this.clock += dt;
    this.sinceDawn += dt;
    this.view.sky = skyOf(this.state, Boolean(this.map.province.fen), this.dayGone, this.night, this.clock, this.sinceDawn);
    if (this.banner && (this.banner.age += dt * this.pace) > BANNER_TIME) this.banner = null;
    if (this.held && (!this.banner || this.banner.age >= BANNER_HOLD)) {
      const { card, at } = this.held;
      this.held = null;
      this.showCard(card, at);
    }
    this.releaseGains();
    this.celebrating = Math.max(0, this.celebrating - dt * this.pace);
    if (this.bookLit > 0 && (this.bookLit -= dt) <= 0) this.repaintHud();
    // Gold owed with no coins on the way (a new screen took them) is shown at once.
    if (this.goldOwed && !this.gains.length && !this.view.effects.flying) {
      this.goldOwed = 0;
      this.repaintHud();
    }
    this.twinkle(dt);
    if (this.nightfall !== null) {
      this.nightfall += dt;
      this.view.dusk = this.nightfall < NIGHT ? Math.sin((Math.PI * this.nightfall) / NIGHT) * 0.9 : 0;
      if (this.nightfall >= NIGHT) this.nightfall = null;
    }
    // A lost commission: the dark closes in over the map and stays, until he tries again.
    this.gloom = this.state.over === 'lost' ? Math.min(GLOOM, this.gloom + dt * 0.35) : 0;
    if (this.gloom > 0) this.view.dusk = Math.max(this.nightfall === null ? 0 : this.view.dusk, this.gloom);
    this.promptPending();
    this.showRide(dt);
    this.walks.advance(dt);
    const dx = (held.has('arrowright') || held.has('d') ? 1 : 0) - (held.has('arrowleft') || held.has('a') ? 1 : 0);
    const dy = (held.has('arrowdown') || held.has('s') ? 1 : 0) - (held.has('arrowup') || held.has('w') ? 1 : 0);
    if (dx || dy) {
      this.letGo();
      this.view.scrollTo(this.view.camera.x + dx * SCROLL_SPEED, this.view.camera.y + dy * SCROLL_SPEED);
    }
    // Shift gallops: three times the pace, for long rides.
    this.ride(held.has('shift') ? dt * GALLOP : dt);
    this.showBands();
    const { hero } = this.scene;
    this.view.effects.update(dt, [this.drawn.x, this.drawn.y]);
    const walking = this.isRiding();
    const facing = this.state.hero.facing;
    hero.object.frames = walking ? (facing > 0 ? hero.walk : hero.walkLeft) : facing > 0 ? hero.idle : hero.idleLeft;
    hero.object.frame = walking ? Math.floor(this.travelled / STRIDE) : undefined;
    hero.object.x = this.drawn.x - hero.idle[0].width / 2;
    hero.object.y = this.drawn.y - hero.foot;
    if (this.route.length > 0) {
      const { dots, camp } = this.routeMarks();
      this.view.route = dots;
      this.view.camp = camp;
    } else {
      this.view.route = [];
      this.view.camp = null;
    }
    if (this.follow) {
      const tx = this.drawn.x - VIEW.width / 2;
      const ty = this.drawn.y - VIEW.height / 2 - 20;
      const k = Math.min(1, dt * 2.5);
      this.view.scrollTo(this.view.camera.x + (tx - this.view.camera.x) * k, this.view.camera.y + (ty - this.view.camera.y) * k);
      if (!walking && Math.hypot(tx - this.view.camera.x, ty - this.view.camera.y) < 2) this.follow = false;
    } else if (this.focus) {
      // Gliding to a card's point: there, or as near as the map's edge lets the view come.
      const { camera, tiles } = this.view;
      const tx = Math.max(0, Math.min(tiles.width - VIEW.width, this.focus[0] - VIEW.width / 2));
      const ty = Math.max(0, Math.min(tiles.height - VIEW.height, this.focus[1] - VIEW.height / 2 - 20));
      const k = Math.min(1, dt * 2.5);
      this.view.scrollTo(camera.x + (tx - camera.x) * k, camera.y + (ty - camera.y) * k);
      if (Math.hypot(tx - camera.x, ty - camera.y) < 2) this.focus = null;
    }
    if (Math.floor(this.state.movement) !== this.hudMovement) this.repaintHud();
    // While he stands, the odds of every band still to fight are worked out ahead, for its label and its card.
    if (!walking) oddsAhead(this.state);
    this.paintMinimap();
    // A tile of the land further off is painted each frame, nearest the view first, until all of it is.
    this.view.warm();
  }

  /**
   * Bands show on the map while the hero knows where they are (see `rules/map/sight.ts`): one that has
   * walked off out of his sight in the night shows only while it's still in it, walking away.
   */
  private showBands() {
    let sight: number | null = null;
    for (const [id, object] of this.scene.pickups) {
      if (!this.state.locations.find((l) => l.id === id)?.enemy?.unseen) {
        object.hidden = false;
        continue;
      }
      const at = this.walks.where(id);
      sight ??= heroStats(this.state).sight;
      object.hidden = !at || Math.hypot(at[0] - this.state.hero.at[0], at[1] - this.state.hero.at[1]) > sight;
    }
  }

  /** The minimap, over the view's top right corner: it paints itself again only when something it shows has moved on. */
  private paintMinimap() {
    const { camera } = this.view;
    this.scene.minimap.paint(this.state.locations, [this.drawn.x, this.drawn.y], { x: camera.x, y: camera.y, width: VIEW.width, height: VIEW.height });
  }

  /** The player looks around for himself: the view stops following the hero, or gliding to a card. */
  private letGo() {
    this.follow = false;
    this.focus = null;
  }

  /** Looks at the part of the map under a point of the minimap, as a press or a drag on it does. */
  private steer(x: number, y: number) {
    this.letGo();
    this.resting = null;
    this.view.centreOn(...this.scene.minimap.toMap(x, y));
    this.paintMinimap();
  }

  /** The odds of a fight with the band under the pointer on the minimap, under its name, as on the map. */
  private minimapOdds(x: number, y: number): Verdict | null {
    const mark = this.scene.minimap.markAt(x, y);
    return mark ? placeOdds(this.state, mark.id) : null;
  }

  /** What the pointer is over on the minimap: a place, Aldric, or the land, and what a click does there. */
  private minimapNote(x: number, y: number): string {
    const { minimap } = this.scene;
    const mark = minimap.markAt(x, y);
    if (mark) return placeNote(this.state, mark.id);
    if (minimap.near(x, y, [this.drawn.x, this.drawn.y])) return `${BACKGROUNDS[this.state.hero.background].short} \u00b7 ${touch() ? 'tap here to look at him' : 'Space brings the view back to him'}`;
    return `${minimap.foggedAt(x, y) ? 'Unexplored' : this.map.province.name} \u00b7 ${touch() ? 'tap' : 'click'} or drag to look there`;
  }

  /** Once the pointer has rested on open ground a moment, how many days' ride away it is. */
  private showRide(dt: number) {
    const r = this.resting;
    if (!r || this.cards.isOpen || this.state.opening || this.state.over || this.state.ambush) return;
    // Worked out again as he rides or a day passes, but not every frame.
    const asOf = `${this.state.hero.at}|${this.state.day}|${Math.floor(this.state.movement)}`;
    if (r.text && r.asOf === asOf) return;
    r.still += dt;
    if (r.still < (r.text ? 0.3 : 0.15)) return;
    r.still = 0;
    r.asOf = asOf;
    const days = daysAway(this.state, this.map, r.place && !r.approach ? this.doorOf(r.place) : r.point, r.approach);
    if (r.name) r.text = `${r.name} \u00b7 ${days === null ? 'no way through yet' : whenThere(days)}`;
    else r.text = days === null ? 'No way through' : `Ride here: ${whenThere(days)}`;
    this.label.show(r.text, r.client[0], r.client[1], r.place ? placeOdds(this.state, r.place) : null);
  }

  /** Trotting only while the drawn hero is actually on the move, not while a tired route waits. */
  private isRiding() {
    const [x, y] = this.state.hero.at;
    return Math.hypot(x - this.drawn.x, y - this.drawn.y) > 0.5;
  }

  /**
   * Whether yesterday's route still waits at dawn: for the day's card to be put away, and for any
   * enemy falling on the camp to be dealt with. When he rides on, the view goes with him.
   */
  private dawnWaits(): boolean {
    if (!this.dawnRide) return false;
    if (this.cards.isOpen || this.state.ambush) return true;
    this.dawnRide = false;
    this.follow = true;
    return false;
  }

  /** Moves the drawn hero towards his cell, and steps the rules on as soon as he gets close. */
  private ride(dt: number) {
    let budget = this.speed * dt;
    for (let guard = 0; guard < 64 && budget > 0; guard++) {
      const [tx, ty] = this.state.hero.at;
      const d = Math.hypot(tx - this.drawn.x, ty - this.drawn.y);
      if (d < 2.5 && this.route.length > 0 && !this.dawnWaits()) {
        const step = stepAlong(this.state, this.map, this.route);
        if (step) {
          this.state = step.state;
          this.route = this.route.slice(1);
          this.handle(step.events.filter((e) => e.type !== 'moved'));
          continue;
        }
        if (!this.tiredShown) {
          this.tiredShown = true;
          saveGame(this.state);
          this.run(tiredResult(
            this.state,
            Boolean(ART[heroArtId(this.state.hero.background)].rides),
            [this.drawn.x, this.drawn.y - this.scene.hero.foot],
            touch(),
          ));
        }
      }
      if (d === 0) break;
      const move = Math.min(d, budget);
      this.drawn.x += ((tx - this.drawn.x) / d) * move;
      this.drawn.y += ((ty - this.drawn.y) / d) * move;
      budget -= move;
      this.travelled += move;
      this.sinceDust += move;
      this.sinceStep += move;
      if (this.sinceStep > STEP_PX) {
        this.sinceStep = 0;
        const terrain = this.map.terrain[Math.floor(ty / CELL) * this.map.width + Math.floor(tx / CELL)] as Terrain;
        playStep(terrain, Boolean(ART[heroArtId(this.state.hero.background)].rides));
      }
      if (this.sinceDust > 7 && this.map.grid.cost[Math.floor(ty / 8) * this.map.width + Math.floor(tx / 8)] === 1) {
        this.sinceDust = 0;
        this.view.effects.dust(this.drawn.x - this.state.hero.facing * 12, this.drawn.y - 1, this.state.hero.facing);
      }
    }
    const [x, y] = this.state.hero.at;
    if (this.route.length === 0 && this.visiting && Math.hypot(x - this.drawn.x, y - this.drawn.y) < 0.5) {
      saveGame(this.state);
      this.arrive();
    }
  }

  /** Marks every 10 pixels along the road ahead, with a camp where today's movement runs out. */
  private routeMarks() {
    const costs = routeCosts(this.state, this.map, this.route);
    const points = curve([[this.drawn.x, this.drawn.y], ...this.route.map((i) => cellCentre(this.map, i))]);
    const dots: { at: Point; today: boolean }[] = [];
    let carry = -14;
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1];
      const [bx, by] = points[i];
      const d = Math.hypot(bx - ax, by - ay);
      const cellIndex = Math.min(costs.length - 1, Math.floor(((i - 1) / (points.length - 1)) * costs.length));
      const today = costs[cellIndex] <= this.state.movement;
      for (let t = 10 - carry; t <= d; t += 10) dots.push({ at: [Math.round(ax + ((bx - ax) * t) / d), Math.round(ay + ((by - ay) * t) / d)], today });
      carry = (carry + d) % 10;
    }
    let lastToday = -1;
    for (let i = 0; i < costs.length && costs[i] <= this.state.movement; i++) lastToday = i;
    const camp = costs.at(-1)! > this.state.movement ? (lastToday >= 0 ? cellCentre(this.map, this.route[lastToday]) : ([this.drawn.x, this.drawn.y] as Point)) : null;
    return { dots, camp };
  }

  /**
   * Keeps the open card hanging above whatever it describes, or beside it, never over it; one about
   * nothing in particular keeps clear of the hero.
   */
  placeCard() {
    const a = this.cardAnchor;
    const { camera } = this.view;
    const point = a && this.display.toPage(VIEW.x + a[0] - camera.x, VIEW.y + a[1] - camera.y);
    const hero = this.scene.hero;
    const heroBox = { x0: hero.object.x, y0: hero.object.y, x1: hero.object.x + hero.idle[0].width, y1: hero.object.y + hero.foot + 6 };
    const inside = (b: { x0: number; y0: number; x1: number; y1: number }) => a && a[0] >= b.x0 && a[0] < b.x1 && a[1] >= b.y0 && a[1] < b.y1;
    // What the card is about: the place (or the hero) its anchor is on, or a little space round the point.
    const place = a && this.scene.hitboxes.filter((b) => inside(b)).reduce<Hitbox | null>((front, b) => (!front || b.y1 > front.y1 ? b : front), null);
    // A place he waits beside, at its door: the card keeps clear of him too.
    const byHim = place && place.x0 <= heroBox.x1 + 8 && place.x1 >= heroBox.x0 - 8 && place.y0 <= heroBox.y1 && place.y1 >= heroBox.y0;
    const about = byHim ? { x0: Math.min(place.x0, heroBox.x0), y0: Math.min(place.y0, heroBox.y0), x1: Math.max(place.x1, heroBox.x1), y1: Math.max(place.y1, heroBox.y1) } : place;
    const box = !a ? heroBox : inside(heroBox) ? heroBox : (about ?? { x0: a[0] - 12, y0: a[1] - 12, x1: a[0] + 12, y1: a[1] + 12 });
    const from = this.display.toPage(VIEW.x + box.x0 - camera.x, VIEW.y + box.y0 - camera.y);
    const to = this.display.toPage(VIEW.x + box.x1 - camera.x, VIEW.y + box.y1 - camera.y);
    const sides = { left: this.display.toPage(VIEW.x, 0).x, right: this.display.toPage(VIEW.x + VIEW.width, 0).x };
    this.cards.place(point, this.display.toPage(0, VIEW.y).y, this.display.toPage(0, VIEW.y + VIEW.height).y, { x0: from.x, y0: from.y, x1: to.x, y1: to.y }, sides);
  }

  // --- Input ------------------------------------------------------------------------------

  /**
   * The place (or the hero) under a map point, front-most first. A place the hero stands in front of
   * is still the hero, unless he hides most of it; one drawn in front of him (lower on the map) takes
   * the click. So does the enemy he has ridden up to (`here`), even behind him: a click there brings
   * its fight card back.
   */
  private under([x, y]: Point): { id: string; name: string; box?: Hitbox; fogged?: boolean; here?: boolean } | null {
    const h = this.scene.hero.object;
    const width = this.scene.hero.idle[0].width;
    const onHero = x >= h.x + 6 && x < h.x + width - 6 && y >= h.y + 4 && y < h.y + this.scene.hero.foot + 4;
    const gone = (id: string) => {
      const l = this.state.locations.find((p) => p.id === id);
      return !!l && l.done && (l.kind === 'chest' || l.kind === 'gold' || l.kind === 'patrol');
    };
    // A band out of sight isn't there to point at: the land where it stood is.
    const hits = this.scene.hitboxes.filter((b) => x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1 && !gone(b.id) && !this.scene.pickups.get(b.id)?.hidden);
    const heroFoot = h.y + this.scene.hero.foot;
    const inFront = hits.filter((b) => b.y1 > heroFoot + 2);
    const facing = this.moving() ? null : facingEnemy(this.state);
    const behind = onHero && inFront.length === 0 && facing ? hits.find((b) => b.id === facing.id) : undefined;
    if (behind) return { id: behind.id, name: placeNote(this.state, behind.id), box: behind, here: true };
    // A place he stands in front of and hides (he rode to the ground before it, not to its door) is still there to point at, through him.
    const hidden = onHero && inFront.length === 0 && !this.moving() ? hits.find((b) => hiddenShare(b, this.heroReach(), [this.drawn.x, this.drawn.y]) >= HIDES) : undefined;
    if (hidden) return { id: hidden.id, name: placeNote(this.state, hidden.id), box: hidden };
    const does = touch() ? (this.moving() ? 'tap to stop here' : 'tap for his gear and army') : this.moving() ? 'click (or Esc) to stop here' : 'click (or H) for his gear and army';
    if (onHero && inFront.length === 0) return { id: 'hero', name: `${BACKGROUNDS[this.state.hero.background].short} \u00b7 ${does}` };
    if (hits.length === 0) return null;
    const box = hits.reduce((front, b) => (b.y1 > front.y1 ? b : front));
    const fogged = this.view.isFogged((box.x0 + box.x1) / 2, box.y1 - 4);
    return { id: box.id, name: fogged ? 'Unexplored' : placeNote(this.state, box.id), box, fogged, here: !fogged && box.id === facing?.id };
  }

  private anchorOf(id: string): Point {
    const box = this.scene.hitboxes.find((b) => b.id === id);
    if (!box) return locationById(this.state, id).at;
    return [(box.x0 + box.x1) / 2, box.y0 + 4];
  }

  /** A click on the map, in map pixels: the hero, a place, or open ground to ride to. */
  clickMap(point: Point) {
    if (this.state.over || this.state.opening || this.state.ambush) return;
    const thing = this.under(point);
    if (thing?.id === 'hero') {
      // On the move, a click on him reins in; standing, it opens his screen.
      if (this.moving()) this.stop();
      else this.openHero();
    } else if (thing?.here) {
      // The enemy he has ridden up to: its fight card comes back, however it was put away.
      this.choose({ type: 'go', id: thing.id });
    } else if (thing?.box) {
      // A second click on a place whose card is open goes there, as in HoMM2.
      if (this.looking?.id === thing.id && this.cards.isOpen) return this.choose(this.looking.go);
      this.lookAt(thing.id, Boolean(thing.fogged));
    } else if (this.cards.isOpen) {
      // A click away from an open card only puts the card away: riding off by accident costs a day's march.
      this.hideCard();
    } else {
      this.plan(point, null);
    }
  }

  /** A place's card (or the mist's), remembering how to go there. */
  private lookAt(id: string, fogged: boolean) {
    const card = fogged
      ? { title: 'Unexplored', lines: ['You cannot see what lies there.'], choices: [{ label: 'Ride there', action: { type: 'go', id } as Action }, { label: 'Close', action: { type: 'close' } as Action }] }
      : describe(this.state, id);
    this.showCard(card, this.anchorOf(id));
    const go = card.choices.find((c) => c.action.type === 'go' && !c.disabled);
    this.looking = go ? { id, go: go.action, label: go.label } : null;
  }

  /** A right-click looks, and never rides: at a place, at the hero, or nothing at all. */
  lookMap(point: Point) {
    if (this.state.over || this.state.opening || this.state.ambush) return;
    const thing = this.under(point);
    if (thing?.id === 'hero') this.openHero();
    else if (thing?.box) this.lookAt(thing.id, Boolean(thing.fogged));
    else this.hideCard();
  }

  /** Whether a click on this part of the bar does anything right now. */
  private barClickable({ item }: HudHit) {
    if (this.state.opening || this.state.over || this.state.ambush) return false;
    return clickable(item);
  }

  /**
   * The hourglass ends the day (a finger's tap asks first, as End day does); the army and the mana
   * open the hero; the book and the bounty open the journal.
   */
  private clickBar(hit: HudHit, tapped = false) {
    if (!this.barClickable(hit)) return;
    if (hit.item.kind === 'hourglass') {
      if (tapped) this.endDayAsked();
      else this.choose({ type: 'endDay' });
    } else if (hit.item.kind === 'journal' || hit.item.kind === 'bounty') this.openJournal();
    else this.openHero(hit.item.kind === 'stack' ? hit.item.index : null);
  }

  /** On the road right now: a route, and the legs to follow it today. */
  private moving() {
    return this.route.length > 0 && Boolean(stepAlong(this.state, this.map, this.route));
  }

  /** Reins in: the hero stops where he is, and keeps the rest of today's movement. */
  private stop() {
    this.route = [];
    this.target = null;
    this.visiting = null;
    this.dawnRide = false;
  }

  /**
   * Played by touch, down the sides: the minimap, the journal and the hero on the left, the end of the
   * day on the right. They do what Tab, J, H and E do.
   */
  buttons(): SideButton[] {
    const { opening, over, ambush } = this.state;
    const free = !opening && !over && !ambush;
    return [
      { id: 'map', label: 'Map', icon: 'map', side: 'left', enabled: true, on: this.scene.minimap.shown, press: () => this.input.key('tab') },
      { id: 'journal', label: 'Journal', icon: 'journal', side: 'left', enabled: free, on: this.reading && this.cards.isOpen, press: () => this.input.key('j') },
      { id: 'hero', label: 'Hero', icon: 'hero', side: 'left', enabled: free, press: () => this.input.key('h') },
      { id: 'day', label: 'End day', icon: 'day', side: 'right', enabled: free, press: () => this.endDayAsked() },
    ];
  }

  /**
   * The End day button, pressed: a finger at the screen's edge can press it by mistake, so while he
   * could still ride a good way today, it asks first.
   */
  endDayAsked() {
    if (this.state.opening || this.state.over || this.state.ambush) return;
    const full = heroStats(this.state).movement;
    const left = Math.floor(this.state.movement);
    if (left < full / 4) return this.choose({ type: 'endDay' });
    this.showCard(
      {
        title: 'End the day?',
        lines: [`Aldric could ride on a good while yet. He still has **${left}** of today\u2019s ${full} movement left.`],
        choices: [
          { label: 'End the day', action: { type: 'endDay' } },
          { label: 'Ride on', action: { type: 'close' } },
        ],
      },
      null,
    );
  }

  /** The hero screen: who he is, what he carries, his army. H, a click on him, or the bar's army and mana open it. */
  private openHero(stack: number | null = null) {
    if (this.state.opening || this.state.over || this.state.ambush) return;
    this.hideCard();
    this.label.hide();
    this.display.canvas.style.cursor = 'default';
    this.onHero?.(stack);
  }

  /** Does something from the hero screen through the rules; false if the rules said no. */
  act(action: Action): boolean {
    const result = apply(this.state, action);
    if (!result) return false;
    this.run(result);
    return true;
  }

  /** What's on the bottom bar at a screen point, if anything. */
  barAt(x: number, y: number) {
    return this.onBar(x, y)?.item.kind ?? (y >= BAR.y ? 'bar' : null);
  }

  /** Handlers for `Input`: screen pixels in. */
  readonly input = {
    press: (x: number, y: number) => {
      this.steering = this.scene.minimap.contains(x, y);
      if (this.steering) this.steer(x, y);
    },
    click: (x: number, y: number, tapped?: boolean) => {
      const { minimap } = this.scene;
      if (minimap.onButton(x, y)) return this.toggleMinimap();
      // The press on the minimap has moved the view already.
      if (minimap.contains(x, y)) return;
      const bar = this.onBar(x, y);
      // A finger can't hover: a tap on what the bar only tells about (the gold, the day) says it.
      if (bar && tapped && !this.barClickable(bar)) {
        const at = this.display.toPage(x, y);
        return this.label.show(barNote(this.state, bar.item), at.x, at.y);
      }
      if (bar) return this.clickBar(bar, tapped);
      const point = this.view.toMap(x, y);
      if (point) this.clickMap(point);
    },
    look: (x: number, y: number) => {
      if (this.scene.minimap.onButton(x, y) || this.scene.minimap.contains(x, y)) return;
      const point = this.view.toMap(x, y);
      if (point) this.lookMap(point);
    },
    hover: (x: number, y: number, clientX: number, clientY: number) => {
      const { minimap } = this.scene;
      const bar = this.onBar(x, y);
      this.hoverBar(bar);
      minimap.lit = !bar && minimap.onButton(x, y);
      if (bar) {
        this.resting = null;
        this.display.canvas.style.cursor = this.barClickable(bar) ? 'pointer' : 'default';
        this.label.show(barNote(this.state, bar.item), clientX, clientY);
        return;
      }
      if (minimap.lit || minimap.contains(x, y)) {
        this.resting = null;
        this.display.canvas.style.cursor = 'pointer';
        this.label.show(minimap.lit ? this.minimapButtonNote() : this.minimapNote(x, y), clientX, clientY, minimap.lit ? null : this.minimapOdds(x, y));
        return;
      }
      const point = this.view.toMap(x, y);
      const thing = point ? this.under(point) : null;
      // Crossed swords over an enemy, as in HoMM2: a click there is the start of a fight.
      const foe = thing?.box && !thing.fogged && this.state.locations.some((l) => l.id === thing.id && l.enemy && !l.done);
      this.display.canvas.style.cursor = foe ? swordsCursor() : thing ? 'pointer' : 'default';
      const again = thing && this.looking?.id === thing.id && this.cards.isOpen ? ` \u00b7 ${touch() ? 'tap' : 'click'} again: ${this.looking.label}` : '';
      // On open ground, or a place seen clearly, the ride's length comes up once the pointer rests.
      const place = thing?.box && !thing.fogged ? locationById(this.state, thing.id) : null;
      const key = place ? `place:${place.id}` : !thing && point ? `cell:${Math.floor(point[1] / 8) * this.map.width + Math.floor(point[0] / 8)}` : null;
      if (!key) this.resting = null;
      else if (this.resting?.key !== key) this.resting = { key, point: place ? place.at : point!, approach: Boolean(place?.enemy && !place.done), place: place?.id, name: thing?.name ?? null, client: [clientX, clientY], still: 0 };
      else this.resting.client = [clientX, clientY];
      // Under a band's name, the odds of a fight with it, as its cards give them.
      const odds = place ? placeOdds(this.state, place.id) : null;
      const known = this.resting?.text && !again ? this.resting.text : null;
      if (known) this.label.show(known, clientX, clientY, odds);
      else if (thing) this.label.show(`${thing.name}${again}`, clientX, clientY, odds);
      else this.label.hide();
    },
    drag: (dx: number, dy: number, x: number, y: number) => {
      if (this.steering) return this.steer(x, y);
      this.letGo();
      this.view.scrollTo(this.view.camera.x - dx, this.view.camera.y - dy);
    },
    wheel: (dx: number, dy: number) => {
      this.letGo();
      this.view.scrollTo(this.view.camera.x + dx, this.view.camera.y + dy);
      // The ground under the pointer has moved: its label comes back when the pointer does.
      this.resting = null;
      this.label.hide();
    },
    leave: () => {
      this.label.hide();
      this.hoverBar(null);
      this.scene.minimap.lit = false;
      this.resting = null;
    },
    key: (key: string) => {
      // Tab folds the minimap away and back, whatever else is up, and the browser doesn't move its focus.
      if (key === 'tab') {
        this.toggleMinimap();
        return true;
      }
      if (this.state.opening) return;
      if (key === 'e' && !this.state.over && !this.state.ambush) this.choose({ type: 'endDay' });
      else if (key === 'h' && !this.state.over && !this.state.ambush) this.openHero();
      else if (key === 'j') {
        // J puts the journal away again, as H does the hero.
        if (this.reading && this.cards.isOpen) this.hideCard();
        else this.openJournal();
      } else if (key === '?') this.showCard(keysCard(), null);
      else if (this.cards.key(key)) return;
      // Space brings the view back to the hero, whenever a card doesn't want it for its button.
      else if (key === ' ') {
        this.focus = null;
        this.follow = true;
      } else if (key === 'escape') {
        // Esc puts a card away, or with none up, reins in.
        if (this.cards.isOpen) this.hideCard();
        else this.stop();
      }
      else if (key.startsWith('arrow') || 'wasd'.includes(key)) this.letGo();
    },
  } satisfies ConstructorParameters<typeof Input>[1];

  /** Hooks for scripted play-throughs and checks. */
  debug() {
    return {
      click: (x: number, y: number) => this.clickMap([x, y]),
      state: () => this.state,
      idle: () => this.route.length === 0 || !stepAlong(this.state, this.map, this.route),
      status: () => ({
        riding: this.route.length > 0,
        visiting: this.visiting,
        movement: this.state.movement,
        tired: this.route.length > 0 && !stepAlong(this.state, this.map, this.route),
      }),
      centre: (id: string): Point => {
        const box = this.scene.hitboxes.find((b) => b.id === id)!;
        return [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2 + 6];
      },
      hover: () => this.label.text,
      /** Whether the minimap is out, or folded away. */
      minimap: () => this.scene.minimap.shown,
      view: (x: number, y: number) => {
        this.letGo();
        this.view.centreOn(x, y);
      },
      /** Where the view looks on the map: its top left, in map pixels. */
      camera: () => ({ ...this.view.camera }),
      /**
       * Where a map point is on the page, for a script to tap it as a finger would: on the view if
       * it's in sight (`inView`), and on the minimap, while it's out.
       */
      onPage: (x: number, y: number) => {
        const { camera } = this.view;
        const [sx, sy] = [VIEW.x + x - camera.x, VIEW.y + y - camera.y];
        const inView = sx >= VIEW.x && sx < VIEW.x + VIEW.width && sy >= VIEW.y && sy < VIEW.y + VIEW.height;
        const { minimap } = this.scene;
        return { view: this.display.toPage(sx, sy), inView, minimap: minimap.shown ? this.display.toPage(...minimap.toScreen([x, y])) : null };
      },
      /** Where a thing on the bottom bar is on the page ('hourglass', 'journal', 'bounty', 'stack'...). */
      barOnPage: (kind: string) => {
        const hit = this.hud.find((h) => h.item.kind === kind);
        return hit ? this.display.toPage((hit.x0 + hit.x1) / 2, BAR.y + BAR.height / 2) : null;
      },
      frameHash: () => {
        let h = 0x811c9dc5;
        for (const v of this.view.screen.data) h = Math.imul(h ^ v, 0x01000193);
        return (h >>> 0).toString(16);
      },
    };
  }
}
