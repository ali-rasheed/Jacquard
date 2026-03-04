# Motion options — reveal speed, replay, pause (plan)

Plan for extending the weave-in reveal (and related motion) beyond the current behavior.

## Current behavior

- **Reveal**: Diagonal wave on load and when pattern changes. In [src/shaders/fragment.glsl](src/shaders/fragment.glsl): `elapsed = u_time - u_revealStartTime`, `speed = 2.0 * gridSize / 1.8`, `wave = (cellID.x + cellID.y) - elapsed * speed`, `reveal = smoothstep(1.0, 0.0, wave)`, `cell *= reveal`.
- **Timing**: [src/hooks/useShaderSandbox.js](src/hooks/useShaderSandbox.js) sets `u_time = (Date.now() - startTime) / 1000` and resets `revealStartTime` to current time when pattern index changes. No user control for reveal speed, replay, or pause.

## 5a. Motion options to add

### 1. Reveal speed

- **Goal**: Let the user scale the reveal wave speed (faster/slower).
- **Options**:
  - **A** — New uniform `u_revealSpeed` (float, default 1.0). In shader: multiply the existing speed by it, e.g. `speed = (2.0 * gridSize / 1.8) * u_revealSpeed`. UI: slider (e.g. 0.25–4) in sidebar; wire in useShaderSandbox and ShaderCanvas.
  - **B** — Replace the fixed `2.0 * gridSize / 1.8` with a single uniform `u_revealSpeed` (cells per second or scale). Same wiring.
- **Files**: [src/shaders/fragment.glsl](src/shaders/fragment.glsl) (uniform + use in wave), [src/hooks/useShaderSandbox.js](src/hooks/useShaderSandbox.js), [src/components/ShaderCanvas.jsx](src/components/ShaderCanvas.jsx), [src/App.jsx](src/App.jsx) (state, slider, URL optional).

### 2. Replay (restart reveal)

- **Goal**: One-click restart of the reveal animation (wave runs again from the start).
- **Implementation**: Reset `revealStartTime` to the current time when user clicks “Replay”. The hook owns `revealStartTime` (local in `run()`). Expose a way to reset it:
  - **Option A** — Callback from hook: e.g. `useShaderSandbox(..., { onReady: (api) => { api.resetReveal = () => { ... } } })` or return `resetReveal` from the hook. The hook would need to store `revealStartTime` in a ref so a `resetReveal` function can set it to current time (and the render loop uses that ref). So: ref `revealStartTimeRef`, in render use `revealStartTimeRef.current`, and expose `resetReveal()` that sets `revealStartTimeRef.current = (Date.now() - startTime) / 1000` (need access to startTime – also in closure). So both startTime and revealStartTime could be refs so that resetReveal does `revealStartTimeRef.current = (Date.now() - startTimeRef.current) / 1000` but startTime is currently a local variable in run(). So we need either to store startTime in a ref when the loop starts, or to store “reveal start offset” and have resetReveal set that to “now”. Simplest: in the hook, keep a ref `revealStartTimeRef` that the render loop reads. When we want replay, set `revealStartTimeRef.current = (Date.now() - startTime) / 1000`. But startTime is inside the run() closure. So we need a ref for “animation start time” that run() sets once and that a returned callback can read. E.g. `animationStartTimeRef.current = Date.now()` at the start of run(), then `resetReveal` does `revealStartTimeRef.current = (Date.now() - animationStartTimeRef.current) / 1000`. So: two refs (animationStartTimeRef, revealStartTimeRef), both updated in the render loop (first only once), and a returned function that sets revealStartTimeRef to current elapsed. Then in render we use revealStartTimeRef.current.
  - **Option B** — Pass a “reveal key” or “revealResetTrigger” prop that when it changes (e.g. increment), the hook resets reveal. Simpler for the hook (no callback return), but requires state in parent.
- **Files**: [src/hooks/useShaderSandbox.js](src/hooks/useShaderSandbox.js) (refs + reset function or trigger), [src/App.jsx](src/App.jsx) (Replay button that calls reset or bumps trigger).

### 3. Pause

- **Goal**: Pause the reveal (and ideally all time-based motion, e.g. shimmer) so the frame is frozen.
- **Implementation**: When paused, `u_time` should not advance (or advance in a way that keeps `elapsed` constant). Easiest: pass a “paused” flag and a “time at pause” value. When paused, pass `u_time = timeAtPause` so the shader sees a fixed time. So: in the hook, when paused use a fixed time (e.g. store `pausedTimeRef` when pause is toggled, and in render pass `u_time = isPaused ? pausedTimeRef.current : (Date.now() - startTime) / 1000`). Shimmer and reveal both depend on `u_time`, so one uniform freezes both.
- **Files**: [src/hooks/useShaderSandbox.js](src/hooks/useShaderSandbox.js) (accept `paused` prop, when paused pass fixed `u_time`), [src/components/ShaderCanvas.jsx](src/components/ShaderCanvas.jsx) (pass `paused`), [src/App.jsx](src/App.jsx) (state `paused`, Pause/Resume button; store time-at-pause when pausing).

## Suggested order

1. **Reveal speed** — uniform + slider (no refactor of timing).
2. **Replay** — refs + reset callback or trigger prop; Replay button.
3. **Pause** — `paused` prop + fixed `u_time` when paused; Pause/Resume button.

## UI placement

- Group “Motion” or “Reveal” in sidebar: Reveal speed slider, Replay button, Pause/Resume button. Optional: only show when relevant (e.g. when not paused show Pause, when paused show Resume).
