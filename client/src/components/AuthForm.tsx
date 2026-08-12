import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../lib/api";

/**
 * AuthForm — the signed-out screen. Handles both signing in and signing up.
 *
 * One component for both because the two forms are 90% identical: same email,
 * same password, same submit-and-handle-errors logic. Splitting them would mean
 * maintaining that logic twice so the two could differ by one input.
 */

type Mode = "login" | "register";

export function AuthForm() {
  const { login, register } = useAuth();

  const [mode, setMode] = useState<Mode>("login");

  /**
   * Controlled inputs.
   *
   * Each input's `value` comes from state and its `onChange` writes back to
   * state. That makes React the single source of truth for what's in the box —
   * the DOM only reflects it. It feels like extra ceremony versus reading the
   * value at submit time, but it's what lets you validate as someone types,
   * disable submit while a field is empty, or clear the form programmatically.
   */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  /** Per-field messages from the server, keyed by field name. */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /** A whole-form message, like "Email or password is incorrect." */
  const [formError, setFormError] = useState("");

  /** True while a request is in flight — used to disable the form. */
  const [submitting, setSubmitting] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    // Clear errors when switching. Complaints about the login attempt make no
    // sense hanging over the signup form.
    setFieldErrors({});
    setFormError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    /**
     * Stop the browser's default form submission.
     *
     * By default, submitting a form makes the browser navigate — a full page
     * load that would throw away all our React state. We want to handle it in
     * JavaScript instead.
     *
     * We still use a real <form> rather than a button with an onClick, because
     * forms give us things for free: Enter-to-submit, correct semantics for
     * screen readers, and password managers recognising it as a login.
     */
    event.preventDefault();

    setFieldErrors({});
    setFormError("");
    setSubmitting(true);

    try {
      if (mode === "login") {
        await login({ email, password });
      } else {
        await register({ email, password, displayName });
      }
      // On success there's no navigation to do. The provider sets `user`, App
      // re-renders, and this whole component disappears — see App.tsx.
    } catch (error) {
      if (error instanceof ApiError) {
        // Field-specific complaints go under their inputs; anything else goes
        // at the top of the form. This split is why api.ts keeps them apart.
        setFieldErrors(error.fields);
        if (Object.keys(error.fields).length === 0) {
          setFormError(error.message);
        }
      } else {
        // Not an ApiError — the request never reached the server.
        setFormError("Could not reach the server. Is it running?");
      }
    } finally {
      // Re-enable the form no matter what. Skipping this on the error path is a
      // classic bug: the user sees the error but can't try again.
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body">
          <h1 className="card-title text-2xl">Focus Tool</h1>
          <p className="text-base-content/70 text-sm">
            {mode === "login"
              ? "Sign in to get to your work."
              : "Create an account to get started."}
          </p>

          {/* Mode toggle. role="tablist" tells screen readers these two
              controls switch between views rather than navigating away. */}
          <div role="tablist" className="tabs tabs-box mt-4">
            <button
              type="button"
              role="tab"
              className={`tab flex-1 ${mode === "login" ? "tab-active" : ""}`}
              aria-selected={mode === "login"}
              onClick={() => switchMode("login")}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              className={`tab flex-1 ${mode === "register" ? "tab-active" : ""}`}
              aria-selected={mode === "register"}
              onClick={() => switchMode("register")}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3" noValidate>
            {/* Only shown when signing up. Rendered first because a name is the
                gentlest thing to ask for. */}
            {mode === "register" && (
              <Field
                label="Display name"
                error={fieldErrors.displayName}
                htmlFor="displayName"
              >
                <input
                  id="displayName"
                  type="text"
                  className={`input input-bordered w-full ${fieldErrors.displayName ? "input-error" : ""}`}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  // Tells password managers and browsers what this field is, so
                  // autofill works. Small detail, real usability difference.
                  autoComplete="name"
                  placeholder="Alex"
                  disabled={submitting}
                  // Announces the error to screen readers, not just sighted users.
                  aria-invalid={Boolean(fieldErrors.displayName)}
                />
              </Field>
            )}

            <Field label="Email" error={fieldErrors.email} htmlFor="email">
              <input
                id="email"
                type="email"
                className={`input input-bordered w-full ${fieldErrors.email ? "input-error" : ""}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@school.edu"
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.email)}
              />
            </Field>

            <Field
              label="Password"
              error={fieldErrors.password}
              htmlFor="password"
              hint={
                mode === "register" ? "At least 8 characters." : undefined
              }
            >
              <input
                id="password"
                type="password"
                className={`input input-bordered w-full ${fieldErrors.password ? "input-error" : ""}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                // "new-password" prompts password managers to offer to generate
                // and save one; "current-password" prompts them to fill the
                // saved one. Using the right value is what makes the difference
                // between autofill working and silently not working.
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.password)}
              />
            </Field>

            {formError && (
              // role="alert" makes screen readers announce this immediately,
              // rather than only when the user happens to navigate to it.
              <div role="alert" className="alert alert-error text-sm">
                <span>{formError}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={submitting}
            >
              {submitting && <span className="loading loading-spinner" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/**
 * One labelled input row, with optional hint and error text.
 *
 * Extracted because the three fields are otherwise identical scaffolding, and
 * because the label/error wiring is exactly the sort of thing that gets
 * subtly wrong when copy-pasted.
 *
 * `children` is the actual <input>. Passing it in rather than generating it
 * here keeps this component about *layout* while each call site keeps full
 * control over its own input's type and attributes.
 */
function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="form-control w-full">
      {/* htmlFor must match the input's id. That link is what lets clicking the
          label focus the input, and what tells a screen reader which label
          describes which field. It's `htmlFor` and not `for` because `for` is a
          reserved word in JavaScript. */}
      <label className="label" htmlFor={htmlFor}>
        <span className="label-text">{label}</span>
      </label>

      {children}

      {hint && !error && (
        <span className="label-text-alt text-base-content/60 mt-1 block">
          {hint}
        </span>
      )}

      {error && (
        <span className="label-text-alt text-error mt-1 block">{error}</span>
      )}
    </div>
  );
}
