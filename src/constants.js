/**
 * App constants: presets, grid snaps, URL limits, rect aspect, and helpers.
 * Single source of truth for weaving presets and shared numeric constants.
 */

/** Scale factor for PNG copy to clipboard (v1–v4). */
export const PNG_COPY_SCALE = 3;

/** Material Symbol icon per weave pattern id (used in weave dropdown). */
export const WEAVE_ICONS = {
  'plain': 'grid_on',
  'matt-regular': 'view_module',
  'matt-rib-irregular': 'widgets',
  'weft-rib-regular': 'horizontal_rule',
  'satin': 'blur_linear',
  'sateen': 'gradient',
  'twill-2-2': 'trending_up',
  'twill-3-3': 'trending_up',
  'weft-rib-irregular': 'view_agenda',
  'warp-rib-regular': 'view_column',
  'warp-rib-irregular': 'view_column',
  'basket': 'apps',
  'point-twill': 'call_split',
  'royal-oxford': 'category',
  'houndstooth': 'pattern',
  'herringbone': 'compare_arrows',
  'pattern-738': 'dashboard',
  'ens-vertical-pairs': 'view_column',
  'curtain': 'vertical_split',
};

/** Flat gradient = same start/end shade (solid). */
function flatGrad(shade) {
  return { startShade: shade, endShade: shade, direction: 0, range: [0, 100] };
}
/** Two-stop gradient config for warp + weft. */
function grad(wStart, wEnd, wfStart, wfEnd, wDir = 0, wfDir = 0) {
  return {
    warpGradient: { startShade: wStart, endShade: wEnd, direction: wDir, range: [0, 100] },
    weftGradient: { startShade: wfStart, endShade: wfEnd, direction: wfDir, range: [0, 100] },
  };
}

/** Presets: weave + colorway + shades + grad. Selecting one applies all state. */
export const PRESETS = [
  { id: 'citrine-plain-flat', label: 'Citrine · Plain · Flat', pattern: 0, palette: 0, bgShade: 1, warpShade: 1, weftShade: 3, warpGradient: flatGrad(1), weftGradient: flatGrad(3) },
  { id: 'garnet-twill-flat', label: 'Garnet · 2/2 Twill · Flat', pattern: 6, palette: 1, bgShade: 3, warpShade: 0, weftShade: 3, warpGradient: flatGrad(0), weftGradient: flatGrad(3) },
  { id: 'lapis-satin-flat', label: 'Lapis · Satin · Flat', pattern: 4, palette: 2, bgShade: 1, warpShade: 1, weftShade: 3, warpGradient: flatGrad(1), weftGradient: flatGrad(3) },
  { id: 'peridot-houndstooth-flat', label: 'Peridot · Houndstooth · Flat', pattern: 11, palette: 3, bgShade: 0, warpShade: 0, weftShade: 2, warpGradient: flatGrad(0), weftGradient: flatGrad(2) },
  { id: 'citrine-plain-grad', label: 'Citrine · Plain · Grad', pattern: 0, palette: 0, bgShade: 3, warpShade: 1, weftShade: 3, ...grad(0, 3, 1, 2) },
  { id: 'garnet-twill-grad', label: 'Garnet · 2/2 Twill · Grad', pattern: 6, palette: 1, bgShade: 0, warpShade: 0, weftShade: 3, ...grad(0, 3, 1, 2) },
  { id: 'lapis-satin-grad', label: 'Lapis · Satin · Grad', pattern: 4, palette: 2, bgShade: 2, warpShade: 1, weftShade: 2, ...grad(0, 2, 2, 3, 1, 1) },
  { id: 'peridot-houndstooth-grad', label: 'Peridot · Houndstooth · Grad', pattern: 11, palette: 3, bgShade: 1, warpShade: 0, weftShade: 1, ...grad(0, 3, 1, 3, 0, 1) },
];

/** Default rect aspect 36×40 (warp orientation). Shared by App, ShaderCanvas, useShaderSandbox. */
export const RECT_ASPECT_DEFAULT = 36 / 40;

/** Designer-friendly grid sizes; slider snaps to these. */
export const GRID_SNAPS = [8, 12, 16, 24, 32, 48, 64];

/** Index into GRID_SNAPS closest to given size (for slider when size comes from URL). */
export function getGridSizeIndex(size) {
  return GRID_SNAPS.reduce((best, val, i) =>
    Math.abs(val - size) < Math.abs(GRID_SNAPS[best] - size) ? i : best, 0);
}

/** When gradSteps >= 2, snap a 0–100 value to the nearest band. */
export function snapGradRangeValue(value, gradSteps) {
  if (gradSteps < 2) return value;
  const step = 100 / gradSteps;
  const n = Math.round(value / step);
  return Math.max(0, Math.min(100, n * step));
}

/** Max URL search length; compact schema keeps under ~2k. */
export const URL_STATE_MAX_LEN = 2000;
