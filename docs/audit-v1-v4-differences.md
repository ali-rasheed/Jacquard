# Audit: Differences Across v1–v4

**Mapping:** App mode is driven by `view` in `App.jsx`. The four modes are:

| Version | View key               | Label                  | Main content                          |
|--------|-------------------------|------------------------|----------------------------------------|
| **v1** | `weaving`                | Weaving                | `ShaderCanvas` (weaving draft)         |
| **v2** | `imageRects`             | Image Rects            | `AppV2` → `ImageRectsCanvas`           |
| **v3** | `weavingHalftone`        | Weaving  Halftone     | `WeavingHalftoneStage`                 |
| **v4** | `imageRectsHalftone`     | Image Rects + Halftone | `ImageRectsHalftoneStage`              |

---

## 1. Shell and layout

- **v2:** `App.jsx` returns early when `view === 'imageRects'`: only top nav + `<Suspense><AppV2 /></Suspense>`. No floating sidebar, no footer from App.
- **v1, v3, v4:** Same shell: top nav, floating `motion.aside` (opacity 0 until hover), main area, footer. Sidebar and footer are always the same structure; content differs by view.

**Difference:** v2 is a separate “page” with its own layout; v1/v3/v4 share one layout.

---

## 2. Copy and WebM recording

- **v1, v3, v4:** Handled in `App.jsx`. `handleCopy` / `startRecording` choose canvas by view:
  - v1: `canvasRef.current` (weaving WebGL canvas)
  - v3, v4: `halftoneCanvasRef.current` (or canvas inside `halftoneContainerRef`) — the halftone output canvas.
- **v2:** Handled inside `AppV2.jsx` with its own `canvasRef`, same behavior (PNG/WebP at selected copy scale (1×, 2×, 4×, 8×), SVG with embedded raster, WebM via `captureStream`).

**Difference:** Implementation is split (App vs AppV2) but behavior is aligned (copy/record target is the visible result canvas).

---

## 3. URL state

- **v1:** `parseUrlState` / `buildUrlState` in `App.jsx`. Persists: pattern, palette, bg/warp/weft shades, grid, gradients, gradSteps, rect/canvas aspect, corner radius, copyFormat, colorway options, shimmer params. Preset index 0–7. **Halftone params are not in URL.**
- **v2:** `parseUrlStateV2` / `buildUrlStateV2` in `AppV2.jsx`. Persists: grid, palette, bgShade, colorizeMode, quantizeSteps, shadeFrom, patternIndex, rectRadius, rectAspect, rectRatio, copyFormat. **Image source is not in URL** (blob).
- **v3:** Uses the same App.jsx URL sync as v1. Weaving params are in URL; **halftone params (size, softness, gridNoise, contrast, type, colors, floodC, gainC/Y, etc.) are not in URL.**
- **v4:** Same as v3: only the v1 weaving state is synced to the URL. **All v4-specific state is missing from URL:** comboImageSource, comboGridSize, comboPalette, comboBgShade, comboColorizeMode, comboQuantizeSteps, comboShadeFrom, comboPatternIndex, comboRectRadius, comboRectAspect, comboRectRatio. Halftone params also not in URL.

**Difference:** v4 (and v3 halftone) cannot be fully restored from a shared URL. v2 uses a different param set and overwrites the same search string when active.

---

## 4. Keyboard shortcuts

- **v1, v3, v4:** Registered in `App.jsx`: Mod+C copy, Mod+1..8 apply preset 0–7, Mod+Shift+R / F5 reload. When on v3/v4, presets still apply to the shared weaving state (v3 source; v4 ignores that state for content but it still changes).
- **v2:** Registered in `AppV2.jsx`: Mod+C copy, Mod+Shift+R / F5 reload. **No preset shortcuts.**

**Difference:** Preset shortcuts only apply when the main App shell is mounted (v1/v3/v4); v2 has no presets.

---

## 5. Sidebar

- **v2:** Fixed visible sidebar in `AppV2` (e.g. `w-72`), always shown. Sections: Actions, Image, Weave & colorway, Rect, Grid.
- **v1, v3, v4:** Single floating sidebar in `App.jsx` (opacity 0 until hover). Content is view-dependent:
  - **v1:** Preset & colorway, Weave, Shimmer, Canvas, Copy format, etc.
  - **v3:** Same as v1 plus “Source” (optional image from desktop), “Halftone preset”, “Halftone dot & grid”, “Halftone tone”, “Halftone ink colors”.
  - **v4:** Replaces “Preset & colorway” and “Weave” with “Image” (combo image file) and “Image Rects” (grid, palette, weave, radius, aspect, ratio, mode, quantize, shade from, BG). Same Halftone sections as v3. When **not** v4, the preset/weave/shimmer sections render.

**Difference:** v2 uses a different sidebar component and layout; v1/v3/v4 share one sidebar with conditional blocks.

---

## 6. Footer

- **v1, v3, v4:** One footer in `App.jsx`. It always shows: pattern name, palette, BG shade, warp/weft shades, warp/weft gradients, grid, steps, canvas aspect, fps. **Values are the shared “weaving” state** (pattern, palette, warpShade, weftShade, etc.).
- **v2:** No footer.

**Difference:** On v4, the footer still shows weaving state (pattern, palette, warp/weft, etc.), which is unrelated to the Image Rects + Halftone content. Misleading for v4.

---

## 7. State ownership

- **v1:** All state in `App.jsx` (pattern, palette, shades, grid, gradients, shimmer, rect/canvas, copyFormat, etc.).
- **v2:** All state in `AppV2.jsx` (imageSource, gridSize, palette, bgShade, colorizeMode, quantizeSteps, shadeFrom, patternIndex, rect*, copyFormat, etc.). No shared state with App.
- **v3:** Weaving state in App (same as v1) plus halftone state in App (halftoneSize, softness, gridNoise, contrast, type, colors, floodC, gainC/Y, halftonePresetIndex, halftoneCustomImageUrl). Weaving state drives the source; halftone state drives the pipeline.
- **v4:** Combo state in App (comboImageSource, comboGridSize, comboPalette, comboBgShade, comboColorizeMode, comboQuantizeSteps, comboShadeFrom, comboPatternIndex, comboRectRadius, comboRectAspect, comboRectRatio) plus the same halftone state as v3. The “weaving” state (pattern, palette, warpShade, etc.) is still in App and used for URL sync and footer but **not** for v4’s Image Rects source.

**Difference:** v2 is fully isolated. v4 has two parallel “worlds” in App (weaving vs combo); only combo + halftone drive v4 content.

---

## 8. Presets and Randomize

- **Presets (dropdown):** Only in App sidebar for v1/v3/v4. They set pattern, palette, shades, gradients (weaving state). v3 uses that for the weaving source; v4 does not use it for the image-rects source. v2 has no presets.
- **Randomize (button):**  
  - **App.jsx:** Randomizes weaving params (pattern, palette, shades, grid, gradients, shimmer, rect aspect, corner radius, canvas aspect, colorway). Does **not** randomize halftone or v4 combo state.  
  - **AppV2.jsx:** Randomizes image-rects params only (grid, palette, bgShade, colorizeMode, quantizeSteps, shadeFrom, patternIndex, rectRadius, rectAspect, rectRatio).

**Difference:** v4 has no way to randomize combo or halftone from the current UI; only weaving state is randomized when on v4.

---

## 9. Summary table

| Area           | v1 Weaving | v2 Image Rects | v3 Weaving+Halftone | v4 Image Rects+Halftone |
|----------------|------------|----------------|----------------------|--------------------------|
| Shell          | App nav+aside+main+footer | App nav + AppV2 full UI | Same as v1 | Same as v1 |
| Copy/Record    | App (weaving canvas) | AppV2 (image rects canvas) | App (halftone canvas) | App (halftone canvas) |
| URL state      | Full Weaving  shimmer | Full image-rects (no image blob) | Weaving only (no halftone) | Weaving only (no combo, no halftone) |
| Shortcuts      | Copy, Preset 1–8, Reload | Copy, Reload | Same as v1 | Same as v1 |
| Footer         | Weaving state | None | Weaving state | Weaving state (wrong for mode) |
| Presets        | Yes (weaving) | No | Yes (weaving source) | Halftone only; weaving preset irrelevant |
| Randomize      | Weaving (+ rect/canvas) | Image rects only | Weaving only | Weaving only (combo/halftone not randomized) |

---

## 10. Recommendations

1. **v4 URL state:** Add a separate URL schema (or namespaced params) for v4: at least comboGridSize, comboPalette, comboBgShade, comboPatternIndex, comboRectRadius, comboRectAspect, comboRectRatio, comboColorizeMode, comboQuantizeSteps, comboShadeFrom. Optionally persist halftone params for both v3 and v4.
2. **Footer on v4:** Either hide the footer when `view === 'imageRectsHalftone'` or show combo + halftone summary instead of weaving state.
3. **Randomize on v3/v4:** Consider extending “Randomize” to include halftone params for v3, and combo + halftone for v4 (or separate buttons).
4. **v2 URL vs v1:** When switching between v1 and v2, URL is overwritten by whichever view last synced. Consider storing mode in URL (e.g. `?mode=weaving` / `?mode=imageRects`) and only applying the matching parse/build so both can coexist or restore correctly.
