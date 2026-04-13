/**
 * ImageRectsCapture — Headless image-rects canvas for pipeline capture.
 * Renders the image→rects shader (weave pattern orients rects; optional luma-driven size)
 * at given width×height and forwards the canvas ref for toDataURL(). Used by
 * ImageRectsHalftoneStage to feed HalftoneCmyk.
 */
import { useCallback } from 'react';
import { useImageRectsSandbox } from '../hooks/useImageRectsSandbox';
import fragmentSource from '../shaders/fragmentImageRects.glsl?raw';
import vertexSource from '../shaders/vertex.glsl?raw';
import { PATTERNS } from '../patterns';

export function ImageRectsCapture({
  width,
  height,
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
  onCanvasRef,
  onImageSize,
}) {
  const { canvasRef, containerRef } = useImageRectsSandbox(
    vertexSource,
    fragmentSource,
    imageSource ?? '',
    gridSize ?? 32,
    palette ?? 0,
    bgShade ?? 2,
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
    0,
    undefined,
    onImageSize,
    undefined,
    'staticImage'
  );

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
