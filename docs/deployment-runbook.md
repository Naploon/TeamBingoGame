# Deployment Runbook

## Current setup
- Framework: Next.js 14 on Vercel
- Database/Auth: Supabase
- Production URL: `https://team-bingo-game.vercel.app`
- Local runtime target: Node 20

## Files that matter
- [`vercel.json`](../vercel.json): forces Vercel to treat this as a Next.js app
- [`drizzle.config.ts`](../drizzle.config.ts): loads `.env.local` for DB commands
- [`package.json`](../package.json): Node 20 engine pin
- [`README.md`](../README.md): user-facing setup notes

## Standard deploy workflow
1. Make changes.
2. Run:
   - `npm test`
   - `npm run build`
3. Commit and push to `main`.
4. Confirm Vercel production deployment succeeds.
5. Smoke-test:
   - `/`
   - `/admin/login`
   - one auth-sensitive flow if auth, env, or DB code changed

## Environment variables expected in Vercel
- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `SESSION_SECRET`
- `ADMIN_ALLOWLIST`
- `NEXT_PUBLIC_APP_URL`

## Environment variables expected locally
- Same set as above in `.env.local`
- `SUPABASE_SERVICE_ROLE_KEY` can remain blank unless future code explicitly needs it

## Supabase checklist
- Auth Site URL should include production domain
- Redirect URLs should include:
  - `https://team-bingo-game.vercel.app/**`
  - `http://localhost:3000/**`
- For production, prefer Transaction Pooler URI over direct Postgres URI

## Known gotchas
- Without `vercel.json`, Vercel may mis-detect the project and fail looking for a static output directory.
- `drizzle-kit` did not read `.env.local` until the explicit loader was added in `drizzle.config.ts`.
- Vercel preview env management can ask for a branch target if you add preview vars by CLI.
- New shells use Node 20, but old shells may still have stale Node 18 PATH state.

## Minimal incident triage
- Build fails on Vercel:
  - run `npm run build` locally first
  - inspect Vercel logs
  - verify env vars are still present
- Auth fails:
  - check Supabase Site URL and redirect URLs
  - confirm `NEXT_PUBLIC_APP_URL` matches production alias/domain
- DB connection fails:
  - inspect `DATABASE_URL`
  - prefer Transaction Pooler for Vercel
  - verify Supabase project is active
