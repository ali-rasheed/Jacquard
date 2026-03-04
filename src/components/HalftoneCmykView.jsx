/**
 * Halftone CMYK view — uses @paper-design/shaders-react HalftoneCmyk.
 * Renders a CMYK halftone print effect on an image with presets and key controls
 * (size, softness, grid noise, dot type). Learn from Paper’s API: colorBack, colorC/M/Y/K,
 * flood/gain per channel, type (dots|ink|sharp), fit.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import * as Select from '@radix-ui/react-select';
import * as Label from '@radix-ui/react-label';
import { HalftoneCmyk, halftoneCmykPresets } from '@paper-design/shaders-react';
import { SliderWithInput } from './SliderWithInput';
import {
  typeLabel,
  iconLg,
  selectTrigger,
  selectContent,
  selectItem,
  sidebarGroup,
  sidebarGroupTitle,
} from '../uiConstants';

const Icon = ({ name, className = '' }) => (
  <span className={`icon inline-block shrink-0 ${className}`} aria-hidden>{name}</span>
);

const DEFAULT_IMAGE = 'https://paper.design/flowers.webp';
const TYPE_OPTIONS = [
  { value: 'dots', label: 'Dots' },
  { value: 'ink', label: 'Ink' },
  { value: 'sharp', label: 'Sharp' },
];

export default function HalftoneCmykView() {
  const [imageUrl, setImageUrl] = useState(DEFAULT_IMAGE);
  const [presetIndex, setPresetIndex] = useState(0);
  const [size, setSize] = useState(0.2);
  const [softness, setSoftness] = useState(1);
  const [gridNoise, setGridNoise] = useState(0.2);
  const [contrast, setContrast] = useState(1);
  const [type, setType] = useState('ink');
  const [colorBack, setColorBack] = useState('#fbfaf4');
  const [colorC, setColorC] = useState('#00b3ff');
  const [colorM, setColorM] = useState('#fc4f9d');
  const [colorY, setColorY] = useState('#ffd900');
  const [colorK, setColorK] = useState('#231f20');
  const [floodC, setFloodC] = useState(0.15);
  const [gainC, setGainC] = useState(0.3);
  const [gainY, setGainY] = useState(0.2);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 1280, height: 720 });

  const applyPreset = useCallback((index) => {
    const preset = halftoneCmykPresets[index];
    if (!preset?.params) return;
    const p = preset.params;
    setSize(p.size ?? 0.2);
    setSoftness(p.softness ?? 1);
    setGridNoise(p.gridNoise ?? 0.2);
    setContrast(p.contrast ?? 1);
    setType(p.type ?? 'ink');
    setColorBack(p.colorBack ?? '#fbfaf4');
    setColorC(p.colorC ?? '#00b3ff');
    setColorM(p.colorM ?? '#fc4f9d');
    setColorY(p.colorY ?? '#ffd900');
    setColorK(p.colorK ?? '#231f20');
    setFloodC(p.floodC ?? 0.15);
    setGainC(p.gainC ?? 0.3);
    setGainY(p.gainY ?? 0.2);
  }, []);

  useEffect(() => {
    applyPreset(presetIndex);
  }, [presetIndex, applyPreset]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w && h) setDimensions({ width: w, height: h });
    });
    ro.observe(el);
    setDimensions({ width: el.clientWidth || 1280, height: el.clientHeight || 720 });
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="flex h-full min-h-0 w-full">
      <aside className="flex w-[260px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-border-subtle bg-surface-elevated px-3 py-3">
        <div className={sidebarGroup}>
          <div className={sidebarGroupTitle}>Image</div>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value || DEFAULT_IMAGE)}
            placeholder={DEFAULT_IMAGE}
            className="w-full rounded border border-border-subtle bg-surface-input px-2 py-1.5 text-left text-[11px] text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent/20"
            aria-label="Image URL"
          />
        </div>
        <div className={sidebarGroup}>
          <div className={sidebarGroupTitle}>Preset</div>
          <Select.Root value={String(presetIndex)} onValueChange={(v) => setPresetIndex(Number(v))}>
            <Select.Trigger className={selectTrigger} aria-label="Preset">
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
          <div className={sidebarGroupTitle}>Dot & grid</div>
          <div className="flex flex-col gap-1">
            <Label.Root className={typeLabel} htmlFor="halftone-size">Size</Label.Root>
            <SliderWithInput id="halftone-size" aria-label="Grid size" value={size} onValueChange={setSize} min={0.01} max={1} step={0.01} format={(n) => n.toFixed(2)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label.Root className={typeLabel} htmlFor="halftone-softness">Softness</Label.Root>
            <SliderWithInput id="halftone-softness" aria-label="Dot softness" value={softness} onValueChange={setSoftness} min={0} max={1} step={0.05} format={(n) => n.toFixed(2)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label.Root className={typeLabel} htmlFor="halftone-gridnoise">Grid noise</Label.Root>
            <SliderWithInput id="halftone-gridnoise" aria-label="Grid noise" value={gridNoise} onValueChange={setGridNoise} min={0} max={1} step={0.05} format={(n) => n.toFixed(2)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label.Root className={typeLabel}>Type</Label.Root>
            <Select.Root value={type} onValueChange={setType}>
              <Select.Trigger className={selectTrigger} aria-label="Dot type">
                <Select.Value />
                <Icon name="expand_more" className={`${iconLg} opacity-60`} />
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className={selectContent} position="popper" sideOffset={4}>
                  <Select.Viewport>
                    {TYPE_OPTIONS.map((opt) => (
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
          <div className={sidebarGroupTitle}>Tone</div>
          <div className="flex flex-col gap-1">
            <Label.Root className={typeLabel} htmlFor="halftone-contrast">Contrast</Label.Root>
            <SliderWithInput id="halftone-contrast" aria-label="Contrast" value={contrast} onValueChange={setContrast} min={0} max={2} step={0.05} format={(n) => n.toFixed(2)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label.Root className={typeLabel} htmlFor="halftone-floodc">Flood C</Label.Root>
            <SliderWithInput id="halftone-floodc" aria-label="Cyan flood" value={floodC} onValueChange={setFloodC} min={0} max={1} step={0.05} format={(n) => n.toFixed(2)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label.Root className={typeLabel} htmlFor="halftone-gainc">Gain C</Label.Root>
            <SliderWithInput id="halftone-gainc" aria-label="Cyan gain" value={gainC} onValueChange={setGainC} min={-1} max={1} step={0.05} format={(n) => n.toFixed(2)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label.Root className={typeLabel} htmlFor="halftone-gainy">Gain Y</Label.Root>
            <SliderWithInput id="halftone-gainy" aria-label="Yellow gain" value={gainY} onValueChange={setGainY} min={-1} max={1} step={0.05} format={(n) => n.toFixed(2)} />
          </div>
        </div>
        <div className={sidebarGroup}>
          <div className={sidebarGroupTitle}>Ink colors</div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: 'Back', value: colorBack, set: setColorBack },
              { label: 'C', value: colorC, set: setColorC },
              { label: 'M', value: colorM, set: setColorM },
              { label: 'Y', value: colorY, set: setColorY },
              { label: 'K', value: colorK, set: setColorK },
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
      </aside>
      <div className="relative min-h-0 flex-1 bg-[#1a1a1a]">
        <HalftoneCmyk
          width={dimensions.width}
          height={dimensions.height}
          image={imageUrl}
          colorBack={colorBack}
          colorC={colorC}
          colorM={colorM}
          colorY={colorY}
          colorK={colorK}
          size={size}
          gridNoise={gridNoise}
          type={type}
          softness={softness}
          contrast={contrast}
          floodC={floodC}
          floodM={0}
          floodY={0}
          floodK={0}
          gainC={gainC}
          gainM={0}
          gainY={gainY}
          gainK={0}
          grainMixer={0}
          grainOverlay={0}
          grainSize={0.5}
          fit="cover"
        />
      </div>
    </div>
  );
}
