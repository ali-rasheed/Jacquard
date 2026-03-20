/**
 * useImageRectsSandbox — V2 only. WebGL canvas that samples an image per grid cell
 * and draws rounded rects. Uses same weave pattern texture as v1 for rect orientation (warp/weft).
 * Exposes captureAtResolution(w, h) so copy/export can render at target resolution for sharpness.
 */
const DPR = 2;
import { useRef, useEffect, useCallback, useState } from 'react';
import { buildPatternTexture, PATTERNS } from '../patterns';
import { EXPORT_MAX_DIMENSION } from '../constants';

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

/**
 * When image loads, the hook reports its size via onImageSize(w, h) and imageSize state
 * so the UI can match aspect ratio and resolution (e.g. canvas/capture dimensions).
 * Image is cached by source so changing grid/palette etc. does not reload it.
 */
export function useImageRectsSandbox(vertexSource, fragmentSource, imageSource, gridSize, palette, bgShade, colorizeMode, quantizeSteps, rectShade, shadeFrom, patternIndex, patterns, rectRadius, rectAspect, rectRatio, onFpsChange, onImageSize, onCaptureReady) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const onFpsChangeRef = useRef(onFpsChange);
  const onImageSizeRef = useRef(onImageSize);
  const onCaptureReadyRef = useRef(onCaptureReady);
  /** Keep loaded image by source so changing grid/palette etc. doesn't reload the image. */
  const imageCacheRef = useRef({ source: null, img: null });
  const [error, setError] = useState('');
  const [fps, setFps] = useState(0);
  const [imageSize, setImageSize] = useState(null);

  onFpsChangeRef.current = onFpsChange;
  onImageSizeRef.current = onImageSize;
  onCaptureReadyRef.current = onCaptureReady;

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
    let imageTexture = null;
    let patternTexture = null;
    let patternTexHeight = 0;
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

    const list = Array.isArray(patterns) ? patterns : PATTERNS;

    const render = () => {
      if (!program || !uniformLocs || !imageTexture || !patternTexture) return;
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imageTexture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, patternTexture);
      gl.uniform1i(uniformLocs.imageSampler, 0);
      gl.uniform1i(uniformLocs.patternSampler, 1);
      gl.uniform2f(uniformLocs.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniformLocs.gridSize, gridSize);
      gl.uniform1f(uniformLocs.palette, palette);
      gl.uniform1f(uniformLocs.bgShade, bgShade);
      gl.uniform1f(uniformLocs.colorizeMode, colorizeMode);
      gl.uniform1f(uniformLocs.quantizeSteps, quantizeSteps);
      gl.uniform1f(uniformLocs.rectShade, rectShade);
      gl.uniform1f(uniformLocs.shadeFrom, shadeFrom);
      gl.uniform1f(uniformLocs.rectRadius, rectRadius ?? 0.18);
      gl.uniform1f(uniformLocs.rectAspect, rectAspect ?? 0.85);
      gl.uniform1f(uniformLocs.rectRatio, rectRatio ?? 1.0);
      const pat = list[Math.min(Math.max(0, Math.floor(patternIndex)), list.length - 1)] ?? list[0];
      gl.uniform1f(uniformLocs.patternIndex, Math.floor(patternIndex));
      gl.uniform1f(uniformLocs.tileW, pat?.tileW ?? 8);
      gl.uniform1f(uniformLocs.tileH, pat?.tileH ?? 8);
      gl.uniform1f(uniformLocs.patternTexHeight, patternTexHeight);
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

    try {
      program = createProgram(gl, vertexSource, fragmentSource);
      uniformLocs = {
        resolution: gl.getUniformLocation(program, 'u_resolution'),
        gridSize: gl.getUniformLocation(program, 'u_gridSize'),
        imageSampler: gl.getUniformLocation(program, 'u_imageSampler'),
        patternSampler: gl.getUniformLocation(program, 'u_patternSampler'),
        patternIndex: gl.getUniformLocation(program, 'u_patternIndex'),
        tileW: gl.getUniformLocation(program, 'u_tileW'),
        tileH: gl.getUniformLocation(program, 'u_tileH'),
        patternTexHeight: gl.getUniformLocation(program, 'u_patternTexHeight'),
        palette: gl.getUniformLocation(program, 'u_palette'),
        bgShade: gl.getUniformLocation(program, 'u_bgShade'),
        colorizeMode: gl.getUniformLocation(program, 'u_colorizeMode'),
        quantizeSteps: gl.getUniformLocation(program, 'u_quantizeSteps'),
        rectShade: gl.getUniformLocation(program, 'u_rectShade'),
        shadeFrom: gl.getUniformLocation(program, 'u_shadeFrom'),
        rectRadius: gl.getUniformLocation(program, 'u_rectRadius'),
        rectAspect: gl.getUniformLocation(program, 'u_rectAspect'),
        rectRatio: gl.getUniformLocation(program, 'u_rectRatio'),
      };

      imageTexture = createPlaceholderTexture(gl);

      const { data: texData, width: texW, height: texH } = buildPatternTexture(list);
      patternTexHeight = texH;
      patternTexture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, patternTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texW, texH, 0, gl.RGBA, gl.UNSIGNED_BYTE, texData);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const cache = imageCacheRef.current;
      if (imageSource) {
        if (cache.source === imageSource && cache.img?.complete) {
          uploadImageToTexture(gl, imageTexture, cache.img);
          setImageSize({ width: cache.img.naturalWidth, height: cache.img.naturalHeight });
          onImageSizeRef.current?.(cache.img.naturalWidth, cache.img.naturalHeight);
        } else {
          cache.source = null;
          cache.img = null;
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            cache.source = imageSource;
            cache.img = img;
            uploadImageToTexture(gl, imageTexture, img);
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            setImageSize({ width: w, height: h });
            onImageSizeRef.current?.(w, h);
          };
          img.onerror = () => {
            setError('Failed to load image');
            setImageSize(null);
          };
          img.src = imageSource;
        }
      } else {
        cache.source = null;
        cache.img = null;
        setImageSize(null);
      }

      setupGeometry();
      const posLoc = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(posLoc);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      /** Renders one frame at (w, h), returns PNG blob. Pauses/resumes animation. Capped to EXPORT_MAX_DIMENSION. */
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
        if (!blob) throw new Error('Capture failed (try lower scale)');
        return blob;
      };

      resize();
      window.addEventListener('resize', resize);
      animate();
      onCaptureReadyRef.current?.({ captureAtResolution });
    } catch (err) {
      setError(err.message);
    }

    return () => {
      onCaptureReadyRef.current?.(null);
      window.removeEventListener('resize', resize);
      if (animationId) cancelAnimationFrame(animationId);
      if (imageTexture) gl.deleteTexture(imageTexture);
      if (patternTexture) gl.deleteTexture(patternTexture);
      if (program) gl.deleteProgram(program);
    };
  }, [vertexSource, fragmentSource, imageSource, gridSize, palette, bgShade, colorizeMode, quantizeSteps, rectShade, shadeFrom, patternIndex, patterns, rectRadius, rectAspect, rectRatio]);

  useEffect(() => {
    const cleanup = run();
    return () => cleanup?.();
  }, [run]);

  return { canvasRef, containerRef, error, fps, imageSize };
}
