// Theme (light/dark) – DESIGN-DARK.md § 1. The theme is the class "dark" on <html>; the choice is
// persisted in localStorage under "theme". Switching logs nothing.
import { create } from 'zustand';

export type Theme = 'light' | 'dark';

export const DEFAULT_THEME: Theme = 'light';
export const THEME_STORAGE_KEY = 'theme';

function readStoredTheme(): Theme | null {
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null;
    return stored === 'dark' || stored === 'light' ? stored : null;
  } catch {
    return null;
  }
}

/** Puts the theme on <html> and stores it. */
export function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable (private mode): the theme still applies for the session.
  }
}

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

/** A stored value wins over the default on load. */
export const useTheme = create<ThemeStore>()((set, get) => ({
  theme: readStoredTheme() ?? DEFAULT_THEME,
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}));

/** Applies the initial theme before the first render. */
export function initTheme(): void {
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('dark', useTheme.getState().theme === 'dark');
}

/** Resolves a colour token (e.g. "--color-primary") to its computed value, for canvases that need a literal colour (the map). */
export function cssColor(token: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}
