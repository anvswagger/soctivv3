# Secret Rotation Runbook (P0.1)

> **Audience:** the operator rotating the secrets after the api_keys.json / .env leak.
> **Time required:** ~30 minutes.
> **Goal:** rotate every secret that may have been exposed in `api_keys.json`, `.env`, or the Google OAuth migration, and confirm production is on the new values.

---

## ⚠️ Read this first

The project URL, the legacy anon JWT, the legacy service-role JWT, the new publishable key, the new secret key, the Google OAuth client ID + secret, and the super-admin password `admin123` are all considered **public** until you complete this runbook. Rotate them all. Do not trust any value that appears in `api_keys.json` or in any migration that ends in `_enable_google_auth.sql` or `_add_super_admin.sql`.

The project is `soctivecom` (ref `ncaeeybshoygmluyesor`).

---

## Step 1 — Snapshot what's at risk (1 min)

In a 1Password entry, record every value currently in these files (do **not** paste them into chat):

- `api_keys.json` — 4 Supabase keys
- `.env` — anon JWT + publishable key + project URL
- `supabase/.temp/linked-project.json` — project ref + org
- `supabase/migrations/20260328144900_add_super_admin.sql` — super admin email (`hnyshans85@gmail.com`) and password (`admin123`)
- `supabase/migrations/20260418141022_enable_google_auth.sql` — Google client ID + secret

For each, note the rotation source in the next steps.

---

## Step 2 — Rotate Supabase keys (5 min)

1. Go to **Supabase Dashboard → Project Settings → API**.
2. Click **Roll service_role JWT**. This immediately invalidates the old service-role key. **Do this first**, because every edge function will be broken until they redeploy with the new key.
3. Click **Generate new anon key** for the publishable key. (The "anon" and "publishable" key are sometimes the same value in newer Supabase projects; roll both if separate.)
4. **Copy the new values immediately.** You will not see them again.

Save them in 1Password under:
```
supabase / soctivecom / service_role       (new value)
supabase / soctivecom / anon_publishable   (new value)
```

---

## Step 3 — Update Cloudflare Pages env (3 min)

1. Go to **Cloudflare Pages → soctivv3 → Settings → Environment Variables**.
2. For each of these, click **Edit** and paste the new value:
   - `VITE_SUPABASE_URL` (unchanged — it's the URL, not a secret)
   - `VITE_SUPABASE_ANON_KEY` (new value)
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (new value, if separate)
3. Click **Save and Deploy**. The next deploy will use the new keys.

---

## Step 4 — Update local `.env.local` (1 min)

1. `cp .env.example .env.local`
2. Fill in the new anon + publishable values from 1Password.
3. **Do not commit `.env.local`** — it's gitignored.

---

## Step 5 — Rotate Google OAuth secret (5 min)

1. Go to **Google Cloud Console → APIs & Services → Credentials**.
2. Find the OAuth 2.0 Client ID used by Supabase. (It starts with `601817177874-…` based on the leaked value.)
3. Click **Reset secret**. Copy the new secret immediately.
4. Save it in 1Password under: `google / soctiv / oauth_client_secret`.
5. In **Supabase Dashboard → Authentication → Providers → Google**, paste the new Client Secret. Save.
6. **Do not** write the new secret to any migration. The P0.3 migration deletes the row from `auth.providers` so this is the only place it lives.

---

## Step 6 — Rotate any AI provider keys (5 min)

For each key referenced in `api_keys.json` or the .env (OpenRouter, ImageKit, Twilio, etc.):

1. Go to the provider's dashboard.
2. **Revoke** the old key.
3. **Create** a new key.
4. Save the new key in 1Password.
5. Update the corresponding edge function env via:
   ```bash
   supabase secrets set OPENROUTER_API_KEY=...
   supabase secrets set IMAGEKIT_PUBLIC_KEY=...
   supabase secrets set TWILIO_AUTH_TOKEN=...
   supabase functions deploy --no-verify-jwt <function-name>
   ```
6. Update the Cloudflare Pages env if the key is referenced from the client (it shouldn't be — only VITE_-prefixed keys are).

---

## Step 7 — Rotate the super-admin password (2 min)

1. Go to **Supabase Dashboard → Authentication → Users**.
2. Find the row for `hnyshans85@gmail.com` (the super admin created in `20260328144900_add_super_admin.sql`).
3. Click **Send recovery email**. (Or use the SQL editor with a temporary password and force a reset on next sign-in.)
4. After recovery, the admin sets a 24-char random password. Save in 1Password under: `supabase / soctivecom / super_admin`.
5. Apply the **P0.2 migration** (`20260610000000_remove_hardcoded_super_admin_password.sql`) so the `crypt('admin123', ...)` is no longer in the database. The migration:
   - Adds an audit row to `auth_audit_log` (created in P0.2).
   - Removes the `bcrypt('admin123')` from any auth metadata row.
6. Confirm the admin can sign in with the new password.
7. Confirm the admin **cannot** sign in with `admin123`.

---

## Step 8 — Apply the P0 migrations in order (10 min)

From the repo root, with the Supabase CLI linked to the prod project:

```bash
# Link first if not already
supabase link --project-ref ncaeeybshoygmluyesor

# Apply P0.2 first (super admin password cleanup)
supabase db push --include-all  # or apply each by name

# Order matters:
#   1. P0.2  (super admin password)
#   2. P0.3  (Google OAuth cleanup)
#   3. P0.4  (webhook HMAC + unique webhook_code + length check)
#   4. P0.5  (cron header — no migration, only cron reschedule)
#   5. P0.6  (MFA + role expiry)
#   6. P0.7  (RLS tightening)
#   7. P0.8  (realtime publication cleanup)
#   8. P0.10 (retention)
```

> **Important:** before applying P0.4 you must have:
> - Updated the facebook-leads-webhook edge function (P0.4b) and redeployed it.
> - Created the `webhook-secret-rotate` edge function (P0.4c) and deployed it.
> - Otherwise, every existing Facebook webhook integration will start returning 401.

After P0.4 is applied, every active client must rotate their webhook secret via the new Settings UI. There is a one-week acceptance window where the old `webhook_code` is still honored (implemented in the patched edge function).

---

## Step 9 — Force-redeploy edge functions (3 min)

```bash
supabase functions deploy facebook-leads-webhook
supabase functions deploy appointment-reminders
supabase functions deploy webhook-secret-rotate
supabase functions deploy webhook-sign-test   # dev only
supabase secrets set APP_SETTINGS_SERVICE_ROLE_KEY=...   # the rotated value
supabase secrets set APP_SETTINGS_SUPABASE_URL=https://ncaeeybshoygmluyesor.supabase.co
```

---

## Step 10 — Strip secrets from git (5 min)

Follow `docs/runbooks/git-history-purge.md`. The summary:

1. `git rm --cached api_keys.json .env`
2. Confirm `.gitignore` now lists both.
3. Use `git filter-repo` (or BFG) to remove the files from every commit in history.
4. Coordinate with the team to force-push.

---

## Step 11 — Verify end-to-end (5 min)

1. `git log --all --full-history -- api_keys.json .env` returns 0 commits.
2. `bash scripts/check-secrets.sh` exits 0 on a clean working tree.
3. `grep -rE "admin123|GOCSPX-[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9]{20,}" supabase/ src/` returns 0.
4. Sign in as super admin with the new 24-char password.
5. Sign in with `admin123` → fails.
6. Google sign-in works end-to-end.
7. Facebook webhook:
   - POST without `X-Soctiv-Signature` → 401.
   - POST with a wrong signature → 401.
   - POST with a valid signature (from the new secret-rotate UI) → 201.
8. Appointment reminders:
   - `curl <url>` with no auth → 401.
   - `curl <url> -H "Authorization: Bearer $ANON_KEY"` → 401.
   - `curl <url> -H "Authorization: Bearer $SR_KEY" -H "X-Soctiv-Cron: 1"` → 200.
9. RLS isolation:
   - A user from client A can see only their own rows on every table listed in P0.7.
   - `fire_lead_notification_manual` and the debug functions return 403 for non-super-admin.

---

## Step 12 — Update ops records (2 min)

- Slack/Discord `#ops`: announce the rotation window and that the old webhook `client_code` values will stop working on `<date+7d>`.
- Linear / Jira: close the P0 security ticket with a link to this runbook.
- Calendar: 90-day reminder for the next rotation.

---

## Done

| Check | Status |
|---|---|
| Service role key rotated | ☐ |
| Anon / publishable key rotated | ☐ |
| Google OAuth secret rotated | ☐ |
| AI provider keys rotated | ☐ |
| Super admin password rotated | ☐ |
| Cloudflare Pages env updated | ☐ |
| Local `.env.local` updated | ☐ |
| P0 migrations applied | ☐ |
| Edge functions redeployed | ☐ |
| Secrets purged from git | ☐ |
| Pre-commit hook installed | ☐ |
| 1Password updated | ☐ |
| Team notified | ☐ |
| 90-day rotation reminder set | ☐ |
