import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTimer } from "../timer/TimerContext";
import { useDocumentTitle } from "../timer/useDocumentTitle";
import { PHASE_LABELS, formatDuration } from "../timer/timerLogic";

/**
 * AppLayout — the frame every signed-in page renders inside.
 *
 * The navbar and sidebar live here, and the current page renders into
 * <Outlet />. That's the core idea of nested routing: this component stays
 * mounted while you move between pages, so the sidebar doesn't flicker, its
 * scroll position survives, and any state it holds persists across navigation.
 *
 * Compare that to giving every page its own copy of the navigation — the
 * markup would be duplicated, and each navigation would tear down and rebuild
 * the whole chrome.
 */

/**
 * The navigation items, defined once.
 *
 * Both the sidebar and any future mobile menu read from this array, so adding a
 * tool means adding one entry rather than editing several lists and hoping they
 * stay in sync.
 *
 * `end` matters for the "/" route. React Router matches by prefix, so "/" would
 * count as active on *every* page. `end` says "only when the path matches
 * exactly." Without it, Home would be permanently highlighted.
 */
/**
 * A compact countdown in the navbar, linking back to the timer.
 *
 * Hidden while idle. A control that reads "25:00" when nothing is happening
 * invites you to wonder whether it's running — showing nothing is unambiguous.
 */
function TimerBadge() {
  const { phase, status, remainingMs } = useTimer();

  if (status === "idle") return null;

  return (
    <NavLink
      to="/timer"
      className="btn btn-sm btn-ghost gap-2 tabular-nums"
      title={`${PHASE_LABELS[phase]} — ${status === "paused" ? "paused" : "running"}`}
    >
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          status === "paused"
            ? "bg-base-content/40"
            : phase === "work"
              ? "bg-primary"
              : "bg-success"
        }`}
        aria-hidden="true"
      />
      {formatDuration(remainingMs)}
    </NavLink>
  );
}

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: "🏠", end: true },
  { to: "/timer", label: "Timer", icon: "⏱️" },
  { to: "/notes", label: "Notes", icon: "📝" },
  { to: "/boards", label: "Boards", icon: "🗂️" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

export function AppLayout() {
  const { user, logout } = useAuth();

  // Keeps the browser tab title in sync with the timer. Lives here rather than
  // on TimerPage because the whole point is to be visible from other pages —
  // and from other tabs entirely.
  useDocumentTitle();

  /**
   * Whether the slide-out drawer is open on narrow screens.
   *
   * DaisyUI's drawer is normally driven by a hidden checkbox and CSS alone,
   * with no JavaScript at all. We drive that checkbox from React state instead,
   * because we need to *close* the drawer when a link is clicked — otherwise
   * you'd tap a link on a phone and the menu would stay covering the page you
   * just navigated to.
   *
   * On large screens `lg:drawer-open` pins the sidebar open permanently and
   * this state stops mattering.
   */
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
      // No cleanup here: logout clears the user, App re-renders, and this whole
      // layout unmounts. Setting state afterwards would warn.
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <div className="drawer lg:drawer-open">
      {/* The checkbox DaisyUI's CSS keys off. Controlled by React so we can
          close it programmatically. */}
      <input
        id="nav-drawer"
        type="checkbox"
        className="drawer-toggle"
        checked={drawerOpen}
        onChange={(e) => setDrawerOpen(e.target.checked)}
      />

      {/* ---- Main column ---- */}
      <div className="drawer-content flex flex-col min-h-screen bg-base-200">
        <header className="navbar bg-base-100 shadow-sm sticky top-0 z-10">
          {/* Hamburger. `lg:hidden` hides it once the sidebar is always
              visible, since a button that toggles nothing would be confusing. */}
          <div className="flex-none lg:hidden">
            <label
              htmlFor="nav-drawer"
              className="btn btn-square btn-ghost"
              aria-label="Open navigation menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                // Decorative: the accessible name comes from the label above,
                // so a screen reader should skip the icon rather than announce
                // it twice.
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </label>
          </div>

          <div className="flex-1 px-2">
            <span className="text-lg font-semibold">Focus Tool</span>
          </div>

          <div className="flex-none gap-2 items-center">
            {/* A live timer readout, so you don't have to be on /timer to see
                it. Only shown when there's something to report. */}
            <TimerBadge />

            <span className="text-sm text-base-content/70 hidden sm:inline">
              {user?.displayName}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut && (
                <span className="loading loading-spinner loading-xs" />
              )}
              Sign out
            </button>
          </div>
        </header>

        {/* The current page renders here. */}
        <main className="flex-1 p-4">
          <div className="max-w-4xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ---- Sidebar ---- */}
      <div className="drawer-side z-20">
        {/* The dimmed backdrop on small screens. Clicking it closes the drawer,
            which people expect. */}
        <label
          htmlFor="nav-drawer"
          className="drawer-overlay"
          aria-label="Close navigation menu"
        />

        <aside className="bg-base-100 w-60 min-h-full flex flex-col">
          <div className="p-4 hidden lg:block">
            <span className="text-lg font-semibold">Focus Tool</span>
          </div>

          <nav className="p-2">
            <ul className="menu w-full gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  {/*
                    NavLink is Link plus awareness of whether it's active.
                    Passing a function to className receives { isActive }, which
                    saves us from comparing the current URL by hand.

                    Using NavLink rather than a plain <a> is what keeps this a
                    single-page app: <a> would trigger a full page load,
                    throwing away all React state including the auth context,
                    and the user would see a white flash on every click.
                  */}
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => (isActive ? "active" : "")}
                    onClick={() => setDrawerOpen(false)}
                  >
                    <span aria-hidden="true">{item.icon}</span>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </div>
  );
}
