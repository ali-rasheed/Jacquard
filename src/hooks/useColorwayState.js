/**
 * Colorway React state + rAF Play animations for Weave / Mosaic sidebars.
 * Pass `enableAnimation: false` when parent owns animation (embedded AppV2 in App shell).
 */
import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { WEAVING_URL_DEFAULTS } from '../urlDefaults';
import { decodeColorwayAnimBitsToPartial } from '../colorwayAnimUrl';
import {
  COLORWAY_ANIM_INITIAL,
  COLORWAY_SEED_LOOP_MS,
  COLORWAY_NOISE_X_PLAY_MIN,
  COLORWAY_NOISE_X_PLAY_MAX,
  colorwayIncludeMaskToStep,
  colorwayIncludeStepToMask,
  colorwayOscClamped,
  colorwaySweepClamped,
  snapColorwayBleedRotation,
  getColorwayDefaults,
} from '../colorwayUtils';

export function useColorwayState({ enableAnimation = true } = {}) {
  const [useAllColorways, setUseAllColorways] = useState(WEAVING_URL_DEFAULTS.useAllColorways);
  const [colorwaySeed, setColorwaySeed] = useState(WEAVING_URL_DEFAULTS.colorwaySeed);
  const [colorwayNoiseScale, setColorwayNoiseScale] = useState(WEAVING_URL_DEFAULTS.colorwayNoiseScale);
  const [colorwayNoiseMode, setColorwayNoiseMode] = useState(WEAVING_URL_DEFAULTS.colorwayNoiseMode);
  const [colorwayNoiseOctaves, setColorwayNoiseOctaves] = useState(WEAVING_URL_DEFAULTS.colorwayNoiseOctaves);
  const [colorwayNoisePersistence, setColorwayNoisePersistence] = useState(WEAVING_URL_DEFAULTS.colorwayNoisePersistence);
  const [colorwayNoiseLacunarity, setColorwayNoiseLacunarity] = useState(WEAVING_URL_DEFAULTS.colorwayNoiseLacunarity);
  const [colorwayNoiseBias, setColorwayNoiseBias] = useState(WEAVING_URL_DEFAULTS.colorwayNoiseBias);
  const [colorwayNoiseX, setColorwayNoiseX] = useState(WEAVING_URL_DEFAULTS.colorwayNoiseX);
  const [colorwayBleedAnisotropy, setColorwayBleedAnisotropy] = useState(WEAVING_URL_DEFAULTS.colorwayBleedAnisotropy);
  const [colorwayBleedRotation, setColorwayBleedRotation] = useState(WEAVING_URL_DEFAULTS.colorwayBleedRotation);
  const [colorwayBleedCrossFiber, setColorwayBleedCrossFiber] = useState(WEAVING_URL_DEFAULTS.colorwayBleedCrossFiber);
  const [colorwayBleedDraftCoupled, setColorwayBleedDraftCoupled] = useState(WEAVING_URL_DEFAULTS.colorwayBleedDraftCoupled);
  const [colorwayIncludeMask, setColorwayIncludeMask] = useState(WEAVING_URL_DEFAULTS.colorwayIncludeMask);
  const [colorwayAnimPlaying, setColorwayAnimPlaying] = useState(() => ({ ...COLORWAY_ANIM_INITIAL }));

  const colorwayAnimPlayingRef = useRef(colorwayAnimPlaying);
  colorwayAnimPlayingRef.current = colorwayAnimPlaying;
  const useAllColorwaysRef = useRef(useAllColorways);
  useAllColorwaysRef.current = useAllColorways;

  const colorwayStateRef = useRef({});
  colorwayStateRef.current = {
    seed: colorwaySeed,
    noiseScale: colorwayNoiseScale,
    noiseMode: colorwayNoiseMode,
    includeMask: colorwayIncludeMask,
    octaves: colorwayNoiseOctaves,
    persistence: colorwayNoisePersistence,
    lacunarity: colorwayNoiseLacunarity,
    bias: colorwayNoiseBias,
    noiseX: colorwayNoiseX,
    bleedAnisotropy: colorwayBleedAnisotropy,
    bleedRotation: colorwayBleedRotation,
    bleedCrossFiber: colorwayBleedCrossFiber,
    bleedDraftCoupled: colorwayBleedDraftCoupled,
  };

  const colorwayAnimMetaRef = useRef({});
  const prevColorwayPlayingRef = useRef({ ...COLORWAY_ANIM_INITIAL });

  useLayoutEffect(() => {
    if (!enableAnimation) return;
    const prev = prevColorwayPlayingRef.current;
    const next = colorwayAnimPlaying;
    const s = colorwayStateRef.current;
    for (const k of Object.keys(COLORWAY_ANIM_INITIAL)) {
      if (next[k] && !prev[k]) {
        colorwayAnimMetaRef.current[k] = { startMs: performance.now(), origin: s[k] };
      }
      if (!next[k]) delete colorwayAnimMetaRef.current[k];
    }
    prevColorwayPlayingRef.current = { ...next };
  }, [colorwayAnimPlaying, enableAnimation]);

  useEffect(() => {
    if (!enableAnimation) return;
    if (!Object.values(colorwayAnimPlaying).some(Boolean)) return;
    let frame;
    const tick = () => {
      const p = colorwayAnimPlayingRef.current;
      if (!Object.values(p).some(Boolean)) return;
      const go = useAllColorwaysRef.current;
      if (go) {
        const now = performance.now();
        const meta = colorwayAnimMetaRef.current;

        if (p.seed && meta.seed) {
          const t = now - meta.seed.startMs;
          const T = COLORWAY_SEED_LOOP_MS;
          const u = (t % T) / T;
          const o = Number(meta.seed.origin);
          setColorwaySeed(((o + u * 100) % 100 + 100) % 100);
        }
        if (p.noiseScale && meta.noiseScale) {
          const t = now - meta.noiseScale.startMs;
          const s = colorwayOscClamped(t, 48000, 0.005, 0.25, meta.noiseScale.origin);
          setColorwayNoiseScale(Number(s.toFixed(3)));
        }
        if (p.noiseMode && meta.noiseMode) {
          const t = now - meta.noiseMode.startMs;
          const o = Math.max(0, Math.min(2, Math.round(Number(meta.noiseMode.origin))));
          setColorwayNoiseMode((o + Math.floor(t / 5000)) % 3);
        }
        if (p.includeMask && meta.includeMask) {
          const t = now - meta.includeMask.startMs;
          const startStep = colorwayIncludeMaskToStep(meta.includeMask.origin);
          setColorwayIncludeMask(colorwayIncludeStepToMask(startStep + Math.floor(t / 1200)));
        }
        if (p.octaves && meta.octaves) {
          const t = now - meta.octaves.startMs;
          const o = Math.max(1, Math.min(4, Math.round(Number(meta.octaves.origin))));
          setColorwayNoiseOctaves((((o - 1 + Math.floor(t / 2000)) % 4) + 4) % 4 + 1);
        }
        if (p.persistence && meta.persistence) {
          const t = now - meta.persistence.startMs;
          setColorwayNoisePersistence(colorwayOscClamped(t, 50000, 0.15, 0.95, meta.persistence.origin));
        }
        if (p.lacunarity && meta.lacunarity) {
          const t = now - meta.lacunarity.startMs;
          setColorwayNoiseLacunarity(colorwayOscClamped(t, 56000, 1.05, 4, meta.lacunarity.origin));
        }
        if (p.bias && meta.bias) {
          const t = now - meta.bias.startMs;
          setColorwayNoiseBias(colorwaySweepClamped(t, 44000, 0.25, 4, meta.bias.origin));
        }
        if (p.noiseX && meta.noiseX) {
          const t = now - meta.noiseX.startMs;
          const nx = colorwayOscClamped(
            t,
            3_000_000,
            COLORWAY_NOISE_X_PLAY_MIN,
            COLORWAY_NOISE_X_PLAY_MAX,
            meta.noiseX.origin,
          );
          setColorwayNoiseX(Number(nx.toFixed(2)));
        }
        if (p.bleedAnisotropy && meta.bleedAnisotropy) {
          const t = now - meta.bleedAnisotropy.startMs;
          setColorwayBleedAnisotropy(colorwayOscClamped(t, 64000, 0.35, 12, meta.bleedAnisotropy.origin));
        }
        if (p.bleedRotation && meta.bleedRotation) {
          const t = now - meta.bleedRotation.startMs;
          setColorwayBleedRotation(
            snapColorwayBleedRotation(colorwayOscClamped(t, 70000, 0, 1, meta.bleedRotation.origin)),
          );
        }
        if (p.bleedCrossFiber && meta.bleedCrossFiber) {
          const t = now - meta.bleedCrossFiber.startMs;
          setColorwayBleedCrossFiber(colorwayOscClamped(t, 40000, 0, 1, meta.bleedCrossFiber.origin));
        }
        if (p.bleedDraftCoupled && meta.bleedDraftCoupled) {
          const t = now - meta.bleedDraftCoupled.startMs;
          const o = meta.bleedDraftCoupled.origin ? 1 : 0;
          setColorwayBleedDraftCoupled(((o + Math.floor(t / 3000)) & 1) === 1);
        }
      }
      if (Object.values(colorwayAnimPlayingRef.current).some(Boolean) && useAllColorwaysRef.current) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, [useAllColorways, colorwayAnimPlaying, enableAnimation]);

  const resetColorwayToDefaults = () => {
    const d = getColorwayDefaults();
    setUseAllColorways(d.useAllColorways);
    setColorwaySeed(d.colorwaySeed);
    setColorwayNoiseScale(d.colorwayNoiseScale);
    setColorwayNoiseMode(d.colorwayNoiseMode);
    setColorwayNoiseOctaves(d.colorwayNoiseOctaves);
    setColorwayNoisePersistence(d.colorwayNoisePersistence);
    setColorwayNoiseLacunarity(d.colorwayNoiseLacunarity);
    setColorwayNoiseBias(d.colorwayNoiseBias);
    setColorwayNoiseX(d.colorwayNoiseX);
    setColorwayBleedAnisotropy(d.colorwayBleedAnisotropy);
    setColorwayBleedRotation(d.colorwayBleedRotation);
    setColorwayBleedCrossFiber(d.colorwayBleedCrossFiber);
    setColorwayBleedDraftCoupled(d.colorwayBleedDraftCoupled);
    setColorwayIncludeMask(d.colorwayIncludeMask);
    setColorwayAnimPlaying({ ...COLORWAY_ANIM_INITIAL });
  };

  const applyColorwayFromUrl = (q) => {
    if (q.useAllColorways != null) setUseAllColorways(!!q.useAllColorways);
    if (q.colorwaySeed != null) setColorwaySeed(q.colorwaySeed);
    if (q.colorwayNoiseScale != null) setColorwayNoiseScale(q.colorwayNoiseScale);
    if (q.colorwayNoiseMode != null) setColorwayNoiseMode(Math.round(q.colorwayNoiseMode));
    if (q.colorwayNoiseOctaves != null) setColorwayNoiseOctaves(Math.round(q.colorwayNoiseOctaves));
    if (q.colorwayNoisePersistence != null) setColorwayNoisePersistence(q.colorwayNoisePersistence);
    if (q.colorwayNoiseLacunarity != null) setColorwayNoiseLacunarity(q.colorwayNoiseLacunarity);
    if (q.colorwayNoiseBias != null) setColorwayNoiseBias(q.colorwayNoiseBias);
    if (q.colorwayNoiseX != null) setColorwayNoiseX(q.colorwayNoiseX);
    if (q.colorwayBleedAnisotropy != null) setColorwayBleedAnisotropy(q.colorwayBleedAnisotropy);
    if (q.colorwayBleedRotation != null) setColorwayBleedRotation(snapColorwayBleedRotation(q.colorwayBleedRotation));
    if (q.colorwayBleedCrossFiber != null) setColorwayBleedCrossFiber(q.colorwayBleedCrossFiber);
    if (q.colorwayBleedDraftCoupled != null) setColorwayBleedDraftCoupled(!!q.colorwayBleedDraftCoupled);
    if (q.colorwayIncludeMask != null) setColorwayIncludeMask(Math.round(q.colorwayIncludeMask));
    if (q.colorwayPlayBits != null) {
      setColorwayAnimPlaying({ ...COLORWAY_ANIM_INITIAL, ...decodeColorwayAnimBitsToPartial(q.colorwayPlayBits) });
    }
  };

  return {
    useAllColorways,
    setUseAllColorways,
    colorwaySeed,
    setColorwaySeed,
    colorwayNoiseScale,
    setColorwayNoiseScale,
    colorwayNoiseMode,
    setColorwayNoiseMode,
    colorwayNoiseOctaves,
    setColorwayNoiseOctaves,
    colorwayNoisePersistence,
    setColorwayNoisePersistence,
    colorwayNoiseLacunarity,
    setColorwayNoiseLacunarity,
    colorwayNoiseBias,
    setColorwayNoiseBias,
    colorwayNoiseX,
    setColorwayNoiseX,
    colorwayBleedAnisotropy,
    setColorwayBleedAnisotropy,
    colorwayBleedRotation,
    setColorwayBleedRotation,
    colorwayBleedCrossFiber,
    setColorwayBleedCrossFiber,
    colorwayBleedDraftCoupled,
    setColorwayBleedDraftCoupled,
    colorwayIncludeMask,
    setColorwayIncludeMask,
    colorwayAnimPlaying,
    setColorwayAnimPlaying,
    resetColorwayToDefaults,
    applyColorwayFromUrl,
  };
}
