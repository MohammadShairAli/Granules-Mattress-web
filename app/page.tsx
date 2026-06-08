"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const ALPHA_PATH = "/matress_type/alpha-mask.jpeg";
const TEXTURE_SIZE = 640;
const MATTRESS_WIDTH = 2.35;
const MATTRESS_LENGTH = 1.55;
const MATTRESS_DEPTH = 0.16;

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

type Rgb = {
  r: number;
  g: number;
  b: number;
};

type TextureCache = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  imageData: ImageData;
  mask: Uint8Array;
  texture: THREE.CanvasTexture;
};

type Viewer = {
  camera: THREE.PerspectiveCamera;
  material: THREE.MeshStandardMaterial;
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

const INITIAL_SELECTION = [
  { ...PALETTE[0], weight: 1 },
  { ...PALETTE[8], weight: 1 },
  { ...PALETTE[10], weight: 1 },
];

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

function seededNoise(index: number) {
  const seed = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return seed - Math.floor(seed);
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

async function createTextureCache() {
  const alphaImage = await imageFromSource(ALPHA_PATH);
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Canvas is not available in this browser.");
  }

  context.drawImage(alphaImage, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  const alphaData = context.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  const mask = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE);

  for (let index = 0; index < mask.length; index += 1) {
    const sourceIndex = index * 4;
    mask[index] = Math.round(
      (alphaData.data[sourceIndex] +
        alphaData.data[sourceIndex + 1] +
        alphaData.data[sourceIndex + 2]) /
        3,
    );
  }

  const imageData = context.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;

  return {
    canvas,
    context,
    imageData,
    mask,
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
  const pixels = cache.imageData.data;

  for (let index = 0; index < cache.mask.length; index += 1) {
    const x = index % TEXTURE_SIZE;
    const y = Math.floor(index / TEXTURE_SIZE);
    const flake = Math.floor(x / 3) + Math.floor(y / 3) * 997;
    let roll = seededNoise(flake) * totalWeight;
    let picked = rgbColors[0];

    for (const color of rgbColors) {
      roll -= color.weight;
      picked = color;

      if (roll <= 0) {
        break;
      }
    }

    const mask = cache.mask[index] / 255;
    const grain = seededNoise(flake + 593) * 0.1;
    const shade = 0.5 + mask * 0.74 + grain;
    const target = index * 4;

    pixels[target] = shadeChannel(picked.r, shade);
    pixels[target + 1] = shadeChannel(picked.g, shade);
    pixels[target + 2] = shadeChannel(picked.b, shade);
    pixels[target + 3] = 255;
  }

  cache.context.putImageData(cache.imageData, 0, 0);
  cache.texture.needsUpdate = true;
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
  const selectedRef = useRef<SelectedColor[]>(INITIAL_SELECTION);

  const [selectedColors, setSelectedColors] =
    useState<SelectedColor[]>(INITIAL_SELECTION);
  const [activeId, setActiveId] = useState(INITIAL_SELECTION[1].id);
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

    const radius = 2.7;
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

    if (!cache || !viewer) {
      return;
    }

    repaintTexture(cache, colors);
    viewer.material.map = cache.texture;
    viewer.material.needsUpdate = true;
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
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight("#ffffff", 1.6);
        fillLight.position.set(3, 2.5, 2.2);
        scene.add(fillLight);

        const material = new THREE.MeshStandardMaterial({
          color: "#ffffff",
          metalness: 0.02,
          roughness: 0.58,
        });
        const geometry = new THREE.BoxGeometry(
          MATTRESS_WIDTH,
          MATTRESS_LENGTH,
          MATTRESS_DEPTH,
          2,
          2,
          1,
        );
        const mattress = new THREE.Mesh(geometry, material);
        mattress.castShadow = true;
        mattress.receiveShadow = true;
        scene.add(mattress);

        const shadow = new THREE.Mesh(
          new THREE.PlaneGeometry(4, 3),
          new THREE.ShadowMaterial({ opacity: 0.18 }),
        );
        shadow.position.z = -MATTRESS_DEPTH / 2 - 0.015;
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
          material,
          renderer,
          resize,
          scene,
        };

        cacheRef.current = await createTextureCache();

        if (!active) {
          return;
        }

        applyTexture(selectedRef.current);
        updateCamera();
        setStatus("Ready");

        const render = () => {
          updateCamera();
          renderer.render(scene, camera);
          frame = window.requestAnimationFrame(render);
        };

        render();

        return () => {
          window.removeEventListener("resize", resize);
          cacheRef.current?.texture.dispose();
          geometry.dispose();
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
                  backgroundImage:
                    "radial-gradient(circle at 20% 25%, rgba(255,255,255,.24), transparent 16%), radial-gradient(circle at 72% 30%, rgba(0,0,0,.18), transparent 18%), radial-gradient(circle at 44% 70%, rgba(255,255,255,.16), transparent 16%)",
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
