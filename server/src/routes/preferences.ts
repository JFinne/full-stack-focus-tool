/**
 * preferences.ts — reading and updating user settings.
 *
 *   GET   /api/preferences   the signed-in user's settings
 *   PATCH /api/preferences   change some of them
 *
 * Both require a signed-in user. Preferences are per-account, and there is
 * nothing sensible to return for nobody.
 */

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const preferencesRouter = Router();

/**
 * The themes the app offers.
 *
 * This list is the authority. The client has its own copy for rendering the
 * picker (it also needs each theme's label), but the server validates against
 * *this* one — because the client's copy is just a suggestion that anyone can
 * ignore by calling the API directly.
 *
 * "system" isn't a DaisyUI theme; it means "don't set one, follow the OS." The
 * others must match themes enabled in client/src/index.css, or selecting one
 * would silently do nothing.
 */
export const AVAILABLE_THEMES = [
  "system",
  "light",
  "dark",
  "cupcake",
  "nord",
  "forest",
  "dracula",
  "retro",
  "synthwave",
] as const;

/**
 * PATCH, not PUT, and the distinction is meaningful.
 *
 * PUT means "replace this whole resource with what I'm sending" — omit a field
 * and you're saying to clear it. PATCH means "change the fields I mention and
 * leave the rest alone."
 *
 * Every field is therefore optional. As preferences grow, a client that only
 * wants to change the theme shouldn't have to send the Pomodoro settings back
 * untouched — and if it did, two browser tabs saving different settings would
 * overwrite each other's changes.
 */
const updateSchema = z.object({
  theme: z.enum(AVAILABLE_THEMES).optional(),
});

/**
 * Defaults for a user who has never saved a setting.
 *
 * Preferences rows are created lazily — on first save, not at registration.
 * That means we never write a row for someone who never changes anything, and
 * more importantly, adding a new preference later doesn't require backfilling
 * every existing user. The default lives in one place and applies to everyone
 * who hasn't overridden it.
 *
 * The cost is that "no row" has to mean "defaults" everywhere we read. That's
 * this function's job.
 */
const DEFAULT_PREFERENCES = {
  theme: "system",
};

preferencesRouter.get("/", requireAuth, async (req, res) => {
  try {
    const prefs = await prisma.userPreferences.findUnique({
      where: { userId: req.user!.id },
      select: { theme: true },
    });

    // No row is normal, not an error.
    res.json({ preferences: prefs ?? DEFAULT_PREFERENCES });
  } catch (error) {
    console.error("[preferences] Failed to load:", error);
    res.status(500).json({ error: "Could not load preferences" });
  }
});

preferencesRouter.patch("/", requireAuth, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid input",
      // z.enum produces a message listing the valid options, which is exactly
      // what a client sending a bad theme needs to see.
      fields: { theme: parsed.error.issues[0]?.message ?? "Invalid value" },
    });
    return;
  }

  // An empty PATCH is valid but pointless — nothing to do.
  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "No changes provided" });
    return;
  }

  try {
    /**
     * `upsert` = update if the row exists, create it if it doesn't.
     *
     * This is what makes lazy creation work. Without it we'd have to check for
     * a row, then branch to create or update — two steps with a race between
     * them, the same problem we solved with the unique index during signup.
     * upsert is a single statement the database resolves atomically.
     */
    const prefs = await prisma.userPreferences.upsert({
      where: { userId: req.user!.id },
      // Applied when the row already exists.
      update: parsed.data,
      // Applied when it doesn't. Defaults fill anything not being set now.
      create: {
        userId: req.user!.id,
        ...DEFAULT_PREFERENCES,
        ...parsed.data,
      },
      select: { theme: true },
    });

    res.json({ preferences: prefs });
  } catch (error) {
    console.error("[preferences] Failed to update:", error);
    res.status(500).json({ error: "Could not save preferences" });
  }
});
