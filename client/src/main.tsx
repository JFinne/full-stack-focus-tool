import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./auth/AuthProvider.tsx";

/**
 * main.tsx — where React attaches to the page.
 *
 * AuthProvider wraps App, which is what makes useAuth() work anywhere inside.
 * A provider only serves components *below* it in the tree, so this has to sit
 * above everything that needs auth — which, here, is everything.
 *
 * StrictMode is a development-only wrapper that deliberately runs effects
 * twice (mount, unmount, mount again) to surface bugs in cleanup logic. If you
 * see a request fire twice in the network tab during development, that's this,
 * and it's why our effects use the `active` flag pattern. It does not happen in
 * production builds.
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
