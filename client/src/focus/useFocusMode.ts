import { useMemo } from "react";
import { usePreferences } from "../preferences/PreferencesContext";
import { useTimer } from "../timer/TimerContext";
import { getAddon } from "../addons";

/**
 * useFocusMode — is Focus Mode on, and what does it hide?
 *
 * ## Why this is a hook and not a provider
 *
 * Every other piece of shared state in this app got a context and a provider.
 * This one doesn't, because it stores nothing. Focus Mode is entirely
 * *derived*: it's true when a focus phase is running, and the hidden set is
 * whatever the user saved. Both inputs already live in contexts.
 *
 * Giving it its own provider would mean copying those values into a third place
 * that has to be kept in sync — inventing exactly the drift problem that made
 * us consolidate preferences in chunk 5b. Derived state should be computed, not
 * stored. Same principle as the timer computing its remaining time rather than
 * counting it down.
 *
 * ## What Focus Mode honestly is
 *
 * It hides parts of *this app*. It cannot block Discord, YouTube, or your
 * phone — browsers deliberately forbid that, and any tool claiming otherwise is
 * either a browser extension or lying.
 *
 * So this is about shaping your workspace, not enforcing abstinence. Pausing
 * the timer turns it off, which makes leaving a deliberate act rather than an
 * impossible one. That's the honest ceiling for a web app, and designing to it
 * beats pretending otherwise.
 */
export function useFocusMode() {
  const { phase, status } = useTimer();
  const { preferences } = usePreferences();

  /**
   * Active only while a focus phase is actually running.
   *
   * Paused counts as off, deliberately — pausing is the escape hatch. Breaks
   * are off because a break you can't use is not a break.
   */
  const isActive = status === "running" && phase === "work";

  const hiddenKeys = useMemo(() => {
    // A Set for O(1) lookups, and because the stored array might contain
    // duplicates if it were ever written by hand.
    return new Set(
      preferences.focusHiddenAddons.filter((key) => {
        const addon = getAddon(key);
        // Ignore keys we don't recognise (an add-on removed or renamed since
        // this was saved) and any that shouldn't be restrictable — a stored
        // "timer" would otherwise hide the exit.
        return addon?.restrictable === true;
      }),
    );
  }, [preferences.focusHiddenAddons]);

  /** Should this add-on be hidden right now? */
  function isHidden(addonKey: string): boolean {
    return isActive && hiddenKeys.has(addonKey);
  }

  return {
    isActive,
    /** Keys the user has chosen to hide, regardless of whether it's on now. */
    hiddenKeys,
    isHidden,
    /** True if the user has configured anything to hide at all. */
    hasRestrictions: hiddenKeys.size > 0,
  };
}
