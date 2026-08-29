import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemePref = 'light' | 'dark' | 'auto';

const KEY = 'brewlab.theme';

export function systemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function storedPref(): ThemePref {
  const raw = localStorage.getItem(KEY);
  return raw === 'light' || raw === 'dark' || raw === 'auto' ? raw : 'auto';
}

/** The attribute is always concrete, so the stylesheet needs one palette per theme. */
export function applyTheme(pref: ThemePref) {
  document.documentElement.dataset.theme = pref === 'auto' ? systemTheme() : pref;
}

interface ThemeState {
  pref: ThemePref;
  resolved: 'light' | 'dark';
  setPref: (p: ThemePref) => void;
}

const Ctx = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => storedPref());
  const [resolved, setResolved] = useState<'light' | 'dark'>(() =>
    pref === 'auto' ? systemTheme() : pref,
  );

  const setPref = useCallback((p: ThemePref) => {
    localStorage.setItem(KEY, p);
    setPrefState(p);
    setResolved(p === 'auto' ? systemTheme() : p);
    applyTheme(p);
  }, []);

  // On "auto", track the OS live rather than only at load.
  useEffect(() => {
    applyTheme(pref);
    if (pref !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      setResolved(systemTheme());
      applyTheme('auto');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);

  const value = useMemo<ThemeState>(() => ({ pref, resolved, setPref }), [pref, resolved, setPref]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
