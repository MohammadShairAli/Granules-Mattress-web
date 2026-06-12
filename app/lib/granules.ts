const GRANULE_MASK_THRESHOLD = 136;
const GRANULE_SEED_THRESHOLD = 220;
const GRANULE_GUIDE_SPLIT_THRESHOLD = 132;
const GRANULE_GUIDE_SEED_THRESHOLD = 188;
const GRANULE_EROSION_STEPS = 2;

export function buildGranuleMap(mask: Uint8Array, guide: Uint8Array, size: number) {
  const foreground = new Uint8Array(mask.length);
  const seeds = new Uint8Array(mask.length);
  const granules = new Uint32Array(mask.length);
  const queue = new Uint32Array(mask.length);

  const neighbors = (index: number): [number, number, number, number] => {
    const x = index % size;
    const y = Math.floor(index / size);

    return [
      y * size + ((x - 1 + size) % size),
      y * size + ((x + 1) % size),
      ((y - 1 + size) % size) * size + x,
      ((y + 1) % size) * size + x,
    ];
  };

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

      const [left, right, up, down] = neighbors(index);

      if (
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

      for (const neighbor of neighbors(current)) {
        if (seeds[neighbor] === 0 || granules[neighbor] !== 0) {
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

    for (const neighbor of neighbors(current)) {
      if (foreground[neighbor] === 0 || granules[neighbor] !== 0) {
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

      for (const neighbor of neighbors(current)) {
        if (granules[neighbor] !== 0) {
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
