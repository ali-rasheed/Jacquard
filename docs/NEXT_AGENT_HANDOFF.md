# Next Agent Handoff

Concise handoff for a fresh agent to continue work quickly with current recording and Mosaic changes.

## Current Baseline

- Branch: `main`
- Current HEAD: `ebdc76072978bbe5ee9e691857a65056779ae0c4`
- Recent integration: PR `#3` (merged into `main`)
- Working tree: clean at handoff time

## What Was Recently Shipped

- **Mosaic keyframe improvements**
  - `stitchRevealMode` is included in keyframe snapshot/apply flow.
  - **Animate → + Record** (same handler as legacy “Play + record”) for active Stitch-in replays; auto-stops after configured duration.
- **Recording UX**
  - Capture bar: **Record** is a single start/stop control; **Animate** uses a segmented **Play | + Record** (no duplicate Video-row “Play + record” or second “Stop record” button).
  - Record/stop behavior cleaned up to reduce auto-stop confusion between manual and auto recording.
- **Recording pipeline hardening**
  - MP4 path: safer encoder lifecycle handling, metadata normalization around muxing, and improved error handling.
  - MP4 export scaling: attempts higher scale first and falls back to supported scale instead of failing hard.
  - WebM/MP4 export quality: recording flow updated for higher-resolution output behavior.
- **Mosaic controls**
  - Background supports both **Preset** (shade dropdown) and **Color** (picker) modes.
  - URL/state/keyframe/shader wiring added for custom background color mode.
  - `Dark stitches` dropdown was removed; `Background gaps` toggle used in that slot.
- **UI cleanup**
  - Mosaic FPS readouts removed (canvas pill + footer meter), keeping simpler status display.

## Files Most Relevant To Continue

- `src/AppV2.jsx`
- `src/components/CaptureToolbar.jsx`
- `src/components/ImageRectsCanvas.jsx`
- `src/hooks/useCanvasRecorder.js`
- `src/hooks/useImageRectsSandbox.js`
- `src/keyframe/mosaicKeyframe.js`
- `src/shaders/fragmentImageRects.glsl`
- `src/urlDefaults.js`
- `docs/FEATURES.md`

## Known Areas To Re-Verify In Browser

- MP4 **Animate → + Record** under large viewport sizes (confirm fallback scale choice is stable).
- Stitch-in recording start/stop timing with both manual **Record** and **Animate → + Record**.
- BG preset/color mode round-trip:
  - UI state
  - URL parse/build
  - Keyframe Set A/B + playback

## Suggested Quick Start Commands

- `npm run check`
- `npm run build`
- `npm run dev`

