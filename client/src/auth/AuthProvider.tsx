import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../lib/api";
import {
  AuthContext,
  type AuthContextValue,
  type LoginInput,
  type RegisterInput,
  type User,
} from "./AuthContext";

/**
 * AuthProvider — owns the signed-in user and publishes it to the whole app.
 *
 * Wrap the app in this once (see main.tsx) and every component below can call
 * useAuth().
 *
 * The mental model: this component is the single source of truth for "who is
 * signed in." The server is the *actual* authority — it holds the session — but
 * within the browser, this is the one copy. Anything else asking the server
 * independently would risk two parts of the UI disagreeing.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<"checking" | "ready">("checking");

  /**
   * On first load, ask the server who we are.
   *
   * This runs once. The session cookie is httpOnly, so the only way to find out
   * whether we're signed in is to ask — which is exactly the trade that keeps
   * the token safe from injected scripts.
   */
  useEffect(() => {
    let active = true;

    async function loadCurrentUser() {
      try {
        const data = await api.get<{ user: User }>("/api/auth/me");
        if (active) setUser(data.user);
      } catch (error) {
        // A 401 here is not a failure — it's the ordinary answer for "not
        // signed in", and the only thing to do is carry on with user = null.
        // Anything else is worth seeing in the console while developing.
        if (!(error instanceof ApiError && error.status === 401)) {
          console.error("[auth] Could not load current user:", error);
        }
        if (active) setUser(null);
      } finally {
        // `finally` runs on both paths. Without it, an unexpected error would
        // leave status stuck on "checking" and the app would show a spinner
        // forever — a genuinely common bug, and an unpleasant one because the
        // screen gives no hint about what went wrong.
        if (active) setStatus("ready");
      }
    }

    void loadCurrentUser();

    return () => {
      active = false;
    };
  }, []);

  /**
   * These three deliberately do NOT catch errors.
   *
   * Letting an ApiError propagate is the point: the form that called this needs
   * to know the attempt failed so it can show "Email or password is incorrect"
   * next to the right input. If we swallowed the error here and returned
   * quietly, the form would have no way to tell success from failure.
   *
   * Each is wrapped in useCallback so the function identity stays stable
   * between renders. That matters because these go into the context value —
   * without it, every render would produce new functions, making the context
   * value new, re-rendering every consumer for no reason.
   */
  const register = useCallback(async (input: RegisterInput) => {
    // The server sets the session cookie in its response, so by the time this
    // resolves the browser is already authenticated. We just record the user.
    const data = await api.post<{ user: User }>("/api/auth/register", input);
    setUser(data.user);
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const data = await api.post<{ user: User }>("/api/auth/login", input);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      // Clear local state even if the request failed. If the server is
      // unreachable we still want the UI to reflect the user's intent — and a
      // stale "signed in" screen that does nothing is worse than a login form.
      setUser(null);
    }
  }, []);

  /**
   * useMemo keeps the context value stable.
   *
   * Without it, this object literal would be recreated on every render of
   * AuthProvider. Context compares by reference, so a new object means every
   * consumer re-renders — even when user and status haven't changed at all.
   *
   * With the dependency array below, a new object is only created when
   * something in it actually changed.
   */
  const value = useMemo<AuthContextValue>(
    () => ({ user, status, register, login, logout }),
    [user, status, register, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
