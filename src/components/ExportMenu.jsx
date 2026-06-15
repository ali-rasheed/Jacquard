/**
 * Capture-bar export dropdown: Config handoff (all tabs) and Embed code (Weave only).
 * Closes on item pick, outside click, or Escape.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from './ui/Icon';
import { AppTooltip } from './ui/AppTooltip';
import { btnGhost, iconSm, iconLg, typeLabel } from '../uiConstants';

const exportMenuPanel =
  'z-50 w-max min-w-[13.5rem] overflow-hidden rounded-md border border-border-subtle bg-surface-elevated p-1 shadow-md';
const exportMenuItem =
  'flex w-full cursor-default select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-left outline-none transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover';

/**
 * @param {{
 *   showConfigExport?: boolean,
 *   onOpenConfigExport?: () => void,
 *   showEmbedExport?: boolean,
 *   onOpenEmbedExport?: () => void,
 * }} props
 */
export function ExportMenu({
  showConfigExport = true,
  onOpenConfigExport,
  showEmbedExport = false,
  onOpenEmbedExport,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();

  const items = [];
  if (showConfigExport && typeof onOpenConfigExport === 'function') {
    items.push({
      id: 'config',
      label: 'Export Config',
      icon: 'share',
      hint: 'Share link or JSON handoff',
      onSelect: onOpenConfigExport,
    });
  }
  if (showEmbedExport && typeof onOpenEmbedExport === 'function') {
    items.push({
      id: 'embed',
      label: 'Export Embed',
      icon: 'code',
      hint: 'React and HTML shader snippets',
      onSelect: onOpenEmbedExport,
    });
  }

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={rootRef} className="relative">
      <AppTooltip content="Export configuration or embed code">
        <button
          type="button"
          className={btnGhost}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="ios_share" className={iconSm} />
          <span className={typeLabel}>Export</span>
          <Icon name="expand_more" className={`${iconLg} opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </AppTooltip>

      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            aria-label="Export options"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className={`absolute bottom-full left-0 mb-1.5 ${exportMenuPanel}`}
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={exportMenuItem}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                <Icon name={item.icon} className={`mt-px shrink-0 ${iconSm} text-text-muted`} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="whitespace-nowrap text-[11px] font-medium leading-tight text-text">{item.label}</span>
                  <span className="whitespace-nowrap text-[10px] leading-tight text-text-secondary">{item.hint}</span>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
