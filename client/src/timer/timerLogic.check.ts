/**
 * Verification of the timer state machine using simulated clocks.
 *
 * Run with:  npm run check:timer
 *
 * This is only possible because timerLogic.ts is pure — every function takes
 * `now` as an argument instead of calling Date.now() itself. That lets us
 * fast-forward 20 minutes instantly instead of waiting for it. A timer that
 * called Date.now() internally could only be tested by actually waiting, which
 * in practice means it never gets tested at all.
 *
 * This is a plain script rather than a proper test suite, because a test runner
 * is a chunk's worth of setup we haven't done yet. It's deliberately a stopgap:
 * once there's a second thing worth testing, this should become real tests
 * under Vitest (which shares Vite's config, so it's a small step). Until then,
 * a script that exits non-zero on failure is far better than no verification.
 */
import {
  DEFAULT_TIMER_CONFIG,
  phaseDurationMs,
  advancePhase,
  createInitialState,
  formatDuration,
  getRemainingMs,
  pause,
  reset,
  start,
} from "./timerLogic";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `  ${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok ? "" : `\n         expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`),
  );
}

const T0 = 1_000_000_000_000; // an arbitrary fixed "now"
const C = DEFAULT_TIMER_CONFIG;  // durations are now an input, not a constant

console.log("\n1. Basic countdown");
{
  let s = createInitialState(C);
  check("starts at 25 minutes", s.remainingMs, 25 * 60 * 1000);
  s = start(s, T0);
  check("after 0s, still 25:00", formatDuration(getRemainingMs(s, T0)), "25:00");
  check("after 1s -> 24:59", formatDuration(getRemainingMs(s, T0 + 1000)), "24:59");
  check("after 60s -> 24:00", formatDuration(getRemainingMs(s, T0 + 60_000)), "24:00");
}

console.log("\n2. THE BACKGROUND-TAB TEST (the reason for this design)");
{
  let s = createInitialState(C);
  s = start(s, T0);
  // Simulate the tab being hidden for 20 minutes. A subtract-per-tick timer
  // would have been throttled and lost most of this.
  const after20min = getRemainingMs(s, T0 + 20 * 60 * 1000);
  check("20 min elapsed while hidden -> 5:00 left", formatDuration(after20min), "5:00");

  // And past the end.
  const after40min = getRemainingMs(s, T0 + 40 * 60 * 1000);
  check("40 min elapsed -> clamped to 0:00", formatDuration(after40min), "0:00");
  check("never reports negative", after40min, 0);
}

console.log("\n3. Pause and resume preserve remaining time");
{
  let s = createInitialState(C);
  s = start(s, T0);
  s = pause(s, T0 + 10 * 60 * 1000); // pause after 10 min
  check("paused with 15:00 left", formatDuration(getRemainingMs(s, T0 + 10 * 60 * 1000)), "15:00");

  // While paused, time passing must NOT reduce the remaining time.
  check(
    "an hour passes while paused, still 15:00",
    formatDuration(getRemainingMs(s, T0 + 70 * 60 * 1000)),
    "15:00",
  );

  // Resume an hour later; it should run from 15:00, not from where the clock is.
  const resumeAt = T0 + 70 * 60 * 1000;
  s = start(s, resumeAt);
  check("resumes at 15:00", formatDuration(getRemainingMs(s, resumeAt)), "15:00");
  check("1 min after resume -> 14:00", formatDuration(getRemainingMs(s, resumeAt + 60_000)), "14:00");
}

console.log("\n4. Phase cycling");
{
  let s = createInitialState(C);
  const seen: string[] = [];
  // Complete 8 phases: work/break alternating.
  for (let i = 0; i < 8; i++) {
    s = advancePhase(s, C);
    seen.push(s.phase);
  }
  check(
    "work -> short -> work -> short -> work -> short -> work -> LONG",
    seen,
    [
      "shortBreak",
      "work",
      "shortBreak",
      "work",
      "shortBreak",
      "work",
      "longBreak",
      "work",
    ],
  );
  check(`long break arrives after ${C.sessionsBeforeLongBreak} work sessions`, seen[6], "longBreak");
}

console.log("\n5. Advancing always lands stopped, never auto-running");
{
  let s = createInitialState(C);
  s = start(s, T0);
  s = advancePhase(s, C);
  check("status is idle after advance", s.status, "idle");
  check("endsAt cleared", s.endsAt, null);
  check("next phase at full duration", s.remainingMs, phaseDurationMs(C, "shortBreak"));
}

console.log("\n6. Reset restores the current phase");
{
  let s = createInitialState(C);
  s = start(s, T0);
  s = pause(s, T0 + 5 * 60 * 1000);
  s = reset(s, C);
  check("back to full 25:00", s.remainingMs, phaseDurationMs(C, "work"));
  check("stopped", s.status, "idle");
}

console.log("\n7. formatDuration uses ceil, so 25:00 shows at the start");
{
  check("exactly 25 min", formatDuration(25 * 60 * 1000), "25:00");
  check("1ms less still shows 25:00", formatDuration(25 * 60 * 1000 - 1), "25:00");
  check("59.5s -> 1:00", formatDuration(59_500), "1:00");
  check("zero", formatDuration(0), "0:00");
  check("negative clamps", formatDuration(-5000), "0:00");
}

console.log("\n8. Custom durations are respected");
{
  // A "52/17" schedule with a long break every 2 sessions.
  const custom = {
    workMinutes: 52,
    shortBreakMinutes: 17,
    longBreakMinutes: 30,
    sessionsBeforeLongBreak: 2,
  };

  let s = createInitialState(custom);
  check("starts at 52 minutes", formatDuration(s.remainingMs), "52:00");

  s = start(s, T0);
  check("counts down from 52:00", formatDuration(getRemainingMs(s, T0 + 60_000)), "51:00");

  s = advancePhase(s, custom);
  check("break is 17 minutes", formatDuration(s.remainingMs), "17:00");

  s = advancePhase(s, custom); // back to work
  s = advancePhase(s, custom); // second work session done
  check("long break after 2 sessions, not 4", s.phase, "longBreak");
  check("long break is 30 minutes", formatDuration(s.remainingMs), "30:00");
}

console.log("\n9. The same state behaves differently under different configs");
{
  // Proof that durations really are an input rather than baked in: one state,
  // two configs, two answers.
  const stateAfterWork = createInitialState(DEFAULT_TIMER_CONFIG);
  const underDefault = advancePhase(stateAfterWork, DEFAULT_TIMER_CONFIG);
  const underCustom = advancePhase(stateAfterWork, {
    ...DEFAULT_TIMER_CONFIG,
    shortBreakMinutes: 9,
  });

  check("default gives a 5:00 break", formatDuration(underDefault.remainingMs), "5:00");
  check("custom gives a 9:00 break", formatDuration(underCustom.remainingMs), "9:00");
}

console.log(
  failures === 0
    ? "\nAll checks passed.\n"
    : `\n${failures} check(s) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
