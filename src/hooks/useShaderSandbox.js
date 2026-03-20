/**
 * useShaderSandbox — WebGL shader compilation and render loop.
 * Compiles vertex + fragment shaders, uploads fullscreen quad, runs animation loop.
 * Pattern data is uploaded as a texture; uniforms include u_tileW, u_tileH for the selected pattern.
 *
 * Shader source is read from refs so that code changes (e.g. HMR on .glsl save) only trigger
 * a program recompile, not a full canvas teardown and re-run.
 *
 * Optimizations (Vercel React): cache uniform locations (js-cache-property-access),
 * ref for onFpsChange to avoid effect churn (advanced-use-latest).
 */
import { useRef, useEffect, useCallback, useState } from 'react';
import { EXPORT_MAX_DIMENSION, RECT_ASPECT_DEFAULT } from '../constants';
import { buildPatternTexture, PATTERNS } from '../patterns';

const DPR = 2;

function getUniformLocs(gl, program) {
  return {
    time: gl.getUniformLocation(program, 'u_time'),
    resolution: gl.getUniformLocation(program, 'u_resolution'),
    patternSampler: gl.getUniformLocation(program, 'u_patternSampler'),
    patternIndex: gl.getUniformLocation(program, 'u_patternIndex'),
    tileW: gl.getUniformLocation(program, 'u_tileW'),
    tileH: gl.getUniformLocation(program, 'u_tileH'),
    patternTexHeight: gl.getUniformLocation(program, 'u_patternTexHeight'),
    palette: gl.getUniformLocation(program, 'u_palette'),
    bgShade: gl.getUniformLocation(program, 'u_bgShade'),
    warpShade: gl.getUniformLocation(program, 'u_warpShade'),
    weftShade: gl.getUniformLocation(program, 'u_weftShade'),
    gridSize: gl.getUniformLocation(program, 'u_gridSize'),
    warpStart: gl.getUniformLocation(program, 'u_warpStart'),
    warpEnd: gl.getUniformLocation(program, 'u_warpEnd'),
    weftStart: gl.getUniformLocation(program, 'u_weftStart'),
    weftEnd: gl.getUniformLocation(program, 'u_weftEnd'),
    warpDir: gl.getUniformLocation(program, 'u_warpDir'),
    weftDir: gl.getUniformLocation(program, 'u_weftDir'),
    warpStartPos: gl.getUniformLocation(program, 'u_warpStartPos'),
    warpEndPos: gl.getUniformLocation(program, 'u_warpEndPos'),
    weftStartPos: gl.getUniformLocation(program, 'u_weftStartPos'),
    weftEndPos: gl.getUniformLocation(program, 'u_weftEndPos'),
    gradSteps: gl.getUniformLocation(program, 'u_gradSteps'),
    revealStartTime: gl.getUniformLocation(program, 'u_revealStartTime'),
    rectAspect: gl.getUniformLocation(program, 'u_rectAspect'),
    cornerRadius: gl.getUniformLocation(program, 'u_cornerRadius'),
    shimmer: gl.getUniformLocation(program, 'u_shimmer'),
    shimmerSpeed: gl.getUniformLocation(program, 'u_shimmerSpeed'),
    shimmerTime: gl.getUniformLocation(program, 'u_shimmerTime'),
    shimmerPhase: gl.getUniformLocation(program, 'u_shimmerPhase'),
    shimmerWidth: gl.getUniformLocation(program, 'u_shimmerWidth'),
    shimmerIntensity: gl.getUniformLocation(program, 'u_shimmerIntensity'),
    shimmerPosition: gl.getUniformLocation(program, 'u_shimmerPosition'),
    shimmerRotation: gl.getUniformLocation(program, 'u_shimmerRotation'),
    shimmerNoise: gl.getUniformLocation(program, 'u_shimmerNoise'),
    shimmerNoiseSeed: gl.getUniformLocation(program, 'u_shimmerNoiseSeed'),
    shimmerNoiseMin: gl.getUniformLocation(program, 'u_shimmerNoiseMin'),
    shimmerNoiseMax: gl.getUniformLocation(program, 'u_shimmerNoiseMax'),
    shimmerBlendMode: gl.getUniformLocation(program, 'u_shimmerBlendMode'),
    useAllColorways: gl.getUniformLocation(program, 'u_useAllColorways'),
    colorwaySeed: gl.getUniformLocation(program, 'u_colorwaySeed'),
    colorwayNoiseScale: gl.getUniformLocation(program, 'u_colorwayNoiseScale'),
  };
}

const QUAD_POSITIONS = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

function compileShader(gl, source, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error:\n${log}`);
  }
  return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vs = compileShader(gl, vertexSource, gl.VERTEX_SHADER);
  const fs = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error:\n${log}`);
  }
  return program;
}

// ENS palette RGBA (0–1), matches shader getPaletteColor. [palette][shade] = [r,g,b,a]; shade 0–4 = 950,500,100,400,Transparent.
const PALETTE_RGBA = [
  [[0.247, 0.114, 0.035, 1], [0.596, 0.302, 0.106, 1], [0.973, 0.969, 0.886, 1], [0.855, 0.725, 0.525, 1], [0, 0, 0, 0]],
  [[0.322, 0.024, 0.141, 1], [0.941, 0.216, 0.576, 1], [0.984, 0.922, 0.941, 1], [0.988, 0.706, 0.812, 1], [0, 0, 0, 0]],
  [[0.008, 0.161, 0.231, 1], [0.0, 0.502, 0.737, 1], [0.902, 0.953, 0.973, 1], [0.455, 0.725, 0.875, 1], [0, 0, 0, 0]],
  [[0.012, 0.188, 0.063, 1], [0.0, 0.486, 0.137, 1], [0.843, 0.914, 0.89, 1], [0.51, 0.816, 0.561, 1], [0, 0, 0, 0]],
];

function getPaletteColor(paletteIndex, shadeIndex) {
  const p = Math.max(0, Math.min(3, Math.floor(paletteIndex)));
  const s = Math.max(0, Math.min(4, Math.floor(shadeIndex)));
  return PALETTE_RGBA[p][s];
}

export function useShaderSandbox(vertexSource, fragmentSource, patternIndex, palette, bgShade, warpShade, weftShade, gridSize, warpGradient, weftGradient, gradSteps, rectAspect, cornerRadius, shimmer, shimmerSpeed, shimmerWidth, shimmerIntensity, shimmerPosition, shimmerRotation, shimmerNoise, shimmerNoiseSeed, shimmerNoiseMin, shimmerNoiseMax, shimmerBlendMode, useAllColorways, colorwaySeed, colorwayNoiseScale, shimmerPlaying, shimmerPausedAtTime, shimmerPhase, onShimmerTime, patterns, onFpsChange, onCaptureReady) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const vertexSourceRef = useRef(vertexSource);
  const fragmentSourceRef = useRef(fragmentSource);
  const recompileRef = useRef(null);
  const prevShaderRef = useRef({ vertex: null, fragment: null });
  const warpGradientRef = useRef(warpGradient);
  const weftGradientRef = useRef(weftGradient);
  const onCaptureReadyRef = useRef(onCaptureReady);
  // When patterns is omitted, callers pass (..., onFpsChange) so the 7th arg is the callback
  const callback = typeof patterns === 'function' ? patterns : onFpsChange;
  const onFpsChangeRef = useRef(callback);
  onCaptureReadyRef.current = onCaptureReady;
  const shimmerPlayingRef = useRef(shimmerPlaying ?? true);
  const shimmerPausedAtTimeRef = useRef(shimmerPausedAtTime ?? 0);
  const shimmerPhaseRef = useRef(shimmerPhase ?? 0);
  const onShimmerTimeRef = useRef(onShimmerTime);
  const [error, setError] = useState('');
  const [fps, setFps] = useState(0);

  vertexSourceRef.current = vertexSource;
  fragmentSourceRef.current = fragmentSource;
  onFpsChangeRef.current = callback;
  warpGradientRef.current = warpGradient;
  weftGradientRef.current = weftGradient;

  const patternIndexRef = useRef(patternIndex);
  const paletteRef = useRef(palette);
  const bgShadeRef = useRef(bgShade);
  const warpShadeRef = useRef(warpShade);
  const weftShadeRef = useRef(weftShade);
  const gridSizeRef = useRef(gridSize);
  const gradStepsRef = useRef(gradSteps);
  const rectAspectRef = useRef(rectAspect);
  const cornerRadiusRef = useRef(cornerRadius);
  const shimmerRef = useRef(shimmer);
  const shimmerSpeedRef = useRef(shimmerSpeed);
  const shimmerWidthRef = useRef(shimmerWidth);
  const shimmerIntensityRef = useRef(shimmerIntensity);
  const shimmerPositionRef = useRef(shimmerPosition);
  const shimmerRotationRef = useRef(shimmerRotation);
  const shimmerNoiseRef = useRef(shimmerNoise);
  const shimmerNoiseSeedRef = useRef(shimmerNoiseSeed);
  const shimmerNoiseMinRef = useRef(shimmerNoiseMin);
  const shimmerNoiseMaxRef = useRef(shimmerNoiseMax);
  const shimmerBlendModeRef = useRef(shimmerBlendMode);
  const useAllColorwaysRef = useRef(useAllColorways);
  const colorwaySeedRef = useRef(colorwaySeed);
  const colorwayNoiseScaleRef = useRef(colorwayNoiseScale);
  patternIndexRef.current = patternIndex;
  paletteRef.current = palette;
  bgShadeRef.current = bgShade;
  warpShadeRef.current = warpShade;
  weftShadeRef.current = weftShade;
  gridSizeRef.current = gridSize;
  gradStepsRef.current = gradSteps ?? 0;
  rectAspectRef.current = rectAspect ?? RECT_ASPECT_DEFAULT;
  cornerRadiusRef.current = cornerRadius ?? 0.18;
  shimmerRef.current = shimmer ?? 0;
  shimmerSpeedRef.current = shimmerSpeed ?? 2.0;
  shimmerWidthRef.current = shimmerWidth ?? 2.0;
  shimmerIntensityRef.current = shimmerIntensity ?? 0.25;
  shimmerPositionRef.current = shimmerPosition ?? 0.0;
  shimmerRotationRef.current = shimmerRotation ?? 0.125; // 0.125 ≈ 45° (diagonal)
  shimmerNoiseRef.current = shimmerNoise ?? 0.3;
  shimmerNoiseSeedRef.current = shimmerNoiseSeed ?? 0;
  shimmerNoiseMinRef.current = shimmerNoiseMin ?? 0.5;
  shimmerNoiseMaxRef.current = shimmerNoiseMax ?? 1.5;
  shimmerBlendModeRef.current = shimmerBlendMode ?? 0;
  useAllColorwaysRef.current = useAllColorways ?? 0;
  colorwaySeedRef.current = colorwaySeed ?? 0;
  colorwayNoiseScaleRef.current = colorwayNoiseScale ?? 1;
  shimmerPlayingRef.current = shimmerPlaying ?? true;
  shimmerPausedAtTimeRef.current = shimmerPausedAtTime ?? 0;
  shimmerPhaseRef.current = shimmerPhase ?? 0;
  onShimmerTimeRef.current = onShimmerTime;

  useEffect(() => {
    onFpsChangeRef.current?.(fps);
  }, [fps]);

  const run = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const gl = canvas.getContext('webgl', { alpha: true, preserveDrawingBuffer: true }) || canvas.getContext('experimental-webgl', { alpha: true, preserveDrawingBuffer: true });
    if (!gl) {
      setError('WebGL is not supported');
      return;
    }

    setError('');

    let program = null;
    let positionBuffer = null;
    let patternTexture = null;
    let animationId = null;
    let resizeObserver = null;
    let startTime = Date.now();
    let lastFrameTime = Date.now();
    let frameCount = 0;
    let uniformLocs = null;
    let patternTexHeight = 0;
    let revealStartTime = 0;
    let lastPatternIndex = -1;
    const list = Array.isArray(patterns) ? patterns : PATTERNS;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const w = rect.width * DPR;
      const h = rect.height * DPR;
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      gl.viewport(0, 0, w, h);
    };

    const setupGeometry = () => {
      positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, QUAD_POSITIONS, gl.STATIC_DRAW);
    };

    const render = () => {
      if (!program || !uniformLocs) return;

      gl.useProgram(program);
      const time = (Date.now() - startTime) / 1000;

      const pIndex = patternIndexRef.current;
      const pi = Math.floor(pIndex);
      if (lastPatternIndex !== -1 && pi !== lastPatternIndex) {
        revealStartTime = (Date.now() - startTime) / 1000;
      }
      lastPatternIndex = pi;

      const pat = list[Math.min(Math.max(0, pi), list.length - 1)] ?? list[0];
      const tileW = pat?.tileW ?? 8;
      const tileH = pat?.tileH ?? 8;

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, patternTexture);
      gl.uniform1i(uniformLocs.patternSampler, 0);
      gl.uniform1f(uniformLocs.time, time);
      const effectiveShimmerTime = shimmerPlayingRef.current ? time : shimmerPausedAtTimeRef.current;
      if (uniformLocs.shimmerTime != null) gl.uniform1f(uniformLocs.shimmerTime, effectiveShimmerTime);
      if (uniformLocs.shimmerPhase != null) gl.uniform1f(uniformLocs.shimmerPhase, shimmerPhaseRef.current);
      onShimmerTimeRef.current?.(time);
      gl.uniform2f(uniformLocs.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniformLocs.patternIndex, Math.floor(pIndex));
      gl.uniform1f(uniformLocs.tileW, tileW);
      gl.uniform1f(uniformLocs.tileH, tileH);
      gl.uniform1f(uniformLocs.patternTexHeight, patternTexHeight);
      gl.uniform1f(uniformLocs.palette, paletteRef.current);
      gl.uniform1f(uniformLocs.bgShade, bgShadeRef.current);
      gl.uniform1f(uniformLocs.warpShade, warpShadeRef.current);
      gl.uniform1f(uniformLocs.weftShade, weftShadeRef.current);
      gl.uniform1f(uniformLocs.gridSize, gridSizeRef.current);

      const wg = warpGradientRef.current || { startShade: warpShade, endShade: warpShade, direction: 0, range: [0, 100] };
      const wf = weftGradientRef.current || { startShade: weftShade, endShade: weftShade, direction: 0, range: [0, 100] };
      const warpStart = getPaletteColor(palette, wg.startShade);
      const warpEnd = getPaletteColor(palette, wg.endShade);
      const weftStart = getPaletteColor(palette, wf.startShade);
      const weftEnd = getPaletteColor(palette, wf.endShade);
      gl.uniform4f(uniformLocs.warpStart, warpStart[0], warpStart[1], warpStart[2], warpStart[3]);
      gl.uniform4f(uniformLocs.warpEnd, warpEnd[0], warpEnd[1], warpEnd[2], warpEnd[3]);
      gl.uniform4f(uniformLocs.weftStart, weftStart[0], weftStart[1], weftStart[2], weftStart[3]);
      gl.uniform4f(uniformLocs.weftEnd, weftEnd[0], weftEnd[1], weftEnd[2], weftEnd[3]);
      gl.uniform1f(uniformLocs.warpDir, wg.direction || 0);
      gl.uniform1f(uniformLocs.weftDir, wf.direction || 0);
      const wr = wg.range && wg.range.length === 2 ? wg.range : [0, 100];
      const wfr = wf.range && wf.range.length === 2 ? wf.range : [0, 100];
      gl.uniform1f(uniformLocs.warpStartPos, Math.min(wr[0], wr[1]) / 100);
      gl.uniform1f(uniformLocs.warpEndPos, Math.max(wr[0], wr[1]) / 100);
      gl.uniform1f(uniformLocs.weftStartPos, Math.min(wfr[0], wfr[1]) / 100);
      gl.uniform1f(uniformLocs.weftEndPos, Math.max(wfr[0], wfr[1]) / 100);
      gl.uniform1f(uniformLocs.gradSteps, gradStepsRef.current);
      gl.uniform1f(uniformLocs.revealStartTime, revealStartTime);
      gl.uniform1f(uniformLocs.rectAspect, rectAspectRef.current);
      gl.uniform1f(uniformLocs.cornerRadius, cornerRadiusRef.current);
      if (uniformLocs.shimmer != null) gl.uniform1f(uniformLocs.shimmer, shimmerRef.current);
      if (uniformLocs.shimmerSpeed != null) gl.uniform1f(uniformLocs.shimmerSpeed, shimmerSpeedRef.current);
      if (uniformLocs.shimmerWidth != null) gl.uniform1f(uniformLocs.shimmerWidth, shimmerWidthRef.current);
      if (uniformLocs.shimmerIntensity != null) gl.uniform1f(uniformLocs.shimmerIntensity, shimmerIntensityRef.current);
      if (uniformLocs.shimmerPosition != null) gl.uniform1f(uniformLocs.shimmerPosition, shimmerPositionRef.current);
      if (uniformLocs.shimmerRotation != null) gl.uniform1f(uniformLocs.shimmerRotation, shimmerRotationRef.current);
      if (uniformLocs.shimmerNoise != null) gl.uniform1f(uniformLocs.shimmerNoise, shimmerNoiseRef.current);
      if (uniformLocs.shimmerNoiseSeed != null) gl.uniform1f(uniformLocs.shimmerNoiseSeed, shimmerNoiseSeedRef.current);
      if (uniformLocs.shimmerNoiseMin != null) gl.uniform1f(uniformLocs.shimmerNoiseMin, shimmerNoiseMinRef.current);
      if (uniformLocs.shimmerNoiseMax != null) gl.uniform1f(uniformLocs.shimmerNoiseMax, shimmerNoiseMaxRef.current);
      if (uniformLocs.shimmerBlendMode != null) gl.uniform1f(uniformLocs.shimmerBlendMode, shimmerBlendModeRef.current);
      if (uniformLocs.useAllColorways != null) gl.uniform1f(uniformLocs.useAllColorways, useAllColorwaysRef.current);
      if (uniformLocs.colorwaySeed != null) gl.uniform1f(uniformLocs.colorwaySeed, colorwaySeedRef.current);
      if (uniformLocs.colorwayNoiseScale != null) gl.uniform1f(uniformLocs.colorwayNoiseScale, colorwayNoiseScaleRef.current);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      frameCount++;
      const now = Date.now();
      const elapsed = now - lastFrameTime;
      if (elapsed >= 1000) {
        setFps(Math.round((frameCount * 1000) / elapsed));
        frameCount = 0;
        lastFrameTime = now;
      }
    };

    const animate = () => {
      render();
      animationId = requestAnimationFrame(animate);
    };

    const compileAndAssign = (vs, fs) => {
      const p = createProgram(gl, vs, fs);
      const locs = getUniformLocs(gl, p);
      if (program) gl.deleteProgram(program);
      program = p;
      uniformLocs = locs;
      setError('');
    };

    try {
      compileAndAssign(vertexSourceRef.current, fragmentSourceRef.current);
      recompileRef.current = (newVertex, newFragment) => {
        try {
          compileAndAssign(newVertex, newFragment);
        } catch (err) { 
          setError(err.message);
        }
      };

      const { data: texData, width: texW, height: texH } = buildPatternTexture(list);
      patternTexHeight = texH;
      patternTexture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, patternTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texW, texH, 0, gl.RGBA, gl.UNSIGNED_BYTE, texData);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      setupGeometry();

      const posLoc = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(posLoc);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      /** Renders one frame at (w, h), returns PNG blob. Pauses/resumes animation. Capped to EXPORT_MAX_DIMENSION so toBlob won't fail. */
      const captureAtResolution = async (w, h) => {
        let tw = Math.max(1, Math.round(w));
        let th = Math.max(1, Math.round(h));
        if (tw > EXPORT_MAX_DIMENSION || th > EXPORT_MAX_DIMENSION) {
          const r = Math.min(EXPORT_MAX_DIMENSION / tw, EXPORT_MAX_DIMENSION / th);
          tw = Math.round(tw * r);
          th = Math.round(th * r);
        }
        if (animationId) cancelAnimationFrame(animationId);
        animationId = null;
        const prevW = canvas.width;
        const prevH = canvas.height;
        canvas.width = tw;
        canvas.height = th;
        gl.viewport(0, 0, tw, th);
        render();
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        canvas.width = prevW;
        canvas.height = prevH;
        gl.viewport(0, 0, prevW, prevH);
        resize();
        animate();
        if (!blob) throw new Error('Export failed (try lower scale)');
        return blob;
      };

      resize();
      window.addEventListener('resize', resize);
      resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(container);
      animate();
      onCaptureReadyRef.current?.({ captureAtResolution });
    } catch (err) {
      setError(err.message);
    }

    return () => {
      onCaptureReadyRef.current?.(null);
      recompileRef.current = null;
      if (resizeObserver && container) {
        try {
          resizeObserver.disconnect();
        } catch { /* noop */ }
      }
      window.removeEventListener('resize', resize);
      if (animationId) cancelAnimationFrame(animationId);
      if (patternTexture) gl.deleteTexture(patternTexture);
      if (program) gl.deleteProgram(program);
    };
  }, [palette, warpShade, weftShade, patterns]);

  useEffect(() => {
    const cleanup = run();
    return () => cleanup?.();
  }, [run]);

  // When only shader source changes (e.g. HMR on save), recompile program in place instead of full teardown.
  useEffect(() => {
    const prev = prevShaderRef.current;
    if (prev.vertex !== null && (prev.vertex !== vertexSource || prev.fragment !== fragmentSource)) {
      recompileRef.current?.(vertexSource, fragmentSource);
    }
    prevShaderRef.current = { vertex: vertexSource, fragment: fragmentSource };
  }, [vertexSource, fragmentSource]);

  return { canvasRef, containerRef, error, fps };
}
