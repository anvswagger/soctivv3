# CI/CD Discipline

## Required GitHub secrets
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## What CI enforces
- Lint and build on every PR and main push.
- Environment parity across `.env.*.example` files.
- Supabase migration checks:
  - Valid, ordered migration filenames.
  - Schema drift check against the linked Supabase project.
- Preview deploy for every PR (Vercel).

## How to use
1. Add the secrets above in the repo settings.
2. Keep `.env.development.example`, `.env.staging.example`, `.env.production.example`, and `.env.local.example` aligned.
3. Keep `supabase/migrations` in chronological order and avoid manual schema changes in production.
