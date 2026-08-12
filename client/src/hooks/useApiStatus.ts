import { useEffect, useState } from "react";

/**
 * useApiStatus — fetches a URL once and reports where the request stands.
 *
 * This is a *custom hook*: a plain function whose name starts with "use" and
 * which calls other hooks inside it. That naming isn't decoration — React uses
 * it to enforce the rules of hooks.
 *
 * Why extract this at all? We now have two health endpoints, and both need the
 * same three-state dance: loading, then success or failure. Writing that twice
 * means fixing every future bug twice.
 *
 * The important idea is *what* got extracted. A component extracts markup; a
 * hook extracts stateful behaviour. This file contains no JSX at all — it owns
 * the "how do I fetch and track a request" logic, and leaves "what should this
 * look like" entirely to whoever calls it. Two components can share this logic
 * while rendering completely different things.
 */

/** The three states a request can be in. Exactly one at a time. */
export type RequestState = "loading" | "success" | "error";

export type ApiStatus<T> = {
  state: RequestState;
  /** The parsed response body — only present once state is "success". */
  data: T | null;
  /** A human-readable failure reason — only meaningful when state is "error". */
  error: string;
};

/**
 * The `<T>` makes this function *generic*: the caller decides what shape the
 * response has, and TypeScript threads that type through to `data`.
 *
 * So `useApiStatus<HealthResponse>("/api/health")` returns a value whose `data`
 * is typed `HealthResponse | null` — you get autocomplete on the result even
 * though this file knows nothing about health checks. Without the generic we'd
 * have to return `any` and lose every type guarantee at the boundary.
 */
export function useApiStatus<T>(url: string): ApiStatus<T> {
  const [state, setState] = useState<RequestState>("loading");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    // Prevents writing state after the component is gone — see the note in the
    // effect's cleanup below.
    let active = true;

    async function run() {
      // Reset to loading in case `url` changed and we're re-running.
      setState("loading");

      try {
        const response = await fetch(url);

        // fetch only rejects when the request couldn't be made at all. A 404 or
        // 500 is still a "successful" fetch as far as the browser is concerned,
        // so a status check has to be explicit.
        if (!response.ok) {
          // Our API returns JSON even for errors, so try to surface the
          // server's own message rather than a bare status code.
          let detail = `Server responded with ${response.status}`;
          try {
            const body = await response.json();
            if (body?.message) detail = body.message;
          } catch {
            // Body wasn't JSON. Not worth reporting — the status code above is
            // still a useful message on its own.
          }
          throw new Error(detail);
        }

        const body: T = await response.json();

        if (!active) return;
        setData(body);
        setState("success");
      } catch (caught) {
        if (!active) return;
        // `caught` is typed `unknown` because JavaScript allows throwing any
        // value, so it has to be narrowed before use.
        setError(caught instanceof Error ? caught.message : "Unknown error");
        setState("error");
      }
    }

    void run();

    return () => {
      active = false;
    };
    // Re-run whenever the URL changes. With a constant URL, that's never —
    // so this runs once on mount.
  }, [url]);

  return { state, data, error };
}
