/**
 * Wrapper and button for scale/format toggles (copy scale, export scale, record format).
 * SegmentedControlButton uses segmentedControlBtn + segmentedControlBtnActive; set format for uppercase labels (PNG/WebP).
 */
import {
  segmentedControl,
  segmentedControlBtn,
  segmentedControlBtnActive,
  segmentedControlBtnFormat,
} from '../../uiConstants';

export function SegmentedControl({ children, className = '' }) {
  return <div className={`${segmentedControl} ${className}`}>{children}</div>;
}

/**
 * Single segment (e.g. "1×", "2×", "PNG"). Active state uses segmentedControlBtnActive.
 * @param {{ active?: boolean, format?: boolean, children: React.ReactNode, [key: string]: any }} props
 */
export function SegmentedControlButton({ active, format, children, ...rest }) {
  const base = format ? segmentedControlBtnFormat : segmentedControlBtn;
  return (
    <button
      type="button"
      className={`${base} ${active ? segmentedControlBtnActive : ''}`}
      data-state={active ? 'on' : 'off'}
      {...rest}
    >
      {children}
    </button>
  );
}
