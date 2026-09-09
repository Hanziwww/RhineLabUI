import * as THREE from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { DenoiseMaterial, WebGLPathTracer } from "three-gpu-pathtracer";
import { GenerateMeshBVHWorker } from "three-mesh-bvh/worker";
import { ArchiveTraceSnapshot } from "./archive-trace-snapshot";
import { createArchiveEnvironment, WARM_STUDIO } from "./archive-lighting";

export type ArchiveTraceState =
  | "off"
  | "interactive"
  | "building"
  | "preparing"
  | "refining"
  | "complete"
  | "error";

export class ArchivePathTracer {
  private snapshot = new ArchiveTraceSnapshot();
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private tracer: WebGLPathTracer;
  private worker = new GenerateMeshBVHWorker();
  private environment: THREE.WebGLCubeRenderTarget;
  private denoise = new DenoiseMaterial({
    sigma: 2,
    kSigma: 2,
    threshold: 0.3,
  });
  private quad = new FullScreenQuad(this.denoise);
  private dirty = true;
  private building = false;
  private revision = 0;
  private idleSince = 0;
  private failed = false;
  private disposed = false;
  private progress = 0;
  private builds = 0;
  private readonly sampleLimit = 512;
  state: ArchiveTraceState = "preparing";

  constructor(
    private renderer: THREE.WebGLRenderer,
    private source: THREE.Scene,
    private sourceCamera: THREE.PerspectiveCamera,
    private rasterize: () => void,
    private prepareDepth: () => THREE.Texture,
  ) {
    this.camera = sourceCamera.clone();
    this.scene.background = source.background;
    this.scene.add(this.snapshot.root);
    const room = createArchiveEnvironment();
    this.environment = new THREE.WebGLCubeRenderTarget(256, {
      type: THREE.HalfFloatType,
    });
    new THREE.CubeCamera(0.1, 100, this.environment).update(renderer, room);
    room.dispose();
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = WARM_STUDIO.tracedEnvironment;
    source.traverse((object) => {
      if (!(object instanceof THREE.DirectionalLight)) return;
      // Distant panels retain the warm studio directions across the full array.
      const distance = 90;
      const size = object.intensity > 1 ? 22 : 30;
      const light = new THREE.RectAreaLight(
        object.color,
        (object.intensity * distance ** 2) / size ** 2,
        size,
        size,
      );
      light.position.copy(object.position).normalize().multiplyScalar(distance);
      light.lookAt(0, -1, 0);
      this.scene.add(light);
    });
    Object.assign(this.denoise.uniforms, {
      archiveDepth: { value: null },
      archiveClip: { value: new THREE.Vector2() },
      archiveFog: { value: new THREE.Vector2() },
      archiveFogColor: { value: (source.fog as THREE.Fog).color.clone() },
    });
    // Compare display luminance when preserving edges; raw HDR differences
    // otherwise misclassify glass highlights as detail and retain their noise.
    this.denoise.fragmentShader = this.denoise.fragmentShader.replace(
      "vec4 dC = walkPx - centrPx;",
      `vec4 dC = walkPx - centrPx;
       #ifdef TONE_MAPPING
         dC.rgb = toneMapping(walkPx.rgb) - toneMapping(centrPx.rgb);
       #endif`,
    );
    this.denoise.fragmentShader = `
      #include <packing>
      uniform sampler2D archiveDepth;
      uniform vec2 archiveClip;
      uniform vec2 archiveFog;
      uniform vec3 archiveFogColor;
      ${this.denoise.fragmentShader}`.replace(
      "#include <tonemapping_fragment>",
      `float viewDepth = -perspectiveDepthToViewZ(texture2D(archiveDepth, vUv).x, archiveClip.x, archiveClip.y);
       gl_FragColor.rgb = mix(gl_FragColor.rgb, archiveFogColor, smoothstep(archiveFog.x, archiveFog.y, viewDepth));
       #include <tonemapping_fragment>`,
    );
    this.tracer = new WebGLPathTracer(renderer);
    this.tracer.setBVHWorker(this.worker);
    this.tracer.bounces = 8;
    this.tracer.transmissiveBounces = 20;
    this.tracer.filterGlossyFactor = 0.3;
    this.tracer.textureSize.set(1024, 1024);
    this.tracer.tiles.set(3, 2);
    this.tracer.minSamples = 12;
    this.tracer.fadeDuration = 650;
    this.tracer.renderDelay = 100;
    this.tracer.renderScale = 1;
    this.tracer.rasterizeSceneCallback = rasterize;
    this.tracer.renderToCanvasCallback = (target, activeRenderer, original) => {
      this.denoise.uniforms.map.value = target.texture;
      this.denoise.uniforms.opacity.value = original.material.opacity;
      this.denoise.blending = original.material.blending;
      this.denoise.transparent = original.material.transparent;
      this.denoise.premultipliedAlpha = original.material.premultipliedAlpha;
      const clear = activeRenderer.autoClear;
      activeRenderer.autoClear = false;
      this.quad.render(activeRenderer);
      activeRenderer.autoClear = clear;
    };
  }

  invalidate() {
    this.revision++;
    this.dirty = true;
    this.tracer.reset();
  }

  private async rebuild() {
    const revision = this.revision;
    this.building = true;
    this.progress = 0;
    try {
      this.snapshot.update(this.source);
      this.camera.copy(this.sourceCamera);
      this.denoise.uniforms.archiveDepth.value = this.prepareDepth();
      this.denoise.uniforms.archiveClip.value.set(
        this.camera.near,
        this.camera.far,
      );
      const fog = this.source.fog as THREE.Fog;
      this.denoise.uniforms.archiveFog.value.set(fog.near, fog.far);
      await this.tracer.setSceneAsync(this.scene, this.camera, {
        onProgress: (value: number) => {
          this.progress = value;
        },
      });
      this.progress = 1;
      this.builds++;
      if (revision === this.revision) this.dirty = false;
    } catch (error) {
      if (!this.disposed) {
        console.error("Archive path tracing failed", error);
        this.failed = true;
      }
    } finally {
      this.building = false;
      if (this.disposed) this.release();
    }
  }

  render(time: number, moving: boolean): ArchiveTraceState {
    if (this.failed) {
      this.rasterize();
      return (this.state = "error");
    }
    if (moving) {
      this.idleSince = time;
      this.invalidate();
      this.rasterize();
      return (this.state = "interactive");
    }
    if (time - this.idleSince < 0.4 || this.building) {
      this.rasterize();
      return (this.state = this.building ? "building" : "interactive");
    }
    if (this.dirty) {
      this.rasterize();
      void this.rebuild();
      return (this.state = "building");
    }
    if (this.tracer.samples >= this.sampleLimit)
      return (this.state = "complete");
    this.tracer.renderSample();
    return (this.state =
      this.tracer.samples < this.tracer.minSamples ? "preparing" : "refining");
  }

  getStats() {
    return {
      engine: "three-gpu-pathtracer",
      state: this.state,
      samples: this.dirty ? 0 : this.tracer.samples,
      sampleLimit: this.sampleLimit,
      width: this.tracer.target.width,
      height: this.tracer.target.height,
      triangles: this.snapshot.triangles,
      expandedInstances: this.snapshot.instanceCount,
      builds: this.builds,
      buildProgress: this.progress,
      geometry: "actual-triangles",
      worker: true,
      areaLights: 3,
    };
  }

  dispose() {
    this.disposed = true;
    this.revision++;
    // Let a pending worker return its transferred buffers before releasing them.
    if (!this.building) this.release();
  }

  private release() {
    this.worker.dispose();
    this.tracer.dispose();
    this.environment.dispose();
    this.denoise.dispose();
    this.quad.dispose();
    this.snapshot.dispose();
  }
}
