/**
 * Shared colorway helpers for Weave and Mosaic sidebars (animation sweeps, URL, include-mask cycling).
 */
import { WEAVING_URL_DEFAULTS } from './urlDefaults';
import { clampColorwayAnimBits } from './colorwayAnimUrl';

/** Dye-bleed streak angle as fraction of a full turn (0–1); snap to 5° steps for shader/UI. */
export function snapColorwayBleedRotation(turns) {
  const t = Number(turns);
  if (!Number.isFinite(t)) return 0;
  const clamped = Math.max(0, Math.min(1, t));
  const deg = clamped * 360.0;
  const snappedDeg = (Math.round(deg / 5.0) * 5.0) % 360.0;
  return snappedDeg / 360.0;
}

/** Include-mask bitmask → index in the 7-step play cycle (one-hot ×5, then all five). */
export function colorwayIncludeMaskToStep(mask) {
  const m = Math.round(Number(mask)) & 31;
  if (m === 31) return 5;
  for (let i = 0; i < 5; i += 1) if (m === (1 << i)) return i;
  return 0;
}

/** Toggle palette `index` in the all-colorways pool; always keeps at least one selected. */
export function toggleColorwayIncludeMask(prev, index) {
  const i = Math.max(0, Math.min(4, Math.round(index)));
  const bit = 1 << i;
  const included = (prev & bit) !== 0;
  let n = 0;
  for (let j = 0; j < 5; j += 1) if (prev & (1 << j)) n += 1;
  if (included && n <= 1) return prev;
  return included ? prev & ~bit : prev | bit;
}

/** Lowest-index palette bit set in the include mask (fallback: default palette). */
export function firstPaletteInIncludeMask(mask) {
  const m = Math.round(Number(mask)) & 31;
  for (let i = 0; i < 5; i += 1) if (m & (1 << i)) return i;
  return WEAVING_URL_DEFAULTS.palette;
}

/** Single palette index as a one-hot include mask. */
export function includeMaskForPalette(palette) {
  return 1 << Math.max(0, Math.min(4, Math.round(palette)));
}

export function colorwayIncludeStepToMask(step) {
  const s = ((Math.floor(step) % 7) + 7) % 7;
  return s < 5 ? (1 << s) : 31;
}

/** Sine loop min↔max with value = `origin` at t=0; period `periodMs`. */
export function colorwayOscFromOrigin(tMs, periodMs, minV, maxV, origin) {
  const span = maxV - minV;
  if (span <= 0) return origin;
  const u = Math.max(0, Math.min(1, (Number(origin) - minV) / span));
  const phi = Math.asin(2 * u - 1);
  const TAU = 2 * Math.PI;
  return minV + span * (0.5 + 0.5 * Math.sin(phi + (tMs / periodMs) * TAU));
}

/** Same as `colorwayOscFromOrigin` but clamps `origin` into `[minV,maxV]`. */
export function colorwayOscClamped(tMs, periodMs, minV, maxV, origin) {
  const o = Number(origin);
  const clamped = Number.isFinite(o) ? Math.max(minV, Math.min(maxV, o)) : (minV + maxV) * 0.5;
  return colorwayOscFromOrigin(tMs, periodMs, minV, maxV, clamped);
}

/** Linear max→min then min→max (no snap at extrema); value = `origin` at t=0; period `periodMs`. */
export function colorwaySweepFromOrigin(tMs, periodMs, minV, maxV, origin) {
  const span = maxV - minV;
  if (span <= 0) return origin;
  const o = Number(origin);
  const clamped = Number.isFinite(o) ? Math.max(minV, Math.min(maxV, o)) : (minV + maxV) * 0.5;
  const startNorm = (clamped - minV) / span;
  const u = (((tMs % periodMs) + periodMs) % periodMs) / periodMs;
  const startPhase = startNorm >= 0.5 ? 1 - startNorm : 1 + startNorm;
  const p = (startPhase + u * 2) % 2;
  const norm = p <= 1 ? 1 - p : p - 1;
  return minV + norm * span;
}

/** Same as `colorwaySweepFromOrigin` but clamps `origin` into `[minV,maxV]`. */
export function colorwaySweepClamped(tMs, periodMs, minV, maxV, origin) {
  const o = Number(origin);
  const clamped = Number.isFinite(o) ? Math.max(minV, Math.min(maxV, o)) : (minV + maxV) * 0.5;
  return colorwaySweepFromOrigin(tMs, periodMs, minV, maxV, clamped);
}

export const COLORWAY_NOISE_X_PLAY_MIN = -500;
export const COLORWAY_NOISE_X_PLAY_MAX = 500;

/** Which colorway params are auto-animated; aligned with `colorwayAnimUrl.js` (URL `cwp`). */
export const COLORWAY_ANIM_INITIAL = {
  seed: false,
  noiseScale: false,
  noiseMode: false,
  includeMask: false,
  octaves: false,
  persistence: false,
  lacunarity: false,
  bias: false,
  noiseX: false,
  bleedAnisotropy: false,
  bleedRotation: false,
  bleedCrossFiber: false,
  bleedDraftCoupled: false,
};

export const COLORWAY_SEED_LOOP_MS = 1_200_000;

/** 0°, 5°, …, 355° as turn fractions — matches `SliderWithInput` `snapValues`. */
export const COLORWAY_BLEED_ANGLE_TURNS = Array.from({ length: 72 }, (_, i) => (i * 5) / 360);

const def = WEAVING_URL_DEFAULTS;

/** Parse colorway keys from URLSearchParams into partial state. */
export function parseColorwayUrlParams(params, out = {}) {
  const num = (paramKey, stateKey, min, max) => {
    const v = params.get(paramKey);
    if (v == null) return;
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    out[stateKey] = min != null && max != null ? Math.max(min, Math.min(max, n)) : n;
  };
  num('all', 'useAllColorways', 0, 1);
  num('seed', 'colorwaySeed', 0, 999);
  num('cns', 'colorwayNoiseScale', 0.005, 0.25);
  num('cnm', 'colorwayNoiseMode', 0, 2);
  num('cno', 'colorwayNoiseOctaves', 1, 4);
  num('cnp', 'colorwayNoisePersistence', 0.15, 0.95);
  num('cnl', 'colorwayNoiseLacunarity', 1.05, 4);
  num('cnbb', 'colorwayNoiseBias', 0.25, 4);
  num('cnx', 'colorwayNoiseX', -500, 500);
  const legacy = params.get('cnz');
  if (legacy != null && out.colorwayNoiseX === undefined) {
    const n = Number(legacy);
    if (Number.isFinite(n)) out.colorwayNoiseX = Math.max(-500, Math.min(500, n));
  }
  num('cba', 'colorwayBleedAnisotropy', 0.35, 12);
  num('cbr', 'colorwayBleedRotation', 0, 1);
  num('cbx', 'colorwayBleedCrossFiber', 0, 1);
  num('cbd', 'colorwayBleedDraftCoupled', 0, 1);
  num('cpm', 'colorwayIncludeMask', 0, 31);
  const cwp = params.get('cwp');
  if (cwp != null) {
    const n = Number(cwp);
    if (Number.isFinite(n)) out.colorwayPlayBits = clampColorwayAnimBits(n);
  }
  if (out.useAllColorways != null) out.useAllColorways = !!out.useAllColorways;
  if (out.colorwayBleedDraftCoupled != null) out.colorwayBleedDraftCoupled = !!out.colorwayBleedDraftCoupled;
  if (out.colorwayBleedRotation != null) {
    out.colorwayBleedRotation = snapColorwayBleedRotation(out.colorwayBleedRotation);
  }
  return out;
}

/** Write non-default colorway keys to URLSearchParams. */
export function buildColorwayUrlParams(state, p) {
  if (state.useAllColorways !== def.useAllColorways) p.set('all', state.useAllColorways ? '1' : '0');
  if (state.colorwaySeed !== def.colorwaySeed) p.set('seed', String(state.colorwaySeed));
  if (state.colorwayNoiseScale !== def.colorwayNoiseScale) p.set('cns', String(Number(state.colorwayNoiseScale.toFixed(3))));
  if (state.colorwayNoiseMode !== def.colorwayNoiseMode) p.set('cnm', String(Math.round(state.colorwayNoiseMode)));
  if (state.colorwayNoiseOctaves !== def.colorwayNoiseOctaves) p.set('cno', String(Math.round(state.colorwayNoiseOctaves)));
  if (state.colorwayNoisePersistence !== def.colorwayNoisePersistence) p.set('cnp', String(Number(state.colorwayNoisePersistence.toFixed(2))));
  if (state.colorwayNoiseLacunarity !== def.colorwayNoiseLacunarity) p.set('cnl', String(Number(state.colorwayNoiseLacunarity.toFixed(2))));
  if (state.colorwayNoiseBias !== def.colorwayNoiseBias) p.set('cnbb', String(Number(state.colorwayNoiseBias.toFixed(2))));
  if (state.colorwayNoiseX !== def.colorwayNoiseX) p.set('cnx', String(Number(state.colorwayNoiseX.toFixed(2))));
  if (state.colorwayBleedAnisotropy !== def.colorwayBleedAnisotropy) p.set('cba', String(Number(state.colorwayBleedAnisotropy.toFixed(2))));
  if (state.colorwayBleedRotation !== def.colorwayBleedRotation) p.set('cbr', String(Number(state.colorwayBleedRotation.toFixed(3))));
  if (state.colorwayBleedCrossFiber !== def.colorwayBleedCrossFiber) p.set('cbx', String(Number(state.colorwayBleedCrossFiber.toFixed(2))));
  if (!!state.colorwayBleedDraftCoupled !== !!def.colorwayBleedDraftCoupled) p.set('cbd', state.colorwayBleedDraftCoupled ? '1' : '0');
  if (state.colorwayIncludeMask !== def.colorwayIncludeMask) p.set('cpm', String(Math.round(state.colorwayIncludeMask)));
}

/** Default colorway values object (for reset). */
export function getColorwayDefaults() {
  return {
    useAllColorways: def.useAllColorways,
    colorwaySeed: def.colorwaySeed,
    colorwayNoiseScale: def.colorwayNoiseScale,
    colorwayNoiseMode: def.colorwayNoiseMode,
    colorwayNoiseOctaves: def.colorwayNoiseOctaves,
    colorwayNoisePersistence: def.colorwayNoisePersistence,
    colorwayNoiseLacunarity: def.colorwayNoiseLacunarity,
    colorwayNoiseBias: def.colorwayNoiseBias,
    colorwayNoiseX: def.colorwayNoiseX,
    colorwayBleedAnisotropy: def.colorwayBleedAnisotropy,
    colorwayBleedRotation: def.colorwayBleedRotation,
    colorwayBleedCrossFiber: def.colorwayBleedCrossFiber,
    colorwayBleedDraftCoupled: def.colorwayBleedDraftCoupled,
    colorwayIncludeMask: def.colorwayIncludeMask,
  };
}
