import * as THREE from "three";
import { DenoiseMaterial, WebGLPathTracer } from "three-gpu-pathtracer";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { createArchiveEnvironment, WARM_STUDIO } from "./archive-lighting";

// The assembled viewer owns its tracing scene. Homepage instance snapshots
// and motion-aware accumulation are handled separately by archive-pathtracer.
export class ViewerPathTracer {
  readonly tracer: WebGLPathTracer;
  private scene = new THREE.Scene();
  private environment: THREE.WebGLCubeRenderTarget;
  private pairs: { source: THREE.Mesh; target: THREE.Mesh }[] = [];
  private materials: THREE.MeshStandardMaterial[] = [];
  private cameraDirty = true;
  private geometryDirty = true;
  private wasMoving = true;
  private idleSince = 0;
  private readonly sampleLimit = 512;
  private denoise = new DenoiseMaterial({
    sigma: 2,
    kSigma: 2,
    threshold: 0.6,
  });
  private denoiseQuad = new FullScreenQuad(this.denoise);

  constructor(
    private renderer: THREE.WebGLRenderer,
    private camera: THREE.PerspectiveCamera,
    private rasterScene: THREE.Scene,
    source: THREE.Group,
  ) {
    this.scene.background = rasterScene.background;
    // Capture the same studio used by raster rendering, in a cube format the
    // path tracer can importance-sample instead of feeding it a PMREM atlas.
    const room = createArchiveEnvironment();
    this.environment = new THREE.WebGLCubeRenderTarget(256, {
      type: THREE.HalfFloatType,
    });
    new THREE.CubeCamera(0.1, 100, this.environment).update(renderer, room);
    room.dispose();
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = WARM_STUDIO.tracedEnvironment;
    // Match the approved light directions and warmth with finite studio panels.
    rasterScene.traverse((object) => {
      if (!(object instanceof THREE.DirectionalLight)) return;
      const size = object.intensity > 1 ? [6, 5] : [5, 5];
      const area = new THREE.RectAreaLight(
        object.color,
        (object.intensity * object.position.lengthSq()) / (size[0] * size[1]),
        size[0],
        size[1],
      );
      area.position.copy(object.position);
      area.lookAt(0, 0, 0);
      this.scene.add(area);
    });
    source.updateWorldMatrix(true, true);
    source.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const original = object.material as THREE.MeshStandardMaterial;
      let material: THREE.MeshStandardMaterial;
      if (original.isMeshStandardMaterial) {
        material = original.clone();
        material.onBeforeCompile = () => {};
        // The old acrylic shader varies roughness with height. Its clear main
        // surface is represented with physical roughness in the ray renderer.
        if (object.userData.surface === "Frosted_Polymer") {
          (material as THREE.MeshPhysicalMaterial).roughness = 0.07;
          (material as THREE.MeshPhysicalMaterial).transmission = 0.96;
        }
        if (object.userData.surface === "Ivory_Edges") {
          (material as THREE.MeshPhysicalMaterial).roughness = 0.16;
          (material as THREE.MeshPhysicalMaterial).transmission = 0.76;
          material.metalness = 0;
        }
      } else {
        const printed = original as unknown as THREE.MeshBasicMaterial;
        material = new THREE.MeshStandardMaterial({
          color: printed.color,
          map: printed.map,
          opacity: printed.opacity,
          transparent: printed.transparent,
          side: printed.side,
          roughness: 0.65,
        });
      }
      (
        material as THREE.MeshStandardMaterial & { castShadow: boolean }
      ).castShadow = object.castShadow;
      this.materials.push(material);
      const target = new THREE.Mesh(object.geometry, material);
      target.matrixAutoUpdate = false;
      target.matrix.copy(object.matrixWorld);
      this.pairs.push({ source: object, target });
      this.scene.add(target);
    });
    this.tracer = new WebGLPathTracer(renderer);
    this.tracer.bounces = 6;
    this.tracer.transmissiveBounces = 12;
    this.tracer.filterGlossyFactor = 0.15;
    this.tracer.textureSize.set(1024, 1024);
    this.tracer.tiles.set(2, 2);
    this.tracer.minSamples = 24;
    this.tracer.renderDelay = 180;
    this.tracer.fadeDuration = 500;
    this.tracer.dynamicLowRes = false;
    this.tracer.renderScale = 1;
    this.tracer.rasterizeSceneCallback = () =>
      renderer.render(rasterScene, camera);
    this.tracer.renderToCanvasCallback = (
      target,
      activeRenderer,
      originalQuad,
    ) => {
      this.denoise.uniforms.map.value = target.texture;
      this.denoise.uniforms.opacity.value = originalQuad.material.opacity;
      this.denoise.blending = originalQuad.material.blending;
      this.denoise.transparent = originalQuad.material.transparent;
      this.denoise.premultipliedAlpha =
        originalQuad.material.premultipliedAlpha;
      const clear = activeRenderer.autoClear;
      activeRenderer.autoClear = false;
      this.denoiseQuad.render(activeRenderer);
      activeRenderer.autoClear = clear;
    };
  }

  invalidateCamera() {
    this.cameraDirty = true;
  }
  invalidateGeometry() {
    this.geometryDirty = true;
  }

  render(time: number, moving: boolean) {
    if (moving || this.cameraDirty) {
      this.idleSince = time;
      this.wasMoving = true;
      this.cameraDirty = false;
      this.tracer.reset();
      this.renderer.render(this.rasterScene, this.camera);
      return "interactive";
    }
    if (time - this.idleSince < 0.18) {
      this.renderer.render(this.rasterScene, this.camera);
      return "interactive";
    }
    // Keep the completed canvas until an actual camera or geometry change;
    // repeatedly denoising the same image needlessly occupies the GPU.
    if (
      !this.geometryDirty &&
      !this.wasMoving &&
      this.tracer.samples >= this.sampleLimit
    )
      return "complete";
    if (this.geometryDirty) {
      this.rasterScene.updateMatrixWorld(true);
      for (const pair of this.pairs)
        pair.target.matrix.copy(pair.source.matrixWorld);
      this.tracer.setScene(this.scene, this.camera);
      this.geometryDirty = false;
      this.wasMoving = false;
    } else if (this.wasMoving) {
      this.tracer.updateCamera();
      this.wasMoving = false;
    }
    this.tracer.pausePathTracing = this.tracer.samples >= this.sampleLimit;
    this.tracer.renderSample();
    return this.tracer.samples >= this.sampleLimit
      ? "complete"
      : this.tracer.samples < this.tracer.minSamples
        ? "preparing"
        : "refining";
  }

  getStats() {
    return {
      engine: "three-gpu-pathtracer",
      version: "0.0.24",
      samples: this.tracer.samples,
      bounces: this.tracer.bounces,
      transmissionBounces: this.tracer.transmissiveBounces,
      width: this.tracer.target.width,
      height: this.tracer.target.height,
      triangleGeometry: true,
      areaLights: 3,
      denoiser: "glslSmartDeNoise",
    };
  }

  dispose() {
    this.tracer.dispose();
    this.denoise.dispose();
    this.denoiseQuad.dispose();
    this.environment.dispose();
    for (const material of this.materials) material.dispose();
    this.pairs = [];
  }
}
