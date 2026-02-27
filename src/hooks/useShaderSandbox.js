/**
 * useShaderSandbox — WebGL shader compilation and render loop.
 * Compiles vertex + fragment shaders, uploads fullscreen quad, runs animation loop.
 * Pattern data is uploaded as a texture; uniforms include u_tileW, u_tileH for the selected pattern.
 *
 * Optimizations (Vercel React): cache uniform locations (js-cache-property-access),
 * ref for onFpsChange to avoid effect churn (advanced-use-latest).
 */
const DPR = 2;
import { useRef, useEffect, useCallback, useState } from 'react';
import { buildPatternTexture, PATTERNS } from '../patterns';

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

export function useShaderSandbox(vertexSource, fragmentSource, patternIndex, palette, bgShade, warpShade, weftShade, gridSize, patterns, onFpsChange) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  // When patterns is omitted, callers pass (..., onFpsChange) so the 7th arg is the callback
  const callback = typeof patterns === 'function' ? patterns : onFpsChange;
  const onFpsChangeRef = useRef(callback);
  const [error, setError] = useState('');
  const [fps, setFps] = useState(0);

  onFpsChangeRef.current = callback;

  useEffect(() => {
    onFpsChangeRef.current?.(fps);
  }, [fps]);

  const run = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      setError('WebGL is not supported');
      return;
    }

    setError('');

    let program = null;
    let positionBuffer = null;
    let patternTexture = null;
    let animationId = null;
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

    try {
      program = createProgram(gl, vertexSource, fragmentSource);
      uniformLocs = {
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

      resize();
      window.addEventListener('resize', resize);
      animate();
    } catch (err) {
      setError(err.message);
    }

    return () => {
      window.removeEventListener('resize', resize);
      if (animationId) cancelAnimationFrame(animationId);
      if (patternTexture) gl.deleteTexture(patternTexture);
      if (program) gl.deleteProgram(program);
    };
  }, [vertexSource, fragmentSource, patternIndex, palette, bgShade, warpShade, weftShade, gridSize, patterns]);

  useEffect(() => {
    const cleanup = run();
    return () => cleanup?.();
  }, [run]);

  return { canvasRef, containerRef, error, fps };
}

