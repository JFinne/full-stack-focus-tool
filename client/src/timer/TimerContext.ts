import { createContext, useContext } from "react";
import type { Phase, Status } from "./timerLogic";

/**
 * TimerContext.ts — the timer's shape, shared across the app.
 *
 * The timer lives in context rather than inside TimerPage for one specific
 * reason: component state dies when the component unmounts. Navigate from
 * /timer to /notes and a timer owned by the page would silently reset.
 *
 * Putting it above the routes means it keeps running while you move around —
 * which is the entire point of a study timer. It's also what will let a future
 * header show "12:34 remaining" from anywhere, and what Focus Mode in chunk 6
 * will read to decide what to hide.
 */

export type TimerContextValue = {
  phase: Phase;
  status: Status;

  /** Milliseconds left, recomputed from wall-clock time on every tick. */
  remainingMs: number;

  /** Full length of the current phase, for progress display. */
  totalMs: number;

  /** Completed work sessions in the current cycle. */
  completedWorkSessions: number;

  /** True for the moment a phase has ended and is awaiting the next step. */
  justCompleted: boolean;

  start: () => void;
  pause: () => void;
  reset: () => void;
  /** Jump to the next phase without finishing this one. */
  skip: () => void;
};

export const TimerContext = createContext<TimerContextValue | null>(null);

export function useTimer(): TimerContextValue {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error("useTimer must be used inside a <TimerProvider>.");
  }
  return context;
}
