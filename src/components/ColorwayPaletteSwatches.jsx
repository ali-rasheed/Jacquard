/**
 * Colorway palette row — single-select when all-colorways is off; multi-select pool when on.
 * Same swatch chrome in both modes; all-colorways drives `colorwayIncludeMask` instead of a duplicate row.
 */
import {
  iconPlayGlyph,
  iconResetGlyph,
  paletteSwatch,
  paletteSwatchSelected,
  paletteSwatchUnselected,
  PALETTE_NAMES,
  PALETTE_SWATCH_COLORS,
  toggleBtnActive,
  toggleBtnIcon,
} from '../uiConstants';
import { WEAVING_URL_DEFAULTS } from '../urlDefaults';
import { toggleColorwayIncludeMask } from '../colorwayUtils';
import { Icon, IconButton } from './ui';

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

export function ColorwayPaletteSwatches({
  palette,
  setPalette,
  useAllColorways = false,
  colorwayIncludeMask = WEAVING_URL_DEFAULTS.colorwayIncludeMask,
  setColorwayIncludeMask,
  onSingleSelect,
  includeMaskAnimPlaying = false,
  onIncludeMaskAnimToggle,
}) {
  const showReset = useAllColorways
    ? colorwayIncludeMask !== WEAVING_URL_DEFAULTS.colorwayIncludeMask
    : palette !== WEAVING_URL_DEFAULTS.palette;

  const handleReset = () => {
    if (useAllColorways) {
      setColorwayIncludeMask?.(WEAVING_URL_DEFAULTS.colorwayIncludeMask);
      return;
    }
    setPalette(WEAVING_URL_DEFAULTS.palette);
    onSingleSelect?.(WEAVING_URL_DEFAULTS.palette);
  };

  return (
    <div className="flex items-center gap-1" role="group" aria-label={useAllColorways ? 'Palettes in the colorway pool' : 'Colorway palette'}>
      {PALETTE_SWATCH_COLORS.map((color, i) => {
        const selected = useAllColorways
          ? (colorwayIncludeMask & (1 << i)) !== 0
          : palette === i;
        return (
          <button
            key={i}
            type="button"
            className={`${paletteSwatch} ${selected ? paletteSwatchSelected : paletteSwatchUnselected} ${useAllColorways && !selected ? 'opacity-40 grayscale' : ''}`}
            style={{
              backgroundColor: color,
              borderColor: selected ? 'var(--color-accent)' : 'var(--color-border-subtle)',
            }}
            title={useAllColorways ? `${selected ? 'Remove' : 'Add'} ${PALETTE_NAMES[i]}` : PALETTE_NAMES[i]}
            aria-label={
              useAllColorways
                ? `${PALETTE_NAMES[i]}: ${selected ? 'included in pool' : 'excluded'}`
                : `Colorway: ${PALETTE_NAMES[i]}`
            }
            aria-pressed={selected}
            onClick={() => {
              if (useAllColorways) {
                setColorwayIncludeMask?.((prev) => toggleColorwayIncludeMask(prev, i));
                return;
              }
              setPalette(i);
              onSingleSelect?.(i);
            }}
          />
        );
      })}
      {useAllColorways && onIncludeMaskAnimToggle && (
        <ColorwayAnimPlayBtn
          active={includeMaskAnimPlaying}
          onToggle={onIncludeMaskAnimToggle}
          labelPlay="Play: cycle each palette alone then all five"
          labelPause="Pause include-palette animation"
        />
      )}
      {showReset && (
        <IconButton
          size="resetSm"
          onClick={handleReset}
          title={useAllColorways ? 'Include all palettes' : 'Reset palette'}
          aria-label={useAllColorways ? 'Reset included palettes to all five' : 'Reset palette to default'}
        >
          <Icon name="restart_alt" className={iconResetGlyph} />
        </IconButton>
      )}
    </div>
  );
}
