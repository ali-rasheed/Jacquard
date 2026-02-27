/**
 * ImageRectsCanvas — V2 only. Renders the image-to-colored-rects shader.
 * Uses useImageRectsSandbox; accepts imageSource (URL string) and gridSize.
 */
import { memo } from 'react';
import { useImageRectsSandbox } from '../hooks/useImageRectsSandbox';
import fragmentSource from '../shaders/fragmentImageRects.glsl?raw';
import vertexSource from '../shaders/vertex.glsl?raw';

function ImageRectsCanvasInner({ imageSource, gridSize, onFpsChange }) {
  const { canvasRef, containerRef, error, fps } = useImageRectsSandbox(
    vertexSource,
    fragmentSource,
    imageSource ?? '',
    gridSize ?? 32,
    onFpsChange
  );

  return (
    <div
      ref={containerRef}
      className="relative flex flex-initial flex-col overflow-hidden rounded-md border border-border-subtle bg-surface-secondary w-100"
      style={{ aspectRatio: '1 / 1' }}
    >
      <canvas ref={canvasRef} className="block flex-1 bg-surface" />
      <div className="absolute right-2 top-2 rounded-full border border-border-subtle bg-surface-elevated px-2.5 py-0.5 font-mono text-[12px] font-medium text-text-secondary">
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
