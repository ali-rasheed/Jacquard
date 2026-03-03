/**
 * AppV2 — Image to colored rects. Pick an image; shader draws a grid of rounded rects
 * colored by the image (one sample per cell). Weave pattern sets rect orientation (warp/weft) per cell.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import * as Select from '@radix-ui/react-select';
import * as Slider from '@radix-ui/react-slider';
import * as Label from '@radix-ui/react-label';
import { ImageRectsCanvas } from './components/ImageRectsCanvas';
import { PATTERNS } from './patterns';

const PALETTE_NAMES = ['Citrine', 'Garnet', 'Lapis', 'Peridot'];
const SHADE_NAMES = ['950', '500', '100', '400', 'Transparent'];

const btnGhost =
  'inline-flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-transparent px-2.5 py-1 text-[13px] font-medium text-text-secondary outline-none transition-colors hover:border-border hover:bg-surface-hover hover:text-text focus:border-accent focus:outline-none';
const selectTrigger =
  'inline-flex h-7 min-w-[4rem] items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface-input px-2.5 py-1 text-[13px] text-text outline-none transition-colors hover:border-border focus:border-accent focus:ring-1 focus:ring-accent/20 data-[placeholder]:text-text-secondary';
const selectContent = 'z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border-subtle bg-surface-elevated shadow-md';
const selectItem =
  'relative flex cursor-default select-none items-center rounded py-1.5 pl-2.5 pr-8 text-[13px] outline-none data-[highlighted]:bg-surface-hover data-[highlighted]:text-text';
const pill = 'inline-flex items-center rounded-full bg-surface-elevated border border-border-subtle px-2.5 py-0.5 text-[12px] font-medium text-text-secondary';

/** Material Symbol icon (site-wide font). */
const Icon = ({ name, className = '' }) => (
  <span className={`icon inline-block shrink-0 ${className}`} aria-hidden>{name}</span>
);
/** Icon-only group header; use title for tooltip. */
const GroupIcon = ({ name, title }) => (
  <span title={title} className="shrink-0">
    <Icon name={name} className="text-[18px] text-text-muted" />
  </span>
);
/** Horizontal divider between stacked sections (e.g. sidebar). */
const SectionDividerH = () => <div className="h-px w-full shrink-0 bg-border-subtle" aria-hidden />;

function AppSelect({ value, onValueChange, options, placeholder, title }) {
  return (
    <Select.Root value={String(value)} onValueChange={onValueChange}>
      <Select.Trigger className={selectTrigger} title={title} aria-label={title ?? placeholder}>
        <Select.Value placeholder={placeholder} />
        <Icon name="expand_more" className="text-[18px] opacity-60" />
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
  const [fps, setFps] = useState(0);
  const canvasRef = useRef(null);

  /** Copy canvas at 2× resolution as PNG to clipboard (same as v1). */
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

  const patternOptions = PATTERNS.map((p, i) => ({ value: i, label: p.name }));
  const paletteOptions = PALETTE_NAMES.map((name, i) => ({ value: i, label: name }));
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
      <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-r border-border-subtle bg-surface px-3 py-3">
        <h1 className="shrink-0 text-[13px] font-semibold tracking-[-0.01em] text-text">
          Image to Colored Rects
        </h1>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <GroupIcon name="image" title="Image" />
            <label className={btnGhost + ' cursor-pointer'}>
              <Icon name="upload_file" className="text-[16px]" />
              <span>Pick image</span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileChange}
                aria-label="Pick an image file"
              />
            </label>
            <button type="button" className={btnGhost} onClick={handleCopy2xPng} title="Copy canvas at 2× resolution as PNG" aria-label="Copy 2× PNG">
              <Icon name="content_copy" className="text-[16px]" />
              <span>Copy PNG</span>
            </button>
          </div>
          <SectionDividerH />
          <div className="flex flex-wrap items-center gap-2">
            <GroupIcon name="tune" title="Weave" />
            <AppSelect
              value={colorizeMode ? 'colorize' : 'brand'}
              onValueChange={(v) => setColorizeMode(v === 'colorize')}
              options={MODE_OPTIONS}
              title="Rect color source"
              placeholder="Mode"
            />
            <AppSelect value={patternIndex} onValueChange={(v) => setPatternIndex(Number(v))} options={patternOptions} title="Weave pattern" placeholder="Weave" />
            <AppSelect value={palette} onValueChange={(v) => setPalette(Number(v))} options={paletteOptions} title="Colorway" placeholder="Colorway" />
            <AppSelect value={bgShade} onValueChange={(v) => setBgShade(Number(v))} options={shadeOptions('BG')} title="Background shade" placeholder="BG" />
            {!colorizeMode && (
              <AppSelect
                value={shadeFrom}
                onValueChange={(v) => setShadeFrom(Number(v))}
                options={SHADE_FROM_OPTIONS}
                title="Shade from (brand: color vs warp/weft)"
                placeholder="Shade from"
              />
            )}
          </div>
          <SectionDividerH />
          <div className="flex flex-wrap items-center gap-2">
            <GroupIcon name="gradient" title="Quantize" />
            <Label.Root className="sr-only" htmlFor="quantize-slider-v2">Quantize</Label.Root>
            <Slider.Root
              id="quantize-slider-v2"
              className="relative flex w-20 shrink-0 touch-none select-none items-center"
              value={[quantizeSteps]}
              onValueChange={([v]) => setQuantizeSteps(v)}
              min={0}
              max={32}
              step={1}
              aria-label={`Quantize steps: ${quantizeSteps === 0 ? 'off' : quantizeSteps}`}
            >
              <Slider.Track className="relative h-1.5 grow rounded-full bg-surface-input">
                <Slider.Range className="absolute h-full rounded-full bg-accent" />
              </Slider.Track>
              <Slider.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus:outline-none focus:ring-2 focus:ring-accent/40" />
            </Slider.Root>
            <span className="w-8 tabular-nums text-[13px] text-text">{quantizeSteps === 0 ? 'off' : quantizeSteps}</span>
          </div>
          <SectionDividerH />
          <div className="flex flex-wrap items-center gap-2">
            <GroupIcon name="grid_on" title="Tile" />
            <Label.Root className="sr-only" htmlFor="grid-slider-v2">Grid size</Label.Root>
            <Slider.Root
              id="grid-slider-v2"
              className="relative flex w-24 shrink-0 touch-none select-none items-center"
              value={[gridSize]}
              onValueChange={([v]) => setGridSize(v)}
              min={8}
              max={96}
              step={2}
              aria-label={`Grid: ${gridSize} cells`}
            >
              <Slider.Track className="relative h-1.5 grow rounded-full bg-surface-input">
                <Slider.Range className="absolute h-full rounded-full bg-accent" />
              </Slider.Track>
              <Slider.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus:outline-none focus:ring-2 focus:ring-accent/40" />
            </Slider.Root>
            <span className="w-8 tabular-nums text-[13px] text-text">{gridSize}</span>
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
          onFpsChange={setFps}
          onCanvasRef={(el) => { canvasRef.current = el; }}
        />
        </main>

        <footer className="flex min-h-9 shrink-0 flex-wrap items-center gap-2 border-t border-border-subtle bg-surface-elevated px-3 py-2">
        <span className={pill}>{imageSource ? 'Image loaded' : 'Pick an image'}</span>
        <span className={pill}>Weave: {PATTERNS[patternIndex]?.name ?? '—'}</span>
        <span className={pill}>{colorizeMode ? 'Colorization' : 'Brand'}</span>
        {!colorizeMode && (
          <span className={pill}>Shade: {SHADE_FROM_OPTIONS.find((o) => o.value === shadeFrom)?.label ?? 'Color'}</span>
        )}
        <span className={pill}>Quantize: {quantizeSteps === 0 ? 'off' : quantizeSteps}</span>
        <span className={pill}>{PALETTE_NAMES[palette]}</span>
        <span className={pill}>BG: {SHADE_NAMES[bgShade]}</span>
        <span className={pill}>Grid: {gridSize}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className={pill}>{fps || '--'} fps</span>
          <span className={pill}>WebGL 1</span>
        </div>
        </footer>
      </div>
    </div>
  );
}
