/**
 * AppV2 — Image to colored rects. Pick an image; shader draws a grid of rounded rects
 * colored by the image (one sample per cell). Weave pattern sets rect orientation (warp/weft) per cell.
 * Inherits v1 patterns: copy (PNG/SVG), WebM recording, URL state, shortcuts, SliderWithInput, WEAVE_ICONS, Reload/Randomize.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import * as Select from '@radix-ui/react-select';
import * as Label from '@radix-ui/react-label';
import { ImageRectsCanvas } from './components/ImageRectsCanvas';
import { SliderWithInput } from './components/SliderWithInput';
import { useCanvasRecorder, supportsMP4 } from './hooks/useCanvasRecorder';
import { PATTERNS } from './patterns';
import { GRID_SNAPS, getGridSizeIndex, PNG_COPY_SCALE, URL_STATE_MAX_LEN, WEAVE_ICONS } from './constants';
import {
  PALETTE_NAMES,
  PALETTE_SWATCH_COLORS,
  SHADE_NAMES,
  SHADE_TRANSPARENT_ICON,
  typeBase,
  typeLabel,
  typeControl,
  controlLabel,
  iconSm,
  iconMd,
  iconLg,
  iconXs,
  btnGhost,
  selectTrigger,
  selectContent,
  selectItem,
  pill,
  sidebarGroup,
  sidebarGroupSticky,
  sidebarGroupTitle,
} from './uiConstants';

/** Material Symbol icon (site-wide font). */
const Icon = ({ name, className = '' }) => (
  <span className={`icon inline-block shrink-0 ${className}`} aria-hidden>{name}</span>
);
/** Icon-only group header; optional xs lock superscript when locked. */
const GroupIcon = ({ name, title, locked = false }) => (
  <span title={title} className="relative inline-flex shrink-0">
    <Icon name={name} className={`${iconLg} text-text-muted`} />
    {locked && (
      <span className="absolute -top-0.5 -right-0.5 leading-none" aria-hidden title="Locked">
        <Icon name="lock" className={`${iconXs} text-text-muted`} />
      </span>
    )}
  </span>
);

function AppSelect({ value, onValueChange, options, placeholder, title, id: idProp, labelText }) {
  const selected = options.find((o) => Number(o.value) === Number(value));
  const label = labelText ?? title;
  return (
    <>
      {idProp && label && <Label.Root className="sr-only" htmlFor={idProp}>{label}</Label.Root>}
      <Select.Root value={String(value)} onValueChange={(v) => onValueChange(typeof selected?.value === 'number' ? Number(v) : v)}>
        <Select.Trigger id={idProp} className={selectTrigger} title={title} aria-label={title ?? placeholder}>
          <span className="flex min-w-0 items-center gap-1.5">
            {selected?.icon && <Icon name={selected.icon} className={`shrink-0 ${iconMd} text-text-muted`} />}
            <Select.Value placeholder={placeholder} />
          </span>
          <Icon name="expand_more" className={`${iconLg} opacity-60`} />
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className={selectContent} position="popper" sideOffset={4}>
            <Select.Viewport>
              {options.map((opt, i) => (
                <Select.Item key={opt.id ?? i} className={selectItem} value={String(opt.value)}>
                  {opt.icon && <Icon name={opt.icon} className={`mr-1.5 shrink-0 ${iconMd} text-text-muted`} />}
                  <Select.ItemText>{opt.label}</Select.ItemText>
                  <Select.ItemIndicator className="absolute right-2 inline-flex items-center" />
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </>
  );
}

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
  num('grid', 'gridSize', 8, 96);
  num('pal', 'palette', 0, 3);
  num('bg', 'bgShade', 0, 4);
  num('cm', 'colorizeMode', 0, 1);
  num('q', 'quantizeSteps', 0, 32);
  num('sf', 'shadeFrom', 0, 3);
  num('p', 'patternIndex', 0, PATTERNS.length - 1);
  num('rr', 'rectRadius', 0, 0.5);
  num('ra', 'rectAspect', 0.3, 1.5);
  num('rratio', 'rectRatio', 0.2, 1);
  const cf = params.get('cf');
  if (cf === 'svg' || cf === 'png') out.copyFormat = cf;
  return out;
}

/** Build URL search string from Image Rects state; omit defaults to keep URL short. */
function buildUrlStateV2(state) {
  const def = {
    gridSize: 32, palette: 0, bgShade: 2, colorizeMode: 1, quantizeSteps: 0, shadeFrom: 0,
    patternIndex: 0, rectRadius: 0.18, rectAspect: 0.85, rectRatio: 1, copyFormat: 'png',
  };
  const p = new URLSearchParams();
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
  const s = p.toString();
  return s.length <= URL_STATE_MAX_LEN ? s : '';
}

export default function AppV2() {
  const [imageSource, setImageSource] = useState('');
  const [gridSize, setGridSize] = useState(32);
  const [palette, setPalette] = useState(0);
  const [bgShade, setBgShade] = useState(2);
  const [colorizeMode, setColorizeMode] = useState(true); // true = colorization, false = brand
  const [quantizeSteps, setQuantizeSteps] = useState(0);  // 0 = off, 2–32 = steps
  const rectShade = 1; // fixed; shadeFrom controls brand mode shading
  const [shadeFrom, setShadeFrom] = useState(0);          // 0=color, 1=warp, 2=weft, 3=warp+weft (brand)
  const [patternIndex, setPatternIndex] = useState(0);    // weave pattern (same list as v1)
  const [rectRadius, setRectRadius] = useState(0.18);     // corner radius in cell space (0 = sharp)
  const [rectAspect, setRectAspect] = useState(0.85);     // rect width/height (e.g. 34/40)
  const [rectRatio, setRectRatio] = useState(1.0);        // rect scale within cell (1 = full)
  const [fps, setFps] = useState(0);
  const [copyFormat, setCopyFormat] = useState('png');   // 'png' | 'svg'
  const canvasRef = useRef(null);
  const appliedUrlRef = useRef(false);

  /** Copy canvas at PNG_COPY_SCALE× resolution as PNG to clipboard (v1–v4). */
  const handleCopy2xPng = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width || !canvas.height) return;
    const scale = PNG_COPY_SCALE;
    const w = canvas.width * scale;
    const h = canvas.height * scale;
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const ctx = off.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(canvas, 0, 0, w, h);
    const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
    if (blob) await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  }, []);

  /** Build SVG with canvas as embedded raster (2×), copy as image/svg+xml and text/plain (same as v1). */
  const handleCopySvg = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width || !canvas.height) return;
    const scale = 2;
    const w = canvas.width * scale;
    const h = canvas.height * scale;
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const ctx = off.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(canvas, 0, 0, w, h);
    const dataUrl = off.toDataURL('image/png');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><image href="${dataUrl}" width="${w}" height="${h}"/></svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/svg+xml': blob,
        'text/plain': new Blob([svg], { type: 'text/plain' }),
      }),
    ]);
  }, []);

  const handleCopy = useCallback(() => {
    if (copyFormat === 'png') handleCopy2xPng();
    else handleCopySvg();
  }, [copyFormat, handleCopy2xPng, handleCopySvg]);

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
  }, []);

  /** Sync state to URL (debounced). */
  const urlSyncTimeoutRef = useRef(null);
  useEffect(() => {
    urlSyncTimeoutRef.current = setTimeout(() => {
      const search = buildUrlStateV2({
        gridSize, palette, bgShade, colorizeMode, quantizeSteps, shadeFrom, patternIndex,
        rectRadius, rectAspect, rectRatio, copyFormat,
      });
      const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
      if (window.location.pathname + (window.location.search || '') !== url) {
        window.history.replaceState(null, '', url);
      }
    }, 400);
    return () => { clearTimeout(urlSyncTimeoutRef.current); };
  }, [gridSize, palette, bgShade, colorizeMode, quantizeSteps, shadeFrom, patternIndex, rectRadius, rectAspect, rectRatio, copyFormat]);

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

  return (
    <div className="flex h-full min-h-0 flex-row overflow-hidden bg-surface">
      <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto overflow-x-auto border-r border-border-subtle bg-surface px-3 py-3" aria-label="Image Rects controls">
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
              <div className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border-subtle bg-surface-elevated overflow-hidden">
                <div className="flex h-full">
                  {['png', 'svg'].map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      className={`flex min-w-[36px] items-center justify-center px-2 ${typeControl} uppercase transition-colors border-r border-border-subtle last:border-r-0 ${copyFormat === fmt ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:bg-surface-hover hover:text-text'}`}
                      aria-pressed={copyFormat === fmt}
                      aria-label={`Format: ${fmt}`}
                      onClick={() => setCopyFormat(fmt)}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-elevated text-text-secondary transition-colors hover:border-accent hover:bg-accent/10 hover:text-accent focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                  title={copyFormat === 'png' ? `Copy canvas at ${PNG_COPY_SCALE}× as PNG` : 'Copy as SVG (canvas embedded as image)'}
                  aria-label={copyFormat === 'png' ? 'Copy PNG' : 'Copy SVG'}
                  onClick={handleCopy}
                >
                  <Icon name="content_copy" className={iconSm} />
                </button>
              </div>
              <div className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border-subtle bg-surface-elevated overflow-hidden">
                <div className="flex h-full">
                  {(supportsMP4 ? ['mp4', 'webm'] : ['webm']).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      className={`flex min-w-[36px] items-center justify-center px-2 ${typeControl} uppercase transition-colors border-r border-border-subtle last:border-r-0 ${recordFormat === fmt ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:bg-surface-hover hover:text-text'}`}
                      aria-pressed={recordFormat === fmt}
                      aria-label={`Record format: ${fmt}`}
                      onClick={() => setRecordFormat(fmt)}
                      disabled={isRecording}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${isRecording || isProcessing ? 'border-error bg-error/15 text-error' : 'border-border-subtle bg-surface-elevated text-text-secondary hover:border-accent hover:bg-accent/10 hover:text-accent'} focus:outline-none focus:ring-1 focus:ring-accent/20`}
                  title={isProcessing ? 'Processing…' : isRecording ? `Stop and download ${recordFormat.toUpperCase()}` : `Record canvas as ${recordFormat.toUpperCase()}`}
                  aria-label={isProcessing ? 'Processing video' : isRecording ? 'Stop recording' : 'Start recording'}
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessing}
                >
                  <Icon name={isProcessing ? 'hourglass_empty' : isRecording ? 'stop' : 'videocam'} className={iconSm} />
                </button>
              </div>
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
                options={MODE_OPTIONS}
                title="Rect color source"
                placeholder="Mode"
              />
              <span className={`${controlLabel} ${typeLabel}`} title="Weave pattern">Weave</span>
              <AppSelect id="weave-pattern-v2" labelText="Weave pattern" value={patternIndex} onValueChange={setPatternIndex} options={patternOptions} title="Weave pattern" placeholder="Weave" />
              <div className="flex items-center gap-1" role="group" aria-label="Colorway palette">
                {PALETTE_SWATCH_COLORS.map((color, i) => (
                  <button
                    key={i}
                    type="button"
                    className="h-7 w-7 shrink-0 rounded-md border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40"
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
              </div>
              <AppSelect id="bg-shade-v2" labelText="Background shade" value={bgShade} onValueChange={(v) => setBgShade(Number(v))} options={shadeOptions('BG')} title="Background shade" placeholder="BG" />
              {!colorizeMode && (
                <AppSelect
                  id="shade-from-v2"
                  labelText="Shade from (brand: color vs warp/weft)"
                  value={shadeFrom}
                  onValueChange={(v) => setShadeFrom(Number(v))}
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
      </aside>

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
