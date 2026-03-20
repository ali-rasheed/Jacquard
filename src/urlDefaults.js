/**
 * URL/default state constants used by parse/build/reset across modes.
 * Keeping these centralized prevents drift between URL omission and reset behavior.
 */
import { RECT_ASPECT_DEFAULT } from './constants';

export const WEAVING_URL_DEFAULTS = {
  view: 'weaving',
  menuHidden: true,
  pattern: 0,
  palette: 0,
  bgShade: 2,
  warpShade: 1,
  weftShade: 3,
  gridSize: 32,
  presetIndex: null,
  gradSteps: 0,
  rectAspect: RECT_ASPECT_DEFAULT,
  cornerRadius: 0.18,
  canvasAspect: 1,
  patternFit: 'fit',
  copyFormat: 'png',
  copyScale: 2,
  exportScale: 6,
  useAllColorways: false,
  colorwaySeed: 0,
  colorwayNoiseScale: 1,
  shimmer: false,
  shimmerSpeed: 2,
  shimmerWidth: 2,
  shimmerIntensity: 0.25,
  shimmerPosition: 0,
  shimmerRotation: 0.125,
  shimmerNoise: 0.3,
  shimmerNoiseSeed: 0,
  shimmerNoiseMin: 0.5,
  shimmerNoiseMax: 1.5,
  shimmerBlendMode: 0,
  warpGradient: { startShade: 0, endShade: 3, direction: 0, range: [0, 100] },
  weftGradient: { startShade: 0, endShade: 3, direction: 0, range: [0, 100] },
};

export const IMAGE_RECTS_URL_DEFAULTS = {
  gridSize: 32,
  palette: 0,
  bgShade: 2,
  colorizeMode: true,
  quantizeSteps: 0,
  shadeFrom: 0,
  patternIndex: 0,
  rectRadius: 0.18,
  rectAspect: 0.85,
  rectRatio: 1,
  copyFormat: 'png',
  copyScale: 2,
};

export const HALFTONE_DEFAULTS = {
  presetIndex: 0,
  size: 0.2,
  softness: 1,
  gridNoise: 0.2,
  contrast: 1,
  type: 'ink',
  colorBack: '#fbfaf4',
  colorC: '#00b3ff',
  colorM: '#fc4f9d',
  colorY: '#ffd900',
  colorK: '#231f20',
  floodC: 0.15,
  gainC: 0.3,
  gainY: 0.2,
};

export const COMBO_DEFAULTS = {
  gridSize: 32,
  palette: 0,
  bgShade: 2,
  colorizeMode: true,
  quantizeSteps: 0,
  shadeFrom: 0,
  patternIndex: 0,
  rectRadius: 0.18,
  rectAspect: 0.85,
  rectRatio: 1,
};
