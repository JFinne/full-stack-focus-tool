/**
 * app.ts — the Express application itself.
 *
 * Notice what this file does NOT do: it never starts listening on a port. It
 * only builds the app and exports it. Starting the server is index.ts's job.
 *
 * Why split them? Two reasons, one now and one later:
 *
 *   1. (Later) Vercel runs your backend as a serverless function, which means
 *      Vercel owns the "listening" part — it hands your app a request directly.
 *      Because the app is exported separately, deploying will be a matter of
 *      importing this file, with no changes to the code inside it.
 *
 *   2. (Sooner) Automated tests can import this app and fire fake requests at
 *      it without ever opening a real network port.
 *
 * This is a common pattern and worth internalising: *building* a thing and
 * *running* a thing are separate responsibilities.
 */

import express from "express";
import { prisma } from "./lib/prisma.js";

// `express()` creates the application object. Everything else in this file is
// either attaching middleware to it or attaching routes to it.
const app = express();

/* ------------------------------------------------------------------ *
 * Middleware
 * ------------------------------------------------------------------ *
 * Middleware are functions that every incoming request passes through on its
 * way to a route handler — think of them as a series of checkpoints. Each one
 * can inspect the request, modify it, or stop it entirely.
 */

// Incoming request bodies arrive as a raw stream of bytes. This middleware
// watches for requests that say "my body is JSON", parses that JSON, and hands
// it to your route handlers as a ready-to-use object on `req.body`.
// Without this line, `req.body` would be undefined on every POST you write.
app.use(express.json());

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

/**
 * GET /api/health
 *
 * A "health check" — a deliberately trivial endpoint whose only job is to prove
 * the server is awake and reachable. Nearly every real backend has one, because
 * when something breaks, the first question is always "is the server even up?"
 * and you want an answer that doesn't depend on the database, auth, or anything
 * else that might itself be broken.
 *
 * For us right now it serves a second purpose: it's the first proof that the
 * browser can successfully talk to the server.
 */
app.get("/api/health", (_req, res) => {
  // The leading underscore in `_req` is a convention meaning "this parameter
  // exists because Express passes it, but I'm not using it." Our tsconfig has
  // `noUnusedParameters` turned on, and the underscore is how you tell
  // TypeScript that the omission is deliberate rather than an oversight.

  // `res.json(...)` sets the Content-Type header to application/json and
  // serialises the object for you.
  res.json({
    status: "ok",
    message: "Server is running.",
    // A timestamp makes it obvious whether you're seeing a fresh response or a
    // cached one — useful the first time something looks frozen.
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/health/db
 *
 * The health check's more demanding sibling: it proves the server can actually
 * reach the database, not merely that the server is awake.
 *
 * These are deliberately two separate endpoints. If the app breaks, "server up
 * but database unreachable" and "server down" are different problems with
 * different fixes, and you want to be able to tell them apart in one step.
 */
app.get("/api/health/db", async (_req, res) => {
  try {
    // `$queryRaw` runs literal SQL. `SELECT 1` is the traditional do-nothing
    // query — it touches no tables and returns a single row, so it tests the
    // connection and nothing else.
    //
    // The backtick-tagged template is Prisma's safe form: any values you
    // interpolate get sent as separate parameters rather than pasted into the
    // SQL string, which is what prevents SQL injection. There are no values
    // here, but it's worth knowing why the syntax looks like this.
    await prisma.$queryRaw`SELECT 1`;

    // Count the users table. Right now that's 0, which is exactly the point —
    // a successful count proves the table exists and the migration worked.
    const userCount = await prisma.user.count();

    res.json({
      status: "ok",
      message: "Database connection is healthy.",
      userCount,
    });
  } catch (error) {
    // 503 Service Unavailable is the honest status here: the server itself is
    // fine, but a service it depends on is not.
    console.error("[server] Database health check failed:", error);
    res.status(503).json({
      status: "error",
      message: "Could not reach the database.",
      detail: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * A catch-all for unmatched /api/* routes.
 *
 * Express's default behaviour for an unknown URL is to return an HTML error
 * page. That's fine for a website, but our /api routes are consumed by
 * JavaScript that expects JSON — handing it HTML produces a confusing parse
 * error rather than a useful message. So we answer in the format the caller
 * expects, even when the answer is "no such thing".
 *
 * The order matters: Express checks routes top to bottom, so this must come
 * after every real route or it would swallow them.
 */
app.use("/api", (req, res) => {
  res.status(404).json({
    error: "Not found",
    message: `No API route matches ${req.method} ${req.originalUrl}`,
  });
});

export default app;
