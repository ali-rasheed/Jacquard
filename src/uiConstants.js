/**
 * Shared UI constants for Weaving (App.jsx) and Image Rects (AppV2.jsx).
 * Type scale, palette swatches, sidebar/button/select/pill classes, and FPS pill typography.
 */

/** Palette 0–3 main (500) swatch colors; matches useShaderSandbox / useImageRectsSandbox PALETTE_RGBA. */
export const PALETTE_SWATCH_COLORS = ['rgb(145, 75, 28)', 'rgb(240, 55, 147)', 'rgb(0, 128, 188)', 'rgb(0, 124, 35)'];
export const PALETTE_NAMES = ['Citrine', 'Garnet', 'Lapis', 'Peridot'];
export const SHADE_NAMES = ['950', '500', '100', '400', 'Transparent'];
/** Material Symbols Outlined icon name for the Transparent shade (used in pills). */
export const SHADE_TRANSPARENT_ICON = 'opacity';

/** Type scale: xs=10px (labels, caps), sm=11px (dropdowns), base=13px (body), input=13px (number inputs). */
export const typeXs = 'text-[10px]';
export const typeSm = 'text-[11px]';
export const typeBase = 'text-[11px]';
export const typeInput = 'text-[10px]';
export const typeLabel = 'text-[10px] font-medium uppercase tracking-wider text-text-muted';
export const typeControl = 'text-[10px] font-medium';
export const typeValue = 'text-[13px] tabular-nums text-text';
export const typeCaption = 'text-[10px] text-text-secondary';
/** FPS pill in ShaderCanvas / ImageRectsCanvas (replaces hardcoded text-[12px]). */
export const typeFps = 'text-[12px]';
/** Visible control labels: never crop (shrink-0 + nowrap). Use with typeCaption or typeValue. */
export const controlLabel = 'shrink-0 whitespace-nowrap';

export const iconXxs = 'text-[8px]';
export const iconXxs2 = 'text-[6px]';
export const iconXs = 'text-[10px]';
export const iconSm = 'text-[14px]';
export const iconMd = 'text-[16px]';
export const iconLg = 'text-[18px]';

export const btnGhost =
  `inline-flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-transparent px-2.5 py-1 ${typeControl} text-text-secondary outline-none transition-colors hover:border-border hover:bg-surface-hover hover:text-text focus:border-accent focus:outline-none`;
export const selectTrigger =
  `inline-flex h-7 min-w-1 w-fit items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface-input px-2 py-0.5 ${typeXs} text-text outline-none transition-colors hover:border-border focus:border-accent focus:ring-1 focus:ring-accent/20 data-[placeholder]:text-text-secondary`;
export const selectContent = 'z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border-subtle bg-surface-elevated shadow-md';
export const selectItem =
  `relative flex cursor-default select-none items-center rounded py-1.5 pl-2.5 pr-8 ${typeSm} outline-none data-[highlighted]:bg-surface-hover data-[highlighted]:text-text`;
export const pill = `inline-flex items-center rounded-full tracking-wide bg-surface-elevated border border-border-subtle px-2 py-0.5 ${typeXs} uppercase font-mono font-medium text-text-secondary`;

export const sidebarGroup = 'rounded-lg border border-border-subtle bg-surface-elevated/50 flex flex-col gap-2 p-2.5';
/** Sticky modifier for Actions group so it stays visible when scrolling (use with sidebarGroup). */
export const sidebarGroupSticky = 'sticky top-0 z-10 bg-surface/90 backdrop-blur-md';
export const sidebarGroupTitle = typeLabel;

/** Typeable number input next to sliders (Figma-style): syncs with slider, supports direct typing. Width 1rem. */
export const inputNumber =
  `h-7 min-w-7 max-w-12 w-fit rounded border border-border-subtle bg-surface-input px-1.5 text-center ${typeInput} tabular-nums text-text outline-none transition-colors hover:border-border focus:border-accent focus:ring-1 focus:ring-accent/20 disabled:opacity-60`;
