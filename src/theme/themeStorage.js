/**
 * Light/dark theme: persisted in localStorage; applied on `document.documentElement` via `data-theme`.
 */

export const THEME_STORAGE_KEY = 'shaderbox-theme-v1';

/** @typedef {'light' | 'dark'} Theme */

/** @returns {Theme | null} */
export function readStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === 'light' || value === 'dark') return value;
  } catch {
    /* private mode / blocked storage */
  }
  return null;
}

/** @returns {Theme} */
export function getSystemTheme() {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** @param {Theme | null} stored */
export function resolveTheme(stored) {
  return stored ?? getSystemTheme();
}

/** @param {Theme} theme */
export function applyThemeToDocument(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
}

/** @param {Theme} theme */
export function writeStoredTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}
