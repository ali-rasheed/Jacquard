# Shaderbox — architecture & features

**Maintenance:** When you add or remove product-facing behavior, update this doc with **what** changed and **why** (see `.cursor/rules/feature-changelog.mdc`).

React + Vite app for **ENS-style weave drafts** and **image-to-grid** experiments. Product name in the shell: **ENS Warp&Weft**. Rendering is **WebGL 1** on `<canvas>`; UI uses **Tailwind CSS**, **Radix** primitives, and **Motion** for light transitions.

---

## Recent product changes (consolidated nav & URLs)

- **What:** Optional **access password** before the app loads. Set **`VITE_ACCESS_PASSWORD`** at build time (see **`.env.example`**); when set, users see a gate screen and unlock persists in **`localStorage`** key **`shaderbox-access-v1`** as a **SHA-256 digest** (not the plaintext password). Omit or leave the env var empty to disable the gate (default for local dev). **Why:** Lightweight protection for deployed previews without a backend; same-device convenience via local storage.
- **What:** **ENS mark** on the **Weave** canvas: white mark composited in `fragment.glsl` from `ens-mark.png` (texture unit 1), with sidebar **ENS mark** On/Off, URL **`ensm=0|1`**, keyframe **A/B** capture, and embed payload **`u_ensMarkSampler`** + uniforms. Default **on** so shipped art is visible without URL. Draw scale uses **~1.8%** of canvas diagonal for the logo’s max edge (**12%** of the earlier **15%×diagonal** size). **Why:** ENS mark assets landed earlier without shader/JS wiring, so the UI showed text-only branding; this completes the intended in-canvas mark; corner mark was then reduced so it reads as subtle branding, not a dominant UI element.

- **What:** **Print mosaic** and **Weave → Halftone On** no longer freeze a 300×150 offscreen snapshot for CMYK halftone (was a tiny pattern in the corner). Capture waits until the source canvas is at least half of layout×DPR and retries until WebGL resize finishes. **Print mosaic** additionally renders **HalftoneCmyk** at the **stage** (viewport) size while **ImageRectsCapture** still captures at image resolution — fixing halftone squeezed into a corner when image pixels were passed as the halftone `width`/`height`. **Why:** Browser default canvas size was copied before the hidden buffer sized; image pixel dimensions ≠ main-area aspect.
- **What:** Added **Export Embed** in the Weave capture bar. It opens a modal that can export copy-paste snippets for **React** and **HTML** from **Current / Set A / Set B** sources, with optional static mode. Generated embeds expose per-driver control via **`auto|controlled`** modes plus explicit values for transport drivers (`time`, `shimmerTime`, `stitchProgress`) and all colorway animation drivers except seed/distribution/palette-set (`colorwayNoiseScale`, `colorwayNoiseOctaves`, `colorwayNoisePersistence`, `colorwayNoiseLacunarity`, `colorwayNoiseBias`, `colorwayNoiseX`, `colorwayBleedAnisotropy`, `colorwayBleedRotation`, `colorwayBleedCrossFiber`, `colorwayBleedDraftCoupled`) and timeline remap props. Embed payloads still support **`translateX` → `u_stageTranslateX`** programmatically (default 0). The exported **JSON payload** (and **`handoffDefaults.playing`**) includes **`playing`**: which embed drivers are **auto** vs **controlled**, **`shimmerUiPlaying`**, **`weaveKeyframeTransportPlaying`**, **`staticExport`**, and **`colorwayAnimBits`** (same encoding as URL **`cwp`**). The **React** snippet reads driver props from a ref each frame so changing them does not tear down WebGL (only **`width`** / **`height`** resize the canvas + effect). **Why:** Enable direct handoff into external projects (including loading-bar style integrations) without re-implementing the shader runtime.
- **What:** Exported **React + HTML embed snippets** now size the WebGL backing canvas at **CSS size × DPR** while keeping CSS layout size unchanged, with HTML embeds also exposing an optional `dpr` override in mount options. **Why:** Keep exported shaders crisp on Retina/high-density displays instead of looking soft from 1x backing resolution.
- **What:** Export Embed now includes toggles for **Enable hover ripple**, **Reveal tiles only on hover**, and **Movement boost**. When enabled, generated snippets wire pointer tracking (`u_pointerUv`) into a quantized proximity ripple and can keep tiles mostly invisible until hover, with extra opacity/ripple energy on pointer movement (`u_hoverVelocity`). **Why:** Support premium CTA-style hover motion on external sites without re-implementing pointer → uniform plumbing; toggles bake the intended interaction contract into the copied snippet. **Audit:** The in-app Weave canvas still uploads hover uniforms as **disabled defaults** each frame (`useShaderSandbox`) so the editor preview stays unchanged unless you use an exported embed.
- **What:** **Capture bar** below the canvas on **Weave / Print mosaic** (`App.jsx`) and **Mosaic** (`AppV2`): copy scale/format, PNG download scale, video format, **Record** (start/stop), and **Animate** (keyframes **A**/**B**, **Edit B**, duration, a **segmented Play | + Record** control plus **Stop** while playing). **Play** previews **A→B** without recording; **+ Record** runs the same animation and records for the duration (same behavior as the former standalone **Play + record** in the Video row). Sidebar **Actions** no longer holds those export/record controls. **Why:** One place for capture; animation and “play while saving video” stay grouped so the Video row is not duplicated.
- **What:** The extra **Stop record** text button was removed; **Record** remains a single control that toggles to **Stop** while recording. **Why:** the second stop control was redundant once play/record actions moved next to keyframe **Play**.
- **What:** **Keyframe animation** (Weave flat, Weave+halftone, Print mosaic combo+halftone, Mosaic): **Set A** / **Set B** snapshots of exposed shader props; **Edit B** streams sidebar edits into B; **Play** blends **A→B** over the chosen duration (numbers interpolate; discrete choices flip at **50%** progress). On **Mosaic**, keyframes now include **Stitch-in mode** (Off / Noise / Bleed) alongside reveal progress, and **Play** temporarily drives **`u_stitchRevealProgress`** so the built-in stitch ramp does not fight the timeline. On **Weave**, keyframes include **`shimmerPhase`** (the Shimmer **Position** slider / band phase 0–1); while **Play** runs, clock-driven shimmer phase updates pause so lerped A→B values are not overwritten each frame. **Why:** Record intentional before/after motion without URL bloat; midpoint rule keeps toggles predictable; stitch and shimmer authored in A/B show up during preview without fighting built-in ramps.
- **What:** **Tooltips** use **Radix** with **150ms** open delay (`AppTooltipProvider` in `Root.jsx`). **GroupIcon** and **AppSelect** wrap trigger + visible label area so hovering the **icon** or the **control row** shows the same tip. **Why:** Less accidental tooltip spam; labels and icons share one discoverable hover target for prop rows.
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
| **`App.jsx`** | Root shell: `view` routing (weave / mosaic / print mosaic), URL sync for weaving + halftone + combo, shared sidebar for weave & print mosaic, **capture toolbar** + keyframes under the stage. Lazy-loads halftone stages. |
| **`AppV2.jsx`** | **Mosaic**: standalone sidebar, footer, **capture toolbar** + keyframes, URL state (`v=2`, `gap=`, `display=`, …), **`ImageRectsCanvas`**. |
| **`ShaderCanvas` + weaving hook** | **Weave** draft (`fragment.glsl` + `vertex.glsl`): grid of rounded rects, warp/weft, gradients, shimmer, colorways, optional **ENS mark** overlay. |
| **`ImageRectsCanvas` + `useImageRectsSandbox`** | **Mosaic** pipeline (`fragmentImageRects.glsl`): static image, video, or GIF → rects. |
| **`WeavingHalftoneStage`** | Weave → intermediate buffer → **CMYK halftone** (`@paper-design/shaders-react`). |
| **`ImageRectsHalftoneStage`** | **Print mosaic**: **`ImageRectsCanvas`** + same halftone layer; **`combo*`** state in **`App.jsx`**. |
| **`patterns/`** | Shared weave definitions + pattern texture for GPU. |
| **`urlDefaults.js`** | Defaults: **`WEAVING_URL_DEFAULTS`**, **`HALFTONE_DEFAULTS`**, **`COMBO_DEFAULTS`**, **`IMAGE_RECTS_URL_DEFAULTS`** (includes **`mosaicBgGaps`**, **`patternFit`**). |

Data flow: **React state → uniforms / props → fragment shaders**. Resolution follows **container `getBoundingClientRect()` × DPR** (image rects hook uses DPR `2`).

---

## Keyboard shortcuts

**Mod** means **⌘** on macOS and **Ctrl** on Windows/Linux. Shortcuts are ignored while focus is inside an `input`, `select`, or `textarea` (including numeric fields next to sliders).

| Shortcut | Where it works | Action |
|----------|----------------|--------|
| **Mod+C** | Weave, Mosaic, Print mosaic | Copy canvas (same as **capture bar Copy**; respects copy format/scale). |
| **Mod+Shift+R** or **F5** | Weave, Mosaic, Print mosaic | Reload the page (`history` reload). |
| **Mod+1** … **Mod+9** | Whole app shell (`App.jsx`, all tabs) | Apply weave **preset** at index **0…8** (first nine entries in **`PRESETS`**). There is no **Mod+0** for the tenth preset. You see the result on **Weave** / **Print mosaic**; on **Mosaic** the weave state still updates in the background if you switch back. |
| **Enter** | Slider number field (when focused) | Commit typed value (`SliderWithInput`). |
| **← →** (and Radix defaults) | Slider **thumb** when focused | Nudge value (browser/Radix slider behavior). |

There are no global shortcuts today for **randomize**, **reset**, **record**, **Fit/Fill**, or switching tabs — those are UI-only unless you add them.

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

- **Controls:** presets, palette, weave pattern, shades, **warp / weft gradient On–Off** (flat = **Warp** / **Weft** shade only; **On** uses start/end/range/direction), **ENS mark** (in-shader corner logo on/off), grid & layout, **canvas aspect** as a **preset dropdown** (common ratios + **Other (x.xx)** when the value isn’t listed — URL `canvas` still allows 0.5–2). The dropdown footer has **Custom W∶H** fields plus **Apply** (width ÷ height; same clamp as URL). Shimmer, colorways, **Halftone Off/On**. **Copy / PNG download / record / keyframe animate** live in the **capture bar** under the canvas. **Fit / Fill** is only in the **main nav** (far right), not the sidebar.
- **What:** Sidebar **Actions** is **reset**, **randomize**, and optional **desktop image** for halftone / Print mosaic only. **Why:** Export and recording stay next to the canvas; Actions stays for session/file picks.
- **Colorways:** Five named palettes (Citrine, Garnet, Lapis, Peridot, **Quartz**). **Quartz** aligns with ENS Core neutrals in shader slots (see previous doc detail).
- **What:** **Use all 5 colorways** can distribute palette indices three ways in `fragment.glsl`: **Random** (legacy per-cell hash), **Smooth** (2D gradient noise + FBM: octaves, persistence, lacunarity, bias), **Bleed** (anisotropic FBM for streaks along threads; run length, angle, cross-fiber mix, optional **draft-coupled** warp/weft blend). **Noise X** (`u_colorwayNoiseX`) shifts the noise sample along **cell-space X** (warp/column direction), scaled in-shader (~`0.04×`) so slider/URL values move the field subtly; **Play** sweeps **Noise X** over **`cnx`** (−500…500, ~**50 min** loop, two decimals); legacy URLs may still use **`cnz`** (read as the same value). Values in-range at play-press are unchanged on frame 0 (`colorwayOscClamped`). The rAF loop only chains while **Use all 5 colorways** is on (turning it off pauses; turning it back on resumes from the same phase). **Include palettes** toggles restrict the pool (bitmask); all five on matches legacy behavior. **Why:** Coherent regions and fiber-parallel “dye” looks without Manhattan/Voronoi; URL-shareable tuning and time-varying colorway fields.
- **What:** With no URL overrides, **Use all 5 colorways** starts **on**, distribution **Bleed**, noise scale **0.005**, seed **78.2**, run length **0.6**, streak angle **180°**, cross-fiber **0**, **draft-coupled** on, FBM octaves **3** / persistence **0.6** / lacunarity **2.1** / bias **0.67**, and all palettes included (`cpm=31`). **Why:** Default open state matches a tuned reference look; reset buttons and `WEAVING_URL_DEFAULTS` in `src/urlDefaults.js` stay aligned.
- **URL:** `cnm` (0–2), `cns` (noise scale **0.005–0.25**), `seed`, `cnx` (noise X, −500…500; legacy `cnz` accepted on parse), `cpm` (0–31 include mask), FBM `cno`/`cnp`/`cnl`/`cnbb`, bleed `cba`/`cbr`/`cbx`/`cbd`, **`ensm`** (0 = hide ENS mark, 1 = show; default on — omitted when on), **`wgg`/`wfg`** (warp/weft gradient enabled **0|1**; default **on**, omitted when on), plus existing weave keys — `buildUrlState` / `parseUrlState` in `App.jsx`. **Play-state hints (Weave):** **`epl`** (bitmask over `DRIVER_ORDER` in `shaderEmbedInferAnimation.js`) captures which embed drivers are **auto**; omitted when it matches a fresh-default inference. **`wkp=1`** = keyframe **A→B** transport was playing when the URL was written (not hydrated into auto-play on load). **`shp=0`** = shimmer paused; **`cwp`** = colorway sidebar **Play** bitmask (see `colorwayAnimUrl.js`).

---

## Mosaic (`AppV2`)

- **Media:** image, video, or GIF via one file input; **`mediaTextureKind`** inferred from file.
- **What:** When you load a **video** file (switch from still image / GIF to **video** as the decoded source), **canvas recording starts automatically** (WebM/MP4 per **capture bar**). **Why:** Capture the mosaic output together with the source video without an extra click; stop from the capture bar or by switching back to image/GIF (recording stops when **`mediaTextureKind`** is not **`video`**).
- **Background gaps:** toggle + URL **`gap=`**; aligns with legacy v5 shader flag **`nonStitchShowsBg`**.
- **What:** In **Brightness & stitches**, the **Cell geometry** dropdown (including **Dark stitches**) is hidden for now and replaced in-place by the **Background gaps** toggle button. **Why:** simplify the control row while keeping the main stitch-vs-background switch accessible.
- **What:** Mosaic background now supports two sources in the sidebar: **Preset** (existing BG shade dropdown) or **Color** (native color picker). **Why:** keep quick ENS shade presets while allowing precise custom background color selection. URL keys: **`bgm`** (0 preset / 1 color) and **`bgc`** (hex without `#`).
- **Viewport:** **`patternFit`** from **`App.jsx`** (nav bar) + **`display=`**; passed through to **`ImageRectsCanvas`**.
- **What:** **Stitch-in** (sidebar **Stitch-in**): optional animation from a **blank** background-only frame to the full mosaic by ramping **`u_stitchRevealProgress`** 0→1. **Noise** uses isotropic FBM on cell IDs (organic scatter); **Bleed** uses the same dye-bleed–style streaks as weave “all colorways” (rotation, anisotropy, optional draft coupling to warp/weft). **Replay** / **New seed** / **duration** / **scale** / **softness** control the look; **Why:** lets mosaic reads like thread appearing from empty cloth, with two distinct visual orders.
- **What:** In Mosaic, capture-bar **Animate → + Record** (with stitch-in active) detects **Stitch-in** (Noise/Bleed) and records a stitched reveal replay for the configured Stitch-in duration, then auto-stops recording. **Why:** makes one-click capture of stitch-in animations reliable without requiring manual keyframe setup.
- **URL:** `v=2` written when sharing; params include `grid`, `pal`, `gap`, `display`, quantize keys, stitch-in keys (`srm`, `srd`, `srs`, `srsc`, `srso`, bleed `srba`/`srbr`/`srbc`/`srbd`), etc.
- **What:** **Rect color → Tile art** (`cm=3`): each grid cell picks a **weave draft** from the shared **`PATTERNS`** registry via an **8-slot luma ramp** (dark→light bands). Cells render warp/weft interlacement per sub-cell; **Geometry** toggle (**Flat** | **Rounded**, default **Rounded**) draws separated mini stitches (reuses mosaic rect radius/aspect/ratio uniforms) or flat-filled sub-cells. **Mini cells → Uniform** (default, URL **`tug=1`**) uses a fixed **8×8** grid per macro cell for drawing; warp/weft still comes from each band’s weave draft. **Pattern** (`tug=0`) subdivides by that draft’s native `tileW×tileH` (busier weaves = smaller mini cells). **Why:** keep stitch size consistent across luma bands while still varying weave complexity on the ramp. Optional **threshold** leaves bright cells as background only (low threshold = full weave carpet). Sidebar **Pattern ramp**: **Geometry**, **Mini stitch shape** sliders (radius / aspect / scale), weave per band, reorder slots, **Levels** (2–8), **Dither**, **Tile color** (Mono / Brand / Tint). Default ramp order is **complexity-based** (simple→busy weaves). URL: **`tal`**, **`tat`**, **`tad`**, **`tacm`**, **`tag`** (0 flat / 1 rounded), **`tar`** (comma-separated eight `PATTERNS` indices), plus **`rr`**, **`ra`**, **`rratio`** for stitch shape. Global **Weave pattern** dropdown is hidden in Tile art mode. **Why:** Newskool-style tile-wall looks from photos/video using existing weave geometry, with optional Weave-like stitch separation inside each macro tile.

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
- **What:** Video recording exports from a **2× offscreen capture surface** for WebM and **up to 2×** for MP4 (auto-falls back to lower scales if encoder limits are hit). **Why:** keep recordings sharp while preventing MP4 start failures on devices/browsers with lower max encode resolution.
- **What:** MP4 recording shutdown now marks the encode session as stopping before `flush()`/`close()` and ignores in-flight rAF `encode()` calls that arrive after codec close. **Why:** Prevents transient `VideoEncoder.encode` "closed codec" errors when stopping near frame boundaries.
- **What:** MP4 recording now negotiates AVC level per canvas size (`avc1` Level 5.1 → 5.0 → 4.2 → 4.0) instead of forcing Level 4.0. **Why:** Large captures (for example ~1538×1538) exceed Level 4.0 coded-area limits; level negotiation avoids false start failures while preserving MP4 output when supported.
- **What:** MP4 muxer metadata is now normalized before `addVideoChunk` (drops null/invalid `decoderConfig.colorSpace` payloads). **Why:** avoids browser-specific `Cannot read properties of null (reading 'colorSpace')` failures during recording.
- **What:** Mosaic no longer shows FPS readouts (footer meter removed and top-right canvas FPS pill removed); footer keeps only **WebGL 1** status. **Why:** keep diagnostics minimal and reduce visual clutter.

---

## Disabled / hidden product behavior

### 1. Brand mode — “Shade from” (Warp / Weft / Warp+Weft)

- **Was:** In **Brand** rect color, control for **`u_shadeFrom`** in **`fragmentImageRects.glsl`**.
- **Now:** **Forced to “Color”** (`u_shadeFrom = 0`). Controls removed from **`AppV2`** and print mosaic combo block.
- **URL:** `sf` / `csf` no longer written; old values ignored on apply.
- **Re-enable:** Restore state + URL + `AppSelect`; pass through to **`ImageRectsCanvas`** / **`ImageRectsHalftoneStage`**.

### 2. Stage X (capture bar / embed modal)

- **Was:** **Stage X** slider + number in **`CaptureToolbar`** (Weave / Print mosaic / Mosaic) and in **Export Embed**; Weave used **`u_stageTranslateX`**, Mosaic/Print mosaic used CSS **`translateX`** on **`<main>`**; URL **`stx`**.
- **Now:** Controls removed; shift is always **0**. Old **`stx`** URLs are ignored. Shader uniform and embed **`translateX`** prop remain for API/embed code (default 0).
- **Re-enable:** Restore **`CaptureToolbar`** block + state/URL in **`App.jsx`** / **`AppV2.jsx`**.

### 3. Mosaic — sidebar “Rect shape” (radius / aspect / ratio)

- **Was:** Global sliders in **`AppV2`** for all rect-color modes.
- **Now:** Hidden for non–Tile art modes; values still from **`IMAGE_RECTS_URL_DEFAULTS`** and URL **`rr`**, **`ra`**, **`rratio`**. **Tile art** (`cm=3`) shows **Mini stitch shape** sliders in **Pattern ramp** (rounded mini stitches only).
- **Weave** tab still controls **weaving** rect aspect + corner radius.
- **Re-enable globally:** Reintroduce a sidebar group for all mosaic modes in **`AppV2.jsx`**.

---

## Related files (quick index)

- `src/App.jsx` — tabs, weave + print mosaic UI, URL packing when not on Mosaic.
- `src/AppV2.jsx` — Mosaic UI + URL (`v=2`, `gap=`, `display=`).
- `src/hooks/useImageRectsSandbox.js` — WebGL program, textures, resize, uniforms.
- `src/shaders/fragmentImageRects.glsl` — mosaic fragment shader.
- `src/shaders/fragment.glsl` — weaving fragment shader.
- `src/urlDefaults.js` — defaults referenced above.
