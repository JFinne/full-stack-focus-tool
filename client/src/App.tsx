import { Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AuthForm } from "./components/AuthForm";
import { AppLayout } from "./components/AppLayout";
import { HomePage } from "./pages/HomePage";
import { TimerPage } from "./pages/TimerPage";
import { NotesPage } from "./pages/NotesPage";
import { BoardsPage } from "./pages/BoardsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotFoundPage } from "./pages/NotFoundPage";

/**
 * App — the auth gate, and the route table for signed-in users.
 *
 * ## Why the gate wraps the routes instead of guarding each one
 *
 * A common alternative is to make every route check for a user and redirect to
 * /login if there isn't one. That works, but it repeats the check everywhere,
 * and any route you forget to guard is silently public — a mistake that's
 * invisible until someone finds it.
 *
 * Here the routes literally do not exist unless you're signed in. There's no
 * per-route check to forget, and no component below this point ever has to
 * handle "what if there's no user?" — they can assume one.
 *
 * A useful side effect: because the URL is untouched while signed out, someone
 * who opens /boards and has to sign in first lands on /boards afterwards,
 * rather than being dumped on the home page.
 *
 * (This is a *client-side* gate — it decides what to render, nothing more. It
 * is not security. Anyone can edit JavaScript in their own browser. The real
 * protection is requireAuth on the server, which is what actually refuses to
 * hand over data. A client gate is for user experience; a server check is for
 * safety. Never confuse the two.)
 */
function App() {
  const { user, status } = useAuth();

  // We can't know whether a session exists until the server answers, because
  // the cookie is httpOnly. Showing this instead of assuming "signed out"
  // avoids flashing the login form at users who are already signed in.
  if (status === "checking") {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <Routes>
      {/*
        A nested route. AppLayout renders at this level and everything below is
        rendered into its <Outlet />, so the navbar and sidebar stay mounted
        while the inner page changes.

        The child marked `index` is what shows when the URL matches the parent
        exactly — here, "/". It's the nested-routing equivalent of a default.
      */}
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="timer" element={<TimerPage />} />
        <Route path="notes" element={<NotesPage />} />
        <Route path="boards" element={<BoardsPage />} />
        <Route path="settings" element={<SettingsPage />} />

        {/* "*" matches anything not caught above. It sits inside the layout on
            purpose, so a mistyped URL still shows the navigation rather than
            stranding you on a bare page with no way back. */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
