/**
 * Design system gallery — live specimens for tokens in `uiConstants.js` and wrappers in `components/ui/`.
 * Edit those sources and refresh this page to preview sweeping UI changes without loading the shader shell.
 */
import { useState } from 'react';
import {
  PALETTE_SWATCH_COLORS,
  PALETTE_NAMES,
  btnGhost,
  typeXs,
  typeSm,
  typeBase,
  typeInput,
  typeLabel,
  typeControl,
  typeValue,
  typeCaption,
  typeFps,
  pill,
  navBtnActive,
  navBtnInactive,
  menuToggle,
  menuToggleActive,
  menuToggleInactive,
  toggleBtn,
  toggleBtnActive,
  toggleBtnIcon,
  paletteSwatch,
  paletteSwatchSelected,
  paletteSwatchUnselected,
  paletteSwatchSm,
  inputText,
  fpsPill,
  sidebarGroupTitle,
} from '../uiConstants';
import {
  AppSelect,
  AppTooltip,
  DirectionSwitch,
  GroupIcon,
  Icon,
  IconButton,
  SegmentedControl,
  SegmentedControlButton,
} from '../components/ui';
import { ThemeToggle } from '../components/ThemeToggle';
import { SliderWithInput } from '../components/SliderWithInput';
import { DsSection, DsRow } from './DsSection';

const NAV = [
  { id: 'tokens', label: 'Tokens' },
  { id: 'type', label: 'Typography' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'icons', label: 'Icons' },
  { id: 'select', label: 'Select' },
  { id: 'slider', label: 'Slider' },
  { id: 'segmented', label: 'Segmented' },
  { id: 'direction', label: 'Direction' },
  { id: 'group-icon', label: 'Group icon' },
  { id: 'sidebar', label: 'Sidebar' },
  { id: 'inputs', label: 'Inputs' },
  { id: 'tooltip', label: 'Tooltip' },
];

const SELECT_OPTS = [
  { value: '0', label: 'Citrine', icon: 'palette' },
  { value: '1', label: 'Garnet', icon: 'palette' },
  { value: '2', label: 'Lapis', icon: 'palette' },
];

const TOKEN_SWATCHES = [
  { name: 'surface', className: 'bg-surface' },
  { name: 'surface-elevated', className: 'bg-surface-elevated' },
  { name: 'surface-input', className: 'bg-surface-input' },
  { name: 'accent', className: 'bg-accent' },
  { name: 'border', className: 'border border-border bg-transparent' },
  { name: 'error', className: 'bg-error' },
];

export default function DesignSystemPage() {
  const [selectVal, setSelectVal] = useState('1');
  const [sliderVal, setSliderVal] = useState(0.42);
  const [rangeVal, setRangeVal] = useState([0.2, 0.8]);
  const [segScale, setSegScale] = useState('2');
  const [segFmt, setSegFmt] = useState('png');
  const [dir, setDir] = useState(0);
  const [toggleOn, setToggleOn] = useState(true);
  const [paletteIdx, setPaletteIdx] = useState(2);
  const [navTab, setNavTab] = useState('weave');
  const [menuOpen, setMenuOpen] = useState(true);

  return (
    <div className="flex h-[100dvh] flex-col bg-surface text-text">
      <header className="flex shrink-0 items-center gap-3 border-b border-border-subtle px-4 py-2.5">
        <h1 className={`${typeBase} font-semibold text-text`}>Design system</h1>
        <span className={typeCaption}>uiConstants.js · components/ui</span>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <a href="./index.html" className={btnGhost}>
            <Icon name="arrow_back" className="text-[14px]" />
            App
          </a>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav
          className="w-40 shrink-0 overflow-y-auto border-r border-border-subtle bg-surface-secondary px-2 py-3"
          aria-label="Design system sections"
        >
          <p className={`${sidebarGroupTitle} mb-2 px-2`}>Sections</p>
          <ul className="flex flex-col gap-0.5">
            {NAV.map(({ id, label }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className={`block rounded-md px-2 py-1.5 ${typeControl} text-text-secondary transition-colors hover:bg-surface-hover hover:text-text`}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-10">
            <p className={typeCaption}>
              Change shared classes in <code className="text-text">src/uiConstants.js</code> or components in{' '}
              <code className="text-text">src/components/ui/</code>, then reload this page. The main app imports the same modules.
            </p>

            <DsSection
              id="tokens"
              title="Color tokens"
              description="Semantic Tailwind tokens from index.css @theme — used as bg-surface, text-text-muted, etc."
            >
              <div className="flex flex-wrap gap-3">
                {TOKEN_SWATCHES.map(({ name, className }) => (
                  <div key={name} className="flex flex-col items-center gap-1">
                    <div className={`h-10 w-16 rounded-md ${className}`} />
                    <span className={typeXs}>{name}</span>
                  </div>
                ))}
              </div>
              <DsRow label="ENS palette">
                {PALETTE_SWATCH_COLORS.map((color, i) => (
                  <div key={PALETTE_NAMES[i]} className="flex flex-col items-center gap-0.5">
                    <div className="h-7 w-7 rounded-md border border-border-subtle" style={{ backgroundColor: color }} />
                    <span className={typeXs}>{PALETTE_NAMES[i]}</span>
                  </div>
                ))}
              </DsRow>
            </DsSection>

            <DsSection id="type" title="Typography" description="Type scale from uiConstants — compact controls for dense sidebars.">
              <p className={typeXs}>typeXs — 10px labels</p>
              <p className={typeSm}>typeSm — 11px dropdown items</p>
              <p className={typeBase}>typeBase — 11px body / nav</p>
              <p className={typeInput}>typeInput — number inputs</p>
              <p className={typeLabel}>typeLabel — section caps</p>
              <p className={typeControl}>typeControl — control labels</p>
              <p className={typeValue}>typeValue — 1.234 tabular values</p>
              <p className={typeCaption}>typeCaption — secondary hints</p>
              <p className={typeFps}>typeFps — FPS overlay</p>
              <span className={pill}>pill</span>
            </DsSection>

            <DsSection id="buttons" title="Buttons & nav">
              <DsRow label="btnGhost">
                <button type="button" className={btnGhost}>
                  <Icon name="content_copy" className="text-[14px]" />
                  Ghost
                </button>
              </DsRow>
              <DsRow label="Nav tabs">
                <button type="button" className={navTab === 'weave' ? navBtnActive : navBtnInactive} onClick={() => setNavTab('weave')}>
                  Weave
                </button>
                <button type="button" className={navTab === 'mosaic' ? navBtnActive : navBtnInactive} onClick={() => setNavTab('mosaic')}>
                  Mosaic
                </button>
              </DsRow>
              <DsRow label="Menu toggle">
                <button
                  type="button"
                  className={`${menuToggle} ${menuOpen ? menuToggleActive : menuToggleInactive}`}
                  onClick={() => setMenuOpen((o) => !o)}
                >
                  <Icon name="menu" className="text-[14px]" />
                  Sidebar
                </button>
              </DsRow>
              <DsRow label="Toggle pair">
                <button type="button" className={toggleOn ? toggleBtnActive : toggleBtn} onClick={() => setToggleOn(true)}>
                  On
                </button>
                <button type="button" className={!toggleOn ? toggleBtnActive : toggleBtn} onClick={() => setToggleOn(false)}>
                  Off
                </button>
                <button type="button" className={toggleBtnIcon} aria-label="Icon toggle">
                  <Icon name="auto_awesome" className="text-[14px]" />
                </button>
              </DsRow>
              <DsRow label="IconButton">
                <IconButton size="sm" aria-label="Small">
                  <Icon name="play_arrow" className="text-[14px]" />
                </IconButton>
                <IconButton size="md" aria-label="Medium">
                  <Icon name="download" className="text-[16px]" />
                </IconButton>
                <IconButton size="resetSm" aria-label="Reset sm">
                  <Icon name="restart_alt" className="text-[12px]" />
                </IconButton>
                <IconButton size="resetMd" aria-label="Reset md">
                  <Icon name="restart_alt" className="text-[13.5px]" />
                </IconButton>
                <IconButton size="sm" variant="danger" aria-label="Record">
                  <Icon name="fiber_manual_record" className="text-[14px]" />
                </IconButton>
              </DsRow>
            </DsSection>

            <DsSection id="icons" title="Icon scale" description="Material Symbols Outlined via Icon.jsx.">
              <DsRow label="Sizes">
                {['text-[8px]', 'text-[10px]', 'text-[14px]', 'text-[16px]', 'text-[18px]'].map((cls) => (
                  <Icon key={cls} name="grid_on" className={cls} />
                ))}
              </DsRow>
            </DsSection>

            <DsSection id="select" title="AppSelect" description="Radix select + optional reset + tooltip on title.">
              <AppSelect
                id="ds-select"
                labelText="Palette"
                value={selectVal}
                onValueChange={setSelectVal}
                options={SELECT_OPTS}
                defaultValue="0"
                onReset={() => setSelectVal('0')}
                title="Example select with reset"
                placeholder="Pick…"
              />
            </DsSection>

            <DsSection id="slider" title="SliderWithInput" description="Radix slider + synced number field + snap ticks.">
              <DsRow label="Single">
                <SliderWithInput
                  aria-label="Opacity"
                  value={sliderVal}
                  onValueChange={setSliderVal}
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={0.5}
                  onReset={() => setSliderVal(0.5)}
                  format={(n) => n.toFixed(2)}
                />
              </DsRow>
              <DsRow label="Range">
                <SliderWithInput
                  aria-label="Range"
                  value={rangeVal}
                  onValueChange={setRangeVal}
                  min={0}
                  max={1}
                  step={0.01}
                />
              </DsRow>
              <DsRow label="Snaps">
                <SliderWithInput
                  aria-label="Grid"
                  value={0.25}
                  onValueChange={() => {}}
                  snapValues={[0, 0.25, 0.5, 0.75, 1]}
                  min={0}
                  max={1}
                  step={1}
                />
              </DsRow>
            </DsSection>

            <DsSection id="segmented" title="SegmentedControl" description="Copy/export scale and format toggles.">
              <DsRow label="Scale">
                <SegmentedControl>
                  {['1', '2', '4'].map((s) => (
                    <SegmentedControlButton key={s} active={segScale === s} onClick={() => setSegScale(s)}>
                      {s}×
                    </SegmentedControlButton>
                  ))}
                </SegmentedControl>
              </DsRow>
              <DsRow label="Format">
                <SegmentedControl>
                  {['png', 'webp'].map((f) => (
                    <SegmentedControlButton key={f} format active={segFmt === f} onClick={() => setSegFmt(f)}>
                      {f}
                    </SegmentedControlButton>
                  ))}
                </SegmentedControl>
              </DsRow>
            </DsSection>

            <DsSection id="direction" title="DirectionSwitch">
              <DirectionSwitch
                value={dir}
                onValueChange={setDir}
                defaultValue={0}
                onReset={() => setDir(0)}
                title="Gradient direction"
                options={[
                  { value: 0, icon: 'arrow_forward' },
                  { value: 1, icon: 'arrow_downward' },
                ]}
              />
            </DsSection>

            <DsSection id="group-icon" title="GroupIcon" description="Section icons with optional lock + shared tooltip hit area.">
              <DsRow label="Plain">
                <GroupIcon name="texture" title="Weave" />
              </DsRow>
              <DsRow label="Tooltip">
                <GroupIcon name="gradient" tooltip="Gradient controls" />
              </DsRow>
              <DsRow label="Lockable">
                <GroupIcon name="lock" tooltip="Lock demo" locked={false} onLockChange={() => {}} />
              </DsRow>
            </DsSection>

            <DsSection id="sidebar" title="Sidebar patterns">
              <DsRow label="Palette swatch">
                {PALETTE_SWATCH_COLORS.map((color, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`${paletteSwatch} ${paletteIdx === i ? paletteSwatchSelected : paletteSwatchUnselected}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setPaletteIdx(i)}
                    aria-label={PALETTE_NAMES[i]}
                  />
                ))}
                <button
                  type="button"
                  className={`${paletteSwatchSm} ${paletteSwatchUnselected}`}
                  style={{ backgroundColor: PALETTE_SWATCH_COLORS[0] }}
                  aria-label="Small swatch"
                />
              </DsRow>
              <div className="relative h-24 rounded-lg border border-border-subtle bg-surface-input">
                <span className={fpsPill}>60 fps</span>
              </div>
            </DsSection>

            <DsSection id="inputs" title="Text inputs">
              <input type="text" className={inputText} placeholder="inputText — image URL, etc." defaultValue="https://example.com/image.png" />
            </DsSection>

            <DsSection id="tooltip" title="AppTooltip" description="150ms delay via AppTooltipProvider (same as main app).">
              <AppTooltip content="Hover the trigger or this label row">
                <button type="button" className={btnGhost}>
                  Hover me
                </button>
              </AppTooltip>
            </DsSection>
          </div>
        </main>
      </div>
    </div>
  );
}
