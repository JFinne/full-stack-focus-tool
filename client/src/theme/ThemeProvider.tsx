import { useCallback, useEffect, useMemo, useState } from "react";
import { usePreferences } from "../preferences/PreferencesContext";
import {
  ThemeContext,
  THEME_STORAGE_KEY,
  applyTheme,
  readStoredTheme,
  type Theme,
  type ThemeContextValue,
} from "./ThemeContext";

/**
 * ThemeProvider — owns the *presentation* of the theme.
 *
 * It no longer talks to the server. PreferencesProvider does that, and this
 * reads from it. What's left here is everything specific to themes being
 * visual rather than just data:
 *
 *   - setting `data-theme` on <html>, which lives above React's root
 *   - keeping the localStorage cache the pre-paint script in index.html reads
 *
 * The three copies of the theme and the rules between them are unchanged: the
 * cache wins on load (so there's no flash), the server wins once loaded (so the
 * setting follows you between devices), and a change applies locally first.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { preferences, loaded, updatePreferences, saveState } =
    usePreferences();

  /**
   * The theme currently applied to the page.
   *
   * Seeded from localStorage, lazily — passing the function means it runs once,
   * on first render, rather than on every render.
   *
   * Why keep local state at all when preferences already hold a theme? Because
   * they answer different questions. `preferences.theme` is what the *server*
   * has (defaulting to "system" before it replies). This is what's *on screen*,
   * which before the server replies is whatever the pre-paint script applied.
   * Rendering straight from preferences would flash the default theme for the
   * few hundred milliseconds the request takes — the exact problem the inline
   * script exists to prevent.
   */
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  /**
   * Adopt the server's theme once it has actually arrived.
   *
   * `loaded` is what makes this safe. Without that check, the default "system"
   * would be applied on first render and stomp on the cached theme the inline
   * script already put in place.
   */
  useEffect(() => {
    if (!loaded) return;
    if (preferences.theme === theme) return;

    applyTheme(preferences.theme);
    setThemeState(preferences.theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preferences.theme);
    } catch {
      // Storage unavailable — the theme still applies for this session.
    }
    // `theme` is intentionally omitted. Including it would re-run this effect
    // on every theme change, including ones the user just made, immediately
    // reverting them to the server's value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, preferences.theme]);

  const setTheme = useCallback(
    (next: Theme) => {
      // Apply to the page and the cache synchronously. The UI must never wait
      // for a network round trip to repaint.
      applyTheme(next);
      setThemeState(next);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Storage unavailable.
      }

      // And let the preferences owner handle persisting it.
      updatePreferences({ theme: next });
    },
    [updatePreferences],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, saveState }),
    [theme, setTheme, saveState],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
