/**
 * Shader Sandbox — ENS Weaving Draft.
 * WebGL canvas reads shaders from src/shaders/*.glsl. Controls: Radix Select + Slider.
 */
import { useState, useCallback, useRef } from 'react';
import * as Select from '@radix-ui/react-select';
import * as Slider from '@radix-ui/react-slider';
import * as Label from '@radix-ui/react-label';
import { ShaderCanvas } from './components/ShaderCanvas';
import { PATTERNS } from './patterns';
import AppV2 from './AppV2.jsx';

const PALETTE_NAMES = ['Citrine', 'Garnet', 'Lapis', 'Peridot'];
const SHADE_NAMES = ['950', '500', '100', '400'];

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

const btnGhost =
  'inline-flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-transparent px-2.5 py-1 text-[9px] font-medium text-text-secondary outline-none transition-colors hover:border-border hover:bg-surface-hover hover:text-text focus:border-accent focus:outline-none';
const selectTrigger =
  'inline-flex h-7 min-w-[4rem] items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface-input px-2 py-0.5 text-[10px] text-text outline-none transition-colors hover:border-border focus:border-accent focus:ring-1 focus:ring-accent/20 data-[placeholder]:text-text-secondary';
const selectContent = 'z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border-subtle bg-surface-elevated shadow-md';
const selectItem =
  'relative flex cursor-default select-none items-center rounded py-1.5 pl-2.5 pr-8 text-[11px] outline-none data-[highlighted]:bg-surface-hover data-[highlighted]:text-text';
const pill = 'inline-flex items-center rounded-full tracking-wide bg-surface-elevated border border-border-subtle px-2 py-0.5 text-[9px] uppercase font-mono font-medium text-text-secondary';
/** Icon-only group header; use title for tooltip. */
const GroupIcon = ({ name, title, className = '' }) => (
  <span title={title} className={`shrink-0 ${className}`}>
    <Icon name={name} className="text-[18px] text-text-muted" />
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
  'flex h-full min-w-[28px] items-center justify-center px-2 text-[13px] text-text-secondary transition-colors hover:bg-surface-hover hover:text-text data-[state=on]:bg-accent/15 data-[state=on]:text-accent border-r border-border-subtle last:border-r-0';

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
          {opt.icon ? <Icon name={opt.icon} className="text-[18px]" /> : opt.label}
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
          {selected?.icon && <Icon name={selected.icon} className="shrink-0 text-[16px] text-text-muted" />}
          <Select.Value placeholder={placeholder} />
        </span>
        <Icon name="expand_more" className="text-[18px] opacity-60" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className={selectContent} position="popper" sideOffset={4}>
          <Select.Viewport>
            {options.map((opt, i) => (
              <Select.Item key={opt.id ?? i} className={selectItem} value={String(opt.value)}>
                {opt.icon && <Icon name={opt.icon} className="mr-1.5 shrink-0 text-[16px] text-text-muted" />}
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
  'inline-flex h-8 items-center rounded-md border px-3 text-[13px] font-medium outline-none transition-colors focus:ring-2 focus:ring-accent/40';
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
  const [falloffCurve, setFalloffCurve] = useState(1);
  const [warpGradient, setWarpGradient] = useState({ startShade: 0, endShade: 3, direction: 0, range: [0, 100] });
  const [weftGradient, setWeftGradient] = useState({ startShade: 0, endShade: 3, direction: 0, range: [0, 100] });
  const [gradSteps, setGradSteps] = useState(0); // 0 = smooth; 2–16 = discrete bands
  const [fps, setFps] = useState(0);
  const canvasRef = useRef(null);

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

  const patternOptions = PATTERNS.map((p, i) => ({
    value: i,
    label: p.name,
    icon: WEAVE_ICONS[p.id] ?? 'texture',
  }));
  const paletteOptions = PALETTE_NAMES.map((name, i) => ({ value: i, label: name }));
  const shadeOptions = (prefix) => SHADE_NAMES.map((name, i) => ({ value: i, label: prefix ? `${prefix}: ${name}` : name }));
  const presetOptions = [
    { value: 'custom', label: 'Preset…' },
    ...PRESETS.map((p, i) => ({ value: String(i), label: p.label })),
  ];

  const falloffOptions = [
    { value: 0, label: 'Linear' },
    { value: 1, label: 'Ease' },
    { value: 2, label: 'Ease in' },
    { value: 3, label: 'Ease out' },
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
          <h1 className="shrink-0 text-[13px] font-semibold tracking-[-0.01em] text-text">Shader Sandbox</h1>
          <div className="flex items-center gap-1">
            <button type="button" className={navBtnInactive} onClick={() => setView('weaving')} aria-pressed={false} aria-label="Weaving draft">Weaving</button>
            <button type="button" className={navBtnActive} onClick={() => setView('imageRects')} aria-pressed aria-label="Image to colored rects">Image Rects</button>
          </div>
        </nav>
        <div className="min-h-0 flex-1 overflow-hidden">
          <AppV2 />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col bg-surface" style={{ height: '100dvh' }}>
      <nav className="flex min-h-9 shrink-0 items-center gap-3 border-b border-border-subtle bg-surface-elevated px-3 py-2" aria-label="App mode">
        <h1 className="shrink-0 text-[13px] font-semibold tracking-[-0.01em] text-text">Shader Sandbox</h1>
        <div className="flex items-center gap-1">
          <button type="button" className={navBtnActive} onClick={() => setView('weaving')} aria-pressed aria-label="Weaving draft">Weaving</button>
          <button type="button" className={navBtnInactive} onClick={() => setView('imageRects')} aria-pressed={false} aria-label="Image to colored rects">Image Rects</button>
        </div>
      </nav>
      <div className="flex min-h-0 flex-1 flex-row overflow-hidden bg-surface">
      <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-r border-border-subtle bg-surface px-3 py-3">
        <h1 className="shrink-0 text-[13px] font-semibold tracking-[-0.01em] text-text">
          Shader Sandbox
        </h1>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btnGhost} onClick={handleReload} aria-label="Reload">
              <Icon name="refresh" className="text-[16px]" />
              <span>Reload</span>
            </button>
            <button type="button" className={btnGhost} onClick={handleCopy2xPng} title="Copy canvas at 2× resolution as PNG" aria-label="Copy 2× PNG">
              <Icon name="content_copy" className="text-[16px]" />
              <span>Copy 2× PNG</span>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <GroupIcon name="tune" title="Preset" />
            <Select.Root
              value={presetIndex != null ? String(presetIndex) : 'custom'}
              onValueChange={(v) => (v === 'custom' ? setPresetIndex(null) : applyPreset(Number(v)))}
            >
              <Select.Trigger className={selectTrigger} title="Preset (weave + colorway + shades + grad)" aria-label="Preset">
                <Select.Value placeholder="Preset…" />
                <Icon name="expand_more" className="text-[18px] opacity-60" />
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
            <AppSelect value={pattern} onValueChange={(v) => { setPattern(v); setPresetIndex(null); }} options={patternOptions} placeholder="Pattern" />
            <AppSelect value={palette} onValueChange={(v) => { setPalette(v); setPresetIndex(null); }} options={paletteOptions} title="Colorway" placeholder="Colorway" />
          </div>
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
          <div className="flex flex-wrap items-center gap-2">
            <GroupIcon name="gradient" title="Warp gradient" />
            <Slider.Root
              id="warp-range"
              className="relative flex w-24 shrink-0 touch-none items-center"
              value={warpGradient.range}
              onValueChange={([a, b]) => { setPresetIndex(null); setWarpGradient((g) => ({ ...g, range: [a, b] })); }}
              min={0}
              max={100}
              step={5}
              aria-label="Warp gradient range"
            >
              <Slider.Track className="relative h-1.5 grow rounded-full bg-surface-input">
                <Slider.Range className="absolute h-full rounded-full bg-accent" />
              </Slider.Track>
              <Slider.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus:ring-2 focus:ring-accent/40" />
              <Slider.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus:ring-2 focus:ring-accent/40" />
            </Slider.Root>
            <AppSelect value={warpGradient.startShade} onValueChange={(s) => { setPresetIndex(null); setWarpGradient((g) => ({ ...g, startShade: s })); }} options={shadeOptions()} title="Warp start" placeholder="Start" />
            <AppSelect value={warpGradient.endShade} onValueChange={(s) => { setPresetIndex(null); setWarpGradient((g) => ({ ...g, endShade: s })); }} options={shadeOptions()} title="Warp end" placeholder="End" />
            <DirectionSwitch value={warpGradient.direction} onValueChange={(d) => { setPresetIndex(null); setWarpGradient((g) => ({ ...g, direction: d })); }} options={directionOptions} title="Warp direction" ariaLabel="Warp gradient direction" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <GroupIcon name="gradient" title="Weft gradient" />
            <Slider.Root
              id="weft-range"
              className="relative flex w-24 shrink-0 touch-none items-center"
              value={weftGradient.range}
              onValueChange={([a, b]) => { setPresetIndex(null); setWeftGradient((g) => ({ ...g, range: [a, b] })); }}
              min={0}
              max={100}
              step={5}
              aria-label="Weft gradient range"
            >
              <Slider.Track className="relative h-1.5 grow rounded-full bg-surface-input">
                <Slider.Range className="absolute h-full rounded-full bg-accent" />
              </Slider.Track>
              <Slider.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus:ring-2 focus:ring-accent/40" />
              <Slider.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus:ring-2 focus:ring-accent/40" />
            </Slider.Root>
            <AppSelect value={weftGradient.startShade} onValueChange={(s) => { setPresetIndex(null); setWeftGradient((g) => ({ ...g, startShade: s })); }} options={shadeOptions()} title="Weft start" placeholder="Start" />
            <AppSelect value={weftGradient.endShade} onValueChange={(s) => { setPresetIndex(null); setWeftGradient((g) => ({ ...g, endShade: s })); }} options={shadeOptions()} title="Weft end" placeholder="End" />
            <DirectionSwitch value={weftGradient.direction} onValueChange={(d) => { setPresetIndex(null); setWeftGradient((g) => ({ ...g, direction: d })); }} options={directionOptionsWeft} title="Weft direction" ariaLabel="Weft gradient direction" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <GroupIcon name="grid_on" title="Tile" />
            <Label.Root className="sr-only" htmlFor="grid-slider">Tile size</Label.Root>
            <Slider.Root
              id="grid-slider"
              className="relative flex w-20 shrink-0 touch-none select-none items-center"
              value={[gridSize]}
              onValueChange={([v]) => setGridSize(v)}
              min={8}
              max={64}
              step={2}
              aria-label={`Grid: ${gridSize} cells`}
            >
              <Slider.Track className="relative h-1.5 grow rounded-full bg-surface-input">
                <Slider.Range className="absolute h-full rounded-full bg-accent" />
              </Slider.Track>
              <Slider.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus:outline-none focus:ring-2 focus:ring-accent/40" />
            </Slider.Root>
            <span className="w-6 tabular-nums text-[13px] text-text">{gridSize}</span>
            <AppSelect value={falloffCurve} onValueChange={setFalloffCurve} options={falloffOptions} placeholder="Falloff" title="Warp falloff curve" />
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
            <span className="w-8 tabular-nums text-[13px] text-text" title="0 = smooth gradient">{gradSteps === 0 ? 'Smooth' : gradSteps}</span>
          </div>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
          <ShaderCanvas patternIndex={pattern} palette={palette} bgShade={bgShade} warpShade={warpShade} weftShade={weftShade} gridSize={gridSize} falloffCurve={falloffCurve} warpGradient={warpGradient} weftGradient={weftGradient} gradSteps={gradSteps} patterns={PATTERNS} onFpsChange={setFps} onCanvasRef={(el) => { canvasRef.current = el; }} />
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
        <span className={pill}>{falloffOptions[falloffCurve]?.label ?? 'Falloff'}</span>
        <span className={pill}>Steps: {gradSteps === 0 ? 'Smooth' : gradSteps}</span>
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
