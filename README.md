# Team Bingo Game

Mobile-first team bingo challenge app built with Next.js, Tailwind, Drizzle ORM, and Supabase Postgres.

## What is implemented

- Player registration with `display name + join code`
- Random team generation, random captain selection, and per-team shuffled 4x4 boards
- Live player app with board, active challenge, leaderboard, and team views
- Competitive and cooperative task flows
- Three-loss fairness rule, replay wins, gold/platinum progression, and derived leaderboard
- Admin dashboard for event setup, task management, start/end controls, captain switching, and result overrides
- Player cookie sessions and Supabase-based admin magic-link authentication
- Pure game engine tests for the scoring and recomputation rules

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Drizzle ORM
- PostgreSQL / Supabase
- Vitest

## Local setup

1. Use Node 20.x. The repo now pins this in `.nvmrc`, `.node-version`, and `package.json`.
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

## Supabase auth setup

- Enable email OTP / magic links in Supabase Auth.
- Add your local and production callback URLs:
  - `http://localhost:3000/auth/callback`
  - `https://your-production-domain/auth/callback`
- Default organizer email is `karl7899@gmail.com` via `ADMIN_ALLOWLIST`.

## Deployment

### Vercel

1. Create a Vercel project from this repo.
2. Vercel will pick up Node 20 from `package.json`.
3. Add all environment variables from `.env.example`.
4. Set the production URL in `NEXT_PUBLIC_APP_URL`.
5. Deploy `main` to production and use preview deployments for staging checks.

### Supabase

1. Create `staging` and `production` free-tier projects.
2. Copy the Postgres connection string into `DATABASE_URL`.
3. Run `npm run db:push` against each project.
4. Seed organizer emails in `ADMIN_ALLOWLIST`.
5. If you use the default Vercel project naming, the clean production hostname to aim for is `team-bingo-game.vercel.app`.

## Operational notes

- The live UI polls every 5 seconds. That keeps the architecture simple and is enough for the expected event size.
- Export event data before and after each real event if you stay on Supabase Free.
- Run one dry-run event on actual phones before using the app for a live audience.

## Test commands

```bash
npm test
npm run build
```
