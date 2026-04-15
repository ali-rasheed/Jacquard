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
 * MP4: the capture rAF loop shares one session object with stopRecording — set session.active=false
 * and cancel rAF before encoder.flush/close so no tick calls encode() on a closed codec.
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
/** Frequent chunks + final blob on stop; avoids sparse data on short clips. */
const WEBM_TIMESLICE_MS = 250;

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
      const stream = canvas.captureStream(FPS);
      let recorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: BITRATE });
      } catch (e) {
        setRecordError(`Recording: MediaRecorder failed — ${e?.message ?? 'unknown'}`);
        return;
      }
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onerror = (e) => {
        console.error('useCanvasRecorder: MediaRecorder error', e);
        setRecordError('Recording: encoder error — try WebM or reload the page.');
        setIsRecording(false);
        setRecordingReason(null);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const filename = `${filePrefix}-${Date.now()}.webm`;
        stream.getTracks().forEach((t) => { try { t.stop(); } catch { /* ignore */ } });
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
      webmRef.current = recorder;
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

      const w = canvas.width % 2 === 0 ? canvas.width : canvas.width - 1;
      const h = canvas.height % 2 === 0 ? canvas.height : canvas.height - 1;

      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: { codec: 'avc', width: w, height: h },
        fastStart: 'in-memory',
      });

      const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => console.error('VideoEncoder error:', e),
      });

      encoder.configure({
        codec: 'avc1.640028',
        width: w,
        height: h,
        bitrate: BITRATE,
        framerate: FPS,
      });

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
        canvas,
      };

      const capture = (now) => {
        if (!session.active || !mp4Ref.current || mp4Ref.current !== session) return;
        if (encoder.state === 'closed') return;
        if (now - lastTime >= 1000 / FPS) {
          lastTime = now;
          if (!session.active || encoder.state === 'closed') return;
          try {
            const frame = new VideoFrame(session.canvas, { timestamp: frameCount * frameDuration });
            encoder.encode(frame, { keyFrame: frameCount % (FPS * KEYFRAME_INTERVAL_S) === 0 });
            frame.close();
            frameCount++;
          } catch (e) {
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
        if (mp4Ref.current === session) mp4Ref.current = null;
        if (!blob.size) {
          setRecordError('Recording: empty MP4 — try recording longer or use WebM.');
        } else {
          setPendingDownload({ blob, filename, mimeType: 'video/mp4' });
        }
      } catch (e) {
        console.error('useCanvasRecorder: MP4 finalize failed', e);
        setRecordError(`Recording failed: ${e?.message ?? 'unknown error'}`);
        if (mp4Ref.current === session) mp4Ref.current = null;
      } finally {
        setIsProcessing(false);
        setIsRecording(false);
        setRecordingReason(null);
      }
    } else if (webmRef.current) {
      const rec = webmRef.current;
      if (rec.state === 'recording') {
        rec.stop();
      }
      webmRef.current = null;
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
