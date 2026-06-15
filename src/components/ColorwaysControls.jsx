/**
 * Colorways sidebar controls — "Use all 5 colorways" toggle plus distribution,
 * include-mask, noise/bleed sliders, and thread shade selects (weave or mosaic).
 */
import * as Label from '@radix-ui/react-label';
import {
  toggleBtn,
  toggleBtnActive,
  toggleBtnIcon,
  iconPlayGlyph,
  iconResetGlyph,
  typeLabel,
  SHADE_NAMES,
} from '../uiConstants';
import { WEAVING_URL_DEFAULTS } from '../urlDefaults';
import { snapColorwayBleedRotation, COLORWAY_BLEED_ANGLE_TURNS, firstPaletteInIncludeMask, includeMaskForPalette } from '../colorwayUtils';
import { SliderWithInput } from './SliderWithInput';
import {
  AppSelect,
  SegmentedControl,
  SegmentedControlButton,
  IconButton,
  Icon,
  GroupIcon,
} from './ui';

const shadeOptions = (prefix) =>
  SHADE_NAMES.map((name, i) => ({ value: i, label: prefix ? `${prefix}: ${name}` : name }));

/** Icon-only play/pause for colorway automation (sweeps / cycles; see aria-labels). */
function ColorwayAnimPlayBtn({ active, onToggle, labelPlay, labelPause }) {
  return (
    <button
      type="button"
      className={`${toggleBtnIcon} ${active ? toggleBtnActive : ''}`}
      aria-pressed={active}
      aria-label={active ? labelPause : labelPlay}
      onClick={onToggle}
    >
      <Icon name={active ? 'pause' : 'play_arrow'} className={iconPlayGlyph} />
    </button>
  );
}

export default function ColorwaysControls({
  idPrefix = '',
  variant,
  palette,
  setPalette,
  useAllColorways,
  setUseAllColorways,
  colorwaySeed,
  setColorwaySeed,
  colorwayNoiseScale,
  setColorwayNoiseScale,
  colorwayNoiseMode,
  setColorwayNoiseMode,
  colorwayNoiseOctaves,
  setColorwayNoiseOctaves,
  colorwayNoisePersistence,
  setColorwayNoisePersistence,
  colorwayNoiseLacunarity,
  setColorwayNoiseLacunarity,
  colorwayNoiseBias,
  setColorwayNoiseBias,
  colorwayNoiseX,
  setColorwayNoiseX,
  colorwayBleedAnisotropy,
  setColorwayBleedAnisotropy,
  colorwayBleedRotation,
  setColorwayBleedRotation,
  colorwayBleedCrossFiber,
  setColorwayBleedCrossFiber,
  colorwayBleedDraftCoupled,
  setColorwayBleedDraftCoupled,
  colorwayIncludeMask,
  setColorwayIncludeMask,
  colorwayAnimPlaying,
  setColorwayAnimPlaying,
  bgShade,
  setBgShade,
  // weave variant
  warpShade,
  setWarpShade,
  weftShade,
  setWeftShade,
  shadesLocked,
  setShadesLocked,
  onBgShadeChange,
  onWarpShadeChange,
  onWeftShadeChange,
  // mosaic variant
  rectColorSource,
  patternWarpShade,
  setPatternWarpShade,
  patternWeftShade,
  setPatternWeftShade,
}) {
  const showMosaicWarpWeft = variant === 'mosaic' && (rectColorSource === 2 || rectColorSource === 3);

  return (
    <>
      <GroupIcon name="palette" title="All colorways" />
      <button
        type="button"
        className={`${toggleBtn} ${useAllColorways ? toggleBtnActive : ''}`}
        aria-pressed={useAllColorways}
        aria-label="Use all 5 colorways (hash, smooth noise, or dye bleed)"
        onClick={() => {
          if (useAllColorways) {
            setPalette?.(firstPaletteInIncludeMask(colorwayIncludeMask));
            setUseAllColorways(false);
            return;
          }
          setColorwayIncludeMask(includeMaskForPalette(palette ?? WEAVING_URL_DEFAULTS.palette));
          setUseAllColorways(true);
        }}
      >
        Use all 5 colorways
      </button>
      {useAllColorways !== WEAVING_URL_DEFAULTS.useAllColorways && (
        <IconButton
          size="resetSm"
          onClick={() => setUseAllColorways(WEAVING_URL_DEFAULTS.useAllColorways)}
          title="Reset all-colorways toggle"
          aria-label="Reset all colorways toggle to default"
        >
          <Icon name="restart_alt" className={iconResetGlyph} />
        </IconButton>
      )}
      {useAllColorways && (
        <>
          <div className="flex w-full flex-col gap-1.5">
            <span className={typeLabel}>Thread shades</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {variant === 'weave' ? (
                <GroupIcon
                  name="palette"
                  title="Warp/weft shades apply to each cell’s picked palette; background uses the colorway swatch above"
                  locked={shadesLocked}
                  onLockChange={setShadesLocked}
                />
              ) : (
                <GroupIcon
                  name="palette"
                  title="Thread shades within each cell’s palette when rect color follows pattern warp/weft"
                />
              )}
              <AppSelect
                id={`${idPrefix}allcw-bg-shade`}
                labelText="Background shade"
                value={bgShade}
                onValueChange={(v) => {
                  setBgShade(Number(v));
                  onBgShadeChange?.();
                }}
                defaultValue={WEAVING_URL_DEFAULTS.bgShade}
                onReset={() => {
                  setBgShade(WEAVING_URL_DEFAULTS.bgShade);
                  onBgShadeChange?.();
                }}
                options={shadeOptions('BG')}
                title="Background shade (single colorway swatch when not using per-cell palettes for BG)"
                placeholder="BG"
              />
              {variant === 'weave' && (
                <>
                  <AppSelect
                    id={`${idPrefix}allcw-warp-shade`}
                    labelText="Warp shade"
                    value={warpShade}
                    onValueChange={(v) => {
                      const shade = Number(v);
                      setWarpShade(shade);
                      onWarpShadeChange?.(shade);
                    }}
                    options={shadeOptions('Warp')}
                    title="Warp thread shade within each cell’s palette"
                    placeholder="Warp"
                    defaultValue={WEAVING_URL_DEFAULTS.warpShade}
                    onReset={() => {
                      setWarpShade(WEAVING_URL_DEFAULTS.warpShade);
                      onWarpShadeChange?.();
                    }}
                  />
                  <AppSelect
                    id={`${idPrefix}allcw-weft-shade`}
                    labelText="Weft shade"
                    value={weftShade}
                    onValueChange={(v) => {
                      const shade = Number(v);
                      setWeftShade(shade);
                      onWeftShadeChange?.(shade);
                    }}
                    options={shadeOptions('Weft')}
                    title="Weft thread shade within each cell’s palette"
                    placeholder="Weft"
                    defaultValue={WEAVING_URL_DEFAULTS.weftShade}
                    onReset={() => {
                      setWeftShade(WEAVING_URL_DEFAULTS.weftShade);
                      onWeftShadeChange?.();
                    }}
                  />
                </>
              )}
              {showMosaicWarpWeft && (
                <>
                  <AppSelect
                    id={`${idPrefix}allcw-warp-shade`}
                    labelText="Warp shade"
                    value={patternWarpShade}
                    onValueChange={(v) => setPatternWarpShade(Number(v))}
                    options={shadeOptions('Warp')}
                    title="Warp thread shade within each cell’s palette"
                    placeholder="Warp"
                    defaultValue={WEAVING_URL_DEFAULTS.warpShade}
                    onReset={() => setPatternWarpShade(WEAVING_URL_DEFAULTS.warpShade)}
                  />
                  <AppSelect
                    id={`${idPrefix}allcw-weft-shade`}
                    labelText="Weft shade"
                    value={patternWeftShade}
                    onValueChange={(v) => setPatternWeftShade(Number(v))}
                    options={shadeOptions('Weft')}
                    title="Weft thread shade within each cell’s palette"
                    placeholder="Weft"
                    defaultValue={WEAVING_URL_DEFAULTS.weftShade}
                    onReset={() => setPatternWeftShade(WEAVING_URL_DEFAULTS.weftShade)}
                  />
                </>
              )}
            </div>
          </div>
          <div className="flex w-full flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className={typeLabel}>Distribution</span>
              <ColorwayAnimPlayBtn
                active={colorwayAnimPlaying.noiseMode}
                onToggle={() => setColorwayAnimPlaying((x) => ({ ...x, noiseMode: !x.noiseMode }))}
                labelPlay="Play: cycle Random, Smooth, Bleed"
                labelPause="Pause distribution animation"
              />
            </div>
            <SegmentedControl>
              <div className="flex h-full">
                <SegmentedControlButton
                  active={colorwayNoiseMode === 0}
                  aria-pressed={colorwayNoiseMode === 0}
                  aria-label="Random per cell (hash)"
                  onClick={() => setColorwayNoiseMode(0)}
                >
                  Random
                </SegmentedControlButton>
                <SegmentedControlButton
                  active={colorwayNoiseMode === 1}
                  aria-pressed={colorwayNoiseMode === 1}
                  aria-label="Smooth Perlin noise"
                  onClick={() => setColorwayNoiseMode(1)}
                >
                  Smooth
                </SegmentedControlButton>
                <SegmentedControlButton
                  active={colorwayNoiseMode === 2}
                  aria-pressed={colorwayNoiseMode === 2}
                  aria-label="Dye bleed along threads"
                  onClick={() => setColorwayNoiseMode(2)}
                >
                  Bleed
                </SegmentedControlButton>
              </div>
            </SegmentedControl>
          </div>
          <div className="flex w-full flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label.Root className={typeLabel} htmlFor={`${idPrefix}colorway-noise-scale`}>
                Noise scale
              </Label.Root>
              <ColorwayAnimPlayBtn
                active={colorwayAnimPlaying.noiseScale}
                onToggle={() => setColorwayAnimPlaying((x) => ({ ...x, noiseScale: !x.noiseScale }))}
                labelPlay="Play: oscillate noise scale"
                labelPause="Pause noise scale animation"
              />
            </div>
            <SliderWithInput
              id={`${idPrefix}colorway-noise-scale`}
              value={colorwayNoiseScale}
              onValueChange={setColorwayNoiseScale}
              min={0.005}
              max={0.25}
              step={0.001}
              format={(n) => n.toFixed(3)}
              aria-label="Colorway spatial scale"
              defaultValue={WEAVING_URL_DEFAULTS.colorwayNoiseScale}
              onReset={() => setColorwayNoiseScale(WEAVING_URL_DEFAULTS.colorwayNoiseScale)}
            />
          </div>
          <div className="flex flex-wrap items-end gap-1.5">
            <div className="min-w-0 flex-1 basis-[min(100%,14rem)]">
              <Label.Root className="sr-only" htmlFor={`${idPrefix}colorway-seed`}>
                Colorway seed
              </Label.Root>
              <SliderWithInput
                id={`${idPrefix}colorway-seed`}
                value={colorwaySeed}
                onValueChange={setColorwaySeed}
                min={0}
                max={100}
                step={0.1}
                format={(n) => (n === 0 || n >= 99.9 ? n.toFixed(0) : n.toFixed(1))}
                aria-label="Colorway seed"
                defaultValue={WEAVING_URL_DEFAULTS.colorwaySeed}
                onReset={() => setColorwaySeed(WEAVING_URL_DEFAULTS.colorwaySeed)}
              />
            </div>
            <span className="shrink-0 min-w-14 pb-0.5 text-[9px] tabular-nums text-text" aria-hidden>
              Seed: {typeof colorwaySeed === 'number' && Number.isInteger(colorwaySeed) ? colorwaySeed : colorwaySeed.toFixed(1)}
            </span>
            <ColorwayAnimPlayBtn
              active={colorwayAnimPlaying.seed}
              onToggle={() => setColorwayAnimPlaying((x) => ({ ...x, seed: !x.seed }))}
              labelPlay="Play: sweep seed 0→100 over 20 minutes, loop"
              labelPause="Pause colorway seed animation"
            />
          </div>
          <div className="flex w-full flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label.Root className={typeLabel} htmlFor={`${idPrefix}colorway-noise-x`}>
                Noise X
              </Label.Root>
              <ColorwayAnimPlayBtn
                active={colorwayAnimPlaying.noiseX}
                onToggle={() => setColorwayAnimPlaying((x) => ({ ...x, noiseX: !x.noiseX }))}
                labelPlay="Play: oscillate noise X over ~50 minutes, loop"
                labelPause="Pause noise X animation"
              />
            </div>
            <SliderWithInput
              id={`${idPrefix}colorway-noise-x`}
              value={colorwayNoiseX}
              onValueChange={(v) => setColorwayNoiseX(Number(Number(v).toFixed(2)))}
              min={-250}
              max={250}
              step={0.01}
              format={(n) => n.toFixed(2)}
              aria-label="Colorway noise X (cell-space offset along warp; animates pattern drift)"
              defaultValue={WEAVING_URL_DEFAULTS.colorwayNoiseX}
              onReset={() => setColorwayNoiseX(WEAVING_URL_DEFAULTS.colorwayNoiseX)}
            />
          </div>
          {colorwayNoiseMode === 1 && (
            <div className="flex w-full flex-col gap-2 border-t border-border-subtle pt-2">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <Label.Root className={typeLabel} htmlFor={`${idPrefix}colorway-octaves`}>
                    Octaves
                  </Label.Root>
                  <ColorwayAnimPlayBtn
                    active={colorwayAnimPlaying.octaves}
                    onToggle={() => setColorwayAnimPlaying((x) => ({ ...x, octaves: !x.octaves }))}
                    labelPlay="Play: cycle octaves 1–4"
                    labelPause="Pause octaves animation"
                  />
                </div>
                <SliderWithInput
                  id={`${idPrefix}colorway-octaves`}
                  value={colorwayNoiseOctaves}
                  onValueChange={(v) => setColorwayNoiseOctaves(Math.round(v))}
                  min={1}
                  max={4}
                  step={1}
                  format={(n) => String(Math.round(n))}
                  aria-label="FBM octaves"
                  defaultValue={WEAVING_URL_DEFAULTS.colorwayNoiseOctaves}
                  onReset={() => setColorwayNoiseOctaves(WEAVING_URL_DEFAULTS.colorwayNoiseOctaves)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <Label.Root className={typeLabel} htmlFor={`${idPrefix}colorway-persistence`}>
                    Persistence
                  </Label.Root>
                  <ColorwayAnimPlayBtn
                    active={colorwayAnimPlaying.persistence}
                    onToggle={() => setColorwayAnimPlaying((x) => ({ ...x, persistence: !x.persistence }))}
                    labelPlay="Play: oscillate persistence"
                    labelPause="Pause persistence animation"
                  />
                </div>
                <SliderWithInput
                  id={`${idPrefix}colorway-persistence`}
                  value={colorwayNoisePersistence}
                  onValueChange={setColorwayNoisePersistence}
                  min={0.15}
                  max={0.95}
                  step={0.05}
                  format={(n) => n.toFixed(2)}
                  aria-label="FBM persistence"
                  defaultValue={WEAVING_URL_DEFAULTS.colorwayNoisePersistence}
                  onReset={() => setColorwayNoisePersistence(WEAVING_URL_DEFAULTS.colorwayNoisePersistence)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <Label.Root className={typeLabel} htmlFor={`${idPrefix}colorway-lacunarity`}>
                    Lacunarity
                  </Label.Root>
                  <ColorwayAnimPlayBtn
                    active={colorwayAnimPlaying.lacunarity}
                    onToggle={() => setColorwayAnimPlaying((x) => ({ ...x, lacunarity: !x.lacunarity }))}
                    labelPlay="Play: oscillate lacunarity"
                    labelPause="Pause lacunarity animation"
                  />
                </div>
                <SliderWithInput
                  id={`${idPrefix}colorway-lacunarity`}
                  value={colorwayNoiseLacunarity}
                  onValueChange={setColorwayNoiseLacunarity}
                  min={1.05}
                  max={4}
                  step={0.05}
                  format={(n) => n.toFixed(2)}
                  aria-label="FBM lacunarity"
                  defaultValue={WEAVING_URL_DEFAULTS.colorwayNoiseLacunarity}
                  onReset={() => setColorwayNoiseLacunarity(WEAVING_URL_DEFAULTS.colorwayNoiseLacunarity)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <Label.Root className={typeLabel} htmlFor={`${idPrefix}colorway-bias`}>
                    Bias
                  </Label.Root>
                  <ColorwayAnimPlayBtn
                    active={colorwayAnimPlaying.bias}
                    onToggle={() => setColorwayAnimPlaying((x) => ({ ...x, bias: !x.bias }))}
                    labelPlay="Play: sweep bias max→min→max, loop"
                    labelPause="Pause bias animation"
                  />
                </div>
                <SliderWithInput
                  id={`${idPrefix}colorway-bias`}
                  value={colorwayNoiseBias}
                  onValueChange={setColorwayNoiseBias}
                  min={0.25}
                  max={4}
                  step={0.05}
                  format={(n) => n.toFixed(2)}
                  aria-label="Quantize curve (1 = linear)"
                  defaultValue={WEAVING_URL_DEFAULTS.colorwayNoiseBias}
                  onReset={() => setColorwayNoiseBias(WEAVING_URL_DEFAULTS.colorwayNoiseBias)}
                />
              </div>
            </div>
          )}
          {colorwayNoiseMode === 2 && (
            <div className="flex w-full flex-col gap-2 border-t border-border-subtle pt-2">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <Label.Root className={typeLabel} htmlFor={`${idPrefix}bleed-anisotropy`}>
                    Run length
                  </Label.Root>
                  <ColorwayAnimPlayBtn
                    active={colorwayAnimPlaying.bleedAnisotropy}
                    onToggle={() => setColorwayAnimPlaying((x) => ({ ...x, bleedAnisotropy: !x.bleedAnisotropy }))}
                    labelPlay="Play: oscillate run length"
                    labelPause="Pause run length animation"
                  />
                </div>
                <SliderWithInput
                  id={`${idPrefix}bleed-anisotropy`}
                  value={colorwayBleedAnisotropy}
                  onValueChange={setColorwayBleedAnisotropy}
                  min={0.35}
                  max={12}
                  step={0.05}
                  format={(n) => n.toFixed(2)}
                  aria-label="Dye streak anisotropy"
                  defaultValue={WEAVING_URL_DEFAULTS.colorwayBleedAnisotropy}
                  onReset={() => setColorwayBleedAnisotropy(WEAVING_URL_DEFAULTS.colorwayBleedAnisotropy)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <Label.Root className={typeLabel} htmlFor={`${idPrefix}bleed-rotation`}>
                    Streak angle
                  </Label.Root>
                  <ColorwayAnimPlayBtn
                    active={colorwayAnimPlaying.bleedRotation}
                    onToggle={() => setColorwayAnimPlaying((x) => ({ ...x, bleedRotation: !x.bleedRotation }))}
                    labelPlay="Play: sweep streak angle (snapped to 5°)"
                    labelPause="Pause streak angle animation"
                  />
                </div>
                <SliderWithInput
                  id={`${idPrefix}bleed-rotation`}
                  value={colorwayBleedRotation}
                  onValueChange={setColorwayBleedRotation}
                  snapValues={COLORWAY_BLEED_ANGLE_TURNS}
                  min={0}
                  max={1}
                  step={5 / 360}
                  format={(n) => `${Math.round(snapColorwayBleedRotation(n) * 360)}°`}
                  parse={(s) => {
                    const deg = Number(String(s).replace(/°/g, '').trim());
                    if (!Number.isFinite(deg)) return null;
                    return snapColorwayBleedRotation(deg / 360);
                  }}
                  aria-label="Streak angle (5° steps)"
                  defaultValue={WEAVING_URL_DEFAULTS.colorwayBleedRotation}
                  onReset={() => setColorwayBleedRotation(WEAVING_URL_DEFAULTS.colorwayBleedRotation)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <Label.Root className={typeLabel} htmlFor={`${idPrefix}bleed-cross`}>
                    Cross-fiber
                  </Label.Root>
                  <ColorwayAnimPlayBtn
                    active={colorwayAnimPlaying.bleedCrossFiber}
                    onToggle={() => setColorwayAnimPlaying((x) => ({ ...x, bleedCrossFiber: !x.bleedCrossFiber }))}
                    labelPlay="Play: oscillate cross-fiber mix"
                    labelPause="Pause cross-fiber animation"
                  />
                </div>
                <SliderWithInput
                  id={`${idPrefix}bleed-cross`}
                  value={colorwayBleedCrossFiber}
                  onValueChange={setColorwayBleedCrossFiber}
                  min={0}
                  max={1}
                  step={0.05}
                  format={(n) => n.toFixed(2)}
                  aria-label="Mix isotropic noise"
                  defaultValue={WEAVING_URL_DEFAULTS.colorwayBleedCrossFiber}
                  onReset={() => setColorwayBleedCrossFiber(WEAVING_URL_DEFAULTS.colorwayBleedCrossFiber)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  className={`${toggleBtn} ${colorwayBleedDraftCoupled ? toggleBtnActive : ''}`}
                  aria-pressed={colorwayBleedDraftCoupled}
                  aria-label="Tie streaks to warp vs weft"
                  onClick={() => setColorwayBleedDraftCoupled((v) => !v)}
                >
                  Draft-coupled
                </button>
                <ColorwayAnimPlayBtn
                  active={colorwayAnimPlaying.bleedDraftCoupled}
                  onToggle={() => setColorwayAnimPlaying((x) => ({ ...x, bleedDraftCoupled: !x.bleedDraftCoupled }))}
                  labelPlay="Play: toggle draft-coupled on a timer"
                  labelPause="Pause draft-coupled animation"
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <Label.Root className={typeLabel} htmlFor={`${idPrefix}bleed-octaves`}>
                    Octaves
                  </Label.Root>
                  <ColorwayAnimPlayBtn
                    active={colorwayAnimPlaying.octaves}
                    onToggle={() => setColorwayAnimPlaying((x) => ({ ...x, octaves: !x.octaves }))}
                    labelPlay="Play: cycle octaves 1–4"
                    labelPause="Pause octaves animation"
                  />
                </div>
                <SliderWithInput
                  id={`${idPrefix}bleed-octaves`}
                  value={colorwayNoiseOctaves}
                  onValueChange={(v) => setColorwayNoiseOctaves(Math.round(v))}
                  min={1}
                  max={4}
                  step={1}
                  format={(n) => String(Math.round(n))}
                  aria-label="FBM octaves (bleed)"
                  defaultValue={WEAVING_URL_DEFAULTS.colorwayNoiseOctaves}
                  onReset={() => setColorwayNoiseOctaves(WEAVING_URL_DEFAULTS.colorwayNoiseOctaves)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <Label.Root className={typeLabel} htmlFor={`${idPrefix}bleed-persistence`}>
                    Persistence
                  </Label.Root>
                  <ColorwayAnimPlayBtn
                    active={colorwayAnimPlaying.persistence}
                    onToggle={() => setColorwayAnimPlaying((x) => ({ ...x, persistence: !x.persistence }))}
                    labelPlay="Play: oscillate persistence"
                    labelPause="Pause persistence animation"
                  />
                </div>
                <SliderWithInput
                  id={`${idPrefix}bleed-persistence`}
                  value={colorwayNoisePersistence}
                  onValueChange={setColorwayNoisePersistence}
                  min={0.15}
                  max={0.95}
                  step={0.05}
                  format={(n) => n.toFixed(2)}
                  aria-label="FBM persistence (bleed)"
                  defaultValue={WEAVING_URL_DEFAULTS.colorwayNoisePersistence}
                  onReset={() => setColorwayNoisePersistence(WEAVING_URL_DEFAULTS.colorwayNoisePersistence)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <Label.Root className={typeLabel} htmlFor={`${idPrefix}bleed-lacunarity`}>
                    Lacunarity
                  </Label.Root>
                  <ColorwayAnimPlayBtn
                    active={colorwayAnimPlaying.lacunarity}
                    onToggle={() => setColorwayAnimPlaying((x) => ({ ...x, lacunarity: !x.lacunarity }))}
                    labelPlay="Play: oscillate lacunarity"
                    labelPause="Pause lacunarity animation"
                  />
                </div>
                <SliderWithInput
                  id={`${idPrefix}bleed-lacunarity`}
                  value={colorwayNoiseLacunarity}
                  onValueChange={setColorwayNoiseLacunarity}
                  min={1.05}
                  max={4}
                  step={0.05}
                  format={(n) => n.toFixed(2)}
                  aria-label="FBM lacunarity (bleed)"
                  defaultValue={WEAVING_URL_DEFAULTS.colorwayNoiseLacunarity}
                  onReset={() => setColorwayNoiseLacunarity(WEAVING_URL_DEFAULTS.colorwayNoiseLacunarity)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <Label.Root className={typeLabel} htmlFor={`${idPrefix}bleed-bias`}>
                    Bias
                  </Label.Root>
                  <ColorwayAnimPlayBtn
                    active={colorwayAnimPlaying.bias}
                    onToggle={() => setColorwayAnimPlaying((x) => ({ ...x, bias: !x.bias }))}
                    labelPlay="Play: sweep bias max→min→max, loop"
                    labelPause="Pause bias animation"
                  />
                </div>
                <SliderWithInput
                  id={`${idPrefix}bleed-bias`}
                  value={colorwayNoiseBias}
                  onValueChange={setColorwayNoiseBias}
                  min={0.25}
                  max={4}
                  step={0.05}
                  format={(n) => n.toFixed(2)}
                  aria-label="Quantize curve (bleed)"
                  defaultValue={WEAVING_URL_DEFAULTS.colorwayNoiseBias}
                  onReset={() => setColorwayNoiseBias(WEAVING_URL_DEFAULTS.colorwayNoiseBias)}
                />
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
