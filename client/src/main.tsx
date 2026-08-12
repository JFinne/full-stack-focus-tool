import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./auth/AuthProvider.tsx";
import { ThemeProvider } from "./theme/ThemeProvider.tsx";

/**
 * main.tsx — where React attaches to the page.
 *
 * The nesting order matters:
 *
 *   BrowserRouter   makes the URL available to everything inside
 *     AuthProvider  makes the current user available to everything inside
 *       App         reads both
 *
 * BrowserRouter goes outermost because it's the more fundamental context — and
 * because AuthProvider may eventually want to navigate (redirecting after a
 * session expires, say), which requires being inside the router.
 *
 * BrowserRouter uses the browser's real History API, so URLs look like
 * /settings rather than /#/settings. That's nicer, but it does mean the server
 * has to answer every path with index.html — otherwise refreshing on /settings
 * asks the server for a file that doesn't exist. Vite's dev server handles this
 * automatically; on Vercel it needs a rewrite rule, which we'll add at deploy.
 *
 * StrictMode is development-only and deliberately runs effects twice to surface
 * cleanup bugs. If you see a request fire twice in the network tab, that's this.
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        {/* Inside AuthProvider because it needs to know who's signed in, to
            load their saved theme and save changes back to their account. */}
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
