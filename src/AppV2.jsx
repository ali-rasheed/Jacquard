/**
 * AppV2 — Image to colored rects. Pick an image; shader draws a grid of rounded rects
 * colored by the image (one sample per cell). Background uses same palette/bgShade as original.
 */
import { useState, useCallback, useEffect } from 'react';
import * as Select from '@radix-ui/react-select';
import * as Slider from '@radix-ui/react-slider';
import * as Label from '@radix-ui/react-label';
import { ImageRectsCanvas } from './components/ImageRectsCanvas';

const PALETTE_NAMES = ['Citrine', 'Garnet', 'Lapis', 'Peridot'];
const SHADE_NAMES = ['950', '500', '100', '400'];

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

const MODE_OPTIONS = [
  { value: 'colorize', label: 'Colorization' },
  { value: 'brand', label: 'Brand colors' },
];

export default function AppV2() {
  const [imageSource, setImageSource] = useState('');
  const [gridSize, setGridSize] = useState(32);
  const [palette, setPalette] = useState(0);
  const [bgShade, setBgShade] = useState(2);
  const [colorizeMode, setColorizeMode] = useState(true); // true = colorization, false = brand
  const [quantizeSteps, setQuantizeSteps] = useState(0);  // 0 = off, 2–32 = steps
  const [rectShade, setRectShade] = useState(1);          // palette shade when brand mode
  const [fps, setFps] = useState(0);

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
    <div className="flex min-h-0 flex-col overflow-hidden bg-surface" style={{ height: '100dvh' }}>
      <header className="flex min-h-9 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-surface px-3 py-2">
        <h1 className="min-w-0 truncate text-[13px] font-semibold tracking-[-0.01em] text-text">
          Image to Colored Rects
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className={btnGhost + ' cursor-pointer'}>
            <span>Pick image</span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFileChange}
              aria-label="Pick an image file"
            />
          </label>
          <AppSelect
            value={colorizeMode ? 'colorize' : 'brand'}
            onValueChange={(v) => setColorizeMode(v === 'colorize')}
            options={MODE_OPTIONS}
            title="Rect color source"
            placeholder="Mode"
          />
          <AppSelect value={palette} onValueChange={setPalette} options={paletteOptions} title="Colorway" placeholder="Colorway" />
          <AppSelect value={bgShade} onValueChange={setBgShade} options={shadeOptions('BG')} title="Background shade" placeholder="BG" />
          {!colorizeMode && (
            <AppSelect value={rectShade} onValueChange={setRectShade} options={shadeOptions('Rect')} title="Rect shade (brand)" placeholder="Rect" />
          )}
          <div className="flex items-center gap-2">
            <Label.Root className="text-[13px] text-text-secondary shrink-0" htmlFor="quantize-slider-v2">
              Quantize
            </Label.Root>
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
          <div className="flex items-center gap-2">
            <Label.Root className="text-[13px] text-text-secondary shrink-0" htmlFor="grid-slider-v2">
              Grid size
            </Label.Root>
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
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        <ImageRectsCanvas
          imageSource={imageSource}
          gridSize={gridSize}
          palette={palette}
          bgShade={bgShade}
          colorizeMode={colorizeMode}
          quantizeSteps={quantizeSteps}
          rectShade={rectShade}
          onFpsChange={setFps}
        />
      </main>

      <footer className="flex min-h-9 shrink-0 flex-wrap items-center gap-2 border-t border-border-subtle bg-surface-elevated px-3 py-2">
        <span className={pill}>{imageSource ? 'Image loaded' : 'Pick an image'}</span>
        <span className={pill}>{colorizeMode ? 'Colorization' : 'Brand'}</span>
        {!colorizeMode && <span className={pill}>Rect: {SHADE_NAMES[rectShade]}</span>}
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
  );
}
