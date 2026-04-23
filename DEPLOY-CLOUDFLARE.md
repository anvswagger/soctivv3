# Cloudflare Pages Deployment Guide

## Environment Variables Required

Set these in your Cloudflare Pages dashboard (Settings → Environment Variables):

1. `VITE_SUPABASE_URL` - Your full Supabase project URL
2. Either `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`

> Note: Both `VITE_*` and non-prefixed versions (like `SUPABASE_URL`) are supported.

## Build Configuration

This project is already configured for Cloudflare Pages:

- Runtime environment variable injection via `__env__`
- Vite configured properly for Pages build process
- GitHub Actions workflow included

## One-Click Deploy

1. Push your changes to GitHub
2. Connect your repo to Cloudflare Pages
3. Set the environment variables in the dashboard
4. Deploy!

## Troubleshooting

If you see the error:
"Missing Supabase env vars. Set VITE_SUPABASE_URL and either VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY."

1. Verify the variables are set correctly in Cloudflare dashboard
2. Ensure you have at least one of the key variables set
3. Trigger a redeployment (env vars only apply on new deployments)
