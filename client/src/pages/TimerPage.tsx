import { Link } from "react-router-dom";
import { useTimer } from "../timer/TimerContext";
import { PHASE_LABELS, formatDuration } from "../timer/timerLogic";
import { useFocusMode } from "../focus/useFocusMode";
import { getAddon } from "../addons";

/**
 * A summary of what Focus Mode is doing, on the page where you'd look for it.
 *
 * Three states, because "nothing is hidden" and "things are hidden but the
 * session isn't running" mean different things to someone deciding whether the
 * feature is working.
 */
function FocusModeStatus() {
  const { isActive, hiddenKeys, hasRestrictions } = useFocusMode();

  if (!hasRestrictions) {
    return (
      <div className="text-xs text-base-content/50 text-center">
        Focus Mode isn't hiding anything yet —{" "}
        <Link to="/settings" className="link">
          choose what to put away
        </Link>
        .
      </div>
    );
  }

  const names = [...hiddenKeys]
    .map((key) => getAddon(key)?.label ?? key)
    .join(" and ");

  return (
    <div
      className={`alert text-sm ${isActive ? "alert-info" : ""}`}
      role="status"
    >
      <span>
        {isActive
          ? `Focus Mode is on — ${names} ${hiddenKeys.size === 1 ? "is" : "are"} hidden. Pause to bring ${hiddenKeys.size === 1 ? "it" : "them"} back.`
          : `${names} will be hidden once a focus session starts.`}
      </span>
    </div>
  );
}

/**
 * TimerPage — the Pomodoro timer.
 *
 * Note how little this component does. All the timing logic lives in
 * timerLogic.ts and TimerProvider.tsx; this reads values and renders them.
 * That separation is what lets the timer keep running when you navigate away —
 * if the state lived here, leaving the page would destroy it.
 */
export function TimerPage() {
  const {
    phase,
    status,
    remainingMs,
    totalMs,
    completedWorkSessions,
    sessionsBeforeLongBreak,
    justCompleted,
    start,
    pause,
    reset,
    skip,
  } = useTimer();

  /**
   * Fraction of the phase elapsed, 0 to 1.
   *
   * Derived at render time rather than stored, for the same reason the
   * remaining time is: anything computable from the source of truth should be
   * computed, not maintained.
   */
  const progress = totalMs > 0 ? 1 - remainingMs / totalMs : 0;

  /** Work phases are the serious ones; breaks get a friendlier colour. */
  const accent = phase === "work" ? "text-primary" : "text-success";
  const progressColor =
    phase === "work" ? "progress-primary" : "progress-success";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Timer</h1>
        <p className="text-base-content/70 text-sm mt-1">
          Keeps running while you use the rest of the app.
        </p>
      </div>

      <section className="card bg-base-100 shadow">
        <div className="card-body items-center text-center">
          {/* Which phase we're in */}
          <div className={`badge badge-lg ${phase === "work" ? "badge-primary" : "badge-success"}`}>
            {PHASE_LABELS[phase]}
          </div>

          {/*
            The countdown.

            `tabular-nums` makes every digit the same width. Without it,
            proportional digits shift the text around as numbers change — a "1"
            is narrower than an "8" — and the whole display jitters once a
            second. A small thing you notice immediately once you know to look.
          */}
          <div
            className={`text-7xl font-bold tabular-nums my-4 ${accent}`}
            // Announce politely: screen readers mention updates at a natural
            // pause rather than interrupting. Without a live region the
            // countdown would change silently; with an assertive one it would
            // interrupt constantly.
            aria-live="polite"
            aria-atomic="true"
          >
            {formatDuration(remainingMs)}
          </div>

          <progress
            className={`progress ${progressColor} w-full max-w-sm`}
            value={progress}
            max={1}
            aria-label={`${PHASE_LABELS[phase]} progress`}
          />

          {/* Completion prompt. Explains why the timer stopped, and what's next. */}
          {justCompleted && (
            <div role="status" className="alert alert-success mt-4 text-sm">
              <span>
                Time's up — ready to start your {PHASE_LABELS[phase].toLowerCase()}?
              </span>
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap gap-2 justify-center mt-6">
            {status === "running" ? (
              <button type="button" className="btn btn-primary" onClick={pause}>
                Pause
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={start}>
                {status === "paused" ? "Resume" : "Start"}
              </button>
            )}

            <button
              type="button"
              className="btn btn-ghost"
              onClick={reset}
              // Nothing to reset on a fresh, untouched phase.
              disabled={status === "idle" && remainingMs === totalMs}
            >
              Reset
            </button>

            <button type="button" className="btn btn-ghost" onClick={skip}>
              Skip
            </button>
          </div>
        </div>
      </section>

      {/* Cycle progress */}
      <section className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-base">This cycle</h2>
          <p className="text-sm text-base-content/70">
            A long break comes after {sessionsBeforeLongBreak} focus
            sessions.
          </p>

          <div className="flex gap-2 mt-3" aria-hidden="true">
            {/*
              Array.from({ length: n }) is the idiomatic way to render N of
              something — JavaScript has no range syntax, and this avoids the
              trap that `new Array(4).map(...)` silently does nothing (the slots
              are empty rather than undefined, so map skips them).
            */}
            {Array.from({ length: sessionsBeforeLongBreak }).map((_, i) => (
              <span
                key={i}
                className={`h-3 flex-1 rounded-full ${
                  i < completedWorkSessions % sessionsBeforeLongBreak ||
                  (completedWorkSessions > 0 &&
                    completedWorkSessions % sessionsBeforeLongBreak === 0 &&
                    phase === "longBreak")
                    ? "bg-primary"
                    : "bg-base-300"
                }`}
              />
            ))}
          </div>

          {/* The same information as text, for screen readers and for anyone
              who'd rather read a number than count dots. */}
          <p className="text-sm mt-2">
            {completedWorkSessions} focus{" "}
            {completedWorkSessions === 1 ? "session" : "sessions"} completed
          </p>
        </div>
      </section>

      <FocusModeStatus />

      <p className="text-xs text-base-content/50 text-center">
        Change these durations in Settings.
      </p>
    </div>
  );
}
