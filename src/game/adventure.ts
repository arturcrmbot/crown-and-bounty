import { BACKGROUNDS } from '../content/backgrounds';
import { troops } from '../content/troops';
import { addPlace, buildAdventureScene, setHeroFigure, type AdventureScene, type Hitbox } from '../render/adventureScene';
import { BANNER_TIME, drawBanner, paintBanner } from '../render/banner';
import type { Bitmap } from '../render/bitmap';
import { BAR, MAP_VIEW } from '../render/frame';
import { BLUE, GOLD, NEUTRAL, PARCHMENT, RED } from '../render/palette';
import { clickable, paintHud, type HudHit } from '../render/hud';
import { ART, heroArtId } from '../render/units';
import type { BattleState } from '../rules/battle/battle';
import { ambushCard, apply, bountyCard, commissionOf, describe, finishFight, heroStats, levelUpCard, locationById, placeNote, roman, visit, whenThere, type Action, type Card, type GameEvent, type GameState, type Result } from '../rules/game';
import { barNote } from '../rules/heroSheet';
import type { Point } from '../rules/map/geometry';
import { CELL, cellCentre, type MapModel, type Terrain } from '../rules/map/model';
import { daysAway, planRoute, routeCosts, stepAlong } from '../rules/map/movement';
import { statIcon } from '../render/artifactIcons';
import { CardView } from '../ui/card';
import { bitmapUrl } from '../ui/pixels';
import { play, playStep } from '../ui/sound';
import { sting } from '../audio/stings';
import type { Place, Soundscape } from '../audio/ambience';
import { soundscapeOf } from './soundscape';
import { lairTune, provinceTune } from './tunes';
import { skyOf, weatherOf } from './skies';
import type { TrackId } from '../audio/score';
import { HoverLabel } from '../ui/label';
import type { Display } from './display';
import type { Input } from './input';
import type { Screen } from './screen';
import { backgroundCard, endCard, keysCard, storyCard } from './intro';
import { clearSave, saveGame } from './save';
import { Walks } from './walks';

/** Seconds a new province's name holds the sky before cards may cover it. */
const BANNER_HOLD = 2.4;
/** How long night takes to fall and lift at the end of a day, in seconds. */
const NIGHT = 1.4;
/** How dark the map grows once a commission is lost. */
const GLOOM = 0.6;
/** How near a castle or village the hero must be for its card to bring the town's tune. */
const TOWN_REACH = 90;
/** Seconds the town's tune plays on after its card closes, so a quick visit still hears it. */
const TOWN_LINGER = 3;
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
  private travelled = 0;
  private sinceDust = 0;
  private sinceStep = 0;
  private follow = false;
  private tiredShown = false;
  private cardAnchor: Point | null = null;
  private hudMovement = -1;
  /** Where each thing on the bottom bar sits, as last painted, and which one the pointer is on. */
  private hud: HudHit[] = [];
  private hudHover: HudHit | null = null;
  /**
   * What the pointer rests on, open ground or a place: after a moment, its label adds how long the
   * ride there is. `name` is the place's label without it.
   */
  private resting: { key: string; point: Point; approach: boolean; name: string | null; client: [number, number]; still: number; text?: string; asOf?: string } | null = null;
  /** "Start over?" is on screen: a second Start a new campaign really does. */
  private restartAsked = false;
  /** The place whose card is open because the player clicked it: a second click there goes to it. */
  private looking: { id: string; go: Action; label: string } | null = null;
  private readonly speed: number;
  /** How much faster than life scripts run the map (?speed=8). */
  private readonly pace: number;
  private banner: { sprite: Bitmap; age: number; y: number } | null = null;
  /** A card that came while the province's name was up, waiting for its turn. */
  private held: { card: Card; at: Point | null } | null = null;
  /** What the hero just gained, waiting for the card on screen to close before it rises off him. */
  private gains: [string, number][] = [];
  /** Seconds left of gains rising: the level-up card waits for them. */
  private celebrating = 0;
  /** Seconds into the night that falls between two days, while it does. */
  private nightfall: number | null = null;
  /** How far the dark has closed over the map since the commission was lost. */
  private gloom = 0;
  /** Where the land makes its sounds. */
  private readonly soundscape: Soundscape;
  /** The place whose card is open, if the card came from a visit there. */
  private cardPlace: string | null = null;
  /** Settling a battle fought on the field, whose stings have played already. */
  private fromBattle = false;
  /** Seconds the town's tune plays on: kept full while its card is open, then running down. */
  private inTown = 0;
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
    this.scene.view.centreOn(state.hero.at[0] + 40, state.hero.at[1] - 70);
    this.repaintHud();
  }

  get view() {
    return this.scene.view;
  }

  render(tick: number): Uint8Array {
    const frame = this.view.compose(tick);
    if (this.banner) drawBanner(frame, this.banner.sprite, MAP_VIEW.x + MAP_VIEW.width / 2, this.banner.y, this.banner.age);
    return frame.data;
  }

  /** The province's name across the sky, with a fanfare: a new commission begins. */
  announce() {
    const commission = commissionOf(this.state);
    const sprite = paintBanner(this.map.province.name.toUpperCase(), `Commission ${roman(this.state.campaign.chapter + 1)} \u00b7 ${commission.villain}`);
    // Across the top of the sky, or the bottom if that's where the hero stands.
    const heroY = MAP_VIEW.y + this.state.hero.at[1] - this.view.camera.y;
    const y = heroY < MAP_VIEW.y + 190 ? MAP_VIEW.y + MAP_VIEW.height - sprite.height - 40 : MAP_VIEW.y + 70;
    this.banner = { sprite, age: 0, y };
    play('fanfare');
  }

  /**
   * The province's own tune; a villain's theme near his lair; and while the hero is in a castle or
   * a village, with its card open, the town's.
   */
  get music(): TrackId {
    if (this.inTown > 0) return 'town';
    return lairTune(this.state, [this.drawn.x, this.drawn.y]) ?? provinceTune(this.state.campaign.chapter, Boolean(this.map.province.fen));
  }

  /** Whether the hero is in a castle or village, with its card open: its tune plays, and lingers a moment after. */
  private visitingTown(): boolean {
    const here = this.cardPlace && this.cards.isOpen ? this.state.locations.find((l) => l.id === this.cardPlace) : null;
    return Boolean(here && (here.kind === 'castle' || here.kind === 'village') && !here.look && Math.hypot(here.at[0] - this.drawn.x, here.at[1] - this.drawn.y) < TOWN_REACH);
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
    const seen = x > camera.x && x < camera.x + MAP_VIEW.width && y > camera.y && y < camera.y + MAP_VIEW.height;
    const at = seen ? { x, y } : { x: camera.x + MAP_VIEW.width / 2, y: camera.y + MAP_VIEW.height / 2 };
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
    this.cardPlace = null;
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
  }

  hideCard() {
    this.looking = null;
    this.cardPlace = null;
    this.restartAsked = false;
    this.cards.hide();
  }

  // --- The rules --------------------------------------------------------------------------

  private run(result: Result | null) {
    if (!result) return;
    const before = this.state;
    this.state = result.state;
    if (this.state.gold > before.gold) play('coins');
    this.handle(result.events);
    this.floatGains(before, this.state);
    saveGame(this.state);
  }

  /** Whatever the hero gained rises off him in words, one after another: gold, troops, leadership, experience. */
  private floatGains(before: GameState, after: GameState) {
    const gains: [string, number][] = [];
    const gold = after.gold - before.gold;
    if (gold) gains.push([`${gold > 0 ? '+' : '\u2212'}${Math.abs(gold).toLocaleString('en-GB')} gold`, gold > 0 ? GOLD[6] : RED[5]]);
    for (const stack of after.army) {
      const had = before.army.find((s) => s.troop === stack.troop)?.count ?? 0;
      if (stack.count > had && !before.battle) gains.push([`+${troops(stack.troop, stack.count - had)}`, PARCHMENT[6]]);
    }
    if (after.leadership > before.leadership) gains.push([`+${after.leadership - before.leadership} leadership`, BLUE[6]]);
    if (after.hero.level > before.hero.level) gains.push([`Level ${roman(after.hero.level)}!`, GOLD[6]]);
    else if (after.hero.xp > before.hero.xp) gains.push([`+${after.hero.xp - before.hero.xp} experience`, NEUTRAL[7]]);
    if (gains.length) this.gains.push(...gains);
  }

  /** Gains wait until no card is in the way, then rise one after another; a level-up card waits for them. */
  private releaseGains() {
    if (this.cards.isOpen || !this.gains.length) return;
    for (const [i, [text, colour]] of this.gains.entries()) this.view.effects.floatText(this.drawn.x, this.drawn.y - this.scene.hero.head - 12, text, colour, i * 0.35);
    this.celebrating = 0.6 + this.gains.length * 0.35;
    if (this.gains.some(([text]) => text.startsWith('Level'))) this.view.effects.puff(this.drawn.x, this.drawn.y, 'glow');
    this.gains = [];
  }

  /** Shows events that happened elsewhere, like the arrival card of a new commission. */
  play(events: GameEvent[]) {
    this.handle(events);
  }

  private handle(events: GameEvent[]) {
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
          this.showCard(e.card, e.place ? this.anchorOf(e.place) : e.at);
          this.cardPlace = e.place ?? null;
          // A fight the sergeants settled gets the same brass, or the same bell, as one fought on the field.
          if (!this.fromBattle && (e.card.title === 'Victory!' || e.card.title === 'Defeat')) sting(e.card.title === 'Defeat' ? 'defeat' : 'victory');
          break;
        case 'reveal':
          this.scene.fog.reveal(this.state.explored, e.at[0], e.at[1], e.radius);
          break;
        case 'added':
          addPlace(this.scene, locationById(this.state, e.id));
          break;
        case 'removed': {
          const gone = this.state.locations.find((l) => l.id === e.id);
          if (gone) this.view.effects.puff(gone.at[0], gone.at[1], gone.enemy ? 'dust' : 'sparkle');
          const object = this.scene.pickups.get(e.id);
          if (object) this.view.remove(object);
          this.scene.pickups.delete(e.id);
          break;
        }
        case 'day':
          this.tiredShown = false;
          this.nightfall = 0;
          this.sinceDawn = 0;
          play('day');
          if (e.payday) sting('payday');
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

  private repaintHud() {
    this.hudMovement = Math.floor(this.state.movement);
    this.hud = paintHud(this.view.frame, this.state, this.hudHover && this.barClickable(this.hudHover) ? this.hudHover.item : null);
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
            lines: ['A new campaign begins with the King, and **this one is gone for good**: the hero, his gear, his army and every commission so far.'],
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
        this.run(apply(this.state, action));
      }
    }
  }

  /** Plots a route to `target`. With `visitId`, the hero visits that place when he gets there. */
  plan(target: Point, visitId: string | null) {
    const facing = visitId ? locationById(this.state, visitId) : null;
    const route = planRoute(this.state, this.map, target, Boolean(facing?.enemy && !facing.done));
    if (!route) {
      this.showCard({ title: 'No way through', lines: ['Not even a goat could get there from here.'], choices: [] }, target);
      return;
    }
    this.route = route;
    this.target = route.length ? target : null;
    this.visiting = visitId;
    this.follow = true;
    this.tiredShown = false;
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
    this.run(visit(this.state, id));
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
    this.inTown = this.visitingTown() ? TOWN_LINGER : Math.max(0, this.inTown - dt);
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
      this.follow = false;
      this.view.scrollTo(this.view.camera.x + dx * SCROLL_SPEED, this.view.camera.y + dy * SCROLL_SPEED);
    }
    // Shift gallops: three times the pace, for long rides.
    this.ride(held.has('shift') ? dt * GALLOP : dt);
    const { hero } = this.scene;
    this.view.effects.update(dt, [this.drawn.x, this.drawn.y]);
    const walking = this.isRiding();
    const facing = this.state.hero.facing;
    hero.object.frames = walking ? (facing > 0 ? hero.walk : hero.walkLeft) : facing > 0 ? hero.idle : hero.idleLeft;
    hero.object.frame = walking ? Math.floor(this.travelled / STRIDE) : undefined;
    hero.object.x = this.drawn.x - hero.idle[0].width / 2;
    hero.object.y = this.drawn.y - hero.foot;
    this.view.route = this.route.length > 0 ? this.routeDots() : [];
    if (this.follow) {
      const tx = this.drawn.x - MAP_VIEW.width / 2;
      const ty = this.drawn.y - MAP_VIEW.height / 2 - 20;
      const k = Math.min(1, dt * 2.5);
      this.view.scrollTo(this.view.camera.x + (tx - this.view.camera.x) * k, this.view.camera.y + (ty - this.view.camera.y) * k);
      if (!walking && Math.hypot(tx - this.view.camera.x, ty - this.view.camera.y) < 2) this.follow = false;
    }
    if (Math.floor(this.state.movement) !== this.hudMovement) this.repaintHud();
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
    const days = daysAway(this.state, this.map, r.point, r.approach);
    if (r.name) r.text = `${r.name} \u00b7 ${days === null ? 'no way through yet' : whenThere(days)}`;
    else r.text = days === null ? 'No way through' : `Ride here: ${whenThere(days)}`;
    this.label.show(r.text, r.client[0], r.client[1]);
  }

  /** Trotting only while the drawn hero is actually on the move, not while a tired route waits. */
  private isRiding() {
    const [x, y] = this.state.hero.at;
    return Math.hypot(x - this.drawn.x, y - this.drawn.y) > 0.5;
  }

  /** Moves the drawn hero towards his cell, and steps the rules on as soon as he gets close. */
  private ride(dt: number) {
    let budget = this.speed * dt;
    for (let guard = 0; guard < 64 && budget > 0; guard++) {
      const [tx, ty] = this.state.hero.at;
      const d = Math.hypot(tx - this.drawn.x, ty - this.drawn.y);
      if (d < 2.5 && this.route.length > 0) {
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
          this.showCard(
            {
              title: ART[heroArtId(this.state.hero.background)].rides ? 'Your horse is spent' : 'Your legs are spent',
              lines: ['End the day to rest, and he rides on at dawn. Red marks are for tomorrow.'],
              choices: [
                { label: 'End the day (E)', action: { type: 'endDay' } },
                { label: 'Not yet', detail: 'Look around first: the route waits.', action: { type: 'close' } },
              ],
            },
            [this.drawn.x, this.drawn.y - this.scene.hero.foot],
          );
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

  /** Dots every 10 pixels along the road ahead, gold while today's movement lasts. */
  private routeDots() {
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
    return dots;
  }

  /**
   * Keeps the open card hanging above whatever it describes, or beside it, never over it; one about
   * nothing in particular keeps clear of the hero.
   */
  placeCard() {
    const a = this.cardAnchor;
    const { camera } = this.view;
    const point = a && this.display.toPage(MAP_VIEW.x + a[0] - camera.x, MAP_VIEW.y + a[1] - camera.y);
    const hero = this.scene.hero;
    const heroBox = { x0: hero.object.x, y0: hero.object.y, x1: hero.object.x + hero.idle[0].width, y1: hero.object.y + hero.foot + 6 };
    const inside = (b: { x0: number; y0: number; x1: number; y1: number }) => a && a[0] >= b.x0 && a[0] < b.x1 && a[1] >= b.y0 && a[1] < b.y1;
    // What the card is about: the place (or the hero) its anchor is on, or a little space round the point.
    const place = a && this.scene.hitboxes.filter((b) => inside(b)).reduce<Hitbox | null>((front, b) => (!front || b.y1 > front.y1 ? b : front), null);
    const box = !a ? heroBox : inside(heroBox) ? heroBox : (place ?? { x0: a[0] - 12, y0: a[1] - 12, x1: a[0] + 12, y1: a[1] + 12 });
    const from = this.display.toPage(MAP_VIEW.x + box.x0 - camera.x, MAP_VIEW.y + box.y0 - camera.y);
    const to = this.display.toPage(MAP_VIEW.x + box.x1 - camera.x, MAP_VIEW.y + box.y1 - camera.y);
    this.cards.place(point, this.display.toPage(0, MAP_VIEW.y).y, this.display.toPage(0, MAP_VIEW.y + MAP_VIEW.height).y, { x0: from.x, y0: from.y, x1: to.x, y1: to.y });
  }

  // --- Input ------------------------------------------------------------------------------

  /**
   * The place (or the hero) under a map point, front-most first. A place the hero stands in front of
   * is still the hero; one drawn in front of him (lower on the map) takes the click.
   */
  private under([x, y]: Point): { id: string; name: string; box?: Hitbox; fogged?: boolean } | null {
    const h = this.scene.hero.object;
    const width = this.scene.hero.idle[0].width;
    const onHero = x >= h.x + 6 && x < h.x + width - 6 && y >= h.y + 4 && y < h.y + this.scene.hero.foot + 4;
    const gone = (id: string) => {
      const l = this.state.locations.find((p) => p.id === id);
      return !!l && l.done && (l.kind === 'chest' || l.kind === 'gold' || l.kind === 'patrol');
    };
    const hits = this.scene.hitboxes.filter((b) => x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1 && !gone(b.id));
    const heroFoot = h.y + this.scene.hero.foot;
    const inFront = hits.filter((b) => b.y1 > heroFoot + 2);
    if (onHero && inFront.length === 0) return { id: 'hero', name: `${BACKGROUNDS[this.state.hero.background].short} \u00b7 ${this.moving() ? 'click (or Esc) to stop here' : 'click (or H) for his gear and army'}` };
    if (hits.length === 0) return null;
    const box = hits.reduce((front, b) => (b.y1 > front.y1 ? b : front));
    const fogged = this.view.isFogged((box.x0 + box.x1) / 2, box.y1 - 4);
    return { id: box.id, name: fogged ? 'Unexplored' : placeNote(this.state, box.id), box, fogged };
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

  /** The hourglass ends the day; the army and the mana open the hero; the bounty shows the poster. */
  private clickBar(hit: HudHit) {
    if (!this.barClickable(hit)) return;
    if (hit.item.kind === 'hourglass') this.choose({ type: 'endDay' });
    else if (hit.item.kind === 'bounty') this.showCard(bountyCard(this.state), null);
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
    click: (x: number, y: number) => {
      const bar = this.onBar(x, y);
      if (bar) return this.clickBar(bar);
      const point = this.view.toMap(x, y);
      if (point) this.clickMap(point);
    },
    look: (x: number, y: number) => {
      const point = this.view.toMap(x, y);
      if (point) this.lookMap(point);
    },
    hover: (x: number, y: number, clientX: number, clientY: number) => {
      const bar = this.onBar(x, y);
      this.hoverBar(bar);
      if (bar) {
        this.resting = null;
        this.display.canvas.style.cursor = this.barClickable(bar) ? 'pointer' : 'default';
        this.label.show(barNote(this.state, bar.item), clientX, clientY);
        return;
      }
      const point = this.view.toMap(x, y);
      const thing = point ? this.under(point) : null;
      // Crossed swords over an enemy, as in HoMM2: a click there is the start of a fight.
      const foe = thing?.box && !thing.fogged && this.state.locations.some((l) => l.id === thing.id && l.enemy && !l.done);
      this.display.canvas.style.cursor = foe ? swordsCursor() : thing ? 'pointer' : 'default';
      const again = thing && this.looking?.id === thing.id && this.cards.isOpen ? ` \u00b7 click again: ${this.looking.label}` : '';
      // On open ground, or a place seen clearly, the ride's length comes up once the pointer rests.
      const place = thing?.box && !thing.fogged ? locationById(this.state, thing.id) : null;
      const key = place ? `place:${place.id}` : !thing && point ? `cell:${Math.floor(point[1] / 8) * this.map.width + Math.floor(point[0] / 8)}` : null;
      if (!key) this.resting = null;
      else if (this.resting?.key !== key) this.resting = { key, point: place ? place.at : point!, approach: Boolean(place?.enemy && !place.done), name: thing?.name ?? null, client: [clientX, clientY], still: 0 };
      else this.resting.client = [clientX, clientY];
      const known = this.resting?.text && !again ? this.resting.text : null;
      if (known) this.label.show(known, clientX, clientY);
      else if (thing) this.label.show(`${thing.name}${again}`, clientX, clientY);
      else this.label.hide();
    },
    drag: (dx: number, dy: number) => {
      this.follow = false;
      this.view.scrollTo(this.view.camera.x - dx, this.view.camera.y - dy);
    },
    wheel: (dx: number, dy: number) => {
      this.follow = false;
      this.view.scrollTo(this.view.camera.x + dx, this.view.camera.y + dy);
      // The ground under the pointer has moved: its label comes back when the pointer does.
      this.resting = null;
      this.label.hide();
    },
    leave: () => {
      this.label.hide();
      this.hoverBar(null);
      this.resting = null;
    },
    key: (key: string) => {
      if (this.state.opening) return;
      if (key === 'e' && !this.state.over && !this.state.ambush) this.choose({ type: 'endDay' });
      else if (key === 'h' && !this.state.over && !this.state.ambush) this.openHero();
      else if (key === '?') this.showCard(keysCard(), null);
      else if (this.cards.key(key)) return;
      // Space with no card up brings the view back to the hero.
      else if (key === ' ' && !this.cards.isOpen) this.follow = true;
      else if (key === 'escape') {
        // Esc puts a card away, or with none up, reins in.
        if (this.cards.isOpen) this.hideCard();
        else this.stop();
      }
      else if (key.startsWith('arrow') || 'wasd'.includes(key)) this.follow = false;
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
      frameHash: () => {
        let h = 0x811c9dc5;
        for (const v of this.view.screen.data) h = Math.imul(h ^ v, 0x01000193);
        return (h >>> 0).toString(16);
      },
    };
  }
}
