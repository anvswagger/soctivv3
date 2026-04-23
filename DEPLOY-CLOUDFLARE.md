# Cloudflare Pages Deployment Guide

## Environment Variables Required

Set these in your Cloudflare Pages dashboard (Settings → Environment Variables):

1. `VITE_SUPABASE_URL` - Your full Supabase project URL
2. Either `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`

> Note: Both `VITE_*` and non-prefixed versions (like `SUPABASE_URL`) are supported.

## Important Build Configuration

⚠️ **Do NOT set a custom deploy command in Cloudflare Pages settings.**

The default Pages deployment process will automatically:
1. Run `npm run build`
2. Deploy the `dist` directory

Setting a custom deploy command like `bun run build && npx wrangler pages deploy` will cause the build to run twice and fail.

This project is already configured for Cloudflare Pages:

- Runtime environment variable injection via `__env__`
- Vite configured properly for Pages build process
- GitHub Actions workflow included
- wrangler.toml properly configured

## One-Click Deploy

1. Push your changes to GitHub
2. Connect your repo to Cloudflare Pages
3. Set the environment variables in the dashboard
4. Deploy!

## Troubleshooting

### "Missing Supabase env vars" error
"Missing Supabase env vars. Set VITE_SUPABASE_URL and either VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY."

1. Verify the variables are set correctly in Cloudflare dashboard
2. Ensure you have at least one of the key variables set
3. Trigger a redeployment (env vars only apply on new deployments)

### "Project not found" error
Ensure your project name in Cloudflare Pages is exactly `soctivv3`

### Double build / build failed twice
Remove any custom deploy command from your Pages settings and use the default configuration.
