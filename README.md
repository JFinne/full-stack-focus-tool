# Focus Tool

A full-stack productivity and focus app for managing school workloads.

## Stack

| Layer    | Choice                                | Why                                                                 |
| -------- | ------------------------------------- | ------------------------------------------------------------------- |
| Frontend | React 19 + Vite + Tailwind 4 + DaisyUI | Fast dev server; DaisyUI's themes double as the Theme Settings feature |
| Backend  | Express 5 + TypeScript                | Kept in its own folder so the client/server boundary stays visible    |
| Database | PostgreSQL (Neon) + Prisma 7           | Readable schema, real migrations, typed queries                       |
| Hosting  | Vercel                                 | Static client + serverless API on one domain                          |

## Layout

```
full-stack-focus-tool/
├── client/          React app (the part that runs in your browser)
│   ├── src/
│   │   ├── App.tsx      Root component
│   │   ├── main.tsx     Mounts React onto index.html
│   │   └── index.css    Tailwind + DaisyUI setup
│   └── vite.config.ts   Build config + the dev API proxy
├── server/          Express API (the part that runs on a machine somewhere)
│   └── src/
│       ├── app.ts       Builds the app — routes and middleware
│       └── index.ts     Starts it listening on a port
└── package.json     npm workspace root — runs both at once
```

## Running it

```bash
npm install
npm run dev
```

That starts both processes together: the client on
[localhost:5173](http://localhost:5173) and the server on
[localhost:3000](http://localhost:3000). Open the client — the server isn't
meant to be visited directly. Press `Ctrl+C` once to stop both.

Other commands:

```bash
npm run build      # production build of both
npm run typecheck  # type-check without building
```

## Database

The schema lives in [server/prisma/schema.prisma](server/prisma/schema.prisma).
Edit that file, then generate a migration:

```bash
npx prisma migrate dev --name describe_your_change
```

That writes a timestamped SQL file into `server/prisma/migrations/` and applies
it. Those migration files are committed — they're the history of how the
database got to its current shape, and they're what lets a fresh clone (or the
production database) reach the same state by replaying them in order.

Useful commands, all run from `server/`:

```bash
npx prisma studio
```

Opens a browser table-viewer for your data — handy for confirming that a signup
actually wrote a row.

```bash
npx prisma generate
```

Regenerates the typed client. Required after cloning, since the generated code
is gitignored rather than committed.

Setup on a new machine: copy `server/.env.example` to `server/.env` and fill in
`DATABASE_URL` from the [Neon](https://neon.tech) dashboard.

## Routing

React Router, wired declaratively in `App.tsx`. `AppLayout` is a parent route
holding the navbar and sidebar; each page renders into its `<Outlet />`, so the
chrome stays mounted while the inner page changes.

Auth gates the whole route table rather than each route individually — signed
out, the routes simply don't exist. That means there's no per-route guard to
forget. It also preserves the URL, so someone who opens `/boards` and has to
sign in first lands on `/boards` afterwards.

To be clear about what that gate is: it decides what to *render*, and that is
all. It is not security — anyone can edit JavaScript in their own browser. The
real protection is `requireAuth` on the server, which refuses to hand over data.

**Deploy note:** `BrowserRouter` uses real URLs like `/settings`, so the server
must return `index.html` for any unmatched path — otherwise refreshing on a
subroute 404s. Vite's dev server does this automatically; Vercel needs a rewrite
rule in `vercel.json`, which we'll add at deploy time.

## Authentication

Sessions live in the database, not in server memory — a requirement rather than
a preference, since Vercel's serverless functions sleep between requests and
forget anything held in memory.

How a login travels through the system:

1. The form posts to `/api/auth/login`.
2. The server verifies the password against its argon2id hash.
3. It generates a random token, stores **SHA-256(token)** in the `sessions`
   table, and sends the raw token back as an `httpOnly` cookie.
4. Every later request carries that cookie automatically. `attachUser`
   middleware hashes it, looks up the session, and sets `req.user`.

Because the cookie is `httpOnly`, client JavaScript cannot read it — so on page
load the React app can't tell whether it's signed in and has to ask
`/api/auth/me`. That's the reason for the `"checking"` state in `AuthContext`:
without it, every refresh would flash the login form at a signed-in user.

Client-side, `AuthProvider` owns the current user and publishes it through
context. Any component can call `useAuth()`. `App.tsx` is the gate: checking →
spinner, signed out → `AuthForm`, signed in → `Dashboard`.

**Known gap:** there is no rate limiting on `/api/auth/login` yet. Argon2's
slowness raises the cost of brute force but is not a substitute. This needs to
be addressed before deploying.

## Two things worth understanding

**npm workspaces.** The root `package.json` lists `client` and `server` as
workspaces. That makes this folder a container for two projects rather than a
project itself: one `npm install` covers both, shared dependencies are stored
once in a top-level `node_modules/`, and `--workspace <name>` runs a script
inside one of them.

**The dev proxy.** In development the client (port 5173) and server (port 3000)
are different origins, and browsers block cross-origin requests by default —
the CORS rule. Instead of configuring CORS, `vite.config.ts` forwards any
request starting with `/api` to the server. The browser only ever talks to one
origin, so CORS never comes up.

The payoff is that client code just writes `fetch("/api/health")` with no
hostname. In production Vercel serves the client and the API from the same
domain, so that exact line works there unchanged — dev and prod behave alike.

## Progress

- [x] **1. Scaffolding** — client, server, and the connection between them
- [x] **2. Database** — Neon Postgres + Prisma, `users` table, first migration
- [x] **3a. Auth (server)** — register, login, logout, sessions, `requireAuth`
- [x] **3b. Auth (client)** — signup/login forms and the signed-in gate
- [x] **4a. App shell** — routing, persistent sidebar, page scaffolding
- [ ] 4b. Theme switcher — DaisyUI themes + `UserPreferences` table
- [ ] 5. Pomodoro timer
- [ ] 6. Focus Mode
- [ ] 7. Notes
- [ ] 8. Boards
- [ ] 9. Sharing
- [ ] 10. Weather → 11. Spotify
