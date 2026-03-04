/**
 * Shader Sandbox — ENS Weaving Draft.
 * WebGL canvas reads shaders from src/shaders/*.glsl. Controls: Radix Select + Slider.
 */
import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import * as Select from '@radix-ui/react-select';
import * as Slider from '@radix-ui/react-slider';
import * as Label from '@radix-ui/react-label';
import { ShaderCanvas } from './components/ShaderCanvas';
import { PATTERNS } from './patterns';
import {
  PALETTE_NAMES,
  PALETTE_SWATCH_COLORS,
  SHADE_NAMES,
  typeBase,
  typeLabel,
  typeControl,
  typeValue,
  typeCaption,
  iconSm,
  iconMd,
  iconLg,
  btnGhost,
  selectTrigger,
  selectContent,
  selectItem,
  pill,
  sidebarGroup,
  sidebarGroupTitle,
} from './uiConstants';

/** Lazy load to avoid circular/order-dependent init in production bundle (TDZ). */
const AppV2 = lazy(() => import('./AppV2.jsx'));

/** Material Symbol icon per weave pattern id — used in weave dropdown only. */
const WEAVE_ICONS = {
  'plain': 'grid_on',
  'matt-regular': 'view_module',
  'matt-rib-irregular': 'widgets',
  'weft-rib-regular': 'horizontal_rule',
  'satin': 'blur_linear',
  'sateen': 'gradient',
  'twill-2-2': 'trending_up',
  'twill-3-3': 'trending_up',
  'weft-rib-irregular': 'view_agenda',
  'warp-rib-regular': 'view_column',
  'warp-rib-irregular': 'view_column',
  'basket': 'apps',
  'point-twill': 'call_split',
  'royal-oxford': 'category',
  'houndstooth': 'pattern',
  'herringbone': 'compare_arrows',
  'pattern-738': 'dashboard',
  'ens-vertical-pairs': 'view_column',
  'curtain': 'vertical_split',
};

/** Flat = same start/end shade so the gradient is a solid. */
const flatGrad = (shade) => ({ startShade: shade, endShade: shade, direction: 0, range: [0, 100] });
/** Two-stop gradient config. */
const grad = (wStart, wEnd, wfStart, wfEnd, wDir = 0, wfDir = 0) => ({
  warpGradient: { startShade: wStart, endShade: wEnd, direction: wDir, range: [0, 100] },
  weftGradient: { startShade: wfStart, endShade: wfEnd, direction: wfDir, range: [0, 100] },
});

/**
 * Presets: weave + colorway + shades + grad/no-grad. Selecting one applies all state.
 * ~Half use bg = warp, half use bg = weft. Contrast: the other thread is tuned so the weave reads clearly (avoid muddy mid-on-mid).
 */
const PRESETS = [
  { id: 'citrine-plain-flat', label: 'Citrine · Plain · Flat', pattern: 0, palette: 0, bgShade: 1, warpShade: 1, weftShade: 3, warpGradient: flatGrad(1), weftGradient: flatGrad(3) },
  { id: 'garnet-twill-flat', label: 'Garnet · 2/2 Twill · Flat', pattern: 6, palette: 1, bgShade: 3, warpShade: 0, weftShade: 3, warpGradient: flatGrad(0), weftGradient: flatGrad(3) },
  { id: 'lapis-satin-flat', label: 'Lapis · Satin · Flat', pattern: 4, palette: 2, bgShade: 1, warpShade: 1, weftShade: 3, warpGradient: flatGrad(1), weftGradient: flatGrad(3) },
  { id: 'peridot-houndstooth-flat', label: 'Peridot · Houndstooth · Flat', pattern: 11, palette: 3, bgShade: 0, warpShade: 0, weftShade: 2, warpGradient: flatGrad(0), weftGradient: flatGrad(2) },
  { id: 'citrine-plain-grad', label: 'Citrine · Plain · Grad', pattern: 0, palette: 0, bgShade: 3, warpShade: 1, weftShade: 3, ...grad(0, 3, 1, 2) },
  { id: 'garnet-twill-grad', label: 'Garnet · 2/2 Twill · Grad', pattern: 6, palette: 1, bgShade: 0, warpShade: 0, weftShade: 3, ...grad(0, 3, 1, 2) },
  { id: 'lapis-satin-grad', label: 'Lapis · Satin · Grad', pattern: 4, palette: 2, bgShade: 2, warpShade: 1, weftShade: 2, ...grad(0, 2, 2, 3, 1, 1) },
  { id: 'peridot-houndstooth-grad', label: 'Peridot · Houndstooth · Grad', pattern: 11, palette: 3, bgShade: 1, warpShade: 0, weftShade: 1, ...grad(0, 3, 1, 3, 0, 1) },
];

/** Default rect aspect = 36×40 (warp orientation). */
const RECT_ASPECT_DEFAULT = 36 / 40;

/** Designer-friendly grid sizes; slider snaps to these. */
const GRID_SNAPS = [8, 12, 16, 24, 32, 48, 64];
/** Index into GRID_SNAPS closest to given size (for slider position when size comes from URL etc.). */
function getGridSizeIndex(size) {
  return GRID_SNAPS.reduce((best, val, i) =>
    Math.abs(val - size) < Math.abs(GRID_SNAPS[best] - size) ? i : best, 0);
}

/** When gradSteps >= 2, snap a 0–100 value to the nearest band (multiples of 100/gradSteps). */
function snapGradRangeValue(value, gradSteps) {
  if (gradSteps < 2) return value;
  const step = 100 / gradSteps;
  const n = Math.round(value / step);
  return Math.max(0, Math.min(100, n * step));
}

/** Max URL search string length to avoid browser limits; compact schema keeps under ~2k. */
const URL_STATE_MAX_LEN = 2000;
/** Parse search params into state-like object. Only includes keys that were present. */
function parseUrlState(search) {
  const params = new URLSearchParams(search);
  const out = {};
  const num = (paramKey, stateKey, min, max) => {
    const v = params.get(paramKey);
    if (v == null) return;
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    out[stateKey] = (min != null && max != null) ? Math.max(min, Math.min(max, n)) : n;
  };
  const grad = (prefix) => {
    const raw = params.get(prefix === 'warp' ? 'warpG' : 'weftG');
    if (!raw) return;
    const parts = raw.split(',').map(Number);
    if (parts.length !== 5 || parts.some((x) => !Number.isFinite(x))) return;
    const [startShade, endShade, direction, r0, r1] = parts;
    out[prefix === 'warp' ? 'warpGradient' : 'weftGradient'] = {
      startShade: Math.max(0, Math.min(4, startShade)),
      endShade: Math.max(0, Math.min(4, endShade)),
      direction: direction === 1 ? 1 : 0,
      range: [Math.max(0, Math.min(100, r0)), Math.max(0, Math.min(100, r1))],
    };
  };
  num('p', 'pattern', 0, PATTERNS.length - 1);
  num('pal', 'palette', 0, 3);
  num('bg', 'bgShade', 0, 4);
  num('warp', 'warpShade', 0, 4);
  num('weft', 'weftShade', 0, 4);
  num('grid', 'gridSize', 8, 64);
  num('preset', 'presetIndex', 0, 7);
  grad('warp');
  grad('weft');
  num('steps', 'gradSteps', 0, 16);
  num('rect', 'rectAspect', 0.5, 1);
  num('corner', 'cornerRadius', 0, 0.5);
  num('canvas', 'canvasAspect', 0.5, 2);
  num('all', 'useAllColorways', 0, 1);
  num('seed', 'colorwaySeed', 0, 999);
  num('shimmer', 'shimmer', 0, 1);
  num('shimmerSp', 'shimmerSpeed', 1, 16);
  num('shimmerW', 'shimmerWidth', 0.25, 24);
  num('shimmerInt', 'shimmerIntensity', 0, 1);
  num('shimmerPos', 'shimmerPosition', 0, 1);
  const cf = params.get('cf');
  if (cf === 'svg' || cf === 'png') out.copyFormat = cf;
  const sb = params.get('sidebar');
  if (sb === '0' || sb === '1') out.sidebarOpen = sb === '1';
  return out;
}
/** Build compact search string from state; omit defaults to keep URL short. */
function buildUrlState(state) {
  const def = {
    pattern: 0, palette: 0, bgShade: 2, warpShade: 1, weftShade: 3, gridSize: 32,
    presetIndex: null, gradSteps: 0, rectAspect: RECT_ASPECT_DEFAULT, cornerRadius: 0.18, canvasAspect: 1,
    copyFormat: 'png', sidebarOpen: true, useAllColorways: false, colorwaySeed: 0,
    shimmer: false, shimmerSpeed: 2, shimmerWidth: 2, shimmerIntensity: 0.25, shimmerPosition: 0,
    warpGradient: { startShade: 0, endShade: 3, direction: 0, range: [0, 100] },
    weftGradient: { startShade: 0, endShade: 3, direction: 0, range: [0, 100] },
  };
  const p = new URLSearchParams();
  if (state.presetIndex != null && state.presetIndex >= 0 && state.presetIndex <= 7) p.set('preset', String(state.presetIndex));
  if (state.pattern !== def.pattern) p.set('p', String(state.pattern));
  if (state.palette !== def.palette) p.set('pal', String(state.palette));
  if (state.bgShade !== def.bgShade) p.set('bg', String(state.bgShade));
  if (state.warpShade !== def.warpShade) p.set('warp', String(state.warpShade));
  if (state.weftShade !== def.weftShade) p.set('weft', String(state.weftShade));
  if (state.gridSize !== def.gridSize) p.set('grid', String(state.gridSize));
  const wg = state.warpGradient;
  if (wg && (wg.startShade !== def.warpGradient.startShade || wg.endShade !== def.warpGradient.endShade || wg.direction !== def.warpGradient.direction || wg.range[0] !== def.warpGradient.range[0] || wg.range[1] !== def.warpGradient.range[1])) {
    p.set('warpG', [wg.startShade, wg.endShade, wg.direction, wg.range[0], wg.range[1]].join(','));
  }
  const wft = state.weftGradient;
  if (wft && (wft.startShade !== def.weftGradient.startShade || wft.endShade !== def.weftGradient.endShade || wft.direction !== def.weftGradient.direction || wft.range[0] !== def.weftGradient.range[0] || wft.range[1] !== def.weftGradient.range[1])) {
    p.set('weftG', [wft.startShade, wft.endShade, wft.direction, wft.range[0], wft.range[1]].join(','));
  }
  if (state.gradSteps !== def.gradSteps) p.set('steps', String(state.gradSteps));
  if (state.rectAspect !== def.rectAspect) p.set('rect', String(Number(state.rectAspect.toFixed(2))));
  if (state.cornerRadius !== def.cornerRadius) p.set('corner', String(Number(state.cornerRadius.toFixed(2))));
  if (state.canvasAspect !== def.canvasAspect) p.set('canvas', String(Number(state.canvasAspect.toFixed(2))));
  if (state.copyFormat !== def.copyFormat) p.set('cf', state.copyFormat);
  if (state.sidebarOpen !== def.sidebarOpen) p.set('sidebar', state.sidebarOpen ? '1' : '0');
  if (state.useAllColorways !== def.useAllColorways) p.set('all', state.useAllColorways ? '1' : '0');
  if (state.colorwaySeed !== def.colorwaySeed) p.set('seed', String(state.colorwaySeed));
  if (state.shimmer !== def.shimmer) p.set('shimmer', state.shimmer ? '1' : '0');
  if (state.shimmerSpeed !== def.shimmerSpeed) p.set('shimmerSp', String(Math.round(state.shimmerSpeed)));
  if (state.shimmerWidth !== def.shimmerWidth) p.set('shimmerW', String(Number(state.shimmerWidth.toFixed(2))));
  if (state.shimmerIntensity !== def.shimmerIntensity) p.set('shimmerInt', String(Number(state.shimmerIntensity.toFixed(2))));
  if (state.shimmerPosition !== def.shimmerPosition) p.set('shimmerPos', String(Number(state.shimmerPosition.toFixed(2))));
  const s = p.toString();
  return s.length <= URL_STATE_MAX_LEN ? s : '';
}

/** Icon-only group header; use title for tooltip. */
const GroupIcon = ({ name, title, className = '' }) => (
  <span title={title} className={`shrink-0 ${className}`}>
    <Icon name={name} className={`${iconLg} text-text-muted`} />
  </span>
);
/** Material Symbol icon — pass symbol name (e.g. refresh, arrow_downward). */
const Icon = ({ name, className = '' }) => (
  <span className={`icon inline-block shrink-0 ${className}`} aria-hidden>{name}</span>
);

/** Two-option switch for gradient direction (0 = first arrow, 1 = second). */
const directionSwitch =
  'inline-flex h-7 shrink-0 rounded-md border border-border-subtle bg-surface-input overflow-hidden';
const directionSwitchBtn =
  `flex h-full min-w-[28px] items-center justify-center px-2 ${typeBase} text-text-secondary transition-colors hover:bg-surface-hover hover:text-text data-[state=on]:bg-accent/15 data-[state=on]:text-accent border-r border-border-subtle last:border-r-0`;

function DirectionSwitch({ value, onValueChange, options, title, ariaLabel }) {
  return (
    <div
      className={directionSwitch}
      role="group"
      aria-label={ariaLabel ?? title}
      title={title}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={directionSwitchBtn}
          aria-pressed={value === opt.value}
          aria-label={`${title}: ${opt.label}`}
          data-state={value === opt.value ? 'on' : 'off'}
          onClick={() => { onValueChange(opt.value); }}
        >
          {opt.icon ? <Icon name={opt.icon} className={iconLg} /> : opt.label}
        </button>
      ))}
    </div>
  );
}

function AppSelect({ value, onValueChange, options, placeholder, title }) {
  const selected = options.find((o) => Number(o.value) === Number(value));
  return (
    <Select.Root value={String(value)} onValueChange={(v) => onValueChange(Number(v))}>
      <Select.Trigger className={selectTrigger} title={title} aria-label={title ?? placeholder}>
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
  );
}

const navBtn =
  `inline-flex h-8 items-center rounded-md border px-3 ${typeBase} font-medium outline-none transition-colors focus:ring-2 focus:ring-accent/40`;
const navBtnActive = 'border-accent bg-accent/10 text-accent ' + navBtn;
const navBtnInactive = 'border-border-subtle bg-transparent text-text-secondary hover:border-border hover:bg-surface-hover hover:text-text ' + navBtn;

export default function App() {
  const [view, setView] = useState('weaving'); // 'weaving' | 'imageRects'
  const [presetIndex, setPresetIndex] = useState(null); // null = custom
  const [pattern, setPattern] = useState(0);
  const [palette, setPalette] = useState(0);
  const [bgShade, setBgShade] = useState(2);
  const [warpShade, setWarpShade] = useState(1);
  const [weftShade, setWeftShade] = useState(3);
  const [gridSize, setGridSize] = useState(32);
  const [warpGradient, setWarpGradient] = useState({ startShade: 0, endShade: 3, direction: 0, range: [0, 100] });
  const [weftGradient, setWeftGradient] = useState({ startShade: 0, endShade: 3, direction: 0, range: [0, 100] });
  const [gradSteps, setGradSteps] = useState(0); // 0 = smooth; 2–16 = discrete bands
  const [rectAspect, setRectAspect] = useState(RECT_ASPECT_DEFAULT);
  const [cornerRadius, setCornerRadius] = useState(0.18);
  const [canvasAspect, setCanvasAspect] = useState(1);
  const [fps, setFps] = useState(0);
  /** Shimmer: looping highlight band; speed, width, intensity, position. */
  const [shimmer, setShimmer] = useState(false);
  const [shimmerSpeed, setShimmerSpeed] = useState(2);
  const [shimmerWidth, setShimmerWidth] = useState(2);
  const [shimmerIntensity, setShimmerIntensity] = useState(0.25);
  const [shimmerPosition, setShimmerPosition] = useState(0);
  /** Use all 4 colorways: per-cell palette from colorwaySeed hash (mod 4). */
  const [useAllColorways, setUseAllColorways] = useState(false);
  const [colorwaySeed, setColorwaySeed] = useState(0);
  /** Copy format: 'png' (2× canvas) or 'svg' (SVG with embedded raster). */
  const [copyFormat, setCopyFormat] = useState('png');
  /** Sidebar open; persisted to localStorage so preference survives reload. */
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const stored = localStorage.getItem('shaderbox-sidebar-open');
      return stored !== null ? JSON.parse(stored) : true;
    } catch {
      return true;
    }
  });
  const setSidebarOpenPersisted = useCallback((open) => {
    setSidebarOpen(open);
    try {
      localStorage.setItem('shaderbox-sidebar-open', JSON.stringify(open));
    } catch { /* ignore storage errors */ }
  }, []);
  const canvasRef = useRef(null);

  /** On load: parse URL and set state. If preset is set, apply preset then overlay other params. Grid snapped to GRID_SNAPS. */
  const appliedUrlRef = useRef(false);
  useEffect(() => {
    if (appliedUrlRef.current) return;
    appliedUrlRef.current = true;
    const q = parseUrlState(window.location.search);
    if (Object.keys(q).length === 0) return;
    if (q.presetIndex != null && q.presetIndex >= 0 && q.presetIndex < PRESETS.length) {
      applyPreset(q.presetIndex);
    }
    if (q.pattern != null) setPattern(q.pattern);
    if (q.palette != null) setPalette(q.palette);
    if (q.bgShade != null) setBgShade(q.bgShade);
    if (q.warpShade != null) setWarpShade(q.warpShade);
    if (q.weftShade != null) setWeftShade(q.weftShade);
    if (q.gridSize != null) setGridSize(GRID_SNAPS.includes(q.gridSize) ? q.gridSize : GRID_SNAPS[getGridSizeIndex(q.gridSize)]);
    if (q.warpGradient) setWarpGradient(q.warpGradient);
    if (q.weftGradient) setWeftGradient(q.weftGradient);
    if (q.gradSteps != null) setGradSteps(q.gradSteps);
    if (q.rectAspect != null) setRectAspect(Math.min(1, Math.max(0.5, Number(q.rectAspect))));
    if (q.cornerRadius != null) setCornerRadius(q.cornerRadius);
    if (q.canvasAspect != null) setCanvasAspect(q.canvasAspect);
    if (q.copyFormat != null) setCopyFormat(q.copyFormat);
    if (q.sidebarOpen != null) setSidebarOpenPersisted(q.sidebarOpen);
    if (q.useAllColorways != null) setUseAllColorways(!!q.useAllColorways);
    if (q.colorwaySeed != null) setColorwaySeed(q.colorwaySeed);
    if (q.shimmer != null) setShimmer(!!q.shimmer);
    if (q.shimmerSpeed != null) setShimmerSpeed(Math.min(16, Math.max(1, Number(q.shimmerSpeed))));
    if (q.shimmerWidth != null) setShimmerWidth(q.shimmerWidth);
    if (q.shimmerIntensity != null) setShimmerIntensity(q.shimmerIntensity);
    if (q.shimmerPosition != null) setShimmerPosition(q.shimmerPosition);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; applyPreset/setSidebarOpenPersisted are stable
  }, []);

  /** Sync state to URL (debounced). Only writes params that differ from defaults; keeps URL under ~2k chars. */
  const urlSyncTimeoutRef = useRef(null);
  useEffect(() => {
    urlSyncTimeoutRef.current = setTimeout(() => {
      const search = buildUrlState({
        presetIndex, pattern, palette, bgShade, warpShade, weftShade, gridSize,
        warpGradient, weftGradient, gradSteps, rectAspect, cornerRadius, canvasAspect, copyFormat, sidebarOpen,
        useAllColorways, colorwaySeed, shimmer, shimmerSpeed, shimmerWidth, shimmerIntensity, shimmerPosition,
      });
      const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
      if (window.location.pathname + (window.location.search || '') !== url) {
        window.history.replaceState(null, '', url);
      }
    }, 400);
    return () => { clearTimeout(urlSyncTimeoutRef.current); };
  }, [presetIndex, pattern, palette, bgShade, warpShade, weftShade, gridSize, warpGradient, weftGradient, gradSteps, rectAspect, cornerRadius, canvasAspect, copyFormat, sidebarOpen, useAllColorways, colorwaySeed, shimmer, shimmerSpeed, shimmerWidth, shimmerIntensity, shimmerPosition]);

  /** Capture canvas at 2× resolution as PNG and copy to clipboard. */
  const handleCopy2xPng = useCallback(async () => {
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
    const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
    if (blob) await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  }, []);

  /** Build SVG with canvas as embedded raster (data URL at 2×), copy as image/svg+xml and text/plain. */
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

  /** WebM recording via canvas.captureStream + MediaRecorder. Starts/stops and downloads on stop. */
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);

  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof canvas.captureStream !== 'function') return;
    try {
      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5e6 });
      recordingChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size) recordingChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shaderbox-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setIsRecording(false);
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.warn('Recording failed:', err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  }, []);

  const applyPreset = useCallback((index) => {
    if (index == null || index < 0 || index >= PRESETS.length) return;
    const p = PRESETS[index];
    setPresetIndex(index);
    setPattern(p.pattern);
    setPalette(p.palette);
    setBgShade(p.bgShade);
    setWarpShade(p.warpShade);
    setWeftShade(p.weftShade);
    setWarpGradient(p.warpGradient);
    setWeftGradient(p.weftGradient);
  }, []);

  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  /** Randomize all generator params (pattern, palette, shades, grid, gradients, shimmer, etc.). */
  const handleRandomize = useCallback(() => {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
    const rand = (lo, hi) => lo + Math.random() * (hi - lo);
    setPresetIndex(null);
    setPattern(randInt(0, PATTERNS.length - 1));
    setPalette(randInt(0, 3));
    setBgShade(randInt(0, 4));
    setWarpShade(randInt(0, 4));
    setWeftShade(randInt(0, 4));
    setGridSize(pick(GRID_SNAPS));
    setWarpGradient({
      startShade: randInt(0, 3),
      endShade: randInt(0, 3),
      direction: randInt(0, 1),
      range: [randInt(0, 100), randInt(0, 100)],
    });
    setWeftGradient({
      startShade: randInt(0, 3),
      endShade: randInt(0, 3),
      direction: randInt(0, 1),
      range: [randInt(0, 100), randInt(0, 100)],
    });
    setGradSteps(Math.random() < 0.5 ? 0 : randInt(2, 16));
    setRectAspect(Number(rand(0.5, 1).toFixed(2)));
    setCornerRadius(Number(rand(0.05, 0.4).toFixed(2)));
    setCanvasAspect(Number(rand(0.6, 1.5).toFixed(2)));
    setShimmer(Math.random() < 0.5);
    setShimmerSpeed(randInt(1, 16));
    setShimmerWidth(Number(rand(0.25, 24).toFixed(2)));
    setShimmerIntensity(Number(rand(0.1, 0.8).toFixed(2)));
    setShimmerPosition(Number(rand(0, 1).toFixed(2)));
    setUseAllColorways(Math.random() < 0.5);
    setColorwaySeed(randInt(0, 100));
  }, []);

  /** Keyboard shortcuts when focus is not in input/select/textarea. Mod+C = copy; Mod+1..8 = preset 0–7; Mod+Shift+R or F5 = reload; Mod+\ or Mod+B = toggle sidebar. */
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.closest('input, select, textarea')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'c') {
        e.preventDefault();
        handleCopy();
        return;
      }
      if (mod && e.key >= '1' && e.key <= '8') {
        e.preventDefault();
        applyPreset(Number(e.key) - 1);
        return;
      }
      if ((mod && e.shiftKey && e.key === 'R') || e.key === 'F5') {
        e.preventDefault();
        handleReload();
        return;
      }
      if ((mod && e.key === '\\') || (mod && e.key === 'b')) {
        e.preventDefault();
        setSidebarOpenPersisted(!sidebarOpen);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCopy, applyPreset, handleReload, setSidebarOpenPersisted, sidebarOpen]);

  const patternOptions = PATTERNS.map((p, i) => ({
    value: i,
    label: p.name,
    icon: WEAVE_ICONS[p.id] ?? 'texture',
  }));
  const shadeOptions = (prefix) => SHADE_NAMES.map((name, i) => ({ value: i, label: prefix ? `${prefix}: ${name}` : name }));
  const presetOptions = [
    { value: 'custom', label: 'Preset…' },
    ...PRESETS.map((p, i) => ({ value: String(i), label: p.label })),
  ];

  const directionOptions = [
    { value: 0, label: 'Down', icon: 'arrow_downward' },
    { value: 1, label: 'Up', icon: 'arrow_upward' },
  ];
  const directionOptionsWeft = [
    { value: 0, label: 'Right', icon: 'arrow_forward' },
    { value: 1, label: 'Left', icon: 'arrow_back' },
  ];

  if (view === 'imageRects') {
    return (
      <div className="flex min-h-0 flex-col bg-surface" style={{ height: '100dvh' }}>
        <nav className="flex min-h-9 shrink-0 items-center gap-3 border-b border-border-subtle bg-surface-elevated px-3 py-2" aria-label="App mode">
          <h1 className={`shrink-0 ${typeBase} font-semibold tracking-[-0.01em] text-text`}>Shader Sandbox</h1>
          <div className="flex items-center gap-1">
            <button type="button" className={navBtnInactive} onClick={() => setView('weaving')} aria-pressed={false} aria-label="Weaving draft">Weaving</button>
            <button type="button" className={navBtnActive} onClick={() => setView('imageRects')} aria-pressed aria-label="Image to colored rects">Image Rects</button>
          </div>
        </nav>
        <div className="min-h-0 flex-1 overflow-hidden">
          <Suspense fallback={<div className="flex h-full items-center justify-center text-text-secondary">Loading…</div>}>
            <AppV2 />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col bg-surface" style={{ height: '100dvh' }}>
      <nav className="flex min-h-9 shrink-0 items-center gap-3 border-b border-border-subtle bg-surface-elevated px-3 py-2" aria-label="App mode">
        <h1 className={`shrink-0 ${typeBase} font-semibold tracking-[-0.01em] text-text`}>Shader Sandbox</h1>
        <div className="flex items-center gap-1">
          <button type="button" className={navBtnActive} onClick={() => setView('weaving')} aria-pressed aria-label="Weaving draft">Weaving</button>
          <button type="button" className={navBtnInactive} onClick={() => setView('imageRects')} aria-pressed={false} aria-label="Image to colored rects">Image Rects</button>
        </div>
      </nav>
      <div className="flex min-h-0 flex-1 flex-row overflow-hidden bg-surface">
      {/* Collapsible sidebar: transition width; thin strip with toggle when collapsed. */}
      <div className="flex shrink-0 overflow-hidden border-r border-border-subtle bg-surface">
        <aside
          className="flex flex-col gap-3 overflow-y-auto overflow-x-hidden bg-surface px-3 py-3 transition-[max-width] duration-200 ease-out"
          style={{ width: sidebarOpen ? 288 : 0, maxWidth: sidebarOpen ? 288 : 0, minWidth: 0 }}
        >
        <div className="flex flex-col gap-3">
          <div className={sidebarGroup}>
            <div className={sidebarGroupTitle}>Actions</div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={btnGhost} onClick={handleReload} aria-label="Reload">
                <Icon name="refresh" className={iconMd} />
                <span>Reload</span>
              </button>
              <button type="button" className={btnGhost} onClick={handleRandomize} aria-label="Randomize all parameters" title="Randomize pattern, palette, shades, grid, gradients, shimmer, and more">
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
                  title={copyFormat === 'png' ? 'Copy canvas at 2× as PNG' : 'Copy as SVG (canvas embedded as image)'}
                  aria-label={copyFormat === 'png' ? 'Copy PNG' : 'Copy SVG'}
                  onClick={handleCopy}
                >
                  <Icon name="content_copy" className={iconSm} />
                </button>
              </div>
              <button
                type="button"
                className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 ${typeControl} transition-colors ${isRecording ? 'border-error bg-error/15 text-error' : 'border-border-subtle bg-surface-input text-text-secondary hover:bg-surface-hover hover:text-text'}`}
                aria-label={isRecording ? 'Stop recording' : 'Record WebM'}
                title={isRecording ? 'Stop and download WebM' : 'Record canvas as WebM video'}
                onClick={isRecording ? stopRecording : startRecording}
              >
                <Icon name={isRecording ? 'stop' : 'videocam'} className={iconSm} />
                {isRecording ? 'Stop' : 'Record'}
              </button>
            </div>
          </div>
          <div className={sidebarGroup}>
            <div className={sidebarGroupTitle}>Preset & colorway</div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="tune" title="Preset" />
              <Select.Root
                value={presetIndex != null ? String(presetIndex) : 'custom'}
                onValueChange={(v) => (v === 'custom' ? setPresetIndex(null) : applyPreset(Number(v)))}
              >
                <Select.Trigger className={selectTrigger} title="Preset (weave + colorway + shades + grad)" aria-label="Preset">
                  <Select.Value placeholder="Preset…" />
                  <Icon name="expand_more" className={`${iconLg} opacity-60`} />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className={selectContent} position="popper" sideOffset={4}>
                    <Select.Viewport>
                      {presetOptions.map((opt) => (
                        <Select.Item key={opt.value} className={selectItem} value={opt.value}>
                          <Select.ItemText>{opt.label}</Select.ItemText>
                          <Select.ItemIndicator className="absolute right-2 inline-flex items-center" />
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
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
                    onClick={() => { setPalette(i); setPresetIndex(null); }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className={sidebarGroup}>
            <div className={sidebarGroupTitle}>Weave</div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`shrink-0 ${typeLabel}`} title="Weave pattern">Weave</span>
              <AppSelect value={pattern} onValueChange={(v) => { setPattern(v); setPresetIndex(null); }} options={patternOptions} title="Weave pattern" placeholder="Weave" />
            </div>
          </div>
          <div className={sidebarGroup}>
            <div className={sidebarGroupTitle}>Shades</div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="palette" title="Shades" />
              <AppSelect value={bgShade} onValueChange={(v) => { setBgShade(v); setPresetIndex(null); }} options={shadeOptions('BG')} title="Background shade" placeholder="BG" />
              <AppSelect
                value={warpShade}
                onValueChange={(v) => {
                  const shade = Number(v);
                  setWarpShade(shade);
                  setPresetIndex(null);
                  setWarpGradient((g) => ({ ...g, startShade: shade, endShade: shade }));
                }}
                options={shadeOptions('Warp')}
                title="Warp shade"
                placeholder="Warp"
              />
              <AppSelect
                value={weftShade}
                onValueChange={(v) => {
                  const shade = Number(v);
                  setWeftShade(shade);
                  setPresetIndex(null);
                  setWeftGradient((g) => ({ ...g, startShade: shade, endShade: shade }));
                }}
                options={shadeOptions('Weft')}
                title="Weft shade"
                placeholder="Weft"
              />
            </div>
          </div>
          <div className={sidebarGroup}>
            <div className={sidebarGroupTitle}>Warp gradient</div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="gradient" title="Warp gradient range" />
              <Label.Root className="sr-only" htmlFor="warp-range">Warp gradient range</Label.Root>
              <Slider.Root
                id="warp-range"
                className="relative flex w-24 shrink-0 touch-none items-center"
                value={warpGradient.range}
                onValueChange={([a, b]) => {
                  setPresetIndex(null);
                  const snap = gradSteps >= 2;
                  setWarpGradient((g) => ({
                    ...g,
                    range: snap ? [snapGradRangeValue(a, gradSteps), snapGradRangeValue(b, gradSteps)] : [a, b],
                  }));
                }}
                min={0}
                max={100}
                step={gradSteps >= 2 ? 100 / gradSteps : 5}
                aria-label="Warp gradient range"
              >
                <Slider.Track className="relative h-1.5 grow rounded-full bg-surface-input">
                  <Slider.Range className="absolute h-full rounded-full bg-accent" />
                </Slider.Track>
                <Slider.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus:ring-2 focus:ring-accent/40" />
                <Slider.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus:ring-2 focus:ring-accent/40" />
              </Slider.Root>
              <span className={`w-14 ${typeValue}`}>{warpGradient.range[0]}–{warpGradient.range[1]}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="gradient" title="Warp gradient" />
              <AppSelect value={warpGradient.startShade} onValueChange={(s) => { setPresetIndex(null); setWarpGradient((g) => ({ ...g, startShade: s })); }} options={shadeOptions()} title="Warp start" placeholder="Start" />
              <AppSelect value={warpGradient.endShade} onValueChange={(s) => { setPresetIndex(null); setWarpGradient((g) => ({ ...g, endShade: s })); }} options={shadeOptions()} title="Warp end" placeholder="End" />
              <DirectionSwitch value={warpGradient.direction} onValueChange={(d) => { setPresetIndex(null); setWarpGradient((g) => ({ ...g, direction: d })); }} options={directionOptions} title="Warp direction" ariaLabel="Warp gradient direction" />
            </div>
          </div>
          <div className={sidebarGroup}>
            <div className={sidebarGroupTitle}>Weft gradient</div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="gradient" title="Weft gradient range" />
              <Label.Root className="sr-only" htmlFor="weft-range">Weft gradient range</Label.Root>
              <Slider.Root
                id="weft-range"
                className="relative flex w-24 shrink-0 touch-none items-center"
                value={weftGradient.range}
                onValueChange={([a, b]) => {
                  setPresetIndex(null);
                  const snap = gradSteps >= 2;
                  setWeftGradient((g) => ({
                    ...g,
                    range: snap ? [snapGradRangeValue(a, gradSteps), snapGradRangeValue(b, gradSteps)] : [a, b],
                  }));
                }}
                min={0}
                max={100}
                step={gradSteps >= 2 ? 100 / gradSteps : 5}
                aria-label="Weft gradient range"
              >
                <Slider.Track className="relative h-1.5 grow rounded-full bg-surface-input">
                  <Slider.Range className="absolute h-full rounded-full bg-accent" />
                </Slider.Track>
                <Slider.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus:ring-2 focus:ring-accent/40" />
                <Slider.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus:ring-2 focus:ring-accent/40" />
              </Slider.Root>
              <span className={`w-14 ${typeValue}`}>{weftGradient.range[0]}–{weftGradient.range[1]}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="gradient" title="Weft gradient" />
              <AppSelect value={weftGradient.startShade} onValueChange={(s) => { setPresetIndex(null); setWeftGradient((g) => ({ ...g, startShade: s })); }} options={shadeOptions()} title="Weft start" placeholder="Start" />
              <AppSelect value={weftGradient.endShade} onValueChange={(s) => { setPresetIndex(null); setWeftGradient((g) => ({ ...g, endShade: s })); }} options={shadeOptions()} title="Weft end" placeholder="End" />
              <DirectionSwitch value={weftGradient.direction} onValueChange={(d) => { setPresetIndex(null); setWeftGradient((g) => ({ ...g, direction: d })); }} options={directionOptionsWeft} title="Weft direction" ariaLabel="Weft gradient direction" />
            </div>
          </div>
          <div className={sidebarGroup}>
            <div className={sidebarGroupTitle}>Grid & layout</div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="grid_on" title="Resolution" />
              <Label.Root className="sr-only" htmlFor="grid-slider">Tile size</Label.Root>
              <Slider.Root
                id="grid-slider"
                className="relative flex w-20 shrink-0 touch-none select-none items-center"
                value={[getGridSizeIndex(gridSize)]}
                onValueChange={([i]) => setGridSize(GRID_SNAPS[i])}
                min={0}
                max={GRID_SNAPS.length - 1}
                step={1}
                aria-label={`Grid: ${gridSize} cells`}
              >
                <Slider.Track className="relative h-1.5 grow rounded-full bg-surface-input">
                  <Slider.Range className="absolute h-full rounded-full bg-accent" />
                </Slider.Track>
                <Slider.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </Slider.Root>
              <span className={`w-6 ${typeValue}`}>{gridSize}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="timeline" title="Quantization" />
              <Label.Root className="sr-only" htmlFor="grad-steps-slider">Gradation steps</Label.Root>
              <Slider.Root
                id="grad-steps-slider"
                className="relative flex w-20 shrink-0 touch-none select-none items-center"
                value={[gradSteps]}
                onValueChange={([v]) => setGradSteps(v)}
                min={0}
                max={16}
                step={1}
                aria-label={`Gradation steps: ${gradSteps === 0 ? 'smooth' : gradSteps}`}
              >
                <Slider.Track className="relative h-1.5 grow rounded-full bg-surface-input">
                  <Slider.Range className="absolute h-full rounded-full bg-accent" />
                </Slider.Track>
                <Slider.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </Slider.Root>
              <span className={`w-8 ${typeValue}`} title="0 = smooth gradient">{gradSteps === 0 ? 'Smooth' : gradSteps}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="aspect_ratio" title="Rect ratio (36×40 = 0.9)" />
              <Label.Root className="sr-only" htmlFor="rect-aspect-slider">Rect aspect ratio (36×40 spec = 0.9)</Label.Root>
              <Slider.Root
                id="rect-aspect-slider"
                className="relative flex w-20 shrink-0 touch-none select-none items-center"
                value={[rectAspect]}
                onValueChange={([v]) => setRectAspect(v)}
                min={0.5}
                max={1}
                step={0.05}
                aria-label={`Rect aspect: ${rectAspect.toFixed(2)} (spec 36×40 = 0.9)`}
              >
                <Slider.Track className="relative h-1.5 grow rounded-full bg-surface-input">
                  <Slider.Range className="absolute h-full rounded-full bg-accent" />
                </Slider.Track>
                <Slider.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </Slider.Root>
              <span className={`w-10 ${typeValue}`} title="Warp rect width/height. Spec: 36×40 = 0.9">{(rectAspect ?? RECT_ASPECT_DEFAULT).toFixed(2)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="crop" title="Canvas aspect" />
              <Label.Root className="sr-only" htmlFor="canvas-aspect-slider">Canvas aspect ratio</Label.Root>
              <Slider.Root
                id="canvas-aspect-slider"
                className="relative flex w-20 shrink-0 touch-none select-none items-center"
                value={[canvasAspect]}
                onValueChange={([v]) => setCanvasAspect(v)}
                min={0.5}
                max={2}
                step={0.05}
                aria-label={`Canvas aspect: ${canvasAspect.toFixed(2)}`}
              >
                <Slider.Track className="relative h-1.5 grow rounded-full bg-surface-input">
                  <Slider.Range className="absolute h-full rounded-full bg-accent" />
                </Slider.Track>
                <Slider.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </Slider.Root>
              <span className={`w-10 ${typeValue}`} title="Canvas width/height">{canvasAspect.toFixed(2)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="rounded_corner" title="Radius" />
              <Label.Root className="sr-only" htmlFor="radius-slider">Corner radius</Label.Root>
              <Slider.Root
                id="radius-slider"
                className="relative flex w-20 shrink-0 touch-none select-none items-center"
                value={[cornerRadius]}
                onValueChange={([v]) => setCornerRadius(v)}
                min={0}
                max={0.5}
                step={0.01}
                aria-label={`Corner radius: ${cornerRadius.toFixed(2)}`}
              >
                <Slider.Track className="relative h-1.5 grow rounded-full bg-surface-input">
                  <Slider.Range className="absolute h-full rounded-full bg-accent" />
                </Slider.Track>
                <Slider.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </Slider.Root>
              <span className={`w-10 ${typeValue}`} title="Rect corner radius in cell space">{cornerRadius.toFixed(2)}</span>
            </div>
          </div>
          <div className={sidebarGroup}>
            <div className={sidebarGroupTitle}>Shimmer</div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="auto_awesome" title="Shimmer" />
              <button
                type="button"
                className={`flex h-7 min-w-16 items-center justify-center rounded-md border px-2.5 ${typeControl} transition-colors ${shimmer ? 'border-accent bg-accent/15 text-accent' : 'border-border-subtle bg-surface-input text-text-secondary hover:bg-surface-hover hover:text-text'}`}
                aria-pressed={shimmer}
                aria-label="Toggle shimmer effect"
                onClick={() => setShimmer((s) => !s)}
              >
                Shimmer
              </button>
              {shimmer && (
              <>
                <Label.Root className="sr-only" htmlFor="shimmer-speed">Shimmer speed (cells/s)</Label.Root>
                <Slider.Root
                  id="shimmer-speed"
                  className="relative flex w-16 shrink-0 touch-none items-center"
                  value={[shimmerSpeed]}
                  onValueChange={([v]) => setShimmerSpeed(v)}
                  min={1}
                  max={16}
                  step={1}
                  aria-label="Shimmer speed (cells per second)"
                >
                  <Slider.Track className="relative h-1.5 grow rounded-full bg-surface-input">
                    <Slider.Range className="absolute h-full rounded-full bg-accent" />
                  </Slider.Track>
                  <Slider.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus:ring-2 focus:ring-accent/40" />
                </Slider.Root>
                <span className={`w-8 ${typeCaption} tabular-nums`} title="Cells per second">Cells/s</span>
                <Label.Root className="sr-only" htmlFor="shimmer-width">Shimmer width</Label.Root>
                <Slider.Root
                  id="shimmer-width"
                  className="relative flex w-16 shrink-0 touch-none items-center"
                  value={[shimmerWidth]}
                  onValueChange={([v]) => setShimmerWidth(v)}
                  min={0.25}
                  max={24}
                  step={0.25}
                  aria-label="Shimmer width"
                >
                  <Slider.Track className="relative h-1.5 grow rounded-full bg-surface-input">
                    <Slider.Range className="absolute h-full rounded-full bg-accent" />
                  </Slider.Track>
                  <Slider.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus:ring-2 focus:ring-accent/40" />
                </Slider.Root>
                <Label.Root className="sr-only" htmlFor="shimmer-intensity">Shimmer intensity</Label.Root>
                <Slider.Root
                  id="shimmer-intensity"
                  className="relative flex w-16 shrink-0 touch-none items-center"
                  value={[shimmerIntensity]}
                  onValueChange={([v]) => setShimmerIntensity(v)}
                  min={0}
                  max={1}
                  step={0.05}
                  aria-label="Shimmer intensity"
                >
                  <Slider.Track className="relative h-1.5 grow rounded-full bg-surface-input">
                    <Slider.Range className="absolute h-full rounded-full bg-accent" />
                  </Slider.Track>
                  <Slider.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus:ring-2 focus:ring-accent/40" />
                </Slider.Root>
                <span className={`w-6 ${typeCaption}`}>Intensity</span>
                <Label.Root className="sr-only" htmlFor="shimmer-position">Shimmer position</Label.Root>
                <Slider.Root
                  id="shimmer-position"
                  className="relative flex w-16 shrink-0 touch-none items-center"
                  value={[shimmerPosition]}
                  onValueChange={([v]) => setShimmerPosition(v)}
                  min={0}
                  max={1}
                  step={0.01}
                  aria-label="Shimmer position (phase)"
                >
                  <Slider.Track className="relative h-1.5 grow rounded-full bg-surface-input">
                    <Slider.Range className="absolute h-full rounded-full bg-accent" />
                  </Slider.Track>
                  <Slider.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus:ring-2 focus:ring-accent/40" />
                </Slider.Root>
                <span className={`w-6 ${typeCaption}`}>Position</span>
              </>
            )}
            </div>
          </div>
          <div className={sidebarGroup}>
            <div className={sidebarGroupTitle}>Colorways</div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="palette" title="All colorways" />
              <button
                type="button"
                className={`flex h-7 min-w-16 items-center justify-center rounded-md border px-2.5 ${typeControl} transition-colors ${useAllColorways ? 'border-accent bg-accent/15 text-accent' : 'border-border-subtle bg-surface-input text-text-secondary hover:bg-surface-hover hover:text-text'}`}
                aria-pressed={useAllColorways}
                aria-label="Use all 4 colorways (randomized per cell)"
                onClick={() => setUseAllColorways((u) => !u)}
              >
                Use all 4 colorways
              </button>
              {useAllColorways && (
              <>
                {[0, 1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`flex h-7 w-7 items-center justify-center rounded-md border px-0 ${typeControl} transition-colors ${colorwaySeed === n ? 'border-accent bg-accent/15 text-accent' : 'border-border-subtle bg-surface-input text-text-secondary hover:bg-surface-hover hover:text-text'}`}
                    aria-label={`Colorway seed ${n}`}
                    aria-pressed={colorwaySeed === n}
                    onClick={() => setColorwaySeed(n)}
                  >
                    {n}
                  </button>
                ))}
                <Label.Root className="sr-only" htmlFor="colorway-seed">Colorway seed</Label.Root>
                <Slider.Root
                  id="colorway-seed"
                  className="relative flex w-20 shrink-0 touch-none items-center"
                  value={[colorwaySeed]}
                  onValueChange={([v]) => setColorwaySeed(Math.floor(v))}
                  min={0}
                  max={100}
                  step={1}
                  aria-label="Colorway seed"
                >
                  <Slider.Track className="relative h-1.5 grow rounded-full bg-surface-input">
                    <Slider.Range className="absolute h-full rounded-full bg-accent" />
                  </Slider.Track>
                  <Slider.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus:ring-2 focus:ring-accent/40" />
                </Slider.Root>
                <span className={`w-8 ${typeValue}`}>Seed: {colorwaySeed}</span>
              </>
            )}
            </div>
          </div>
        </div>
        </aside>
        <button
          type="button"
          className={`flex h-full min-w-6 shrink-0 items-center justify-center border-border-subtle bg-surface-elevated ${typeBase} text-text-muted transition-colors hover:bg-surface-hover hover:text-text focus:outline-none focus:ring-1 focus:ring-accent/20`}
          onClick={() => setSidebarOpenPersisted(!sidebarOpen)}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <Icon name={sidebarOpen ? 'chevron_left' : 'chevron_right'} className={iconLg} />
        </button>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
          <ShaderCanvas patternIndex={pattern} palette={palette} bgShade={bgShade} warpShade={warpShade} weftShade={weftShade} gridSize={gridSize} warpGradient={warpGradient} weftGradient={weftGradient} gradSteps={gradSteps} rectAspect={rectAspect} cornerRadius={cornerRadius} canvasAspect={canvasAspect} shimmer={shimmer} shimmerSpeed={shimmerSpeed} shimmerWidth={shimmerWidth} shimmerIntensity={shimmerIntensity} shimmerPosition={shimmerPosition} useAllColorways={useAllColorways} colorwaySeed={colorwaySeed} patterns={PATTERNS} onFpsChange={setFps} onCanvasRef={(el) => { canvasRef.current = el; }} />
        </main>

        <footer className="flex min-h-9 shrink-0 flex-wrap items-center gap-2 border-t border-border-subtle bg-surface-elevated px-3 py-2">
        <span className={pill}>{PATTERNS[pattern]?.name ?? '—'}</span>
        <span className={pill}>{PALETTE_NAMES[palette]}</span>
        <span className={pill}>BG: {SHADE_NAMES[bgShade]}</span>
        <span className={pill}>Warp: {SHADE_NAMES[warpShade]}</span>
        <span className={pill}>Weft: {SHADE_NAMES[weftShade]}</span>
        <span className={pill}>Warp: {SHADE_NAMES[warpGradient.startShade]}→{SHADE_NAMES[warpGradient.endShade]}</span>
        <span className={pill}>Weft: {SHADE_NAMES[weftGradient.startShade]}→{SHADE_NAMES[weftGradient.endShade]}</span>
        <span className={pill}>Grid: {gridSize}</span>
        <span className={pill}>Steps: {gradSteps === 0 ? 'Smooth' : gradSteps}</span>
        <span className={pill}>Canvas: {canvasAspect.toFixed(2)}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className={pill}>{fps || '--'} fps</span>
          <span className={pill}>WebGL 1</span>
        </div>
        </footer>
      </div>
      </div>
    </div>
  );
}
