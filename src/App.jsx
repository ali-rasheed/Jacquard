/**
 * Shader Sandbox — ENS Weaving Draft.
 * WebGL canvas reads shaders from src/shaders/*.glsl. Controls: Radix Select + Slider.
 */
import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { motion } from 'motion/react';
import * as Select from '@radix-ui/react-select';
import * as Label from '@radix-ui/react-label';
import { ShaderCanvas } from './components/ShaderCanvas';
import { SliderWithInput } from './components/SliderWithInput';
import { useCanvasRecorder, supportsMP4 } from './hooks/useCanvasRecorder';
import { halftoneCmykPresets } from '@paper-design/shaders-react';
import { PATTERNS } from './patterns';
import {
  GRID_SNAPS,
  getGridSizeIndex,
  PRESETS,
  PNG_COPY_SCALE,
  RECT_ASPECT_DEFAULT,
  snapGradRangeValue,
  URL_STATE_MAX_LEN,
  WEAVE_ICONS,
} from './constants';
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
  iconXs,
  iconXxs2,
  SHADE_TRANSPARENT_ICON,
  btnGhost,
  selectTrigger,
  selectContent,
  selectItem,
  pill,
  sidebarGroup,
  sidebarGroupSticky,
  sidebarGroupTitle,
  controlLabel,
} from './uiConstants';

/** Lazy load to avoid circular/order-dependent init in production bundle (TDZ). */
const AppV2 = lazy(() => import('./AppV2.jsx'));
const WeavingHalftoneStage = lazy(() => import('./components/WeavingHalftoneStage.jsx').then((m) => ({ default: m.WeavingHalftoneStage })));
const ImageRectsHalftoneStage = lazy(() => import('./components/ImageRectsHalftoneStage.jsx').then((m) => ({ default: m.ImageRectsHalftoneStage })));

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
  num('shimmerRot', 'shimmerRotation', 0, 1);
  num('shimmerN', 'shimmerNoise', 0, 1);
  num('shimmerNS', 'shimmerNoiseSeed', 0, 1);
  num('shimmerNMin', 'shimmerNoiseMin', 0, 2);
  num('shimmerNMax', 'shimmerNoiseMax', 0, 2);
  num('shimmerBlend', 'shimmerBlendMode', 0, 10);
  const cf = params.get('cf');
  if (cf === 'svg' || cf === 'png') out.copyFormat = cf;
  const v = params.get('v');
  if (v === '1') out.view = 'weaving';
  else if (v === '2') out.view = 'imageRects';
  else if (v === '3') out.view = 'weavingHalftone';
  else if (v === '4') out.view = 'imageRectsHalftone';
  return out;
}
const VIEW_TO_V = { weaving: 1, imageRects: 2, weavingHalftone: 3, imageRectsHalftone: 4 };
function getInitialView() {
  const v = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('v');
  if (v === '2') return 'imageRects';
  if (v === '3') return 'weavingHalftone';
  if (v === '4') return 'imageRectsHalftone';
  return 'weaving';
}
/** Build compact search string from state; omit defaults to keep URL short. */
function buildUrlState(state) {
  const def = {
    view: 'weaving',
    pattern: 0, palette: 0, bgShade: 2, warpShade: 1, weftShade: 3, gridSize: 32,
    presetIndex: null, gradSteps: 0, rectAspect: RECT_ASPECT_DEFAULT, cornerRadius: 0.18, canvasAspect: 1,
    copyFormat: 'png', useAllColorways: false, colorwaySeed: 0,
    shimmer: false, shimmerSpeed: 2, shimmerWidth: 2, shimmerIntensity: 0.25, shimmerPosition: 0, shimmerRotation: 0.125, shimmerNoise: 0.3, shimmerNoiseSeed: 0, shimmerNoiseMin: 0.5, shimmerNoiseMax: 1.5, shimmerBlendMode: 0,
    warpGradient: { startShade: 0, endShade: 3, direction: 0, range: [0, 100] },
    weftGradient: { startShade: 0, endShade: 3, direction: 0, range: [0, 100] },
  };
  const p = new URLSearchParams();
  const viewNum = state.view != null ? VIEW_TO_V[state.view] : undefined;
  if (viewNum != null && viewNum !== 1) p.set('v', String(viewNum));
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
  if (state.useAllColorways !== def.useAllColorways) p.set('all', state.useAllColorways ? '1' : '0');
  if (state.colorwaySeed !== def.colorwaySeed) p.set('seed', String(state.colorwaySeed));
  if (state.shimmer !== def.shimmer) p.set('shimmer', state.shimmer ? '1' : '0');
  if (state.shimmerSpeed !== def.shimmerSpeed) p.set('shimmerSp', String(Math.round(state.shimmerSpeed)));
  if (state.shimmerWidth !== def.shimmerWidth) p.set('shimmerW', String(Number(state.shimmerWidth.toFixed(2))));
  if (state.shimmerIntensity !== def.shimmerIntensity) p.set('shimmerInt', String(Number(state.shimmerIntensity.toFixed(2))));
  if (state.shimmerPosition !== def.shimmerPosition) p.set('shimmerPos', String(Number(state.shimmerPosition.toFixed(2))));
  if (state.shimmerRotation !== def.shimmerRotation) p.set('shimmerRot', String(Number(state.shimmerRotation.toFixed(3))));
  if (state.shimmerNoise !== def.shimmerNoise) p.set('shimmerN', String(Number(state.shimmerNoise.toFixed(2))));
  if (state.shimmerNoiseSeed !== def.shimmerNoiseSeed) p.set('shimmerNS', String(Number(state.shimmerNoiseSeed.toFixed(3))));
  if (state.shimmerNoiseMin !== def.shimmerNoiseMin) p.set('shimmerNMin', String(Number(state.shimmerNoiseMin.toFixed(2))));
  if (state.shimmerNoiseMax !== def.shimmerNoiseMax) p.set('shimmerNMax', String(Number(state.shimmerNoiseMax.toFixed(2))));
  if (state.shimmerBlendMode !== def.shimmerBlendMode) p.set('shimmerBlend', String(state.shimmerBlendMode));
  const s = p.toString();
  return s.length <= URL_STATE_MAX_LEN ? s : '';
}

/**
 * Section icon with optional property lock: xxs lock button at top-left (when onLockChange provided),
 * and optional locked superscript at top-right.
 */
const GroupIcon = ({ name, title, locked = false, onLockChange, className = '' }) => (
  <span title={title} className={`relative inline-flex shrink-0 ${className}`}>
    {onLockChange && (
      <button
        type="button"
        className={`absolute -left-0.5 -top-0.5 flex h-2 w-2 items-center justify-center rounded border border-border-subtle bg-surface-input text-text-muted transition-colors hover:border-border hover:bg-surface-hover hover:text-text focus:outline-none focus:ring-1 focus:ring-accent/40 ${locked ? 'border-accent/50 bg-accent/10 text-accent' : ''}`}
        onClick={() => onLockChange(!locked)}
        aria-label={locked ? 'Unlock property' : 'Lock property'}
        title={locked ? 'Unlock' : 'Lock'}
      >
        <Icon name={locked ? 'lock' : 'lock_open'} className={iconXxs2} />
      </button>
    )}
    <Icon name={name} className={`${iconLg} text-text-muted`} />
    {locked && !onLockChange && (
      <span className="absolute -top-0.5 -right-0.5 leading-none" aria-hidden title="Locked">
        <Icon name="lock" className={`${iconXs} text-text-muted`} />
      </span>
    )}
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

function AppSelect({ value, onValueChange, options, placeholder, title, id: idProp, labelText }) {
  const selected = options.find((o) => Number(o.value) === Number(value));
  const label = labelText ?? title;
  return (
    <>
      {idProp && label && <Label.Root className="sr-only" htmlFor={idProp}>{label}</Label.Root>}
      <Select.Root value={String(value)} onValueChange={(v) => onValueChange(Number(v))}>
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

const navBtn =
  `inline-flex h-8 items-center rounded-md border px-3 ${typeBase} font-medium outline-none transition-colors focus:ring-2 focus:ring-accent/40`;
const navBtnActive = 'border-accent bg-accent/10 text-accent ' + navBtn;
const navBtnInactive = 'border-border-subtle bg-transparent text-text-secondary hover:border-border hover:bg-surface-hover hover:text-text ' + navBtn;

export default function App() {
  const [view, setView] = useState(getInitialView); // 'weaving' | 'weavingHalftone' | 'imageRects' | 'imageRectsHalftone' — persisted in URL ?v=1..4 so reload keeps mode
  const [presetIndex, setPresetIndex] = useState(null); // null = custom
  const [pattern, setPattern] = useState(0);
  const [palette, setPalette] = useState(0);
  const [shadesLocked, setShadesLocked] = useState(false);
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
  /** When false, shimmer band is frozen (effective speed 0). */
  const [shimmerPlaying, setShimmerPlaying] = useState(true);
  const [shimmerSpeed, setShimmerSpeed] = useState(2);
  const [shimmerWidth, setShimmerWidth] = useState(2);
  const [shimmerIntensity, setShimmerIntensity] = useState(0.25);
  const [shimmerPosition, setShimmerPosition] = useState(0);
  const [shimmerRotation, setShimmerRotation] = useState(0.125); // 0–1 = 0–360°; 0.125 ≈ 45° (diagonal)
  const [shimmerNoise, setShimmerNoise] = useState(0.3); // 0 = none, 1 = ±50% per-shot intensity variation
  const [shimmerNoiseSeed, setShimmerNoiseSeed] = useState(0); // 0–1 pattern variation
  const [shimmerNoiseMin, setShimmerNoiseMin] = useState(0.5); // clamp min for noise factor (0–2)
  const [shimmerNoiseMax, setShimmerNoiseMax] = useState(1.5); // clamp max for noise factor (0–2)
  const [shimmerBlendMode, setShimmerBlendMode] = useState(0); // 0–10: Add, Multiply, Screen, Overlay, Soft Light, Hard Light, Color Dodge, Color Burn, Linear Burn, Difference, Exclusion
  /** Use all 4 colorways: per-cell palette from colorwaySeed hash (mod 4). */
  const [useAllColorways, setUseAllColorways] = useState(false);
  const [colorwaySeed, setColorwaySeed] = useState(0);
  /** When true, colorway seed animates 0→100 over 20m and loops. */
  const [colorwaySeedPlaying, setColorwaySeedPlaying] = useState(false);
  const colorwayAnimStartRef = useRef(0);
  const colorwayAnimFrameRef = useRef(null);
  /** Copy format: 'png' (2× canvas) or 'svg' (SVG with embedded raster). */
  const [copyFormat, setCopyFormat] = useState('png');
  /** Include in Randomize: rect aspect and corner radius (off = keep current when randomizing). */
  const [randomizeRectAspect, setRandomizeRectAspect] = useState(true);
  const [randomizeCornerRadius, setRandomizeCornerRadius] = useState(true);
  const canvasRef = useRef(null);
  const halftoneContainerRef = useRef(null);
  const halftoneCanvasRef = useRef(null);

  /** Halftone params for v3 (Weaving + Halftone) view. */
  const [halftoneSize, setHalftoneSize] = useState(0.2);
  const [halftoneSoftness, setHalftoneSoftness] = useState(1);
  const [halftoneGridNoise, setHalftoneGridNoise] = useState(0.2);
  const [halftoneContrast, setHalftoneContrast] = useState(1);
  const [halftoneType, setHalftoneType] = useState('ink');
  const [halftoneColorBack, setHalftoneColorBack] = useState('#fbfaf4');
  const [halftoneColorC, setHalftoneColorC] = useState('#00b3ff');
  const [halftoneColorM, setHalftoneColorM] = useState('#fc4f9d');
  const [halftoneColorY, setHalftoneColorY] = useState('#ffd900');
  const [halftoneColorK, setHalftoneColorK] = useState('#231f20');
  const [halftoneFloodC, setHalftoneFloodC] = useState(0.15);
  const [halftoneGainC, setHalftoneGainC] = useState(0.3);
  const [halftoneGainY, setHalftoneGainY] = useState(0.2);
  const [halftonePresetIndex, setHalftonePresetIndex] = useState(0);
  /** Weaving + Halftone: optional image from desktop (object URL). When set, halftone uses this instead of weaving. */
  const [halftoneCustomImageUrl, setHalftoneCustomImageUrl] = useState('');

  /** Image Rects + Halftone combo view: image from file only (no web URL). */
  const [comboImageSource, setComboImageSource] = useState('');
  const [comboGridSize, setComboGridSize] = useState(32);
  const [comboPalette, setComboPalette] = useState(0);
  const [comboBgShade, setComboBgShade] = useState(2);
  const [comboColorizeMode, setComboColorizeMode] = useState(true);
  const [comboQuantizeSteps, setComboQuantizeSteps] = useState(0);
  const [comboShadeFrom, setComboShadeFrom] = useState(0);
  const [comboPatternIndex, setComboPatternIndex] = useState(0);
  const [comboRectRadius, setComboRectRadius] = useState(0.18);
  const [comboRectAspect, setComboRectAspect] = useState(0.85);
  const [comboRectRatio, setComboRectRatio] = useState(1.0);

  const applyHalftonePreset = useCallback((index) => {
    const preset = halftoneCmykPresets[index];
    if (!preset?.params) return;
    const p = preset.params;
    setHalftoneSize(p.size ?? 0.2);
    setHalftoneSoftness(p.softness ?? 1);
    setHalftoneGridNoise(p.gridNoise ?? 0.2);
    setHalftoneContrast(p.contrast ?? 1);
    setHalftoneType(p.type ?? 'ink');
    setHalftoneColorBack(p.colorBack ?? '#fbfaf4');
    setHalftoneColorC(p.colorC ?? '#00b3ff');
    setHalftoneColorM(p.colorM ?? '#fc4f9d');
    setHalftoneColorY(p.colorY ?? '#ffd900');
    setHalftoneColorK(p.colorK ?? '#231f20');
    setHalftoneFloodC(p.floodC ?? 0.15);
    setHalftoneGainC(p.gainC ?? 0.3);
    setHalftoneGainY(p.gainY ?? 0.2);
    setHalftonePresetIndex(index);
  }, []);

  const handleHalftoneCustomImageFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHalftoneCustomImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    e.target.value = '';
  }, []);

  useEffect(() => {
    return () => {
      if (halftoneCustomImageUrl) URL.revokeObjectURL(halftoneCustomImageUrl);
    };
  }, [halftoneCustomImageUrl]);

  const handleComboImageFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setComboImageSource((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    e.target.value = '';
  }, []);

  const comboImageSourceRef = useRef(comboImageSource);
  comboImageSourceRef.current = comboImageSource;
  useEffect(() => {
    return () => {
      if (comboImageSourceRef.current?.startsWith('blob:')) URL.revokeObjectURL(comboImageSourceRef.current);
    };
  }, []);

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
    if (q.useAllColorways != null) setUseAllColorways(!!q.useAllColorways);
    if (q.colorwaySeed != null) setColorwaySeed(q.colorwaySeed);
    if (q.shimmer != null) setShimmer(!!q.shimmer);
    if (q.shimmerSpeed != null) setShimmerSpeed(Math.min(16, Math.max(1, Number(q.shimmerSpeed))));
    if (q.shimmerWidth != null) setShimmerWidth(q.shimmerWidth);
    if (q.shimmerIntensity != null) setShimmerIntensity(q.shimmerIntensity);
    if (q.shimmerPosition != null) setShimmerPosition(q.shimmerPosition);
    if (q.shimmerRotation != null) setShimmerRotation(Math.min(1, Math.max(0, Number(q.shimmerRotation))));
    if (q.shimmerNoise != null) setShimmerNoise(Math.min(1, Math.max(0, Number(q.shimmerNoise))));
    if (q.shimmerNoiseSeed != null) setShimmerNoiseSeed(Math.min(1, Math.max(0, Number(q.shimmerNoiseSeed))));
    if (q.shimmerNoiseMin != null) setShimmerNoiseMin(Math.min(2, Math.max(0, Number(q.shimmerNoiseMin))));
    if (q.shimmerNoiseMax != null) setShimmerNoiseMax(Math.min(2, Math.max(0, Number(q.shimmerNoiseMax))));
    if (q.shimmerBlendMode != null) setShimmerBlendMode(Math.min(10, Math.max(0, Math.floor(Number(q.shimmerBlendMode)))));
    if (q.view != null) setView(q.view);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; applyPreset is stable
  }, []);

  /** Sync state to URL (debounced). Only writes params that differ from defaults; keeps URL under ~2k chars. */
  const urlSyncTimeoutRef = useRef(null);
  useEffect(() => {
    urlSyncTimeoutRef.current = setTimeout(() => {
      const search = buildUrlState({
        view, presetIndex, pattern, palette, bgShade, warpShade, weftShade, gridSize,
        warpGradient, weftGradient, gradSteps, rectAspect, cornerRadius, canvasAspect, copyFormat,
        useAllColorways, colorwaySeed, shimmer, shimmerSpeed, shimmerWidth, shimmerIntensity, shimmerPosition, shimmerRotation, shimmerNoise, shimmerNoiseSeed, shimmerNoiseMin, shimmerNoiseMax, shimmerBlendMode,
      });
      const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
      if (window.location.pathname + (window.location.search || '') !== url) {
        window.history.replaceState(null, '', url);
      }
    }, 400);
    return () => { clearTimeout(urlSyncTimeoutRef.current); };
  }, [view, presetIndex, pattern, palette, bgShade, warpShade, weftShade, gridSize, warpGradient, weftGradient, gradSteps, rectAspect, cornerRadius, canvasAspect, copyFormat, useAllColorways, colorwaySeed, shimmer, shimmerSpeed, shimmerWidth, shimmerIntensity, shimmerPosition, shimmerRotation, shimmerNoise, shimmerNoiseSeed, shimmerNoiseMin, shimmerNoiseMax, shimmerBlendMode]);

  /** Animate colorway seed 0→100 over 20m and loop while colorwaySeedPlaying is true. */
  const COLORWAY_ANIM_DURATION_MS = 1200000; // 20 min (20× slower than 60s)
  useEffect(() => {
    if (!colorwaySeedPlaying) return;
    colorwayAnimStartRef.current = performance.now();
    const tick = () => {
      const elapsed = performance.now() - colorwayAnimStartRef.current;
      const seed = (elapsed % COLORWAY_ANIM_DURATION_MS) / (COLORWAY_ANIM_DURATION_MS / 100); // 0→100 in 60s, then repeat
      setColorwaySeed(seed);
      colorwayAnimFrameRef.current = requestAnimationFrame(tick);
    };
    colorwayAnimFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (colorwayAnimFrameRef.current != null) cancelAnimationFrame(colorwayAnimFrameRef.current);
    };
  }, [colorwaySeedPlaying]);

  /** Capture canvas at PNG_COPY_SCALE× resolution as PNG and copy to clipboard (v1–v4). */
  const handleCopy2xPng = useCallback(async () => {
    const canvas =
      view === 'weavingHalftone' || view === 'imageRectsHalftone'
        ? (halftoneCanvasRef.current ?? halftoneContainerRef.current?.querySelector('canvas'))
        : canvasRef.current;
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
  }, [view]);

  /** Build SVG with canvas as embedded raster (data URL at 2×), copy as image/svg+xml and text/plain. */
  const handleCopySvg = useCallback(async () => {
    const canvas =
      view === 'weavingHalftone' || view === 'imageRectsHalftone'
        ? (halftoneCanvasRef.current ?? halftoneContainerRef.current?.querySelector('canvas'))
        : canvasRef.current;
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
  }, [view]);

  const handleCopy = useCallback(() => {
    if (copyFormat === 'png') handleCopy2xPng();
    else handleCopySvg();
  }, [copyFormat, handleCopy2xPng, handleCopySvg]);

  /** Video recording (WebM or MP4). Canvas resolved per current view. */
  const { isRecording, isProcessing, recordFormat, setRecordFormat, startRecording: recStart, stopRecording } = useCanvasRecorder('shaderbox');

  const startRecording = useCallback(() => {
    const canvas =
      view === 'weavingHalftone' || view === 'imageRectsHalftone'
        ? (halftoneCanvasRef.current ?? halftoneContainerRef.current?.querySelector('canvas'))
        : canvasRef.current;
    recStart(canvas);
  }, [view, recStart]);

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
    if (randomizeRectAspect) setRectAspect(Number(rand(0.5, 1).toFixed(2)));
    if (randomizeCornerRadius) setCornerRadius(Number(rand(0.05, 0.4).toFixed(2)));
    setCanvasAspect(Number(rand(0.6, 1.5).toFixed(2)));
    setShimmer(Math.random() < 0.5);
    setShimmerSpeed(randInt(1, 16));
    setShimmerWidth(Number(rand(0.25, 24).toFixed(2)));
    setShimmerIntensity(Number(rand(0.1, 0.8).toFixed(2)));
    setShimmerPosition(Number(rand(0, 1).toFixed(2)));
    setShimmerRotation(Number(rand(0, 1).toFixed(3)));
    setShimmerNoise(Number(rand(0, 1).toFixed(2)));
    setShimmerNoiseSeed(Number(rand(0, 1).toFixed(3)));
    setShimmerNoiseMin(Number(rand(0.3, 1).toFixed(1)));
    setShimmerNoiseMax(Number(rand(1, 1.8).toFixed(1)));
    setUseAllColorways(Math.random() < 0.5);
    setColorwaySeed(randInt(0, 100));
  }, [randomizeRectAspect, randomizeCornerRadius]);

  /** Keyboard shortcuts when focus is not in input/select/textarea. Mod+C = copy; Mod+1..8 = preset 0–7; Mod+Shift+R or F5 = reload. */
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
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCopy, applyPreset, handleReload]);

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
            <button type="button" className={navBtnInactive} onClick={() => setView('weavingHalftone')} aria-pressed={false} aria-label="Weaving + Halftone">Weaving + Halftone</button>
            <button type="button" className={navBtnInactive} onClick={() => setView('imageRectsHalftone')} aria-pressed={false} aria-label="Image Rects + Halftone">Image Rects + Halftone</button>
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
          <button type="button" className={view === 'weaving' ? navBtnActive : navBtnInactive} onClick={() => setView('weaving')} aria-pressed={view === 'weaving'} aria-label="Weaving draft">Weaving</button>
          <button type="button" className={view === 'weavingHalftone' ? navBtnActive : navBtnInactive} onClick={() => setView('weavingHalftone')} aria-pressed={view === 'weavingHalftone'} aria-label="Weaving + Halftone">Weaving + Halftone</button>
          <button type="button" className={view === 'imageRectsHalftone' ? navBtnActive : navBtnInactive} onClick={() => setView('imageRectsHalftone')} aria-pressed={view === 'imageRectsHalftone'} aria-label="Image Rects + Halftone">Image Rects + Halftone</button>
          <button type="button" className={navBtnInactive} onClick={() => setView('imageRects')} aria-pressed={false} aria-label="Image to colored rects">Image Rects</button>
        </div>
      </nav>
      <div className="relative flex min-h-0 flex-1 flex-row overflow-hidden bg-surface">
      {/* Floating sidebar: whole-panel opacity via motion; transparent until hover. */}
      <motion.aside
        className="fixed left-0 top-9 z-10 flex h-[calc(100dvh-2.25rem)] w-[288px] flex-col gap-3 overflow-y-auto overflow-x-auto border-r border-border-subtle bg-surface px-3 py-3"
        initial={false}
        animate={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        aria-label="Weaving controls"
      >
        <div className="flex flex-col gap-3">
          <div className={`${sidebarGroup} ${sidebarGroupSticky}`}>
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
              {view === 'weavingHalftone' && (
                <>
                  <label className={`${btnGhost} cursor-pointer`}>
                    <Icon name="upload_file" className={iconMd} />
                    <span>Image from desktop</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleHalftoneCustomImageFile}
                      aria-label="Pick an image from your computer"
                    />
                  </label>
                  {halftoneCustomImageUrl && (
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => {
                        if (halftoneCustomImageUrl) URL.revokeObjectURL(halftoneCustomImageUrl);
                        setHalftoneCustomImageUrl('');
                      }}
                      aria-label="Use weaving as source"
                    >
                      <Icon name="refresh" className={iconMd} />
                      <span>Use weaving</span>
                    </button>
                  )}
                </>
              )}
              {view === 'imageRectsHalftone' && (
                <label className={`${btnGhost} cursor-pointer`}>
                  <Icon name="upload_file" className={iconMd} />
                  <span>Image from desktop</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleComboImageFile}
                    aria-label="Pick an image from your computer for Image Rects + Halftone"
                  />
                </label>
              )}
            </div>
          </div>
          {view === 'imageRectsHalftone' && (
            <>
              <div className={sidebarGroup}>
                <div className={sidebarGroupTitle}>Image Rects</div>
                {(!comboImageSource || comboImageSource.startsWith('blob:')) && (
                  <span className={typeCaption}>{comboImageSource ? 'Using your image' : 'Pick “Image from desktop” in Actions'}</span>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label.Root className={typeLabel} htmlFor="combo-grid">Grid</Label.Root>
                  <SliderWithInput id="combo-grid" value={comboGridSize} onValueChange={setComboGridSize} min={8} max={64} step={1} snapValues={GRID_SNAPS} snapPointCount={GRID_SNAPS.length} aria-label="Grid size" />
                  <div className="flex items-center gap-2">
                    <span className={typeLabel}>Palette</span>
                    {PALETTE_SWATCH_COLORS.map((c, i) => (
                      <button key={i} type="button" className={`h-6 w-6 rounded border-2 ${comboPalette === i ? 'border-accent' : 'border-border-subtle'}`} style={{ backgroundColor: c }} onClick={() => setComboPalette(i)} aria-label={PALETTE_NAMES[i]} />
                    ))}
                  </div>
                  <Label.Root className={typeLabel} htmlFor="combo-pattern">Weave</Label.Root>
                  <Select.Root value={String(comboPatternIndex)} onValueChange={(v) => setComboPatternIndex(Number(v))}>
                    <Select.Trigger id="combo-pattern" className={selectTrigger} aria-label="Weave pattern">
                      <Select.Value placeholder="Pattern" />
                      <Icon name="expand_more" className={`${iconLg} opacity-60`} />
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content className={selectContent} position="popper" sideOffset={4}>
                        <Select.Viewport>
                          {PATTERNS.map((p, i) => (
                            <Select.Item key={i} className={selectItem} value={String(i)}>
                              <Select.ItemText>{PATTERNS[i]?.name ?? `Pattern ${i}`}</Select.ItemText>
                              <Select.ItemIndicator className="absolute right-2 inline-flex" />
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                  <Label.Root className={typeLabel} htmlFor="combo-radius">Radius</Label.Root>
                  <SliderWithInput id="combo-radius" value={comboRectRadius} onValueChange={setComboRectRadius} min={0} max={0.5} step={0.01} format={(n) => n.toFixed(2)} aria-label="Rect radius" />
                  <Label.Root className={typeLabel} htmlFor="combo-aspect">Aspect</Label.Root>
                  <SliderWithInput id="combo-aspect" value={comboRectAspect} onValueChange={setComboRectAspect} min={0.3} max={1.5} step={0.01} format={(n) => n.toFixed(2)} aria-label="Rect aspect" />
                  <Label.Root className={typeLabel} htmlFor="combo-ratio">Ratio</Label.Root>
                  <SliderWithInput id="combo-ratio" value={comboRectRatio} onValueChange={setComboRectRatio} min={0.2} max={1} step={0.01} format={(n) => n.toFixed(2)} aria-label="Rect ratio" />
                  <div className="flex items-center gap-1">
                    <span className={typeLabel}>Mode</span>
                    <button type="button" className={`flex-1 rounded border px-2 py-1 text-[10px] ${comboColorizeMode ? 'border-accent bg-accent/10' : 'border-border-subtle'}`} onClick={() => setComboColorizeMode(true)}>Color</button>
                    <button type="button" className={`flex-1 rounded border px-2 py-1 text-[10px] ${!comboColorizeMode ? 'border-accent bg-accent/10' : 'border-border-subtle'}`} onClick={() => setComboColorizeMode(false)}>Brand</button>
                  </div>
                  <Label.Root className={typeLabel} htmlFor="combo-quantize">Quantize</Label.Root>
                  <SliderWithInput id="combo-quantize" value={comboQuantizeSteps} onValueChange={setComboQuantizeSteps} min={0} max={32} step={1} aria-label="Quantize steps" />
                  <Label.Root className={typeLabel} htmlFor="combo-shade">Shade from</Label.Root>
                  <Select.Root value={String(comboShadeFrom)} onValueChange={(v) => setComboShadeFrom(Number(v))}>
                    <Select.Trigger id="combo-shade" className={selectTrigger} aria-label="Shade from">
                      <Select.Value />
                      <Icon name="expand_more" className={`${iconLg} opacity-60`} />
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content className={selectContent} position="popper" sideOffset={4}>
                        <Select.Viewport>
                          {[{ value: 0, label: 'Color' }, { value: 1, label: 'Warp' }, { value: 2, label: 'Weft' }, { value: 3, label: 'Warp+Weft' }].map((opt) => (
                            <Select.Item key={opt.value} className={selectItem} value={String(opt.value)}>
                              <Select.ItemText>{opt.label}</Select.ItemText>
                              <Select.ItemIndicator className="absolute right-2 inline-flex" />
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                  <Label.Root className={typeLabel} htmlFor="combo-bg">BG shade</Label.Root>
                  <Select.Root value={String(comboBgShade)} onValueChange={(v) => setComboBgShade(Number(v))}>
                    <Select.Trigger id="combo-bg" className={selectTrigger} aria-label="Background shade">
                      <Select.Value />
                      <Icon name="expand_more" className={`${iconLg} opacity-60`} />
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content className={selectContent} position="popper" sideOffset={4}>
                        <Select.Viewport>
                          {SHADE_NAMES.map((name, i) => (
                            <Select.Item key={i} className={selectItem} value={String(i)}>
                              <Select.ItemText>{name}</Select.ItemText>
                              <Select.ItemIndicator className="absolute right-2 inline-flex" />
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                </div>
              </div>
            </>
          )}
          {view !== 'imageRectsHalftone' && (
            <>
          <div className={sidebarGroup}>
            <div className={sidebarGroupTitle}>Preset & colorway</div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="tune" title="Preset" />
              <Label.Root className="sr-only" htmlFor="preset-select">Preset (weave, colorway, shades, gradient)</Label.Root>
              <Select.Root
                value={presetIndex != null ? String(presetIndex) : 'custom'}
                onValueChange={(v) => (v === 'custom' ? setPresetIndex(null) : applyPreset(Number(v)))}
              >
                <Select.Trigger id="preset-select" className={selectTrigger} title="Preset (weave + colorway + shades + grad)" aria-label="Preset (weave, colorway, shades, gradient)">
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
              <span className={`${controlLabel} ${typeLabel}`} title="Weave pattern">Weave</span>
              <AppSelect id="weave-pattern" labelText="Weave pattern" value={pattern} onValueChange={(v) => { setPattern(v); setPresetIndex(null); }} options={patternOptions} title="Weave pattern" placeholder="Weave" />
            </div>
          </div>
          <div className={sidebarGroup}>
            <div className={sidebarGroupTitle}>Shades</div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="palette" title="Shades" locked={shadesLocked} onLockChange={setShadesLocked} />
              <AppSelect id="bg-shade" labelText="Background shade" value={bgShade} onValueChange={(v) => { setBgShade(v); setPresetIndex(null); }} options={shadeOptions('BG')} title="Background shade" placeholder="BG" />
              <AppSelect
                id="warp-shade"
                labelText="Warp shade"
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
                id="weft-shade"
                labelText="Weft shade"
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
              <SliderWithInput
                id="warp-range"
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
                snapPointCount={gradSteps >= 2 ? gradSteps + 1 : 5}
                aria-label="Warp gradient range"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="gradient" title="Warp gradient" />
              <AppSelect id="warp-start-shade" labelText="Warp gradient start shade" value={warpGradient.startShade} onValueChange={(s) => { setPresetIndex(null); setWarpGradient((g) => ({ ...g, startShade: s })); }} options={shadeOptions()} title="Warp start" placeholder="Start" />
              <AppSelect id="warp-end-shade" labelText="Warp gradient end shade" value={warpGradient.endShade} onValueChange={(s) => { setPresetIndex(null); setWarpGradient((g) => ({ ...g, endShade: s })); }} options={shadeOptions()} title="Warp end" placeholder="End" />
              <DirectionSwitch value={warpGradient.direction} onValueChange={(d) => { setPresetIndex(null); setWarpGradient((g) => ({ ...g, direction: d })); }} options={directionOptions} title="Warp direction" ariaLabel="Warp gradient direction" />
            </div>
          </div>
          <div className={sidebarGroup}>
            <div className={sidebarGroupTitle}>Weft gradient</div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="gradient" title="Weft gradient range" />
              <Label.Root className="sr-only" htmlFor="weft-range">Weft gradient range</Label.Root>
              <SliderWithInput
                id="weft-range"
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
                snapPointCount={gradSteps >= 2 ? gradSteps + 1 : 5}
                aria-label="Weft gradient range"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="gradient" title="Weft gradient" />
              <AppSelect id="weft-start-shade" labelText="Weft gradient start shade" value={weftGradient.startShade} onValueChange={(s) => { setPresetIndex(null); setWeftGradient((g) => ({ ...g, startShade: s })); }} options={shadeOptions()} title="Weft start" placeholder="Start" />
              <AppSelect id="weft-end-shade" labelText="Weft gradient end shade" value={weftGradient.endShade} onValueChange={(s) => { setPresetIndex(null); setWeftGradient((g) => ({ ...g, endShade: s })); }} options={shadeOptions()} title="Weft end" placeholder="End" />
              <DirectionSwitch value={weftGradient.direction} onValueChange={(d) => { setPresetIndex(null); setWeftGradient((g) => ({ ...g, direction: d })); }} options={directionOptionsWeft} title="Weft direction" ariaLabel="Weft gradient direction" />
            </div>
          </div>
          <div className={sidebarGroup}>
            <div className={sidebarGroupTitle}>Grid & layout</div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="grid_on" title="Resolution" />
              <Label.Root className="sr-only" htmlFor="grid-slider">Tile size</Label.Root>
              <SliderWithInput
                id="grid-slider"
                value={gridSize}
                onValueChange={setGridSize}
                min={8}
                max={64}
                step={1}
                snapValues={GRID_SNAPS}
                snapPointCount={GRID_SNAPS.length}
                aria-label="Tile size (grid cells)"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="timeline" title="Quantization" />
              <Label.Root className="sr-only" htmlFor="grad-steps-slider">Gradation steps</Label.Root>
              <SliderWithInput
                id="grad-steps-slider"
                value={gradSteps}
                onValueChange={setGradSteps}
                min={0}
                max={16}
                step={1}
                snapPointCount={17}
                format={(n) => (n === 0 ? 'Smooth' : String(n))}
                parse={(s) => { if (s === 'Smooth' || s === '') return 0; const n = Number(s); return Number.isFinite(n) ? n : null; }}
                aria-label="Gradation steps (0 = smooth)"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="aspect_ratio" title="Rect ratio (36×40 = 0.9)" locked={!randomizeRectAspect} onLockChange={() => setRandomizeRectAspect((v) => !v)} />
              <Label.Root className="sr-only" htmlFor="rect-aspect-slider">Rect aspect ratio (36×40 spec = 0.9)</Label.Root>
              <SliderWithInput
                id="rect-aspect-slider"
                value={rectAspect ?? RECT_ASPECT_DEFAULT}
                onValueChange={setRectAspect}
                min={0.5}
                max={1}
                step={0.05}
                snapPointCount={11}
                format={(n) => n.toFixed(2)}
                aria-label="Rect aspect (36×40 = 0.9)"
              />
              <button
                type="button"
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${btnGhost} p-0`}
                onClick={() => setRectAspect(RECT_ASPECT_DEFAULT)}
                title="Reset rect aspect to 0.9 (36×40)"
                aria-label="Reset rect aspect to default"
              >
                <Icon name="restart_alt" className={iconSm} />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="crop" title="Canvas aspect" />
              <Label.Root className="sr-only" htmlFor="canvas-aspect-slider">Canvas aspect ratio</Label.Root>
              <SliderWithInput
                id="canvas-aspect-slider"
                value={canvasAspect}
                onValueChange={setCanvasAspect}
                min={0.5}
                max={2}
                step={0.05}
                snapPointCount={16}
                format={(n) => n.toFixed(2)}
                aria-label="Canvas aspect ratio"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <GroupIcon name="rounded_corner" title="Radius" locked={!randomizeCornerRadius} onLockChange={() => setRandomizeCornerRadius((v) => !v)} />
              <Label.Root className="sr-only" htmlFor="radius-slider">Corner radius</Label.Root>
              <SliderWithInput
                id="radius-slider"
                value={cornerRadius}
                onValueChange={setCornerRadius}
                min={0}
                max={0.5}
                step={0.01}
                snapPointCount={11}
                format={(n) => n.toFixed(2)}
                aria-label="Corner radius"
              />
              <button
                type="button"
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${btnGhost} p-0`}
                onClick={() => setCornerRadius(0.18)}
                title="Reset corner radius to 0.18"
                aria-label="Reset corner radius to default"
              >
                <Icon name="restart_alt" className={iconSm} />
              </button>
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
                <button
                  type="button"
                  className={`flex h-7 w-7 items-center justify-center rounded-md border ${typeControl} transition-colors ${shimmerPlaying ? 'border-accent bg-accent/15 text-accent' : 'border-border-subtle bg-surface-input text-text-secondary hover:bg-surface-hover hover:text-text'}`}
                  aria-label={shimmerPlaying ? 'Pause shimmer animation' : 'Play shimmer animation'}
                  aria-pressed={shimmerPlaying}
                  onClick={() => setShimmerPlaying((p) => !p)}
                >
                  <Icon name={shimmerPlaying ? 'pause' : 'play_arrow'} className={iconSm} />
                </button>
                <AppSelect
                  id="shimmer-blend"
                  labelText="Shimmer blend mode"
                  value={shimmerBlendMode}
                  onValueChange={setShimmerBlendMode}
                  options={[
                    { value: 0, label: 'Add' },
                    { value: 1, label: 'Multiply' },
                    { value: 2, label: 'Screen' },
                    { value: 3, label: 'Overlay' },
                    { value: 4, label: 'Soft Light' },
                    { value: 5, label: 'Hard Light' },
                    { value: 6, label: 'Color Dodge' },
                    { value: 7, label: 'Color Burn' },
                    { value: 8, label: 'Linear Burn' },
                    { value: 9, label: 'Difference' },
                    { value: 10, label: 'Exclusion' },
                  ]}
                  title="Shimmer blend mode"
                  placeholder="Blend"
                />
                <Label.Root className="sr-only" htmlFor="shimmer-speed">Shimmer speed (cells/s)</Label.Root>
                <SliderWithInput
                  id="shimmer-speed"
                  value={shimmerSpeed}
                  onValueChange={setShimmerSpeed}
                  min={1}
                  max={16}
                  step={1}
                  snapPointCount={16}
                  aria-label="Shimmer speed (cells/s)"
                />
                <span className={`${controlLabel} ${typeCaption} tabular-nums`} title="Cells per second">Cells/s</span>
                <Label.Root className="sr-only" htmlFor="shimmer-width">Shimmer width</Label.Root>
                <SliderWithInput
                  id="shimmer-width"
                  value={shimmerWidth}
                  onValueChange={setShimmerWidth}
                  min={0.25}
                  max={24}
                  step={0.25}
                  format={(n) => n.toFixed(2)}
                  aria-label="Shimmer width"
                />
                <Label.Root className="sr-only" htmlFor="shimmer-intensity">Shimmer intensity</Label.Root>
                <SliderWithInput
                  id="shimmer-intensity"
                  value={shimmerIntensity}
                  onValueChange={setShimmerIntensity}
                  min={0}
                  max={1}
                  step={0.05}
                  snapPointCount={11}
                  format={(n) => n.toFixed(2)}
                  aria-label="Shimmer intensity"
                />
                <span className={`${controlLabel} ${typeCaption}`}>Intensity</span>
                <Label.Root className="sr-only" htmlFor="shimmer-position">Shimmer position</Label.Root>
                <SliderWithInput
                  id="shimmer-position"
                  value={shimmerPosition}
                  onValueChange={setShimmerPosition}
                  min={0}
                  max={1}
                  step={0.01}
                  format={(n) => n.toFixed(2)}
                  aria-label="Shimmer position"
                />
                <span className={`${controlLabel} ${typeCaption}`}>Position</span>
                <Label.Root className="sr-only" htmlFor="shimmer-rotation">Shimmer rotation</Label.Root>
                <SliderWithInput
                  id="shimmer-rotation"
                  value={shimmerRotation}
                  onValueChange={setShimmerRotation}
                  min={0}
                  max={1}
                  step={0.01}
                  format={(n) => n.toFixed(2)}
                  aria-label="Shimmer rotation"
                />
                <span className={`${controlLabel} ${typeCaption}`}>Rotation</span>
                <Label.Root className="sr-only" htmlFor="shimmer-noise">Shimmer noise amount</Label.Root>
                <SliderWithInput
                  id="shimmer-noise"
                  value={shimmerNoise}
                  onValueChange={setShimmerNoise}
                  min={0}
                  max={1}
                  step={0.05}
                  snapPointCount={11}
                  format={(n) => n.toFixed(2)}
                  aria-label="Shimmer noise amount"
                />
                <span className={`${controlLabel} ${typeCaption}`}>Noise</span>
                <Label.Root className="sr-only" htmlFor="shimmer-noise-seed">Shimmer noise seed</Label.Root>
                <SliderWithInput
                  id="shimmer-noise-seed"
                  value={shimmerNoiseSeed}
                  onValueChange={setShimmerNoiseSeed}
                  min={0}
                  max={1}
                  step={0.01}
                  format={(n) => n.toFixed(2)}
                  aria-label="Shimmer noise seed (pattern variation)"
                />
                <span className={`${controlLabel} ${typeCaption}`}>Noise seed</span>
                <Label.Root className="sr-only" htmlFor="shimmer-noise-min">Shimmer noise min</Label.Root>
                <SliderWithInput
                  id="shimmer-noise-min"
                  value={shimmerNoiseMin}
                  onValueChange={setShimmerNoiseMin}
                  min={0}
                  max={2}
                  step={0.1}
                  format={(n) => n.toFixed(1)}
                  aria-label="Shimmer noise factor min (0–2)"
                />
                <span className={`${controlLabel} ${typeCaption}`}>Noise min</span>
                <Label.Root className="sr-only" htmlFor="shimmer-noise-max">Shimmer noise max</Label.Root>
                <SliderWithInput
                  id="shimmer-noise-max"
                  value={shimmerNoiseMax}
                  onValueChange={setShimmerNoiseMax}
                  min={0}
                  max={2}
                  step={0.1}
                  format={(n) => n.toFixed(1)}
                  aria-label="Shimmer noise factor max (0–2)"
                />
                <span className={`${controlLabel} ${typeCaption}`}>Noise max</span>
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
                <SliderWithInput
                  id="colorway-seed"
                  value={colorwaySeed}
                  onValueChange={(v) => setColorwaySeed(Math.floor(v))}
                  min={0}
                  max={100}
                  step={1}
                  snapPointCount={11}
                  aria-label="Colorway seed"
                />
                <span className={`shrink-0 min-w-16 ${typeValue}`} aria-hidden>Seed: {typeof colorwaySeed === 'number' && Number.isInteger(colorwaySeed) ? colorwaySeed : colorwaySeed.toFixed(1)}</span>
                <button
                  type="button"
                  className={`flex h-7 w-7 items-center justify-center rounded-md border ${typeControl} transition-colors ${colorwaySeedPlaying ? 'border-accent bg-accent/15 text-accent' : 'border-border-subtle bg-surface-input text-text-secondary hover:bg-surface-hover hover:text-text'}`}
                  aria-label={colorwaySeedPlaying ? 'Pause colorway seed animation' : 'Play colorway seed animation (0→100 in 20m, loop)'}
                  aria-pressed={colorwaySeedPlaying}
                  onClick={() => setColorwaySeedPlaying((p) => !p)}
                >
                  <Icon name={colorwaySeedPlaying ? 'pause' : 'play_arrow'} className={iconSm} />
                </button>
              </>
            )}
            </div>
          </div>
          </>
          )}
          {(view === 'weavingHalftone' || view === 'imageRectsHalftone') && (
            <>
              <div className={sidebarGroup}>
                <div className={sidebarGroupTitle}>Halftone preset</div>
                <Select.Root value={String(halftonePresetIndex)} onValueChange={(v) => applyHalftonePreset(Number(v))}>
                  <Select.Trigger className={selectTrigger} aria-label="Halftone preset">
                    <Select.Value placeholder="Preset" />
                    <Icon name="expand_more" className={`${iconLg} opacity-60`} />
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className={selectContent} position="popper" sideOffset={4}>
                      <Select.Viewport>
                        {halftoneCmykPresets.map((p, i) => (
                          <Select.Item key={i} className={selectItem} value={String(i)}>
                            <Select.ItemText>{p.name}</Select.ItemText>
                            <Select.ItemIndicator className="absolute right-2 inline-flex" />
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>
              <div className={sidebarGroup}>
                <div className={sidebarGroupTitle}>Halftone dot & grid</div>
                <div className="flex flex-col gap-1">
                  <Label.Root className={typeLabel} htmlFor="v3-halftone-size">Size</Label.Root>
                  <SliderWithInput id="v3-halftone-size" aria-label="Grid size" value={halftoneSize} onValueChange={setHalftoneSize} min={0.01} max={1} step={0.01} format={(n) => n.toFixed(2)} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label.Root className={typeLabel} htmlFor="v3-halftone-softness">Softness</Label.Root>
                  <SliderWithInput id="v3-halftone-softness" aria-label="Dot softness" value={halftoneSoftness} onValueChange={setHalftoneSoftness} min={0} max={1} step={0.05} format={(n) => n.toFixed(2)} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label.Root className={typeLabel} htmlFor="v3-halftone-gridnoise">Grid noise</Label.Root>
                  <SliderWithInput id="v3-halftone-gridnoise" aria-label="Grid noise" value={halftoneGridNoise} onValueChange={setHalftoneGridNoise} min={0} max={1} step={0.05} format={(n) => n.toFixed(2)} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label.Root className={typeLabel}>Type</Label.Root>
                  <Select.Root value={halftoneType} onValueChange={setHalftoneType}>
                    <Select.Trigger className={selectTrigger} aria-label="Dot type">
                      <Select.Value />
                      <Icon name="expand_more" className={`${iconLg} opacity-60`} />
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content className={selectContent} position="popper" sideOffset={4}>
                        <Select.Viewport>
                          {[{ value: 'dots', label: 'Dots' }, { value: 'ink', label: 'Ink' }, { value: 'sharp', label: 'Sharp' }].map((opt) => (
                            <Select.Item key={opt.value} className={selectItem} value={opt.value}>
                              <Select.ItemText>{opt.label}</Select.ItemText>
                              <Select.ItemIndicator className="absolute right-2 inline-flex" />
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                </div>
              </div>
              <div className={sidebarGroup}>
                <div className={sidebarGroupTitle}>Halftone tone</div>
                <div className="flex flex-col gap-1">
                  <Label.Root className={typeLabel} htmlFor="v3-halftone-contrast">Contrast</Label.Root>
                  <SliderWithInput id="v3-halftone-contrast" aria-label="Contrast" value={halftoneContrast} onValueChange={setHalftoneContrast} min={0} max={2} step={0.05} format={(n) => n.toFixed(2)} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label.Root className={typeLabel} htmlFor="v3-halftone-floodc">Flood C</Label.Root>
                  <SliderWithInput id="v3-halftone-floodc" aria-label="Cyan flood" value={halftoneFloodC} onValueChange={setHalftoneFloodC} min={0} max={1} step={0.05} format={(n) => n.toFixed(2)} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label.Root className={typeLabel} htmlFor="v3-halftone-gainc">Gain C</Label.Root>
                  <SliderWithInput id="v3-halftone-gainc" aria-label="Cyan gain" value={halftoneGainC} onValueChange={setHalftoneGainC} min={-1} max={1} step={0.05} format={(n) => n.toFixed(2)} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label.Root className={typeLabel} htmlFor="v3-halftone-gainy">Gain Y</Label.Root>
                  <SliderWithInput id="v3-halftone-gainy" aria-label="Yellow gain" value={halftoneGainY} onValueChange={setHalftoneGainY} min={-1} max={1} step={0.05} format={(n) => n.toFixed(2)} />
                </div>
              </div>
              <div className={sidebarGroup}>
                <div className={sidebarGroupTitle}>Halftone ink colors</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: 'Back', value: halftoneColorBack, set: setHalftoneColorBack },
                    { label: 'C', value: halftoneColorC, set: setHalftoneColorC },
                    { label: 'M', value: halftoneColorM, set: setHalftoneColorM },
                    { label: 'Y', value: halftoneColorY, set: setHalftoneColorY },
                    { label: 'K', value: halftoneColorK, set: setHalftoneColorK },
                  ].map(({ label, value, set }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className={`${typeLabel} w-6`}>{label}</span>
                      <input
                        type="color"
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        className="h-7 w-10 cursor-pointer rounded border border-border-subtle bg-surface-input"
                        aria-label={`${label} color`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <main className={`flex min-h-0 flex-1 overflow-auto p-4 ${view === 'weavingHalftone' || view === 'imageRectsHalftone' ? 'flex-col items-stretch' : 'items-center justify-center'}`}>
          {view === 'weaving' && (
            <ShaderCanvas patternIndex={pattern} palette={palette} bgShade={bgShade} warpShade={warpShade} weftShade={weftShade} gridSize={gridSize} warpGradient={warpGradient} weftGradient={weftGradient} gradSteps={gradSteps} rectAspect={rectAspect} cornerRadius={cornerRadius} canvasAspect={canvasAspect} shimmer={shimmer} shimmerSpeed={shimmer && shimmerPlaying ? shimmerSpeed : 0} shimmerWidth={shimmerWidth} shimmerIntensity={shimmerIntensity} shimmerPosition={shimmerPosition} shimmerRotation={shimmerRotation} shimmerNoise={shimmerNoise} shimmerNoiseSeed={shimmerNoiseSeed} shimmerNoiseMin={shimmerNoiseMin} shimmerNoiseMax={shimmerNoiseMax} shimmerBlendMode={shimmerBlendMode} useAllColorways={useAllColorways} colorwaySeed={colorwaySeed} patterns={PATTERNS} onFpsChange={setFps} onCanvasRef={(el) => { canvasRef.current = el; }} />
          )}
          {view === 'imageRectsHalftone' && (
            <Suspense fallback={<div className="flex flex-1 items-center justify-center text-text-secondary">Loading…</div>}>
              <div className="flex min-h-0 flex-1 w-full flex-col">
                <ImageRectsHalftoneStage
                  imageSource={comboImageSource}
                  gridSize={comboGridSize}
                  palette={comboPalette}
                  bgShade={comboBgShade}
                  colorizeMode={comboColorizeMode}
                  quantizeSteps={comboQuantizeSteps}
                  rectShade={1}
                  shadeFrom={comboShadeFrom}
                  patternIndex={comboPatternIndex}
                  patterns={PATTERNS}
                  rectRadius={comboRectRadius}
                  rectAspect={comboRectAspect}
                  rectRatio={comboRectRatio}
                  size={halftoneSize}
                  softness={halftoneSoftness}
                  gridNoise={halftoneGridNoise}
                  contrast={halftoneContrast}
                  type={halftoneType}
                  colorBack={halftoneColorBack}
                  colorC={halftoneColorC}
                  colorM={halftoneColorM}
                  colorY={halftoneColorY}
                  colorK={halftoneColorK}
                  floodC={halftoneFloodC}
                  gainC={halftoneGainC}
                  gainY={halftoneGainY}
                  halftoneContainerRef={halftoneContainerRef}
                  halftoneCanvasRef={halftoneCanvasRef}
                />
              </div>
            </Suspense>
          )}
          {view === 'weavingHalftone' && (
            <Suspense fallback={<div className="flex flex-1 items-center justify-center text-text-secondary">Loading…</div>}>
              <div className="flex min-h-0 flex-1 w-full flex-col">
                <WeavingHalftoneStage
                  patterns={PATTERNS}
                  patternIndex={pattern}
                  palette={palette}
                  bgShade={bgShade}
                  warpShade={warpShade}
                  weftShade={weftShade}
                  gridSize={gridSize}
                  warpGradient={warpGradient}
                  weftGradient={weftGradient}
                  gradSteps={gradSteps}
                  rectAspect={rectAspect}
                  cornerRadius={cornerRadius}
                  canvasAspect={canvasAspect}
                  shimmer={shimmer}
                  shimmerSpeed={shimmer && shimmerPlaying ? shimmerSpeed : 0}
                  shimmerWidth={shimmerWidth}
                  shimmerIntensity={shimmerIntensity}
                  shimmerPosition={shimmerPosition}
                  shimmerRotation={shimmerRotation}
                  shimmerNoise={shimmerNoise}
                  shimmerNoiseSeed={shimmerNoiseSeed}
                  shimmerNoiseMin={shimmerNoiseMin}
                  shimmerNoiseMax={shimmerNoiseMax}
                  shimmerBlendMode={shimmerBlendMode}
                  useAllColorways={useAllColorways}
                  colorwaySeed={colorwaySeed}
                  size={halftoneSize}
                  softness={halftoneSoftness}
                  gridNoise={halftoneGridNoise}
                  contrast={halftoneContrast}
                  type={halftoneType}
                  colorBack={halftoneColorBack}
                  colorC={halftoneColorC}
                  colorM={halftoneColorM}
                  colorY={halftoneColorY}
                  colorK={halftoneColorK}
                  floodC={halftoneFloodC}
                  gainC={halftoneGainC}
                  gainY={halftoneGainY}
                  halftoneContainerRef={halftoneContainerRef}
                  halftoneCanvasRef={halftoneCanvasRef}
                  customImageUrl={halftoneCustomImageUrl || undefined}
                />
              </div>
            </Suspense>
          )}
        </main>

        <footer className="relative h-[100px] shrink-0 overflow-hidden border-t border-border-subtle bg-surface-elevated">
          <div className="flex h-full min-h-9 flex-wrap items-center gap-2 overflow-y-auto px-3 py-2">
            <span className={pill}>{PATTERNS[pattern]?.name ?? '—'}</span>
            <span className={pill}>{PALETTE_NAMES[palette]}</span>
            <span className={pill}>BG: {bgShade === 4 ? <><Icon name={SHADE_TRANSPARENT_ICON} className={iconXs} /></> : SHADE_NAMES[bgShade]}</span>
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
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-linear-to-t from-surface-elevated to-transparent" aria-hidden />
        </footer>
      </div>
      </div>
    </div>
  );
}
