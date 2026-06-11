"use client";

import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { SelectedColor } from "../data/colors";
import {
  AUTO_ROTATE_RESUME_DELAY_MS,
  AUTO_ROTATE_SPEED,
  CAMERA_RADIUS,
  GRANULE_GUIDE_PATH,
  MODEL_PATH,
  NORMAL_PATH,
  ROUGHNESS_PATH,
} from "../lib/mattress-assets";
import {
  applyMaterialToModel,
  fitModelToView,
  getModelMaterials,
  gltfFromSource,
  layModelFlat,
  restoreModelMaterials,
  setModelShadowFlags,
  textureFromSource,
  type ModelMaterialEntry,
} from "../lib/mattress-model";
import {
  createTextureCache,
  repaintTexture,
  type TextureCache,
} from "../lib/texture";

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

type MattressViewerProps = {
  selectedColors: SelectedColor[];
};

export function MattressViewer({ selectedColors }: MattressViewerProps) {
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
  const selectedRef = useRef<SelectedColor[]>(selectedColors);

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
        // scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight("#ffffff", 1.6);
        fillLight.position.set(3, 2.5, 2.2);
        // scene.add(fillLight);

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
        // scene.add(shadow);

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
      } catch {
        return undefined;
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
    <canvas
      ref={canvasRef}
      aria-label="3D mattress texture preview"
      className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}
