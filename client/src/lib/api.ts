/**
 * api.ts — one place that knows how to talk to our server.
 *
 * Without this, every component would repeat the same four steps: build the
 * fetch, check response.ok, parse the JSON, and figure out what the error
 * actually was. That repetition is where inconsistencies breed — one component
 * shows the server's message, another shows "Something went wrong", a third
 * forgets to check for errors at all.
 *
 * So the rule is: components never call `fetch` directly. They call these
 * helpers and either get data back or catch an ApiError.
 */

/**
 * The error shape our server sends, from server/src/routes/auth.ts:
 *
 *   { error: "Invalid input", fields: { email: "Enter a valid email address" } }
 *   { error: "Invalid credentials", message: "Email or password is incorrect." }
 *
 * `fields` is per-input and belongs next to the input it describes. `message`
 * is about the request as a whole and belongs at the top of the form. Keeping
 * them separate is what lets the UI put each in the right place.
 */
export type ApiErrorBody = {
  error: string;
  message?: string;
  fields?: Record<string, string>;
};

/**
 * A custom Error subclass carrying the server's structured detail.
 *
 * Why subclass Error rather than return an `{ ok, data, error }` object? Because
 * `throw` propagates automatically. With a returned result you must check it at
 * every single call site, and forgetting is silent. With a throw, forgetting
 * means the error surfaces loudly instead of being swallowed.
 */
export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;

  constructor(status: number, body: ApiErrorBody) {
    // `message` is the human-readable summary — Error's own first argument.
    super(body.message ?? body.error ?? "Request failed");
    this.name = "ApiError";
    this.status = status;
    this.fields = body.fields ?? {};
  }
}

/**
 * The shared request function.
 *
 * A note on cookies, since this is the part that quietly makes auth work:
 * `fetch` sends cookies for same-origin requests by default. Our React app is
 * served from localhost:5173 and calls "/api/...", which Vite proxies to the
 * server — so as far as the browser is concerned everything is one origin, and
 * the session cookie rides along automatically.
 *
 * That's the payoff from the proxy decision back in chunk 1. If the API lived
 * on a different domain we'd need `credentials: "include"` here plus matching
 * CORS headers on the server, and cookies across origins are increasingly
 * restricted by browsers. Staying same-origin sidesteps all of it.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  // 204 No Content has an empty body — calling .json() on it would throw.
  if (response.status === 204) {
    return undefined as T;
  }

  // Parse first, decide second. Even error responses carry JSON we want.
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // The response wasn't JSON at all. That usually means something upstream of
    // our route handler failed — a crash, or a proxy returning an HTML error
    // page — so there's no structured detail to show.
    if (!response.ok) {
      throw new ApiError(response.status, {
        error: `Request failed with status ${response.status}`,
      });
    }
    return undefined as T;
  }

  if (!response.ok) {
    throw new ApiError(response.status, body as ApiErrorBody);
  }

  return body as T;
}

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>(path);
  },

  post<T>(path: string, data?: unknown): Promise<T> {
    return request<T>(path, {
      method: "POST",
      // Only send a body when there is one — POST /logout has none.
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  },
};
