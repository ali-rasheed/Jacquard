/**
 * Tile art (Mosaic rectColorSource=3): eight-slot luma ramp into PATTERNS indices.
 * Default order sorts weaves by tile area (simple → busy). Slots 0–7 map dark → light bands.
 */
import { PATTERNS } from './index.js';

export const TILE_ART_SLOT_COUNT = 8;

/** Fixed mini-cell grid when uniform tile size is on (matches shader `TILE_ART_UNIFORM_*`). */
export const TILE_ART_UNIFORM_TILE_W = 8;
export const TILE_ART_UNIFORM_TILE_H = 8;

/** Max patterns in atlas (uniform / meta texture sizing). */
export const PATTERN_META_TEX_WIDTH = 32;

export function patternComplexityScore(pat) {
  return (pat?.tileW ?? 1) * (pat?.tileH ?? 1);
}

/** PATTERNS indices, simplest weave first; first TILE_ART_SLOT_COUNT used as default ramp. */
export function buildComplexityOrderedPatternIndices(patterns = PATTERNS) {
  const indices = patterns.map((_, i) => i);
  indices.sort((a, b) => patternComplexityScore(patterns[a]) - patternComplexityScore(patterns[b]));
  return indices;
}

export function buildDefaultTileArtRamp(patterns = PATTERNS) {
  const ordered = buildComplexityOrderedPatternIndices(patterns);
  const ramp = [];
  for (let s = 0; s < TILE_ART_SLOT_COUNT; s++) {
    const idx = ordered[Math.min(s, ordered.length - 1)];
    ramp.push(idx);
  }
  return ramp;
}

export const DEFAULT_TILE_ART_RAMP = buildDefaultTileArtRamp(PATTERNS);

/** Build 1×N RGBA meta texture: R = tileW, G = tileH (0–255, max 8×10). */
export function buildPatternMetaTexture(patterns = PATTERNS) {
  const w = PATTERN_META_TEX_WIDTH;
  const data = new Uint8Array(w * 4);
  patterns.forEach((pat, i) => {
    if (i >= w) return;
    data[i * 4] = Math.min(255, Math.round((pat.tileW ?? 1) * (255 / 8)));
    data[i * 4 + 1] = Math.min(255, Math.round((pat.tileH ?? 1) * (255 / 10)));
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 255;
  });
  return { data, width: w, height: 1 };
}

export function normalizeTileArtRamp(ramp, patternCount = PATTERNS.length) {
  const out = [...DEFAULT_TILE_ART_RAMP];
  const maxIdx = Math.max(0, patternCount - 1);
  if (!Array.isArray(ramp)) return out;
  for (let i = 0; i < TILE_ART_SLOT_COUNT; i++) {
    const v = ramp[i];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[i] = Math.max(0, Math.min(maxIdx, Math.round(v)));
    }
  }
  return out;
}

/** Parse URL `tar=0,3,5,...` (eight ints). */
export function parseTileArtRampParam(raw, patternCount = PATTERNS.length) {
  if (raw == null || raw === '') return null;
  const parts = String(raw).split(',').map((s) => Number(s.trim()));
  if (parts.length < 1 || parts.some((n) => !Number.isFinite(n))) return null;
  const ramp = [];
  for (let i = 0; i < TILE_ART_SLOT_COUNT; i++) {
    ramp.push(parts[Math.min(i, parts.length - 1)]);
  }
  return normalizeTileArtRamp(ramp, patternCount);
}

export function serializeTileArtRamp(ramp, defaults = DEFAULT_TILE_ART_RAMP) {
  const a = normalizeTileArtRamp(ramp);
  const b = normalizeTileArtRamp(defaults);
  if (a.every((v, i) => v === b[i])) return null;
  return a.join(',');
}

export function moveRampSlot(ramp, fromIndex, direction) {
  const next = [...normalizeTileArtRamp(ramp)];
  const to = fromIndex + direction;
  if (to < 0 || to >= TILE_ART_SLOT_COUNT) return next;
  const tmp = next[fromIndex];
  next[fromIndex] = next[to];
  next[to] = tmp;
  return next;
}
