import { createContext, useContext } from "react";
import type { Theme } from "../theme/ThemeContext";

/**
 * PreferencesContext.ts — the single owner of everything stored in
 * user_preferences.
 *
 * ## Why this exists
 *
 * ThemeProvider used to fetch /api/preferences itself. That was fine while the
 * theme was the only setting. The moment the timer also needed data from that
 * endpoint, we'd have had two components fetching the same resource
 * independently — two network requests on load, and two copies of the same
 * state that can drift apart. Save a setting through one and the other doesn't
 * know.
 *
 * So preferences get one owner. ThemeProvider and TimerProvider both read from
 * here rather than talking to the server themselves.
 *
 * This is worth recognising as a general shape: **when two parts of an app need
 * the same server data, the fix is a shared owner, not a second fetch.** It's
 * the same reasoning as the single Prisma client on the server.
 */

export type Preferences = {
  theme: Theme;
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
};

/**
 * Used before the server responds, and for signed-out users.
 *
 * These duplicate DEFAULT_PREFERENCES in server/src/routes/preferences.ts,
 * which duplicate the @default values in schema.prisma. Three copies is a
 * genuine smell — the honest reason is that each is consulted at a different
 * moment: the database's when a row is created, the server's when there's no
 * row, and this one before any answer has arrived. If they ever disagree, the
 * database's value is the one that's real.
 */
export const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

/** Status of the last attempt to save. See the note in ThemeContext.ts. */
export type SaveState = "idle" | "saving" | "saved" | "error";

export type PreferencesContextValue = {
  preferences: Preferences;

  /**
   * True once we've heard back from the server.
   *
   * Consumers need this to distinguish "the default, because that's what's
   * saved" from "the default, because we haven't asked yet." ThemeProvider
   * depends on the difference: applying an unloaded default would stomp on the
   * theme the pre-paint script already applied from cache.
   */
  loaded: boolean;

  /** Change some settings. Applies locally at once, saves in the background. */
  updatePreferences: (patch: Partial<Preferences>) => void;

  saveState: SaveState;

  /** Per-field messages from the server when a save is rejected. */
  fieldErrors: Record<string, string>;
};

export const PreferencesContext =
  createContext<PreferencesContextValue | null>(null);

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used inside a <PreferencesProvider>.");
  }
  return context;
}
