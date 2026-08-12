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
 * Add-ons that Focus Mode is allowed to hide.
 *
 * Mirrors the `restrictable: true` entries in client/src/addons.ts. As with the
 * theme list, the client's copy exists for labels and this one is the
 * authority — a client can be modified by whoever runs it, so the server can
 * never simply trust the keys it's sent.
 *
 * Deliberately excludes "timer", "home", and "settings". Focus Mode ends by
 * pausing the timer, so a stored "timer" key would hide the exit.
 */
export const RESTRICTABLE_ADDON_KEYS = ["notes", "boards"] as const;

/**
 * Bounds on the timer durations.
 *
 * These are not arbitrary fussiness. Anyone can call this endpoint directly, so
 * without limits the stored value could be 0 (a phase that ends instantly and
 * loops forever), negative, a fraction, or 10 million (a timer that never
 * finishes). `.int()` matters as much as the range — a duration of 25.7 minutes
 * would sail through a plain number check and produce odd rounding downstream.
 *
 * The upper bounds are generous rather than opinionated. Someone who wants a
 * three-hour deep-work block should be allowed one; the limit exists to catch
 * nonsense, not to enforce my idea of a good study habit.
 */
const minutesField = (max: number, label: string) =>
  z
    .number()
    .int(`${label} must be a whole number of minutes`)
    .min(1, `${label} must be at least 1 minute`)
    .max(max, `${label} must be at most ${max} minutes`);

/**
 * PATCH, not PUT, and the distinction is meaningful.
 *
 * PUT means "replace this whole resource with what I'm sending" — omit a field
 * and you're saying to clear it. PATCH means "change the fields I mention and
 * leave the rest alone."
 *
 * Every field is therefore optional. A client that only wants to change the
 * theme shouldn't have to send the timer settings back untouched — and if it
 * did, two browser tabs saving different settings would overwrite each other.
 */
const updateSchema = z.object({
  theme: z.enum(AVAILABLE_THEMES).optional(),
  workMinutes: minutesField(180, "Focus length").optional(),
  shortBreakMinutes: minutesField(60, "Short break").optional(),
  longBreakMinutes: minutesField(60, "Long break").optional(),
  sessionsBeforeLongBreak: z
    .number()
    .int("Sessions before a long break must be a whole number")
    .min(1, "There must be at least 1 session before a long break")
    .max(12, "There can be at most 12 sessions before a long break")
    .optional(),
  soundEnabled: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional(),

  /**
   * Add-on keys to hide during focus phases.
   *
   * Validated against a fixed list rather than accepting any strings. Without
   * that, this column would slowly fill with typos and keys from features that
   * no longer exist, and nothing would ever clean it up.
   *
   * `.transform` deduplicates. Postgres arrays permit repeats, and a duplicate
   * here is meaningless — hiding "notes" twice is still hiding it once — so we
   * normalise on the way in rather than defending against it on every read.
   *
   * Note the order, which caused a real bug on the first attempt. Zod applies
   * checks *before* transforms, so a `.max(2)` here saw the raw array — and
   * `["notes","notes","boards","notes"]` was rejected as "too many" despite
   * collapsing to two entries. The limit now bounds the *input* generously
   * (so a caller can't post a million-element array) and lets dedup produce
   * the real result, which the enum already caps at the number of valid keys.
   */
  focusHiddenAddons: z
    .array(z.enum(RESTRICTABLE_ADDON_KEYS))
    .max(100, "Too many add-ons listed")
    .transform((keys) => [...new Set(keys)])
    .optional(),
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
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  soundEnabled: true,
  notificationsEnabled: false,
  focusHiddenAddons: [] as string[],
};

/**
 * The columns we return. Declared once so GET and PATCH can't drift apart —
 * a mismatch there would mean saving a setting and getting a different shape
 * back than the one you'd read a moment earlier.
 */
const PREFERENCE_FIELDS = {
  theme: true,
  workMinutes: true,
  shortBreakMinutes: true,
  longBreakMinutes: true,
  sessionsBeforeLongBreak: true,
  soundEnabled: true,
  notificationsEnabled: true,
  focusHiddenAddons: true,
} as const;

preferencesRouter.get("/", requireAuth, async (req, res) => {
  try {
    const prefs = await prisma.userPreferences.findUnique({
      where: { userId: req.user!.id },
      select: PREFERENCE_FIELDS,
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
    // Map each complaint back to the field it's about. An earlier version of
    // this handler hardcoded "theme" as the key, which meant an invalid
    // workMinutes would show its error under the theme setting — the message
    // was right and pointed at the wrong input.
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !fields[field]) {
        fields[field] = issue.message;
      }
    }

    res.status(400).json({ error: "Invalid input", fields });
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
      select: PREFERENCE_FIELDS,
    });

    res.json({ preferences: prefs });
  } catch (error) {
    console.error("[preferences] Failed to update:", error);
    res.status(500).json({ error: "Could not save preferences" });
  }
});
