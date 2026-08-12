import { useAuth } from "../auth/AuthContext";
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
