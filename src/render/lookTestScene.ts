import {
  AnimationMixer,
  Box3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { Dir, cellKey, cellToWorld, dirBetween, ROW_STEP, type Cell } from './hex';
import { CASTLE, COLS, HERO, PROPS, RIVER, ROAD, ROWS } from './lookTestMap';
import { createWaterMaterial, splitWater } from './water';

const ASSETS = `${import.meta.env.BASE_URL}assets/`;
const HEX_PACK = `${ASSETS}kaykit-medieval-hexagon/`;
const HERO_MODEL = `${ASSETS}kaykit-adventurers/Knight.glb`;
const TURN = Math.PI / 3;

type TileDef = { file: string; water: Dir[]; road: Dir[] };

/** Edge connections of the KayKit tiles in their default orientation (measured from the models). */
const TILES: TileDef[] = [
  { file: 'tiles/base/hex_grass', water: [], road: [] },
  { file: 'tiles/rivers/hex_river_A_curvy', water: [Dir.E, Dir.W], road: [] },
  { file: 'tiles/rivers/hex_river_B', water: [Dir.W, Dir.NE], road: [] },
  { file: 'tiles/rivers/hex_river_C', water: [Dir.W, Dir.NW], road: [] },
  { file: 'tiles/rivers/hex_river_crossing_A', water: [Dir.E, Dir.W], road: [Dir.SE, Dir.NW] },
  { file: 'tiles/rivers/hex_river_crossing_B', water: [Dir.E, Dir.W], road: [Dir.SW, Dir.NE] },
  { file: 'tiles/roads/hex_road_A', water: [], road: [Dir.E, Dir.W] },
  { file: 'tiles/roads/hex_road_B', water: [], road: [Dir.W, Dir.NE] },
  { file: 'tiles/roads/hex_road_C', water: [], road: [Dir.W, Dir.NW] },
  { file: 'tiles/roads/hex_road_M', water: [], road: [Dir.W] },
];

/** Rotating a tile by k * 60° about +y moves its edge d to d - k. */
const turned = (dirs: Dir[], k: number) =>
  dirs
    .map((d) => (d - k + 6) % 6)
    .sort()
    .join();

function pickTile(water: Dir[], road: Dir[]): { file: string; turns: number } {
  const want = [[...water].sort().join(), [...road].sort().join()];
  for (const tile of TILES) {
    for (let k = 0; k < 6; k++) {
      if (turned(tile.water, k) === want[0] && turned(tile.road, k) === want[1]) return { file: tile.file, turns: k };
    }
  }
  throw new Error(`No KayKit tile connects water [${water}] and road [${road}]`);
}

function pathEdges(path: Cell[]): Map<string, Dir[]> {
  const edges = new Map<string, Dir[]>();
  path.forEach((cell, i) => {
    const dirs: Dir[] = [];
    if (i > 0) dirs.push(dirBetween(cell, path[i - 1]));
    if (i < path.length - 1) dirs.push(dirBetween(cell, path[i + 1]));
    edges.set(cellKey(cell), dirs);
  });
  return edges;
}

/** Small deterministic RNG so the scene is identical on every reload. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type LookTestWorld = {
  scene: Scene;
  sun: DirectionalLight;
  bounds: Box3;
  update(dt: number, elapsed: number): void;
};

export async function buildLookTestScene(): Promise<LookTestWorld> {
  const loader = new GLTFLoader();
  const cache = new Map<string, Promise<GLTF>>();
  const load = (url: string) => {
    if (!cache.has(url)) cache.set(url, loader.loadAsync(url));
    return cache.get(url)!;
  };

  const atlas = await new TextureLoader().loadAsync(`${HEX_PACK}tiles/base/hexagons_medieval.png`);
  atlas.colorSpace = SRGBColorSpace;
  atlas.flipY = false;
  atlas.anisotropy = 4;
  const time = { value: 0 };
  const land = new MeshStandardMaterial({ map: atlas, roughness: 0.6, metalness: 0 });
  const water = createWaterMaterial(atlas, time);
  const splitCache = new Map<string, ReturnType<typeof splitWater>>();

  /** Clones a KayKit model with the shared atlas material, splitting out water faces where present. */
  async function kaykit(file: string): Promise<Object3D> {
    const gltf = await load(`${HEX_PACK}${file}.gltf`);
    const root = gltf.scene.clone();
    root.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      if (!splitCache.has(file)) splitCache.set(file, splitWater(node.geometry));
      const split = splitCache.get(file);
      if (split) {
        node.geometry = split;
        node.material = [land, water] as Material[];
      } else {
        node.material = land;
      }
      node.castShadow = true;
      node.receiveShadow = true;
    });
    return root;
  }

  const board = new Group();
  const place = (object: Object3D, cell: Cell, turns = 0, dx = 0, dz = 0) => {
    const { x, z } = cellToWorld(cell);
    object.position.set(x + dx, 0, z + dz);
    object.rotation.y = turns * TURN;
    board.add(object);
    return object;
  };

  const riverEdges = pathEdges(RIVER);
  const roadEdges = pathEdges(ROAD);
  const tiles: Promise<unknown>[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = { col, row };
      const key = cellKey(cell);
      const isCastle = key === cellKey(CASTLE.cell);
      const { file, turns } = pickTile(riverEdges.get(key) ?? [], isCastle ? [] : (roadEdges.get(key) ?? []));
      tiles.push(
        kaykit(file).then(async (tile) => {
          place(tile, cell, turns);
          if (file.includes('crossing')) {
            // The bridge models already run along their crossing tile's road.
            const bridge = await kaykit(`buildings/neutral/building_bridge_${file.endsWith('_A') ? 'A' : 'B'}`);
            place(bridge, cell, turns);
          }
        }),
      );
    }
  }

  // KayKit buildings face +z, which is 90° from the E edge; turn the gate towards the road.
  tiles.push(kaykit('buildings/blue/building_castle_blue').then((castle) => place(castle, CASTLE.cell, 1.5 - CASTLE.gate)));

  const rng = mulberry32(7);
  for (const prop of PROPS) {
    const turns = Math.floor(rng() * 6) + (rng() - 0.5) * 0.4;
    tiles.push(kaykit(prop.model).then((object) => place(object, prop.cell, turns, prop.dx, prop.dz)));
  }

  const heroGltf = await load(HERO_MODEL);
  const hero = heroGltf.scene;
  const hidden = new Set(['1H_Sword_Offhand', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '2H_Sword']);
  hero.traverse((node) => {
    if (hidden.has(node.name)) node.visible = false;
    if (node instanceof Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  const heroHeight = new Box3().setFromObject(hero).getSize(new Vector3()).y;
  hero.scale.setScalar(1.35 / heroHeight);
  place(hero, HERO.cell, 0, -0.15, 0.1).rotation.y = HERO.facing;
  const mixer = new AnimationMixer(hero);
  const idle = heroGltf.animations.find((clip) => clip.name === 'Idle');
  if (idle) mixer.clipAction(idle).play();

  await Promise.all(tiles);

  // Centre the board on the origin.
  const last = cellToWorld({ col: COLS - 1, row: 1 });
  board.position.set(-last.x / 2, 0, (-(ROWS - 1) * ROW_STEP) / 2);

  const scene = new Scene();
  scene.background = new Color('#3a4a5e');
  scene.add(board);

  const table = new Mesh(new PlaneGeometry(400, 400), new MeshStandardMaterial({ color: '#3a4a5e', roughness: 1 }));
  table.rotation.x = -Math.PI / 2;
  table.position.y = -1;
  table.receiveShadow = true;
  scene.add(table);

  const sun = new DirectionalLight('#fff0dc', 3.0);
  sun.position.set(-9, 12, -4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, new HemisphereLight('#b9d3ff', '#4f5a3a', 1.4));

  board.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(board);

  return {
    scene,
    sun,
    bounds,
    update(dt, elapsed) {
      time.value = elapsed;
      mixer.update(dt);
    },
  };
}
