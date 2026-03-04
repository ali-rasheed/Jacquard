# Shader Sandbox — Audit of Recent Changes

**Scope:** Weaving + Image Rects UI, shader rect aspect, shimmer, recording, type scale, sidebar groups, palette swatches.

## Summary

- **Lint:** No ESLint errors in `src/`.
- **Shader:** `fragment.glsl` rect aspect clamped 0.3–1.0; comments match intent.
- **A11y:** Palette swatches and controls have `aria-label` / `aria-pressed` / `role="group"` where appropriate.

## Findings to Fix

1. **Duplication — type scale & palette**
   - `PALETTE_SWATCH_COLORS`, `typeXs`/`typeSm`/`typeBase`/`typeLabel`/`typeControl`/`typeValue`/`typeCaption`, `sidebarGroup`/`sidebarGroupTitle`, and related button/select/pill classes are duplicated between `src/App.jsx` and `src/AppV2.jsx`.
   - **Action:** Extract shared UI constants (and optionally palette) to e.g. `src/uiConstants.js` and import in both. Keep changes minimal; avoid large refactors.

2. **FPS pill typography**
   - `ShaderCanvas.jsx` (line 47) and `ImageRectsCanvas.jsx` (line 35) use hardcoded `text-[12px]` for the FPS pill.
   - **Action:** Use a shared token (e.g. pass a small type class from parent or define a single constant in a shared file). If extracting `uiConstants.js`, add e.g. `typeFps = 'text-[12px]'` and use it in both canvas components.

3. **QA**
   - Run `npm run check` and `npm run build`.
   - Optionally start dev server and smoke-test: Weaving (presets, palette swatches, rect aspect, shimmer, record, randomize) and Image Rects (palette swatches, quantize, grid).

## Out of Scope / No Change

- `index.css` uses `text-[13px]`; matches `typeBase`; leave as-is.
- Nav `aria-pressed` logic in `App.jsx` is correct per view.
