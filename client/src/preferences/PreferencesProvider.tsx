import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import {
  DEFAULT_PREFERENCES,
  PreferencesContext,
  type Preferences,
  type PreferencesContextValue,
  type SaveState,
} from "./PreferencesContext";

/**
 * PreferencesProvider — loads settings once per sign-in and saves changes.
 *
 * Everything that reads or writes user_preferences goes through here.
 */
export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  const [preferences, setPreferences] =
    useState<Preferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /**
   * Which user we've already loaded for.
   *
   * A ref, not state, because changing it must not cause a re-render — it's a
   * record of what happened, not something displayed.
   */
  const loadedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      // Signed out: forget everything and go back to defaults. Leaving the
      // previous user's settings in memory would mean the next person to sign
      // in on this browser briefly sees someone else's configuration.
      loadedForUser.current = null;
      setPreferences(DEFAULT_PREFERENCES);
      setLoaded(false);
      return;
    }

    if (loadedForUser.current === user.id) return;
    loadedForUser.current = user.id;

    let active = true;

    async function load() {
      try {
        const data = await api.get<{ preferences: Preferences }>(
          "/api/preferences",
        );
        if (!active) return;
        setPreferences(data.preferences);
      } catch (error) {
        console.error("[preferences] Could not load:", error);
        // Keep the defaults. The app stays usable; settings just won't reflect
        // what's saved until the next successful load.
      } finally {
        if (active) setLoaded(true);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [user]);

  /**
   * Apply a partial change locally, then save it.
   *
   * Optimistic: the UI updates immediately and we assume the save works. That's
   * right for settings, where the change is cheap to re-apply and waiting on
   * the network would make every toggle feel sluggish.
   *
   * What we do NOT do is hide failure — that was the mistake caught in chunk
   * 4b. `saveState` and `fieldErrors` exist so the UI can say when a change
   * didn't reach the server.
   *
   * Note we don't roll back on failure. If the server rejects a 500-minute
   * focus phase, the local value stays until the next load. That's deliberate:
   * yanking the input out from under someone mid-edit is more confusing than
   * showing them the error and letting them fix it.
   */
  const updatePreferences = useCallback(
    (patch: Partial<Preferences>) => {
      setPreferences((current) => ({ ...current, ...patch }));
      setFieldErrors({});

      if (!user) {
        // Signed out, nothing to save to. The change still applies locally.
        setSaveState("idle");
        return;
      }

      setSaveState("saving");

      void api
        .patch<{ preferences: Preferences }>("/api/preferences", patch)
        .then((data) => {
          // Adopt the server's response rather than assuming our optimistic
          // value was accepted verbatim. If it ever normalises a value, this is
          // what keeps the client honest about what was actually stored.
          setPreferences(data.preferences);
          setSaveState("saved");
        })
        .catch((error) => {
          console.error("[preferences] Could not save:", error);
          if (error instanceof ApiError) setFieldErrors(error.fields);
          setSaveState("error");
        });
    },
    [user],
  );

  const value = useMemo<PreferencesContextValue>(
    () => ({ preferences, loaded, updatePreferences, saveState, fieldErrors }),
    [preferences, loaded, updatePreferences, saveState, fieldErrors],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}
