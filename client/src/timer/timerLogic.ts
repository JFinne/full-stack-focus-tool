/**
 * timerLogic.ts — the Pomodoro state machine, as pure functions.
 *
 * There is no React in this file, and that's deliberate. Every function here
 * takes a state and returns a new one, with no side effects and no dependency
 * on anything outside its arguments. That means you can reason about the timer
 * — and eventually test it — without rendering anything or waiting for real
 * time to pass.
 *
 * ============================================================================
 * THE CENTRAL IDEA: derive, don't accumulate
 * ============================================================================
 *
 * The obvious way to build a countdown is to tick once a second and subtract:
 *
 *     setInterval(() => { remaining = remaining - 1000 }, 1000)
 *
 * That is wrong, in two ways that both matter for a study tool.
 *
 * 1. DRIFT. setInterval does not promise to fire on time — it promises not to
 *    fire *early*. Each tick arrives a millisecond or three late, and because
 *    each subtraction is based on the previous one, those delays accumulate.
 *    Over a 25-minute session the error is small but real, and it only ever
 *    runs one direction: slow.
 *
 * 2. BACKGROUND THROTTLING, which is the serious one. Browsers deliberately
 *    slow timers in hidden tabs to save battery — typically to once per minute,
 *    sometimes stopping them entirely. So switch to another tab for 20 minutes
 *    and a subtract-based timer might tick twenty times instead of twelve
 *    hundred. You come back and it thinks 20 seconds have passed.
 *
 *    For this app that's fatal. Switching tabs is exactly what you do while
 *    working.
 *
 * The fix is to stop treating elapsed time as something we count, and start
 * treating it as something we *look up*. When the timer starts we record the
 * wall-clock instant it should end (`endsAt`). Every render computes:
 *
 *     remaining = endsAt - Date.now()
 *
 * Now ticking has exactly one job: cause a re-render so the display refreshes.
 * If a tick is late, or fifty ticks are skipped while the tab was hidden, the
 * next one still computes the correct answer, because the answer never depended
 * on the ticks in the first place.
 *
 * This is a broadly useful pattern: when something can be *derived* from a
 * source of truth, derive it. State you maintain by hand is state that can
 * drift out of sync with reality.
 */

/** Which part of the cycle we're in. */
export type Phase = "work" | "shortBreak" | "longBreak";

/** What the timer is doing. */
export type Status = "idle" | "running" | "paused";

export type TimerState = {
  phase: Phase;
  status: Status;

  /**
   * The wall-clock time this phase ends, as epoch milliseconds.
   *
   * Only meaningful while running. This is the source of truth for a running
   * timer — everything shown on screen is computed from it.
   */
  endsAt: number | null;

  /**
   * Milliseconds left, used when NOT running.
   *
   * Two fields for "how much time is left" looks redundant, but they answer
   * different questions. While running, the truth is an *end instant* that
   * stays correct no matter how long we're not looking. While paused, there is
   * no end instant — the clock isn't moving — so the truth is a *duration*.
   *
   * Pausing converts one into the other: `remainingMs = endsAt - now`.
   * Resuming converts back: `endsAt = now + remainingMs`.
   */
  remainingMs: number;

  /**
   * Work sessions finished in this cycle. Drives when a long break is due, and
   * resets after each long break.
   */
  completedWorkSessions: number;
};

/**
 * The user's timer settings, in minutes.
 *
 * These used to be module-level constants. Now that they're configurable they
 * are *passed in* to every function that needs them, rather than read from
 * module scope.
 *
 * That change is what keeps this file pure. A function reading a mutable module
 * variable produces different results at different times for the same
 * arguments, which makes it untestable in exactly the way `Date.now()` did — so
 * durations get the same treatment as the clock: they're an input, not
 * something the function reaches out for.
 */
export type TimerConfig = {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
};

/** The classic Pomodoro numbers, used until the user's settings arrive. */
export const DEFAULT_TIMER_CONFIG: TimerConfig = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

/** How long a phase lasts, in milliseconds. */
export function phaseDurationMs(config: TimerConfig, phase: Phase): number {
  const minutes =
    phase === "work"
      ? config.workMinutes
      : phase === "shortBreak"
        ? config.shortBreakMinutes
        : config.longBreakMinutes;

  return minutes * 60 * 1000;
}

/** The three phase names, for validating restored state. */
export const PHASES: readonly Phase[] = ["work", "shortBreak", "longBreak"];

/** Human labels, kept next to the logic they describe. */
export const PHASE_LABELS: Record<Phase, string> = {
  work: "Focus",
  shortBreak: "Short break",
  longBreak: "Long break",
};

/** A fresh timer, ready to start a work session. */
export function createInitialState(config: TimerConfig): TimerState {
  return {
    phase: "work",
    status: "idle",
    endsAt: null,
    remainingMs: phaseDurationMs(config, "work"),
    completedWorkSessions: 0,
  };
}

/**
 * How much time is left right now.
 *
 * The single place that decides which of the two fields to read. Everything
 * displayed goes through here, so there's no chance of one component reading
 * `remainingMs` while another reads `endsAt` and the two disagreeing.
 *
 * `now` is passed in rather than read from Date.now() inside, which keeps this
 * function pure — same inputs, same output, always. That's what makes it
 * testable without waiting for real time to elapse.
 */
export function getRemainingMs(state: TimerState, now: number): number {
  if (state.status === "running" && state.endsAt !== null) {
    // Never report negative time. Once it hits zero the phase is over, and the
    // provider notices and advances.
    return Math.max(0, state.endsAt - now);
  }
  return state.remainingMs;
}

/** Start (or restart) the current phase from wherever it's paused. */
export function start(state: TimerState, now: number): TimerState {
  if (state.status === "running") return state;

  return {
    ...state,
    status: "running",
    // Converting a duration into an end instant — the "resume" half of the
    // pairing described on remainingMs above.
    endsAt: now + state.remainingMs,
  };
}

/** Pause, freezing the remaining time. */
export function pause(state: TimerState, now: number): TimerState {
  if (state.status !== "running") return state;

  return {
    ...state,
    status: "paused",
    // Converting an end instant back into a duration.
    remainingMs: getRemainingMs(state, now),
    endsAt: null,
  };
}

/** Return the current phase to its full duration, stopped. */
export function reset(state: TimerState, config: TimerConfig): TimerState {
  return {
    ...state,
    status: "idle",
    endsAt: null,
    remainingMs: phaseDurationMs(config, state.phase),
  };
}

/**
 * Which phase follows this one.
 *
 * After work: a long break if we've hit the threshold, otherwise a short one.
 * After any break: back to work.
 */
export function getNextPhase(state: TimerState, config: TimerConfig): Phase {
  if (state.phase !== "work") return "work";

  const completed = state.completedWorkSessions + 1;
  return completed % config.sessionsBeforeLongBreak === 0
    ? "longBreak"
    : "shortBreak";
}

/**
 * Move to the next phase.
 *
 * Used both when a phase finishes naturally and when the user skips.
 *
 * ## Why the next phase does NOT start automatically
 *
 * Many Pomodoro apps roll straight into the break. That's pleasant when you're
 * watching, and wrong when you're not — and "not watching" is the normal case
 * for a timer.
 *
 * Because we derive from wall-clock time, a timer left running while you're
 * away in another tab is genuinely finished when you return. If phases
 * auto-started, we'd have to decide what happens when you come back after an
 * hour: did you take a break you never took? Did four whole cycles elapse? Any
 * answer involves inventing history.
 *
 * Landing in a stopped state avoids the question entirely. You return to
 * "Focus session complete — ready for a break", which is true regardless of how
 * long you were gone. The cost is one click; the benefit is that the timer
 * never claims you did something you didn't.
 *
 * `completedWorkSessions` only increments after actual work, so skipping a
 * break doesn't inflate your count.
 */
export function advancePhase(
  state: TimerState,
  config: TimerConfig,
): TimerState {
  const nextPhase = getNextPhase(state, config);

  const completedWorkSessions =
    state.phase === "work"
      ? state.completedWorkSessions + 1
      : state.completedWorkSessions;

  return {
    phase: nextPhase,
    status: "idle",
    endsAt: null,
    remainingMs: phaseDurationMs(config, nextPhase),
    // A finished long break closes the cycle, so the count starts over.
    completedWorkSessions:
      state.phase === "longBreak" ? 0 : completedWorkSessions,
  };
}

/**
 * Format milliseconds as M:SS or MM:SS.
 *
 * `Math.ceil` rather than `floor`, and the reason is worth knowing. With floor,
 * a timer starting at exactly 25:00 displays "24:59" almost immediately —
 * because 24 minutes 59.9 seconds floors to 24:59. Users read that as the timer
 * skipping a second at the start. Ceil shows "25:00" for the first moment and
 * reaches "0:00" exactly as time expires, which is what people expect.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
