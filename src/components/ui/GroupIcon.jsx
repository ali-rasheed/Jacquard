/**
 * Section icon with optional lock: lock button at top-left when onLockChange provided,
 * optional locked superscript at top-right when locked and no onLockChange.
 * @param {{ name: string, title?: string, locked?: boolean, onLockChange?: (locked: boolean) => void, className?: string }} props
 */
import { Icon } from './Icon';
import { iconLg, iconXs, iconXxs, shadeLockBtn, shadeLockBtnLocked } from '../../uiConstants';

export function GroupIcon({ name, title, locked = false, onLockChange, className = '' }) {
  return (
    <span title={title} className={`relative inline-flex shrink-0 ${className}`}>
      {onLockChange && (
        <button
          type="button"
          className={`${shadeLockBtn} ${locked ? shadeLockBtnLocked : ''}`}
          onClick={() => onLockChange(!locked)}
          aria-label={locked ? 'Unlock property' : 'Lock property'}
          title={locked ? 'Unlock' : 'Lock'}
        >
          <Icon name={locked ? 'lock' : 'lock_open'} className={iconXxs} />
        </button>
      )}
      <Icon name={name} className={`${iconLg} text-text-muted`} />
      {locked && !onLockChange && (
        <span className="absolute -top-0.5 -right-0.5 leading-none" aria-hidden title="Locked">
          <Icon name="lock" className={`${iconXs} text-text-muted`} />
        </span>
      )}
    </span>
  );
}
