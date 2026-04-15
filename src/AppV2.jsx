/**
 * AppV2 — Mosaic: image, video, or GIF → colored rects (one sample per cell). Weave orientation;
 * brand / image / pattern color; quantize, stitches, optional background gaps (legacy v5), Fit/Fill canvas.
 * Copy, WebM/MP4 record, URL state (?v=2, gap=, display=), shortcuts.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import * as Label from '@radix-ui/react-label';
import { ImageRectsCanvas } from './components/ImageRectsCanvas';
import { SliderWithInput } from './components/SliderWithInput';
import { useCanvasRecorder, supportsMP4 } from './hooks/useCanvasRecorder';
import { PATTERNS } from './patterns';
import { COPY_SCALES, EXPORT_MAX_DIMENSION, GRID_SNAPS, getGridSizeIndex, URL_STATE_MAX_LEN, WEAVE_ICONS } from './constants';
import { IMAGE_RECTS_URL_DEFAULTS } from './urlDefaults';
import {
  PALETTE_NAMES,
  PALETTE_SWATCH_COLORS,
  SHADE_NAMES,
  SHADE_TRANSPARENT_ICON,
  typeBase,
  typeLabel,
  controlLabel,
  iconSm,
  iconMd,
  iconXs,
  iconResetGlyph,
  iconResetGlyphMd,
  btnGhost,
  pill,
  sidebarGroup,
  sidebarGroupSticky,
  sidebarGroupTitle,
  paletteSwatch,
  paletteSwatchSelected,
  paletteSwatchUnselected,
  toggleBtn,
  toggleBtnActive,
} from './uiConstants';
import { Icon, GroupIcon, AppSelect, SegmentedControl, SegmentedControlButton, IconButton } from './components/ui';
import { RecordingDownloadBanner } from './components/RecordingDownloadBanner.jsx';

/** Rect fill: brand = palette from cell image luma; image = sampled RGB; pattern = warp vs weft shades only. */
const RECT_COLOR_SOURCE_OPTIONS = [
  { value: 0, label: 'Brand' },
  { value: 1, label: 'Image' },
  { value: 2, label: 'Pattern' },
];

/** How cell color is banded when quantize steps ≥ 2 (see fragmentImageRects.glsl). */
const QUANTIZE_MODE_OPTIONS = [
  { value: 0, label: 'RGB' },
  { value: 1, label: 'HSV' },
];

/** Cell shape: always weave rects, or plain tiles except where image is dark enough. */
const CELL_GEOMETRY_OPTIONS = [
  { value: 0, label: 'Weave' },
  { value: 1, label: 'Dark stitches' },
];

/** Animate colored stitches from background-only: isotropic FBM order vs dye-bleed streaks. */
const STITCH_REVEAL_MODE_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 1, label: 'Noise' },
  { value: 2, label: 'Bleed' },
];

/** Map picked file to WebGL upload strategy (V6 video/GIF). */
function inferMediaTextureKindFromFile(file) {
  if (!file) return 'staticImage';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type === 'image/gif') return 'gif';
  const n = file.name.toLowerCase();
  if (n.endsWith('.gif')) return 'gif';
  if (/\.(webm|mp4|mov|m4v|ogv|avi)$/i.test(n)) return 'video';
  return 'staticImage';
}

/** Parse URL search params into Mosaic state. imageSource is not in URL (blob). v=2|5|6 supported; v=5 enables bg gaps. */
function parseUrlStateV2(search) {
  const params = new URLSearchParams(search);
  const out = {};
  const num = (paramKey, stateKey, min, max) => {
    const val = params.get(paramKey);
    if (val == null) return;
    const n = Number(val);
    if (!Number.isFinite(n)) return;
    out[stateKey] = min != null && max != null ? Math.max(min, Math.min(max, n)) : n;
  };
  const vParam = params.get('v');
  const mosaicV = vParam == null || vParam === '2' || vParam === '5' || vParam === '6';
  if (!mosaicV) return out;
  if (vParam === '5') {
    out.mosaicBgGaps = true;
    if (params.get('gm') == null && params.get('gap') == null) out.cellGeometryMode = 1;
  }
  const gap = params.get('gap');
  if (gap === '1') out.mosaicBgGaps = true;
  if (gap === '0') out.mosaicBgGaps = false;
  const display = params.get('display');
  if (display === 'fill' || display === 'fit') out.patternFit = display;
  num('grid', 'gridSize', 8, 256);
  num('pal', 'palette', 0, 4);
  num('bg', 'bgShade', 0, 5);
  num('cm', 'rectColorSource', 0, 2);
  num('pws', 'patternWarpShade', 0, 4);
  num('pwf', 'patternWeftShade', 0, 4);
  num('q', 'quantizeSteps', 0, 32);
  num('qm', 'quantizeMode', 0, 1);
  num('p', 'patternIndex', 0, PATTERNS.length - 1);
  num('rr', 'rectRadius', 0, 0.5);
  num('ra', 'rectAspect', 0.3, 1.5);
  num('rratio', 'rectRatio', 0.2, 1);
  const cf = params.get('cf');
  if (cf === 'webp' || cf === 'png') out.copyFormat = cf;
  const cs = params.get('cs');
  if (cs !== null && [1, 2, 4, 8].includes(Number(cs))) out.copyScale = Number(cs);
  const qg = params.get('qg');
  if (qg != null) {
    const n = Number(qg);
    if (Number.isFinite(n)) out.quantizeGamma = Math.max(0.25, Math.min(4, n / 100));
  }
  const qd = params.get('qd');
  if (qd != null) {
    const n = Number(qd);
    if (Number.isFinite(n)) out.quantizeDither = Math.max(0, Math.min(1, n / 100));
  }
  const ls = params.get('ls');
  if (ls != null) {
    const n = Number(ls);
    if (Number.isFinite(n)) out.lumaSizeMix = Math.max(0, Math.min(1, n / 100));
  }
  const lsi = params.get('lsi');
  if (lsi != null) {
    const n = Number(lsi);
    if (n === 0 || n === 1) out.lumaSizeInvert = n;
  }
  const lsf = params.get('lsf');
  if (lsf != null) {
    const n = Number(lsf);
    if (Number.isFinite(n)) out.lumaSizeFloor = Math.max(0.05, Math.min(1, n / 100));
  }
  num('gm', 'cellGeometryMode', 0, 1);
  const glt = params.get('glt');
  if (glt != null) {
    const n = Number(glt);
    if (Number.isFinite(n)) out.stitchLumaMax = Math.max(0, Math.min(1, n / 100));
  }
  num('srm', 'stitchRevealMode', 0, 2);
  const srd = params.get('srd');
  if (srd != null) {
    const n = Number(srd);
    if (Number.isFinite(n)) out.stitchRevealDurationSec = Math.max(0.25, Math.min(30, n / 100));
  }
  const srs = params.get('srs');
  if (srs != null) {
    const n = Number(srs);
    if (Number.isFinite(n)) out.stitchRevealSeed = Math.max(0, Math.min(999999, n));
  }
  const srsc = params.get('srsc');
  if (srsc != null) {
    const n = Number(srsc);
    if (Number.isFinite(n)) out.stitchRevealScale = Math.max(0.02, Math.min(0.8, n / 1000));
  }
  const srso = params.get('srso');
  if (srso != null) {
    const n = Number(srso);
    if (Number.isFinite(n)) out.stitchRevealSoftness = Math.max(0.01, Math.min(0.35, n / 1000));
  }
  num('srba', 'stitchRevealBleedAnisotropy', 0, 12);
  const srbr = params.get('srbr');
  if (srbr != null) {
    const n = Number(srbr);
    if (Number.isFinite(n)) out.stitchRevealBleedRotation = Math.max(0, Math.min(1, n / 1000));
  }
  const srbc = params.get('srbc');
  if (srbc != null) {
    const n = Number(srbc);
    if (Number.isFinite(n)) out.stitchRevealBleedCrossFiber = Math.max(0, Math.min(1, n / 1000));
  }
  const srbd = params.get('srbd');
  if (srbd === '1') out.stitchRevealBleedDraftCoupled = 1;
  if (srbd === '0') out.stitchRevealBleedDraftCoupled = 0;
  return out;
}

/** Build URL search string from Mosaic state; omit defaults to keep URL short. */
function buildUrlStateV2(state) {
  const def = IMAGE_RECTS_URL_DEFAULTS;
  const p = new URLSearchParams();
  p.set('v', '2');
  if (state.gridSize !== def.gridSize) p.set('grid', String(state.gridSize));
  if (state.palette !== def.palette) p.set('pal', String(state.palette));
  if (state.bgShade !== def.bgShade) p.set('bg', String(state.bgShade));
  if (state.rectColorSource !== def.rectColorSource) p.set('cm', String(state.rectColorSource));
  if (state.patternWarpShade !== def.patternWarpShade) p.set('pws', String(state.patternWarpShade));
  if (state.patternWeftShade !== def.patternWeftShade) p.set('pwf', String(state.patternWeftShade));
  if (state.lumaSizeMix !== def.lumaSizeMix) p.set('ls', String(Math.round(state.lumaSizeMix * 100)));
  if (state.lumaSizeInvert !== def.lumaSizeInvert) p.set('lsi', String(state.lumaSizeInvert));
  if (state.lumaSizeFloor !== def.lumaSizeFloor) p.set('lsf', String(Math.round(state.lumaSizeFloor * 100)));
  if (state.cellGeometryMode !== def.cellGeometryMode) p.set('gm', String(state.cellGeometryMode));
  if (state.stitchLumaMax !== def.stitchLumaMax) p.set('glt', String(Math.round(state.stitchLumaMax * 100)));
  if (state.quantizeSteps !== def.quantizeSteps) p.set('q', String(state.quantizeSteps));
  if (state.quantizeMode !== def.quantizeMode) p.set('qm', String(state.quantizeMode));
  if (state.quantizeGamma !== def.quantizeGamma) p.set('qg', String(Math.round(state.quantizeGamma * 100)));
  if (state.quantizeDither !== def.quantizeDither) p.set('qd', String(Math.round(state.quantizeDither * 100)));
  if (state.patternIndex !== def.patternIndex) p.set('p', String(state.patternIndex));
  if (state.rectRadius !== def.rectRadius) p.set('rr', String(Number(state.rectRadius.toFixed(2))));
  if (state.rectAspect !== def.rectAspect) p.set('ra', String(Number(state.rectAspect.toFixed(2))));
  if (state.rectRatio !== def.rectRatio) p.set('rratio', String(Number(state.rectRatio.toFixed(2))));
  if (state.copyFormat !== def.copyFormat) p.set('cf', state.copyFormat);
  if (state.copyScale !== def.copyScale) p.set('cs', String(state.copyScale));
  if (state.menuHidden === false) p.set('menu', '1');
  if (state.mosaicBgGaps === true) p.set('gap', '1');
  if (state.patternFit != null && state.patternFit !== def.patternFit) p.set('display', state.patternFit);
  if (state.stitchRevealMode !== def.stitchRevealMode) p.set('srm', String(state.stitchRevealMode));
  if (state.stitchRevealDurationSec !== def.stitchRevealDurationSec) p.set('srd', String(Math.round(state.stitchRevealDurationSec * 100)));
  if (state.stitchRevealSeed !== def.stitchRevealSeed) p.set('srs', String(Math.round(state.stitchRevealSeed)));
  if (state.stitchRevealScale !== def.stitchRevealScale) p.set('srsc', String(Math.round(state.stitchRevealScale * 1000)));
  if (state.stitchRevealSoftness !== def.stitchRevealSoftness) p.set('srso', String(Math.round(state.stitchRevealSoftness * 1000)));
  if (state.stitchRevealBleedAnisotropy !== def.stitchRevealBleedAnisotropy) p.set('srba', String(Math.round(state.stitchRevealBleedAnisotropy)));
  if (state.stitchRevealBleedRotation !== def.stitchRevealBleedRotation) p.set('srbr', String(Math.round(state.stitchRevealBleedRotation * 1000)));
  if (state.stitchRevealBleedCrossFiber !== def.stitchRevealBleedCrossFiber) p.set('srbc', String(Math.round(state.stitchRevealBleedCrossFiber * 1000)));
  if (state.stitchRevealBleedDraftCoupled !== def.stitchRevealBleedDraftCoupled) p.set('srbd', state.stitchRevealBleedDraftCoupled ? '1' : '0');
  const s = p.toString();
  return s.length <= URL_STATE_MAX_LEN ? s : '';
}

/**
 * menuHidden: hover-reveal sidebar vs always visible (from App.jsx).
 * patternFit + onPatternFitChange: optional controlled viewport (e.g. Fit/Fill in App.jsx nav); when set, sidebar Viewport block is omitted.
 */
export default function AppV2({
  menuHidden = true,
  viewTitle = 'Mosaic',
  patternFit: patternFitProp = IMAGE_RECTS_URL_DEFAULTS.patternFit,
  onPatternFitChange,
}) {
  const patternFitExternal = typeof onPatternFitChange === 'function';
  const [imageSource, setImageSource] = useState('');
  const [mediaTextureKind, setMediaTextureKind] = useState('staticImage');
  const [gridSize, setGridSize] = useState(IMAGE_RECTS_URL_DEFAULTS.gridSize);
  const [palette, setPalette] = useState(IMAGE_RECTS_URL_DEFAULTS.palette);
  const [bgShade, setBgShade] = useState(IMAGE_RECTS_URL_DEFAULTS.bgShade);
  const [rectColorSource, setRectColorSource] = useState(IMAGE_RECTS_URL_DEFAULTS.rectColorSource);
  const [patternWarpShade, setPatternWarpShade] = useState(IMAGE_RECTS_URL_DEFAULTS.patternWarpShade);
  const [patternWeftShade, setPatternWeftShade] = useState(IMAGE_RECTS_URL_DEFAULTS.patternWeftShade);
  const [lumaSizeMix, setLumaSizeMix] = useState(IMAGE_RECTS_URL_DEFAULTS.lumaSizeMix);
  const [lumaSizeInvert, setLumaSizeInvert] = useState(IMAGE_RECTS_URL_DEFAULTS.lumaSizeInvert);
  const [lumaSizeFloor, setLumaSizeFloor] = useState(IMAGE_RECTS_URL_DEFAULTS.lumaSizeFloor);
  const [cellGeometryMode, setCellGeometryMode] = useState(IMAGE_RECTS_URL_DEFAULTS.cellGeometryMode);
  const [mosaicBgGaps, setMosaicBgGaps] = useState(IMAGE_RECTS_URL_DEFAULTS.mosaicBgGaps);
  const [patternFitInternal, setPatternFitInternal] = useState(IMAGE_RECTS_URL_DEFAULTS.patternFit);
  const patternFit = patternFitExternal ? patternFitProp : patternFitInternal;
  const setPatternFit = patternFitExternal ? onPatternFitChange : setPatternFitInternal;
  const [stitchLumaMax, setStitchLumaMax] = useState(IMAGE_RECTS_URL_DEFAULTS.stitchLumaMax);
  const [stitchRevealMode, setStitchRevealMode] = useState(IMAGE_RECTS_URL_DEFAULTS.stitchRevealMode);
  const [stitchRevealDurationSec, setStitchRevealDurationSec] = useState(IMAGE_RECTS_URL_DEFAULTS.stitchRevealDurationSec);
  const [stitchRevealSeed, setStitchRevealSeed] = useState(IMAGE_RECTS_URL_DEFAULTS.stitchRevealSeed);
  const [stitchRevealScale, setStitchRevealScale] = useState(IMAGE_RECTS_URL_DEFAULTS.stitchRevealScale);
  const [stitchRevealSoftness, setStitchRevealSoftness] = useState(IMAGE_RECTS_URL_DEFAULTS.stitchRevealSoftness);
  const [stitchRevealBleedAnisotropy, setStitchRevealBleedAnisotropy] = useState(IMAGE_RECTS_URL_DEFAULTS.stitchRevealBleedAnisotropy);
  const [stitchRevealBleedRotation, setStitchRevealBleedRotation] = useState(IMAGE_RECTS_URL_DEFAULTS.stitchRevealBleedRotation);
  const [stitchRevealBleedCrossFiber, setStitchRevealBleedCrossFiber] = useState(IMAGE_RECTS_URL_DEFAULTS.stitchRevealBleedCrossFiber);
  const [stitchRevealBleedDraftCoupled, setStitchRevealBleedDraftCoupled] = useState(IMAGE_RECTS_URL_DEFAULTS.stitchRevealBleedDraftCoupled);
  const [stitchRevealProgress, setStitchRevealProgress] = useState(1);
  const [stitchRevealPlayToken, setStitchRevealPlayToken] = useState(0);
  const [quantizeSteps, setQuantizeSteps] = useState(IMAGE_RECTS_URL_DEFAULTS.quantizeSteps); // 0 = off, 2–32 = steps
  const [quantizeMode, setQuantizeMode] = useState(IMAGE_RECTS_URL_DEFAULTS.quantizeMode);
  const [quantizeGamma, setQuantizeGamma] = useState(IMAGE_RECTS_URL_DEFAULTS.quantizeGamma);
  const [quantizeDither, setQuantizeDither] = useState(IMAGE_RECTS_URL_DEFAULTS.quantizeDither);
  const rectShade = 1; // fixed
  /** Brand-mode palette shading: locked to image luma (Color). Warp/Weft/Warp+Weft UI disabled — see docs/FEATURES.md */
  const shadeFromLocked = 0;
  const [patternIndex, setPatternIndex] = useState(IMAGE_RECTS_URL_DEFAULTS.patternIndex); // weave pattern (same list as v1)
  const [rectRadius, setRectRadius] = useState(IMAGE_RECTS_URL_DEFAULTS.rectRadius); // corner radius in cell space (0 = sharp)
  const [rectAspect, setRectAspect] = useState(IMAGE_RECTS_URL_DEFAULTS.rectAspect); // rect width/height (e.g. 34/40)
  const [rectRatio, setRectRatio] = useState(IMAGE_RECTS_URL_DEFAULTS.rectRatio); // rect scale within cell (1 = full)
  const [fps, setFps] = useState(0);
  const [copyFormat, setCopyFormat] = useState(IMAGE_RECTS_URL_DEFAULTS.copyFormat); // 'png' | 'webp'
  const [copyScale, setCopyScale] = useState(IMAGE_RECTS_URL_DEFAULTS.copyScale); // 1 | 2 | 4 | 8
  const canvasRef = useRef(null);
  const imageRectsCaptureRef = useRef(null);            // { captureAtResolution(w, h) } when canvas ready
  const appliedUrlRef = useRef(false);

  const IMAGE_RECTS_DPR = 2; // matches useImageRectsSandbox DPR
  const capToMax = useCallback((width, height) => {
    if (width <= EXPORT_MAX_DIMENSION && height <= EXPORT_MAX_DIMENSION) return [width, height];
    const r = Math.min(EXPORT_MAX_DIMENSION / width, EXPORT_MAX_DIMENSION / height);
    return [Math.round(width * r), Math.round(height * r)];
  }, []);

  /** Copy at copyScale×. Uses captureAtResolution when available so sharpness matches resolution. */
  const handleCopy2xPng = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width || !canvas.height) return;
    if (imageRectsCaptureRef.current?.captureAtResolution) {
      const displayW = canvas.width / IMAGE_RECTS_DPR;
      const displayH = canvas.height / IMAGE_RECTS_DPR;
      const [w, h] = capToMax(Math.round(displayW * copyScale), Math.round(displayH * copyScale));
      const blob = await imageRectsCaptureRef.current.captureAtResolution(w, h);
      if (blob) await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return;
    }
    const w = canvas.width * copyScale;
    const h = canvas.height * copyScale;
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const ctx = off.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(canvas, 0, 0, w, h);
    const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
    if (blob) await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  }, [copyScale, capToMax]);

  /** Copy at copyScale× as WebP. Uses captureAtResolution when available, then converts to WebP. */
  const handleCopyWebp = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width || !canvas.height) return;
    if (imageRectsCaptureRef.current?.captureAtResolution) {
      const displayW = canvas.width / IMAGE_RECTS_DPR;
      const displayH = canvas.height / IMAGE_RECTS_DPR;
      const [w, h] = capToMax(Math.round(displayW * copyScale), Math.round(displayH * copyScale));
      const pngBlob = await imageRectsCaptureRef.current.captureAtResolution(w, h);
      if (!pngBlob) return;
      const pngUrl = URL.createObjectURL(pngBlob);
      const webpBlob = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const off = document.createElement('canvas');
          off.width = img.naturalWidth;
          off.height = img.naturalHeight;
          const ctx = off.getContext('2d');
          if (!ctx) { reject(new Error('2D context failed')); return; }
          ctx.drawImage(img, 0, 0);
          off.toBlob(resolve, 'image/webp', 0.92);
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = pngUrl;
      });
      URL.revokeObjectURL(pngUrl);
      if (webpBlob) await navigator.clipboard.write([new ClipboardItem({ 'image/webp': webpBlob })]);
      return;
    }
    const w = canvas.width * copyScale;
    const h = canvas.height * copyScale;
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const ctx = off.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(canvas, 0, 0, w, h);
    const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/webp', 0.92));
    if (blob) await navigator.clipboard.write([new ClipboardItem({ 'image/webp': blob })]);
  }, [copyScale, capToMax]);

  const handleCopy = useCallback(() => {
    if (copyFormat === 'png') handleCopy2xPng();
    else handleCopyWebp();
  }, [copyFormat, handleCopy2xPng, handleCopyWebp]);

  /** Video recording (WebM or MP4). Mosaic: auto-starts when media becomes video (per tab — own hook instance). */
  const {
    isRecording,
    isProcessing,
    recordFormat,
    setRecordFormat,
    startRecording: recStart,
    stopRecording,
    pendingDownload,
    clearPendingDownload,
    recordError,
    clearRecordError,
    recordingReason,
  } = useCanvasRecorder('shaderbox-image-rects');

  const startRecording = useCallback(() => {
    recStart(canvasRef.current);
  }, [recStart]);

  const replayStitchReveal = useCallback(() => {
    setStitchRevealPlayToken((t) => t + 1);
  }, []);

  /** Ramp stitch-in progress 0→1 when Noise/Bleed is on (replay, new media, or mode change). */
  useEffect(() => {
    if (stitchRevealMode === 0) {
      setStitchRevealProgress(1);
      return;
    }
    setStitchRevealProgress(0);
    const durationMs = Math.max(0.05, stitchRevealDurationSec) * 1000;
    const start = performance.now();
    let rafId = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      setStitchRevealProgress(t);
      if (t < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [stitchRevealMode, stitchRevealPlayToken, imageSource, stitchRevealDurationSec]);

  const prevMediaKindRef = useRef(mediaTextureKind);
  /** When switching from image/GIF to video (new file or inferred kind), start recording; stop when leaving video mode. */
  useEffect(() => {
    const prev = prevMediaKindRef.current;
    prevMediaKindRef.current = mediaTextureKind;
    if (mediaTextureKind !== 'video' || !imageSource) return;
    if (prev === 'video') return;
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        const c = canvasRef.current;
        if (c?.width && c?.height) recStart(c, { reason: 'auto' });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [mediaTextureKind, imageSource, recStart]);

  useEffect(() => {
    if (mediaTextureKind === 'video') return;
    if (!isRecording) return;
    void stopRecording();
  }, [mediaTextureKind, isRecording, stopRecording]);

  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  /** Randomize Image Rects params only (grid, palette, shades, pattern, quantize, rect shape). */
  const handleRandomize = useCallback(() => {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
    const rand = (lo, hi) => lo + Math.random() * (hi - lo);
    setGridSize(pick(GRID_SNAPS));
    setPalette(randInt(0, 4));
    setBgShade(randInt(0, 4));
    setRectColorSource(randInt(0, 2));
    setPatternWarpShade(randInt(0, 4));
    setPatternWeftShade(randInt(0, 4));
    setLumaSizeMix(Number(rand(0, 1).toFixed(2)));
    setLumaSizeInvert(randInt(0, 1));
    setLumaSizeFloor(Number(rand(0.1, 0.95).toFixed(2)));
    setQuantizeSteps(randInt(0, 32));
    setQuantizeMode(randInt(0, 1));
    setQuantizeGamma(Number(rand(0.55, 1.65).toFixed(2)));
    setQuantizeDither(Number(rand(0, 0.85).toFixed(2)));
    setPatternIndex(randInt(0, PATTERNS.length - 1));
    setRectRadius(Number(rand(0.05, 0.45).toFixed(2)));
    setRectAspect(Number(rand(0.3, 1.5).toFixed(2)));
    setRectRatio(Number(rand(0.3, 1).toFixed(2)));
    setCellGeometryMode(randInt(0, 1));
    setStitchLumaMax(Number(rand(0.15, 0.75).toFixed(2)));
    setStitchRevealMode(randInt(0, 2));
    setStitchRevealDurationSec(Number(rand(1, 5).toFixed(1)));
    setStitchRevealSeed(Math.floor(Math.random() * 999999));
    setStitchRevealScale(Number(rand(0.05, 0.35).toFixed(2)));
    setStitchRevealSoftness(Number(rand(0.03, 0.14).toFixed(2)));
    setStitchRevealBleedAnisotropy(Number(rand(1.5, 8).toFixed(1)));
    setStitchRevealBleedRotation(Number(rand(0, 1).toFixed(2)));
    setStitchRevealBleedCrossFiber(Number(rand(0, 0.6).toFixed(2)));
    setStitchRevealBleedDraftCoupled(randInt(0, 1));
  }, []);

  /** Reset all Image Rects controls to defaults. */
  const handleReset = useCallback(() => {
    setGridSize(IMAGE_RECTS_URL_DEFAULTS.gridSize);
    setPalette(IMAGE_RECTS_URL_DEFAULTS.palette);
    setBgShade(IMAGE_RECTS_URL_DEFAULTS.bgShade);
    setRectColorSource(IMAGE_RECTS_URL_DEFAULTS.rectColorSource);
    setPatternWarpShade(IMAGE_RECTS_URL_DEFAULTS.patternWarpShade);
    setPatternWeftShade(IMAGE_RECTS_URL_DEFAULTS.patternWeftShade);
    setLumaSizeMix(IMAGE_RECTS_URL_DEFAULTS.lumaSizeMix);
    setLumaSizeInvert(IMAGE_RECTS_URL_DEFAULTS.lumaSizeInvert);
    setLumaSizeFloor(IMAGE_RECTS_URL_DEFAULTS.lumaSizeFloor);
    setCellGeometryMode(IMAGE_RECTS_URL_DEFAULTS.cellGeometryMode);
    setMosaicBgGaps(IMAGE_RECTS_URL_DEFAULTS.mosaicBgGaps);
    setPatternFit(IMAGE_RECTS_URL_DEFAULTS.patternFit);
    setStitchLumaMax(IMAGE_RECTS_URL_DEFAULTS.stitchLumaMax);
    setQuantizeSteps(IMAGE_RECTS_URL_DEFAULTS.quantizeSteps);
    setQuantizeMode(IMAGE_RECTS_URL_DEFAULTS.quantizeMode);
    setQuantizeGamma(IMAGE_RECTS_URL_DEFAULTS.quantizeGamma);
    setQuantizeDither(IMAGE_RECTS_URL_DEFAULTS.quantizeDither);
    setPatternIndex(IMAGE_RECTS_URL_DEFAULTS.patternIndex);
    setRectRadius(IMAGE_RECTS_URL_DEFAULTS.rectRadius);
    setRectAspect(IMAGE_RECTS_URL_DEFAULTS.rectAspect);
    setRectRatio(IMAGE_RECTS_URL_DEFAULTS.rectRatio);
    setCopyFormat(IMAGE_RECTS_URL_DEFAULTS.copyFormat);
    setCopyScale(IMAGE_RECTS_URL_DEFAULTS.copyScale);
    setStitchRevealMode(IMAGE_RECTS_URL_DEFAULTS.stitchRevealMode);
    setStitchRevealDurationSec(IMAGE_RECTS_URL_DEFAULTS.stitchRevealDurationSec);
    setStitchRevealSeed(IMAGE_RECTS_URL_DEFAULTS.stitchRevealSeed);
    setStitchRevealScale(IMAGE_RECTS_URL_DEFAULTS.stitchRevealScale);
    setStitchRevealSoftness(IMAGE_RECTS_URL_DEFAULTS.stitchRevealSoftness);
    setStitchRevealBleedAnisotropy(IMAGE_RECTS_URL_DEFAULTS.stitchRevealBleedAnisotropy);
    setStitchRevealBleedRotation(IMAGE_RECTS_URL_DEFAULTS.stitchRevealBleedRotation);
    setStitchRevealBleedCrossFiber(IMAGE_RECTS_URL_DEFAULTS.stitchRevealBleedCrossFiber);
    setStitchRevealBleedDraftCoupled(IMAGE_RECTS_URL_DEFAULTS.stitchRevealBleedDraftCoupled);
    setMediaTextureKind('staticImage');
    setImageSource((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
  }, [setPatternFit]);

  /** On mount: parse URL and apply to state (once). */
  useEffect(() => {
    if (appliedUrlRef.current) return;
    appliedUrlRef.current = true;
    const q = parseUrlStateV2(window.location.search);
    if (Object.keys(q).length === 0) return;
    if (q.gridSize != null) setGridSize(GRID_SNAPS.includes(q.gridSize) ? q.gridSize : GRID_SNAPS[getGridSizeIndex(q.gridSize)]);
    if (q.palette != null) setPalette(q.palette);
    if (q.bgShade != null) setBgShade(q.bgShade);
    if (q.rectColorSource != null) setRectColorSource(q.rectColorSource);
    if (q.patternWarpShade != null) setPatternWarpShade(q.patternWarpShade);
    if (q.patternWeftShade != null) setPatternWeftShade(q.patternWeftShade);
    if (q.lumaSizeMix != null) setLumaSizeMix(q.lumaSizeMix);
    if (q.lumaSizeInvert != null) setLumaSizeInvert(q.lumaSizeInvert);
    if (q.lumaSizeFloor != null) setLumaSizeFloor(q.lumaSizeFloor);
    if (q.cellGeometryMode != null) setCellGeometryMode(q.cellGeometryMode);
    if (q.stitchLumaMax != null) setStitchLumaMax(q.stitchLumaMax);
    if (q.quantizeSteps != null) setQuantizeSteps(q.quantizeSteps);
    if (q.quantizeMode != null) setQuantizeMode(q.quantizeMode);
    if (q.quantizeGamma != null) setQuantizeGamma(q.quantizeGamma);
    if (q.quantizeDither != null) setQuantizeDither(q.quantizeDither);
    if (q.patternIndex != null) setPatternIndex(q.patternIndex);
    if (q.rectRadius != null) setRectRadius(q.rectRadius);
    if (q.rectAspect != null) setRectAspect(q.rectAspect);
    if (q.rectRatio != null) setRectRatio(q.rectRatio);
    if (q.copyFormat != null) setCopyFormat(q.copyFormat);
    if (q.copyScale != null) setCopyScale(q.copyScale);
    if (q.mosaicBgGaps != null) setMosaicBgGaps(!!q.mosaicBgGaps);
    if (q.stitchRevealMode != null) setStitchRevealMode(q.stitchRevealMode);
    if (q.stitchRevealDurationSec != null) setStitchRevealDurationSec(q.stitchRevealDurationSec);
    if (q.stitchRevealSeed != null) setStitchRevealSeed(q.stitchRevealSeed);
    if (q.stitchRevealScale != null) setStitchRevealScale(q.stitchRevealScale);
    if (q.stitchRevealSoftness != null) setStitchRevealSoftness(q.stitchRevealSoftness);
    if (q.stitchRevealBleedAnisotropy != null) setStitchRevealBleedAnisotropy(q.stitchRevealBleedAnisotropy);
    if (q.stitchRevealBleedRotation != null) setStitchRevealBleedRotation(q.stitchRevealBleedRotation);
    if (q.stitchRevealBleedCrossFiber != null) setStitchRevealBleedCrossFiber(q.stitchRevealBleedCrossFiber);
    if (q.stitchRevealBleedDraftCoupled != null) setStitchRevealBleedDraftCoupled(q.stitchRevealBleedDraftCoupled);
    if (q.patternFit != null) {
      if (typeof onPatternFitChange === 'function') onPatternFitChange(q.patternFit);
      else setPatternFitInternal(q.patternFit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount; onPatternFitChange is stable (setState)
  }, []);

  /** Sync state to URL (debounced). */
  const urlSyncTimeoutRef = useRef(null);
  useEffect(() => {
    urlSyncTimeoutRef.current = setTimeout(() => {
      const search = buildUrlStateV2({
        gridSize, palette, bgShade, rectColorSource, quantizeSteps, quantizeMode, quantizeGamma, quantizeDither, patternIndex,
        patternWarpShade, patternWeftShade, lumaSizeMix, lumaSizeInvert, lumaSizeFloor, cellGeometryMode, stitchLumaMax,
        rectRadius, rectAspect, rectRatio, copyFormat, copyScale, menuHidden, mosaicBgGaps, patternFit,
        stitchRevealMode, stitchRevealDurationSec, stitchRevealSeed, stitchRevealScale, stitchRevealSoftness,
        stitchRevealBleedAnisotropy, stitchRevealBleedRotation, stitchRevealBleedCrossFiber, stitchRevealBleedDraftCoupled,
      });
      const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
      if (window.location.pathname + (window.location.search || '') !== url) {
        window.history.replaceState(null, '', url);
      }
    }, 400);
    return () => { clearTimeout(urlSyncTimeoutRef.current); };
  }, [gridSize, palette, bgShade, rectColorSource, quantizeSteps, quantizeMode, quantizeGamma, quantizeDither, patternIndex, patternWarpShade, patternWeftShade, lumaSizeMix, lumaSizeInvert, lumaSizeFloor, cellGeometryMode, stitchLumaMax, rectRadius, rectAspect, rectRatio, copyFormat, copyScale, menuHidden, mosaicBgGaps, patternFit, stitchRevealMode, stitchRevealDurationSec, stitchRevealSeed, stitchRevealScale, stitchRevealSoftness, stitchRevealBleedAnisotropy, stitchRevealBleedRotation, stitchRevealBleedCrossFiber, stitchRevealBleedDraftCoupled]);

  /** Keyboard shortcuts: Mod+C copy, Mod+Shift+R / F5 reload (no presets in v2). */
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.closest('input, select, textarea')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'c') {
        e.preventDefault();
        handleCopy();
        return;
      }
      if ((mod && e.shiftKey && e.key === 'R') || e.key === 'F5') {
        e.preventDefault();
        handleReload();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCopy, handleReload]);

  const patternOptions = PATTERNS.map((p, i) => ({
    value: i,
    label: p.name,
    icon: WEAVE_ICONS[p.id] ?? 'texture',
  }));
  const shadeOptions = (prefix) => SHADE_NAMES.map((name, i) => ({ value: i, label: prefix ? `${prefix}: ${name}` : name }));

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaTextureKind(inferMediaTextureKindFromFile(file));
    setImageSource((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (imageSource) URL.revokeObjectURL(imageSource);
    };
  }, [imageSource]);

  /** In-flow: min-h-0 + h-full bounds the column so tall control stacks scroll inside the sidebar (flex default min-height:auto would grow past the shell). */
  /** Fixed overlay: `top-9` matches App shell nav (`min-h-9`); do not use `top-0` or the menu draws over the nav. */
  const sidebarClass = menuHidden
    ? 'fixed left-0 top-9 z-10 flex h-[calc(100dvh-2.25rem)] w-72 flex-col gap-3 overflow-y-auto overflow-x-auto border-r border-border-subtle bg-surface px-3 py-3'
    : 'flex h-full min-h-0 w-72 shrink-0 flex-col gap-3 overflow-y-auto overflow-x-auto overscroll-y-contain border-r border-border-subtle bg-surface px-3 py-3';

  return (
    <div className="flex h-full min-h-0 flex-row overflow-hidden bg-surface">
      <motion.aside
        className={sidebarClass}
        initial={false}
        animate={{ opacity: menuHidden ? 0 : 1 }}
        whileHover={menuHidden ? { opacity: 1 } : undefined}
        transition={{ duration: 0.2 }}
        aria-label="Mosaic menu"
      >
        <h1 className={`shrink-0 text-left ${typeBase} font-semibold tracking-[-0.01em] text-text`}>
          {viewTitle}
        </h1>
        <div className="flex flex-col gap-3">
          {!patternFitExternal && (
            <div className={`${sidebarGroup} ${sidebarGroupSticky}`}>
              <div className={sidebarGroupTitle}>Viewport</div>
              <div className="flex flex-wrap items-center gap-2">
                <GroupIcon name="fit_screen" title="Canvas size in stage" />
                <SegmentedControl>
                  <div className="flex h-full">
                    <SegmentedControlButton
                      active={patternFit === 'fit'}
                      aria-pressed={patternFit === 'fit'}
                      aria-label="Fit canvas in view"
                      onClick={() => setPatternFit('fit')}
                    >
                      Fit
                    </SegmentedControlButton>
                    <SegmentedControlButton
                      active={patternFit === 'fill'}
                      aria-pressed={patternFit === 'fill'}
                      aria-label="Fill canvas to available space"
                      onClick={() => setPatternFit('fill')}
                    >
                      Fill
                    </SegmentedControlButton>
                  </div>
                </SegmentedControl>
              </div>
            </div>
          )}
          <div className={`${sidebarGroup} ${sidebarGroupSticky}`}>
            <div className={sidebarGroupTitle}>Actions</div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={btnGhost} onClick={handleReload} aria-label="Reload">
                <Icon name="refresh" className={iconMd} />
                <span>Reload</span>
              </button>
              <button type="button" className={btnGhost} onClick={handleRandomize} aria-label="Randomize parameters" title="Randomize grid, palette, shades, pattern, quantize, rect shape">
                <Icon name="shuffle" className={iconMd} />
                <span>Randomize</span>
              </button>
              <button type="button" className={btnGhost} onClick={handleReset} aria-label="Reset parameters to defaults" title="Reset Mosaic parameters to defaults">
                <Icon name="restart_alt" className={iconResetGlyphMd} />
                <span>Reset</span>
              </button>
              <SegmentedControl>
                <div className="flex h-full">
                  {COPY_SCALES.map((s) => (
                    <SegmentedControlButton
                      key={s}
                      active={copyScale === s}
                      aria-pressed={copyScale === s}
                      aria-label={`Copy resolution: ${s}×`}
                      onClick={() => setCopyScale(s)}
                    >
                      {s}×
                    </SegmentedControlButton>
                  ))}
                </div>
                <div className="flex h-full">
                  {['png', 'webp'].map((fmt) => (
                    <SegmentedControlButton
                      key={fmt}
                      format
                      active={copyFormat === fmt}
                      aria-pressed={copyFormat === fmt}
                      aria-label={`Format: ${fmt}`}
                      onClick={() => setCopyFormat(fmt)}
                    >
                      {fmt}
                    </SegmentedControlButton>
                  ))}
                </div>
              </SegmentedControl>
              <div className="inline-flex shrink-0 items-center gap-1" role="group" aria-label="Copy actions">
                <IconButton size="sm" title={`Copy canvas at ${copyScale}× as ${copyFormat.toUpperCase()}`} aria-label={`Copy ${copyFormat.toUpperCase()}`} onClick={handleCopy}>
                  <Icon name="content_copy" className={iconSm} />
                </IconButton>
                {(copyScale !== IMAGE_RECTS_URL_DEFAULTS.copyScale || copyFormat !== IMAGE_RECTS_URL_DEFAULTS.copyFormat) && (
                  <IconButton
                    size="resetSm"
                    title="Reset copy scale and format to defaults"
                    aria-label="Reset copy scale and format to defaults"
                    onClick={() => {
                      setCopyScale(IMAGE_RECTS_URL_DEFAULTS.copyScale);
                      setCopyFormat(IMAGE_RECTS_URL_DEFAULTS.copyFormat);
                    }}
                  >
                    <Icon name="restart_alt" className={iconResetGlyph} />
                  </IconButton>
                )}
              </div>
              <SegmentedControl>
                <div className="flex h-full">
                  {(supportsMP4 ? ['mp4', 'webm'] : ['webm']).map((fmt) => (
                    <SegmentedControlButton
                      key={fmt}
                      format
                      active={recordFormat === fmt}
                      aria-pressed={recordFormat === fmt}
                      aria-label={`Record format: ${fmt}`}
                      onClick={() => setRecordFormat(fmt)}
                      disabled={isRecording}
                    >
                      {fmt}
                    </SegmentedControlButton>
                  ))}
                </div>
              </SegmentedControl>
              <div className="inline-flex shrink-0 items-center gap-1" role="group" aria-label="Recording control">
                <IconButton size="sm" variant={isRecording || isProcessing ? 'danger' : 'default'} title={isProcessing ? 'Processing…' : isRecording ? `${recordingReason === 'auto' ? 'Auto-recording video — ' : ''}Stop and download ${recordFormat.toUpperCase()}` : `Record canvas as ${recordFormat.toUpperCase()}`} aria-label={isProcessing ? 'Processing video' : isRecording ? 'Stop recording' : 'Start recording'} onClick={isRecording ? stopRecording : startRecording} disabled={isProcessing}>
                  <Icon name={isProcessing ? 'hourglass_empty' : isRecording ? 'stop' : 'videocam'} className={iconSm} />
                </IconButton>
              </div>
              <label className={btnGhost + ' cursor-pointer'}>
                <Icon name="upload_file" className={iconMd} />
                <span>Pick media</span>
                <input
                  type="file"
                  accept="image/*,video/*,image/gif"
                  className="sr-only"
                  onChange={handleFileChange}
                  aria-label="Pick image, video, or GIF from desktop"
                />
              </label>
            </div>
          </div>
          <div className={sidebarGroup}>
            <div className={sidebarGroupTitle}>Weave & colorway</div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="tune" title="Mode" />
              <AppSelect
                id="rect-color-source-v2"
                labelText="Rect color from"
                value={rectColorSource}
                onValueChange={(v) => setRectColorSource(Number(v))}
                defaultValue={IMAGE_RECTS_URL_DEFAULTS.rectColorSource}
                onReset={() => setRectColorSource(IMAGE_RECTS_URL_DEFAULTS.rectColorSource)}
                options={RECT_COLOR_SOURCE_OPTIONS}
                title="Image RGB, brand palette, or warp/weft pattern colors"
                placeholder="Color"
              />
              <span className={`${controlLabel} ${typeLabel}`} title="Weave pattern">Weave</span>
              <AppSelect id="weave-pattern-v2" labelText="Weave pattern" value={patternIndex} onValueChange={(v) => setPatternIndex(Number(v))} defaultValue={IMAGE_RECTS_URL_DEFAULTS.patternIndex} onReset={() => setPatternIndex(IMAGE_RECTS_URL_DEFAULTS.patternIndex)} options={patternOptions} title="Weave pattern" placeholder="Weave" />
              <div className="flex items-center gap-1" role="group" aria-label="Colorway palette">
                {PALETTE_SWATCH_COLORS.map((color, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`${paletteSwatch} ${palette === i ? paletteSwatchSelected : paletteSwatchUnselected}`}
                    style={{
                      backgroundColor: color,
                      borderColor: palette === i ? 'var(--color-accent)' : 'var(--color-border-subtle)',
                    }}
                    title={PALETTE_NAMES[i]}
                    aria-label={`Colorway: ${PALETTE_NAMES[i]}`}
                    aria-pressed={palette === i}
                    onClick={() => setPalette(i)}
                  />
                ))}
                {palette !== IMAGE_RECTS_URL_DEFAULTS.palette && (
                  <IconButton size="resetSm" onClick={() => setPalette(IMAGE_RECTS_URL_DEFAULTS.palette)} title="Reset palette" aria-label="Reset palette to default">
                    <Icon name="restart_alt" className={iconResetGlyph} />
                  </IconButton>
                )}
              </div>
              <AppSelect id="bg-shade-v2" labelText="Background shade" value={bgShade} onValueChange={(v) => setBgShade(Number(v))} defaultValue={IMAGE_RECTS_URL_DEFAULTS.bgShade} onReset={() => setBgShade(IMAGE_RECTS_URL_DEFAULTS.bgShade)} options={shadeOptions('BG')} title="Background shade" placeholder="BG" />
              {rectColorSource === 2 && (
                <>
                  <AppSelect
                    id="pattern-warp-shade-v2"
                    labelText="Warp thread shade"
                    value={patternWarpShade}
                    onValueChange={(v) => setPatternWarpShade(Number(v))}
                    defaultValue={IMAGE_RECTS_URL_DEFAULTS.patternWarpShade}
                    onReset={() => setPatternWarpShade(IMAGE_RECTS_URL_DEFAULTS.patternWarpShade)}
                    options={shadeOptions('Warp')}
                    title="Palette shade for warp-oriented rects"
                    placeholder="Warp"
                  />
                  <AppSelect
                    id="pattern-weft-shade-v2"
                    labelText="Weft thread shade"
                    value={patternWeftShade}
                    onValueChange={(v) => setPatternWeftShade(Number(v))}
                    defaultValue={IMAGE_RECTS_URL_DEFAULTS.patternWeftShade}
                    onReset={() => setPatternWeftShade(IMAGE_RECTS_URL_DEFAULTS.patternWeftShade)}
                    options={shadeOptions('Weft')}
                    title="Palette shade for weft-oriented rects"
                    placeholder="Weft"
                  />
                </>
              )}
            </div>
          </div>
          <div className={sidebarGroup}>
            <div className={sidebarGroupTitle}>Quantize</div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <GroupIcon name="gradient" title="Quantize" />
                <Label.Root className="sr-only" htmlFor="quantize-slider-v2">Quantize steps</Label.Root>
                <SliderWithInput
                  id="quantize-slider-v2"
                  value={quantizeSteps}
                  onValueChange={setQuantizeSteps}
                  defaultValue={IMAGE_RECTS_URL_DEFAULTS.quantizeSteps}
                  onReset={() => setQuantizeSteps(IMAGE_RECTS_URL_DEFAULTS.quantizeSteps)}
                  min={0}
                  max={32}
                  step={1}
                  format={(n) => (n === 0 ? 'off' : String(n))}
                  parse={(s) => { if (s === 'off' || s === '') return 0; const n = Number(s); return Number.isFinite(n) ? n : null; }}
                  aria-label="Quantize steps (0 = off)"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <AppSelect
                  id="quantize-mode-v2"
                  labelText="Quantize in color space"
                  value={quantizeMode}
                  onValueChange={(v) => setQuantizeMode(Number(v))}
                  defaultValue={IMAGE_RECTS_URL_DEFAULTS.quantizeMode}
                  onReset={() => setQuantizeMode(IMAGE_RECTS_URL_DEFAULTS.quantizeMode)}
                  options={QUANTIZE_MODE_OPTIONS}
                  title="Band colors in RGB (per channel) or HSV (posterize hue/sat/value)"
                  placeholder="Space"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <GroupIcon name="contrast" title="Gamma before banding" />
                <Label.Root className="sr-only" htmlFor="quantize-gamma-v2">Quantize gamma</Label.Root>
                <SliderWithInput
                  id="quantize-gamma-v2"
                  value={quantizeGamma}
                  onValueChange={setQuantizeGamma}
                  defaultValue={IMAGE_RECTS_URL_DEFAULTS.quantizeGamma}
                  onReset={() => setQuantizeGamma(IMAGE_RECTS_URL_DEFAULTS.quantizeGamma)}
                  min={0.25}
                  max={4}
                  step={0.05}
                  format={(n) => n.toFixed(2)}
                  aria-label="Gamma curve before quantize (1 = neutral)"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <GroupIcon name="blur_linear" title="Dither" />
                <Label.Root className="sr-only" htmlFor="quantize-dither-v2">Quantize dither</Label.Root>
                <SliderWithInput
                  id="quantize-dither-v2"
                  value={quantizeDither}
                  onValueChange={setQuantizeDither}
                  defaultValue={IMAGE_RECTS_URL_DEFAULTS.quantizeDither}
                  onReset={() => setQuantizeDither(IMAGE_RECTS_URL_DEFAULTS.quantizeDither)}
                  min={0}
                  max={1}
                  step={0.05}
                  format={(n) => n.toFixed(2)}
                  aria-label="Per-cell dither before rounding (0 = off)"
                />
              </div>
            </div>
          </div>
          <div className={sidebarGroup}>
            <div className={sidebarGroupTitle}>Brightness & stitches</div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <span className={`${typeLabel} text-text-muted`}>Size from brightness (per cell)</span>
                <div className="flex flex-wrap items-center gap-2">
                  <GroupIcon name="brightness_6" title="Luma drives size" />
                  <Label.Root className="sr-only" htmlFor="luma-size-mix-v2">Brightness size mix</Label.Root>
                  <SliderWithInput
                    id="luma-size-mix-v2"
                    value={lumaSizeMix}
                    onValueChange={setLumaSizeMix}
                    defaultValue={IMAGE_RECTS_URL_DEFAULTS.lumaSizeMix}
                    onReset={() => setLumaSizeMix(IMAGE_RECTS_URL_DEFAULTS.lumaSizeMix)}
                    min={0}
                    max={1}
                    step={0.05}
                    format={(n) => n.toFixed(2)}
                    aria-label="How much image brightness scales each rect (0 = off)"
                  />
                </div>
                <AppSelect
                  id="luma-size-invert-v2"
                  labelText="Bright vs dark smaller"
                  value={lumaSizeInvert}
                  onValueChange={(v) => setLumaSizeInvert(Number(v))}
                  defaultValue={IMAGE_RECTS_URL_DEFAULTS.lumaSizeInvert}
                  onReset={() => setLumaSizeInvert(IMAGE_RECTS_URL_DEFAULTS.lumaSizeInvert)}
                  options={[
                    { value: 0, label: 'Dark smaller' },
                    { value: 1, label: 'Bright smaller' },
                  ]}
                  title="Which end of brightness maps to smaller rects"
                  placeholder="Polarity"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Label.Root className="sr-only" htmlFor="luma-size-floor-v2">Min rect scale</Label.Root>
                  <SliderWithInput
                    id="luma-size-floor-v2"
                    value={lumaSizeFloor}
                    onValueChange={setLumaSizeFloor}
                    defaultValue={IMAGE_RECTS_URL_DEFAULTS.lumaSizeFloor}
                    onReset={() => setLumaSizeFloor(IMAGE_RECTS_URL_DEFAULTS.lumaSizeFloor)}
                    min={0.05}
                    max={1}
                    step={0.05}
                    format={(n) => n.toFixed(2)}
                    aria-label="Smallest rect scale vs base (at dark or bright end)"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-2">
                <span className={`${typeLabel} text-text-muted`}>Stitch vs plain (by image darkness)</span>
                <AppSelect
                  id="cell-geometry-v2"
                  labelText="Cell geometry mode"
                  value={cellGeometryMode}
                  onValueChange={(v) => setCellGeometryMode(Number(v))}
                  defaultValue={IMAGE_RECTS_URL_DEFAULTS.cellGeometryMode}
                  onReset={() => setCellGeometryMode(IMAGE_RECTS_URL_DEFAULTS.cellGeometryMode)}
                  options={CELL_GEOMETRY_OPTIONS}
                  title="Weave rects everywhere, or plain cells except where the image is dark enough"
                  placeholder="Geometry"
                />
                {cellGeometryMode === 1 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <GroupIcon name="texture" title="Stitch darkness cutoff" />
                    <Label.Root className="sr-only" htmlFor="stitch-luma-max-v2">Max brightness for stitches</Label.Root>
                    <SliderWithInput
                      id="stitch-luma-max-v2"
                      value={stitchLumaMax}
                      onValueChange={setStitchLumaMax}
                      defaultValue={IMAGE_RECTS_URL_DEFAULTS.stitchLumaMax}
                      onReset={() => setStitchLumaMax(IMAGE_RECTS_URL_DEFAULTS.stitchLumaMax)}
                      min={0}
                      max={1}
                      step={0.02}
                      format={(n) => n.toFixed(2)}
                      aria-label="Weave stitch only if cell luma is at or below this (plain tile if brighter)"
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-2">
                <span className={`${typeLabel} text-text-muted`}>Stitch-in (from blank)</span>
                <AppSelect
                  id="stitch-reveal-mode-v2"
                  labelText="Reveal order"
                  value={stitchRevealMode}
                  onValueChange={(v) => setStitchRevealMode(Number(v))}
                  defaultValue={IMAGE_RECTS_URL_DEFAULTS.stitchRevealMode}
                  onReset={() => setStitchRevealMode(IMAGE_RECTS_URL_DEFAULTS.stitchRevealMode)}
                  options={STITCH_REVEAL_MODE_OPTIONS}
                  title="Off: full mosaic immediately. Noise: FBM order. Bleed: streaks along fibers (like weave dye bleed)."
                  placeholder="Stitch-in"
                />
                {stitchRevealMode > 0 && (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Label.Root className="sr-only" htmlFor="stitch-reveal-dur-v2">Reveal duration</Label.Root>
                      <SliderWithInput
                        id="stitch-reveal-dur-v2"
                        value={stitchRevealDurationSec}
                        onValueChange={setStitchRevealDurationSec}
                        defaultValue={IMAGE_RECTS_URL_DEFAULTS.stitchRevealDurationSec}
                        onReset={() => setStitchRevealDurationSec(IMAGE_RECTS_URL_DEFAULTS.stitchRevealDurationSec)}
                        min={0.25}
                        max={12}
                        step={0.25}
                        format={(n) => `${n.toFixed(2)}s`}
                        aria-label="Stitch-in duration in seconds"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" className={btnGhost} onClick={replayStitchReveal} aria-label="Replay stitch-in animation" title="Replay from blank">
                        <Icon name="replay" className={iconMd} />
                        <span>Replay</span>
                      </button>
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={() => {
                          setStitchRevealSeed(Math.floor(Math.random() * 999999));
                          replayStitchReveal();
                        }}
                        aria-label="New random seed and replay"
                        title="New seed"
                      >
                        <Icon name="shuffle" className={iconMd} />
                        <span>New seed</span>
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <GroupIcon name="blur_on" title="Spatial scale for reveal pattern" />
                      <Label.Root className="sr-only" htmlFor="stitch-reveal-scale-v2">Reveal pattern scale</Label.Root>
                      <SliderWithInput
                        id="stitch-reveal-scale-v2"
                        value={stitchRevealScale}
                        onValueChange={setStitchRevealScale}
                        defaultValue={IMAGE_RECTS_URL_DEFAULTS.stitchRevealScale}
                        onReset={() => setStitchRevealScale(IMAGE_RECTS_URL_DEFAULTS.stitchRevealScale)}
                        min={0.02}
                        max={0.5}
                        step={0.01}
                        format={(n) => n.toFixed(2)}
                        aria-label="Noise / bleed pattern scale on the grid"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <GroupIcon name="gradient" title="Edge softness between revealed and not yet" />
                      <Label.Root className="sr-only" htmlFor="stitch-reveal-soft-v2">Reveal softness</Label.Root>
                      <SliderWithInput
                        id="stitch-reveal-soft-v2"
                        value={stitchRevealSoftness}
                        onValueChange={setStitchRevealSoftness}
                        defaultValue={IMAGE_RECTS_URL_DEFAULTS.stitchRevealSoftness}
                        onReset={() => setStitchRevealSoftness(IMAGE_RECTS_URL_DEFAULTS.stitchRevealSoftness)}
                        min={0.01}
                        max={0.25}
                        step={0.005}
                        format={(n) => n.toFixed(3)}
                        aria-label="Softness of the stitch-in ramp per cell"
                      />
                    </div>
                    {stitchRevealMode === 2 && (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <GroupIcon name="texture" title="Bleed streak length" />
                          <Label.Root className="sr-only" htmlFor="stitch-reveal-bleed-ani-v2">Bleed anisotropy</Label.Root>
                          <SliderWithInput
                            id="stitch-reveal-bleed-ani-v2"
                            value={stitchRevealBleedAnisotropy}
                            onValueChange={setStitchRevealBleedAnisotropy}
                            defaultValue={IMAGE_RECTS_URL_DEFAULTS.stitchRevealBleedAnisotropy}
                            onReset={() => setStitchRevealBleedAnisotropy(IMAGE_RECTS_URL_DEFAULTS.stitchRevealBleedAnisotropy)}
                            min={0.5}
                            max={12}
                            step={0.25}
                            format={(n) => n.toFixed(2)}
                            aria-label="Bleed streak anisotropy"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <GroupIcon name="rotate_right" title="Bleed direction" />
                          <Label.Root className="sr-only" htmlFor="stitch-reveal-bleed-rot-v2">Bleed rotation</Label.Root>
                          <SliderWithInput
                            id="stitch-reveal-bleed-rot-v2"
                            value={stitchRevealBleedRotation}
                            onValueChange={setStitchRevealBleedRotation}
                            defaultValue={IMAGE_RECTS_URL_DEFAULTS.stitchRevealBleedRotation}
                            onReset={() => setStitchRevealBleedRotation(IMAGE_RECTS_URL_DEFAULTS.stitchRevealBleedRotation)}
                            min={0}
                            max={1}
                            step={0.005}
                            format={(n) => n.toFixed(2)}
                            aria-label="Rotation of bleed streaks (turns)"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <GroupIcon name="blur_linear" title="Mix isotropic noise into bleed" />
                          <Label.Root className="sr-only" htmlFor="stitch-reveal-bleed-xf-v2">Cross-fiber mix</Label.Root>
                          <SliderWithInput
                            id="stitch-reveal-bleed-xf-v2"
                            value={stitchRevealBleedCrossFiber}
                            onValueChange={setStitchRevealBleedCrossFiber}
                            defaultValue={IMAGE_RECTS_URL_DEFAULTS.stitchRevealBleedCrossFiber}
                            onReset={() => setStitchRevealBleedCrossFiber(IMAGE_RECTS_URL_DEFAULTS.stitchRevealBleedCrossFiber)}
                            min={0}
                            max={1}
                            step={0.02}
                            format={(n) => n.toFixed(2)}
                            aria-label="Cross-fiber noise mix for bleed"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className={`${toggleBtn} ${stitchRevealBleedDraftCoupled ? toggleBtnActive : ''}`}
                            aria-pressed={!!stitchRevealBleedDraftCoupled}
                            aria-label="Draft-coupled bleed: streaks follow warp vs weft"
                            title="When on, horizontal vs vertical streak blend follows the weave draft"
                            onClick={() => setStitchRevealBleedDraftCoupled((v) => (v ? 0 : 1))}
                          >
                            <Icon name="view_quilt" className={iconSm} />
                            <span className={typeLabel}>Draft-coupled bleed</span>
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-2">
                <button
                  type="button"
                  className={`${toggleBtn} ${mosaicBgGaps ? toggleBtnActive : ''}`}
                  aria-pressed={mosaicBgGaps}
                  aria-label="Background gaps: show canvas between dark stitch cells"
                  title="Non-stitch cells show background (legacy v5)"
                  onClick={() => {
                    setMosaicBgGaps((g) => {
                      const next = !g;
                      if (next) setCellGeometryMode(1);
                      else setCellGeometryMode(IMAGE_RECTS_URL_DEFAULTS.cellGeometryMode);
                      return next;
                    });
                  }}
                >
                  <Icon name="grid_4x4" className={iconSm} />
                  <span className={typeLabel}>Background gaps</span>
                </button>
              </div>
            </div>
          </div>
          <div className={sidebarGroup}>
            <div className={sidebarGroupTitle}>Grid</div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="grid_on" title="Grid size" />
              <Label.Root className="sr-only" htmlFor="grid-slider-v2">Grid size</Label.Root>
              <SliderWithInput
                id="grid-slider-v2"
                value={gridSize}
                onValueChange={setGridSize}
                defaultValue={IMAGE_RECTS_URL_DEFAULTS.gridSize}
                onReset={() => setGridSize(IMAGE_RECTS_URL_DEFAULTS.gridSize)}
                min={8}
                max={256}
                step={1}
                snapValues={GRID_SNAPS}
                snapPointCount={GRID_SNAPS.length}
                aria-label="Grid size (cells)"
              />
            </div>
          </div>
        </div>
      </motion.aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          <ImageRectsCanvas
            imageSource={imageSource}
            mediaTextureKind={mediaTextureKind}
            gridSize={gridSize}
            palette={palette}
            bgShade={bgShade}
            rectColorSource={rectColorSource}
            quantizeSteps={quantizeSteps}
            quantizeMode={quantizeMode}
            quantizeGamma={quantizeGamma}
            quantizeDither={quantizeDither}
            rectShade={rectShade}
            shadeFrom={shadeFromLocked}
            patternWarpShade={patternWarpShade}
            patternWeftShade={patternWeftShade}
            patternIndex={patternIndex}
            patterns={PATTERNS}
            rectRadius={rectRadius}
            rectAspect={rectAspect}
            rectRatio={rectRatio}
            lumaSizeMix={lumaSizeMix}
            lumaSizeInvert={lumaSizeInvert}
            lumaSizeFloor={lumaSizeFloor}
            cellGeometryMode={cellGeometryMode}
            stitchLumaMax={stitchLumaMax}
            nonStitchShowsBg={mosaicBgGaps}
            stitchRevealMode={stitchRevealMode}
            stitchRevealProgress={stitchRevealProgress}
            stitchRevealSeed={stitchRevealSeed}
            stitchRevealScale={stitchRevealScale}
            stitchRevealSoftness={stitchRevealSoftness}
            stitchRevealBleedAnisotropy={stitchRevealBleedAnisotropy}
            stitchRevealBleedRotation={stitchRevealBleedRotation}
            stitchRevealBleedCrossFiber={stitchRevealBleedCrossFiber}
            stitchRevealBleedDraftCoupled={stitchRevealBleedDraftCoupled}
            patternFit={patternFit}
            onFpsChange={setFps}
            onCanvasRef={(el) => { canvasRef.current = el; }}
            onCaptureReady={(api) => { imageRectsCaptureRef.current = api; }}
          />
        </main>

        <footer className="relative h-[100px] shrink-0 overflow-hidden border-t border-border-subtle bg-surface-elevated">
          <div className="flex h-full min-h-9 flex-wrap items-center gap-2 overflow-y-auto px-3 py-2">
            <span className={pill}>
              {imageSource
                ? (mediaTextureKind === 'video' ? 'Video playing' : mediaTextureKind === 'gif' ? 'GIF playing' : 'Image loaded')
                : 'Pick image, video, or GIF'}
            </span>
            <span className={pill}>Weave: {PATTERNS[patternIndex]?.name ?? '—'}</span>
            <span className={pill}>Color: {RECT_COLOR_SOURCE_OPTIONS.find((o) => o.value === rectColorSource)?.label ?? '—'}</span>
            {rectColorSource === 2 && (
              <span className={pill}>W/W: {SHADE_NAMES[patternWarpShade]} / {SHADE_NAMES[patternWeftShade]}</span>
            )}
            {lumaSizeMix > 0.01 ? (
              <span className={pill}>Luma size {lumaSizeMix.toFixed(2)}{lumaSizeInvert ? ' (bright−)' : ' (dark−)'}</span>
            ) : null}
            {cellGeometryMode === 1 ? (
              <span className={pill}>Stitches ≤ {stitchLumaMax.toFixed(2)}</span>
            ) : null}
            {stitchRevealMode > 0 ? (
              <span className={pill}>
                Stitch-in: {STITCH_REVEAL_MODE_OPTIONS.find((o) => o.value === stitchRevealMode)?.label ?? '—'} · {stitchRevealProgress >= 0.999 ? 'done' : `${Math.round(stitchRevealProgress * 100)}%`}
              </span>
            ) : null}
            <span className={pill}>Quantize: {quantizeSteps === 0 ? 'off' : `${quantizeSteps} · ${QUANTIZE_MODE_OPTIONS[quantizeMode]?.label ?? 'RGB'}`}</span>
            {quantizeSteps >= 2 ? (
              <>
                <span className={pill}>γ {quantizeGamma.toFixed(2)}</span>
                <span className={pill}>Dither {quantizeDither.toFixed(2)}</span>
              </>
            ) : null}
            <span className={pill}>{PALETTE_NAMES[palette]}</span>
            <span className={pill}>BG: {bgShade === 4 ? <><Icon name={SHADE_TRANSPARENT_ICON} className={iconXs} /></> : SHADE_NAMES[bgShade]}</span>
            <span className={pill}>Grid: {gridSize}</span>
            <div className="ml-auto flex items-center gap-2">
              <span className={pill}>{fps || '--'} fps</span>
              <span className={pill}>WebGL 1</span>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-linear-to-t from-surface-elevated to-transparent" aria-hidden />
        </footer>
      </div>
      <RecordingDownloadBanner
        pending={pendingDownload}
        onDismiss={clearPendingDownload}
        recordError={recordError}
        onClearError={clearRecordError}
      />
    </div>
  );
}
