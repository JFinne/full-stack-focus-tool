/**
 * auth.ts — middleware for reading and requiring the current user.
 *
 * Two functions with a deliberate division of labour:
 *
 *   attachUser  — always runs, never blocks. Says who you are, if anyone.
 *   requireAuth — blocks the request unless you're signed in.
 *
 * Keeping "figure out who this is" separate from "insist on someone" matters,
 * because plenty of routes want the first without the second. A shared board
 * viewed by a stranger should still render; it just renders differently than it
 * would for its owner.
 */

import type { Request, Response, NextFunction } from "express";
import { SESSION_COOKIE, validateSession } from "../lib/session.js";

/**
 * Look up the session cookie and attach the user to the request.
 *
 * Runs on every request. If there's no valid session it does nothing and
 * carries on — being signed out is not an error.
 *
 * `next()` is how middleware says "I'm done, continue to the next handler."
 * Forget to call it and the request hangs forever with no error message, which
 * is a genuinely confusing bug the first time you cause it.
 */
export async function attachUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    const user = await validateSession(token);
    if (user) req.user = user;
  } catch (error) {
    // A database hiccup while checking the session shouldn't take down requests
    // that don't need auth at all. Log it and continue as a signed-out visitor;
    // any route that actually requires a user will refuse below.
    console.error("[auth] Failed to validate session:", error);
  }

  next();
}

/**
 * Refuse the request unless a user is signed in.
 *
 * Put this on any route that needs a user. It must run *after* attachUser, and
 * it doesn't repeat that lookup — it just checks the result.
 *
 * Note there is no `next()` on the rejection path. Sending a response and
 * calling next() would try to respond twice, which throws a "headers already
 * sent" error. Once you've answered, you stop.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    // 401 Unauthorized means "I don't know who you are" — the correct status
    // when credentials are missing or invalid. (403 Forbidden is the different
    // case: "I know who you are, and you may not do this." We'll need that one
    // when we build sharing.)
    res.status(401).json({
      error: "Unauthorized",
      message: "You must be signed in to do that.",
    });
    return;
  }

  next();
}
