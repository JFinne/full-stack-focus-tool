import { createContext, useContext } from "react";

/**
 * AuthContext.ts — the shared "who is signed in?" value.
 *
 * ## What Context solves
 *
 * React data flows down through props. That's usually a strength — you can see
 * where a value came from by reading upward. But the signed-in user is needed
 * *everywhere*: the header shows a name, the sidebar hides things, a note needs
 * an author. Passing `user` down through every intermediate component means
 * components that don't care about it still have to accept and forward it. That
 * is called prop drilling, and it makes every component's signature a record of
 * what its descendants happen to need.
 *
 * Context lets a provider high in the tree publish a value that any descendant
 * can read directly, however deep.
 *
 * ## When NOT to use it
 *
 * Context is easy to overuse. It's the right tool for values that are genuinely
 * global and change rarely — the current user, the theme. It's the wrong tool
 * for ordinary component state, because every consumer re-renders when the
 * value changes. If only two components need a value, pass a prop.
 *
 * ## Why this file has no JSX
 *
 * The context object and the hook live here; the provider *component* lives in
 * AuthProvider.tsx. React Fast Refresh (the thing that updates the browser
 * without losing state when you save) works reliably when a file exports only
 * components or only non-components. Mixing them makes it fall back to full
 * reloads, which is a small annoyance you'd feel a hundred times a day.
 */

/** The signed-in user, matching what GET /api/auth/me returns. */
export type User = {
  id: string;
  email: string;
  displayName: string;
};

export type RegisterInput = {
  email: string;
  password: string;
  displayName: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type AuthContextValue = {
  /** The signed-in user, or null if signed out. */
  user: User | null;

  /**
   * "checking" while we ask the server who we are on first load.
   *
   * This state matters more than it looks. The session lives in an httpOnly
   * cookie that JavaScript cannot read, so on page load the app genuinely does
   * not know whether you're signed in until the server answers. Without a
   * distinct "checking" state we'd treat that gap as "signed out" and flash the
   * login form at people who are already logged in, every refresh.
   */
  status: "checking" | "ready";

  register: (input: RegisterInput) => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
};

/**
 * The context object itself.
 *
 * The `null` default means "no provider above me." We use that below to catch a
 * common mistake rather than letting it fail mysteriously later.
 */
export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Read the auth context.
 *
 * Wrapping `useContext` in a named hook does two useful things. It gives
 * components a single obvious import, and it converts a whole class of bug into
 * a clear error: if a component using this isn't inside AuthProvider, the value
 * is null, and you'd otherwise get "Cannot read properties of null" from
 * somewhere far away from the actual mistake.
 *
 * The check also narrows the type. After it, TypeScript knows the value isn't
 * null, so callers get `user` and friends without any null-checking on the
 * context itself.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an <AuthProvider>.");
  }

  return context;
}
