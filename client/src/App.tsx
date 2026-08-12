import { useAuth } from "./auth/AuthContext";
import { AuthForm } from "./components/AuthForm";
import { Dashboard } from "./components/Dashboard";

/**
 * App — decides which of the two worlds you're in.
 *
 * The entire gate is the three branches below. There is no routing yet and no
 * "redirect to /login", because there are no routes: signed out shows the form,
 * signed in shows the dashboard.
 *
 * Why no React Router yet? Because we don't have distinct pages to route
 * between. Adding routing now would mean maintaining a routing setup whose only
 * job is to express a boolean. We'll add it in chunk 4, when the dashboard
 * genuinely needs separate views for timer, notes, and boards — and it'll be
 * easier to set up correctly once we can see what the real routes are.
 *
 * The important structural point: because this gate lives at the top, no
 * component below it ever has to ask "but what if there's no user?" Dashboard
 * and everything it contains can assume a signed-in user exists.
 */
function App() {
  const { user, status } = useAuth();

  /**
   * The "checking" branch is not optional politeness — it prevents a real bug.
   *
   * On page load we don't yet know whether there's a valid session, because the
   * cookie is httpOnly and only the server can tell us. Without this branch,
   * that gap would be indistinguishable from "signed out", so every refresh
   * would flash the login form at an already-signed-in user before snapping to
   * the dashboard.
   */
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

  return <Dashboard />;
}

export default App;
