/**
 * Theme context: light/dark UI tokens via `data-theme` on `<html>`.
 * Persists explicit choice; first visit follows `prefers-color-scheme` until toggled.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  applyThemeToDocument,
  getSystemTheme,
  readStoredTheme,
  resolveTheme,
  writeStoredTheme,
} from './themeStorage.js';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [storedTheme, setStoredTheme] = useState(() => readStoredTheme());
  const theme = resolveTheme(storedTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    if (storedTheme != null) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => applyThemeToDocument(getSystemTheme());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [storedTheme]);

  const setTheme = useCallback((next) => {
    writeStoredTheme(next);
    setStoredTheme(next);
    applyThemeToDocument(next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme, hasStoredPreference: storedTheme != null }), [theme, setTheme, storedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
