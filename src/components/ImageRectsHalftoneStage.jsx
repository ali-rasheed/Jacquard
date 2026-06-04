/**
 * ImageRectsHalftoneStage — Mosaic/Image rects → CMYK halftone (Print mode).
 * Offscreen capture at image resolution; HalftoneCmyk fills the stage viewport.
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { HalftoneCmyk } from '@paper-design/shaders-react';
import { ImageRectsCapture } from './ImageRectsCapture';

const CAPTURE_AFTER_MEDIA_MS = 80;
const CAPTURE_MAX_ATTEMPTS = 180;
const WEB_GL_ATTRS = { preserveDrawingBuffer: true };
const CAPTURE_DPR = 2;

function isCaptureReady(canvas, layoutW, layoutH) {
  if (!canvas || layoutW < 1 || layoutH < 1) return false;
  const minW = Math.round(layoutW * CAPTURE_DPR * 0.5);
  const minH = Math.round(layoutH * CAPTURE_DPR * 0.5);
  return canvas.width >= minW && canvas.height >= minH;
}

function scheduleCaptureWhenReady(canvasRef, layoutW, layoutH, capture, maxAttempts = 90) {
  let attempts = 0;
  let cancelled = false;
  const tick = () => {
    if (cancelled || attempts++ >= maxAttempts) return;
    if (isCaptureReady(canvasRef.current, layoutW, layoutH)) {
      capture();
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => {
    cancelled = true;
  };
}

export function ImageRectsHalftoneStage({
  imageSource,
  mediaTextureKind = 'staticImage',
  gridSize,
  palette,
  bgShade,
  bgColorMode = 0,
  bgCustomColor = '#f2f2f2',
  rectColorSource,
  quantizeSteps,
  quantizeMode,
  quantizeGamma,
  quantizeDither,
  rectShade,
  shadeFrom,
  patternWarpShade,
  patternWeftShade,
  patternIndex,
  patterns,
  rectRadius,
  rectAspect,
  rectRatio,
  lumaSizeMix,
  lumaSizeInvert,
  lumaSizeFloor,
  cellGeometryMode,
  stitchLumaMax,
  nonStitchShowsBg = false,
  stitchRevealMode = 0,
  stitchRevealProgress = 1,
  stitchRevealSeed = 0,
  stitchRevealScale = 0.12,
  stitchRevealNoiseScale = 1,
  stitchRevealSoftness = 0.06,
  stitchRevealBleedAnisotropy = 3,
  stitchRevealBleedRotation = 0,
  stitchRevealBleedCrossFiber = 0.2,
  stitchRevealBleedDraftCoupled = 0,
  tileArtLevels = 8,
  tileArtThreshold = 1,
  tileArtDither = 0,
  tileArtColorMode = 0,
  tileArtGeom = 1,
  tileArtUniformGrid = 1,
  tileArtDensity = 0,
  tileArtRamp,
  patternFit = 'fit',
  size,
  softness,
  gridNoise,
  contrast,
  type,
  colorBack,
  colorC,
  colorM,
  colorY,
  colorK,
  floodC,
  gainC,
  gainY,
  halftoneContainerRef,
  halftoneCanvasRef,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const pendingCaptureSizeRef = useRef({ w: 1280, h: 720 });
  const captureSizeRef = useRef({ w: 1280, h: 720 });
  const mediaReadyRef = useRef(false);
  const [captureError, setCaptureError] = useState('');
  const [stageDimensions, setStageDimensions] = useState({ width: 1280, height: 720 });
  const [captureDimensions, setCaptureDimensions] = useState({ width: 1280, height: 720 });
  const { width: stageW, height: stageH } = stageDimensions;
  const { width: captureW, height: captureH } = captureDimensions;
  const [capturedDataUrl, setCapturedDataUrl] = useState('');

  const MAX_CAPTURE = 2048;
  captureSizeRef.current = { w: captureW, h: captureH };

  const capture = useCallback(() => {
    if (!imageSource || !mediaReadyRef.current) return null;
    const canvas = canvasRef.current;
    const { w, h } = captureSizeRef.current;
    if (!isCaptureReady(canvas, w, h)) return null;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      setCapturedDataUrl(dataUrl);
      setCaptureError('');
      return dataUrl;
    } catch (err) {
      setCaptureError(err?.message || 'Capture failed');
      return null;
    }
  }, [imageSource]);

  const scheduleCapture = useCallback(() => {
    if (!imageSource || !mediaReadyRef.current) return undefined;
    const { w, h } = captureSizeRef.current;
    return scheduleCaptureWhenReady(canvasRef, w, h, capture, CAPTURE_MAX_ATTEMPTS);
  }, [imageSource, capture]);

  const handleImageSize = useCallback((w, h) => {
    if (!w || !h) return;
    const scale = Math.min(1, MAX_CAPTURE / Math.max(w, h));
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);
    pendingCaptureSizeRef.current = { w: cw, h: ch };
    captureSizeRef.current = { w: cw, h: ch };
    setCaptureDimensions({ width: cw, height: ch });
  }, []);

  const handleMediaReady = useCallback(() => {
    mediaReadyRef.current = true;
    const { w, h } = pendingCaptureSizeRef.current;
    captureSizeRef.current = { w, h };
    setTimeout(() => {
      scheduleCaptureWhenReady(canvasRef, w, h, capture, CAPTURE_MAX_ATTEMPTS);
    }, CAPTURE_AFTER_MEDIA_MS);
  }, [capture]);

  const handleCaptureError = useCallback((msg) => {
    setCaptureError(msg || '');
    setCapturedDataUrl('');
  }, []);

  const handleCanvasRef = useCallback((el) => {
    canvasRef.current = el;
    if (el && imageSource && mediaReadyRef.current) scheduleCapture();
  }, [imageSource, scheduleCapture]);

  useEffect(() => {
    mediaReadyRef.current = false;
    setCapturedDataUrl('');
    setCaptureError('');
  }, [imageSource]);

  useEffect(() => scheduleCapture(), [
    imageSource,
    mediaTextureKind,
    gridSize,
    palette,
    bgShade,
    bgColorMode,
    bgCustomColor,
    rectColorSource,
    quantizeSteps,
    quantizeMode,
    quantizeGamma,
    quantizeDither,
    shadeFrom,
    patternWarpShade,
    patternWeftShade,
    patternIndex,
    rectRadius,
    rectAspect,
    rectRatio,
    lumaSizeMix,
    lumaSizeInvert,
    lumaSizeFloor,
    cellGeometryMode,
    stitchLumaMax,
    nonStitchShowsBg,
    stitchRevealMode,
    stitchRevealProgress,
    stitchRevealSeed,
    stitchRevealScale,
    stitchRevealNoiseScale,
    stitchRevealSoftness,
    stitchRevealBleedAnisotropy,
    stitchRevealBleedRotation,
    stitchRevealBleedCrossFiber,
    stitchRevealBleedDraftCoupled,
    tileArtLevels,
    tileArtThreshold,
    tileArtDither,
    tileArtColorMode,
    tileArtGeom,
    tileArtUniformGrid,
    tileArtDensity,
    tileArtRamp,
    capture,
    captureW,
    captureH,
    scheduleCapture,
  ]);

  useEffect(() => {
    if (!capturedDataUrl || !halftoneContainerRef?.current || !halftoneCanvasRef) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 120;
    const findCanvas = () => {
      if (cancelled || attempts++ >= maxAttempts) return;
      const el = halftoneContainerRef.current;
      const canvas = el?.querySelector?.('canvas');
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        halftoneCanvasRef.current = canvas;
        return;
      }
      requestAnimationFrame(findCanvas);
    };
    findCanvas();
    return () => {
      cancelled = true;
      if (halftoneCanvasRef) halftoneCanvasRef.current = null;
    };
  }, [capturedDataUrl, halftoneContainerRef, halftoneCanvasRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const syncStage = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w && h) setStageDimensions({ width: w, height: h });
    };
    const ro = new ResizeObserver(syncStage);
    ro.observe(el);
    syncStage();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!imageSource) {
      setCaptureDimensions(stageDimensions);
      pendingCaptureSizeRef.current = { w: stageDimensions.width, h: stageDimensions.height };
    }
  }, [imageSource, stageDimensions]);

  const captureProps = {
    imageSource,
    mediaTextureKind,
    gridSize,
    palette,
    bgShade,
    bgColorMode,
    bgCustomColor,
    rectColorSource,
    quantizeSteps,
    quantizeMode,
    quantizeGamma,
    quantizeDither,
    rectShade,
    shadeFrom,
    patternWarpShade,
    patternWeftShade,
    patternIndex,
    patterns,
    rectRadius,
    rectAspect,
    rectRatio,
    lumaSizeMix,
    lumaSizeInvert,
    lumaSizeFloor,
    cellGeometryMode,
    stitchLumaMax,
    nonStitchShowsBg,
    stitchRevealMode,
    stitchRevealProgress,
    stitchRevealSeed,
    stitchRevealScale,
    stitchRevealNoiseScale,
    stitchRevealSoftness,
    stitchRevealBleedAnisotropy,
    stitchRevealBleedRotation,
    stitchRevealBleedCrossFiber,
    stitchRevealBleedDraftCoupled,
    tileArtLevels,
    tileArtThreshold,
    tileArtDither,
    tileArtColorMode,
    tileArtGeom,
    tileArtUniformGrid,
    tileArtDensity,
    tileArtRamp,
  };

  return (
    <div ref={containerRef} className="flex h-full min-h-0 flex-1 w-full">
      <div
        aria-hidden
        className="absolute overflow-hidden"
        style={{ left: '-9999px', top: 0, width: captureW, height: captureH }}
      >
        <ImageRectsCapture
          key={imageSource || 'no-image'}
          width={captureW}
          height={captureH}
          {...captureProps}
          onCanvasRef={handleCanvasRef}
          onImageSize={handleImageSize}
          onMediaReady={handleMediaReady}
          onCaptureError={handleCaptureError}
        />
      </div>

      <div ref={halftoneContainerRef} className="relative min-h-0 flex-1 bg-surface-secondary size-full">
        {capturedDataUrl ? (
          <HalftoneCmyk
            width={stageW}
            height={stageH}
            image={capturedDataUrl}
            colorBack={colorBack}
            colorC={colorC}
            colorM={colorM}
            colorY={colorY}
            colorK={colorK}
            size={size}
            gridNoise={gridNoise}
            type={type}
            softness={softness}
            contrast={contrast}
            floodC={floodC}
            floodM={0}
            floodY={0}
            floodK={0}
            gainC={gainC}
            gainM={0}
            gainY={gainY}
            gainK={0}
            grainMixer={0}
            grainOverlay={0}
            grainSize={0.5}
            fit={patternFit === 'fill' ? 'cover' : 'contain'}
            webGlContextAttributes={WEB_GL_ATTRS}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-4 text-center text-text-muted">
            {captureError ? (
              <span className="text-error text-sm">{captureError}</span>
            ) : (
              <span>{imageSource ? 'Preparing…' : 'Pick media above'}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
