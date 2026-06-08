# Mattress Alpha Configurator

This project is a Next.js 16 app that previews a mattress-style material in 3D and lets the user mix multiple colors across a black-and-white alpha texture. It is being built to resemble the reference configurator screenshots: a large angled mattress slab, draggable camera, selected color list, active color popup, and bottom swatch rail.

## Current Status

The current implementation lives mainly in `app/page.tsx`.

What works now:
  
- Renders a 3D mattress slab with Three.js.
- Uses the black-and-white alpha image from `Matress_Type/B&W Alpha` as the texture pattern source.
- Lets the user select multiple colors from the bottom swatch rail.
- Lets the user change each selected color's frequency with `-` and `+`.
- Updates the texture immediately when colors or frequencies change.
- Lets the user drag on the canvas to rotate the camera angle.
- Shows a left panel with selected colors, RAL/code labels, weight, and percentage.
- Shows a center popup for the active color, similar to the reference UI.

## Asset Setup

Original source assets are in:

```text
Matress_Type/
```

Useful files found there:

```text
Matress_Type/Untitled.glb
Matress_Type/Untitled.gltf
Matress_Type/Untitled.bin
Matress_Type/Matress_baseColor.png
Matress_Type/Matress_normal.png
Matress_Type/Matress_occlusionRoughnessMetallic.png
Matress_Type/B&W Alpha/Plane For Texures_Material _29_BaseColor.png
```

The browser can only load public static assets directly, so copies were placed in:

```text
public/matress_type/
```

Current copied files:

```text
public/matress_type/alpha-mask.jpeg
public/matress_type/mattress.glb
public/matress_type/normal.png
public/matress_type/orm.png
```

Important: the current viewer uses `alpha-mask.jpeg` for the generated material. The GLB is copied and available, but the app currently renders a JS-created Three.js box geometry instead of loading the GLB.

## Why The GLB Is Not Currently Used

The first version attempted to load the GLB and apply the generated material to it. In headless verification, the GLB route served correctly, but the browser screenshot kept freezing before the GLB finished rendering.

Because the mattress asset is visually a simple slab, we switched to an explicit Three.js `BoxGeometry`. This made the preview reliable and faster while still matching the target interaction: the important part is the generated alpha-based surface material, not the exact mesh.

Future improvement: re-enable `GLTFLoader` and apply the same reusable generated texture to the GLB material once model loading is stable in the target browser.

## Texture Generation

The texture pipeline is designed to be fast.

At startup:

1. Load `/matress_type/alpha-mask.jpeg`.
2. Draw it once into an offscreen canvas.
3. Read its grayscale pixel values into a `Uint8Array` mask.
4. Create one reusable `ImageData`.
5. Create one reusable `THREE.CanvasTexture`.

On every color/frequency change:

1. Repaint the existing `ImageData` using the cached mask.
2. Choose each flake's color through deterministic seeded noise.
3. Apply each selected color's `weight` as its frequency.
4. Push the pixels back into the same canvas.
5. Mark the same `CanvasTexture` as `needsUpdate`.

This avoids reloading images or creating new textures on every click, which keeps color changes fast.

## Color Frequency

Selected colors are stored as:

```ts
type SelectedColor = ColorOption & {
  weight: number;
};
```

Frequency is weight-based:

- If three colors all have `weight: 1`, each gets about `33%`.
- If one color has `weight: 2` and another has `weight: 1`, the split is about `67% / 33%`.
- Weights are currently clamped from `1` to `12`.

The visible percentage is calculated from:

```text
color.weight / totalSelectedWeight
```

## Main Files

```text
app/page.tsx
```

Contains the full configurator:

- color palette data
- texture cache creation
- alpha repaint logic
- Three.js scene setup
- camera drag/orbit behavior
- selected color UI
- bottom swatch rail

```text
app/globals.css
```

Contains Tailwind import and small global helpers:

- hides body overflow for the full-screen configurator
- hides scrollbars for the swatch rail

```text
app/layout.tsx
```

Sets the app metadata and loads Geist fonts.

```text
package.json
```

Three.js was added for the 3D viewer:

```text
three
@types/three
```

## Running The App

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Verification Commands

Lint:

```bash
npm run lint
```

Production build:

```bash
npm run build
```

Both were passing after the latest changes.

## Visual Verification

During development, a headless Edge screenshot was used because the Codex in-app browser backend was not available in this session.

Generated screenshot path:

```text
mattress-configurator-check.png
```

The screenshot showed:

- large angled mattress slab
- multi-color generated texture
- selected colors panel
- center frequency popup
- bottom swatch rail

## Notes For The Next Developer Or Bot

- Read `AGENTS.md` first. It says this project uses a Next.js version with breaking changes and local docs should be checked under `node_modules/next/dist/docs/`.
- This is a client component because Three.js, canvas, pointer events, and browser image loading are all browser-only.
- Keep texture updates cache-based. Avoid recreating images/textures on every color change.
- The alpha image is large, so the working texture is downsampled to `640x640` for speed and larger visible flakes.
- The current flake size is controlled in `repaintTexture` by grouping pixels with `Math.floor(x / 3)` and `Math.floor(y / 3)`.
- The camera angle is stored in `orbitRef`; dragging the canvas changes yaw and pitch.
- The UI intentionally clones the reference layout more than a typical dashboard layout: full-screen white canvas, subtle top actions, selected colors left, active color popup center, bottom rail.

## Likely Next Steps

- Improve the flake algorithm so shapes look less grid-like and more like irregular chips.
- Add real image-like swatch previews instead of CSS/radial placeholders.
- Add mobile-specific layout adjustments.
- Add export/save behavior if needed.
- Re-test loading the original GLB with `GLTFLoader` and apply the same generated `CanvasTexture` to its material.
