/**
 * index.ts — the entry point that actually starts the server.
 *
 * This is the file `npm run dev` executes. Its entire job is to take the app
 * built in app.ts and put it on a port so it can receive real network traffic.
 */

// This must come first, before anything that reads process.env.
//
// It loads the .env file into process.env. ES module imports run top to bottom,
// so putting it above the app import guarantees DATABASE_URL is available by
// the time the database client is created.
//
// In production this does nothing useful and that's fine — Vercel injects
// environment variables directly and there is no .env file to find.
import "dotenv/config";

// Note the ".js" extension on a file that is really app.ts.
//
// This is not a typo. Our tsconfig uses Node's own module resolution, which
// means imports have to name the file as it will exist *after* TypeScript
// compiles it — and compiled TypeScript is JavaScript. TypeScript is smart
// enough to follow this back to app.ts while you're editing.
//
// It trips up nearly everyone once. Now it won't trip up you.
import app from "./app.js";

/**
 * Which port to listen on.
 *
 * `process.env` holds environment variables — configuration that lives outside
 * your code. We read PORT from it so that a hosting provider can tell us which
 * port to use, and fall back to 3000 when nothing is set (i.e. on your laptop).
 *
 * Environment variables are always strings, so `Number(...)` converts it. The
 * `??` is the nullish-coalescing operator: "use the left side unless it's null
 * or undefined, otherwise use the right side."
 */
const PORT = Number(process.env.PORT ?? 3000);

app.listen(PORT, () => {
  // This callback runs once the server is successfully listening.
  console.log(`[server] Listening on http://localhost:${PORT}`);
  console.log(`[server] Health check: http://localhost:${PORT}/api/health`);
});
