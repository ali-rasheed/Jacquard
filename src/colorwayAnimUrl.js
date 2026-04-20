/**
 * Compact URL encoding for colorway sidebar “play” toggles (lacunarity, seed, …).
 * Bit order is stable: add new keys only at the end of COLORWAY_ANIM_KEY_ORDER.
 */

/** Key order = bit index; keep in sync with `COLORWAY_ANIM_INITIAL` in App.jsx. */
export const COLORWAY_ANIM_KEY_ORDER = [
  'seed',
  'noiseScale',
  'noiseMode',
  'includeMask',
  'octaves',
  'persistence',
  'lacunarity',
  'bias',
  'noiseX',
  'bleedAnisotropy',
  'bleedRotation',
  'bleedCrossFiber',
  'bleedDraftCoupled',
];

const MAX_MASK = (1 << COLORWAY_ANIM_KEY_ORDER.length) - 1;

/** @param {Record<string, boolean>} playing */
export function encodeColorwayAnimPlaying(playing) {
  let bits = 0;
  COLORWAY_ANIM_KEY_ORDER.forEach((k, i) => {
    if (playing[k]) bits |= 1 << i;
  });
  return bits;
}

/** @returns {number} Mask 0…MAX_MASK */
export function clampColorwayAnimBits(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_MASK, Math.floor(n)));
}

/** @param {number} bits */
export function decodeColorwayAnimBitsToPartial(bits) {
  const b = clampColorwayAnimBits(bits);
  const out = {};
  COLORWAY_ANIM_KEY_ORDER.forEach((k, i) => {
    out[k] = !!(b & (1 << i));
  });
  return out;
}
