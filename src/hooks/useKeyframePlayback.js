/**
 * Before/after keyframe playback: linear numeric blend; booleans / strings switch at midpoint (t >= 0.5).
 * Drives live state via applySnapshot; optional onProgress for uniforms (e.g. stitch reveal).
 */
import { useState, useRef, useCallback, useEffect } from 'react';

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function interpolateValue(a, b, t) {
  if (a === b) return a;
  if (typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b)) {
    return a + (b - a) * t;
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return t >= 0.5 ? b : a;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return t >= 0.5 ? b : a;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const out = {};
    for (const k of keys) {
      if (!(k in a) || !(k in b)) {
        out[k] = t >= 0.5 ? (k in b ? b[k] : a[k]) : (k in a ? a[k] : b[k]);
        continue;
      }
      out[k] = interpolateValue(a[k], b[k], t);
    }
    return out;
  }
  return t >= 0.5 ? b : a;
}

function blendSnapshots(before, after, t) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out = {};
  for (const k of keys) {
    if (!(k in before)) {
      out[k] = after[k];
      continue;
    }
    if (!(k in after)) {
      out[k] = before[k];
      continue;
    }
    out[k] = interpolateValue(before[k], after[k], t);
  }
  return out;
}

export function useKeyframePlayback({
  getBefore,
  getAfter,
  applySnapshot,
  onProgress,
  defaultDurationSec = 2,
}) {
  const [editingAfter, setEditingAfter] = useState(false);
  const [before, setBefore] = useState(() => getBefore());
  const [after, setAfter] = useState(() => getAfter());
  const [durationSec, setDurationSec] = useState(defaultDurationSec);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playToken, setPlayToken] = useState(0);
  const rafRef = useRef(0);
  const recordStopRef = useRef(null);

  const syncBeforeFromLive = useCallback(() => {
    setBefore(getBefore());
  }, [getBefore]);

  const syncAfterFromLive = useCallback(() => {
    setAfter(getAfter());
  }, [getAfter]);

  const cancelPlaybackOnly = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    cancelPlaybackOnly();
    const fn = recordStopRef.current;
    recordStopRef.current = null;
    if (fn) void fn();
  }, [cancelPlaybackOnly]);

  useEffect(() => () => {
    cancelPlaybackOnly();
    const fn = recordStopRef.current;
    recordStopRef.current = null;
    if (fn) void fn();
  }, [cancelPlaybackOnly]);

  const play = useCallback(() => {
    cancelPlaybackOnly();
    setIsPlaying(true);
    setPlayToken((x) => x + 1);
    const start = performance.now();
    const durMs = Math.max(50, durationSec * 1000);
    const tick = (now) => {
      const u = Math.min(1, (now - start) / durMs);
      const snap = blendSnapshots(before, after, u);
      applySnapshot(snap);
      onProgress?.(u);
      if (u < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = 0;
        setIsPlaying(false);
        const fn = recordStopRef.current;
        recordStopRef.current = null;
        if (fn) void fn();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [before, after, durationSec, applySnapshot, onProgress, cancelPlaybackOnly]);

  /**
   * Start recording, then begin playback on next frame so frame 0 matches t=0.
   * @param {(canvas: HTMLCanvasElement | null) => void} startRecording
   * @param {() => Promise<void>} stopRecording
   * @param {() => HTMLCanvasElement | null} getCanvas
   */
  const playAndRecord = useCallback((startRecording, stopRecording, getCanvas) => {
    stop();
    const canvas = getCanvas?.() ?? null;
    startRecording(canvas);
    recordStopRef.current = stopRecording;
    requestAnimationFrame(() => {
      play();
    });
  }, [stop, play]);

  return {
    editingAfter,
    setEditingAfter,
    before,
    setBefore,
    after,
    setAfter,
    durationSec,
    setDurationSec,
    isPlaying,
    playToken,
    syncBeforeFromLive,
    syncAfterFromLive,
    play,
    playAndRecord,
    stop,
  };
}
