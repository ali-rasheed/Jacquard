/**
 * Shader Sandbox — ENS Weaving Draft.
 * WebGL canvas reads shaders from src/shaders/*.glsl. Controls: Radix Select + Slider.
 */
import { useState, useCallback } from 'react';
import * as Select from '@radix-ui/react-select';
import * as Slider from '@radix-ui/react-slider';
import * as Label from '@radix-ui/react-label';
import { ShaderCanvas } from './components/ShaderCanvas';
import { PATTERNS } from './patterns';

const PALETTE_NAMES = ['Citrine', 'Garnet', 'Lapis', 'Peridot'];
const SHADE_NAMES = ['950', '500', '100', '400'];

/** Flat = same start/end shade so the gradient is a solid. */
const flatGrad = (shade) => ({ startShade: shade, endShade: shade, direction: 0, range: [0, 100] });
/** Two-stop gradient config. */
const grad = (wStart, wEnd, wfStart, wfEnd, wDir = 0, wfDir = 0) => ({
  warpGradient: { startShade: wStart, endShade: wEnd, direction: wDir, range: [0, 100] },
  weftGradient: { startShade: wfStart, endShade: wfEnd, direction: wfDir, range: [0, 100] },
});

/**
 * Presets: weave + colorway + shades + grad/no-grad. Selecting one applies all state.
 */
const PRESETS = [
  { id: 'citrine-plain-flat', label: 'Citrine · Plain · Flat', pattern: 0, palette: 0, bgShade: 2, warpShade: 1, weftShade: 3, warpGradient: flatGrad(1), weftGradient: flatGrad(3) },
  { id: 'garnet-twill-flat', label: 'Garnet · 2/2 Twill · Flat', pattern: 6, palette: 1, bgShade: 2, warpShade: 0, weftShade: 3, warpGradient: flatGrad(0), weftGradient: flatGrad(3) },
  { id: 'lapis-satin-flat', label: 'Lapis · Satin · Flat', pattern: 4, palette: 2, bgShade: 0, warpShade: 1, weftShade: 2, warpGradient: flatGrad(1), weftGradient: flatGrad(2) },
  { id: 'peridot-houndstooth-flat', label: 'Peridot · Houndstooth · Flat', pattern: 11, palette: 3, bgShade: 2, warpShade: 0, weftShade: 1, warpGradient: flatGrad(0), weftGradient: flatGrad(1) },
  { id: 'citrine-plain-grad', label: 'Citrine · Plain · Grad', pattern: 0, palette: 0, bgShade: 2, warpShade: 1, weftShade: 3, ...grad(0, 3, 1, 2) },
  { id: 'garnet-twill-grad', label: 'Garnet · 2/2 Twill · Grad', pattern: 6, palette: 1, bgShade: 2, warpShade: 0, weftShade: 3, ...grad(0, 3, 1, 2) },
  { id: 'lapis-satin-grad', label: 'Lapis · Satin · Grad', pattern: 4, palette: 2, bgShade: 0, warpShade: 1, weftShade: 2, ...grad(0, 2, 2, 3, 1, 1) },
  { id: 'peridot-houndstooth-grad', label: 'Peridot · Houndstooth · Grad', pattern: 11, palette: 3, bgShade: 2, warpShade: 0, weftShade: 1, ...grad(0, 3, 1, 3, 0, 1) },
];

const btnGhost =
  'inline-flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-transparent px-2.5 py-1 text-[13px] font-medium text-text-secondary outline-none transition-colors hover:border-border hover:bg-surface-hover hover:text-text focus:border-accent focus:outline-none';
const selectTrigger =
  'inline-flex h-7 min-w-[4rem] items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface-input px-2.5 py-1 text-[13px] text-text outline-none transition-colors hover:border-border focus:border-accent focus:ring-1 focus:ring-accent/20 data-[placeholder]:text-text-secondary';
const selectContent = 'z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border-subtle bg-surface-elevated shadow-md';
const selectItem =
  'relative flex cursor-default select-none items-center rounded py-1.5 pl-2.5 pr-8 text-[13px] outline-none data-[highlighted]:bg-surface-hover data-[highlighted]:text-text';
const pill = 'inline-flex items-center rounded-full bg-surface-elevated border border-border-subtle px-2.5 py-0.5 text-[12px] font-medium text-text-secondary';

function AppSelect({ value, onValueChange, options, placeholder, title }) {
  return (
    <Select.Root value={String(value)} onValueChange={(v) => onValueChange(Number(v))}>
      <Select.Trigger className={selectTrigger} title={title} aria-label={title ?? placeholder}>
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="opacity-60" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className={selectContent} position="popper" sideOffset={4}>
          <Select.Viewport>
            {options.map((opt, i) => (
              <Select.Item key={opt.id ?? i} className={selectItem} value={String(opt.value)}>
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

export default function App() {
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
  const [fps, setFps] = useState(0);

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

  const patternOptions = PATTERNS.map((p, i) => ({ value: i, label: p.name }));
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
    { value: 0, label: '↓' },
    { value: 1, label: '↑' },
  ];
  const directionOptionsWeft = [
    { value: 0, label: '→' },
    { value: 1, label: '←' },
  ];

  return (

    <div className="flex min-h-0 flex-col overflow-hidden bg-surface" style={{ height: '100dvh' }}>
      <header className="flex min-h-9 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-surface px-3 py-2">
        <h1 className="min-w-0 truncate text-[13px] font-semibold tracking-[-0.01em] text-text">
          Shader Sandbox
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btnGhost} onClick={handleReload}>
            Reload
          </button>
          <span className="h-4 w-px bg-border" aria-hidden />
          <Select.Root
            value={presetIndex != null ? String(presetIndex) : 'custom'}
            onValueChange={(v) => (v === 'custom' ? setPresetIndex(null) : applyPreset(Number(v)))}
          >
            <Select.Trigger className={selectTrigger} title="Preset (weave + colorway + shades + grad)" aria-label="Preset">
              <Select.Value placeholder="Preset…" />
              <Select.Icon className="opacity-60" />
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
          <AppSelect value={bgShade} onValueChange={(v) => { setBgShade(v); setPresetIndex(null); }} options={shadeOptions('BG')} title="Background shade" placeholder="BG" />
          <AppSelect value={warpShade} onValueChange={(v) => { setWarpShade(v); setPresetIndex(null); }} options={shadeOptions('Warp')} title="Warp shade" placeholder="Warp" />
          <AppSelect value={weftShade} onValueChange={(v) => { setWeftShade(v); setPresetIndex(null); }} options={shadeOptions('Weft')} title="Weft shade" placeholder="Weft" />
          <div className="flex items-center gap-1.5">
            <Label.Root className="text-[13px] text-text-secondary shrink-0" htmlFor="warp-range">Warp</Label.Root>
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
            <AppSelect value={warpGradient.direction} onValueChange={(d) => { setPresetIndex(null); setWarpGradient((g) => ({ ...g, direction: Number(d) })); }} options={directionOptions} title="Warp direction" placeholder="Dir" />
          </div>
          <div className="flex items-center gap-1.5">
            <Label.Root className="text-[13px] text-text-secondary shrink-0" htmlFor="weft-range">Weft</Label.Root>
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
            <AppSelect value={weftGradient.direction} onValueChange={(d) => { setPresetIndex(null); setWeftGradient((g) => ({ ...g, direction: Number(d) })); }} options={directionOptionsWeft} title="Weft direction" placeholder="Dir" />
          </div>
          <div className="flex items-center gap-2">
            <Label.Root className="text-[13px] text-text-secondary shrink-0" htmlFor="grid-slider">
              Tile size
            </Label.Root>
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
          </div>
          <AppSelect value={falloffCurve} onValueChange={setFalloffCurve} options={falloffOptions} placeholder="Falloff" title="Warp falloff curve" />
        </div>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        <ShaderCanvas patternIndex={pattern} palette={palette} bgShade={bgShade} warpShade={warpShade} weftShade={weftShade} gridSize={gridSize} falloffCurve={falloffCurve} warpGradient={warpGradient} weftGradient={weftGradient} patterns={PATTERNS} onFpsChange={setFps} />
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
        <div className="ml-auto flex items-center gap-2">
          <span className={pill}>{fps || '--'} fps</span>
          <span className={pill}>WebGL 1</span>
        </div>
      </footer>
    </div>
  );
}
