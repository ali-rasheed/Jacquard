/**
 * useCanvasRecorder — record a <canvas> as WebM or MP4.
 *
 * WebM: MediaRecorder + captureStream (all browsers).
 * MP4:  WebCodecs VideoEncoder + mp4-muxer (Chrome/Edge 94+, Safari 16.4+).
 *       mp4-muxer is lazy-imported on first MP4 record to keep the bundle lean.
 *
 * WebGL: callers should call gl.finish() after draw (see useImageRectsSandbox / useShaderSandbox)
 * so VideoFrame and captureStream see completed frames.
 *
 * MP4: the capture rAF loop shares one session object with stopRecording. During stop, we mark
 * session inactive/stopping before flush+close so in-flight rAF ticks can bail without surfacing
 * harmless "closed codec" encode errors.
 *
 * Usage:
 *   const rec = useCanvasRecorder('shaderbox');
 *   <button onClick={() => rec.startRecording(canvasEl)}>Record</button>
 *   <button onClick={() => rec.startRecording(canvasEl, { reason: 'auto' })}>Auto</button>
 *   <button onClick={rec.stopRecording}>Stop</button>
 */
/* global VideoEncoder, VideoFrame */
import { useState, useRef, useCallback, useEffect } from 'react';

const FPS = 30;
const BITRATE = 5_000_000;
const KEYFRAME_INTERVAL_S = 2;
const VIDEO_EXPORT_SCALE = 2;
/** MP4 tries 2x first, then falls back if encoder caps are lower on this device/browser. */
const MP4_EXPORT_SCALES = [VIDEO_EXPORT_SCALE, 1.5, 1, 0.75, 0.5];
/** Frequent chunks + final blob on stop; avoids sparse data on short clips. */
const WEBM_TIMESLICE_MS = 250;
/** Prefer higher H.264 levels for large canvases; fall back to lower levels. */
const AVC_CODEC_CANDIDATES = [
  'avc1.640033', // High Profile, Level 5.1
  'avc1.640032', // High Profile, Level 5.0
  'avc1.64002A', // High Profile, Level 4.2
  'avc1.640028', // High Profile, Level 4.0
];

function pickWebMMimeType() {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

async function pickSupportedAvcConfig(baseConfig) {
  if (typeof VideoEncoder?.isConfigSupported !== 'function') {
    return { ...baseConfig, codec: AVC_CODEC_CANDIDATES[0] };
  }
  for (const codec of AVC_CODEC_CANDIDATES) {
    try {
      const query = await VideoEncoder.isConfigSupported({ ...baseConfig, codec });
      if (query?.supported) return query.config ?? { ...baseConfig, codec };
    } catch {
      // Ignore and keep trying lower-priority codecs/levels.
    }
  }
  return null;
}

/**
 * Some browsers emit `metadata.decoderConfig = null` (or null colorSpace), which can crash
 * mp4-muxer internals that expect an object. Normalize metadata before muxing.
 */
function normalizeMuxerMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const decoderConfig = metadata.decoderConfig;
  if (!decoderConfig || typeof decoderConfig !== 'object') return undefined;
  const normalizedDecoderConfig = { ...decoderConfig };
  if (normalizedDecoderConfig.colorSpace == null) delete normalizedDecoderConfig.colorSpace;
  return { ...metadata, decoderConfig: normalizedDecoderConfig };
}

function makeRecordingCanvas(sourceCanvas, { scale = VIDEO_EXPORT_SCALE, forceEven = false } = {}) {
  const canvas = document.createElement('canvas');
  let width = Math.max(2, Math.round(sourceCanvas.width * scale));
  let height = Math.max(2, Math.round(sourceCanvas.height * scale));
  if (forceEven) {
    if (width % 2 !== 0) width -= 1;
    if (height % 2 !== 0) height -= 1;
  }
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: true });
  return { canvas, ctx, width, height };
}

export const supportsMP4 = typeof VideoEncoder !== 'undefined';

export function useCanvasRecorder(filePrefix = 'shaderbox') {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordFormat, setRecordFormat] = useState(supportsMP4 ? 'mp4' : 'webm');
  /** When set, show a Download link — required on many browsers after async encode. */
  const [pendingDownload, setPendingDownload] = useState(null);
  const [recordError, setRecordError] = useState(null);
  /** Mosaic auto-record vs user-started. */
  const [recordingReason, setRecordingReason] = useState(null);

  const webmRef = useRef(null);
  const mp4Ref = useRef(null);
  const stopRecordingRef = useRef(async () => {});

  /* ── WebM (MediaRecorder) ─────────────────────────────── */
  const startWebm = useCallback(
    (canvas) => {
      setRecordError(null);
      if (typeof canvas.captureStream !== 'function') {
        setRecordError('Recording: canvas.captureStream is not supported.');
        return;
      }
      if (!canvas.width || !canvas.height) {
        setRecordError('Recording: canvas has zero size — wait for the view to render.');
        return;
      }
      const mimeType = pickWebMMimeType();
      if (!mimeType) {
        setRecordError('Recording: no supported WebM codec in this browser.');
        return;
      }
      const { canvas: recordingCanvas, ctx } = makeRecordingCanvas(canvas);
      if (!ctx) {
        setRecordError('Recording: failed to create 2D context for WebM export.');
        return;
      }
      ctx.drawImage(canvas, 0, 0, recordingCanvas.width, recordingCanvas.height);
      const stream = recordingCanvas.captureStream(FPS);
      let recorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: BITRATE });
      } catch (e) {
        setRecordError(`Recording: MediaRecorder failed — ${e?.message ?? 'unknown'}`);
        return;
      }
      const session = {
        recorder,
        stream,
        raf: 0,
        active: true,
        sourceCanvas: canvas,
        recordingCanvas,
        ctx,
      };
      const pump = () => {
        if (!session.active) return;
        try {
          session.ctx.drawImage(session.sourceCanvas, 0, 0, session.recordingCanvas.width, session.recordingCanvas.height);
        } catch {
          /* ignore transient draw errors while source canvas is resizing */
        }
        session.raf = requestAnimationFrame(pump);
      };
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onerror = (e) => {
        console.error('useCanvasRecorder: MediaRecorder error', e);
        session.active = false;
        if (session.raf) cancelAnimationFrame(session.raf);
        session.raf = 0;
        setRecordError('Recording: encoder error — try WebM or reload the page.');
        setIsRecording(false);
        setRecordingReason(null);
      };
      recorder.onstop = () => {
        session.active = false;
        if (session.raf) cancelAnimationFrame(session.raf);
        session.raf = 0;
        const blob = new Blob(chunks, { type: mimeType });
        const filename = `${filePrefix}-${Date.now()}.webm`;
        stream.getTracks().forEach((t) => { try { t.stop(); } catch { /* ignore */ } });
        if (webmRef.current === session) webmRef.current = null;
        if (!blob.size) {
          setRecordError('Recording: no video data — record a bit longer or try MP4.');
          setIsRecording(false);
          setRecordingReason(null);
          return;
        }
        setPendingDownload({ blob, filename, mimeType });
        setIsRecording(false);
        setRecordingReason(null);
      };
      recorder.start(WEBM_TIMESLICE_MS);
      session.raf = requestAnimationFrame(pump);
      webmRef.current = session;
      setIsRecording(true);
    },
    [filePrefix],
  );

  /* ── MP4 (VideoEncoder + mp4-muxer) ──────────────────── */
  const startMp4 = useCallback(
    async (canvas) => {
      setRecordError(null);
      if (!supportsMP4) {
        setRecordError('Recording: MP4 not supported in this browser — choose WebM.');
        return;
      }
      if (!canvas.width || !canvas.height) {
        setRecordError('Recording: canvas has zero size — wait for the view to render.');
        return;
      }
      const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');

      let selectedSurface = null;
      let selectedEncoderConfig = null;
      for (const scale of MP4_EXPORT_SCALES) {
        const surface = makeRecordingCanvas(canvas, { scale, forceEven: true });
        if (!surface.ctx) continue;
        const baseEncoderConfig = {
          width: surface.width,
          height: surface.height,
          bitrate: BITRATE,
          framerate: FPS,
        };
        const encoderConfig = await pickSupportedAvcConfig(baseEncoderConfig);
        if (!encoderConfig) continue;
        selectedSurface = surface;
        selectedEncoderConfig = encoderConfig;
        break;
      }
      if (!selectedSurface || !selectedEncoderConfig) {
        setRecordError('Recording: MP4 encoder does not support this canvas size. Try WebM or reduce canvas size.');
        return;
      }
      const { canvas: recordingCanvas, ctx: recordingCtx, width: w, height: h } = selectedSurface;
      recordingCtx.drawImage(canvas, 0, 0, w, h);

      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: { codec: 'avc', width: w, height: h },
        fastStart: 'in-memory',
      });

      const encoder = new VideoEncoder({
        output: (chunk, meta) => {
          try {
            const normalizedMeta = normalizeMuxerMetadata(meta);
            muxer.addVideoChunk(chunk, normalizedMeta);
          } catch (e) {
            console.error('useCanvasRecorder: addVideoChunk failed', e);
            setRecordError(`Recording failed: ${e?.message ?? 'muxer metadata error'}`);
          }
        },
        error: (e) => console.error('VideoEncoder error:', e),
      });

      encoder.configure(selectedEncoderConfig);

      let frameCount = 0;
      const frameDuration = 1_000_000 / FPS;
      let lastTime = 0;

      /** Session: keep one object so stop can set `active=false` before flush/close; rAF must not encode after close. */
      const session = {
        encoder,
        muxer,
        target,
        raf: 0,
        active: true,
        stopping: false,
        sourceCanvas: canvas,
        recordingCanvas,
        recordingCtx,
      };

      const capture = (now) => {
        if (!session.active || !mp4Ref.current || mp4Ref.current !== session) return;
        if (encoder.state === 'closed') return;
        if (now - lastTime >= 1000 / FPS) {
          lastTime = now;
          if (!session.active || encoder.state === 'closed') return;
          let frame = null;
          try {
            session.recordingCtx.drawImage(session.sourceCanvas, 0, 0, w, h);
            frame = new VideoFrame(session.recordingCanvas, { timestamp: frameCount * frameDuration });
            encoder.encode(frame, { keyFrame: frameCount % (FPS * KEYFRAME_INTERVAL_S) === 0 });
            frameCount++;
          } catch (e) {
            const msg = String(e?.message ?? '');
            const closedCodecRace =
              !session.active ||
              session.stopping ||
              mp4Ref.current !== session ||
              encoder.state === 'closed' ||
              /closed codec/i.test(msg);
            if (closedCodecRace) {
              return;
            }
            console.error('useCanvasRecorder: VideoFrame encode failed', e);
            setRecordError(`Recording encode error: ${e?.message ?? 'unknown'}`);
            session.active = false;
            if (session.raf) cancelAnimationFrame(session.raf);
            session.raf = 0;
            try {
              encoder.close();
            } catch { /* ignore */ }
            if (mp4Ref.current === session) mp4Ref.current = null;
            setIsRecording(false);
            setRecordingReason(null);
            return;
          } finally {
            if (frame) {
              try {
                frame.close();
              } catch {
                /* ignore */
              }
            }
          }
        }
        if (!session.active || !mp4Ref.current || mp4Ref.current !== session) return;
        if (encoder.state === 'closed') return;
        session.raf = requestAnimationFrame(capture);
      };

      mp4Ref.current = session;
      session.raf = requestAnimationFrame(capture);
      setIsRecording(true);
    },
    [],
  );

  /* ── Public API ───────────────────────────────────────── */
  const startRecording = useCallback(
    (canvas, options = {}) => {
      const reason = options.reason === 'auto' ? 'auto' : 'manual';
      setRecordError(null);
      if (webmRef.current != null || mp4Ref.current != null) {
        return;
      }
      if (!canvas) {
        setRecordError('Recording: no canvas — open a view with a canvas first.');
        return;
      }
      setRecordingReason(reason);
      if (recordFormat === 'mp4') startMp4(canvas);
      else startWebm(canvas);
    },
    [recordFormat, startMp4, startWebm],
  );

  const clearPendingDownload = useCallback(() => {
    setPendingDownload(null);
  }, []);

  const clearRecordError = useCallback(() => {
    setRecordError(null);
  }, []);

  const stopRecording = useCallback(async () => {
    if (recordFormat === 'mp4' && mp4Ref.current) {
      const session = mp4Ref.current;
      const { encoder, muxer, target, raf } = session;
      /** Stop capture loop first so no rAF tick calls encode() after flush/close. */
      session.active = false;
      session.stopping = true;
      if (mp4Ref.current === session) mp4Ref.current = null;
      if (raf) cancelAnimationFrame(raf);
      session.raf = 0;
      setIsProcessing(true);
      setRecordError(null);
      try {
        if (encoder.state !== 'closed') {
          await encoder.flush();
        }
        muxer.finalize();
        try {
          if (encoder.state !== 'closed') encoder.close();
        } catch { /* ignore */ }
        const blob = new Blob([target.buffer], { type: 'video/mp4' });
        const filename = `${filePrefix}-${Date.now()}.mp4`;
        if (!blob.size) {
          setRecordError('Recording: empty MP4 — try recording longer or use WebM.');
        } else {
          setPendingDownload({ blob, filename, mimeType: 'video/mp4' });
        }
      } catch (e) {
        console.error('useCanvasRecorder: MP4 finalize failed', e);
        setRecordError(`Recording failed: ${e?.message ?? 'unknown error'}`);
      } finally {
        setIsProcessing(false);
        setIsRecording(false);
        setRecordingReason(null);
      }
    } else if (webmRef.current) {
      const session = webmRef.current;
      session.active = false;
      if (session.raf) cancelAnimationFrame(session.raf);
      session.raf = 0;
      if (session.recorder.state === 'recording') {
        session.recorder.stop();
      } else {
        session.stream.getTracks().forEach((t) => { try { t.stop(); } catch { /* ignore */ } });
        if (webmRef.current === session) webmRef.current = null;
        setIsRecording(false);
        setRecordingReason(null);
      }
    }
  }, [recordFormat, filePrefix]);

  stopRecordingRef.current = stopRecording;

  useEffect(() => () => {
    void stopRecordingRef.current();
  }, []);

  return {
    isRecording,
    isProcessing,
    recordFormat,
    setRecordFormat,
    startRecording,
    stopRecording,
    pendingDownload,
    clearPendingDownload,
    recordError,
    clearRecordError,
    recordingReason,
  };
}
