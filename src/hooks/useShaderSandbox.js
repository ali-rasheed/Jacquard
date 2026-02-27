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
const DPR = 2;
import { useRef, useEffect, useCallback, useState } from 'react';
import { buildPatternTexture, PATTERNS } from '../patterns';

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
    mouse: gl.getUniformLocation(program, 'u_mouse'),
    mouseRadius: gl.getUniformLocation(program, 'u_mouseRadius'),
    mouseStrength: gl.getUniformLocation(program, 'u_mouseStrength'),
    mouseDown: gl.getUniformLocation(program, 'u_mouseDown'),
    falloffCurve: gl.getUniformLocation(program, 'u_falloffCurve'),
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

const MOUSE_OFF = 111;
const MOUSE_RADIUS = 0.44;
const MOUSE_STRENGTH = 0.2;
const MOUSE_STRENGTH_RAMP_MS = 600; // Strength ramps from 0 to full over this many ms while pressed

// ENS palette RGB (0–1), matches shader getPaletteColor. [palette][shade] = [r,g,b]; shade 0–3 = 950,500,100,400.
const PALETTE_RGB = [
  [[0.247, 0.114, 0.035], [0.51, 0.2, 0.149], [0.973, 0.969, 0.886], [0.855, 0.725, 0.525]],
  [[0.322, 0.024, 0.141], [0.941, 0.216, 0.576], [0.984, 0.922, 0.941], [0.988, 0.706, 0.812]],
  [[0.008, 0.161, 0.231], [0.0, 0.502, 0.737], [0.902, 0.953, 0.973], [0.455, 0.725, 0.875]],
  [[0.012, 0.188, 0.063], [0.0, 0.486, 0.137], [0.843, 0.914, 0.89], [0.51, 0.816, 0.561]],
];

function getPaletteColor(paletteIndex, shadeIndex) {
  const p = Math.max(0, Math.min(3, Math.floor(paletteIndex)));
  const s = Math.max(0, Math.min(3, Math.floor(shadeIndex)));
  return PALETTE_RGB[p][s];
}

export function useShaderSandbox(vertexSource, fragmentSource, patternIndex, palette, bgShade, warpShade, weftShade, gridSize, falloffCurve, warpGradient, weftGradient, gradSteps, patterns, onFpsChange) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const mouseRef = useRef({ x: MOUSE_OFF, y: MOUSE_OFF, down: 0, pressStartTime: 0 });
  const vertexSourceRef = useRef(vertexSource);
  const fragmentSourceRef = useRef(fragmentSource);
  const recompileRef = useRef(null);
  const prevShaderRef = useRef({ vertex: null, fragment: null });
  const warpGradientRef = useRef(warpGradient);
  const weftGradientRef = useRef(weftGradient);
  // When patterns is omitted, callers pass (..., onFpsChange) so the 7th arg is the callback
  const callback = typeof patterns === 'function' ? patterns : onFpsChange;
  const onFpsChangeRef = useRef(callback);
  const [error, setError] = useState('');
  const [fps, setFps] = useState(0);

  vertexSourceRef.current = vertexSource;
  fragmentSourceRef.current = fragmentSource;
  onFpsChangeRef.current = callback;
  warpGradientRef.current = warpGradient;
  weftGradientRef.current = weftGradient;

  useEffect(() => {
    onFpsChangeRef.current?.(fps);
  }, [fps]);

  const run = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true }) || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true });
    if (!gl) {
      setError('WebGL is not supported');
      return;
    }

    setError('');

    let program = null;
    let positionBuffer = null;
    let patternTexture = null;
    let animationId = null;
    let mouseHandlers = null;
    let startTime = Date.now();
    let lastFrameTime = Date.now();
    let frameCount = 0;
    let uniformLocs = null;
    let patternTexHeight = 0;
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

      const pat = list[Math.min(Math.max(0, Math.floor(patternIndex)), list.length - 1)] ?? list[0];
      const tileW = pat?.tileW ?? 8;
      const tileH = pat?.tileH ?? 8;

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, patternTexture);
      gl.uniform1i(uniformLocs.patternSampler, 0);
      gl.uniform1f(uniformLocs.time, time);
      gl.uniform2f(uniformLocs.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniformLocs.patternIndex, Math.floor(patternIndex));
      gl.uniform1f(uniformLocs.tileW, tileW);
      gl.uniform1f(uniformLocs.tileH, tileH);
      gl.uniform1f(uniformLocs.patternTexHeight, patternTexHeight);
      gl.uniform1f(uniformLocs.palette, palette);
      gl.uniform1f(uniformLocs.bgShade, bgShade);
      gl.uniform1f(uniformLocs.warpShade, warpShade);
      gl.uniform1f(uniformLocs.weftShade, weftShade);
      gl.uniform1f(uniformLocs.gridSize, gridSize);
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const down = mouseRef.current.down;
      const ramp = down ? Math.min(1, (Date.now() - mouseRef.current.pressStartTime) / MOUSE_STRENGTH_RAMP_MS) : 0;
      gl.uniform2f(uniformLocs.mouse, mx, my);
      gl.uniform1f(uniformLocs.mouseRadius, MOUSE_RADIUS);
      gl.uniform1f(uniformLocs.mouseStrength, MOUSE_STRENGTH * ramp);
      gl.uniform1f(uniformLocs.mouseDown, down);
      gl.uniform1f(uniformLocs.falloffCurve, falloffCurve);

      const wg = warpGradientRef.current || { startShade: warpShade, endShade: warpShade, direction: 0, range: [0, 100] };
      const wf = weftGradientRef.current || { startShade: weftShade, endShade: weftShade, direction: 0, range: [0, 100] };
      const warpStart = getPaletteColor(palette, wg.startShade);
      const warpEnd = getPaletteColor(palette, wg.endShade);
      const weftStart = getPaletteColor(palette, wf.startShade);
      const weftEnd = getPaletteColor(palette, wf.endShade);
      gl.uniform3f(uniformLocs.warpStart, warpStart[0], warpStart[1], warpStart[2]);
      gl.uniform3f(uniformLocs.warpEnd, warpEnd[0], warpEnd[1], warpEnd[2]);
      gl.uniform3f(uniformLocs.weftStart, weftStart[0], weftStart[1], weftStart[2]);
      gl.uniform3f(uniformLocs.weftEnd, weftEnd[0], weftEnd[1], weftEnd[2]);
      gl.uniform1f(uniformLocs.warpDir, wg.direction || 0);
      gl.uniform1f(uniformLocs.weftDir, wf.direction || 0);
      const wr = wg.range && wg.range.length === 2 ? wg.range : [0, 100];
      const wfr = wf.range && wf.range.length === 2 ? wf.range : [0, 100];
      gl.uniform1f(uniformLocs.warpStartPos, Math.min(wr[0], wr[1]) / 100);
      gl.uniform1f(uniformLocs.warpEndPos, Math.max(wr[0], wr[1]) / 100);
      gl.uniform1f(uniformLocs.weftStartPos, Math.min(wfr[0], wfr[1]) / 100);
      gl.uniform1f(uniformLocs.weftEndPos, Math.max(wfr[0], wfr[1]) / 100);
      gl.uniform1f(uniformLocs.gradSteps, gradSteps ?? 0);

      gl.clearColor(0, 0, 0, 1);
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

      // Quantize mouse to grid cell center so warp effect snaps to cells (matches shader gridUV = uv * gridSize).
      const updateMouse = (e) => {
        const rect = container.getBoundingClientRect();
        const aspect = rect.width / rect.height;
        let x = ((e.clientX - rect.left) / rect.width) * aspect;
        let y = 1.0 - (e.clientY - rect.top) / rect.height;
        const g = Math.max(2, Math.min(64, gridSize));
        const cellX = Math.floor(x * g);
        const cellY = Math.floor(y * g);
        mouseRef.current.x = (cellX + 0.5) / g;
        mouseRef.current.y = (cellY + 0.5) / g;
      };
      const onMouseMove = (e) => {
        updateMouse(e);
      };
      const onMouseDown = (e) => {
        if (!mouseRef.current.down) mouseRef.current.pressStartTime = Date.now();
        mouseRef.current.down = 1;
        updateMouse(e);
      };
      const onMouseUp = () => {
        mouseRef.current.down = 0;
      };
      const onMouseLeave = () => {
        mouseRef.current.down = 0;
        mouseRef.current.x = MOUSE_OFF;
        mouseRef.current.y = MOUSE_OFF;
      };
      mouseHandlers = { onMouseMove, onMouseDown, onMouseUp, onMouseLeave };
      container.addEventListener('mousemove', mouseHandlers.onMouseMove);
      container.addEventListener('mousedown', mouseHandlers.onMouseDown);
      window.addEventListener('mouseup', mouseHandlers.onMouseUp);
      container.addEventListener('mouseleave', mouseHandlers.onMouseLeave);
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

      resize();
      window.addEventListener('resize', resize);
      animate();
    } catch (err) {
      setError(err.message);
    }

    return () => {
      recompileRef.current = null;
      window.removeEventListener('resize', resize);
      if (mouseHandlers) {
        window.removeEventListener('mouseup', mouseHandlers.onMouseUp);
        container.removeEventListener('mousemove', mouseHandlers.onMouseMove);
        container.removeEventListener('mousedown', mouseHandlers.onMouseDown);
        container.removeEventListener('mouseleave', mouseHandlers.onMouseLeave);
      }
      if (animationId) cancelAnimationFrame(animationId);
      if (patternTexture) gl.deleteTexture(patternTexture);
      if (program) gl.deleteProgram(program);
    };
  }, [patternIndex, palette, bgShade, warpShade, weftShade, gridSize, falloffCurve, warpGradient, weftGradient, gradSteps, patterns]);

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

