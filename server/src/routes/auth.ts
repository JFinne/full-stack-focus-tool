/**
 * auth.ts — the authentication endpoints.
 *
 *   POST /api/auth/register  create an account and sign in
 *   POST /api/auth/login     sign in
 *   POST /api/auth/logout    sign out
 *   GET  /api/auth/me        who am I?
 *
 * These are grouped into an Express Router: a mini-app you can mount at a path.
 * app.ts mounts this at /api/auth, so the route declared here as "/login" is
 * really /api/auth/login. Grouping keeps app.ts readable as the project grows —
 * boards, notes, and the rest will each get their own router.
 */

import { Router } from "express";
import { z } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import {
  hashPassword,
  verifyPassword,
  getDummyHash,
} from "../lib/password.js";
import {
  createSession,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
  SESSION_COOKIE,
} from "../lib/session.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

/* ------------------------------------------------------------------ *
 * Input validation
 * ------------------------------------------------------------------ *
 * Never trust the request body. It arrives from the network and can contain
 * anything at all — a missing field, a number where a string belongs, a
 * 10-megabyte string, or a deliberately malicious payload. The browser form we
 * build in chunk 3b is a convenience for honest users, not a constraint on
 * anyone else; anyone can send whatever they like with curl.
 *
 * Zod checks the shape at runtime and, as a bonus, TypeScript infers the types
 * from these schemas. So the validation and the type stay in sync by
 * construction, rather than by us remembering to update both.
 */

const registerSchema = z.object({
  // .trim() and .toLowerCase() normalise before validating, so " Sam@X.com "
  // and "sam@x.com" become the same account. Postgres string comparison is
  // case-sensitive, so without this you could register the same address twice.
  email: z.email("Enter a valid email address").trim().toLowerCase(),

  // A minimum length is the single most effective password rule. We do not
  // require symbols or mixed case: those rules push people toward "P@ssw0rd!"
  // — short, predictable, and annoying — while a long passphrase is both easier
  // to remember and far harder to crack. Current NIST guidance says to require
  // length and stop there.
  //
  // The maximum isn't a security rule but a denial-of-service guard: argon2 is
  // deliberately expensive, so hashing an unbounded string would let anyone tie
  // up the server with one request.
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200, "Password must be at most 200 characters"),

  displayName: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(50, "Display name must be at most 50 characters"),
});

const loginSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

/**
 * Turn Zod's error into a simple field → message map for the UI.
 *
 * Zod's native error shape is detailed and awkward to render. Flattening it
 * here means the client can do `errors.email` without knowing anything about
 * Zod, and it keeps our API's error format stable if we ever swap validators.
 */
function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    // Keep the first error per field — showing someone three complaints about
    // one input at once is noise.
    if (typeof field === "string" && !result[field]) {
      result[field] = issue.message;
    }
  }
  return result;
}

/* ------------------------------------------------------------------ *
 * POST /api/auth/register
 * ------------------------------------------------------------------ */

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    // 400 Bad Request: the request itself is malformed.
    res.status(400).json({
      error: "Invalid input",
      fields: fieldErrors(parsed.error),
    });
    return;
  }

  const { email, password, displayName } = parsed.data;

  try {
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: { email, passwordHash, displayName },
      // Select explicitly so passwordHash can't accidentally ride along into
      // the response. Being deliberate about what leaves this function is
      // cheaper than auditing later.
      select: { id: true, email: true, displayName: true },
    });

    // Registering signs you in — there's no reason to make someone type the
    // password they just chose.
    const token = await createSession(user.id);
    setSessionCookie(res, token);

    // 201 Created: a new resource exists because of this request.
    res.status(201).json({ user });
  } catch (error) {
    /**
     * Handling the duplicate-email case.
     *
     * We could check "does this email exist?" before inserting, but that check
     * and the insert are two separate steps, and two signups arriving at the
     * same instant could both pass the check before either inserts. The window
     * is small but real.
     *
     * So we let the database's unique index be the referee — it cannot be
     * raced — and handle the specific error it raises. P2002 is Prisma's code
     * for "unique constraint violated."
     *
     * This is worth internalising as a pattern: prefer letting the database
     * enforce a rule and reacting to the failure, over checking first and
     * hoping nothing changes in between.
     */
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // 409 Conflict: the request is well-formed but clashes with existing state.
      //
      // Note this does reveal that an email is registered. That's a real
      // privacy trade-off and it's unavoidable here: we cannot let two people
      // share an address, so we must say no. (Login is different — see below —
      // because there we *can* stay quiet, and so we do.)
      res.status(409).json({
        error: "Email already registered",
        fields: { email: "An account with that email already exists" },
      });
      return;
    }

    console.error("[auth] Registration failed:", error);
    res.status(500).json({ error: "Could not create account" });
  }
});

/* ------------------------------------------------------------------ *
 * POST /api/auth/login
 * ------------------------------------------------------------------ */

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid input",
      fields: fieldErrors(parsed.error),
    });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    /**
     * Deliberately wasting time when the account doesn't exist.
     *
     * The obvious code returns early here. But argon2 verification takes
     * roughly 50ms, so "no such user" would answer almost instantly while
     * "wrong password" took 50ms. That difference is measurable over the
     * network, and it turns this endpoint into a tool for discovering which
     * email addresses have accounts — even though the message says nothing.
     *
     * Verifying against a throwaway hash costs the same time as a real check,
     * so both paths take equally long and the timing reveals nothing. This is a
     * *timing side channel*: a leak through how long something takes rather
     * than what it says. Worth knowing they exist — they're easy to introduce
     * by accident.
     */
    if (!user) {
      await verifyPassword(await getDummyHash(), password);
      res.status(401).json({
        error: "Invalid credentials",
        message: "Email or password is incorrect.",
      });
      return;
    }

    const valid = await verifyPassword(user.passwordHash, password);

    if (!valid) {
      // The identical message and status as above, on purpose. Saying "no
      // account with that email" versus "wrong password" would hand an attacker
      // a free way to enumerate who has an account here.
      res.status(401).json({
        error: "Invalid credentials",
        message: "Email or password is incorrect.",
      });
      return;
    }

    const token = await createSession(user.id);
    setSessionCookie(res, token);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    });
  } catch (error) {
    console.error("[auth] Login failed:", error);
    res.status(500).json({ error: "Could not sign in" });
  }
});

/* ------------------------------------------------------------------ *
 * POST /api/auth/logout
 * ------------------------------------------------------------------ */

/**
 * Why POST and not GET.
 *
 * GET requests are supposed to be safe to repeat and to trigger without
 * intent — browsers prefetch them, and anything can embed one. A GET /logout
 * means an <img src="/api/auth/logout"> on any page could sign you out. POST
 * carries the meaning "this changes something," and combined with the cookie's
 * sameSite setting it can't be fired from another site.
 */
authRouter.post("/logout", async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;

  // Delete the row so the token stops working everywhere — not just in this
  // browser. Clearing the cookie alone would leave a valid session behind for
  // anyone who copied it.
  await destroySession(token);
  clearSessionCookie(res);

  // Logging out when already logged out is a success. The caller wanted to be
  // signed out; they are.
  res.json({ success: true });
});

/* ------------------------------------------------------------------ *
 * GET /api/auth/me
 * ------------------------------------------------------------------ */

/**
 * Returns the signed-in user, or 401.
 *
 * This is how the React app answers "am I logged in?" on page load. The session
 * cookie is httpOnly, so client JavaScript cannot read it — the only way to
 * find out is to ask the server. That's the trade: the client can't inspect its
 * own credential, which is precisely what keeps a script from stealing it.
 */
authRouter.get("/me", requireAuth, (req, res) => {
  // requireAuth guarantees req.user exists, but TypeScript can't know that a
  // middleware ran. The `!` is us telling the compiler we're sure — which is
  // only safe because requireAuth is right there in the route definition.
  res.json({ user: req.user! });
});
