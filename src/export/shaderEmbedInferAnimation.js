/**
 * Animation driver inference for Weaving embed exports.
 * Keeps defaults conservative while allowing each driver to be switched
 * between auto and controlled in generated snippets.
 */

export const DRIVER_ORDER = [
  'time',
  'shimmerTime',
  'stitchProgress',
  'colorwayNoiseScale',
  'colorwayNoiseOctaves',
  'colorwayNoisePersistence',
  'colorwayNoiseLacunarity',
  'colorwayNoiseBias',
  'colorwayNoiseX',
  'colorwayBleedAnisotropy',
  'colorwayBleedRotation',
  'colorwayBleedCrossFiber',
  'colorwayBleedDraftCoupled',
];

const COLORWAY_PLAY_TO_DRIVER = {
  noiseScale: 'colorwayNoiseScale',
  octaves: 'colorwayNoiseOctaves',
  persistence: 'colorwayNoisePersistence',
  lacunarity: 'colorwayNoiseLacunarity',
  bias: 'colorwayNoiseBias',
  noiseX: 'colorwayNoiseX',
  bleedAnisotropy: 'colorwayBleedAnisotropy',
  bleedRotation: 'colorwayBleedRotation',
  bleedCrossFiber: 'colorwayBleedCrossFiber',
  bleedDraftCoupled: 'colorwayBleedDraftCoupled',
};

/**
 * @param {Record<string, unknown>} state
 * @param {{
 *   smartAuto?: boolean,
 *   isKeyframePlaying?: boolean,
 *   shimmerPlaying?: boolean,
 *   staticMode?: boolean,
 *   colorwayAnimPlaying?: Record<string, boolean>,
 * }} options
 */
export function inferShaderEmbedDrivers(state, options = {}) {
  const smartAuto = options.smartAuto !== false;
  const isKeyframePlaying = !!options.isKeyframePlaying;
  const shimmerPlaying = options.shimmerPlaying !== false;
  const staticMode = !!options.staticMode;
  const colorwayAnimPlaying = options.colorwayAnimPlaying || {};

  const auto = new Set();
  if (!staticMode) {
    // u_time is always meaningful for this fragment shader family.
    auto.add('time');

    if (smartAuto && Number(state?.shimmer) > 0 && shimmerPlaying) {
      auto.add('shimmerTime');
    }
    if (smartAuto && Number(state?.weaveStitchRevealMode) > 0 && isKeyframePlaying) {
      auto.add('stitchProgress');
    }
    if (smartAuto && Number(state?.useAllColorways) > 0) {
      Object.entries(COLORWAY_PLAY_TO_DRIVER).forEach(([key, driver]) => {
        if (colorwayAnimPlaying[key]) auto.add(driver);
      });
    }
  }

  return DRIVER_ORDER.map((driver) => ({
    driver,
    mode: auto.has(driver) ? 'auto' : 'controlled',
  }));
}

/**
 * Which embed drivers use the frame clock (`auto`) vs fixed props (`controlled`).
 * @returns {Record<string, boolean>}
 */
export function getShaderEmbedDriverAuto(state, options = {}) {
  const list = inferShaderEmbedDrivers(state, options);
  return Object.fromEntries(list.map((d) => [d.driver, d.mode === 'auto']));
}

/** Compact bitmask from DRIVER_ORDER (bit i => DRIVER_ORDER[i] is auto). */
export function getShaderEmbedDriverAutoBits(state, options = {}) {
  const list = inferShaderEmbedDrivers(state, options);
  let n = 0;
  list.forEach((d, i) => {
    if (d.mode === 'auto') n |= 1 << i;
  });
  return n;
}

