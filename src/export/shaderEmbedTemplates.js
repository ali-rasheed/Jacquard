/**
 * Generate embeddable shader snippets (React + HTML) from export payload.
 */

function json(value) {
  return JSON.stringify(value, null, 2);
}

function toJsLiteral(value) {
  return JSON.stringify(value);
}

function makeRuntimeCore(payload) {
  const fixedUniforms = json(payload.fixedUniforms);
  const handoffDefaults = json(payload.handoffDefaults);
  const patternTextureDataUrl = `data:image/png;base64,${payload.textures.u_patternSampler.base64}`;
  const ensMarkTextureDataUrl = `data:image/png;base64,${payload.textures.u_ensMarkSampler.base64}`;
  const vertex = payload.vertexSource.replace(/`/g, '\\`');
  const fragment = payload.fragmentSource.replace(/`/g, '\\`');
  return { fixedUniforms, handoffDefaults, patternTextureDataUrl, ensMarkTextureDataUrl, vertex, fragment };
}

export function generateReactEmbedCode(payload) {
  const core = makeRuntimeCore(payload);
  return `import { useEffect, useRef } from 'react';

const vertexSource = \`${core.vertex}\`;
const fragmentSource = \`${core.fragment}\`;
const fixedUniforms = ${core.fixedUniforms};
const defaults = ${core.handoffDefaults};
const patternTextureSrc = ${toJsLiteral(core.patternTextureDataUrl)};
const ensMarkTextureSrc = ${toJsLiteral(core.ensMarkTextureDataUrl)};

function compileShader(gl, source, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || 'Shader compile error');
  }
  return shader;
}

function createProgram(gl, vsSource, fsSource) {
  const vs = compileShader(gl, vsSource, gl.VERTEX_SHADER);
  const fs = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'Program link error');
  }
  return program;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load texture image'));
    img.src = src;
  });
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function applyTimeWindow(raw, start, end) {
  let shifted = raw - (Number.isFinite(start) ? start : 0);
  if (Number.isFinite(end)) shifted = Math.min(shifted, Math.max(0, end - (Number.isFinite(start) ? start : 0)));
  return Math.max(0, shifted);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function colorwayOscFromOrigin(tMs, periodMs, minV, maxV, origin) {
  const span = maxV - minV;
  if (span <= 0) return origin;
  const u = clamp((Number(origin) - minV) / span, 0, 1);
  const phi = Math.asin(2 * u - 1);
  const TAU = 2 * Math.PI;
  return minV + span * (0.5 + 0.5 * Math.sin(phi + (tMs / periodMs) * TAU));
}

function colorwayOscClamped(tMs, periodMs, minV, maxV, origin) {
  const o = Number(origin);
  const clamped = Number.isFinite(o) ? clamp(o, minV, maxV) : (minV + maxV) * 0.5;
  return colorwayOscFromOrigin(tMs, periodMs, minV, maxV, clamped);
}

function colorwaySweepFromOrigin(tMs, periodMs, minV, maxV, origin) {
  const span = maxV - minV;
  if (span <= 0) return origin;
  const o = Number(origin);
  const clamped = Number.isFinite(o) ? clamp(o, minV, maxV) : (minV + maxV) * 0.5;
  const startNorm = (clamped - minV) / span;
  const u = (((tMs % periodMs) + periodMs) % periodMs) / periodMs;
  const startPhase = startNorm >= 0.5 ? 1 - startNorm : 1 + startNorm;
  const p = (startPhase + u * 2) % 2;
  const norm = p <= 1 ? 1 - p : p - 1;
  return minV + norm * span;
}

function colorwaySweepClamped(tMs, periodMs, minV, maxV, origin) {
  const o = Number(origin);
  const clamped = Number.isFinite(o) ? clamp(o, minV, maxV) : (minV + maxV) * 0.5;
  return colorwaySweepFromOrigin(tMs, periodMs, minV, maxV, clamped);
}

function snapColorwayBleedRotation(turns) {
  const clamped = clamp(Number(turns) || 0, 0, 1);
  const deg = clamped * 360.0;
  const snappedDeg = (Math.round(deg / 5.0) * 5.0) % 360.0;
  return snappedDeg / 360.0;
}

function setUniform(gl, loc, value) {
  if (!loc) return;
  if (Array.isArray(value)) {
    if (value.length === 2) gl.uniform2f(loc, value[0], value[1]);
    else if (value.length === 3) gl.uniform3f(loc, value[0], value[1], value[2]);
    else if (value.length === 4) gl.uniform4f(loc, value[0], value[1], value[2], value[3]);
    return;
  }
  gl.uniform1f(loc, value);
}

/**
 * Weaving shader embed with per-driver auto|controlled control.
 * Timeline and driver props are copied into a ref each render and read inside requestAnimationFrame,
 * so updating them does **not** re-run the WebGL setup effect (no teardown / flash). Only **width**
 * and **height** remount the canvas + GL when the drawable size changes.
 */
export function WeavingShaderEmbed({
  width = 720,
  height,
  translateX = defaults.translateX,
  animationStartSec = defaults.animationStartSec,
  animationEndSec = defaults.animationEndSec,
  progressStart = defaults.progressStart,
  progressEnd = defaults.progressEnd,
  timeMode = defaults.driverModes.time,
  timeValue = defaults.driverValues.time,
  shimmerTimeMode = defaults.driverModes.shimmerTime,
  shimmerTimeValue = defaults.driverValues.shimmerTime,
  stitchProgressMode = defaults.driverModes.stitchProgress,
  stitchProgressValue = defaults.driverValues.stitchProgress,
  colorwayNoiseScaleMode = defaults.driverModes.colorwayNoiseScale,
  colorwayNoiseScaleValue = defaults.driverValues.colorwayNoiseScale,
  colorwayNoiseOctavesMode = defaults.driverModes.colorwayNoiseOctaves,
  colorwayNoiseOctavesValue = defaults.driverValues.colorwayNoiseOctaves,
  colorwayNoisePersistenceMode = defaults.driverModes.colorwayNoisePersistence,
  colorwayNoisePersistenceValue = defaults.driverValues.colorwayNoisePersistence,
  colorwayNoiseLacunarityMode = defaults.driverModes.colorwayNoiseLacunarity,
  colorwayNoiseLacunarityValue = defaults.driverValues.colorwayNoiseLacunarity,
  colorwayNoiseBiasMode = defaults.driverModes.colorwayNoiseBias,
  colorwayNoiseBiasValue = defaults.driverValues.colorwayNoiseBias,
  colorwayNoiseXMode = defaults.driverModes.colorwayNoiseX,
  colorwayNoiseXValue = defaults.driverValues.colorwayNoiseX,
  colorwayBleedAnisotropyMode = defaults.driverModes.colorwayBleedAnisotropy,
  colorwayBleedAnisotropyValue = defaults.driverValues.colorwayBleedAnisotropy,
  colorwayBleedRotationMode = defaults.driverModes.colorwayBleedRotation,
  colorwayBleedRotationValue = defaults.driverValues.colorwayBleedRotation,
  colorwayBleedCrossFiberMode = defaults.driverModes.colorwayBleedCrossFiber,
  colorwayBleedCrossFiberValue = defaults.driverValues.colorwayBleedCrossFiber,
  colorwayBleedDraftCoupledMode = defaults.driverModes.colorwayBleedDraftCoupled,
  colorwayBleedDraftCoupledValue = defaults.driverValues.colorwayBleedDraftCoupled,
  stitchDurationSec = defaults.stitchDurationSec,
  hoverReactive = defaults.hover?.enabled ?? false,
  hoverRevealOnly = defaults.hover?.revealOnly ?? false,
  hoverMovementBoost = defaults.hover?.movementBoost ?? true,
}) {
  const canvasRef = useRef(null);
  const controlRef = useRef({
    translateX,
    animationStartSec,
    animationEndSec,
    progressStart,
    progressEnd,
    timeMode,
    timeValue,
    shimmerTimeMode,
    shimmerTimeValue,
    stitchProgressMode,
    stitchProgressValue,
    colorwayNoiseScaleMode,
    colorwayNoiseScaleValue,
    colorwayNoiseOctavesMode,
    colorwayNoiseOctavesValue,
    colorwayNoisePersistenceMode,
    colorwayNoisePersistenceValue,
    colorwayNoiseLacunarityMode,
    colorwayNoiseLacunarityValue,
    colorwayNoiseBiasMode,
    colorwayNoiseBiasValue,
    colorwayNoiseXMode,
    colorwayNoiseXValue,
    colorwayBleedAnisotropyMode,
    colorwayBleedAnisotropyValue,
    colorwayBleedRotationMode,
    colorwayBleedRotationValue,
    colorwayBleedCrossFiberMode,
    colorwayBleedCrossFiberValue,
    colorwayBleedDraftCoupledMode,
    colorwayBleedDraftCoupledValue,
    stitchDurationSec,
    hoverReactive,
    hoverRevealOnly,
    hoverMovementBoost,
  });
  controlRef.current = {
    translateX,
    animationStartSec,
    animationEndSec,
    progressStart,
    progressEnd,
    timeMode,
    timeValue,
    shimmerTimeMode,
    shimmerTimeValue,
    stitchProgressMode,
    stitchProgressValue,
    colorwayNoiseScaleMode,
    colorwayNoiseScaleValue,
    colorwayNoiseOctavesMode,
    colorwayNoiseOctavesValue,
    colorwayNoisePersistenceMode,
    colorwayNoisePersistenceValue,
    colorwayNoiseLacunarityMode,
    colorwayNoiseLacunarityValue,
    colorwayNoiseBiasMode,
    colorwayNoiseBiasValue,
    colorwayNoiseXMode,
    colorwayNoiseXValue,
    colorwayBleedAnisotropyMode,
    colorwayBleedAnisotropyValue,
    colorwayBleedRotationMode,
    colorwayBleedRotationValue,
    colorwayBleedCrossFiberMode,
    colorwayBleedCrossFiberValue,
    colorwayBleedDraftCoupledMode,
    colorwayBleedDraftCoupledValue,
    stitchDurationSec,
    hoverReactive,
    hoverRevealOnly,
    hoverMovementBoost,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, preserveDrawingBuffer: true });
    if (!gl) return;

    let rafId = 0;
    let mounted = true;
    let pointerTargetX = 0.5;
    let pointerTargetY = 0.5;
    let pointerX = 0.5;
    let pointerY = 0.5;
    let hoverTarget = 0;
    let hoverStrengthValue = 0;
    let hoverVelocityValue = 0;
    let ripplePhaseValue = 0;
    let handlePointerEnter = () => {};
    let handlePointerLeave = () => {};
    let handlePointerMove = () => {};
    const start = performance.now();
    const ar = ${Number(payload.canvas.aspect)};
    const targetH = Number.isFinite(height) ? height : Math.round(width / ar);
    const cssWidth = Math.max(1, Math.round(width));
    const cssHeight = Math.max(1, Math.round(targetH));
    const dpr = Math.max(1, Number(window.devicePixelRatio) || 1);
    canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);

    const program = createProgram(gl, vertexSource, fragmentSource);
    gl.useProgram(program);

    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uniformLocs = {};
    for (const key of Object.keys(fixedUniforms)) uniformLocs[key] = gl.getUniformLocation(program, key);
    uniformLocs.u_resolution = gl.getUniformLocation(program, 'u_resolution');
    uniformLocs.u_time = gl.getUniformLocation(program, 'u_time');
    uniformLocs.u_shimmerTime = gl.getUniformLocation(program, 'u_shimmerTime');
    uniformLocs.u_stitchRevealProgress = gl.getUniformLocation(program, 'u_stitchRevealProgress');
    uniformLocs.u_pointerUv = gl.getUniformLocation(program, 'u_pointerUv');
    uniformLocs.u_hoverStrength = gl.getUniformLocation(program, 'u_hoverStrength');
    uniformLocs.u_hoverVelocity = gl.getUniformLocation(program, 'u_hoverVelocity');
    uniformLocs.u_ripplePhase = gl.getUniformLocation(program, 'u_ripplePhase');
    const patternSamplerLoc = gl.getUniformLocation(program, 'u_patternSampler');
    const ensMarkSamplerLoc = gl.getUniformLocation(program, 'u_ensMarkSampler');

    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const ensMarkTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, ensMarkTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    Promise.all([loadImage(patternTextureSrc), loadImage(ensMarkTextureSrc)]).then(([patternImg, ensImg]) => {
      if (!mounted) return;
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, patternImg);
      gl.uniform1i(patternSamplerLoc, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, ensMarkTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ensImg);
      gl.uniform1i(ensMarkSamplerLoc, 1);

      Object.entries(fixedUniforms).forEach(([name, value]) => {
        if (
          name === 'u_time' ||
          name === 'u_shimmerTime' ||
          name === 'u_stitchRevealProgress' ||
          name === 'u_stageTranslateX' ||
          name === 'u_colorwayNoiseScale' ||
          name === 'u_colorwayNoiseOctaves' ||
          name === 'u_colorwayNoisePersistence' ||
          name === 'u_colorwayNoiseLacunarity' ||
          name === 'u_colorwayNoiseBias' ||
          name === 'u_colorwayNoiseX' ||
          name === 'u_colorwayBleedAnisotropy' ||
          name === 'u_colorwayBleedRotation' ||
          name === 'u_colorwayBleedCrossFiber' ||
          name === 'u_colorwayBleedDraftCoupled' ||
          name === 'u_pointerUv' ||
          name === 'u_hoverStrength' ||
          name === 'u_hoverVelocity' ||
          name === 'u_ripplePhase'
        ) return;
        setUniform(gl, uniformLocs[name], value);
      });

      handlePointerEnter = () => { hoverTarget = 1; };
      handlePointerLeave = () => { hoverTarget = 0; };
      handlePointerMove = (event) => {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const nx = clamp01((event.clientX - rect.left) / rect.width);
        const ny = clamp01((event.clientY - rect.top) / rect.height);
        const dx = nx - pointerTargetX;
        const dy = ny - pointerTargetY;
        const speed = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 8);
        hoverVelocityValue = Math.max(hoverVelocityValue, speed);
        pointerTargetX = nx;
        pointerTargetY = 1 - ny;
      };
      canvas.addEventListener('pointerenter', handlePointerEnter);
      canvas.addEventListener('pointerleave', handlePointerLeave);
      canvas.addEventListener('pointermove', handlePointerMove);

      const tick = (ts) => {
        if (!mounted) return;
        const c = controlRef.current;
        const elapsed = (ts - start) / 1000;
        const autoTime = applyTimeWindow(elapsed, c.animationStartSec, c.animationEndSec);
        const autoShimmer = applyTimeWindow(elapsed, c.animationStartSec, c.animationEndSec);
        const autoStitchRaw = clamp01(elapsed / Math.max(0.001, c.stitchDurationSec));
        const autoStitch = clamp01(c.progressStart + (c.progressEnd - c.progressStart) * autoStitchRaw);

        const resolvedTime = c.timeMode === 'controlled' ? Number(c.timeValue) : autoTime;
        const resolvedShimmerTime = c.shimmerTimeMode === 'controlled' ? Number(c.shimmerTimeValue) : autoShimmer;
        const resolvedStitchProgress =
          c.stitchProgressMode === 'controlled' ? clamp01(Number(c.stitchProgressValue)) : autoStitch;
        const tMs = elapsed * 1000;
        const resolvedNoiseScale = c.colorwayNoiseScaleMode === 'controlled'
          ? Number(c.colorwayNoiseScaleValue)
          : Number(colorwayOscClamped(tMs, 48000, 0.005, 0.25, c.colorwayNoiseScaleValue).toFixed(3));
        const resolvedOctaves = c.colorwayNoiseOctavesMode === 'controlled'
          ? Math.round(clamp(Number(c.colorwayNoiseOctavesValue) || 1, 1, 4))
          : ((((Math.round(clamp(Number(c.colorwayNoiseOctavesValue) || 1, 1, 4)) - 1 + Math.floor(tMs / 2000)) % 4) + 4) % 4) + 1;
        const resolvedPersistence = c.colorwayNoisePersistenceMode === 'controlled'
          ? Number(c.colorwayNoisePersistenceValue)
          : colorwayOscClamped(tMs, 50000, 0.15, 0.95, c.colorwayNoisePersistenceValue);
        const resolvedLacunarity = c.colorwayNoiseLacunarityMode === 'controlled'
          ? Number(c.colorwayNoiseLacunarityValue)
          : colorwayOscClamped(tMs, 56000, 1.05, 4, c.colorwayNoiseLacunarityValue);
        const resolvedBias = c.colorwayNoiseBiasMode === 'controlled'
          ? Number(c.colorwayNoiseBiasValue)
          : colorwaySweepClamped(tMs, 44000, 0.25, 4, c.colorwayNoiseBiasValue);
        const resolvedNoiseX = c.colorwayNoiseXMode === 'controlled'
          ? Number(c.colorwayNoiseXValue)
          : Number(colorwayOscClamped(tMs, 3000000, -500, 500, c.colorwayNoiseXValue).toFixed(2));
        const resolvedBleedAniso = c.colorwayBleedAnisotropyMode === 'controlled'
          ? Number(c.colorwayBleedAnisotropyValue)
          : colorwayOscClamped(tMs, 64000, 0.35, 12, c.colorwayBleedAnisotropyValue);
        const resolvedBleedRotation = c.colorwayBleedRotationMode === 'controlled'
          ? Number(c.colorwayBleedRotationValue)
          : snapColorwayBleedRotation(colorwayOscClamped(tMs, 70000, 0, 1, c.colorwayBleedRotationValue));
        const resolvedBleedCrossFiber = c.colorwayBleedCrossFiberMode === 'controlled'
          ? Number(c.colorwayBleedCrossFiberValue)
          : colorwayOscClamped(tMs, 40000, 0, 1, c.colorwayBleedCrossFiberValue);
        const resolvedBleedDraftCoupled = c.colorwayBleedDraftCoupledMode === 'controlled'
          ? (Number(c.colorwayBleedDraftCoupledValue) ? 1 : 0)
          : ((((Number(c.colorwayBleedDraftCoupledValue) ? 1 : 0) + Math.floor(tMs / 3000)) & 1) === 1 ? 1 : 0);
        pointerX += (pointerTargetX - pointerX) * 0.2;
        pointerY += (pointerTargetY - pointerY) * 0.2;
        hoverStrengthValue += (hoverTarget - hoverStrengthValue) * 0.12;
        hoverVelocityValue *= 0.9;
        ripplePhaseValue += 0.04 + hoverVelocityValue * 0.45;

        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(patternSamplerLoc, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, ensMarkTexture);
        gl.uniform1i(ensMarkSamplerLoc, 1);
        gl.uniform2f(uniformLocs.u_resolution, canvas.width, canvas.height);
        gl.uniform1f(uniformLocs.u_time, resolvedTime);
        gl.uniform1f(uniformLocs.u_shimmerTime, resolvedShimmerTime);
        gl.uniform1f(uniformLocs.u_stitchRevealProgress, resolvedStitchProgress);
        if (uniformLocs.u_colorwayNoiseScale != null) gl.uniform1f(uniformLocs.u_colorwayNoiseScale, resolvedNoiseScale);
        if (uniformLocs.u_colorwayNoiseOctaves != null) gl.uniform1f(uniformLocs.u_colorwayNoiseOctaves, resolvedOctaves);
        if (uniformLocs.u_colorwayNoisePersistence != null) gl.uniform1f(uniformLocs.u_colorwayNoisePersistence, resolvedPersistence);
        if (uniformLocs.u_colorwayNoiseLacunarity != null) gl.uniform1f(uniformLocs.u_colorwayNoiseLacunarity, resolvedLacunarity);
        if (uniformLocs.u_colorwayNoiseBias != null) gl.uniform1f(uniformLocs.u_colorwayNoiseBias, resolvedBias);
        if (uniformLocs.u_colorwayNoiseX != null) gl.uniform1f(uniformLocs.u_colorwayNoiseX, resolvedNoiseX);
        if (uniformLocs.u_colorwayBleedAnisotropy != null) gl.uniform1f(uniformLocs.u_colorwayBleedAnisotropy, resolvedBleedAniso);
        if (uniformLocs.u_colorwayBleedRotation != null) gl.uniform1f(uniformLocs.u_colorwayBleedRotation, resolvedBleedRotation);
        if (uniformLocs.u_colorwayBleedCrossFiber != null) gl.uniform1f(uniformLocs.u_colorwayBleedCrossFiber, resolvedBleedCrossFiber);
        if (uniformLocs.u_colorwayBleedDraftCoupled != null) gl.uniform1f(uniformLocs.u_colorwayBleedDraftCoupled, resolvedBleedDraftCoupled);
        if (uniformLocs.u_stageTranslateX != null) gl.uniform1f(uniformLocs.u_stageTranslateX, c.translateX);
        if (uniformLocs.u_pointerUv != null) gl.uniform2f(uniformLocs.u_pointerUv, pointerX, pointerY);
        if (uniformLocs.u_hoverStrength != null) gl.uniform1f(uniformLocs.u_hoverStrength, c.hoverReactive ? hoverStrengthValue : 0);
        if (uniformLocs.u_hoverVelocity != null) gl.uniform1f(uniformLocs.u_hoverVelocity, c.hoverReactive && c.hoverMovementBoost ? hoverVelocityValue : 0);
        if (uniformLocs.u_ripplePhase != null) gl.uniform1f(uniformLocs.u_ripplePhase, ripplePhaseValue);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    });

    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('pointerenter', handlePointerEnter);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      canvas.removeEventListener('pointermove', handlePointerMove);
    };
  }, [width, height]);

  return (
    <div>
      <canvas ref={canvasRef} />
    </div>
  );
}
`;
}

export function generateHtmlEmbedCode(payload) {
  const core = makeRuntimeCore(payload);
  return `<!-- Weaving shader embed -->
<div id="weaving-shader-embed"></div>
<script>
(() => {
  const vertexSource = \`${core.vertex}\`;
  const fragmentSource = \`${core.fragment}\`;
  const fixedUniforms = ${core.fixedUniforms};
  const defaults = ${core.handoffDefaults};
  const patternTextureSrc = ${toJsLiteral(core.patternTextureDataUrl)};
  const ensMarkTextureSrc = ${toJsLiteral(core.ensMarkTextureDataUrl)};

  function compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Shader compile error');
    return shader;
  }
  function createProgram(gl, vsSource, fsSource) {
    const vs = compileShader(gl, vsSource, gl.VERTEX_SHADER);
    const fs = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Program link error');
    return program;
  }
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load texture image'));
      img.src = src;
    });
  }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function applyTimeWindow(raw, start, end) {
    let shifted = raw - (Number.isFinite(start) ? start : 0);
    if (Number.isFinite(end)) shifted = Math.min(shifted, Math.max(0, end - (Number.isFinite(start) ? start : 0)));
    return Math.max(0, shifted);
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function colorwayOscFromOrigin(tMs, periodMs, minV, maxV, origin) {
    const span = maxV - minV;
    if (span <= 0) return origin;
    const u = clamp((Number(origin) - minV) / span, 0, 1);
    const phi = Math.asin(2 * u - 1);
    const TAU = 2 * Math.PI;
    return minV + span * (0.5 + 0.5 * Math.sin(phi + (tMs / periodMs) * TAU));
  }
  function colorwayOscClamped(tMs, periodMs, minV, maxV, origin) {
    const o = Number(origin);
    const clamped = Number.isFinite(o) ? clamp(o, minV, maxV) : (minV + maxV) * 0.5;
    return colorwayOscFromOrigin(tMs, periodMs, minV, maxV, clamped);
  }
  function colorwaySweepFromOrigin(tMs, periodMs, minV, maxV, origin) {
    const span = maxV - minV;
    if (span <= 0) return origin;
    const o = Number(origin);
    const clamped = Number.isFinite(o) ? clamp(o, minV, maxV) : (minV + maxV) * 0.5;
    const startNorm = (clamped - minV) / span;
    const u = (((tMs % periodMs) + periodMs) % periodMs) / periodMs;
    const startPhase = startNorm >= 0.5 ? 1 - startNorm : 1 + startNorm;
    const p = (startPhase + u * 2) % 2;
    const norm = p <= 1 ? 1 - p : p - 1;
    return minV + norm * span;
  }
  function colorwaySweepClamped(tMs, periodMs, minV, maxV, origin) {
    const o = Number(origin);
    const clamped = Number.isFinite(o) ? clamp(o, minV, maxV) : (minV + maxV) * 0.5;
    return colorwaySweepFromOrigin(tMs, periodMs, minV, maxV, clamped);
  }
  function snapColorwayBleedRotation(turns) {
    const clamped = clamp(Number(turns) || 0, 0, 1);
    const deg = clamped * 360.0;
    const snappedDeg = (Math.round(deg / 5.0) * 5.0) % 360.0;
    return snappedDeg / 360.0;
  }
  function setUniform(gl, loc, value) {
    if (!loc) return;
    if (Array.isArray(value)) {
      if (value.length === 2) gl.uniform2f(loc, value[0], value[1]);
      else if (value.length === 3) gl.uniform3f(loc, value[0], value[1], value[2]);
      else if (value.length === 4) gl.uniform4f(loc, value[0], value[1], value[2], value[3]);
      return;
    }
    gl.uniform1f(loc, value);
  }

  function mount(target, options = {}) {
    const opts = {
      width: 720,
      height: null,
      dpr: Math.max(1, Number(window.devicePixelRatio) || 1),
      translateX: defaults.translateX,
      animationStartSec: defaults.animationStartSec,
      animationEndSec: defaults.animationEndSec,
      progressStart: defaults.progressStart,
      progressEnd: defaults.progressEnd,
      timeMode: defaults.driverModes.time,
      timeValue: defaults.driverValues.time,
      shimmerTimeMode: defaults.driverModes.shimmerTime,
      shimmerTimeValue: defaults.driverValues.shimmerTime,
      stitchProgressMode: defaults.driverModes.stitchProgress,
      stitchProgressValue: defaults.driverValues.stitchProgress,
      colorwayNoiseScaleMode: defaults.driverModes.colorwayNoiseScale,
      colorwayNoiseScaleValue: defaults.driverValues.colorwayNoiseScale,
      colorwayNoiseOctavesMode: defaults.driverModes.colorwayNoiseOctaves,
      colorwayNoiseOctavesValue: defaults.driverValues.colorwayNoiseOctaves,
      colorwayNoisePersistenceMode: defaults.driverModes.colorwayNoisePersistence,
      colorwayNoisePersistenceValue: defaults.driverValues.colorwayNoisePersistence,
      colorwayNoiseLacunarityMode: defaults.driverModes.colorwayNoiseLacunarity,
      colorwayNoiseLacunarityValue: defaults.driverValues.colorwayNoiseLacunarity,
      colorwayNoiseBiasMode: defaults.driverModes.colorwayNoiseBias,
      colorwayNoiseBiasValue: defaults.driverValues.colorwayNoiseBias,
      colorwayNoiseXMode: defaults.driverModes.colorwayNoiseX,
      colorwayNoiseXValue: defaults.driverValues.colorwayNoiseX,
      colorwayBleedAnisotropyMode: defaults.driverModes.colorwayBleedAnisotropy,
      colorwayBleedAnisotropyValue: defaults.driverValues.colorwayBleedAnisotropy,
      colorwayBleedRotationMode: defaults.driverModes.colorwayBleedRotation,
      colorwayBleedRotationValue: defaults.driverValues.colorwayBleedRotation,
      colorwayBleedCrossFiberMode: defaults.driverModes.colorwayBleedCrossFiber,
      colorwayBleedCrossFiberValue: defaults.driverValues.colorwayBleedCrossFiber,
      colorwayBleedDraftCoupledMode: defaults.driverModes.colorwayBleedDraftCoupled,
      colorwayBleedDraftCoupledValue: defaults.driverValues.colorwayBleedDraftCoupled,
      stitchDurationSec: defaults.stitchDurationSec,
      hoverReactive: defaults.hover?.enabled ?? false,
      hoverRevealOnly: defaults.hover?.revealOnly ?? false,
      hoverMovementBoost: defaults.hover?.movementBoost ?? true,
      ...options,
    };
    const root = document.createElement('div');
    const canvas = document.createElement('canvas');
    root.appendChild(canvas);
    target.innerHTML = '';
    target.appendChild(root);

    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL not available');
    const ar = ${Number(payload.canvas.aspect)};
    const h = Number.isFinite(opts.height) ? opts.height : Math.round(opts.width / ar);
    const cssWidth = Math.max(1, Math.round(opts.width));
    const cssHeight = Math.max(1, Math.round(h));
    const dpr = Math.max(1, Number(opts.dpr) || 1);
    canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);

    const program = createProgram(gl, vertexSource, fragmentSource);
    gl.useProgram(program);

    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uniformLocs = {};
    for (const key of Object.keys(fixedUniforms)) uniformLocs[key] = gl.getUniformLocation(program, key);
    uniformLocs.u_resolution = gl.getUniformLocation(program, 'u_resolution');
    uniformLocs.u_time = gl.getUniformLocation(program, 'u_time');
    uniformLocs.u_shimmerTime = gl.getUniformLocation(program, 'u_shimmerTime');
    uniformLocs.u_stitchRevealProgress = gl.getUniformLocation(program, 'u_stitchRevealProgress');
    uniformLocs.u_pointerUv = gl.getUniformLocation(program, 'u_pointerUv');
    uniformLocs.u_hoverStrength = gl.getUniformLocation(program, 'u_hoverStrength');
    uniformLocs.u_hoverVelocity = gl.getUniformLocation(program, 'u_hoverVelocity');
    uniformLocs.u_ripplePhase = gl.getUniformLocation(program, 'u_ripplePhase');
    const patternSamplerLoc = gl.getUniformLocation(program, 'u_patternSampler');
    const ensMarkSamplerLoc = gl.getUniformLocation(program, 'u_ensMarkSampler');

    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const ensMarkTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, ensMarkTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    let rafId = 0;
    let mounted = true;
    let pointerTargetX = 0.5;
    let pointerTargetY = 0.5;
    let pointerX = 0.5;
    let pointerY = 0.5;
    let hoverTarget = 0;
    let hoverStrengthValue = 0;
    let hoverVelocityValue = 0;
    let ripplePhaseValue = 0;
    let handlePointerEnter = () => {};
    let handlePointerLeave = () => {};
    let handlePointerMove = () => {};
    const startedAt = performance.now();

    function render(ts) {
      if (!mounted) return;
      const elapsed = (ts - startedAt) / 1000;
      const autoTime = applyTimeWindow(elapsed, opts.animationStartSec, opts.animationEndSec);
      const autoShimmer = applyTimeWindow(elapsed, opts.animationStartSec, opts.animationEndSec);
      const autoStitchRaw = clamp01(elapsed / Math.max(0.001, opts.stitchDurationSec));
      const autoStitch = clamp01(opts.progressStart + (opts.progressEnd - opts.progressStart) * autoStitchRaw);
      const resolvedTime = opts.timeMode === 'controlled' ? Number(opts.timeValue) : autoTime;
      const resolvedShimmerTime = opts.shimmerTimeMode === 'controlled' ? Number(opts.shimmerTimeValue) : autoShimmer;
      const resolvedStitch = opts.stitchProgressMode === 'controlled' ? clamp01(Number(opts.stitchProgressValue)) : autoStitch;
      const tMs = elapsed * 1000;
      const resolvedNoiseScale = opts.colorwayNoiseScaleMode === 'controlled'
        ? Number(opts.colorwayNoiseScaleValue)
        : Number(colorwayOscClamped(tMs, 48000, 0.005, 0.25, opts.colorwayNoiseScaleValue).toFixed(3));
      const resolvedOctaves = opts.colorwayNoiseOctavesMode === 'controlled'
        ? Math.round(clamp(Number(opts.colorwayNoiseOctavesValue) || 1, 1, 4))
        : ((((Math.round(clamp(Number(opts.colorwayNoiseOctavesValue) || 1, 1, 4)) - 1 + Math.floor(tMs / 2000)) % 4) + 4) % 4) + 1;
      const resolvedPersistence = opts.colorwayNoisePersistenceMode === 'controlled'
        ? Number(opts.colorwayNoisePersistenceValue)
        : colorwayOscClamped(tMs, 50000, 0.15, 0.95, opts.colorwayNoisePersistenceValue);
      const resolvedLacunarity = opts.colorwayNoiseLacunarityMode === 'controlled'
        ? Number(opts.colorwayNoiseLacunarityValue)
        : colorwayOscClamped(tMs, 56000, 1.05, 4, opts.colorwayNoiseLacunarityValue);
      const resolvedBias = opts.colorwayNoiseBiasMode === 'controlled'
        ? Number(opts.colorwayNoiseBiasValue)
        : colorwaySweepClamped(tMs, 44000, 0.25, 4, opts.colorwayNoiseBiasValue);
      const resolvedNoiseX = opts.colorwayNoiseXMode === 'controlled'
        ? Number(opts.colorwayNoiseXValue)
        : Number(colorwayOscClamped(tMs, 3000000, -500, 500, opts.colorwayNoiseXValue).toFixed(2));
      const resolvedBleedAniso = opts.colorwayBleedAnisotropyMode === 'controlled'
        ? Number(opts.colorwayBleedAnisotropyValue)
        : colorwayOscClamped(tMs, 64000, 0.35, 12, opts.colorwayBleedAnisotropyValue);
      const resolvedBleedRotation = opts.colorwayBleedRotationMode === 'controlled'
        ? Number(opts.colorwayBleedRotationValue)
        : snapColorwayBleedRotation(colorwayOscClamped(tMs, 70000, 0, 1, opts.colorwayBleedRotationValue));
      const resolvedBleedCrossFiber = opts.colorwayBleedCrossFiberMode === 'controlled'
        ? Number(opts.colorwayBleedCrossFiberValue)
        : colorwayOscClamped(tMs, 40000, 0, 1, opts.colorwayBleedCrossFiberValue);
      const resolvedBleedDraftCoupled = opts.colorwayBleedDraftCoupledMode === 'controlled'
        ? (Number(opts.colorwayBleedDraftCoupledValue) ? 1 : 0)
        : ((((Number(opts.colorwayBleedDraftCoupledValue) ? 1 : 0) + Math.floor(tMs / 3000)) & 1) === 1 ? 1 : 0);
      pointerX += (pointerTargetX - pointerX) * 0.2;
      pointerY += (pointerTargetY - pointerY) * 0.2;
      hoverStrengthValue += (hoverTarget - hoverStrengthValue) * 0.12;
      hoverVelocityValue *= 0.9;
      ripplePhaseValue += 0.04 + hoverVelocityValue * 0.45;
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(patternSamplerLoc, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, ensMarkTexture);
      gl.uniform1i(ensMarkSamplerLoc, 1);
      gl.uniform2f(uniformLocs.u_resolution, canvas.width, canvas.height);
      gl.uniform1f(uniformLocs.u_time, resolvedTime);
      gl.uniform1f(uniformLocs.u_shimmerTime, resolvedShimmerTime);
      gl.uniform1f(uniformLocs.u_stitchRevealProgress, resolvedStitch);
      if (uniformLocs.u_colorwayNoiseScale != null) gl.uniform1f(uniformLocs.u_colorwayNoiseScale, resolvedNoiseScale);
      if (uniformLocs.u_colorwayNoiseOctaves != null) gl.uniform1f(uniformLocs.u_colorwayNoiseOctaves, resolvedOctaves);
      if (uniformLocs.u_colorwayNoisePersistence != null) gl.uniform1f(uniformLocs.u_colorwayNoisePersistence, resolvedPersistence);
      if (uniformLocs.u_colorwayNoiseLacunarity != null) gl.uniform1f(uniformLocs.u_colorwayNoiseLacunarity, resolvedLacunarity);
      if (uniformLocs.u_colorwayNoiseBias != null) gl.uniform1f(uniformLocs.u_colorwayNoiseBias, resolvedBias);
      if (uniformLocs.u_colorwayNoiseX != null) gl.uniform1f(uniformLocs.u_colorwayNoiseX, resolvedNoiseX);
      if (uniformLocs.u_colorwayBleedAnisotropy != null) gl.uniform1f(uniformLocs.u_colorwayBleedAnisotropy, resolvedBleedAniso);
      if (uniformLocs.u_colorwayBleedRotation != null) gl.uniform1f(uniformLocs.u_colorwayBleedRotation, resolvedBleedRotation);
      if (uniformLocs.u_colorwayBleedCrossFiber != null) gl.uniform1f(uniformLocs.u_colorwayBleedCrossFiber, resolvedBleedCrossFiber);
      if (uniformLocs.u_colorwayBleedDraftCoupled != null) gl.uniform1f(uniformLocs.u_colorwayBleedDraftCoupled, resolvedBleedDraftCoupled);
      if (uniformLocs.u_stageTranslateX != null) gl.uniform1f(uniformLocs.u_stageTranslateX, Number(opts.translateX) || 0);
      if (uniformLocs.u_pointerUv != null) gl.uniform2f(uniformLocs.u_pointerUv, pointerX, pointerY);
      if (uniformLocs.u_hoverStrength != null) gl.uniform1f(uniformLocs.u_hoverStrength, opts.hoverReactive ? hoverStrengthValue : 0);
      if (uniformLocs.u_hoverVelocity != null) gl.uniform1f(uniformLocs.u_hoverVelocity, opts.hoverReactive && opts.hoverMovementBoost ? hoverVelocityValue : 0);
      if (uniformLocs.u_ripplePhase != null) gl.uniform1f(uniformLocs.u_ripplePhase, ripplePhaseValue);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafId = requestAnimationFrame(render);
    }

    Promise.all([loadImage(patternTextureSrc), loadImage(ensMarkTextureSrc)]).then(([patternImg, ensImg]) => {
      if (!mounted) return;
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, patternImg);
      gl.uniform1i(patternSamplerLoc, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, ensMarkTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ensImg);
      gl.uniform1i(ensMarkSamplerLoc, 1);
      Object.entries(fixedUniforms).forEach(([name, value]) => {
        if (
          name === 'u_time' ||
          name === 'u_shimmerTime' ||
          name === 'u_stitchRevealProgress' ||
          name === 'u_stageTranslateX' ||
          name === 'u_colorwayNoiseScale' ||
          name === 'u_colorwayNoiseOctaves' ||
          name === 'u_colorwayNoisePersistence' ||
          name === 'u_colorwayNoiseLacunarity' ||
          name === 'u_colorwayNoiseBias' ||
          name === 'u_colorwayNoiseX' ||
          name === 'u_colorwayBleedAnisotropy' ||
          name === 'u_colorwayBleedRotation' ||
          name === 'u_colorwayBleedCrossFiber' ||
          name === 'u_colorwayBleedDraftCoupled' ||
          name === 'u_pointerUv' ||
          name === 'u_hoverStrength' ||
          name === 'u_hoverVelocity' ||
          name === 'u_ripplePhase'
        ) return;
        setUniform(gl, uniformLocs[name], value);
      });
      handlePointerEnter = () => { hoverTarget = 1; };
      handlePointerLeave = () => { hoverTarget = 0; };
      handlePointerMove = (event) => {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const nx = clamp01((event.clientX - rect.left) / rect.width);
        const ny = clamp01((event.clientY - rect.top) / rect.height);
        const dx = nx - pointerTargetX;
        const dy = ny - pointerTargetY;
        const speed = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 8);
        hoverVelocityValue = Math.max(hoverVelocityValue, speed);
        pointerTargetX = nx;
        pointerTargetY = 1 - ny;
      };
      canvas.addEventListener('pointerenter', handlePointerEnter);
      canvas.addEventListener('pointerleave', handlePointerLeave);
      canvas.addEventListener('pointermove', handlePointerMove);
      rafId = requestAnimationFrame(render);
    });

    return {
      setOptions(next) {
        Object.assign(opts, next || {});
      },
      destroy() {
        mounted = false;
        cancelAnimationFrame(rafId);
        canvas.removeEventListener('pointerenter', handlePointerEnter);
        canvas.removeEventListener('pointerleave', handlePointerLeave);
        canvas.removeEventListener('pointermove', handlePointerMove);
        target.innerHTML = '';
      },
    };
  }

  window.createWeavingShaderEmbed = mount;
  const mountPoint = document.getElementById('weaving-shader-embed');
  window.weavingShaderEmbed = mount(mountPoint);
})();
</script>`;
}

