/**
 * ImageRectsCapture — Headless image-rects canvas for pipeline capture.
 * Same shader uniforms as ImageRectsCanvas; fixed width×height for HalftoneCmyk capture.
 */
import { useCallback, useEffect } from 'react';
import { useImageRectsSandbox } from '../hooks/useImageRectsSandbox';
import fragmentSource from '../shaders/fragmentImageRects.glsl?raw';
import vertexSource from '../shaders/vertex.glsl?raw';
import { PATTERNS } from '../patterns';

export function ImageRectsCapture({
  width,
  height,
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
  onCanvasRef,
  onImageSize,
  onMediaReady,
  onCaptureError,
}) {
  const { canvasRef, containerRef, error } = useImageRectsSandbox(
    vertexSource,
    fragmentSource,
    imageSource ?? '',
    gridSize ?? 32,
    palette ?? 0,
    bgShade ?? 2,
    bgColorMode ?? 0,
    bgCustomColor ?? '#f2f2f2',
    rectColorSource ?? 1,
    quantizeSteps ?? 0,
    quantizeMode ?? 0,
    quantizeGamma ?? 1,
    quantizeDither ?? 0,
    rectShade ?? 1,
    shadeFrom ?? 0,
    patternWarpShade ?? 1,
    patternWeftShade ?? 3,
    patternIndex ?? 0,
    patterns ?? PATTERNS,
    rectRadius ?? 0.18,
    rectAspect ?? 0.85,
    rectRatio ?? 1.0,
    lumaSizeMix ?? 0,
    lumaSizeInvert ?? 0,
    lumaSizeFloor ?? 0.2,
    cellGeometryMode ?? 0,
    stitchLumaMax ?? 0.42,
    nonStitchShowsBg ? 1 : 0,
    stitchRevealMode ?? 0,
    stitchRevealProgress ?? 1,
    stitchRevealSeed ?? 0,
    stitchRevealScale ?? 0.12,
    stitchRevealNoiseScale ?? 1,
    stitchRevealSoftness ?? 0.06,
    stitchRevealBleedAnisotropy ?? 3,
    stitchRevealBleedRotation ?? 0,
    stitchRevealBleedCrossFiber ?? 0.2,
    stitchRevealBleedDraftCoupled ?? 0,
    tileArtLevels ?? 8,
    tileArtThreshold ?? 1,
    tileArtDither ?? 0,
    tileArtColorMode ?? 0,
    tileArtGeom ?? 1,
    tileArtUniformGrid ?? 1,
    tileArtDensity ?? 0,
    tileArtRamp,
    undefined,
    onImageSize,
    onMediaReady,
    undefined,
    mediaTextureKind
  );

  useEffect(() => {
    onCaptureError?.(error || '');
  }, [error, onCaptureError]);

  const setRef = useCallback(
    (el) => {
      canvasRef.current = el;
      onCanvasRef?.(el);
    },
    [onCanvasRef, canvasRef]
  );

  const w = Math.max(1, width ?? 1280);
  const h = Math.max(1, height ?? 720);

  return (
    <div
      ref={containerRef}
      style={{ width: w, height: h }}
      className="absolute overflow-hidden"
      aria-hidden
    >
      <canvas ref={setRef} className="block size-full" />
    </div>
  );
}
