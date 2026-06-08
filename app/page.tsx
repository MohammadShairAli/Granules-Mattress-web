"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const ALBEDO_PATH = "/matress_type/melos_granules_albedo_upscaled_2048.png";
const GRANULE_GUIDE_PATH = "/matress_type/melos_granules_displacement_2048.png";
const MODEL_PATH = "/matress_type/Untitled.glb";
const NORMAL_PATH = "/matress_type/melos_granules_normal_2048.png";
const ROUGHNESS_PATH = "/matress_type/melos_granules_roughness_2048.png";
const MODEL_WIDTH = 2.2;
const CAMERA_RADIUS = 3.5;
const AUTO_ROTATE_SPEED = 0.05;
const AUTO_ROTATE_RESUME_DELAY_MS = 1200;
const GRANULE_MASK_THRESHOLD = 136;
const GRANULE_SEED_THRESHOLD = 220;
const GRANULE_GUIDE_SPLIT_THRESHOLD = 132;
const GRANULE_GUIDE_SEED_THRESHOLD = 188;
const GRANULE_EROSION_STEPS = 2;

type ColorOption = {
  id: string;
  name: string;
  ral: string;
  code: string;
  hex: string;
};

type SelectedColor = ColorOption & {
  weight: number;
};

type ModelMaterialEntry = {
  material: THREE.Material | THREE.Material[];
  mesh: THREE.Mesh;
};

type Rgb = {
  r: number;
  g: number;
  b: number;
};

type TextureCache = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  depth: Uint8Array;
  grain: Uint8ClampedArray;
  granules: Uint32Array;
  imageData: ImageData;
  mask: Uint8Array;
  normal: Uint8ClampedArray;
  size: number;
  texture: THREE.CanvasTexture;
};

type Viewer = {
  camera: THREE.PerspectiveCamera;
  cleanup: () => void;
  material: THREE.MeshStandardMaterial;
  model: THREE.Object3D;
  originalMaterials: ModelMaterialEntry[];
  renderer: THREE.WebGLRenderer;
  resize: () => void;
  scene: THREE.Scene;
};

const PALETTE: ColorOption[] = [
  { id: "eggshell", name: "Eggshell", ral: "1015", code: "46 2400", hex: "#b9ad6a" },
  { id: "sand", name: "Sand", ral: "1001", code: "46 1600", hex: "#a4874a" },
  { id: "gold", name: "Gold", ral: "1024", code: "46 3000", hex: "#c99512" },
  { id: "lime", name: "Lime", ral: "1016", code: "46 3300", hex: "#d7dd1e" },
  { id: "pearl", name: "Pearl", ral: "7035", code: "46 0500", hex: "#c9c9bb" },
  { id: "wheat", name: "Wheat", ral: "1014", code: "46 2500", hex: "#d0c47b" },
  { id: "orange", name: "Orange", ral: "2000", code: "46 4100", hex: "#c76414" },
  { id: "brick", name: "Brick", ral: "3000", code: "46 7200", hex: "#9b1918" },
  { id: "rose", name: "Rose", ral: "3017", code: "46 7500", hex: "#c9213b" },
  { id: "plum", name: "Plum", ral: "4007", code: "46 8400", hex: "#563062" },
  { id: "hertha", name: "Herthablau", ral: "5002", code: "46 9100", hex: "#181a4a" },
  { id: "midnight", name: "Midnight", ral: "5003", code: "46 9200", hex: "#08213d" },
  { id: "slate", name: "Slate", ral: "5014", code: "46 9300", hex: "#546174" },
  { id: "azure", name: "Azure", ral: "5015", code: "46 9400", hex: "#126da8" },
  { id: "marine", name: "Marine", ral: "5010", code: "46 9500", hex: "#003c73" },
  { id: "teal", name: "Teal", ral: "6033", code: "46 9600", hex: "#398a8b" },
  { id: "petrol", name: "Petrol", ral: "5020", code: "46 9700", hex: "#06476b" },
  { id: "mint", name: "Mint", ral: "6027", code: "46 9800", hex: "#73a99d" },
  { id: "forest", name: "Forest", ral: "6005", code: "46 9900", hex: "#123f2b" },
  { id: "olive", name: "Olive", ral: "6013", code: "46 9950", hex: "#42602f" },
];

const INITIAL_SELECTION: SelectedColor[] = [];

function hexToRgb(hex: string): Rgb {
  const value = hex.replace("#", "");
  const parsed = Number.parseInt(value, 16);

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function shadeChannel(value: number, shade: number) {
  return Math.max(0, Math.min(255, Math.round(value * shade)));
}

function mixChannel(from: number, to: number, amount: number) {
  return Math.round(from + (to - from) * amount);
}

function gradientColor(option: Rgb, amount: number) {
  const shadow = 0.2;
  const highlight = 0.08;

  return {
    r:
      amount < 0.5
        ? mixChannel(option.r, 0, shadow * (1 - amount * 2))
        : mixChannel(option.r, 255, highlight * ((amount - 0.5) * 2)),
    g:
      amount < 0.5
        ? mixChannel(option.g, 0, shadow * (1 - amount * 2))
        : mixChannel(option.g, 255, highlight * ((amount - 0.5) * 2)),
    b:
      amount < 0.5
        ? mixChannel(option.b, 0, shadow * (1 - amount * 2))
        : mixChannel(option.b, 255, highlight * ((amount - 0.5) * 2)),
  };
}

function normalDetailShade(normal: Uint8ClampedArray, target: number) {
  const nx = normal[target] / 127.5 - 1;
  const ny = normal[target + 1] / 127.5 - 1;
  const nz = normal[target + 2] / 127.5 - 1;
  const sideLight = nx * -0.26 + ny * 0.24 + (nz - 0.72) * 0.24;

  return Math.max(0, Math.min(1, 0.44 + sideLight));
}

function colorPreviewGradient(hex: string) {
  return [
    "radial-gradient(circle at 20% 20%, rgba(255,255,255,.42), transparent 24%)",
    "radial-gradient(circle at 76% 78%, rgba(0,0,0,.26), transparent 28%)",
    `linear-gradient(135deg, ${hex} 0%, ${hex} 42%, rgba(255,255,255,.22) 68%, rgba(0,0,0,.2) 100%)`,
  ].join(", ");
}

function seededNoise(index: number) {
  let value = index >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967295;
}

function buildGranuleMap(mask: Uint8Array, guide: Uint8Array, size: number) {
  const foreground = new Uint8Array(mask.length);
  const seeds = new Uint8Array(mask.length);
  const granules = new Uint32Array(mask.length);
  const queue = new Uint32Array(mask.length);

  for (let index = 0; index < mask.length; index += 1) {
    const isGranule = mask[index] >= GRANULE_MASK_THRESHOLD;
    const isGuideSplit = guide[index] <= GRANULE_GUIDE_SPLIT_THRESHOLD;

    if (mask[index] > 0) {
      foreground[index] = 1;
    }

    if (
      isGranule &&
      !isGuideSplit &&
      mask[index] >= GRANULE_SEED_THRESHOLD &&
      guide[index] >= GRANULE_GUIDE_SEED_THRESHOLD
    ) {
      seeds[index] = 1;
    }
  }

  for (let step = 0; step < GRANULE_EROSION_STEPS; step += 1) {
    const nextSeeds = new Uint8Array(mask.length);

    for (let index = 0; index < seeds.length; index += 1) {
      if (seeds[index] === 0) {
        continue;
      }

      const x = index % size;
      const y = Math.floor(index / size);
      const left = x > 0 ? index - 1 : -1;
      const right = x < size - 1 ? index + 1 : -1;
      const up = y > 0 ? index - size : -1;
      const down = y < size - 1 ? index + size : -1;

      if (
        left >= 0 &&
        right >= 0 &&
        up >= 0 &&
        down >= 0 &&
        seeds[left] === 1 &&
        seeds[right] === 1 &&
        seeds[up] === 1 &&
        seeds[down] === 1
      ) {
        nextSeeds[index] = 1;
      }
    }

    seeds.set(nextSeeds);
  }

  let componentId = 1;

  for (let index = 0; index < seeds.length; index += 1) {
    if (seeds[index] === 0 || granules[index] !== 0) {
      continue;
    }

    let head = 0;
    let tail = 0;
    queue[tail] = index;
    tail += 1;
    granules[index] = componentId;

    while (head < tail) {
      const current = queue[head];
      head += 1;

      const x = current % size;
      const y = Math.floor(current / size);
      const neighbors = [
        x > 0 ? current - 1 : -1,
        x < size - 1 ? current + 1 : -1,
        y > 0 ? current - size : -1,
        y < size - 1 ? current + size : -1,
      ];

      for (const neighbor of neighbors) {
        if (neighbor < 0 || seeds[neighbor] === 0 || granules[neighbor] !== 0) {
          continue;
        }

        granules[neighbor] = componentId;
        queue[tail] = neighbor;
        tail += 1;
      }
    }

    componentId += 1;
  }

  let head = 0;
  let tail = 0;

  for (let index = 0; index < granules.length; index += 1) {
    if (granules[index] === 0) {
      continue;
    }

    queue[tail] = index;
    tail += 1;
  }

  while (head < tail) {
    const current = queue[head];
    head += 1;

    const x = current % size;
    const y = Math.floor(current / size);
    const neighbors = [
      x > 0 ? current - 1 : -1,
      x < size - 1 ? current + 1 : -1,
      y > 0 ? current - size : -1,
      y < size - 1 ? current + size : -1,
    ];

    for (const neighbor of neighbors) {
      if (
        neighbor < 0 ||
        foreground[neighbor] === 0 ||
        granules[neighbor] !== 0
      ) {
        continue;
      }

      granules[neighbor] = granules[current];
      queue[tail] = neighbor;
      tail += 1;
    }
  }

  for (let index = 0; index < granules.length; index += 1) {
    if (granules[index] !== 0) {
      continue;
    }

    let head = 0;
    let tail = 0;
    queue[tail] = index;
    tail += 1;
    granules[index] = componentId;

    while (head < tail) {
      const current = queue[head];
      head += 1;

      const x = current % size;
      const y = Math.floor(current / size);
      const neighbors = [
        x > 0 ? current - 1 : -1,
        x < size - 1 ? current + 1 : -1,
        y > 0 ? current - size : -1,
        y < size - 1 ? current + size : -1,
      ];

      for (const neighbor of neighbors) {
        if (
          neighbor < 0 ||
          granules[neighbor] !== 0
        ) {
          continue;
        }

        granules[neighbor] = componentId;
        queue[tail] = neighbor;
        tail += 1;
      }
    }

    componentId += 1;
  }

  return granules;
}

async function imageFromSource(src: string) {
  const image = new Image();
  image.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });

  return image;
}

function textureFromSource(loader: THREE.TextureLoader, src: string) {
  return new Promise<THREE.Texture>((resolve, reject) => {
    loader.load(src, resolve, undefined, () => {
      reject(new Error(`Could not load ${src}`));
    });
  });
}

function gltfFromSource(loader: GLTFLoader, src: string) {
  return new Promise<THREE.Group>((resolve, reject) => {
    loader.load(
      src,
      (gltf) => resolve(gltf.scene),
      undefined,
      () => reject(new Error(`Could not load ${src}`)),
    );
  });
}

async function createTextureCache() {
  const [albedoImage, guideImage, normalImage] = await Promise.all([
    imageFromSource(ALBEDO_PATH),
    imageFromSource(GRANULE_GUIDE_PATH),
    imageFromSource(NORMAL_PATH),
  ]);
  const size = Math.min(
    2048,
    Math.max(
      albedoImage.naturalWidth,
      albedoImage.naturalHeight,
      guideImage.naturalWidth,
      guideImage.naturalHeight,
      normalImage.naturalWidth,
      normalImage.naturalHeight,
    ),
  );
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Canvas is not available in this browser.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(guideImage, 0, 0, size, size);
  const guideData = context.getImageData(0, 0, size, size);
  const guide = new Uint8Array(size * size);
  const mask = new Uint8Array(size * size);

  for (let index = 0; index < guide.length; index += 1) {
    const sourceIndex = index * 4;

    const value = Math.round(
      (guideData.data[sourceIndex] +
        guideData.data[sourceIndex + 1] +
        guideData.data[sourceIndex + 2]) /
        3,
    );

    guide[index] = value;
    mask[index] = value;
  }

  const granules = buildGranuleMap(mask, guide, size);

  context.clearRect(0, 0, size, size);
  context.drawImage(normalImage, 0, 0, size, size);
  const normal = new Uint8ClampedArray(
    context.getImageData(0, 0, size, size).data,
  );

  context.clearRect(0, 0, size, size);
  context.drawImage(albedoImage, 0, 0, size, size);
  const grain = new Uint8ClampedArray(
    context.getImageData(0, 0, size, size).data,
  );

  const imageData = context.createImageData(size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  return {
    canvas,
    context,
    depth: guide,
    grain,
    granules,
    imageData,
    mask,
    normal,
    size,
    texture,
  };
}

function repaintTexture(cache: TextureCache, selectedColors: SelectedColor[]) {
  const colors = selectedColors.length > 0 ? selectedColors : INITIAL_SELECTION;
  const rgbColors = colors.map((color) => ({
    ...hexToRgb(color.hex),
    weight: Math.max(1, color.weight),
  }));
  const totalWeight = rgbColors.reduce((total, color) => total + color.weight, 0);
  const cumulativeWeights: number[] = [];
  let cumulativeWeight = 0;

  for (const color of rgbColors) {
    cumulativeWeight += color.weight;
    cumulativeWeights.push(cumulativeWeight);
  }

  const pickWeightedColor = (roll: number) => {
    let picked = rgbColors[0];

    for (let colorIndex = 0; colorIndex < rgbColors.length; colorIndex += 1) {
      picked = rgbColors[colorIndex];
      if (roll <= cumulativeWeights[colorIndex]) {
        break;
      }
    }

    return picked;
  };

  const pixels = cache.imageData.data;

  for (let index = 0; index < cache.mask.length; index += 1) {
    const granule = cache.granules[index];
    const target = index * 4;
    const mask = cache.mask[index] / 255;
    const sourceShade =
      (cache.grain[target] + cache.grain[target + 1] + cache.grain[target + 2]) /
      765;

    const roll = seededNoise(granule * 2654435761) * totalWeight;
    const picked = pickWeightedColor(roll);

    const noise = seededNoise(granule * 1597334677 + 593) * 0.04;
    const heightShade = cache.depth[index] / 255;
    const normalShade = normalDetailShade(cache.normal, target);
    const tint = gradientColor(
      picked,
      sourceShade * 0.58 + heightShade * 0.26 + normalShade * 0.16,
    );
    const shade =
      0.2 +
      sourceShade * 0.52 +
      heightShade * 0.12 +
      normalShade * 0.1 +
      mask * 0.07 +
      noise;

    pixels[target] = shadeChannel(tint.r, shade);
    pixels[target + 1] = shadeChannel(tint.g, shade);
    pixels[target + 2] = shadeChannel(tint.b, shade);
    pixels[target + 3] = 255;
  }

  cache.context.putImageData(cache.imageData, 0, 0);
  cache.texture.needsUpdate = true;
}

function layModelFlat(model: THREE.Object3D) {
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

function fitModelToView(model: THREE.Object3D) {
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

function getModelMaterials(model: THREE.Object3D) {
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

function applyMaterialToModel(model: THREE.Object3D, material: THREE.Material) {
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.material = material;
    child.castShadow = true;
    child.receiveShadow = true;
  });
}

function setModelShadowFlags(model: THREE.Object3D) {
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;
  });
}

function restoreModelMaterials(entries: ModelMaterialEntry[]) {
  for (const entry of entries) {
    entry.mesh.material = entry.material;
    entry.mesh.castShadow = true;
    entry.mesh.receiveShadow = true;
  }
}

function getPercent(color: SelectedColor, colors: SelectedColor[]) {
  const total = colors.reduce((sum, item) => sum + item.weight, 0);
  return total > 0 ? Math.round((color.weight / total) * 100) : 0;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef<TextureCache | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const dragRef = useRef({ dragging: false, x: 0, y: 0 });
  const orbitRef = useRef({ yaw: -0.55, pitch: 0.46 });
  const autoRotateRef = useRef({
    active: true,
    baseYaw: -0.55,
    resumeAt: 0,
    start: 0,
  });
  const selectedRef = useRef<SelectedColor[]>(INITIAL_SELECTION);

  const [selectedColors, setSelectedColors] =
    useState<SelectedColor[]>(INITIAL_SELECTION);
  const [activeId, setActiveId] = useState("");
  const [status, setStatus] = useState("Loading");

  const activeColor = useMemo(
    () => selectedColors.find((color) => color.id === activeId) ?? selectedColors[0],
    [activeId, selectedColors],
  );

  const selectedIds = useMemo(
    () => new Set(selectedColors.map((color) => color.id)),
    [selectedColors],
  );

  const updateCamera = useCallback(() => {
    const viewer = viewerRef.current;

    if (!viewer) {
      return;
    }

    const radius = CAMERA_RADIUS;
    const pitch = orbitRef.current.pitch;
    const yaw = orbitRef.current.yaw;
    const flatRadius = Math.cos(pitch) * radius;

    viewer.camera.position.set(
      Math.sin(yaw) * flatRadius,
      -Math.cos(yaw) * flatRadius,
      Math.sin(pitch) * radius,
    );
    viewer.camera.lookAt(0, 0, 0);
  }, []);

  const applyTexture = useCallback((colors: SelectedColor[]) => {
    const cache = cacheRef.current;
    const viewer = viewerRef.current;

    if (!viewer) {
      return;
    }

    if (colors.length === 0) {
      restoreModelMaterials(viewer.originalMaterials);
      return;
    }

    if (!cache) {
      return;
    }

    repaintTexture(cache, colors);
    viewer.material.map = cache.texture;
    viewer.material.needsUpdate = true;
    applyMaterialToModel(viewer.model, viewer.material);
  }, []);

  useEffect(() => {
    selectedRef.current = selectedColors;
    applyTexture(selectedColors);
  }, [applyTexture, selectedColors]);

  useEffect(() => {
    let active = true;
    let frame = 0;
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const renderCanvas = canvas;

    async function bootViewer() {
      try {
        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          canvas: renderCanvas,
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#ffffff");

        const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
        camera.up.set(0, 0, 1);

        scene.add(new THREE.HemisphereLight("#ffffff", "#d5d5d5", 2.7));

        const keyLight = new THREE.DirectionalLight("#ffffff", 4.2);
        keyLight.position.set(-1.8, -3.2, 4.2);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(2048, 2048);
        keyLight.shadow.bias = -0.0002;
        keyLight.shadow.normalBias = 0.02;
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight("#ffffff", 1.6);
        fillLight.position.set(3, 2.5, 2.2);
        scene.add(fillLight);

        const material = new THREE.MeshStandardMaterial({
          color: "#ffffff",
          metalness: 0.02,
          roughness: 0.72,
        });

        const textureLoader = new THREE.TextureLoader();
        const gltfLoader = new GLTFLoader();
        const [model, normalMap, roughnessMap, depthMap] = await Promise.all([
          gltfFromSource(gltfLoader, MODEL_PATH),
          textureFromSource(textureLoader, NORMAL_PATH),
          textureFromSource(textureLoader, ROUGHNESS_PATH),
          textureFromSource(textureLoader, GRANULE_GUIDE_PATH),
        ]);

        for (const supportMap of [normalMap, roughnessMap, depthMap]) {
          supportMap.flipY = false;
          supportMap.wrapS = THREE.RepeatWrapping;
          supportMap.wrapT = THREE.RepeatWrapping;
          supportMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
        }

        normalMap.colorSpace = THREE.NoColorSpace;
        roughnessMap.colorSpace = THREE.NoColorSpace;
        depthMap.colorSpace = THREE.NoColorSpace;
        material.normalMap = normalMap;
        material.normalScale.set(0.45, 0.45);
        material.roughnessMap = roughnessMap;
        material.bumpMap = depthMap;
        material.bumpScale = 0.04;

        layModelFlat(model);
        fitModelToView(model);
        setModelShadowFlags(model);
        const originalMaterials = getModelMaterials(model);
        scene.add(model);

        const shadow = new THREE.Mesh(
          new THREE.PlaneGeometry(4, 3),
          new THREE.ShadowMaterial({ opacity: 0.18 }),
        );
        shadow.position.z = -0.01;
        shadow.receiveShadow = true;
        scene.add(shadow);

        const resize = () => {
          const rect = renderCanvas.getBoundingClientRect();
          const width = Math.max(1, Math.floor(rect.width));
          const height = Math.max(1, Math.floor(rect.height));

          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
        };

        resize();
        window.addEventListener("resize", resize);

        viewerRef.current = {
          camera,
          cleanup: () => {
            normalMap.dispose();
            roughnessMap.dispose();
            depthMap.dispose();
            model.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
              }
            });
          },
          material,
          model,
          originalMaterials,
          renderer,
          resize,
          scene,
        };

        cacheRef.current = await createTextureCache();
        cacheRef.current.texture.anisotropy =
          renderer.capabilities.getMaxAnisotropy();

        if (!active) {
          return;
        }

        autoRotateRef.current.start = performance.now();
        applyTexture(selectedRef.current);
        updateCamera();
        setStatus("Ready");

        const render = (time: number) => {
          if (autoRotateRef.current.active) {
            if (autoRotateRef.current.resumeAt !== 0 && time < autoRotateRef.current.resumeAt) {
              orbitRef.current.yaw = autoRotateRef.current.baseYaw;
            } else {
              if (autoRotateRef.current.resumeAt !== 0) {
                autoRotateRef.current.resumeAt = 0;
                autoRotateRef.current.start = time;
              }

            orbitRef.current.yaw =
                autoRotateRef.current.baseYaw +
                Math.sin((time - autoRotateRef.current.start) * 0.001 * AUTO_ROTATE_SPEED) * 0.35;
            }
          }

          updateCamera();
          renderer.render(scene, camera);
          frame = window.requestAnimationFrame(render);
        };

        render(performance.now());

        return () => {
          window.removeEventListener("resize", resize);
          cacheRef.current?.texture.dispose();
          viewerRef.current?.cleanup();
          material.dispose();
          renderer.dispose();
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load texture";
        setStatus(message);
      }
    }

    let cleanup: (() => void) | undefined;
    void bootViewer().then((dispose) => {
      cleanup = dispose;
    });

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      cleanup?.();
    };
  }, [applyTexture, updateCamera]);

  const addOrSelectColor = (option: ColorOption) => {
    setActiveId(option.id);
    setSelectedColors((current) => {
      if (current.some((color) => color.id === option.id)) {
        return current;
      }

      return [...current, { ...option, weight: 1 }];
    });
  };

  const removeColor = (id: string) => {
    setSelectedColors((current) => {
      if (current.length <= 1) {
        return current;
      }

      const next = current.filter((color) => color.id !== id);

      if (activeId === id) {
        setActiveId(next[0].id);
      }

      return next;
    });
  };

  const changeWeight = (id: string, delta: number) => {
    setSelectedColors((current) =>
      current.map((color) =>
        color.id === id
          ? { ...color, weight: Math.max(1, Math.min(12, color.weight + delta)) }
          : color,
      ),
    );
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    autoRotateRef.current.active = false;
    dragRef.current = {
      dragging: true,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.dragging) {
      return;
    }

    const nextX = event.clientX;
    const nextY = event.clientY;
    const deltaX = nextX - dragRef.current.x;
    const deltaY = nextY - dragRef.current.y;

    orbitRef.current.yaw -= deltaX * 0.006;
    orbitRef.current.pitch = Math.max(
      0.16,
      Math.min(1.04, orbitRef.current.pitch + deltaY * 0.004),
    );
    dragRef.current.x = nextX;
    dragRef.current.y = nextY;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current.dragging = false;
    autoRotateRef.current.active = true;
    autoRotateRef.current.baseYaw = orbitRef.current.yaw;
    autoRotateRef.current.resumeAt =
      performance.now() + AUTO_ROTATE_RESUME_DELAY_MS;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <main className="relative h-screen overflow-hidden bg-white text-neutral-900">
      <div className="pointer-events-none absolute right-8 top-4 z-20 hidden gap-5 text-sm text-neutral-300 md:flex">
        <span>Neu</span>
        <span>Speichern</span>
        <span>PDF Export</span>
        <span>Anfragen</span>
        <span>Vollbild</span>
      </div>

      <canvas
        ref={canvasRef}
        aria-label="3D mattress texture preview"
        className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      <section className="absolute bottom-24 left-0 z-10 w-[400px] max-w-[calc(100vw-16px)] border border-neutral-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="flex items-center border-b border-neutral-200 text-sm">
          <div className="flex-1 px-3 py-2 text-neutral-700">
            Ausgewahlte Farben
          </div>
          <button
            className="bg-orange-500 px-3 py-2 text-white"
            onClick={() => activeColor && changeWeight(activeColor.id, 1)}
            type="button"
          >
            %-Farbverteilung andern
          </button>
          <button
            aria-label="Close color panel"
            className="px-3 py-2 text-lg leading-none text-neutral-400"
            type="button"
          >
            x
          </button>
        </div>

        <div className="min-h-32 space-y-3 px-3 py-5">
          {selectedColors.map((color) => (
            <div
              className={`flex items-center gap-2 text-sm ${
                activeId === color.id ? "text-neutral-950" : "text-neutral-500"
              }`}
              key={color.id}
            >
              <button
                aria-label={`Select ${color.name}`}
                className="h-4 w-4 shrink-0"
                onClick={() => setActiveId(color.id)}
                style={{ backgroundColor: color.hex }}
                type="button"
              />
              <button
                className="min-w-0 flex-1 truncate text-left"
                onClick={() => setActiveId(color.id)}
                type="button"
              >
                <span className="font-semibold">{color.name}</span>
                <span className="text-neutral-400">
                  {" "}
                  | RAL: {color.ral} | Code: {color.code} | {color.weight}x (
                  {getPercent(color, selectedColors)}%)
                </span>
              </button>
              <button
                aria-label={`Remove ${color.name}`}
                className="px-2 text-lg leading-none text-neutral-400 hover:text-orange-500"
                onClick={() => removeColor(color.id)}
                type="button"
              >
                x
              </button>
            </div>
          ))}
        </div>
      </section>

      {activeColor ? (
        <section className="absolute bottom-36 left-1/2 z-20 w-44 -translate-x-1/2 border border-neutral-200 bg-white text-center shadow-lg">
          <div className="px-3 py-3">
            <p className="text-sm font-semibold text-neutral-600">
              {activeColor.name}
            </p>
            <p className="mt-1 border-b border-neutral-200 pb-2 text-xs text-neutral-400">
              RAL {activeColor.ral} | Code: {activeColor.code}
            </p>
            <p className="pt-2 text-xs font-medium text-orange-500">Anteil(e)</p>
            <div className="mt-1 flex items-center justify-between">
              <button
                aria-label="Decrease frequency"
                className="h-10 w-10 border border-orange-200 text-3xl leading-none text-orange-500"
                onClick={() => changeWeight(activeColor.id, -1)}
                type="button"
              >
                -
              </button>
              <span className="text-3xl font-light text-orange-500">
                {activeColor.weight}
              </span>
              <button
                aria-label="Increase frequency"
                className="h-10 w-10 border border-orange-200 text-3xl leading-none text-orange-500"
                onClick={() => changeWeight(activeColor.id, 1)}
                type="button"
              >
                +
              </button>
            </div>
          </div>
          <div className="absolute left-1/2 top-full h-4 w-4 -translate-x-1/2 -translate-y-2 rotate-45 border-b border-r border-neutral-200 bg-white" />
        </section>
      ) : null}

      <div className="absolute bottom-8 left-12 z-20 flex h-16 w-16 items-center justify-center rounded-full bg-orange-500 text-4xl font-light text-white shadow-lg">
        &#10003;
      </div>

      <section className="no-scrollbar absolute bottom-0 left-0 right-0 z-10 flex h-24 items-end gap-8 overflow-x-auto border-t border-neutral-200 bg-white/90 px-36 pb-3 backdrop-blur">
        {PALETTE.map((option) => {
          const selected = selectedIds.has(option.id);
          const active = activeId === option.id;

          return (
            <button
              aria-label={`Use ${option.name}`}
              className={`relative h-14 w-14 shrink-0 border transition ${
                active
                  ? "h-32 w-32 border-orange-500 p-2"
                  : selected
                    ? "border-orange-400"
                    : "border-neutral-200 hover:border-orange-300"
              }`}
              key={option.id}
              onClick={() => addOrSelectColor(option)}
              type="button"
            >
              <span
                className="block h-full w-full"
                style={{
                  backgroundColor: option.hex,
                  backgroundImage: colorPreviewGradient(option.hex),
                }}
              />
              {active ? (
                <span className="absolute -top-3 left-1/2 h-2 w-16 -translate-x-1/2 bg-orange-500" />
              ) : null}
            </button>
          );
        })}
      </section>

      <div className="absolute bottom-28 right-2 z-10 hidden w-40 border-y border-neutral-200 py-2 text-sm text-neutral-400 md:block">
        Realvorschau
      </div>

      <div className="absolute left-4 top-4 z-10 rounded-full bg-white/80 px-3 py-1 text-xs text-neutral-400 shadow-sm">
        {status}
      </div>
    </main>
  );
}
