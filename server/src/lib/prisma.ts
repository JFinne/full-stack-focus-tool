/**
 * prisma.ts — creates the one database client the whole server shares.
 *
 * Every file that needs the database imports `prisma` from here. Nothing else
 * should ever construct a PrismaClient, and the reason is connection limits:
 * each client opens a pool of real network connections to Postgres, and a
 * database will only accept so many at once. One client, imported everywhere,
 * keeps that under control.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

/**
 * The connection string, e.g.
 *   postgresql://user:password@host/dbname?sslmode=require
 *
 * It contains a password, so it lives in the .env file (gitignored) rather than
 * in code. We fail loudly here if it's missing — a clear error at startup is
 * far kinder than a confusing one later, when some unrelated request falls over
 * because the database was never configured.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy server/.env.example to server/.env and " +
      "fill in your Neon connection string.",
  );
}

/**
 * The driver adapter.
 *
 * New in Prisma 7: Prisma no longer ships its own database driver. Instead you
 * hand it a standard one — here `pg`, the usual Postgres driver for Node — and
 * Prisma uses that. The upside for us is direct control over connection
 * pooling, which is the thing that most often bites serverless deployments.
 *
 * `max` caps how many simultaneous connections this pool will open.
 *
 * Why cap it low: on Vercel your API runs as a serverless function, and under
 * load Vercel may start many copies of it at once. Each copy runs this file and
 * opens its own pool. Ten copies with a limit of 10 each is 100 connections,
 * which will exhaust a free-tier database and start failing requests. A small
 * per-copy limit keeps the total sane. (This is also why we'll use Neon's
 * *pooled* connection string, which puts a second layer of pooling in front of
 * the database itself.)
 */
const adapter = new PrismaPg({
  connectionString,
  max: 5,
});

export const prisma = new PrismaClient({
  adapter,

  // Log every SQL statement while developing. This is genuinely worth leaving
  // on for a while: you get to see exactly what SQL your Prisma calls turn
  // into, which demystifies the ORM faster than any tutorial. In production we
  // only log real problems, since logging every query is slow and noisy.
  log:
    process.env.NODE_ENV === "production"
      ? ["warn", "error"]
      : ["query", "warn", "error"],
});

/**
 * A note on what we deliberately did NOT do here:
 *
 * Many Prisma tutorials stash the client on `globalThis` to survive hot
 * reloads. That's a real fix for frameworks like Next.js, which reload modules
 * in place and would otherwise pile up a new client on every file save.
 *
 * Our dev server (`tsx watch`) restarts the whole Node process instead, so the
 * old client dies with it and there's nothing to accumulate. Adding the global
 * trick here would be copying a solution to a problem we don't have — so we
 * haven't. If we ever switch the backend to a framework that hot-reloads, this
 * is the file that would need revisiting.
 */
