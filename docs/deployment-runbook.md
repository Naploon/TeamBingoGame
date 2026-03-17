# Deployment Runbook

## Current setup
- Framework: Next.js 14 on Vercel
- Database/Auth: Supabase
- Production URL: `https://karlisynnam2ng.vercel.app`
- Legacy alias still present: `https://team-bingo-game.vercel.app`
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
6. If the clean alias did not move automatically, re-point it:
   - `npx vercel alias set <deployment-url> karlisynnam2ng.vercel.app --scope karl7899-7240s-projects`

## Environment variables expected in Vercel
- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `SESSION_SECRET`
- `ADMIN_ALLOWLIST`
- `NEXT_PUBLIC_APP_URL`

## Environment variables expected locally
- Same set as above in `.env.local`
- `SUPABASE_SERVICE_ROLE_KEY` is required for current image upload and server-confirmed signup flows

## Supabase checklist
- Auth Site URL should be `https://karlisynnam2ng.vercel.app`
- Redirect URLs should include:
  - `https://karlisynnam2ng.vercel.app/**`
  - `http://localhost:3000/**`
- If the legacy alias remains active, also keep:
  - `https://team-bingo-game.vercel.app/**`
- For production, prefer Transaction Pooler URI over direct Postgres URI

## Known gotchas
- Without `vercel.json`, Vercel may mis-detect the project and fail looking for a static output directory.
- `drizzle-kit` did not read `.env.local` until the explicit loader was added in `drizzle.config.ts`.
- Vercel preview env management can ask for a branch target if you add preview vars by CLI.
- New shells use Node 20, but old shells may still have stale Node 18 PATH state.
- After the Vercel project rename, the clean alias `karlisynnam2ng.vercel.app` was created manually and may need to be re-pointed after some production deploys.
- `vercel project inspect` may show generic framework settings, but `vercel.json` still drives correct Next.js deployment behavior.

## Minimal incident triage
- Build fails on Vercel:
  - run `npm run build` locally first
  - inspect Vercel logs
  - verify env vars are still present
- Auth fails:
  - check Supabase Site URL and redirect URLs
  - confirm `NEXT_PUBLIC_APP_URL` matches production alias/domain
- Clean alias points to the wrong deployment:
  - run `vercel alias list`
  - point `karlisynnam2ng.vercel.app` at the latest ready production deployment
- DB connection fails:
  - inspect `DATABASE_URL`
  - prefer Transaction Pooler for Vercel
  - verify Supabase project is active
