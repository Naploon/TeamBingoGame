# Agent Rules

## Purpose
- This repo is `TeamBingoGame`, a Next.js 14 app deployed on Vercel and backed by Supabase Postgres/Auth.
- Future agents should treat deployment and environment setup as already established infrastructure, not as a greenfield setup.

## Deployment facts
- GitHub repo: `https://github.com/Naploon/TeamBingoGame.git`
- Vercel project name: `karlisynnam2ng`
- Vercel production alias: `https://karlisynnam2ng.vercel.app`
- Vercel scope used during setup: `karl7899-7240s-projects`
- Supabase project values are configured in local and Vercel environment variables; do not hardcode them into tracked files.
- Admin allowlist values are environment-specific and must stay out of tracked docs/examples.

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

## Vercel rules
- Production deploys happen from Vercel and the repo is already connected.
- Pushes to `main` should be assumed to affect production deployment behavior.
- Keep `NEXT_PUBLIC_APP_URL` aligned with the production alias unless a custom domain replaces it.
- Prefer updating Vercel env vars via CLI or dashboard, not by hardcoding secrets into repo files.

## Supabase rules
- Local DB tooling relies on `drizzle.config.ts` loading `.env.local`.
- For Vercel production, prefer the Supabase Transaction Pooler connection string for `DATABASE_URL`.
- Keep Supabase Auth Site URL and redirect URLs aligned with:
  - `https://karlisynnam2ng.vercel.app`
  - `http://localhost:3000`

## Post-deploy smoke checks
- Home page loads.
- `/admin/login` loads.
- Vercel alias returns HTTP 200.
- Supabase magic link auth routes still work.
- If auth or DB code changed, test one admin login and one player join flow.

## Known production debt
- Verify or switch Vercel `DATABASE_URL` to the Supabase Transaction Pooler if still using direct Postgres host.
- Preview env vars may need to be set branch-specifically in Vercel if preview deployments are used heavily.
