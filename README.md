# Focus Tool

A full-stack productivity and focus app for managing school workloads.

## Stack

| Layer    | Choice                                | Why                                                                 |
| -------- | ------------------------------------- | ------------------------------------------------------------------- |
| Frontend | React 19 + Vite + Tailwind 4 + DaisyUI | Fast dev server; DaisyUI's themes double as the Theme Settings feature |
| Backend  | Express 5 + TypeScript                | Kept in its own folder so the client/server boundary stays visible    |
| Database | PostgreSQL + Prisma *(not yet added)*  | Readable schema, real migrations, typed queries                       |
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
- [ ] 2. Database — Postgres + Prisma, `User` table, first migration
- [ ] 3. Auth — register, login, logout, sessions
- [ ] 4. App shell — login gate, dashboard layout, theme switcher
- [ ] 5. Pomodoro timer
- [ ] 6. Focus Mode
- [ ] 7. Notes
- [ ] 8. Boards
- [ ] 9. Sharing
- [ ] 10. Weather → 11. Spotify
