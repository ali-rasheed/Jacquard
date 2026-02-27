/**
 * ShaderCanvas — WebGL canvas that renders the shader.
 * Sources: src/shaders/vertex.glsl, src/shaders/fragment.glsl. Edit those files directly.
 * Styled with Tailwind; memoized to avoid re-renders when only fps changes.
 */
import { memo } from 'react';
import { useShaderSandbox } from '../hooks/useShaderSandbox';
import fragmentSource from '../shaders/fragment.glsl?raw';
import vertexSource from '../shaders/vertex.glsl?raw';

function ShaderCanvasInner({ patternIndex, palette, bgShade, warpShade, weftShade, gridSize, patterns, onFpsChange }) {
  const { canvasRef, containerRef, error, fps } = useShaderSandbox(
    vertexSource,
    fragmentSource,
    patternIndex ?? 0,
    palette ?? 0,
    bgShade ?? 2,
    warpShade ?? 1,
    weftShade ?? 3,
    gridSize ?? 32,
    patterns ?? [],
    onFpsChange
  );

  return (
    <div
      ref={containerRef}
      className="relative flex  flex-initial flex-col overflow-hidden rounded-md border border-border-subtle bg-surface-secondary w-100"
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

export const ShaderCanvas = memo(ShaderCanvasInner);
