/**
 * prisma.config.ts — configuration for the Prisma CLI.
 *
 * This is new in Prisma 7. Older versions put the connection URL inside
 * schema.prisma; now it lives here, in a real TypeScript file that can read
 * environment variables directly.
 *
 * Note that this file configures the *CLI* (`prisma migrate`, `prisma
 * generate`, `prisma studio`). Your running application doesn't use it — the
 * app builds its own connection in src/lib/prisma.ts.
 */

import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
  },

  datasource: {
    /**
     * The connection your application uses.
     *
     * Locally this is whatever Neon gave you. When we deploy, this should
     * become Neon's *pooled* connection string — the one whose hostname
     * contains "-pooler" — because serverless functions can spin up many copies
     * at once and a pooler is what keeps them from exhausting the database's
     * connection limit.
     */
    url: process.env["DATABASE_URL"],

    /**
     * The connection used for schema migrations only.
     *
     * Why this exists: a connection pooler in transaction mode multiplexes many
     * clients over few real connections, which is great for ordinary queries
     * and bad for schema changes. Migrations issue statements that need a
     * stable, exclusive session — `CREATE TABLE`, advisory locks — and those
     * can fail or hang through a pooler.
     *
     * So migrations bypass the pooler and talk to the database directly.
     *
     * Right now DIRECT_URL isn't set and DATABASE_URL is already a direct
     * connection, so the fallback below means nothing changes. This matters at
     * deploy time: once DATABASE_URL becomes the pooled string, set DIRECT_URL
     * to the unpooled one and migrations keep working.
     */
    directUrl: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
