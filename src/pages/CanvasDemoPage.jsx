/**
 * CanvasDemoPage — Weave canvas feature gallery (one live preview at a time).
 * Specimen list + single ShaderCanvas / WeavingHalftoneStage avoids WebGL context limits.
 */
import { useEffect, useMemo, useState } from 'react';
import { PRESETS } from '../constants';
import { ShaderCanvas } from '../components/ShaderCanvas';
import { WeavingHalftoneStage } from '../components/WeavingHalftoneStage';
import { ThemeToggle } from '../components/ThemeToggle';
import { Icon, SegmentedControl, SegmentedControlButton } from '../components/ui';
import { PATTERNS } from '../patterns';
import { HALFTONE_DEFAULTS, WEAVING_URL_DEFAULTS } from '../urlDefaults';
import { btnGhost, sidebarGroupTitle, toggleBtn, toggleBtnActive, typeBase, typeCaption, typeLabel } from '../uiConstants';

const SHIMMER_PRESET = PRESETS.find((p) => p.id === 'lapis-houndstooth-shimmer');

const HALFTONE_PROPS = {
  size: HALFTONE_DEFAULTS.size,
  softness: HALFTONE_DEFAULTS.softness,
  gridNoise: HALFTONE_DEFAULTS.gridNoise,
  contrast: HALFTONE_DEFAULTS.contrast,
  type: HALFTONE_DEFAULTS.type,
  colorBack: HALFTONE_DEFAULTS.colorBack,
  colorC: HALFTONE_DEFAULTS.colorC,
  colorM: HALFTONE_DEFAULTS.colorM,
  colorY: HALFTONE_DEFAULTS.colorY,
  colorK: HALFTONE_DEFAULTS.colorK,
  floodC: HALFTONE_DEFAULTS.floodC,
  gainC: HALFTONE_DEFAULTS.gainC,
  gainY: HALFTONE_DEFAULTS.gainY,
};

function flatGrad(shade) {
  return { startShade: shade, endShade: shade, direction: 0, range: [0, 100] };
}

function weaveGrad(wStart, wEnd, wfStart, wfEnd, wDir = 0, wfDir = 0) {
  return {
    warpGradient: { startShade: wStart, endShade: wEnd, direction: wDir, range: [0, 100] },
    weftGradient: { startShade: wfStart, endShade: wfEnd, direction: wfDir, range: [0, 100] },
  };
}

function shimmerPresetProps() {
  if (!SHIMMER_PRESET) return { shimmer: true, patternIndex: 11, palette: 2 };
  return {
    patternIndex: SHIMMER_PRESET.pattern,
    palette: SHIMMER_PRESET.palette,
    bgShade: SHIMMER_PRESET.bgShade,
    warpShade: SHIMMER_PRESET.warpShade,
    weftShade: SHIMMER_PRESET.weftShade,
    warpGradient: SHIMMER_PRESET.warpGradient,
    weftGradient: SHIMMER_PRESET.weftGradient,
    gridSize: SHIMMER_PRESET.gridSize,
    gradSteps: SHIMMER_PRESET.gradSteps,
    rectAspect: SHIMMER_PRESET.rectAspect,
    cornerRadius: SHIMMER_PRESET.cornerRadius,
    canvasAspect: SHIMMER_PRESET.canvasAspect,
    useAllColorways: SHIMMER_PRESET.useAllColorways,
    colorwaySeed: SHIMMER_PRESET.colorwaySeed,
    shimmer: true,
    shimmerSpeed: SHIMMER_PRESET.shimmerSpeed,
    shimmerWidth: SHIMMER_PRESET.shimmerWidth,
    shimmerIntensity: SHIMMER_PRESET.shimmerIntensity,
    shimmerPosition: SHIMMER_PRESET.shimmerPosition,
    shimmerRotation: SHIMMER_PRESET.shimmerRotation,
    shimmerNoise: SHIMMER_PRESET.shimmerNoise,
    shimmerNoiseSeed: SHIMMER_PRESET.shimmerNoiseSeed,
    shimmerNoiseMin: SHIMMER_PRESET.shimmerNoiseMin,
    shimmerNoiseMax: SHIMMER_PRESET.shimmerNoiseMax,
    shimmerBlendMode: SHIMMER_PRESET.shimmerBlendMode,
  };
}

/** @typedef {{ id: string, label: string, halftone?: boolean, props?: Record<string, unknown> }} DemoSpec */

/** @type {{ id: string, title: string, specs: DemoSpec[] }[]} */
const DEMO_SECTIONS = [
  {
    id: 'weave',
    title: 'Weave (no halftone)',
    specs: [
      {
        id: 'weave',
        label: 'Weave draft · 2/2 twill',
        props: {
          patternIndex: 6,
          palette: 1,
          useAllColorways: false,
          warpGradientEnabled: false,
          weftGradientEnabled: false,
          warpGradient: flatGrad(0),
          weftGradient: flatGrad(3),
        },
      },
      {
        id: 'gradient',
        label: 'Warp / weft gradient',
        props: {
          patternIndex: 0,
          palette: 0,
          useAllColorways: false,
          warpGradientEnabled: true,
          weftGradientEnabled: true,
          ...weaveGrad(0, 3, 1, 2),
        },
      },
      { id: 'shimmer', label: 'Shimmer', props: shimmerPresetProps() },
      {
        id: 'colorways-5',
        label: 'All 5 colorways',
        props: {
          patternIndex: 11,
          palette: 0,
          useAllColorways: true,
          colorwayIncludeMask: 31,
          colorwaySeed: 42,
        },
      },
      {
        id: 'colorways-2',
        label: '2 colorways (Citrine + Garnet)',
        props: {
          patternIndex: 11,
          palette: 0,
          useAllColorways: true,
          colorwayIncludeMask: 3,
          colorwaySeed: 42,
        },
      },
      {
        id: 'res-low',
        label: 'Low resolution · grid 16',
        props: { patternIndex: 0, gridSize: 16, useAllColorways: false },
      },
      {
        id: 'res-high',
        label: 'High resolution · grid 128',
        props: { patternIndex: 0, gridSize: 128, useAllColorways: false },
      },
    ],
  },
  {
    id: 'halftone',
    title: 'Halftone print',
    specs: [
      {
        id: 'halftone',
        label: 'Weave + CMYK halftone',
        halftone: true,
        props: {
          patternIndex: 6,
          palette: 1,
          useAllColorways: false,
          warpGradientEnabled: false,
          weftGradientEnabled: false,
          warpGradient: flatGrad(0),
          weftGradient: flatGrad(3),
        },
      },
      {
        id: 'halftone-shimmer',
        label: 'Shimmer + halftone',
        halftone: true,
        props: shimmerPresetProps(),
      },
    ],
  },
];

function buildWeaveProps(overrides = {}) {
  const d = WEAVING_URL_DEFAULTS;
  return {
    patterns: PATTERNS,
    patternIndex: d.pattern,
    palette: d.palette,
    bgShade: d.bgShade,
    warpShade: d.warpShade,
    weftShade: d.weftShade,
    gridSize: d.gridSize,
    warpGradient: d.warpGradient,
    weftGradient: d.weftGradient,
    warpGradientEnabled: d.warpGradientEnabled,
    weftGradientEnabled: d.weftGradientEnabled,
    gradSteps: d.gradSteps,
    rectAspect: d.rectAspect,
    cornerRadius: d.cornerRadius,
    canvasAspect: d.canvasAspect,
    patternFit: d.patternFit,
    shimmer: d.shimmer,
    shimmerSpeed: d.shimmerSpeed,
    shimmerWidth: d.shimmerWidth,
    shimmerIntensity: d.shimmerIntensity,
    shimmerPosition: d.shimmerPosition,
    shimmerRotation: d.shimmerRotation,
    shimmerNoise: d.shimmerNoise,
    shimmerNoiseSeed: d.shimmerNoiseSeed,
    shimmerNoiseMin: d.shimmerNoiseMin,
    shimmerNoiseMax: d.shimmerNoiseMax,
    shimmerBlendMode: d.shimmerBlendMode,
    shimmerPlaying: true,
    useAllColorways: d.useAllColorways,
    colorwaySeed: d.colorwaySeed,
    colorwayNoiseScale: d.colorwayNoiseScale,
    colorwayNoiseMode: d.colorwayNoiseMode,
    colorwayNoiseOctaves: d.colorwayNoiseOctaves,
    colorwayNoisePersistence: d.colorwayNoisePersistence,
    colorwayNoiseLacunarity: d.colorwayNoiseLacunarity,
    colorwayNoiseBias: d.colorwayNoiseBias,
    colorwayNoiseX: d.colorwayNoiseX,
    colorwayBleedAnisotropy: d.colorwayBleedAnisotropy,
    colorwayBleedRotation: d.colorwayBleedRotation,
    colorwayBleedCrossFiber: d.colorwayBleedCrossFiber,
    colorwayBleedDraftCoupled: d.colorwayBleedDraftCoupled,
    colorwayIncludeMask: d.colorwayIncludeMask,
    weaveEnsMarkVisible: false,
    ...overrides,
  };
}

export default function CanvasDemoPage() {
  const [activeSectionId, setActiveSectionId] = useState(DEMO_SECTIONS[0].id);
  const [activeSpecId, setActiveSpecId] = useState(DEMO_SECTIONS[0].specs[0].id);

  const sections = useMemo(
    () =>
      DEMO_SECTIONS.map((section) => ({
        ...section,
        specs: section.specs.map((spec) => ({
          ...spec,
          weaveProps: buildWeaveProps(spec.props),
        })),
      })),
    [],
  );

  const activeSection = sections.find((s) => s.id === activeSectionId) ?? sections[0];
  const activeSpec = activeSection.specs.find((s) => s.id === activeSpecId) ?? activeSection.specs[0];

  useEffect(() => {
    if (!activeSection.specs.some((s) => s.id === activeSpecId)) {
      setActiveSpecId(activeSection.specs[0].id);
    }
  }, [activeSection, activeSpecId]);

  return (
    <div className="flex h-[100dvh] flex-col bg-surface text-text">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border-subtle px-4 py-2.5">
        <h1 className={`${typeBase} font-semibold text-text`}>Canvas demo</h1>
        <span className={typeCaption}>Weave · gradient · shimmer · colorways · resolution · halftone</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ThemeToggle />
          <a href="./index.html" className={btnGhost}>
            <Icon name="arrow_back" className="text-[14px]" />
            App
          </a>
          <a href="./design-system.html" className={btnGhost}>
            Design system
          </a>
        </div>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border-subtle px-4 py-2">
        <span className={typeLabel}>Output</span>
        <SegmentedControl>
          <div className="flex h-full">
            {sections.map((section) => (
              <SegmentedControlButton
                key={section.id}
                active={section.id === activeSectionId}
                aria-pressed={section.id === activeSectionId}
                onClick={() => {
                  setActiveSectionId(section.id);
                  setActiveSpecId(section.specs[0].id);
                }}
              >
                {section.title}
              </SegmentedControlButton>
            ))}
          </div>
        </SegmentedControl>
        <span className={`${typeCaption} text-text-muted`}>One live preview — pick a specimen from the list.</span>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-72 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border-subtle bg-surface-elevated px-2 py-3">
          <div className={`${sidebarGroupTitle} px-1`}>Specimens</div>
          {activeSection.specs.map((spec) => (
            <button
              key={spec.id}
              type="button"
              className={`${toggleBtn} w-full justify-start text-left ${spec.id === activeSpecId ? toggleBtnActive : ''}`}
              aria-pressed={spec.id === activeSpecId}
              onClick={() => setActiveSpecId(spec.id)}
            >
              <span className={typeLabel}>{spec.label}</span>
            </button>
          ))}
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4">
          <div className="mb-2 flex shrink-0 items-center gap-2">
            <h2 className={`${typeBase} font-medium text-text`}>{activeSpec.label}</h2>
            {activeSpec.halftone ? (
              <span className={`${typeCaption} rounded bg-surface-input px-1.5 py-0.5`}>halftone</span>
            ) : null}
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border-subtle bg-surface-secondary">
            {activeSpec.halftone ? (
              <WeavingHalftoneStage key={activeSpec.id} {...activeSpec.weaveProps} {...HALFTONE_PROPS} />
            ) : (
              <ShaderCanvas key={activeSpec.id} {...activeSpec.weaveProps} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
