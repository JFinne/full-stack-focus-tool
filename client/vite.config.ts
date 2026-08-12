import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Enables JSX and React Fast Refresh (your edits appear in the browser
    // without a full page reload, and without losing component state).
    react(),

    // Tailwind v4 runs as a Vite plugin. It scans your source files for class
    // names and generates only the CSS you actually used.
    tailwindcss(),
  ],

  server: {
    port: 5173,

    /**
     * THE PROXY — this is the most important part of this file.
     *
     * In development you run two servers: Vite on port 5173 (serving the React
     * app) and Express on port 3000 (serving the API). To a browser, those are
     * two *different origins*, and browsers block a page from one origin
     * calling another by default. That security rule is called CORS, and it is
     * the single most common source of "why is my fetch failing?" frustration.
     *
     * Rather than fighting it, we sidestep it. This config tells Vite: "if the
     * app requests a URL starting with /api, don't try to serve it yourself —
     * quietly forward it to localhost:3000 and pass the answer back."
     *
     * So the browser only ever talks to one origin (5173) and CORS never
     * applies. In your React code you write `fetch("/api/health")` — no host,
     * no port, no CORS configuration anywhere.
     *
     * The bonus: this mirrors production exactly. On Vercel, the client and the
     * API are served from the same domain too, so `fetch("/api/health")` is
     * literally the same line of code there. Dev and prod behave alike, which
     * is worth a great deal.
     */
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
