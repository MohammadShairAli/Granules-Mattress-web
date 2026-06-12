import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { MODEL_WIDTH } from "./mattress-assets";

export type ModelMaterialEntry = {
  material: THREE.Material | THREE.Material[];
  mesh: THREE.Mesh;
};

export function textureFromSource(loader: THREE.TextureLoader, src: string) {
  return new Promise<THREE.Texture>((resolve, reject) => {
    loader.load(src, resolve, undefined, () => {
      reject(new Error(`Could not load ${src}`));
    });
  });
}

export function gltfFromSource(loader: GLTFLoader, src: string) {
  return new Promise<THREE.Group>((resolve, reject) => {
    loader.load(
      src,
      (gltf) => resolve(gltf.scene),
      undefined,
      () => reject(new Error(`Could not load ${src}`)),
    );
  });
}

export function layModelFlat(model: THREE.Object3D) {
  const bounds = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  bounds.getSize(size);

  const thinnestAxis =
    size.x <= size.y && size.x <= size.z ? "x" : size.y <= size.z ? "y" : "z";

  if (thinnestAxis === "x") {
    model.rotation.y = Math.PI / 2;
  } else if (thinnestAxis === "y") {
    model.rotation.x = Math.PI / 2;
  }

  model.updateMatrixWorld(true);
}

export function fitModelToView(model: THREE.Object3D) {
  let bounds = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();

  bounds.getSize(size);
  const largestSide = Math.max(size.x, size.y, size.z);
  if (largestSide > 0) {
    model.scale.setScalar(MODEL_WIDTH / largestSide);
  }

  model.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(model);
  bounds.getCenter(center);

  model.position.x -= center.x;
  model.position.y -= center.y;

  model.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(model);
  model.position.z -= bounds.min.z;
  model.updateMatrixWorld(true);
}

export function getModelMaterials(model: THREE.Object3D) {
  const entries: ModelMaterialEntry[] = [];

  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    entries.push({
      material: child.material,
      mesh: child,
    });
  });

  return entries;
}

export function applyMaterialToModel(
  model: THREE.Object3D,
  material: THREE.Material,
) {
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.material = material;
    child.castShadow = true;
    child.receiveShadow = true;
  });
}

export function setModelShadowFlags(model: THREE.Object3D) {
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;
  });
}

export function restoreModelMaterials(entries: ModelMaterialEntry[]) {
  for (const entry of entries) {
    entry.mesh.material = entry.material;
    entry.mesh.castShadow = true;
    entry.mesh.receiveShadow = true;
  }
}
