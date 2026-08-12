import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useApiStatus } from "../hooks/useApiStatus";

/**
 * Dashboard — what you see once signed in.
 *
 * Deliberately thin. This is a placeholder proving auth works end to end; the
 * real layout, navigation, and theme switcher are chunk 4. Building it properly
 * now would mean guessing at requirements we're about to decide on.
 */

type DbHealthResponse = {
  status: string;
  message: string;
  userCount: number;
};

export function Dashboard() {
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const db = useApiStatus<DbHealthResponse>("/api/health/db");

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
      // No cleanup needed afterwards: logout sets user to null, App re-renders,
      // and this component unmounts. Setting state after that would warn.
    } catch {
      // logout() already clears local state in its own `finally`, so there is
      // nothing to recover from here.
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-base-200">
      <div className="navbar bg-base-100 shadow-sm">
        <div className="flex-1 px-2">
          <span className="text-lg font-semibold">Focus Tool</span>
        </div>

        <div className="flex-none gap-2 items-center">
          <span className="text-sm text-base-content/70 hidden sm:inline">
            {user?.displayName}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut && <span className="loading loading-spinner loading-xs" />}
            Sign out
          </button>
        </div>
      </div>

      <main className="p-4 max-w-3xl mx-auto space-y-4">
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h1 className="card-title">
              Welcome, {user?.displayName}
            </h1>
            <p className="text-base-content/70 text-sm">
              You're signed in as {user?.email}. Your session is stored in the
              database and survives a page refresh — try reloading.
            </p>
          </div>
        </div>

        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title text-base">Coming up</h2>
            <ul className="text-sm text-base-content/70 space-y-1">
              <li>Chunk 4 — app shell, navigation, and theme switcher</li>
              <li>Chunk 5 — Pomodoro timer</li>
              <li>Chunk 6 — Focus Mode</li>
              <li>Chunks 7–9 — notes, boards, and sharing</li>
            </ul>
          </div>
        </div>

        {/* Kept from chunk 2 — a small diagnostic that stays useful. */}
        <div className="text-xs text-base-content/50 text-center">
          {db.state === "success" && db.data
            ? `Database OK — ${db.data.userCount} registered ${db.data.userCount === 1 ? "account" : "accounts"}`
            : db.state === "error"
              ? `Database unreachable: ${db.error}`
              : "Checking database…"}
        </div>
      </main>
    </div>
  );
}
