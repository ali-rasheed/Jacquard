/**
 * ImageRectsCanvas — V2 only. Renders the image-to-colored-rects shader.
 * Weave pattern (from patterns/index.js) sets rect orientation per cell (warp/weft).
 */
import { memo } from 'react';
import { useImageRectsSandbox } from '../hooks/useImageRectsSandbox';
import fragmentSource from '../shaders/fragmentImageRects.glsl?raw';
import vertexSource from '../shaders/vertex.glsl?raw';
import { PATTERNS } from '../patterns';
import { fpsPill } from '../uiConstants';

/**
 * Container aspect ratio follows the loaded image so the canvas is not stretched.
 * When no image is loaded, fallback is 1:1.
 * patternFit: 'fill' = container fills view; 'fit' = container fits inside view.
 */
function ImageRectsCanvasInner({ imageSource, gridSize, palette, bgShade, colorizeMode, quantizeSteps, rectShade, shadeFrom, patternIndex, patterns, rectRadius, rectAspect, rectRatio, patternFit = 'fit', onFpsChange, onCanvasRef, onCaptureReady }) {
  const { canvasRef, containerRef, error, fps, imageSize } = useImageRectsSandbox(
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
    onFpsChange,
    undefined,
    onCaptureReady
  );

  const aspectRatio = imageSize
    ? `${imageSize.width} / ${imageSize.height}`
    : '1 / 1';

  const fill = patternFit === 'fill';
  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col overflow-hidden rounded-md border border-border-subtle bg-surface-secondary w-100 ${fill ? 'flex-1 min-h-0 min-w-0' : 'flex-initial'}`}
      style={{ aspectRatio }}
    >
      <canvas ref={(el) => { canvasRef.current = el; onCanvasRef?.(el); }} className="block flex-1 bg-surface" />
      <div className={fpsPill}>
        {fps || '--'} fps
      </div>
      {error ? (
        <div className="absolute bottom-0 left-0 right-0 max-h-[120px] overflow-y-auto border-t border-border-subtle bg-surface-elevated p-3 font-mono text-xs leading-snug text-error">
          {error}
        </div>
      ) : null}
    </div>
  );
}

export const ImageRectsCanvas = memo(ImageRectsCanvasInner);
