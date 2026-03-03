# Shader Sandbox — Agent handoff

Subagents split the plan and coordinate via this file. **Before starting your chunk, read the whole file. When you finish your chunk, append a short "Completed" section** so the next agent knows what changed and what to watch for.

## Task split

| Chunk | Agent | Items | Scope |
|-------|--------|-------|--------|
| 1 | A | Bug fix (GLSL) + Remove mouse effect | fragment.glsl, useShaderSandbox.js, App.jsx (falloffCurve, mouse) |
| 2 | B | Grid snapping + Gradient range snapping | App.jsx sliders only |
| 3 | C | SVG/PNG copy toggle + Collapsible sidebar | App.jsx (copy control, sidebar state + collapse UI) |
| 4 | D | URL state + Keyboard shortcuts | App.jsx (search params read/write, keydown handlers) |
| 5 | E | Shimmer + All 4 colorways randomized | fragment.glsl, useShaderSandbox.js, App.jsx (new state + controls) |

Plan details: `.cursor/plans/shader_sandbox_ux_and_cleanup_668a88e0.plan.md` (or repo .cursor/plans/).

## Completed (append below)

### Completed — Chunk 1 (Agent A)

**Changes:**

- **src/shaders/fragment.glsl**
  - No `.//` typo found; no change. No FABRIC WARP block or `u_mouse*`/`u_falloffCurve` usage was present (shader was already clean).

- **src/hooks/useShaderSandbox.js**
  - Removed `falloffCurve` from the hook signature and from refs/assignments.
  - Removed from `getUniformLocs`: `mouse`, `mouseRadius`, `mouseStrength`, `mouseDown`, `falloffCurve`.
  - Removed mouse constants (`MOUSE_OFF`, `MOUSE_RADIUS`, `MOUSE_STRENGTH`, `MOUSE_STRENGTH_RAMP_MS`), `mouseRef`, all mouse event handlers (`updateMouse`, `onMouseMove`, `onMouseDown`, `onMouseUp`, `onMouseLeave`), add/removeEventListener for mouse events, and all `gl.uniform*` calls for mouse/falloff in `render`. Cleanup in the effect return no longer references `mouseHandlers`.

- **src/App.jsx**
  - Removed `falloffCurve` state and `setFalloffCurve`.
  - Removed `falloffOptions` and the sidebar UI block for "Curve" / Falloff (GroupIcon + Label + AppSelect).
  - Removed `falloffCurve` prop from `<ShaderCanvas>` and the footer pill that showed `falloffOptions[falloffCurve]?.label`.

- **src/components/ShaderCanvas.jsx**
  - Removed `falloffCurve` from props and from the `useShaderSandbox(...)` argument list (no longer passed between `gridSize` and `warpGradient`).

**State/API removals for next agent:**

- `falloffCurve` and all mouse-related props/state are removed. App no longer has falloff state or falloff UI. `useShaderSandbox` no longer accepts `falloffCurve` or uses mouse; its signature is now `(vertexSource, fragmentSource, patternIndex, palette, bgShade, warpShade, weftShade, gridSize, warpGradient, weftGradient, gradSteps, rectAspect, cornerRadius, patterns, onFpsChange)`.

### Completed — Chunk 2 (Agent B)

- **Files changed:** `src/App.jsx`
- **Grid size slider snapping:** Added `GRID_SNAPS = [8, 12, 16, 24, 32, 48, 64]` and helper `getGridSizeIndex(size)` (returns index of closest value for slider position). Grid slider now uses index 0..6: `value={[getGridSizeIndex(gridSize)]}`, `onValueChange={([i]) => setGridSize(GRID_SNAPS[i])}`, `min={0}`, `max={GRID_SNAPS.length - 1}`, `step={1}`. Displayed label remains `gridSize` (so if state is set from URL to a non-snap value like 10, label shows 10 until user drags; then it snaps to 12).
- **Gradient range snapping:** When `gradSteps >= 2`, warp and weft gradient range thumbs snap to multiples of `100/gradSteps` (e.g. 4 steps → 0, 25, 50, 75, 100). Helper `snapGradRangeValue(value, gradSteps)` clamps and rounds to the nearest band. In both sliders: `onValueChange` applies this snap when `gradSteps >= 2`; `step` is set to `gradSteps >= 2 ? 100 / gradSteps : 5` so the slider step matches banding when on.
- **New helpers/state:** No new state. Helpers: `getGridSizeIndex(size)`, `snapGradRangeValue(value, gradSteps)`. Next agent: if URL state (Chunk 4) sets `gridSize`, consider snapping it to `GRID_SNAPS` on load so label and thumb stay in sync; same idea for warp/weft `range` when `gradSteps >= 2`.

**Agent B (this run):** Grid slider was still using raw `gridSize` (min 8, max 64, step 2). Wired it to index-based snapping: `value={[getGridSizeIndex(gridSize)]}`, `onValueChange={([i]) => setGridSize(GRID_SNAPS[i])}`, `min={0}`, `max={GRID_SNAPS.length - 1}`, `step={1}`. Gradient range snapping was already correct.

### Completed — Chunk 3 (Agent C)

**Files changed:** `src/App.jsx`, `HANDOFF.md`

**1. SVG/PNG copy toggle**
- **State:** `copyFormat` (`'png' | 'svg'`), default `'png'`. Setter: `setCopyFormat`.
- **UI:** Single Copy PNG button replaced with a segment control (PNG | SVG) plus a circular copy button on the right, matching Figma node 55-41. Uses existing `Icon` with `name="content_copy"`; styles use project tokens: `accent`, `surface-elevated`, `border-subtle`, `surface-hover`, `text-text`, `text-text-secondary`.
- **Behavior:** PNG: same as before — 2× canvas to clipboard as `image/png`. SVG: build SVG document with canvas embedded as raster (data URL at 2×), copy as `image/svg+xml` and `text/plain` via `ClipboardItem`. Handlers: `handleCopy2xPng`, `handleCopySvg`; `handleCopy` dispatches based on `copyFormat`.

**2. Collapsible sidebar**
- **State:** `sidebarOpen` (boolean, default `true`). Setter: `setSidebarOpenPersisted(open)` — updates state and writes to `localStorage` key `shaderbox-sidebar-open` so preference persists across reloads. Initial state is read from localStorage (or `true` if missing/parse error).
- **UI:** Left aside uses `transition-[max-width] duration-200 ease-out`; when `sidebarOpen` is false, aside gets `width: 0`, `maxWidth: 0`, `minWidth: 0` and `overflow-hidden` so it collapses. A thin strip (toggle button, min-w-6) with chevron left/right remains visible to expand/collapse; `aria-label` and `title` indicate "Collapse sidebar" / "Expand sidebar".

**For URL state (Chunk 4) or other agents:** Consider reading/writing `copyFormat` and `sidebarOpen` in search params if desired (e.g. `copyFormat=svg`, `sidebar=0`). `sidebarOpen` is already persisted in localStorage; URL could override on load or be synced on change.

### Completed — Chunk 1 (Agent A) — verification pass

**Summary:** Chunk 1 was already applied in a previous run. Verification found no remaining work.

**Changes made this pass:** None.

**Verified:**
- **src/shaders/fragment.glsl** — No `.//` typo; no FABRIC WARP block or `u_mouse*` / `u_falloffCurve` usage.
- **src/hooks/useShaderSandbox.js** — No mouse event listeners, `updateMouse`, `mouseRef`, or mouse/falloff uniform uploads or `getUniformLocs`.
- **src/App.jsx** — No `falloffCurve` state, no falloff curve control UI, no `falloffCurve` prop to ShaderCanvas.
- **src/components/ShaderCanvas.jsx** — No `falloffCurve` in props or in `useShaderSandbox(...)`.

**State/API removals for next agent:** `falloffCurve` and all mouse-related props/state are removed. `useShaderSandbox` does not accept `falloffCurve` or use mouse; signature is `(vertexSource, fragmentSource, patternIndex, palette, bgShade, warpShade, weftShade, gridSize, warpGradient, weftGradient, gradSteps, rectAspect, cornerRadius, patterns, onFpsChange)`.

### Completed — Chunk 5 (Agent E)

**Files changed:** `src/shaders/fragment.glsl`, `src/hooks/useShaderSandbox.js`, `src/components/ShaderCanvas.jsx`, `src/App.jsx`, `HANDOFF.md`.

**1. Shimmer effect**
- **fragment.glsl:** Added uniforms `u_shimmer` (0/1), `u_shimmerSpeed`, `u_shimmerWidth`. After computing final pixel color, when `u_shimmer > 0.5` a time-based highlight band is applied: `phase = (cellID.x + cellID.y) - u_time * speed`, band from `smoothstep`, then `outColor.rgb += band * 0.25`.
- **useShaderSandbox.js:** Added uniform locations `shimmer`, `shimmerSpeed`, `shimmerWidth`; refs and uploads in render (with null checks). Hook now accepts `shimmer` (0/1), `shimmerSpeed`, `shimmerWidth` after `cornerRadius`.
- **App.jsx:** State `shimmer` (bool), `shimmerSpeed` (number, default 2), `shimmerWidth` (number, default 2). Sidebar: "Shimmer" toggle; when on, optional sliders for speed (0.2–8) and width (0.5–6).
- **ShaderCanvas.jsx:** New props `shimmer`, `shimmerSpeed`, `shimmerWidth`; passed into `useShaderSandbox` as numeric (shimmer as 1/0).

**2. All 4 colorways randomized**
- **fragment.glsl:** Added uniforms `u_useAllColorways` (0/1), `u_colorwaySeed`. Added GLSL `hash(vec2)` for deterministic per-cell value. When `u_useAllColorways > 0.5`, per-cell palette index is `mod(floor(hash(cellID + vec2(u_colorwaySeed, 0.0)) * 4.0), 4.0)`; warp/weft colors use `getPaletteColor(cellPalette, u_warpShade)` and `getPaletteColor(cellPalette, u_weftShade)`. When off, existing gradient path unchanged.
- **useShaderSandbox.js:** Added uniform locations `useAllColorways`, `colorwaySeed`; refs and uploads in render.
- **App.jsx:** State `useAllColorways` (bool), `colorwaySeed` (number, 0–100). Sidebar: "Use all 4 colorways" toggle; when on, optional "Seed" slider (0–100).
- **ShaderCanvas.jsx:** New props `useAllColorways`, `colorwaySeed`; passed into hook as 1/0 and number.

**URL state (DialKit/URL):** `parseUrlState` / `buildUrlState` and the URL sync effect now include:
- `all` → `useAllColorways` (0/1)
- `seed` → `colorwaySeed` (0–999)
- `shimmer` → `shimmer` (0/1)
- `shimmerSp` → `shimmerSpeed` (0.2–8)
- `shimmerW` → `shimmerWidth` (0.5–6)

Load effect applies these; sync effect writes them when non-default. For DialKit or other state tooling, the new keys are: `shimmer`, `shimmerSpeed`, `shimmerWidth`, `useAllColorways`, `colorwaySeed`.

### Completed — Chunk 4 (Agent D)

**Files changed:** `src/App.jsx`, `HANDOFF.md`

**1. URL state for sharing presets**
- **On load:** `parseUrlState(window.location.search)` runs once (ref guard). If `preset` is 0–7, `applyPreset(preset)` runs first; then any other present params overlay (pattern, palette, shades, grid, warpG/weftG, steps, rect, corner, canvas, cf, sidebar). `gridSize` from URL is snapped to `GRID_SNAPS` via `getGridSizeIndex` so the slider stays in sync.
- **On state change:** A debounced effect (400ms) builds search from current state via `buildUrlState()` and calls `history.replaceState`. Only params that differ from defaults are included so the URL stays short; total length is capped at 2000 chars (`URL_STATE_MAX_LEN`).
- **URL param names (compact schema):** `p` = pattern index, `pal` = palette, `bg` = bgShade, `warp` = warpShade, `weft` = weftShade, `grid` = gridSize, `preset` = preset index 0–7, `warpG` / `weftG` = gradient "start,end,dir,r0,r1" (e.g. `0,3,0,0,100`), `steps` = gradSteps, `rect` = rectAspect, `corner` = cornerRadius, `canvas` = canvasAspect, `cf` = copyFormat (png|svg), `sidebar` = 0|1. Reserved for Chunk 5: `allColorways`, `colorwaySeed` (not read/written yet).

**2. Keyboard shortcuts**
- **Guard:** Handlers run only when focus is not in `input`, `select`, or `textarea` (`!event.target.closest('input, select, textarea')`).
- **Mod+C (Cmd/Ctrl+C):** Copy using current `copyFormat` (PNG or SVG); `preventDefault()` so the browser doesn’t intercept.
- **Mod+1 … Mod+8:** Apply preset 0–7; `preventDefault()`.
- **Mod+Shift+R or F5:** Reload; `preventDefault()`.
- **Mod+\\ or Mod+B:** Toggle sidebar (`setSidebarOpenPersisted(!sidebarOpen)`); `preventDefault()`.

**Notes for other agents / DialKit:** URL sync is one-way (state → URL) after load; no `popstate` listener. If you add DialKit or another control layer, wire it to the same state so the URL continues to reflect it. For Chunk 5, add reading/writing of `allColorways` and `colorwaySeed` in `parseUrlState` and `buildUrlState` when that state exists.
