# Shaderbox — architecture & features

**Maintenance:** When you add or remove product-facing behavior, update this doc with **what** changed and **why** (see `.cursor/rules/feature-changelog.mdc`).

React + Vite app for **ENS-style weave drafts** and **image-to-grid** experiments. Product name in the shell: **ENS Warp&Weft**. Rendering is **WebGL 1** on `<canvas>`; UI uses **Tailwind CSS**, **Radix** primitives, and **Motion** for light transitions.

---

## Recent product changes (consolidated nav & URLs)

- **What:** Three top-level modes in the main shell — **Weave**, **Mosaic**, **Print mosaic** — plus merged behaviors below. **Why:** Fewer tabs for the same pipelines; clearer names; **ENS Warp&Weft** title is **first** in the top bar (left-aligned after padding), then menu toggle and mode controls.
- **What:** **Mosaic** (formerly Image Rects v2/v5/v6) is a single **`AppV2`** surface: one media picker (image / video / GIF), **Background gaps** toggle (replaces v5). **Fit / Fill** lives in the **main nav bar on the far right** for **every** tab (shared **`patternFit`** / **`?display=`** with Weave and Print mosaic). **Why:** One viewport control, always visible, URL stays consistent across modes.
- **What:** Legacy **`?v=5`** and **`?v=6`** still load **Mosaic**; **`AppV2`** parses `v=5` as background gaps + default dark-stitch geometry when `gm`/`gap` omit; **`v=6`** is treated like **`v=2`** for routing (media kind comes from the unified file picker). **Why:** Old bookmarks keep working while new shares normalize to **`v=2`**.
- **What:** **Weave** + **CMYK halftone** are one tab: sidebar **Halftone Off / On**; default **Off** (flat `ShaderCanvas`). **`?v=3`** still means halftone **On** for legacy links. **Why:** One editor with an optional output pass; flat weave remains the default experience.
- **What:** Optional **`?wht=1`** / **`?wht=0`** can force weave halftone on/off when parsing (with **`v=1`**). **`ht`** remains the **dot type** query key (0–2), so it is not reused for weave halftone. **Why:** Avoid param collision; legacy **`?v=3`** still turns halftone on.
- **What:** **Print mosaic** (v4) stays a separate tab and **`combo*`** state — not folded into **`AppV2`** yet. **Why:** Larger refactor (shared URL/layout with Mosaic); deferred until combo and image-rects shells unify.

---

## High-level architecture

| Layer | Role |
|--------|------|
| **`App.jsx`** | Root shell: `view` routing (weave / mosaic / print mosaic), URL sync for weaving + halftone + combo, shared sidebar for weave & print mosaic. Lazy-loads halftone stages. |
| **`AppV2.jsx`** | **Mosaic**: standalone sidebar, footer, copy/record, URL state (`v=2`, `gap=`, `display=`, …), **`ImageRectsCanvas`**. |
| **`ShaderCanvas` + weaving hook** | **Weave** draft (`fragment.glsl` + `vertex.glsl`): grid of rounded rects, warp/weft, gradients, shimmer, colorways. |
| **`ImageRectsCanvas` + `useImageRectsSandbox`** | **Mosaic** pipeline (`fragmentImageRects.glsl`): static image, video, or GIF → rects. |
| **`WeavingHalftoneStage`** | Weave → intermediate buffer → **CMYK halftone** (`@paper-design/shaders-react`). |
| **`ImageRectsHalftoneStage`** | **Print mosaic**: **`ImageRectsCanvas`** + same halftone layer; **`combo*`** state in **`App.jsx`**. |
| **`patterns/`** | Shared weave definitions + pattern texture for GPU. |
| **`urlDefaults.js`** | Defaults: **`WEAVING_URL_DEFAULTS`**, **`HALFTONE_DEFAULTS`**, **`COMBO_DEFAULTS`**, **`IMAGE_RECTS_URL_DEFAULTS`** (includes **`mosaicBgGaps`**, **`patternFit`**). |

Data flow: **React state → uniforms / props → fragment shaders**. Resolution follows **container `getBoundingClientRect()` × DPR** (image rects hook uses DPR `2`).

---

## Tabs (URL `?v=`)

| `v` | Internal `view` | Nav label | Main surface |
|-----|-----------------|-----------|----------------|
| `1` / omit | `weaving` | Weave | `ShaderCanvas` or `WeavingHalftoneStage` if halftone **On** |
| `2` | `imageRects` | Mosaic | `AppV2` → `ImageRectsCanvas` |
| `3` | `weaving` + halftone **On** | Weave | `WeavingHalftoneStage` (legacy tab removed; URL preserved) |
| `4` | `imageRectsHalftone` | Print mosaic | `ImageRectsHalftoneStage` |
| `5` / `6` | `imageRects` (Mosaic) | Mosaic | Same as `v=2`; **`AppV2`** reads **`v=5`** for gap defaults |

**`?gap=1`** — background gaps (non-stitch shows BG); **`gap=0`** explicit off.

**`?menu=1`** — sidebar always visible (vs hover-reveal overlay).

**`?display=fit|fill`** — **Fit** = contain (full canvas visible, letterboxed); **Fill** = cover (scale until the shorter stage dimension is filled, may crop). Same semantics on **Weave** (`ShaderCanvas`), **Mosaic** (`ImageRectsCanvas`), and halftone views (`HalftoneCmyk` `fit`).

**`?wht=1|0`** — optional weave halftone override with **`v=1`** (does not replace **`v=3`** bookmarks).

**`?ht=`** — halftone **dot type** index (`dots` / `ink` / `sharp`), not weave on/off.

---

## Weave

- **Controls:** presets, palette, weave pattern, shades, gradients, grid & layout, shimmer, colorways, **Halftone Off/On**, copy scale/format, optional MP4/WebM recording. **Fit / Fill** is only in the **main nav** (far right), not the sidebar.
- **Colorways:** Five named palettes (Citrine, Garnet, Lapis, Peridot, **Quartz**). **Quartz** aligns with ENS Core neutrals in shader slots (see previous doc detail).
- **What:** **Use all 5 colorways** can distribute palette indices three ways in `fragment.glsl`: **Random** (legacy per-cell hash), **Smooth** (2D gradient noise + FBM: octaves, persistence, lacunarity, bias), **Bleed** (anisotropic FBM for streaks along threads; run length, angle, cross-fiber mix, optional **draft-coupled** warp/weft blend). **Include palettes** toggles restrict the pool (bitmask); all five on matches legacy behavior. **Why:** Coherent regions and fiber-parallel “dye” looks without Manhattan/Voronoi; URL-shareable tuning.
- **URL:** `cnm` (0–2), `cns`/`seed`, `cpm` (0–31 include mask), FBM `cno`/`cnp`/`cnl`/`cnbb`, bleed `cba`/`cbr`/`cbx`/`cbd`, plus existing weave keys — `buildUrlState` / `parseUrlState` in `App.jsx`.

---

## Mosaic (`AppV2`)

- **Media:** image, video, or GIF via one file input; **`mediaTextureKind`** inferred from file.
- **What:** When you load a **video** file (switch from still image / GIF to **video** as the decoded source), **canvas recording starts automatically** (WebM/MP4 per toolbar). **Why:** Capture the mosaic output together with the source video without an extra click; stop from the toolbar or by switching back to image/GIF (recording stops when **`mediaTextureKind`** is not **`video`**).
- **Background gaps:** toggle + URL **`gap=`**; aligns with legacy v5 shader flag **`nonStitchShowsBg`**.
- **Viewport:** **`patternFit`** from **`App.jsx`** (nav bar) + **`display=`**; passed through to **`ImageRectsCanvas`**.
- **What:** **Stitch-in** (sidebar **Stitch-in**): optional animation from a **blank** background-only frame to the full mosaic by ramping **`u_stitchRevealProgress`** 0→1. **Noise** uses isotropic FBM on cell IDs (organic scatter); **Bleed** uses the same dye-bleed–style streaks as weave “all colorways” (rotation, anisotropy, optional draft coupling to warp/weft). **Replay** / **New seed** / **duration** / **scale** / **softness** control the look; **Why:** lets mosaic reads like thread appearing from empty cloth, with two distinct visual orders.
- **URL:** `v=2` written when sharing; params include `grid`, `pal`, `gap`, `display`, quantize keys, stitch-in keys (`srm`, `srd`, `srs`, `srsc`, `srso`, bleed `srba`/`srbr`/`srbc`/`srbd`), etc.

---

## Print mosaic (v4)

- **`combo*`** state: grid, palette, weave pattern, rect color source, quantize, luma size, cell geometry, BG, shared halftone params.
- **Fit / Fill:** use the **main nav** control (same **`patternFit`** / **`?display=`** as Weave and Mosaic).
- Image: upload in Actions; separate from Mosaic blob state.

---

## Cross-cutting features

- **Keyboard:** Mod+C copy, Mod+Shift+R / F5 reload (details vary by shell).
- **Export:** PNG/WebP clipboard; scaled capture capped by `EXPORT_MAX_DIMENSION`.
- **What:** Canvas **WebM/MP4** recording uses WebGL `gl.finish()` after each draw so GPU work completes before `VideoFrame` / `MediaRecorder` read the framebuffer (avoids corrupted or noisy frames). **Why:** WebGL is asynchronous; sampling the canvas too early produced garbage output in some browsers.
- **Footer / FPS:** Mosaic layout; weaving uses nav-adjacent readouts where wired.

---

## Disabled / hidden product behavior

### 1. Brand mode — “Shade from” (Warp / Weft / Warp+Weft)

- **Was:** In **Brand** rect color, control for **`u_shadeFrom`** in **`fragmentImageRects.glsl`**.
- **Now:** **Forced to “Color”** (`u_shadeFrom = 0`). Controls removed from **`AppV2`** and print mosaic combo block.
- **URL:** `sf` / `csf` no longer written; old values ignored on apply.
- **Re-enable:** Restore state + URL + `AppSelect`; pass through to **`ImageRectsCanvas`** / **`ImageRectsHalftoneStage`**.

### 2. Mosaic — sidebar “Rect shape” (radius / aspect / ratio)

- **Was:** Sliders in **`AppV2`**.
- **Now:** Values from **`IMAGE_RECTS_URL_DEFAULTS`** and URL **`rr`**, **`ra`**, **`rratio`** only.
- **Weave** tab still controls **weaving** rect aspect + corner radius.
- **Re-enable:** Reintroduce sidebar group in **`AppV2.jsx`**.

---

## Related files (quick index)

- `src/App.jsx` — tabs, weave + print mosaic UI, URL packing when not on Mosaic.
- `src/AppV2.jsx` — Mosaic UI + URL (`v=2`, `gap=`, `display=`).
- `src/hooks/useImageRectsSandbox.js` — WebGL program, textures, resize, uniforms.
- `src/shaders/fragmentImageRects.glsl` — mosaic fragment shader.
- `src/shaders/fragment.glsl` — weaving fragment shader.
- `src/urlDefaults.js` — defaults referenced above.
