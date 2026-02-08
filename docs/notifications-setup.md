# Notifications Setup (Web + PWA + IF/THEN)

This project now supports:
- manual campaigns from Settings (super admin only)
- IF/THEN automation rules (appointments + leads events)
- push (web/PWA) + in-app notifications

## 1) Required environment variables

Put these in `.env.local` (recommended, do not commit secrets):

```env
SUPABASE_ACCESS_TOKEN=your_supabase_cli_access_token
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
WEB_PUSH_PUBLIC_KEY=your_vapid_public_key
WEB_PUSH_PRIVATE_KEY=your_vapid_private_key
WEB_PUSH_SUBJECT=mailto:admin@example.com
VITE_WEB_PUSH_PUBLIC_KEY=your_vapid_public_key
```

Notes:
- `VITE_WEB_PUSH_PUBLIC_KEY` is safe on frontend and must match `WEB_PUSH_PUBLIC_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` is used by DB triggers to call the edge function securely.

## 2) One-command setup

From project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-notifications.ps1
```

What this command does:
- links Supabase project from `supabase/config.toml`
- pushes `supabase/config.toml`
- pushes DB migrations
- sets Postgres runtime config:
  - `app.settings.supabase_url`
  - `app.settings.service_role_key`
- sets edge function secrets:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `WEB_PUSH_PUBLIC_KEY`
  - `WEB_PUSH_PRIVATE_KEY`
  - `WEB_PUSH_SUBJECT`
- deploys `send-push-notification`
- runs `npm run build` validation

## 3) Verify

1. Open app Settings as super admin.
2. Go to Notifications tab.
3. Enable Push on a browser/device.
4. Create an IF/THEN rule and save.
5. Trigger matching event (for example: update appointment status).
6. Confirm push/in-app delivery.
