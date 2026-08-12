import { useEffect, useState } from "react";

/**
 * The shape of the response we expect from GET /api/health.
 *
 * This mirrors what server/src/app.ts sends back. Describing it as a TypeScript
 * type means the editor can autocomplete `health.status` and will flag a typo
 * like `health.staus` immediately, instead of you discovering it as `undefined`
 * on screen.
 *
 * A caveat worth understanding early: TypeScript types vanish when the code
 * runs. This type is a *promise you are making to yourself* about what the
 * server sends — it is not a check performed at runtime. If the server changes
 * its response and this type doesn't, TypeScript will happily keep believing
 * you. (Keeping these two in sync automatically is a solvable problem, and one
 * we may come back to once there are more endpoints to keep in sync.)
 */
type HealthResponse = {
  status: string;
  message: string;
  timestamp: string;
};

/**
 * A tiny state machine describing where the request currently stands.
 *
 * Beginners often track this with a pile of booleans (`isLoading`, `isError`,
 * `isDone`), which allows nonsense combinations — what does it mean if
 * `isLoading` and `isError` are both true? Using one variable that holds
 * exactly one of these three strings makes the impossible states impossible.
 */
type RequestState = "loading" | "success" | "error";

function App() {
  // useState gives a component memory. Without it, every re-render would reset
  // these values. The pattern is always the same: a variable holding the
  // current value, and a function to change it (which also tells React to
  // re-render this component).
  const [state, setState] = useState<RequestState>("loading");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  /**
   * useEffect runs code that reaches *outside* React — network requests, timers,
   * subscriptions. Rendering itself must stay pure and predictable, so anything
   * with side effects goes in here.
   *
   * The `[]` at the bottom is the dependency array: "re-run this effect whenever
   * one of these values changes." An empty array means nothing can change, so
   * it runs only once, right after the component first appears.
   */
  useEffect(() => {
    // A flag to avoid updating state after the component has been removed from
    // the screen. If you navigate away mid-request, the response still arrives
    // eventually, and calling setState on a component that no longer exists is
    // a memory leak. This pattern is why you'll see React run effects twice in
    // development — StrictMode deliberately mounts, unmounts, and remounts your
    // components to surface exactly this class of bug.
    let active = true;

    async function checkHealth() {
      try {
        // No hostname or port — just "/api/health". Vite's proxy (see
        // vite.config.ts) forwards it to the Express server on port 3000.
        const response = await fetch("/api/health");

        // An important gotcha: fetch does NOT throw on 404 or 500. It only
        // rejects if the request couldn't be made at all (server unreachable,
        // network down). A 500 response is still a *successful* fetch as far as
        // the browser is concerned, so you have to check `response.ok` yourself.
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }

        const data: HealthResponse = await response.json();

        if (!active) return;
        setHealth(data);
        setState("success");
      } catch (error) {
        if (!active) return;
        // `error` is typed as `unknown` because JavaScript lets you throw any
        // value, not just Error objects. So we narrow it before using it.
        setErrorMessage(
          error instanceof Error ? error.message : "Unknown error",
        );
        setState("error");
      }
    }

    void checkHealth();

    // The returned function is the cleanup, run when the component is removed.
    return () => {
      active = false;
    };
  }, []);

  return (
    // DaisyUI classes are doing the visual work here:
    //   bg-base-200 / text-base-content — theme-aware colours that automatically
    //   flip when the theme changes, which is why we won't have to rewrite any
    //   of this when we build the theme picker.
    // The rest (min-h-screen, flex, gap-4) are plain Tailwind utilities.
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body">
          <h1 className="card-title text-2xl">Focus Tool</h1>
          <p className="text-base-content/70 text-sm">
            Chunk 1: verifying the client can reach the server.
          </p>

          <div className="divider my-2" />

          {/* Conditional rendering. In JSX, `{condition && <Thing />}` means
              "render Thing only if condition is true" — it's how you show or
              hide markup based on state. */}

          {state === "loading" && (
            <div className="flex items-center gap-3">
              <span className="loading loading-spinner loading-md" />
              <span>Contacting server…</span>
            </div>
          )}

          {state === "success" && health && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="badge badge-success">Connected</div>
                <span className="text-sm">{health.message}</span>
              </div>
              <p className="text-xs text-base-content/60">
                Server time: {new Date(health.timestamp).toLocaleTimeString()}
              </p>
            </div>
          )}

          {state === "error" && (
            <div role="alert" className="alert alert-error">
              <div>
                <h2 className="font-bold">Could not reach the server</h2>
                <p className="text-xs">{errorMessage}</p>
                <p className="text-xs mt-1">
                  Is the Express server running on port 3000?
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
