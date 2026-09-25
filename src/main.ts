import { PerspectiveCamera, Vector2, Vector3, WebGLRenderer, type Box3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildLookTestScene } from './render/lookTestScene';
import { DioramaLook } from './render/looks/diorama';
import type { Look } from './render/looks/look';
import { PixelArtLook } from './render/looks/pixelArt';

declare global {
  interface Window {
    /** Set once the scene has loaded and rendered a few frames. Used by the screenshot script. */
    __ready?: boolean;
  }
}

const VIEW_ELEVATION = (52 * Math.PI) / 180;

/** Moves the camera along `direction` until the whole box fits inside the view. */
function frameBox(camera: PerspectiveCamera, box: Box3, target: Vector3, direction: Vector3, margin = 0.94) {
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(
    (i) =>
      new Vector3(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z,
      ),
  );
  const fits = (distance: number) => {
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    return corners.every((corner) => {
      const p = corner.clone().project(camera);
      return Math.abs(p.x) <= margin && Math.abs(p.y) <= margin && p.z < 1;
    });
  };
  let near = 1;
  let far = 500;
  for (let i = 0; i < 40; i++) {
    const mid = (near + far) / 2;
    if (fits(mid)) far = mid;
    else near = mid;
  }
  fits(far);
}

async function main() {
  const hud = document.getElementById('hud')!;
  const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  document.body.prepend(renderer.domElement);

  const world = await buildLookTestScene();
  const camera = new PerspectiveCamera(28, 1, 1, 300);
  const target = new Vector3(0, 0.6, 0.4);
  const defaultDirection = new Vector3(0, Math.sin(VIEW_ELEVATION), Math.cos(VIEW_ELEVATION));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = 1.25;
  controls.minDistance = 10;
  controls.maxDistance = 90;

  const pixelArt = new PixelArtLook(renderer, world.scene, camera, world.sun);
  const diorama = new DioramaLook(renderer, world.scene, camera, world.sun);
  const looks: Record<Look['id'], Look> = { a: pixelArt, b: diorama };
  const params = new URLSearchParams(window.location.search);
  let look: Look = params.get('look') === 'b' ? diorama : pixelArt;
  const pixelParam = Number(params.get('px'));
  if (pixelParam >= 2) pixelArt.pixelSize = pixelParam;

  const updateHud = () => {
    hud.innerHTML = `${look.label}<small>Space: switch A/B · drag: orbit · R: reset view</small><small>${look.hint()}</small>`;
  };

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    const size = renderer.getDrawingBufferSize(new Vector2());
    look.setSize(size.x, size.y);
    updateHud();
  };

  const resetView = () => {
    look.setSize(renderer.domElement.width, renderer.domElement.height);
    frameBox(camera, world.bounds, target, defaultDirection);
    controls.update();
  };

  const setLook = (next: Look) => {
    look = next;
    look.activate();
    resize();
  };

  window.addEventListener('resize', resize);
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code === 'Tab') {
      event.preventDefault();
      setLook(look === pixelArt ? diorama : pixelArt);
    } else if (event.key === '1' || event.key === 'a') setLook(looks.a);
    else if (event.key === '2' || event.key === 'b') setLook(looks.b);
    else if (event.key === 'r') resetView();
    else if (look === pixelArt && (event.key === '[' || event.key === ']')) {
      pixelArt.nudgePixelSize(event.key === '[' ? -1 : 1);
      updateHud();
    }
  });

  setLook(look);
  resetView();

  let frames = 0;
  let last = performance.now();
  const start = last;
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    controls.update();
    world.update(dt, (now - start) / 1000);
    look.render();
    if (++frames === 10) window.__ready = true;
  });
}

main().catch((error: unknown) => {
  console.error(error);
  document.getElementById('hud')!.textContent = `Failed to start: ${String(error)}`;
});
