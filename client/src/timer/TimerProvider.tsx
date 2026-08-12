import { useCallback, useEffect, useMemo, useState } from "react";
import { TimerContext, type TimerContextValue } from "./TimerContext";
import {
  DURATIONS_MS,
  advancePhase,
  createInitialState,
  getRemainingMs,
  pause as pauseState,
  reset as resetState,
  start as startState,
  type TimerState,
} from "./timerLogic";

/**
 * TimerProvider — connects the pure state machine in timerLogic.ts to React.
 *
 * Everything here is about the messy edges the pure logic deliberately avoids:
 * when to re-render, surviving a page reload, and noticing that a phase ended
 * while nobody was looking.
 */

const STORAGE_KEY = "focus-timer";

/**
 * How often we re-render while running.
 *
 * 250ms, not 1000ms — and it isn't about smoothness. With a one-second
 * interval, the tick and the actual second boundary drift apart, so the display
 * can sit on the same number for nearly two seconds and then skip one. Checking
 * four times a second means we always catch the boundary within 250ms, and the
 * countdown looks steady.
 *
 * This is cheap precisely because ticking does no work beyond a re-render — the
 * time itself is derived from Date.now(), not counted.
 */
const TICK_INTERVAL_MS = 250;

/**
 * Restore a saved timer, if there is one.
 *
 * Worth doing because an accidental refresh mid-session shouldn't cost you the
 * session. And it's nearly free: because a running timer's truth is an *end
 * instant* rather than a countdown, a state saved twenty minutes ago is still
 * correct when reloaded. A subtract-based timer couldn't do this at all — it
 * would have no idea how much time passed while the page was closed.
 */
function loadPersistedState(): TimerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();

    const parsed = JSON.parse(raw) as TimerState;

    // Validate before trusting. This came from localStorage, which the user can
    // edit and which survives across deploys — so it may be from an older
    // version of this code with a different shape.
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !(parsed.phase in DURATIONS_MS) ||
      typeof parsed.remainingMs !== "number"
    ) {
      return createInitialState();
    }

    return parsed;
  } catch {
    // Unavailable or unparseable — start fresh rather than break the page.
    return createInitialState();
  }
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TimerState>(loadPersistedState);

  /**
   * A counter whose only purpose is to force a re-render.
   *
   * This looks odd, and it's a direct consequence of the derive-don't-
   * accumulate design. There is no countdown value in state to update — the
   * remaining time is computed fresh from Date.now() during render. So the tick
   * doesn't need to change any data; it just needs to make React render again.
   *
   * Incrementing a number nobody reads is the standard way to say that.
   */
  const [, forceRender] = useState(0);

  /** True once a running phase hits zero, until the user moves on. */
  const [justCompleted, setJustCompleted] = useState(false);

  /**
   * The ticking loop. Only runs while the timer is running — a paused or idle
   * timer has nothing to update, and an interval doing nothing is just battery
   * drain.
   */
  useEffect(() => {
    if (state.status !== "running") return;

    const id = setInterval(() => {
      forceRender((n) => n + 1);
    }, TICK_INTERVAL_MS);

    // Cleanup. Without this, changing status would start a second interval
    // while the first kept running — the classic leak, and it compounds every
    // time the effect re-runs.
    return () => clearInterval(id);
  }, [state.status]);

  /**
   * Re-render immediately when the tab becomes visible again.
   *
   * While hidden, the browser throttles our interval to roughly once a minute.
   * The computed time stays correct — that's the whole point of the design —
   * but you might stare at a stale display for up to a minute after switching
   * back. This listener fires the instant the tab is shown, so the first thing
   * you see is already up to date.
   *
   * Note this fixes a *display* latency, not a correctness problem. Without it
   * the timer would still be right, just briefly slow to say so.
   */
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        forceRender((n) => n + 1);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Computed during render, never stored. The single source of truth for what's
  // on screen.
  const remainingMs = getRemainingMs(state, Date.now());

  /**
   * Notice when the phase has ended.
   *
   * This runs after render, once remainingMs has reached 0. Because
   * advancePhase returns a stopped state, this can't loop — the new state isn't
   * "running", so the condition immediately stops being true.
   *
   * The phase may well have ended while the tab was hidden. That's handled by
   * the same code path with no special casing: whenever we next render, the
   * computed remaining is 0 and we advance. There's no "catch up" logic because
   * there's nothing to catch up on.
   */
  useEffect(() => {
    if (state.status === "running" && remainingMs <= 0) {
      setState((current) => advancePhase(current));
      setJustCompleted(true);
    }
  }, [state.status, remainingMs]);

  /** Persist on every change, so a reload can pick up where we left off. */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable — the timer still works, it just won't survive a
      // reload. Not worth interrupting the user over.
    }
  }, [state]);

  const start = useCallback(() => {
    setJustCompleted(false);
    setState((current) => startState(current, Date.now()));
  }, []);

  const pause = useCallback(() => {
    setState((current) => pauseState(current, Date.now()));
  }, []);

  const reset = useCallback(() => {
    setJustCompleted(false);
    setState((current) => resetState(current));
  }, []);

  const skip = useCallback(() => {
    setJustCompleted(false);
    setState((current) => advancePhase(current));
  }, []);

  const value = useMemo<TimerContextValue>(
    () => ({
      phase: state.phase,
      status: state.status,
      remainingMs,
      totalMs: DURATIONS_MS[state.phase],
      completedWorkSessions: state.completedWorkSessions,
      justCompleted,
      start,
      pause,
      reset,
      skip,
    }),
    [state, remainingMs, justCompleted, start, pause, reset, skip],
  );

  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
}
