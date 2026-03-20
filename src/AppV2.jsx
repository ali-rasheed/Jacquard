/**
 * AppV2 — Image to colored rects. Pick an image; shader draws a grid of rounded rects
 * colored by the image (one sample per cell). Weave pattern sets rect orientation (warp/weft) per cell.
 * Inherits v1 patterns: copy (PNG/WebP), WebM recording, URL state, shortcuts, SliderWithInput, WEAVE_ICONS, Reload/Randomize.
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
  btnGhost,
  pill,
  sidebarGroup,
  sidebarGroupSticky,
  sidebarGroupTitle,
  paletteSwatch,
  paletteSwatchSelected,
  paletteSwatchUnselected,
} from './uiConstants';
import { Icon, GroupIcon, AppSelect, SegmentedControl, SegmentedControlButton, IconButton } from './components/ui';

const MODE_OPTIONS = [
  { value: 'colorize', label: 'Colorization' },
  { value: 'brand', label: 'Brand colors' },
];

const SHADE_FROM_OPTIONS = [
  { value: 0, label: 'Color' },
  { value: 1, label: 'Warp' },
  { value: 2, label: 'Weft' },
  { value: 3, label: 'Warp+Weft' },
];

/** Parse URL search params into Image Rects state. imageSource is not in URL (blob). */
function parseUrlStateV2(search) {
  const params = new URLSearchParams(search);
  const out = {};
  const num = (paramKey, stateKey, min, max) => {
    const v = params.get(paramKey);
    if (v == null) return;
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    out[stateKey] = min != null && max != null ? Math.max(min, Math.min(max, n)) : n;
  };
  const v = params.get('v');
  if (v != null && v !== '2') return out;
  num('grid', 'gridSize', 8, 96);
  num('pal', 'palette', 0, 3);
  num('bg', 'bgShade', 0, 5);
  num('cm', 'colorizeMode', 0, 1);
  num('q', 'quantizeSteps', 0, 32);
  num('sf', 'shadeFrom', 0, 3);
  num('p', 'patternIndex', 0, PATTERNS.length - 1);
  num('rr', 'rectRadius', 0, 0.5);
  num('ra', 'rectAspect', 0.3, 1.5);
  num('rratio', 'rectRatio', 0.2, 1);
  const cf = params.get('cf');
  if (cf === 'webp' || cf === 'png') out.copyFormat = cf;
  const cs = params.get('cs');
  if (cs !== null && [1, 2, 4, 8].includes(Number(cs))) out.copyScale = Number(cs);
  return out;
}

/** Build URL search string from Image Rects state; omit defaults to keep URL short. */
function buildUrlStateV2(state) {
  const def = IMAGE_RECTS_URL_DEFAULTS;
  const p = new URLSearchParams();
  p.set('v', '2');
  if (state.gridSize !== def.gridSize) p.set('grid', String(state.gridSize));
  if (state.palette !== def.palette) p.set('pal', String(state.palette));
  if (state.bgShade !== def.bgShade) p.set('bg', String(state.bgShade));
  if (state.colorizeMode !== def.colorizeMode) p.set('cm', state.colorizeMode ? '1' : '0');
  if (state.quantizeSteps !== def.quantizeSteps) p.set('q', String(state.quantizeSteps));
  if (state.shadeFrom !== def.shadeFrom) p.set('sf', String(state.shadeFrom));
  if (state.patternIndex !== def.patternIndex) p.set('p', String(state.patternIndex));
  if (state.rectRadius !== def.rectRadius) p.set('rr', String(Number(state.rectRadius.toFixed(2))));
  if (state.rectAspect !== def.rectAspect) p.set('ra', String(Number(state.rectAspect.toFixed(2))));
  if (state.rectRatio !== def.rectRatio) p.set('rratio', String(Number(state.rectRatio.toFixed(2))));
  if (state.copyFormat !== def.copyFormat) p.set('cf', state.copyFormat);
  if (state.copyScale !== def.copyScale) p.set('cs', String(state.copyScale));
  if (state.menuHidden === false) p.set('menu', '1');
  const s = p.toString();
  return s.length <= URL_STATE_MAX_LEN ? s : '';
}

/** menuHidden: when true, sidebar is hidden until hover (fixed overlay); when false, always visible. Passed from App.jsx for v2 (Image Rects) to match v1/v3/v4 toggle. */
export default function AppV2({ menuHidden = true }) {
  const [imageSource, setImageSource] = useState('');
  const [gridSize, setGridSize] = useState(IMAGE_RECTS_URL_DEFAULTS.gridSize);
  const [palette, setPalette] = useState(IMAGE_RECTS_URL_DEFAULTS.palette);
  const [bgShade, setBgShade] = useState(IMAGE_RECTS_URL_DEFAULTS.bgShade);
  const [colorizeMode, setColorizeMode] = useState(IMAGE_RECTS_URL_DEFAULTS.colorizeMode); // true = colorization, false = brand
  const [quantizeSteps, setQuantizeSteps] = useState(IMAGE_RECTS_URL_DEFAULTS.quantizeSteps); // 0 = off, 2–32 = steps
  const rectShade = 1; // fixed; shadeFrom controls brand mode shading
  const [shadeFrom, setShadeFrom] = useState(IMAGE_RECTS_URL_DEFAULTS.shadeFrom); // 0=color, 1=warp, 2=weft, 3=warp+weft (brand)
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

  /** Video recording (WebM or MP4). */
  const { isRecording, isProcessing, recordFormat, setRecordFormat, startRecording: recStart, stopRecording } = useCanvasRecorder('shaderbox-image-rects');

  const startRecording = useCallback(() => {
    recStart(canvasRef.current);
  }, [recStart]);

  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  /** Randomize Image Rects params only (grid, palette, shades, pattern, quantize, rect shape). */
  const handleRandomize = useCallback(() => {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
    const rand = (lo, hi) => lo + Math.random() * (hi - lo);
    setGridSize(pick(GRID_SNAPS));
    setPalette(randInt(0, 3));
    setBgShade(randInt(0, 4));
    setColorizeMode(Math.random() < 0.5);
    setQuantizeSteps(randInt(0, 32));
    setShadeFrom(randInt(0, 3));
    setPatternIndex(randInt(0, PATTERNS.length - 1));
    setRectRadius(Number(rand(0.05, 0.45).toFixed(2)));
    setRectAspect(Number(rand(0.3, 1.5).toFixed(2)));
    setRectRatio(Number(rand(0.3, 1).toFixed(2)));
  }, []);

  /** Reset all Image Rects controls to defaults. */
  const handleReset = useCallback(() => {
    setGridSize(IMAGE_RECTS_URL_DEFAULTS.gridSize);
    setPalette(IMAGE_RECTS_URL_DEFAULTS.palette);
    setBgShade(IMAGE_RECTS_URL_DEFAULTS.bgShade);
    setColorizeMode(IMAGE_RECTS_URL_DEFAULTS.colorizeMode);
    setQuantizeSteps(IMAGE_RECTS_URL_DEFAULTS.quantizeSteps);
    setShadeFrom(IMAGE_RECTS_URL_DEFAULTS.shadeFrom);
    setPatternIndex(IMAGE_RECTS_URL_DEFAULTS.patternIndex);
    setRectRadius(IMAGE_RECTS_URL_DEFAULTS.rectRadius);
    setRectAspect(IMAGE_RECTS_URL_DEFAULTS.rectAspect);
    setRectRatio(IMAGE_RECTS_URL_DEFAULTS.rectRatio);
    setCopyFormat(IMAGE_RECTS_URL_DEFAULTS.copyFormat);
    setCopyScale(IMAGE_RECTS_URL_DEFAULTS.copyScale);
    setImageSource((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
  }, []);

  /** On mount: parse URL and apply to state (once). */
  useEffect(() => {
    if (appliedUrlRef.current) return;
    appliedUrlRef.current = true;
    const q = parseUrlStateV2(window.location.search);
    if (Object.keys(q).length === 0) return;
    if (q.gridSize != null) setGridSize(GRID_SNAPS.includes(q.gridSize) ? q.gridSize : GRID_SNAPS[getGridSizeIndex(q.gridSize)]);
    if (q.palette != null) setPalette(q.palette);
    if (q.bgShade != null) setBgShade(q.bgShade);
    if (q.colorizeMode != null) setColorizeMode(q.colorizeMode === 1);
    if (q.quantizeSteps != null) setQuantizeSteps(q.quantizeSteps);
    if (q.shadeFrom != null) setShadeFrom(q.shadeFrom);
    if (q.patternIndex != null) setPatternIndex(q.patternIndex);
    if (q.rectRadius != null) setRectRadius(q.rectRadius);
    if (q.rectAspect != null) setRectAspect(q.rectAspect);
    if (q.rectRatio != null) setRectRatio(q.rectRatio);
    if (q.copyFormat != null) setCopyFormat(q.copyFormat);
    if (q.copyScale != null) setCopyScale(q.copyScale);
  }, []);

  /** Sync state to URL (debounced). */
  const urlSyncTimeoutRef = useRef(null);
  useEffect(() => {
    urlSyncTimeoutRef.current = setTimeout(() => {
      const search = buildUrlStateV2({
        gridSize, palette, bgShade, colorizeMode, quantizeSteps, shadeFrom, patternIndex,
        rectRadius, rectAspect, rectRatio, copyFormat, copyScale, menuHidden,
      });
      const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
      if (window.location.pathname + (window.location.search || '') !== url) {
        window.history.replaceState(null, '', url);
      }
    }, 400);
    return () => { clearTimeout(urlSyncTimeoutRef.current); };
  }, [gridSize, palette, bgShade, colorizeMode, quantizeSteps, shadeFrom, patternIndex, rectRadius, rectAspect, rectRatio, copyFormat, copyScale, menuHidden]);

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

  const sidebarClass = menuHidden
    ? 'fixed left-0 top-0 z-10 flex h-full w-72 flex-col gap-3 overflow-y-auto overflow-x-auto border-r border-border-subtle bg-surface px-3 py-3'
    : 'flex w-72 shrink-0 flex-col gap-3 overflow-y-auto overflow-x-auto border-r border-border-subtle bg-surface px-3 py-3';

  return (
    <div className="flex h-full min-h-0 flex-row overflow-hidden bg-surface">
      <motion.aside
        className={sidebarClass}
        initial={false}
        animate={{ opacity: menuHidden ? 0 : 1 }}
        whileHover={menuHidden ? { opacity: 1 } : undefined}
        transition={{ duration: 0.2 }}
        aria-label="Image Rects controls"
      >
        <h1 className={`shrink-0 ${typeBase} font-semibold tracking-[-0.01em] text-text`}>
          Image to Colored Rects
        </h1>
        <div className="flex flex-col gap-3">
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
              <button type="button" className={btnGhost} onClick={handleReset} aria-label="Reset parameters to defaults" title="Reset Image Rects parameters to defaults">
                <Icon name="restart_alt" className={iconMd} />
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
                <IconButton size="sm" title={`Copy canvas at ${copyScale}× as ${copyFormat.toUpperCase()}`} aria-label={`Copy ${copyFormat.toUpperCase()}`} onClick={handleCopy}>
                  <Icon name="content_copy" className={iconSm} />
                </IconButton>
                {(copyScale !== IMAGE_RECTS_URL_DEFAULTS.copyScale || copyFormat !== IMAGE_RECTS_URL_DEFAULTS.copyFormat) && (
                  <IconButton
                    size="sm"
                    title="Reset copy scale and format"
                    aria-label="Reset copy scale and format"
                    onClick={() => {
                      setCopyScale(IMAGE_RECTS_URL_DEFAULTS.copyScale);
                      setCopyFormat(IMAGE_RECTS_URL_DEFAULTS.copyFormat);
                    }}
                  >
                    <Icon name="restart_alt" className={iconSm} />
                  </IconButton>
                )}
              </SegmentedControl>
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
                <IconButton size="sm" variant={isRecording || isProcessing ? 'danger' : 'default'} title={isProcessing ? 'Processing…' : isRecording ? `Stop and download ${recordFormat.toUpperCase()}` : `Record canvas as ${recordFormat.toUpperCase()}`} aria-label={isProcessing ? 'Processing video' : isRecording ? 'Stop recording' : 'Start recording'} onClick={isRecording ? stopRecording : startRecording} disabled={isProcessing}>
                  <Icon name={isProcessing ? 'hourglass_empty' : isRecording ? 'stop' : 'videocam'} className={iconSm} />
                </IconButton>
              </SegmentedControl>
              <label className={btnGhost + ' cursor-pointer'}>
                <Icon name="upload_file" className={iconMd} />
                <span>Pick image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleFileChange}
                  aria-label="Pick an image from desktop"
                />
              </label>
            </div>
          </div>
          <div className={sidebarGroup}>
            <div className={sidebarGroupTitle}>Weave & colorway</div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="tune" title="Mode" />
              <AppSelect
                id="colorize-mode"
                labelText="Rect color source (mode)"
                value={colorizeMode ? 'colorize' : 'brand'}
                onValueChange={(v) => setColorizeMode(v === 'colorize')}
                defaultValue={IMAGE_RECTS_URL_DEFAULTS.colorizeMode ? 'colorize' : 'brand'}
                onReset={() => setColorizeMode(IMAGE_RECTS_URL_DEFAULTS.colorizeMode)}
                options={MODE_OPTIONS}
                title="Rect color source"
                placeholder="Mode"
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
                  <IconButton size="sm" onClick={() => setPalette(IMAGE_RECTS_URL_DEFAULTS.palette)} title="Reset palette" aria-label="Reset palette to default">
                    <Icon name="restart_alt" className={iconSm} />
                  </IconButton>
                )}
              </div>
              <AppSelect id="bg-shade-v2" labelText="Background shade" value={bgShade} onValueChange={(v) => setBgShade(Number(v))} defaultValue={IMAGE_RECTS_URL_DEFAULTS.bgShade} onReset={() => setBgShade(IMAGE_RECTS_URL_DEFAULTS.bgShade)} options={shadeOptions('BG')} title="Background shade" placeholder="BG" />
              {!colorizeMode && (
                <AppSelect
                  id="shade-from-v2"
                  labelText="Shade from (brand: color vs warp/weft)"
                  value={shadeFrom}
                  onValueChange={(v) => setShadeFrom(Number(v))}
                  defaultValue={IMAGE_RECTS_URL_DEFAULTS.shadeFrom}
                  onReset={() => setShadeFrom(IMAGE_RECTS_URL_DEFAULTS.shadeFrom)}
                  options={SHADE_FROM_OPTIONS}
                  title="Shade from (brand: color vs warp/weft)"
                  placeholder="Shade from"
                />
              )}
            </div>
          </div>
          <div className={sidebarGroup}>
            <div className={sidebarGroupTitle}>Quantize</div>
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
          </div>
          <div className={sidebarGroup}>
            <div className={sidebarGroupTitle}>Rect shape</div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <GroupIcon name="rounded_corner" title="Corner radius" />
                <Label.Root className="sr-only" htmlFor="rect-radius-v2">Corner radius</Label.Root>
                <SliderWithInput
                  id="rect-radius-v2"
                  value={rectRadius}
                  onValueChange={setRectRadius}
                  defaultValue={IMAGE_RECTS_URL_DEFAULTS.rectRadius}
                  onReset={() => setRectRadius(IMAGE_RECTS_URL_DEFAULTS.rectRadius)}
                  min={0}
                  max={0.5}
                  step={0.01}
                  format={(n) => n.toFixed(2)}
                  aria-label="Corner radius"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <GroupIcon name="aspect_ratio" title="Aspect ratio (width/height)" />
                <Label.Root className="sr-only" htmlFor="rect-aspect-v2">Aspect ratio</Label.Root>
                <SliderWithInput
                  id="rect-aspect-v2"
                  value={rectAspect}
                  onValueChange={setRectAspect}
                  defaultValue={IMAGE_RECTS_URL_DEFAULTS.rectAspect}
                  onReset={() => setRectAspect(IMAGE_RECTS_URL_DEFAULTS.rectAspect)}
                  min={0.3}
                  max={1.5}
                  step={0.05}
                  format={(n) => n.toFixed(2)}
                  aria-label="Rect aspect (width/height)"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <GroupIcon name="crop_square" title="Rect ratio (scale in cell)" />
                <Label.Root className="sr-only" htmlFor="rect-ratio-v2">Rect ratio</Label.Root>
                <SliderWithInput
                  id="rect-ratio-v2"
                  value={rectRatio}
                  onValueChange={setRectRatio}
                  defaultValue={IMAGE_RECTS_URL_DEFAULTS.rectRatio}
                  onReset={() => setRectRatio(IMAGE_RECTS_URL_DEFAULTS.rectRatio)}
                  min={0.2}
                  max={1}
                  step={0.05}
                  format={(n) => n.toFixed(2)}
                  aria-label="Rect ratio (scale in cell)"
                />
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
                max={64}
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
        <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
          <ImageRectsCanvas
            imageSource={imageSource}
            gridSize={gridSize}
            palette={palette}
            bgShade={bgShade}
            colorizeMode={colorizeMode}
            quantizeSteps={quantizeSteps}
            rectShade={rectShade}
            shadeFrom={shadeFrom}
            patternIndex={patternIndex}
            patterns={PATTERNS}
            rectRadius={rectRadius}
            rectAspect={rectAspect}
            rectRatio={rectRatio}
            onFpsChange={setFps}
            onCanvasRef={(el) => { canvasRef.current = el; }}
            onCaptureReady={(api) => { imageRectsCaptureRef.current = api; }}
          />
        </main>

        <footer className="relative h-[100px] shrink-0 overflow-hidden border-t border-border-subtle bg-surface-elevated">
          <div className="flex h-full min-h-9 flex-wrap items-center gap-2 overflow-y-auto px-3 py-2">
            <span className={pill}>{imageSource ? 'Image loaded' : 'Pick an image'}</span>
            <span className={pill}>Weave: {PATTERNS[patternIndex]?.name ?? '—'}</span>
            <span className={pill}>{colorizeMode ? 'Colorization' : 'Brand'}</span>
            {!colorizeMode && (
              <span className={pill}>Shade: {SHADE_FROM_OPTIONS.find((o) => o.value === shadeFrom)?.label ?? 'Color'}</span>
            )}
            <span className={pill}>Quantize: {quantizeSteps === 0 ? 'off' : quantizeSteps}</span>
            <span className={pill}>Radius: {rectRadius.toFixed(2)}</span>
            <span className={pill}>Aspect: {rectAspect.toFixed(2)}</span>
            <span className={pill}>Rect: {rectRatio.toFixed(2)}</span>
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
    </div>
  );
}
