import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import {
  ThemeContext,
  THEME_STORAGE_KEY,
  applyTheme,
  readStoredTheme,
  type SaveState,
  type Theme,
  type ThemeContextValue,
} from "./ThemeContext";

/**
 * ThemeProvider — keeps the theme in three places agreeing with each other.
 *
 * There are three copies of "the current theme", and understanding why is the
 * heart of this file:
 *
 *   1. The <html data-theme> attribute — what you actually see.
 *   2. localStorage — a cache, so the next page load is instant (applied by the
 *      inline script in index.html before React exists).
 *   3. The server — the real source of truth, so the setting follows you to
 *      other devices.
 *
 * The rules that keep them consistent:
 *
 *   - On load, trust the cache. It's already applied; anything else means a
 *     flash.
 *   - Once signed in, ask the server. If it disagrees, the server wins — it
 *     knows about the change you made on your phone; localStorage doesn't.
 *   - On change, update all three, applying locally first so the UI is instant
 *     and never waits for the network.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  /**
   * Initialised from localStorage via a function.
   *
   * Passing a function to useState makes it *lazy* — it runs only on the first
   * render. Writing `useState(readStoredTheme())` instead would call
   * localStorage on every single render and throw the result away, which is
   * wasteful and a genuinely common mistake.
   */
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  /** Whether the last save reached the server. See SaveState in ThemeContext. */
  const [saveState, setSaveState] = useState<SaveState>("idle");

  /**
   * Tracks which user we've already synced from, so we sync once per sign-in
   * rather than on every render where `user` happens to be defined.
   *
   * A ref rather than state because changing it must NOT trigger a re-render —
   * it's bookkeeping about what already happened, not something the UI shows.
   * That distinction is the main reason useRef exists.
   */
  const syncedForUser = useRef<string | null>(null);

  /**
   * When someone signs in, adopt the theme stored on their account.
   *
   * This is what makes the setting follow you between devices, and what
   * corrects the cache when it's stale.
   */
  useEffect(() => {
    if (!user) {
      // Signed out. Reset the marker so signing back in re-syncs. The theme
      // itself stays as-is — a signed-out visitor should still see the theme
      // they picked, not get snapped back to default.
      syncedForUser.current = null;
      return;
    }

    if (syncedForUser.current === user.id) return;
    syncedForUser.current = user.id;

    let active = true;

    async function syncFromServer() {
      try {
        const data = await api.get<{ preferences: { theme: Theme } }>(
          "/api/preferences",
        );
        if (!active) return;

        const serverTheme = data.preferences.theme;

        // Only touch anything if the server actually disagrees. Skipping the
        // no-op is what keeps the common case (they match) completely free.
        if (serverTheme !== theme) {
          applyTheme(serverTheme);
          setThemeState(serverTheme);
          try {
            localStorage.setItem(THEME_STORAGE_KEY, serverTheme);
          } catch {
            // Storage unavailable — the theme still works this session.
          }
        }
      } catch (error) {
        // A failed sync is not worth bothering the user about: they still have
        // a working theme from the cache. Log it and move on.
        console.error("[theme] Could not load saved theme:", error);
      }
    }

    void syncFromServer();

    return () => {
      active = false;
    };
    // `theme` is deliberately not a dependency. Including it would re-run this
    // whenever the theme changed — including changes this effect itself made,
    // and changes the user made by hand, immediately overwriting them with the
    // server's value. We only want this to run when the *user* changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /**
   * Change the theme.
   *
   * Note the order: the DOM and the cache update synchronously, and only then
   * do we tell the server. The UI must never wait for a network round trip to
   * repaint — a theme click that takes 200ms to visibly happen feels broken.
   *
   * This is an *optimistic* update: we assume the save will succeed. If it
   * doesn't, the visible theme is still correct and still cached, so the only
   * casualty is cross-device sync. Rolling the colour back to punish a failed
   * request would be worse than leaving it.
   */
  const setTheme = useCallback(
    (next: Theme) => {
      applyTheme(next);
      setThemeState(next);

      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Storage unavailable — the theme still applies for this session.
      }

      // Only signed-in users have an account to save to. Signed out, the theme
      // still works — it's just local to this browser.
      if (!user) {
        setSaveState("idle");
        return;
      }

      setSaveState("saving");

      void api
        .patch("/api/preferences", { theme: next })
        .then(() => {
          setSaveState("saved");
        })
        .catch((error) => {
          // Surface this. The theme still looks right, so without a visible
          // signal the user has no way to know it didn't sync to their account.
          console.error("[theme] Could not save theme:", error);
          setSaveState("error");
        });
    },
    [user],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, saveState }),
    [theme, setTheme, saveState],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
