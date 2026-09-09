import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export type LightingLook = "baseline" | "refined" | "warm";

export const WARM_STUDIO = {
  exposure: 0.96,
  environment: 0.42,
  tracedEnvironment: 0.58,
  environmentFill: 2.0,
  hemisphere: 0.5,
  keyColor: "#fff5e8",
  key: 1.65,
  fill: 0.36,
  rimColor: "#ffd593",
  rim: 0.55,
} as const;

export function createArchiveEnvironment(look: LightingLook = "warm") {
  const room = new RoomEnvironment();
  if (look === "warm") {
    // The reference is a white studio. Lift unlit room walls so clear acrylic
    // reflects a soft neutral field instead of the stock room's black patches.
    room.add(new THREE.AmbientLight("#fffdf9", WARM_STUDIO.environmentFill));
  }
  return room;
}

// The archive and its independent viewer use the same studio illumination.
// Each renderer needs its own PMREM render target / WebGL texture.
export function createArchiveLighting(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  look: LightingLook = "baseline",
) {
  const refined = look === "refined";
  const warm = look === "warm";
  renderer.toneMappingExposure = warm
    ? WARM_STUDIO.exposure
    : refined
      ? 1.0
      : 1.05;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = createArchiveEnvironment(look);
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  scene.environmentIntensity = warm
    ? WARM_STUDIO.environment
    : refined
      ? 0.52
      : 0.48;
  scene.add(
    new THREE.HemisphereLight(
      warm ? "#fffdf8" : "#fffaf5",
      warm ? "#c1b5a5" : refined ? "#b49b80" : "#b4a18c",
      warm ? WARM_STUDIO.hemisphere : refined ? 0.5 : 0.65,
    ),
  );
  const key = new THREE.DirectionalLight(
    warm ? WARM_STUDIO.keyColor : refined ? "#fff4e5" : "#fff7ed",
    warm ? WARM_STUDIO.key : refined ? 1.7 : 1.4,
  );
  key.position.set(
    ...((warm ? [-8, 14, 3] : refined ? [-8, 14, 4] : [-6, 14, -5]) as [
      number,
      number,
      number,
    ]),
  );
  const fill = new THREE.DirectionalLight(
    warm ? "#fffefa" : "#ffffff",
    warm ? WARM_STUDIO.fill : refined ? 0.3 : 0.6,
  );
  fill.position.set(7, 8, -10);
  scene.add(key, fill);
  if (warm) {
    const rim = new THREE.DirectionalLight(
      WARM_STUDIO.rimColor,
      WARM_STUDIO.rim,
    );
    rim.position.set(-8, 5, 8);
    scene.add(rim);
  }
  return key;
}
