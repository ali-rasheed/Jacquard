/**
 * Two-option switch for gradient direction (or similar). Uses directionSwitch + directionSwitchBtn.
 * @param {{ value: number | string, onValueChange: (v: number | string) => void, options: Array<{ value: number | string, label: string, icon?: string }>, title?: string, ariaLabel?: string }} props
 */
import { Icon } from './Icon';
import { directionSwitch, directionSwitchBtn, iconLg } from '../../uiConstants';

export function DirectionSwitch({ value, onValueChange, options, title, ariaLabel }) {
  return (
    <div className={directionSwitch} role="group" aria-label={ariaLabel ?? title} title={title}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={directionSwitchBtn}
          aria-pressed={value === opt.value}
          aria-label={title ? `${title}: ${opt.label}` : opt.label}
          data-state={value === opt.value ? 'on' : 'off'}
          onClick={() => onValueChange(opt.value)}
        >
          {opt.icon ? <Icon name={opt.icon} className={iconLg} /> : opt.label}
        </button>
      ))}
    </div>
  );
}
