/**
 * session.ts — creating, checking, and destroying login sessions.
 *
 * The whole mechanism in four steps:
 *
 *   1. On login we generate a long random string: the session *token*.
 *   2. We store SHA-256(token) in the sessions table — never the token itself.
 *   3. We send the token to the browser in a cookie.
 *   4. On every later request the browser sends the cookie back; we hash it and
 *      look for a matching row.
 *
 * The thing to understand is that a session token is a *bearer* credential:
 * whoever holds it is treated as that user, no questions asked. That's why so
 * much of this file is about limiting where the token can go and how long it
 * stays useful.
 */

import { randomBytes, createHash } from "node:crypto";
import type { Response } from "express";
import { prisma } from "./prisma.js";

/** The cookie name the token travels in. */
export const SESSION_COOKIE = "focus_session";

/** How long a new session lasts. */
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * When a session has less than this left, using it extends it again.
 *
 * This is what stops you being logged out mid-semester. Without renewal, a
 * fixed 30-day expiry logs out even users who visit daily. Without *any*
 * expiry, a stolen cookie would work forever. Renewing only when the session is
 * more than half spent gives you both: active users stay signed in, abandoned
 * sessions still die, and we avoid a database write on every single request.
 */
const RENEW_WHEN_REMAINING_MS = 15 * 24 * 60 * 60 * 1000; // 15 days

/**
 * Hash a token into the id we store.
 *
 * SHA-256 is deliberately fast here — unlike passwords. A 256-bit random token
 * can't be guessed no matter how fast an attacker hashes, so the only property
 * we need is irreversibility, and this runs on every authenticated request.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Create a session for a user and return the raw token.
 *
 * This is the only time the raw token exists — we hand it straight to the
 * browser and keep only its hash. If a user loses the cookie, there is no way
 * to recover the token; they simply log in again and get a new one.
 */
export async function createSession(userId: string): Promise<string> {
  // 32 bytes = 256 bits of randomness from the OS's cryptographic generator.
  //
  // It must be `randomBytes` and not `Math.random()`. Math.random is fast and
  // statistically fine for shuffling a list, but its output is predictable to
  // anyone who observes enough of it — which for a session token means an
  // attacker forging logins.
  //
  // base64url encodes those bytes as text that's safe in a cookie (no +, /, or
  // = characters needing escaping).
  const token = randomBytes(32).toString("base64url");

  await prisma.session.create({
    data: {
      id: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    },
  });

  return token;
}

/** What a successful session lookup gives back. */
export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
};

/**
 * Look up the user for a session token, or null if it isn't valid.
 *
 * Returns null when the token is missing, unknown, or expired — all three are
 * the same thing from the caller's point of view: not logged in.
 */
export async function validateSession(
  token: string | undefined,
): Promise<SessionUser | null> {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    // `include` pulls the related user row in the same query — one round trip
    // to the database instead of two.
    include: {
      user: {
        // `select` limits which columns come back. We deliberately do not
        // select passwordHash: data you never load is data you can never leak
        // by accident into a log or an API response.
        select: { id: true, email: true, displayName: true },
      },
    },
  });

  if (!session) return null;

  // Expiry is enforced here, in code, on every request.
  //
  // Postgres won't delete the row for us when the clock passes expiresAt — the
  // database has no concept of "this row should stop counting now." Expired
  // rows simply sit there until something removes them, so the check has to
  // happen on read.
  if (session.expiresAt.getTime() < Date.now()) {
    // Clean up as we go, so expired sessions don't accumulate forever.
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {
      // Already gone (e.g. two requests raced). Nothing to do — the outcome we
      // wanted has happened either way.
    });
    return null;
  }

  // Sliding renewal, as described at the top of this file.
  const remaining = session.expiresAt.getTime() - Date.now();
  if (remaining < RENEW_WHEN_REMAINING_MS) {
    await prisma.session
      .update({
        where: { id: session.id },
        data: { expiresAt: new Date(Date.now() + SESSION_DURATION_MS) },
      })
      .catch(() => {
        // A failed renewal is harmless — the session is still valid right now,
        // and the next request will try again. Not worth failing the request.
      });
  }

  return session.user;
}

/** Delete a single session — this is what logging out does. */
export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.session
    .delete({ where: { id: hashToken(token) } })
    .catch(() => {
      // Deleting a session that doesn't exist is not a failure. The caller
      // wanted it gone; it's gone.
    });
}

/**
 * Attach the session cookie to a response.
 *
 * Every option here is a security decision:
 *
 * httpOnly — JavaScript in the page cannot read this cookie. If an attacker
 *   ever manages to inject a script into our site (an XSS bug), this is what
 *   stops them from simply reading the token and copying it to their server.
 *   The browser still sends it automatically; our own client code never needs
 *   to touch it.
 *
 * sameSite: "lax" — the browser won't attach this cookie to requests triggered
 *   by *other* sites. Without it, a malicious page could quietly fire a request
 *   at our API and the browser would helpfully include your login cookie — an
 *   attack called CSRF. "lax" still sends the cookie when you click a link to
 *   our site, so normal navigation works.
 *
 * secure — the cookie is only sent over HTTPS. Enabled in production only,
 *   because local development is plain HTTP and the cookie would never be sent
 *   at all.
 *
 * path: "/" — sent for every route on our domain.
 *
 * maxAge — how long the browser keeps it. Matched to the database expiry so the
 *   two don't disagree. Note this is only a hint to the browser: the real
 *   enforcement is the expiresAt check in validateSession, because a cookie is
 *   just text the client could keep and replay for as long as it likes.
 */
export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_MS,
  });
}

/** Remove the session cookie from the browser. */
export function clearSessionCookie(res: Response): void {
  // The options must match those used to set it, or the browser treats it as a
  // different cookie and quietly leaves the original in place.
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}
