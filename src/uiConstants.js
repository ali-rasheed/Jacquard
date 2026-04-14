/**
 * Shared UI constants for Weaving (App.jsx) and Image Rects (AppV2.jsx).
 * Type scale, palette swatches, sidebar/button/select/pill classes, and FPS pill typography.
 */

/** Palette 0–4 main (500) swatch colors; matches useShaderSandbox / fragment shaders (Quartz = quartz/500). */
export const PALETTE_SWATCH_COLORS = ['rgb(145, 75, 28)', 'rgb(240, 55, 147)', 'rgb(0, 128, 188)', 'rgb(0, 124, 35)', 'rgb(89, 87, 85)'];
export const PALETTE_NAMES = ['Citrine', 'Garnet', 'Lapis', 'Peridot', 'Quartz'];
export const SHADE_NAMES = ['950', '500', '100', '400', 'Transparent', 'eee'];
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
export const iconXxxs = 'text-[6px]';
export const iconXxxxs = 'text-[4px]';
export const iconXxxxxs = 'text-[2px]';
export const iconXs = 'text-[10px]';
export const iconSm = 'text-[14px]';
export const iconMd = 'text-[16px]';
export const iconLg = 'text-[18px]';
/** Glyphs inside compact play/reset controls (75% of iconSm / iconMd / iconLg). */
export const iconPlayGlyph = 'text-[10.5px] leading-none';
export const iconResetGlyph = 'text-[10.5px] leading-none';
export const iconResetGlyphMd = 'text-[12px] leading-none';
export const iconResetGlyphLg = 'text-[13.5px] leading-none';

export const btnGhost =
  `inline-flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-transparent px-2.5 py-1 ${typeControl} text-text-secondary outline-none transition-colors hover:border-border hover:bg-surface-hover hover:text-text focus:border-accent focus:outline-none`;
export const selectTrigger =
  `inline-flex h-7 min-w-1 w-fit items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface-input px-2 py-0.5 ${typeXs} text-text outline-none transition-colors hover:border-border focus:border-accent focus:ring-1 focus:ring-accent/20 data-[placeholder]:text-text-secondary`;
export const selectContent = 'z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border-subtle bg-surface-elevated shadow-md';
export const selectItem =
  `relative flex cursor-default select-none items-center rounded py-1.5 pl-2.5 pr-8 ${typeSm} outline-none data-[highlighted]:bg-surface-hover data-[highlighted]:text-text`;
export const pill = `inline-flex items-center rounded-full tracking-wide bg-surface-elevated border border-border-subtle px-2 py-0.5 ${typeXs} uppercase font-mono font-medium text-text-secondary`;

export const sidebarGroup = 'rounded-lg border border-border-subtle bg-surface-elevated/50 flex flex-col gap-1.5 p-2.5';
/** Sticky modifier for Actions group so it stays visible when scrolling (use with sidebarGroup). */
export const sidebarGroupSticky = 'sticky top-0 z-10 bg-surface/90 backdrop-blur-md';
export const sidebarGroupTitle = typeLabel;

/** Typeable number input next to sliders (Figma-style): syncs with slider, supports direct typing.
 * Width matches content: set the size attribute (e.g. size={Math.max(4, valueLength)}) so the input
 * is as wide as the formatted value. Uses tabular-nums so digits align. */
export const inputNumber =
  `h-7 min-w-[2ch] max-w-[12ch] rounded border border-border-subtle bg-surface-input px-0.5 text-center ${typeInput} tabular-nums text-text outline-none transition-colors hover:border-border focus:border-accent focus:ring-1 focus:ring-accent/20 disabled:opacity-60`;

/** Full-width text/URL input (e.g. HalftoneCmykView image URL). */
export const inputText =
  'w-full rounded border border-border-subtle bg-surface-input px-2 py-1.5 text-left text-[11px] text-text outline-none transition-colors hover:border-border focus:border-accent focus:ring-1 focus:ring-accent/20';

/** Nav tab buttons (Weaving / Image Rects / Halftone). */
export const navBtn =
  `inline-flex h-8 items-center rounded-md border px-3 ${typeBase} font-medium outline-none transition-colors focus:ring-2 focus:ring-accent/40`;
export const navBtnActive = `border-accent bg-accent/10 text-accent ${navBtn}`;
export const navBtnInactive = `border-border-subtle bg-transparent text-text-secondary hover:border-border hover:bg-surface-hover hover:text-text ${navBtn}`;

/** Sidebar show/hide toggle in nav (left-aligned with title/tabs; no ml-auto). */
export const menuToggle =
  `flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 ${typeBase} transition-colors focus:ring-2 focus:ring-accent/40`;
export const menuToggleActive = 'border-accent bg-accent/10 text-accent';
export const menuToggleInactive = 'border-border-subtle bg-transparent text-text-secondary hover:border-border hover:bg-surface-hover hover:text-text';

/** Segmented control wrapper (copy/export/record scale + format). */
export const segmentedControl = 'inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border-subtle bg-surface-elevated overflow-hidden';
export const segmentedControlBtn =
  `flex min-w-[32px] items-center justify-center px-1.5 ${typeControl} transition-colors border-r border-border-subtle last:border-r-0 text-text-secondary hover:bg-surface-hover hover:text-text`;
export const segmentedControlBtnActive = 'bg-accent/15 text-accent';
export const segmentedControlBtnFormat =
  `flex min-w-[36px] items-center justify-center px-2 ${typeControl} uppercase transition-colors border-r border-border-subtle last:border-r-0 text-text-secondary hover:bg-surface-hover hover:text-text`;

/** Icon-only buttons: sm = 24px, md = 28px (copy, export, record, shade lock). */
export const iconButtonSm =
  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-elevated text-text-secondary transition-colors hover:border-accent hover:bg-accent/10 hover:text-accent focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20';
export const iconButtonMd =
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-elevated text-text-secondary transition-colors hover:border-accent hover:bg-accent/10 hover:text-accent focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20';
/** Reset/redo icon hits — 75% of sm/md (18px / 21px). */
export const iconButtonResetSm =
  'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-elevated text-text-secondary transition-colors hover:border-accent hover:bg-accent/10 hover:text-accent focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20';
export const iconButtonResetMd =
  'flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-elevated text-text-secondary transition-colors hover:border-accent hover:bg-accent/10 hover:text-accent focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20';
export const iconButtonDanger =
  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors border-error bg-error/15 text-error focus:outline-none focus:ring-1 focus:ring-accent/20';

/** Palette/swatch color button (border reflects selected). */
export const paletteSwatch = 'h-7 w-7 shrink-0 rounded-md border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40';
export const paletteSwatchSelected = 'border-accent';
export const paletteSwatchUnselected = 'border-border-subtle';
export const paletteSwatchSm = 'h-6 w-6 rounded border-2';

/** Two-option toggle (Color/Brand, Shimmer, Use colorways). */
export const toggleBtn =
  `flex h-7 min-w-16 items-center justify-center rounded-md border px-2.5 ${typeControl} transition-colors border-border-subtle bg-surface-input text-text-secondary hover:bg-surface-hover hover:text-text`;
export const toggleBtnActive = 'border-accent bg-accent/15 text-accent';
export const toggleBtnIcon =
  `flex h-[21px] w-[21px] items-center justify-center rounded-md border ${typeControl} transition-colors border-border-subtle bg-surface-input text-text-secondary hover:bg-surface-hover hover:text-text`;

/** Direction switch (e.g. gradient direction 0/1). */
export const directionSwitch = 'inline-flex h-7 shrink-0 rounded-md border border-border-subtle bg-surface-input overflow-hidden';
export const directionSwitchBtn =
  `flex h-full min-w-[28px] items-center justify-center px-2 ${typeBase} text-text-secondary transition-colors hover:bg-surface-hover hover:text-text data-[state=on]:bg-accent/15 data-[state=on]:text-accent border-r border-border-subtle last:border-r-0`;

/** Small lock/unlock control on GroupIcon. */
export const shadeLockBtn =
  'absolute -left-0.5 -top-0.5 flex h-2 w-2 items-center justify-center rounded border border-border-subtle bg-surface-input text-text-muted transition-colors hover:border-border hover:bg-surface-hover hover:text-text focus:outline-none focus:ring-1 focus:ring-accent/40';
export const shadeLockBtnLocked = 'border-accent/50 bg-accent/10 text-accent';

/** FPS overlay pill on ShaderCanvas / ImageRectsCanvas. */
export const fpsPill =
  `absolute right-2 top-2 rounded-full border border-border-subtle bg-surface-elevated px-2.5 py-0.5 font-mono ${typeFps} font-medium text-text-secondary`;
