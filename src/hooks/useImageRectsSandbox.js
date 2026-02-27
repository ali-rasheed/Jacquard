/**
 * useImageRectsSandbox — V2 only. WebGL canvas that samples an image per grid cell
 * and draws rounded rects. Loads image from URL (file object URL or string); uses
 * a 1x1 placeholder texture when no image. No dependency on useShaderSandbox or patterns.
 */
const DPR = 2;
import { useRef, useEffect, useCallback, useState } from 'react';

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

function createPlaceholderTexture(gl) {
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const pixel = new Uint8Array([60, 60, 70, 255]);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function uploadImageToTexture(gl, texture, image) {
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

export function useImageRectsSandbox(vertexSource, fragmentSource, imageSource, gridSize, palette, bgShade, colorizeMode, quantizeSteps, rectShade, onFpsChange) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const onFpsChangeRef = useRef(onFpsChange);
  const [error, setError] = useState('');
  const [fps, setFps] = useState(0);

  onFpsChangeRef.current = onFpsChange;

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
    let imageTexture = null;
    let animationId = null;
    let lastFrameTime = Date.now();
    let frameCount = 0;
    let uniformLocs = null;

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
      if (!program || !uniformLocs || !imageTexture) return;
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imageTexture);
      gl.uniform1i(uniformLocs.imageSampler, 0);
      gl.uniform2f(uniformLocs.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniformLocs.gridSize, gridSize);
      gl.uniform1f(uniformLocs.palette, palette);
      gl.uniform1f(uniformLocs.bgShade, bgShade);
      gl.uniform1f(uniformLocs.colorizeMode, colorizeMode);
      gl.uniform1f(uniformLocs.quantizeSteps, quantizeSteps);
      gl.uniform1f(uniformLocs.rectShade, rectShade);
      gl.clearColor(0.1, 0.1, 0.12, 1);
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
        resolution: gl.getUniformLocation(program, 'u_resolution'),
        gridSize: gl.getUniformLocation(program, 'u_gridSize'),
        imageSampler: gl.getUniformLocation(program, 'u_imageSampler'),
        palette: gl.getUniformLocation(program, 'u_palette'),
        bgShade: gl.getUniformLocation(program, 'u_bgShade'),
        colorizeMode: gl.getUniformLocation(program, 'u_colorizeMode'),
        quantizeSteps: gl.getUniformLocation(program, 'u_quantizeSteps'),
        rectShade: gl.getUniformLocation(program, 'u_rectShade'),
      };

      imageTexture = createPlaceholderTexture(gl);

      if (imageSource) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          uploadImageToTexture(gl, imageTexture, img);
        };
        img.onerror = () => {
          setError('Failed to load image');
        };
        img.src = imageSource;
      }

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
      if (imageTexture) gl.deleteTexture(imageTexture);
      if (program) gl.deleteProgram(program);
    };
  }, [vertexSource, fragmentSource, imageSource, gridSize, palette, bgShade, colorizeMode, quantizeSteps, rectShade]);

  useEffect(() => {
    const cleanup = run();
    return () => cleanup?.();
  }, [run]);

  return { canvasRef, containerRef, error, fps };
}
