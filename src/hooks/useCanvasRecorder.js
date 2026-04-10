/**
 * useCanvasRecorder — record a <canvas> as WebM or MP4.
 *
 * WebM: MediaRecorder + captureStream (all browsers).
 * MP4:  WebCodecs VideoEncoder + mp4-muxer (Chrome/Edge 94+, Safari 16.4+).
 *       mp4-muxer is lazy-imported on first MP4 record to keep the bundle lean.
 *
 * Usage:
 *   const rec = useCanvasRecorder('shaderbox');
 *   <button onClick={() => rec.startRecording(canvasEl)}>Record</button>
 *   <button onClick={rec.stopRecording}>Stop</button>
 */
/* global VideoEncoder, VideoFrame */
import { useState, useRef, useCallback } from 'react';

const FPS = 30;
const BITRATE = 5_000_000;
const KEYFRAME_INTERVAL_S = 2;

export const supportsMP4 = typeof VideoEncoder !== 'undefined';

export function useCanvasRecorder(filePrefix = 'shaderbox') {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordFormat, setRecordFormat] = useState(supportsMP4 ? 'mp4' : 'webm');
  /** When set, show a Download link — required on many browsers after async encode. */
  const [pendingDownload, setPendingDownload] = useState(null);
  const [recordError, setRecordError] = useState(null);

  const webmRef = useRef(null);
  const mp4Ref = useRef(null);

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
      const stream = canvas.captureStream(FPS);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: BITRATE });
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const filename = `${filePrefix}-${Date.now()}.webm`;
        if (!blob.size) {
          setRecordError('Recording: no video data — record for a bit longer or try another format.');
          setIsRecording(false);
          return;
        }
        setPendingDownload({ blob, filename, mimeType });
        setIsRecording(false);
      };
      recorder.start(1000);
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

      const capture = (now) => {
        if (!mp4Ref.current) return;
        if (now - lastTime >= 1000 / FPS) {
          lastTime = now;
          try {
            const frame = new VideoFrame(canvas, { timestamp: frameCount * frameDuration });
            encoder.encode(frame, { keyFrame: frameCount % (FPS * KEYFRAME_INTERVAL_S) === 0 });
            frame.close();
            frameCount++;
          } catch (e) {
            console.error('useCanvasRecorder: VideoFrame encode failed', e);
            setRecordError(`Recording encode error: ${e?.message ?? 'unknown'}`);
            try {
              encoder.close();
            } catch { /* ignore */ }
            cancelAnimationFrame(mp4Ref.current?.raf);
            mp4Ref.current = null;
            setIsRecording(false);
            return;
          }
        }
        mp4Ref.current.raf = requestAnimationFrame(capture);
      };

      mp4Ref.current = { encoder, muxer, target, raf: requestAnimationFrame(capture) };
      setIsRecording(true);
    },
    [],
  );

  /* ── Public API ───────────────────────────────────────── */
  const startRecording = useCallback(
    (canvas) => {
      setRecordError(null);
      if (!canvas) {
        setRecordError('Recording: no canvas — open a view with a canvas first.');
        return;
      }
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
      const { encoder, muxer, target, raf } = mp4Ref.current;
      cancelAnimationFrame(raf);
      mp4Ref.current = null;
      setIsProcessing(true);
      setRecordError(null);
      try {
        await encoder.flush();
        muxer.finalize();
        try {
          encoder.close();
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
      }
    } else if (webmRef.current?.state === 'recording') {
      webmRef.current.stop();
      webmRef.current = null;
    }
  }, [recordFormat, filePrefix]);

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
  };
}
