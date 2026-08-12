import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useApiStatus } from "../hooks/useApiStatus";

/**
 * HomePage — the landing view once signed in.
 *
 * For now it's a welcome and some signposting. Once the tools exist this is
 * where the day's overview belongs: today's tasks, the timer's current state,
 * whatever you'd want to see first.
 */

type DbHealthResponse = {
  status: string;
  message: string;
  userCount: number;
};

/** What's built and what isn't — a visible progress marker. */
const TOOLS = [
  {
    to: "/timer",
    name: "Pomodoro Timer",
    detail: "Work intervals and Focus Mode",
    ready: false,
  },
  {
    to: "/notes",
    name: "Notes",
    detail: "Documents, shareable later",
    ready: false,
  },
  {
    to: "/boards",
    name: "Boards",
    detail: "Lists and cards for assignments",
    ready: false,
  },
  {
    to: "/settings",
    name: "Settings",
    detail: "Themes and preferences",
    ready: false,
  },
];

export function HomePage() {
  const { user } = useAuth();
  const db = useApiStatus<DbHealthResponse>("/api/health/db");

  return (
    <div className="space-y-4">
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h1 className="card-title">Welcome back, {user?.displayName}</h1>
          <p className="text-base-content/70 text-sm">
            Signed in as {user?.email}. The navigation and layout are real —
            the tools behind them are what we build next.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          // Link renders an <a> but intercepts the click, so navigation happens
          // in JavaScript without a full page reload. Using a raw <a href> here
          // would reload the app and throw away the auth context.
          <Link
            key={tool.to}
            to={tool.to}
            className="card bg-base-100 shadow hover:shadow-md transition-shadow"
          >
            <div className="card-body p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-medium">{tool.name}</h2>
                {!tool.ready && (
                  <span className="badge badge-ghost badge-sm shrink-0">
                    Soon
                  </span>
                )}
              </div>
              <p className="text-xs text-base-content/60">{tool.detail}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="text-xs text-base-content/50 text-center">
        {db.state === "success" && db.data
          ? `Database OK — ${db.data.userCount} registered ${db.data.userCount === 1 ? "account" : "accounts"}`
          : db.state === "error"
            ? `Database unreachable: ${db.error}`
            : "Checking database…"}
      </div>
    </div>
  );
}
