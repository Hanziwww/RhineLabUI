import * as THREE from "three";

// Expand instances only for the tracing snapshot. Interactive rendering keeps
// its instanced meshes, and the delivered Blender geometry is never modified.
export class ArchiveTraceSnapshot {
  readonly root = new THREE.Group();
  private meshes = new Map<string, THREE.Mesh>();
  private materials = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  private tintedGeometry = new Map<
    THREE.BufferGeometry,
    THREE.BufferGeometry
  >();
  instanceCount = 0;
  triangles = 0;

  private material(
    source: THREE.Material,
    array: boolean,
    castShadow: boolean,
  ) {
    let result = this.materials.get(source);
    if (!result) {
      if (source instanceof THREE.MeshStandardMaterial) {
        result = source.clone();
        result.onBeforeCompile = () => {};
      } else {
        const print = source as THREE.MeshBasicMaterial;
        result = new THREE.MeshStandardMaterial({
          color: print.color,
          map: print.map,
          transparent: print.transparent,
          opacity: print.opacity,
          side: print.side,
          roughness: 0.65,
        });
      }
      if (array && source.name.startsWith("Frosted_Polymer")) {
        result.vertexColors = true;
        const acrylic = result as THREE.MeshPhysicalMaterial;
        acrylic.color.set("#fffefc");
        acrylic.transmission = 0.96;
        acrylic.roughness = 0.065;
        acrylic.attenuationColor.set("#fffaf2");
        acrylic.attenuationDistance = 8;
      }
      if (source.name.startsWith("Ivory_Edges")) {
        const acrylic = result as THREE.MeshPhysicalMaterial;
        acrylic.color.set("#fffefc");
        // A small diffuse lobe keeps the thin moulded rims white under grazing
        // light, while most energy still transmits through the acrylic.
        acrylic.transmission = 0.76;
        acrylic.roughness = 0.16;
        acrylic.metalness = 0;
      }
      // Raster transmission needed a dark insert to suggest depth. Actual
      // traced occlusion supplies that depth; retain a light warm substrate.
      if (array && source.name.startsWith("Optical_Diffuser"))
        result.color.set("#cbb497");
      // The tracer reads this flag from materials rather than Mesh objects.
      // Preserve the source scene's shadow casters: clear skins stay visible
      // to specular / transmission rays, while the actual inserts cast shadows.
      (
        result as THREE.MeshStandardMaterial & { castShadow: boolean }
      ).castShadow = castShadow;
      this.materials.set(source, result);
    }
    return result;
  }

  private geometry(source: THREE.Mesh, array: boolean) {
    const material = source.material as THREE.Material;
    if (!array || !material.name.startsWith("Frosted_Polymer"))
      return source.geometry;
    let geometry = this.tintedGeometry.get(source.geometry);
    if (!geometry) {
      geometry = source.geometry.clone();
      const positions = geometry.getAttribute("position");
      // The tracer merges RGBA color attributes across every material group.
      const colors = new Float32Array(positions.count * 4);
      for (let i = 0; i < positions.count; i++) {
        const height = THREE.MathUtils.smoothstep(
          positions.getY(i) / 3.7,
          0.1,
          1,
        );
        colors[i * 4] = THREE.MathUtils.lerp(0.99, 1, height);
        colors[i * 4 + 1] = THREE.MathUtils.lerp(0.98, 1, height);
        colors[i * 4 + 2] = THREE.MathUtils.lerp(0.97, 1, height);
        colors[i * 4 + 3] = 1;
      }
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 4));
      this.tintedGeometry.set(source.geometry, geometry);
    }
    return geometry;
  }

  update(scene: THREE.Scene) {
    scene.updateMatrixWorld(true);
    const used = new Set<string>();
    const usedMaterials = new Set<THREE.Material>();
    this.instanceCount = 0;
    this.triangles = 0;
    const add = (
      source: THREE.Mesh,
      key: string,
      matrix: THREE.Matrix4,
      array: boolean,
    ) => {
      used.add(key);
      const sourceMaterial = source.material as THREE.Material;
      usedMaterials.add(sourceMaterial);
      let target = this.meshes.get(key);
      if (!target) {
        target = new THREE.Mesh(
          this.geometry(source, array),
          this.material(sourceMaterial, array, source.castShadow),
        );
        target.matrixAutoUpdate = false;
        this.meshes.set(key, target);
        this.root.add(target);
      }
      target.matrix.copy(matrix);
      target.visible = true;
      this.triangles +=
        (target.geometry.index?.count ??
          target.geometry.getAttribute("position").count) / 3;
    };
    const matrix = new THREE.Matrix4();
    scene.traverseVisible((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.InstancedMesh) {
        for (let i = 0; i < object.count; i++) {
          object.getMatrixAt(i, matrix);
          if (Math.abs(matrix.determinant()) < 1e-9) continue;
          matrix.premultiply(object.matrixWorld);
          add(object, `${object.uuid}:${i}`, matrix, true);
          this.instanceCount++;
        }
      } else add(object, object.uuid, object.matrixWorld, false);
    });
    for (const [key, mesh] of this.meshes) {
      if (used.has(key)) continue;
      this.root.remove(mesh);
      this.meshes.delete(key);
    }
    for (const [source, material] of this.materials) {
      if (usedMaterials.has(source)) continue;
      material.dispose();
      this.materials.delete(source);
    }
    this.root.updateMatrixWorld(true);
  }

  dispose() {
    for (const material of this.materials.values()) material.dispose();
    for (const geometry of this.tintedGeometry.values()) geometry.dispose();
    this.root.clear();
    this.meshes.clear();
    this.materials.clear();
    this.tintedGeometry.clear();
  }
}
