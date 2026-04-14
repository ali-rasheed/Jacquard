/**
 * Icon-only button: sm (24px), md (28px), or resetSm/resetMd (75% — redo/reset controls).
 * Optional variant="danger" for record/error state (uses sm hit target).
 * @param {{ size?: 'sm' | 'md' | 'resetSm' | 'resetMd', variant?: 'default' | 'danger', children: React.ReactNode, className?: string, [key: string]: any }} props
 */
import { iconButtonSm, iconButtonMd, iconButtonResetSm, iconButtonResetMd, iconButtonDanger } from '../../uiConstants';

export function IconButton({ size = 'sm', variant = 'default', children, className = '', ...rest }) {
  const base =
    size === 'md'
      ? iconButtonMd
      : size === 'resetMd'
        ? iconButtonResetMd
        : size === 'resetSm'
          ? iconButtonResetSm
          : iconButtonSm;
  const classes = variant === 'danger' ? iconButtonDanger : base;
  return (
    <button type="button" className={`${classes} ${className}`} {...rest}>
      {children}
    </button>
  );
}
