// netlify/edge-functions/subdomain-router.ts
//
// Reads the request's Host header and rewrites any *.soctiv.ly subdomain
// request to the matching landing page directory.
//
// Why this exists: Netlify's _redirects file does NOT reliably match
// full-URL `from` patterns on Netlify's CDN edge the way the docs imply,
// so per-host routing can't be done with plain static rules. Edge
// Functions run before static-file serving and before _redirects, so
// they are the canonical place to do Host-header-based rewrites.
//
// Map source: `/_subdomain_map.json` (written by the publish-landing-page
// Supabase edge function on every publish). Example file:
//   { "generated_at": "...", "map": { "test": "<pageId>", "acme": "<pageId>" } }
//
// Behavior:
//   1. If Host ends in `.soctiv.ly` (but is NOT `soctiv.ly` or `www.soctiv.ly`):
//        - extract the subdomain
//        - look up the pageId in the map (cached per isolate)
//        - rewrite URL to `/<pageId>/<original-path>`
//   2. Otherwise: return the response unchanged (falls through to the
//      SPA / static files / _redirects as normal).
//
// Cache strategy:
//   - The map is fetched from Netlify's CDN with `Cache-Control: public,
//     max-age=30` semantics (handled implicitly by the static-file cache
//     for an asset under the site's own deploy). A 30s window is short
//     enough that a publish is reflected within ~30s globally without
//     invalidating the CDN cache by hand.
//   - To force a faster pickup after a publish, the publish function
//     appends a `?v=<deploy-id>` query string on first load (the URL is
//     not visible to end users because the edge function rewrites
//     before serving).
//
// Deployed as part of every publish — the Supabase function tars the
// `netlify/edge-functions/` directory into the deploy automatically.
//
// NOTE: This runs on Deno at Netlify's edge. The standard library import
// `https://deno.land/std@0.224.0/http/server.ts` is intentionally avoided
// to keep cold-start latency minimal — only `Deno` globals are used.

import type { Context } from "https://edge.netlify.com";

interface SubdomainMap {
  generated_at?: string;
  map: Record<string, string>;
}

// Per-isolate cache so a burst of requests for the same site doesn't
// re-fetch the map on every request.
let cachedMap: SubdomainMap | null = null;
let cachedMapAt = 0;
const MAP_TTL_MS = 30_000;

const SOCTIV_BASE = "soctiv.ly";
const RESERVED_SUBDOMAINS = new Set(["", "www"]);

async function loadMap(origin: string): Promise<SubdomainMap | null> {
  const now = Date.now();
  if (cachedMap && now - cachedMapAt < MAP_TTL_MS) return cachedMap;
  try {
    const res = await fetch(`${origin}/_subdomain_map.json`, {
      headers: { "accept": "application/json" },
    });
    if (!res.ok) return cachedMap; // stale-while-revalidate: keep old map
    cachedMap = (await res.json()) as SubdomainMap;
    cachedMapAt = now;
    return cachedMap;
  } catch {
    return cachedMap;
  }
}

export default async (request: Request, context: Context): Promise<Response> => {
  const url = new URL(request.url);
  const hostHeader = request.headers.get("host") || url.host;
  // Strip port if present (e.g. "test.soctiv.ly:443" → "test.soctiv.ly").
  const host = hostHeader.split(":")[0].toLowerCase();

  // Fast path: only act on *.soctiv.ly subdomains.
  if (!host.endsWith(`.${SOCTIV_BASE}`)) {
    return; // undefined → fall through to next handler / static serve
  }
  const sub = host.slice(0, host.length - SOCTIV_BASE.length - 1); // remove ".soctiv.ly"
  if (RESERVED_SUBDOMAINS.has(sub)) {
    return; // soctiv.ly / www.soctiv.ly — fall through to the SPA
  }

  // Always serve from the same origin so the map lookup hits the local
  // deploy (no CORS, no cross-site auth).
  const origin = url.origin;
  const map = await loadMap(origin);
  const pageId = map?.map?.[sub];
  if (!pageId) {
    // Unknown subdomain — return a clean 404 so the user doesn't see the
    // Netlify default 404 with site branding. Don't leak any info.
    return new Response("Not Found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  // Build the rewritten URL: /<pageId><original path>
  // Use the original pathname + search so deep links survive.
  const target = `/${pageId}${url.pathname === "/" ? "/" : url.pathname}${url.search}`;
  const rewritten = new URL(target, origin);

  // Clone the request with the rewritten URL so downstream handlers see
  // the new path. Forward all headers (incl. cookies, range, etc.).
  const newRequest = new Request(rewritten.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: "manual",
  });

  // context.next() runs the rest of the request lifecycle (static file
  // serve, _redirects, etc.) with the rewritten URL.
  const response = await context.next({ request: newRequest });
  // Add a debug header so we can confirm the edge function fired in
  // production. Cheap, doesn't break anything.
  response.headers.set("x-soctiv-router", `sub=${sub};page=${pageId}`);
  return response;
};

export const config = {
  // Run on every path. The function itself decides whether to act based
  // on Host, so we don't need to filter by path here.
  path: "/*",
};
