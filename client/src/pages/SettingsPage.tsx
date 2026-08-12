import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { usePreferences } from "../preferences/PreferencesContext";
import { THEMES, useTheme, type Theme } from "../theme/ThemeContext";

/**
 * SettingsPage — account settings. Right now that means the theme.
 *
 * As preferences grow (Pomodoro durations, Focus Mode rules, add-on toggles)
 * they'll become sibling sections on this page.
 */
export function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme, saveState } = useTheme();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-base-content/70 text-sm mt-1">
          Changes save to your account automatically.
        </p>
      </div>

      {/* ---- Theme ---- */}
      <section className="card bg-base-100 shadow">
        <div className="card-body">
          <div className="flex items-center justify-between gap-2">
            <h2 className="card-title text-base">Theme</h2>
            {/* Save feedback. Only "error" really matters — the others are
                reassurance. Note what the error says: the theme IS applied, it
                just didn't sync. Telling the user the accurate thing beats a
                generic "something went wrong" that implies nothing worked. */}
            {saveState === "saving" && (
              <span className="text-xs text-base-content/50">Saving…</span>
            )}
            {saveState === "saved" && (
              <span className="text-xs text-success">Saved</span>
            )}
            {saveState === "error" && (
              <span className="text-xs text-error">
                Applied, but not saved to your account
              </span>
            )}
          </div>
          <p className="text-sm text-base-content/70">
            Applies instantly and follows you to other devices.
          </p>

          {/*
            A radiogroup rather than a <select>. Themes are visual, so showing a
            preview of each beats reading names — and with only nine options,
            laying them out costs nothing.
          */}
          <div
            role="radiogroup"
            aria-label="Colour theme"
            className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3"
          >
            {THEMES.map((option) => (
              <ThemeOption
                key={option.value}
                value={option.value}
                label={option.label}
                selected={theme === option.value}
                onSelect={setTheme}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ---- Timer ---- */}
      <TimerSettings />

      {/* ---- Account ---- */}
      <section className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-base">Account</h2>
          <dl className="text-sm mt-2 space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-base-content/60">Display name</dt>
              <dd>{user?.displayName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-base-content/60">Email</dt>
              <dd className="break-all">{user?.email}</dd>
            </div>
          </dl>
          <p className="text-xs text-base-content/50 mt-3">
            Changing your name, email, or password comes in a later chunk.
          </p>
        </div>
      </section>
    </div>
  );
}

/**
 * TimerSettings — the four Pomodoro numbers.
 *
 * These are saved when you finish editing rather than on every keystroke. See
 * NumberSetting below for why.
 */
function TimerSettings() {
  const { preferences, updatePreferences, fieldErrors } = usePreferences();

  return (
    <section className="card bg-base-100 shadow">
      <div className="card-body">
        <h2 className="card-title text-base">Timer</h2>
        <p className="text-sm text-base-content/70">
          A change applies to the next phase — a session that's already running
          finishes at its original length.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 mt-3">
          <NumberSetting
            id="workMinutes"
            label="Focus length"
            unit="minutes"
            value={preferences.workMinutes}
            min={1}
            max={180}
            error={fieldErrors.workMinutes}
            onCommit={(v) => updatePreferences({ workMinutes: v })}
          />
          <NumberSetting
            id="shortBreakMinutes"
            label="Short break"
            unit="minutes"
            value={preferences.shortBreakMinutes}
            min={1}
            max={60}
            error={fieldErrors.shortBreakMinutes}
            onCommit={(v) => updatePreferences({ shortBreakMinutes: v })}
          />
          <NumberSetting
            id="longBreakMinutes"
            label="Long break"
            unit="minutes"
            value={preferences.longBreakMinutes}
            min={1}
            max={60}
            error={fieldErrors.longBreakMinutes}
            onCommit={(v) => updatePreferences({ longBreakMinutes: v })}
          />
          <NumberSetting
            id="sessionsBeforeLongBreak"
            label="Sessions before long break"
            unit="sessions"
            value={preferences.sessionsBeforeLongBreak}
            min={1}
            max={12}
            error={fieldErrors.sessionsBeforeLongBreak}
            onCommit={(v) => updatePreferences({ sessionsBeforeLongBreak: v })}
          />
        </div>
      </div>
    </section>
  );
}

/**
 * A number input that saves when you're done editing, not as you type.
 *
 * ## Why this needs its own local state
 *
 * The obvious approach — `value={preferences.workMinutes}` with an onChange
 * that saves — breaks the moment someone clears the box to retype. An empty
 * input parses to NaN, or momentarily to a value like `2` while typing `25`,
 * and every intermediate keystroke fires a save. You'd get a request per
 * character, with `2` briefly stored as the real setting.
 *
 * So the input keeps its own draft state as a *string* — exactly what the user
 * typed, including an empty box mid-edit — and only converts to a number and
 * saves when editing finishes: on blur, or on Enter.
 *
 * This distinction between "what's being typed" and "what's saved" shows up
 * constantly in forms. The input needs to allow states the saved value can't
 * have.
 */
function NumberSetting({
  id,
  label,
  unit,
  value,
  min,
  max,
  error,
  onCommit,
}: {
  id: string;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  error?: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  /**
   * Follow the saved value when it changes from outside — the initial load, or
   * the server correcting us.
   *
   * Comparing numbers rather than strings is deliberate: "25" and "25.0" parse
   * the same, and this shouldn't fight the user over formatting while they're
   * mid-edit.
   */
  useEffect(() => {
    if (Number(draft) !== value) {
      setDraft(String(value));
    }
    // Intentionally only when the saved value changes. Including `draft` would
    // reset the box on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function commit() {
    const parsed = Number(draft);

    // Reject anything that isn't a usable number and snap back to the saved
    // value. The server validates too — this just avoids a pointless round trip
    // and gives immediate feedback.
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      setDraft(String(value));
      return;
    }

    if (parsed !== value) onCommit(parsed);
  }

  return (
    <div className="form-control">
      <label className="label" htmlFor={id}>
        <span className="label-text">{label}</span>
      </label>

      <label className="input input-bordered flex items-center gap-2">
        <input
          id={id}
          type="number"
          className="grow w-full"
          value={draft}
          min={min}
          max={max}
          step={1}
          onChange={(e) => setDraft(e.target.value)}
          // Editing is "finished" when focus leaves...
          onBlur={commit}
          // ...or when Enter is pressed, which is what people expect in a form.
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-hint`}
        />
        <span className="text-xs text-base-content/50 shrink-0">{unit}</span>
      </label>

      <span
        id={`${id}-hint`}
        className={`label-text-alt mt-1 block ${error ? "text-error" : "text-base-content/50"}`}
      >
        {error ?? `${min}–${max}`}
      </span>
    </div>
  );
}

/**
 * One selectable theme swatch.
 *
 * The clever bit is `data-theme` on the wrapper. That attribute doesn't only
 * work on <html> — setting it on any element re-themes that element and
 * everything inside it. So each swatch renders its own colours, and you see
 * what you're choosing before you choose it.
 *
 * The one exception is "system", which has no fixed colours by definition. It
 * gets no data-theme, so it renders in whatever the current theme is.
 */
function ThemeOption({
  value,
  label,
  selected,
  onSelect,
}: {
  value: Theme;
  label: string;
  selected: boolean;
  onSelect: (theme: Theme) => void;
}) {
  return (
    <button
      type="button"
      // role="radio" plus aria-checked tells assistive technology these are
      // mutually exclusive choices, which a group of plain buttons wouldn't
      // convey. The radiogroup wrapper above completes the picture.
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(value)}
      // Applying the theme to the button itself is what makes it a preview.
      data-theme={value === "system" ? undefined : value}
      className={`rounded-lg border-2 p-3 text-left transition-colors bg-base-100 ${
        selected ? "border-primary" : "border-base-300 hover:border-base-content/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-base-content truncate">
          {label}
        </span>
        {selected && (
          <span className="text-primary text-xs shrink-0" aria-hidden="true">
            ●
          </span>
        )}
      </div>

      {/* Colour swatches, so you can see the palette rather than guess it. */}
      <div className="flex gap-1 mt-2">
        <span className="w-4 h-4 rounded bg-primary" />
        <span className="w-4 h-4 rounded bg-secondary" />
        <span className="w-4 h-4 rounded bg-accent" />
        <span className="w-4 h-4 rounded bg-neutral" />
      </div>
    </button>
  );
}
