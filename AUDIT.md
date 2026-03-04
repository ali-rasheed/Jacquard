# Shader Sandbox — Quick re-audit

**Scope:** Weaving + Image Rects UI, a11y, labels, shimmer, shared constants.

## Current state (re-audit)

- **Lint:** No ESLint errors in `src/`.
- **Build:** `npm run check` and `npm run build` pass.

### Labels & cropping
- **Shared:** `uiConstants.js` has `controlLabel` (`shrink-0 whitespace-nowrap`) for visible labels so they don’t crop.
- **Value spans:** Use `shrink-0 min-w-*` (e.g. `min-w-8`, `min-w-10`, `min-w-12`, `min-w-16`) instead of fixed `w-*`; "Smooth", "off", numbers no longer clip.
- **Sidebars:** `overflow-x-auto` so wide content scrolls instead of clipping.

### Semantic labels (a11y)
- **Preset:** `id="preset-select"` + sr-only `Label.Root` + `aria-label` on trigger.
- **AppSelect (both apps):** Optional `id` + `labelText`; when set, sr-only label and trigger `id` are used. Weave, shades, gradient start/end, colorize mode, etc. all have ids/labels.
- **Sliders:** Each has `Label.Root` with `htmlFor`, `Slider.Root` with matching `id`, and `aria-label`.
- **Buttons:** All have `aria-label` (and `title` where useful); toggles use `aria-pressed`.
- **Sidebars:** `aria-label="Weaving controls"` and `aria-label="Image Rects controls"`.
- **Decorative value readouts:** `aria-hidden` so only the control is announced.

### Shimmer
- **Rotation:** Uniform `u_shimmerRotation` (0–1 → 0–2π), hook, canvas prop, App state/URL/slider/randomize all wired.
- **Shader:** Band direction uses `cos(angle) * cellID.x + sin(angle) * cellID.y`; period scales with grid and angle.

### Shared constants
- **uiConstants.js:** Palette names/colors, shade names, type scale, `typeFps`, icons, `btnGhost`, `selectTrigger`, `selectContent`, `selectItem`, `pill`, `sidebarGroup`, `sidebarGroupTitle`, `controlLabel`. Used by App.jsx and AppV2.jsx; canvas FPS pill uses `typeFps`.

### Shader
- Rect aspect clamped 0.3–1.0 in `fragment.glsl`; comments match (no unexpected crop).

## No action needed
- Nav `aria-pressed` is correct per view.
- File input in AppV2 is wrapped in `<label>` and has `aria-label`.
