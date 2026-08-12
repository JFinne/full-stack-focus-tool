/**
 * notes.ts — CRUD for notes.
 *
 *   GET    /api/notes      list your notes (metadata only)
 *   POST   /api/notes      create one
 *   GET    /api/notes/:id  read one, with content
 *   PATCH  /api/notes/:id  update title and/or content
 *   DELETE /api/notes/:id  delete one
 *
 * ============================================================================
 * OWNERSHIP: the thing this file is really about
 * ============================================================================
 *
 * Until now every table held one row per user, so "is this yours?" was answered
 * by the lookup itself — your preferences are the row with your id.
 *
 * Notes are different. `GET /api/notes/:id` takes an id straight off the
 * network, and someone else's note id is just as valid a string as your own.
 * Nothing about the request distinguishes them.
 *
 * The tempting shape is:
 *
 *     const note = await prisma.note.findUnique({ where: { id } });
 *     if (note.ownerId !== req.user.id) return res.status(403)...
 *
 * That works, but it is fragile in a specific way: the check is a *separate
 * step* that a future edit can forget, and forgetting it fails open — the
 * endpoint keeps working perfectly for the person testing it, and quietly
 * serves everyone else's data too. Bugs that only appear for the attacker are
 * the ones that reach production.
 *
 * So instead, ownership goes *into the query*:
 *
 *     where: { id, ownerId: req.user.id }
 *
 * Now there is no separate check to omit. A note that isn't yours simply isn't
 * found — the database never returns it, so no code path exists that could leak
 * it. **Make the safe thing the only thing the query can express.**
 *
 * ---------------------------------------------------------------------------
 * Why 404 and not 403
 * ---------------------------------------------------------------------------
 *
 * When you request a note that exists but isn't yours, this returns 404 Not
 * Found rather than 403 Forbidden.
 *
 * 403 would be more literally accurate — the note does exist, you're just not
 * allowed. But that accuracy leaks information: an attacker could walk through
 * ids and learn which ones are real, because 403 and 404 tell them apart. With
 * both cases returning 404, "doesn't exist" and "not yours" are indistinguishable
 * from outside.
 *
 * (Our ids are random cuids, so guessing them is impractical anyway. This
 * matters more as a habit than as a defence here — and it's free.)
 */

import { Router } from "express";
import { z } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const notesRouter = Router();

/**
 * Everything here needs a signed-in user.
 *
 * Applying requireAuth once to the whole router rather than repeating it on
 * each route is the same fail-safe reasoning as above: there's no per-route
 * decision to get wrong, and a route added later is protected by default rather
 * than by remembering.
 */
notesRouter.use(requireAuth);

/**
 * Length caps.
 *
 * These protect the server rather than describing the data. Without them a
 * single request could store an arbitrarily large document, and the cost lands
 * on every later read. 100k characters is roughly a 200-page essay — generous
 * enough that no real note hits it.
 */
const MAX_TITLE = 200;
const MAX_CONTENT = 100_000;

const createSchema = z.object({
  title: z.string().max(MAX_TITLE, `Title must be at most ${MAX_TITLE} characters`).optional(),
  content: z.string().max(MAX_CONTENT, "Note is too long").optional(),
});

const updateSchema = z.object({
  title: z.string().max(MAX_TITLE, `Title must be at most ${MAX_TITLE} characters`).optional(),
  content: z.string().max(MAX_CONTENT, "Note is too long").optional(),
});

function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !result[field]) {
      result[field] = issue.message;
    }
  }
  return result;
}

/* ------------------------------------------------------------------ *
 * GET /api/notes — list
 * ------------------------------------------------------------------ */

notesRouter.get("/", async (req, res) => {
  try {
    const notes = await prisma.note.findMany({
      where: { ownerId: req.user!.id },
      orderBy: { updatedAt: "desc" },
      /**
       * Deliberately NOT selecting `content`.
       *
       * A list of fifty notes would otherwise ship fifty full documents to
       * render fifty titles. The list needs enough for a row; the detail
       * endpoint provides the rest.
       *
       * This is worth internalising early: an endpoint returning "the whole
       * object" is a habit that gets expensive silently, because it works fine
       * until someone's data grows.
       */
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ notes });
  } catch (error) {
    console.error("[notes] Failed to list:", error);
    res.status(500).json({ error: "Could not load notes" });
  }
});

/* ------------------------------------------------------------------ *
 * POST /api/notes — create
 * ------------------------------------------------------------------ */

notesRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", fields: fieldErrors(parsed.error) });
    return;
  }

  try {
    const note = await prisma.note.create({
      data: {
        // The owner comes from the *session*, never from the request body.
        //
        // This is the single most important line in the file. If ownerId were
        // accepted from the client, anyone could create notes belonging to
        // anyone else — and later, with sharing, read them back.
        ownerId: req.user!.id,
        title: parsed.data.title ?? "",
        content: parsed.data.content ?? "",
      },
      select: { id: true, title: true, content: true, createdAt: true, updatedAt: true },
    });

    res.status(201).json({ note });
  } catch (error) {
    console.error("[notes] Failed to create:", error);
    res.status(500).json({ error: "Could not create note" });
  }
});

/* ------------------------------------------------------------------ *
 * GET /api/notes/:id — read one
 * ------------------------------------------------------------------ */

notesRouter.get("/:id", async (req, res) => {
  try {
    /**
     * `findFirst`, not `findUnique`.
     *
     * findUnique only accepts unique fields, so it can't take ownerId — which
     * would force the ownership check into a separate `if`. findFirst accepts
     * any filter, letting ownership live inside the query where it can't be
     * skipped.
     */
    const note = await prisma.note.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
      select: { id: true, title: true, content: true, createdAt: true, updatedAt: true },
    });

    if (!note) {
      // Covers both "no such note" and "not yours" — see the header comment.
      res.status(404).json({ error: "Note not found" });
      return;
    }

    res.json({ note });
  } catch (error) {
    console.error("[notes] Failed to load:", error);
    res.status(500).json({ error: "Could not load note" });
  }
});

/* ------------------------------------------------------------------ *
 * PATCH /api/notes/:id — update
 * ------------------------------------------------------------------ */

notesRouter.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", fields: fieldErrors(parsed.error) });
    return;
  }

  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "No changes provided" });
    return;
  }

  try {
    /**
     * Ownership inside the `where` of the update itself.
     *
     * Prisma allows extra non-unique filters alongside a unique field here, so
     * this is a single statement that updates the row only if it's yours. There
     * is no window between checking and writing — which matters, because a
     * check-then-write pair is exactly the race we avoided with the unique
     * email index in chunk 3a.
     *
     * No match raises P2025, handled below as a 404.
     */
    const note = await prisma.note.update({
      where: { id: req.params.id, ownerId: req.user!.id },
      data: parsed.data,
      select: { id: true, title: true, content: true, createdAt: true, updatedAt: true },
    });

    res.json({ note });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      res.status(404).json({ error: "Note not found" });
      return;
    }

    console.error("[notes] Failed to update:", error);
    res.status(500).json({ error: "Could not save note" });
  }
});

/* ------------------------------------------------------------------ *
 * DELETE /api/notes/:id
 * ------------------------------------------------------------------ */

notesRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.note.delete({
      where: { id: req.params.id, ownerId: req.user!.id },
    });

    // 204 No Content: succeeded, and there's nothing meaningful to return.
    res.status(204).end();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      res.status(404).json({ error: "Note not found" });
      return;
    }

    console.error("[notes] Failed to delete:", error);
    res.status(500).json({ error: "Could not delete note" });
  }
});
