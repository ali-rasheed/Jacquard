/**
 * ImageRectsCapture — Headless image-rects canvas for pipeline capture.
 * Renders the image→rects shader (weave pattern orients rects) at given width×height
 * and forwards the canvas ref for toDataURL(). No chrome (FPS, border). Used by
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
  colorizeMode,
  quantizeSteps,
  rectShade,
  shadeFrom,
  patternIndex,
  patterns,
  rectRadius,
  rectAspect,
  rectRatio,
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
    colorizeMode ?? true,
    quantizeSteps ?? 0,
    rectShade ?? 1,
    shadeFrom ?? 0,
    patternIndex ?? 0,
    patterns ?? PATTERNS,
    rectRadius ?? 0.18,
    rectAspect ?? 0.85,
    rectRatio ?? 1.0,
    undefined,
    onImageSize
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
