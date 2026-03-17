# Agent Rules

## Purpose
- This repo is `TeamBingoGame`, a Next.js 14 app deployed on Vercel and backed by Supabase Postgres/Auth.
- Future agents should treat deployment and environment setup as already established infrastructure, not as a greenfield setup.
- The product is already beyond the initial MVP: assume task templates, task images, ratings, restart flow, locked team naming, and match history are part of the current app behavior.

## Deployment facts
- GitHub repo: `https://github.com/Naploon/TeamBingoGame.git`
- Vercel project name: `karlisynnam2ng`
- Primary Vercel production alias: `https://karlisynnam2ng.vercel.app`
- Legacy Vercel alias still exists: `https://team-bingo-game.vercel.app`
- Vercel scope used during setup: `karl7899-7240s-projects`
- Supabase project values are configured in local and Vercel environment variables; do not hardcode them into tracked files.
- Admin allowlist values are environment-specific and must stay out of tracked docs/examples.
- Supabase Storage is used for task images; do not replace it with checked-in assets or local-only file paths.
- `NEXT_PUBLIC_APP_URL` in Vercel production should be `https://karlisynnam2ng.vercel.app`.

## Before changing deployment
- Read [`docs/deployment-runbook.md`](./docs/deployment-runbook.md).
- Do not rotate or print secrets in responses.
- Do not commit `.env.local` or any secret-bearing file.
- Do not remove `vercel.json`; it explicitly tells Vercel to use the Next.js framework.

## Required checks before deploy-related changes
- Use Node 20.
- Run `npm test`.
- Run `npm run build`.
- If schema or env-loading changes are touched, also validate `npm run db:push` behavior locally or explain why not.

## Local dev rules
- Prefer `npm run dev` for normal work.
- If Next.js starts failing with missing `.next` chunks or missing `vendor-chunks/@supabase.js`, use `npm run dev:clean`.
- If multiple stale Next dev servers may be running, use `npm run dev:reset`.
- Do not assume hot reload is trustworthy after large server/auth/schema changes; a clean restart is often the correct fix.
- Keep only one active Next dev server for this repo when possible.

## Vercel rules
- Production deploys happen from Vercel and the repo is already connected.
- Pushes to `main` should be assumed to affect production deployment behavior.
- Keep `NEXT_PUBLIC_APP_URL` aligned with `https://karlisynnam2ng.vercel.app` unless a custom domain replaces it.
- Prefer updating Vercel env vars via CLI or dashboard, not by hardcoding secrets into repo files.
- After the Vercel project rename, the clean alias `karlisynnam2ng.vercel.app` may need to be manually re-pointed after production deploys:
  - `npx vercel alias set <deployment-url> karlisynnam2ng.vercel.app --scope karl7899-7240s-projects`
- The old alias `team-bingo-game.vercel.app` can remain unless the user explicitly asks to remove it.
- Vercel project inspect may still show generic framework settings such as `Other`, but `vercel.json` is what keeps deployment detection correct here.

## Supabase rules
- Local DB tooling relies on `drizzle.config.ts` loading `.env.local`.
- For Vercel production, prefer the Supabase Transaction Pooler connection string for `DATABASE_URL`.
- Keep Supabase Auth Site URL and redirect URLs aligned with:
  - `https://karlisynnam2ng.vercel.app`
  - `http://localhost:3000`
- If the legacy Vercel alias remains active, keep `https://team-bingo-game.vercel.app/**` in Supabase Auth redirects until the alias is retired.
- `SUPABASE_SERVICE_ROLE_KEY` is required for current features such as server-confirmed player signup and task image uploads.
- Task images are stored in the `task-images` bucket/path flow; avoid introducing a different storage approach unless the user asks for it.

## Current gameplay expectations
- Exactly 16 active tasks are required before starting a game.
- Teams must end up as at least 2 teams; solo-player teams are allowed, but a single-team game is not.
- Team captains must lock a custom team name before their team can start tasks.
- Teams without a locked name must not appear as challenge targets.
- The player "active" tab has been repurposed into match history; do not reintroduce the old placeholder active view.
- Competitive and cooperative tasks can both be replayed to reach higher ranks up to diamond.
- Cooperative failure is distinct from cancellation: failed attempts count as losses, cancelled challenges do not.
- Task ratings support half-stars and both teams can rate after a challenge resolves.
- Admins can restart live or ended games while preserving players and tasks.
- Admin task management includes global templates and task images.

## Post-deploy smoke checks
- `https://karlisynnam2ng.vercel.app` loads.
- `/admin/login` loads.
- The clean alias returns HTTP 200.
- Auth routes still work.
- If auth or DB code changed, test one admin login and one player join flow.
- If task/image/template code changed, verify one task image upload and one template reuse flow.
- If gameplay code changed, test one challenge flow including rating.
- If the clean alias did not move to the latest deployment automatically, re-point it before finishing the task.

## Known production debt
- Verify or switch Vercel `DATABASE_URL` to the Supabase Transaction Pooler if still using direct Postgres host.
- Verify whether `karlisynnam2ng.vercel.app` eventually auto-follows production deploys or whether manual alias maintenance remains necessary.
- Preview env vars may need to be set branch-specifically in Vercel if preview deployments are used heavily.
