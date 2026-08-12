import { useEffect } from "react";
import { useTimer } from "./TimerContext";
import { PHASE_LABELS, formatDuration } from "./timerLogic";

const BASE_TITLE = "Focus Tool";

/**
 * useDocumentTitle — puts the countdown in the browser tab.
 *
 * Small feature, disproportionate payoff. The reason you switch away from this
 * tab is to do the work the timer is counting — so the moment the timer is most
 * useful is precisely when you cannot see it. The tab title is visible from
 * whatever you switched to.
 *
 * It also sidesteps the background-throttling problem completely. We don't need
 * the tab to update smoothly while hidden; browsers still render the title, and
 * our derived time is correct whenever we do get a tick.
 *
 * This is a hook rather than a component because it renders nothing — it only
 * performs an effect. A component that returns null to do side work is a
 * common shape, but a hook says what it is.
 */
export function useDocumentTitle(): void {
  const { phase, status, remainingMs } = useTimer();

  useEffect(() => {
    if (status === "running") {
      // e.g. "24:12 · Focus — Focus Tool"
      document.title = `${formatDuration(remainingMs)} · ${PHASE_LABELS[phase]} — ${BASE_TITLE}`;
    } else if (status === "paused") {
      document.title = `Paused · ${formatDuration(remainingMs)} — ${BASE_TITLE}`;
    } else {
      document.title = BASE_TITLE;
    }

    // Restore the plain title when this unmounts — on sign-out, say. Without
    // the cleanup the tab would be stuck showing a countdown for a timer that
    // no longer exists.
    return () => {
      document.title = BASE_TITLE;
    };
  }, [phase, status, remainingMs]);
}
