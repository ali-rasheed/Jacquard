/**
 * WeavingHalftoneStage — Renders weaving as the image source for Halftone CMYK.
 * Renders a hidden ShaderCanvas, captures it to a data URL (on param change + throttled when
 * shimmer is on), and passes the URL to HalftoneCmyk. Main area shows only the halftone result.
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { HalftoneCmyk } from '@paper-design/shaders-react';
import { ShaderCanvas } from './ShaderCanvas';
import { RECT_ASPECT_DEFAULT } from '../constants';

const CAPTURE_THROTTLE_MS = 120; // ~8 fps when shimmer is animating
const WEB_GL_ATTRS = { preserveDrawingBuffer: true };

export function WeavingHalftoneStage({
  patterns,
  patternIndex,
  palette,
  bgShade,
  warpShade,
  weftShade,
  gridSize,
  warpGradient,
  weftGradient,
  gradSteps,
  rectAspect,
  cornerRadius,
  canvasAspect,
  patternFit = 'fit',
  shimmer,
  shimmerSpeed,
  shimmerPlaying,
  shimmerPausedAtTime,
  shimmerPhase,
  onShimmerTime,
  shimmerWidth,
  shimmerIntensity,
  shimmerPosition,
  shimmerRotation,
  shimmerNoise,
  shimmerNoiseSeed,
  shimmerNoiseMin,
  shimmerNoiseMax,
  shimmerBlendMode,
  useAllColorways,
  colorwaySeed,
  // Halftone params
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
  /** When set, use this as halftone source instead of captured weaving (e.g. image from desktop). */
  customImageUrl,
}) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 1280, height: 720 });
  const weavingCanvasRef = useRef(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState('');
  const rafRef = useRef(null);

  const capture = useCallback(() => {
    const canvas = weavingCanvasRef.current;
    if (!canvas || !canvas.width || !canvas.height) return null;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      setCapturedDataUrl(dataUrl);
      return dataUrl;
    } catch {
      return null;
    }
  }, []);

  // Capture once when canvas is ready or weaving params change (non-shimmer).
  useEffect(() => {
    if (!weavingCanvasRef.current) return;
    const id = requestAnimationFrame(() => {
      capture();
    });
    return () => cancelAnimationFrame(id);
  }, [
    patternIndex,
    palette,
    bgShade,
    warpShade,
    weftShade,
    gridSize,
    warpGradient,
    weftGradient,
    gradSteps,
    rectAspect,
    cornerRadius,
    canvasAspect,
    useAllColorways,
    colorwaySeed,
    shimmer,
    shimmerSpeed,
    shimmerWidth,
    shimmerIntensity,
    shimmerPosition,
    shimmerRotation,
    shimmerNoise,
    shimmerNoiseSeed,
    shimmerNoiseMin,
    shimmerNoiseMax,
    shimmerBlendMode,
    capture,
  ]);

  // Throttled capture loop when shimmer is on.
  useEffect(() => {
    if (!shimmer) return;
    let last = 0;
    const tick = (now) => {
      rafRef.current = requestAnimationFrame(tick);
      if (now - last < CAPTURE_THROTTLE_MS) return;
      last = now;
      if (weavingCanvasRef.current?.width) capture();
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [shimmer, capture]);

  const handleCanvasRef = useCallback((el) => {
    weavingCanvasRef.current = el;
    if (el) {
      requestAnimationFrame(() => {
        if (el.width && el.height) {
          try {
            setCapturedDataUrl(el.toDataURL('image/png'));
          } catch {
            // ignore canvas tainted or other capture errors
          }
        }
      });
    }
  }, []);

  // Paper mounts the halftone canvas asynchronously; keep halftoneCanvasRef in sync for copy.
  useEffect(() => {
    if ((!customImageUrl && !capturedDataUrl) || !halftoneContainerRef?.current || !halftoneCanvasRef) return;
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
      halftoneCanvasRef.current = null;
    };
  }, [customImageUrl, capturedDataUrl, halftoneCanvasRef, halftoneContainerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w && h) setDimensions({ width: w, height: h });
    });
    ro.observe(el);
    const w = el.clientWidth || 1280;
    const h = el.clientHeight || 720;
    if (w && h) setDimensions({ width: w, height: h });
    return () => ro.disconnect();
  }, []);

  const { width, height } = dimensions;

  return (
    <div ref={containerRef} className="flex h-full min-h-0 flex-1 w-full">
      {/* Offscreen weaving canvas; same props as main Weaving view. */}
      <div
        aria-hidden
        className="absolute overflow-hidden"
        style={{
          left: '-9999px',
          top: 0,
          width,
          height,
        }}
      >
        <ShaderCanvas
          patternFit={patternFit}
          patternIndex={patternIndex}
          palette={palette}
          bgShade={bgShade}
          warpShade={warpShade}
          weftShade={weftShade}
          gridSize={gridSize}
          warpGradient={warpGradient}
          weftGradient={weftGradient}
          gradSteps={gradSteps}
          rectAspect={rectAspect ?? RECT_ASPECT_DEFAULT}
          cornerRadius={cornerRadius ?? 0.18}
          canvasAspect={canvasAspect ?? 1}
          shimmer={shimmer}
          shimmerSpeed={shimmerSpeed}
          shimmerPlaying={shimmerPlaying}
          shimmerPausedAtTime={shimmerPausedAtTime}
          shimmerPhase={shimmerPhase}
          onShimmerTime={onShimmerTime}
          shimmerWidth={shimmerWidth}
          shimmerIntensity={shimmerIntensity}
          shimmerPosition={shimmerPosition}
          shimmerRotation={shimmerRotation}
          shimmerNoise={shimmerNoise}
          shimmerNoiseSeed={shimmerNoiseSeed}
          shimmerNoiseMin={shimmerNoiseMin}
          shimmerNoiseMax={shimmerNoiseMax}
          shimmerBlendMode={shimmerBlendMode}
          useAllColorways={useAllColorways}
          colorwaySeed={colorwaySeed}
          patterns={patterns ?? []}
          onCanvasRef={handleCanvasRef}
        />
      </div>

      {/* Main: HalftoneCmyk using custom image or captured weaving. Fallback placeholder if no source yet. */}
      <div ref={halftoneContainerRef} className="relative min-h-0 flex-1 bg-surface-secondary size-full">
        {(customImageUrl || capturedDataUrl) ? (
          <HalftoneCmyk
            width={width}
            height={height}
            image={customImageUrl || capturedDataUrl}
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
            Preparing…
          </div>
        )}
      </div>
    </div>
  );
}
