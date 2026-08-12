import { createContext, useContext } from "react";
import type { SaveState } from "../preferences/PreferencesContext";

/**
 * ThemeContext.ts — the theme value, the theme list, and how a theme is applied.
 *
 * No JSX here; the provider component lives in ThemeProvider.tsx. Same reason
 * as the auth context: files that export only components (or only
 * non-components) keep React Fast Refresh reliable.
 */

/**
 * The themes offered in the picker.
 *
 * This list must stay in step with two other places:
 *   - the `themes:` list in index.css, which controls what CSS is bundled
 *   - AVAILABLE_THEMES in server/src/routes/preferences.ts, which validates
 *
 * Three copies is not ideal, and it's a fair question why. The honest answer is
 * that each needs something different: the CSS needs build-time names, the
 * server needs an allowlist it can trust, and this needs human labels. The
 * server's copy is the one that matters — a client can be modified by its user,
 * so the server can never simply trust what it's told. If this list grows much
 * further, a shared package is the fix.
 */
export const THEMES = [
  { value: "system", label: "Match system" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "cupcake", label: "Cupcake" },
  { value: "nord", label: "Nord" },
  { value: "forest", label: "Forest" },
  { value: "dracula", label: "Dracula" },
  { value: "retro", label: "Retro" },
  { value: "synthwave", label: "Synthwave" },
] as const;

/**
 * The union type "system" | "light" | "dark" | ... derived from the array
 * above, rather than written out by hand.
 *
 * `as const` on the array makes TypeScript treat those strings as exact literal
 * values instead of widening them to `string`. This line then extracts them.
 * The benefit is that adding a theme to the array automatically updates the
 * type — no second place to remember.
 */
export type Theme = (typeof THEMES)[number]["value"];

/** The localStorage key. Must match the inline script in index.html. */
export const THEME_STORAGE_KEY = "focus-theme";

/**
 * Apply a theme to the page immediately.
 *
 * This is deliberately a plain function that reaches out and mutates the DOM,
 * which is normally something to avoid in React. It's justified here because
 * <html> lives *above* React's root element — React only manages what's inside
 * #root, so it cannot set this attribute for us.
 *
 * "system" removes the attribute entirely rather than setting a value, which
 * hands control back to the --default / --prefersdark markers in index.css and
 * lets the OS setting decide.
 */
export function applyTheme(theme: Theme): void {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

/** Read the cached theme, tolerating unavailable or corrupted storage. */
export function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    // Validate rather than trust. localStorage is editable by the user and
    // persists across deploys, so it can easily hold a theme we removed.
    if (stored && THEMES.some((t) => t.value === stored)) {
      return stored as Theme;
    }
  } catch {
    // Storage unavailable (Safari private mode, blocked cookies).
  }
  return "system";
}

/**
 * Save status now lives with the preferences owner, since it applies to every
 * setting rather than to the theme specifically. Re-exported here so existing
 * theme code doesn't need to know where it moved to.
 *
 * It exists because of a real incident in chunk 4b: a broken endpoint silently
 * rejected a dozen theme changes while the UI looked perfectly fine. Optimistic
 * updates are right for something this cheap to re-apply, but "optimistic" must
 * not mean "hides failure."
 *
 * (This import and the `Theme` import in PreferencesContext.ts point at each
 * other. That's safe because both are type-only, and types are erased before
 * the code runs — there's no cycle at runtime. A cycle of *values* would be a
 * real problem.)
 */
export type { SaveState } from "../preferences/PreferencesContext";

export type ThemeContextValue = {
  theme: Theme;
  /** Change the theme: applies it, caches it, and saves it to the account. */
  setTheme: (theme: Theme) => void;
  /** Status of the last attempt to save to the server. */
  saveState: SaveState;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside a <ThemeProvider>.");
  }
  return context;
}
