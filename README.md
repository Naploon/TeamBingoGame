# Team Bingo Game

Mobile-first team bingo challenge app built with Next.js, Tailwind, Drizzle ORM, and Supabase Postgres.

## What is implemented

- Player join flow with email auth, join code entry, and player cookie sessions
- Admin login with Supabase-backed auth
- Random team generation, random captain selection, and per-team shuffled 4x4 boards
- Locked team naming flow before a team can start tasks or be challenged
- Live player app with board, match history, leaderboard, and team views
- Competitive and cooperative task flows, including cooperative failure tracking
- Replay-based progression with base, gold, and diamond task ranks
- Half-star task ratings from both teams after a challenge resolves
- Admin dashboard for event setup, task management, restart/end controls, captain switching, challenge overrides, and live results
- Global task template library plus task images stored in Supabase Storage
- Pure game engine tests for the scoring and recomputation rules

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Drizzle ORM
- PostgreSQL / Supabase
- Supabase Storage
- Vitest

## Local setup

1. Use Node 20.x. The repo pins this in `.nvmrc` and `package.json`.
2. Copy `.env.example` to `.env.local`.
3. Fill in Supabase URL, publishable key, service role key, database URL, app URL, session secret, and admin allowlist.
4. Install dependencies:

```bash
npm install
```

5. Push the schema to your database:

```bash
npm run db:push
```

6. Start the app:

```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000).

## Local dev commands

Normal dev server:

```bash
nvm use 20
npm run dev
```

If Next starts throwing missing `vendor-chunks` / missing `.next` module errors:

```bash
nvm use 20
npm run dev:clean
```

If you suspect multiple local Next dev servers are fighting over ports:

```bash
nvm use 20
npm run dev:reset
```

`dev:clean` clears `.next` before starting. `dev:reset` kills common local dev listeners on ports `3000-3006`, clears `.next`, and starts fresh.

## Core gameplay rules in the app

- Exactly 16 tasks must be active before a game can start.
- The game requires at least 2 players and must produce at least 2 teams.
- Team captains must lock in a custom team name before their team can start tasks.
- Teams without a locked name do not appear as challenge targets.
- Competitive tasks can be replayed until a team reaches diamond on that task.
- Cooperative tasks can also be replayed to reach higher ranks.
- Cooperative failure is tracked as a failed attempt, not as a cancellation.
- Cancelled challenges are treated as true cancellations and should not affect progression.

## Supabase auth setup

- Enable the auth providers your deployment uses in Supabase Auth.
- Add your local and production callback URLs:
  - `http://localhost:3000/auth/callback`
  - `https://karlisynnam2ng.vercel.app/auth/callback`
- Set `ADMIN_ALLOWLIST` to the organizer emails that should be allowed to access the admin area.
- Keep `SUPABASE_SERVICE_ROLE_KEY` available locally and in Vercel because image uploads and server-confirmed player signup use it.
- If you keep the legacy alias active, also keep `https://team-bingo-game.vercel.app/**` in Supabase Auth redirect URLs during the transition.

## Deployment

### Vercel

1. This repo is already connected to the Vercel project `karlisynnam2ng`.
2. Vercel will pick up Node 20 from `package.json`.
3. Add all environment variables from `.env.example`.
4. Set the production URL in `NEXT_PUBLIC_APP_URL`.
5. Deploy `main` to production and use preview deployments for staging checks.
6. If `karlisynnam2ng.vercel.app` does not move automatically to the latest production deployment, re-point it manually:

```bash
npx vercel alias set <deployment-url> karlisynnam2ng.vercel.app --scope karl7899-7240s-projects
```

### Supabase

1. Copy the Postgres connection string into `DATABASE_URL`.
2. Run `npm run db:push` against the intended project/environment.
3. Seed organizer emails in `ADMIN_ALLOWLIST`.
4. For production, prefer the Supabase Transaction Pooler connection string.
5. Keep the primary production hostname aligned with `https://karlisynnam2ng.vercel.app`.
6. If you leave the old alias active, keep `https://team-bingo-game.vercel.app/**` in Supabase Auth redirects until you retire it.

## Operational notes

- The live UI polls every 5 seconds. That keeps the architecture simple and is enough for the expected event size.
- Export event data before and after each real event if you stay on Supabase Free.
- Run one dry-run event on actual phones before using the app for a live audience.
- Task images are uploaded to the `task-images` bucket in Supabase Storage.
- If auth, server routes, or build artifacts start behaving strangely in dev, a clean restart is usually faster than debugging a broken `.next` cache.

## Release checklist

Use this before pushing a production change.

1. Confirm you are on Node 20 with `node -v`.
2. Install dependencies if needed with `npm install`.
3. Run `npm test`.
4. Run `npm run build`.
5. If DB schema or env loading changed, run `npm run db:push` against the intended environment.
6. Check that Vercel env vars are present:
   - `DATABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SESSION_SECRET`
   - `ADMIN_ALLOWLIST`
   - `NEXT_PUBLIC_APP_URL`
7. Check that Supabase Auth is still configured with:
   - Site URL `https://karlisynnam2ng.vercel.app`
   - Redirect URLs for `https://karlisynnam2ng.vercel.app/**` and `http://localhost:3000/**`
   - If the legacy alias is still in use, also keep `https://team-bingo-game.vercel.app/**`
8. Push to `main` and wait for the Vercel production deployment to finish.
9. Smoke-test production:
   - `https://karlisynnam2ng.vercel.app` loads
   - `/admin/login` loads
   - one admin login works
   - one player can join an event
   - one player can open the game board
   - one task image loads if image-related code changed
10. If the clean alias is still on an older deployment, re-point it:

```bash
npx vercel alias set <deployment-url> karlisynnam2ng.vercel.app --scope karl7899-7240s-projects
```

For deeper deployment troubleshooting, see [`docs/deployment-runbook.md`](./docs/deployment-runbook.md).

## Test commands

```bash
npm test
npm run build
```
