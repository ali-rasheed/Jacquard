/**
 * ImageRectsHalftoneStage — Pipeline: Image → Image Rects (weave-oriented) → Halftone CMYK.
 * Renders ImageRectsCapture offscreen at main-area size, captures to data URL on param change
 * (and after a short delay when image URL changes for async load), then passes to HalftoneCmyk.
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { HalftoneCmyk } from '@paper-design/shaders-react';
import { ImageRectsCapture } from './ImageRectsCapture';

const CAPTURE_DELAY_MS = 350; // re-capture after image load
const WEB_GL_ATTRS = { preserveDrawingBuffer: true };

export function ImageRectsHalftoneStage({
  // Image Rects
  imageSource,
  gridSize,
  palette,
  bgShade,
  colorizeMode,
  quantizeSteps,
  rectShade,
  shadeFrom,
  patternIndex,
  patterns,
  rectRadius,
  rectAspect,
  rectRatio,
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
  const [dimensions, setDimensions] = useState({ width: 1280, height: 720 });
  const [capturedDataUrl, setCapturedDataUrl] = useState('');

  /** Use image resolution and aspect for capture; cap longest side to avoid huge canvases. */
  const MAX_CAPTURE = 2048;
  const handleImageSize = useCallback((w, h) => {
    if (!w || !h) return;
    const scale = Math.min(1, MAX_CAPTURE / Math.max(w, h));
    setDimensions({ width: Math.round(w * scale), height: Math.round(h * scale) });
  }, []);

  const capture = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width || !canvas.height) return null;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      setCapturedDataUrl(dataUrl);
      return dataUrl;
    } catch {
      return null;
    }
  }, []);

  const handleCanvasRef = useCallback((el) => {
    canvasRef.current = el;
    if (el) {
      requestAnimationFrame(() => {
        if (el.width && el.height) {
          try {
            setCapturedDataUrl(el.toDataURL('image/png'));
          } catch {
            // ignore
          }
        }
      });
    }
  }, []);

  // Capture when params change.
  useEffect(() => {
    if (!canvasRef.current) return;
    const id = requestAnimationFrame(() => capture());
    return () => cancelAnimationFrame(id);
  }, [
    imageSource,
    gridSize,
    palette,
    bgShade,
    colorizeMode,
    quantizeSteps,
    shadeFrom,
    patternIndex,
    rectRadius,
    rectAspect,
    rectRatio,
    capture,
  ]);

  // Delayed capture when image URL changes (async load).
  useEffect(() => {
    if (!imageSource) return;
    const t = setTimeout(() => capture(), CAPTURE_DELAY_MS);
    return () => clearTimeout(t);
  }, [imageSource, capture]);

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

  // Fallback: size from container when no image has reported dimensions yet.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || 1280;
      const h = el.clientHeight || 720;
      setDimensions((prev) => {
        // Only use container size if we never got image dimensions (e.g. no image loaded).
        if (prev.width === 1280 && prev.height === 720 && w && h) return { width: w, height: h };
        return prev;
      });
    });
    ro.observe(el);
    const w = el.clientWidth || 1280;
    const h = el.clientHeight || 720;
    if (w && h) setDimensions((prev) => (prev.width === 1280 && prev.height === 720 ? { width: w, height: h } : prev));
    return () => ro.disconnect();
  }, []);

  const { width, height } = dimensions;

  return (
    <div ref={containerRef} className="flex h-full min-h-0 flex-1 w-full">
      {/* Offscreen image rects canvas. */}
      <div
        aria-hidden
        className="absolute overflow-hidden"
        style={{ left: '-9999px', top: 0, width, height }}
      >
        <ImageRectsCapture
          width={width}
          height={height}
          imageSource={imageSource}
          gridSize={gridSize}
          palette={palette}
          bgShade={bgShade}
          colorizeMode={colorizeMode}
          quantizeSteps={quantizeSteps}
          rectShade={rectShade}
          shadeFrom={shadeFrom}
          patternIndex={patternIndex}
          patterns={patterns ?? []}
          rectRadius={rectRadius}
          rectAspect={rectAspect}
          rectRatio={rectRatio}
          onCanvasRef={handleCanvasRef}
          onImageSize={handleImageSize}
        />
      </div>

      <div ref={halftoneContainerRef} className="relative min-h-0 flex-1 bg-surface-secondary size-full">
        {capturedDataUrl ? (
          <HalftoneCmyk
            width={width}
            height={height}
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
            fit="cover"
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
