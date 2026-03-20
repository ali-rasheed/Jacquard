/**
 * ShaderCanvas — WebGL canvas that renders the shader.
 * Sources: src/shaders/vertex.glsl, src/shaders/fragment.glsl. Edit those files directly.
 * Styled with Tailwind; memoized to avoid re-renders when only fps changes.
 */
import { memo } from 'react';
import { useShaderSandbox } from '../hooks/useShaderSandbox';
import fragmentSource from '../shaders/fragment.glsl?raw';
import vertexSource from '../shaders/vertex.glsl?raw';
import { RECT_ASPECT_DEFAULT } from '../constants';
import { fpsPill } from '../uiConstants';

/** patternFit: 'fill' = container grows to fill view (cover); 'fit' = container shrinks to fit (contain). */
function ShaderCanvasInner({ patternIndex, palette, bgShade, warpShade, weftShade, gridSize, warpGradient, weftGradient, gradSteps, rectAspect, cornerRadius = 0.18, canvasAspect = 1, patternFit = 'fit', shimmer = false, shimmerSpeed = 2, shimmerWidth = 2, shimmerIntensity = 0.25, shimmerPosition = 0, shimmerRotation = 0.125, shimmerNoise = 0.3, shimmerNoiseSeed = 0, shimmerNoiseMin = 0.5, shimmerNoiseMax = 1.5, shimmerBlendMode = 0, useAllColorways = false, colorwaySeed = 0, colorwayNoiseScale = 1, shimmerPlaying = true, shimmerPausedAtTime = 0, shimmerPhase = 0, onShimmerTime, patterns, onFpsChange, onCanvasRef, onCaptureReady }) {
  const { canvasRef, containerRef, error, fps } = useShaderSandbox(
    vertexSource,
    fragmentSource,
    patternIndex ?? 0,
    palette ?? 0,
    bgShade ?? 2,
    warpShade ?? 1,
    weftShade ?? 3,
    gridSize ?? 32,
    warpGradient ?? null,
    weftGradient ?? null,
    gradSteps ?? 0,
    rectAspect ?? RECT_ASPECT_DEFAULT,
    cornerRadius ?? 0.18,
    shimmer ? 1 : 0,
    shimmerSpeed ?? 2,
    shimmerWidth ?? 2,
    shimmerIntensity ?? 0.25,
    shimmerPosition ?? 0,
    shimmerRotation ?? 0.125,
    shimmerNoise ?? 0.3,
    shimmerNoiseSeed ?? 0,
    shimmerNoiseMin ?? 0.5,
    shimmerNoiseMax ?? 1.5,
    shimmerBlendMode ?? 0,
    useAllColorways ? 1 : 0,
    colorwaySeed ?? 0,
    colorwayNoiseScale ?? 1,
    shimmerPlaying ?? true,
    shimmerPausedAtTime ?? 0,
    shimmerPhase ?? 0,
    onShimmerTime ?? undefined,
    patterns ?? [],
    onFpsChange,
    onCaptureReady
  );

  const fill = patternFit === 'fill';
  return (
    <div
      ref={containerRef}
      className={`relative flex min-h-[200px] min-w-[200px] flex-col overflow-hidden rounded-md border border-border-subtle bg-surface-secondary w-full max-w-full ${fill ? 'flex-1 min-h-0 min-w-0' : 'flex-initial'}`}
      style={{ aspectRatio: canvasAspect }}
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

export const ShaderCanvas = memo(ShaderCanvasInner);
