import * as THREE from "three";

import { INITIAL_SELECTION, type SelectedColor } from "../data/colors";
import {
  ALBEDO_PATH,
  GRANULE_GUIDE_PATH,
  GRANULE_TEXTURE_REPEAT,
  NORMAL_PATH,
} from "./mattress-assets";
import { buildGranuleMap } from "./granules";

type Rgb = {
  r: number;
  g: number;
  b: number;
};

export type TextureCache = {
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

function seededNoise(index: number) {
  let value = index >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967295;
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

export async function createTextureCache() {
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

  context.imageSmoothingEnabled = false;
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

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

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
  texture.repeat.set(GRANULE_TEXTURE_REPEAT, GRANULE_TEXTURE_REPEAT);

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

export function repaintTexture(
  cache: TextureCache,
  selectedColors: SelectedColor[],
) {
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
