/**
 * ImageRectsHalftoneStage — Pipeline: Image → Image Rects (weave-oriented) → Halftone CMYK.
 * Renders ImageRectsCapture offscreen at capture resolution (image pixels, capped),
 * captures to a data URL on param change, then passes to HalftoneCmyk at **stage** size
 * (container viewport — same as WeavingHalftoneStage) so dots fill the main area.
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { HalftoneCmyk } from '@paper-design/shaders-react';
import { ImageRectsCapture } from './ImageRectsCapture';

const CAPTURE_DELAY_MS = 350; // re-capture after image load
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
  // Image Rects
  imageSource,
  gridSize,
  palette,
  bgShade,
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
  patternFit = 'fit',
  // Halftone
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
  /** Visible stage (HalftoneCmyk output) — tracks main area, like WeavingHalftoneStage. */
  const [stageDimensions, setStageDimensions] = useState({ width: 1280, height: 720 });
  /** Offscreen ImageRects render resolution — image pixels when loaded, else stage size. */
  const [captureDimensions, setCaptureDimensions] = useState({ width: 1280, height: 720 });
  const { width: stageW, height: stageH } = stageDimensions;
  const { width: captureW, height: captureH } = captureDimensions;
  const [capturedDataUrl, setCapturedDataUrl] = useState('');

  const MAX_CAPTURE = 2048;
  const handleImageSize = useCallback((w, h) => {
    if (!w || !h) return;
    const scale = Math.min(1, MAX_CAPTURE / Math.max(w, h));
    setCaptureDimensions({ width: Math.round(w * scale), height: Math.round(h * scale) });
  }, []);

  const capture = useCallback(() => {
    const canvas = canvasRef.current;
    if (!isCaptureReady(canvas, captureW, captureH)) return null;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      setCapturedDataUrl(dataUrl);
      return dataUrl;
    } catch {
      return null;
    }
  }, [captureW, captureH]);

  const handleCanvasRef = useCallback((el) => {
    canvasRef.current = el;
    if (el) scheduleCaptureWhenReady(canvasRef, captureW, captureH, capture);
  }, [capture, captureW, captureH]);

  // Capture when params or capture resolution change.
  useEffect(() => {
    return scheduleCaptureWhenReady(canvasRef, captureW, captureH, capture);
  }, [
    imageSource,
    gridSize,
    palette,
    bgShade,
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
    capture,
    captureW,
    captureH,
  ]);

  // Delayed capture when image URL changes (async load).
  useEffect(() => {
    if (!imageSource) return;
    const t = setTimeout(() => scheduleCaptureWhenReady(canvasRef, captureW, captureH, capture), CAPTURE_DELAY_MS);
    return () => clearTimeout(t);
  }, [imageSource, capture, captureW, captureH]);

  // HalftoneCmyk mounts canvas asynchronously; sync it into halftoneCanvasRef for copy in App.
  useEffect(() => {
    if (!capturedDataUrl || !halftoneContainerRef?.current || !halftoneCanvasRef) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 120; // ~2s at 60fps
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

  // Stage size from container (Halftone output fills viewport).
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

  // Without an image, render/capture at stage size so placeholder rects match the viewport.
  useEffect(() => {
    if (!imageSource) {
      setCaptureDimensions(stageDimensions);
    }
  }, [imageSource, stageDimensions]);

  return (
    <div ref={containerRef} className="flex h-full min-h-0 flex-1 w-full">
      {/* Offscreen image rects canvas. */}
      <div
        aria-hidden
        className="absolute overflow-hidden"
        style={{ left: '-9999px', top: 0, width: captureW, height: captureH }}
      >
        <ImageRectsCapture
          width={captureW}
          height={captureH}
          imageSource={imageSource}
          gridSize={gridSize}
          palette={palette}
          bgShade={bgShade}
          rectColorSource={rectColorSource}
          quantizeSteps={quantizeSteps}
          quantizeMode={quantizeMode}
          quantizeGamma={quantizeGamma}
          quantizeDither={quantizeDither}
          rectShade={rectShade}
          shadeFrom={shadeFrom}
          patternWarpShade={patternWarpShade}
          patternWeftShade={patternWeftShade}
          patternIndex={patternIndex}
          patterns={patterns ?? []}
          rectRadius={rectRadius}
          rectAspect={rectAspect}
          rectRatio={rectRatio}
          lumaSizeMix={lumaSizeMix}
          lumaSizeInvert={lumaSizeInvert}
          lumaSizeFloor={lumaSizeFloor}
          cellGeometryMode={cellGeometryMode}
          stitchLumaMax={stitchLumaMax}
          onCanvasRef={handleCanvasRef}
          onImageSize={handleImageSize}
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
          <div className="flex h-full w-full items-center justify-center text-text-muted">
            {imageSource ? 'Preparing…' : 'Pick an image above'}
          </div>
        )}
      </div>
    </div>
  );
}
