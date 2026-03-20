/**
 * Icon-only button: sm (24px) or md (28px). Optional variant="danger" for record/error state.
 * @param {{ size?: 'sm' | 'md', variant?: 'default' | 'danger', children: React.ReactNode, className?: string, [key: string]: any }} props
 */
import { iconButtonSm, iconButtonMd, iconButtonDanger } from '../../uiConstants';

export function IconButton({ size = 'sm', variant = 'default', children, className = '', ...rest }) {
  const base = size === 'md' ? iconButtonMd : iconButtonSm;
  const classes = variant === 'danger' ? iconButtonDanger : base;
  return (
    <button type="button" className={`${classes} ${className}`} {...rest}>
      {children}
    </button>
  );
}
