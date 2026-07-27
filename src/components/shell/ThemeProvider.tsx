'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';
export type Density = 'compact' | 'comfortable';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  density: Density;
  setDensity: (density: Density) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const THEME_STORAGE_KEY = 'astra.theme';
export const DENSITY_STORAGE_KEY = 'astra.density';

/**
 * Runs before first paint to stamp data-theme / data-density on <html>,
 * so a dark-mode user never sees a white flash. Injected as a blocking
 * inline script in the root layout.
 */
export const THEME_INIT_SCRIPT = `
(function(){try{
  var t=localStorage.getItem('${THEME_STORAGE_KEY}');
  if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
  document.documentElement.setAttribute('data-theme',t);
  var d=localStorage.getItem('${DENSITY_STORAGE_KEY}')||'compact';
  document.documentElement.setAttribute('data-density',d);
}catch(e){
  document.documentElement.setAttribute('data-theme','light');
  document.documentElement.setAttribute('data-density','compact');
}})();
`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initial state matches what THEME_INIT_SCRIPT already stamped, so the
  // first client render agrees with the server HTML.
  const [theme, setThemeState] = useState<Theme>('light');
  const [density, setDensityState] = useState<Density>('compact');

  useEffect(() => {
    const root = document.documentElement;
    setThemeState((root.getAttribute('data-theme') as Theme) ?? 'light');
    setDensityState((root.getAttribute('data-density') as Density) ?? 'compact');
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* private mode — the theme still applies for this session */
    }
  }, []);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    if (next === 'compact') document.documentElement.setAttribute('data-density', 'compact');
    else document.documentElement.removeAttribute('data-density');
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, density, setDensity }),
    [theme, setTheme, toggleTheme, density, setDensity],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}
