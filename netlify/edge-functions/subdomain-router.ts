// netlify/edge-functions/subdomain-router.ts
//
// Serves published landing pages straight from a PUBLIC Supabase Storage
// bucket, on the fly, for two URL shapes:
//
//   1. Subdomain:  https://<sub>.soctiv.ly/<path>
//   2. Path:       https://soctiv.ly/p/<pageId>/<path>   (no-subdomain fallback)
//
// Why Storage instead of local files: the CRM app and the landing pages
// share this one Netlify site. Every Netlify deploy is a full snapshot, so
// the old model (publish = API zip deploy of just the landing pages) wiped
// the app, and the next `git push` (app build) wiped the landing pages.
// Now the `publish-landing-page` Supabase function uploads each page's files
// to `landing-pages/<pageId>/...` in Storage, and this edge function fetches
// them. Publishing never touches the Netlify deploy; the app build never
// touches the landing pages. No collision, ever.
//
// Routing table: `landing-pages/_map.json` (public), written by the publish
// function on every publish. Shape:
//   { "generated_at": "...", "map": { "test": "<pageId>", "acme": "<pageId>" } }
//
// Anything that is NOT a landing-page request (the apex app, www, reserved
// subdomains, normal app paths) returns `undefined` so Netlify falls through
// to the SPA / static files as normal.

import type { Context } from "https://edge.netlify.com";

const SOCTIV_BASE = "soctiv.ly";
// Subdomains that belong to the app/infra, never to a landing page. These
// fall through to the SPA instead of being looked up in the map.
const RESERVED_SUBDOMAINS = new Set(["", "www", "app", "api", "admin", "staging"]);
const BUCKET = "landing-pages";
// UUID v4 shape (landing_pages.id). Used to validate the /p/<pageId>/ path.
const PAGE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Supabase project URL — the public Storage bucket lives under it. Read from
 * the site's env (set automatically alongside the app's VITE_SUPABASE_URL),
 * falling back to the known production project so the function works even
 * before the env var is configured.
 */
function supabaseUrl(): string {
  const fromEnv =
    Deno.env.get("SUPABASE_URL") ||
    Deno.env.get("VITE_SUPABASE_URL") ||
    "https://ncaeeybshoygmluyesor.supabase.co";
  return fromEnv.replace(/\/+$/, "");
}

function publicObjectUrl(key: string): string {
  return `${supabaseUrl()}/storage/v1/object/public/${BUCKET}/${key}`;
}

interface SubdomainMap {
  generated_at?: string;
  map: Record<string, string>;
}

// Per-isolate cache so a burst of requests for the same subdomain doesn't
// re-fetch the routing table on every request. 30s is short enough that a
// newly published subdomain shows up quickly; a brand-new subdomain on a
// cold isolate fetches fresh anyway (cachedMap starts null).
let cachedMap: SubdomainMap | null = null;
let cachedMapAt = 0;
const MAP_TTL_MS = 30_000;

async function loadMap(): Promise<SubdomainMap | null> {
  const now = Date.now();
  if (cachedMap && now - cachedMapAt < MAP_TTL_MS) return cachedMap;
  try {
    const res = await fetch(publicObjectUrl("_map.json"), {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return cachedMap; // stale-while-revalidate: keep the old map
    cachedMap = (await res.json()) as SubdomainMap;
    cachedMapAt = now;
    return cachedMap;
  } catch {
    return cachedMap;
  }
}

function notFound(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/**
 * Fetch `<pageId>/<assetPath>` from Storage and return it with the content
 * type Storage stored at upload time. `assetPath` has no leading slash; an
 * empty string maps to `index.html`.
 */
async function serveFromStorage(
  pageId: string,
  assetPath: string,
  debugTag: string,
): Promise<Response> {
  const key = `${pageId}/${assetPath === "" ? "index.html" : assetPath}`;
  const res = await fetch(publicObjectUrl(key));
  if (!res.ok) return notFound();

  const headers = new Headers();
  const ct = res.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const isHtml = (ct || "").includes("text/html") || key.endsWith(".html");
  // HTML must revalidate so edits show on the next publish; static assets can
  // be cached longer. (Storage itself serves them with a short max-age too.)
  headers.set(
    "cache-control",
    isHtml ? "public, max-age=0, must-revalidate" : "public, max-age=300",
  );
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-soctiv-router", debugTag);
  return new Response(res.body, { status: 200, headers });
}

export default async (
  request: Request,
  _context: Context,
): Promise<Response | undefined> => {
  const url = new URL(request.url);
  const host = (request.headers.get("host") || url.host)
    .split(":")[0]
    .toLowerCase();
  const path = url.pathname;

  // ── Path-based fallback: /p/<pageId>/...  (works on ANY host, incl. apex)
  // Lets a page with no subdomain still be reachable at
  // https://soctiv.ly/p/<pageId>/.
  const pMatch = path.match(/^\/p\/([^/]+)(\/.*)?$/i);
  if (pMatch && PAGE_ID_RE.test(pMatch[1])) {
    const pageId = pMatch[1].toLowerCase();
    const rest = pMatch[2];
    if (rest === undefined) {
      // `/p/<id>` with no trailing slash → redirect so the page's RELATIVE
      // asset refs (runtime.js, styles.css) resolve under /p/<id>/.
      return Response.redirect(`${url.origin}/p/${pageId}/`, 301);
    }
    return serveFromStorage(pageId, rest.replace(/^\/+/, ""), `path;page=${pageId}`);
  }

  // ── Subdomain routing: <sub>.soctiv.ly
  if (!host.endsWith(`.${SOCTIV_BASE}`)) return; // not our subdomain → SPA/static
  const sub = host.slice(0, host.length - SOCTIV_BASE.length - 1);
  if (RESERVED_SUBDOMAINS.has(sub)) return; // app/infra subdomain → SPA

  const map = await loadMap();
  const pageId = map?.map?.[sub];
  if (!pageId) {
    // Unknown subdomain → clean 404 (don't leak the Netlify-branded default).
    return notFound();
  }
  const assetPath = path === "/" ? "" : path.replace(/^\/+/, "");
  return serveFromStorage(pageId, assetPath, `sub=${sub};page=${pageId}`);
};

export const config = {
  // Run on every path. The function itself decides whether to act based on
  // Host / path, returning undefined to fall through for normal app traffic.
  path: "/*",
};
