# Publishing landing pages

This runbook explains how published landing pages are hosted and the
one-time setup needed to make `<sub>.soctiv.ly` URLs resolve.

## Architecture (read this first)

Landing pages are **served from Supabase Storage**, not deployed to Netlify.

```
Publish (editor)                         Visitor
  │                                        │
  ▼                                        ▼
publish-landing-page (Supabase fn)   GET https://<sub>.soctiv.ly/
  │  renders HTML/CSS/JS                    │  (DNS: *.soctiv.ly → Netlify site)
  ▼                                        ▼
Supabase Storage (public bucket)     subdomain-router (Netlify edge fn)
  landing-pages/<pageId>/index.html        │  reads _map.json: <sub> → <pageId>
  landing-pages/<pageId>/styles.css        │  fetches landing-pages/<pageId>/<path>
  landing-pages/_map.json  ◄───────────────┘  from Storage and returns it
```

**Why this design.** The CRM app and the landing pages share one Netlify
site (`soctiv.ly`). Every Netlify deploy is a *full snapshot*, so the old
"publish = API zip deploy of just the landing pages" model wiped the app,
and the next `git push` (app build) wiped the landing pages. Serving from
Storage removes the collision entirely:

- **Publishing** only writes to Storage — it never touches the Netlify deploy.
- **The app build** (`git push`) never touches the landing pages in Storage.
- **Every published page coexists** — each lives under its own `<pageId>/`
  prefix and `_map.json` is the routing table for all of them.

No Netlify auth token, no second site, no per-publish deploy.

## URL shapes

- **Subdomain (default):** `https://<sub>.soctiv.ly/` — set per page in the
  editor's Setup → Domain tab (auto-suggested on first publish).
- **Path fallback (no subdomain):** `https://soctiv.ly/p/<pageId>/` — always
  reachable even before a subdomain is chosen.
- **Custom domain (optional):** `https://shop.example.com` — needs the
  customer's own DNS pointed at the Netlify site (see below).

## One-time setup

### 1. Wildcard DNS + domain alias (REQUIRED for `<sub>.soctiv.ly`)

This is the only step that makes subdomain URLs resolve. The app is already
on `soctiv.ly`; add the wildcard to the **same** Netlify site:

1. Netlify → the `soctivecom` site → **Domain management → Add domain alias**
   → add `*.soctiv.ly`.
2. In your DNS provider, add a wildcard record:
   `CNAME  *.soctiv.ly  →  soctivecom.netlify.app`
   (If `soctiv.ly` is on Netlify DNS, adding the alias provisions this for you.)
3. Wait for the wildcard SSL certificate to provision (Netlify does this
   automatically once DNS resolves — usually a few minutes).

Verify: `curl -I https://anything.soctiv.ly/` should hit Netlify (a 404 from
our edge function for an unknown subdomain is the expected "it's wired up"
signal — not the Netlify-branded 404).

### 2. Deploy the edge function (`git push`)

`subdomain-router` is registered in `netlify.toml` and lives in
`netlify/edge-functions/`. It deploys with the normal app build, so just push
to `main` (or trigger a Netlify deploy). Confirm the response carries the
`x-soctiv-router` header on a landing-page URL.

It reads the Supabase project URL from the site env var `SUPABASE_URL`
(or `VITE_SUPABASE_URL`), falling back to the production project, so no extra
config is required.

### 3. Deploy the publish function

```
supabase functions deploy publish-landing-page
```

It uses the auto-set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to create
the public `landing-pages` bucket (first publish only) and upload files.
**No Netlify secrets are needed** — the old `NETLIFY_AUTH_TOKEN` /
`NETLIFY_LANDING_SITE_ID` vars are obsolete and can be removed.

## Daily use

1. Open a product with Product DNA → **Create landing page**.
2. Tweak sections, optionally set a subdomain in Setup → Domain.
3. Click **Publish**. The function uploads to Storage and returns the URL.
4. Open the URL to verify. New subdomains go live within ~30s (edge map TTL);
   re-publishes of existing pages refresh within ~60s (Storage cache TTL).

## Troubleshooting

### `<sub>.soctiv.ly` shows a Netlify 404 (branded)

DNS/alias not wired up. Wildcard `*.soctiv.ly` must point at the site and be
an alias on it (step 1). If `curl -I` doesn't even reach Netlify, it's DNS.

### `<sub>.soctiv.ly` shows our plain-text "Not Found"

The edge function fired but the subdomain isn't in `_map.json`. Re-publish the
page (the map is rebuilt on every publish), and confirm the page's row has a
`subdomain` and `status = 'published'`. Check the map directly:
`curl https://<project>.supabase.co/storage/v1/object/public/landing-pages/_map.json`

### Page loads but assets (CSS/JS) 404

The page was published before all files finished uploading, or the bucket
isn't public. Re-publish; verify the bucket `landing-pages` is **public** in
the Supabase Storage dashboard.

### Form submits but lead has `product_id = null`

The product code in the config doesn't match a real product. Check the
Webhook section's `productCode` or the `products.code` column, then republish.

### Edits don't show up

Storage caches objects for ~60s and the edge map for ~30s. Wait, or hard-
refresh. If still stale after a minute, re-publish.
