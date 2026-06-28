// @ts-nocheck - Deno edge function
/**
 * soctiv-tracking — Supabase Edge Function (Conversion API proxy)
 * Endpoint: POST /functions/v1/capi-proxy
 *
 * Mirrors `LANIDNG PAGE SOCTIV/api/capi.js` but runs in Deno. The browser
 * pixel (`pixel.js`) POSTs to this endpoint with `{event, user_data,
 * test_event_code?, page_id}` + an `X-Soctiv-Signature` header. We re-hash
 * the PII server-side (in case the browser's hashing was bypassed or
 * partial), verify the per-page signature against `CAPI_SHARED_SECRET`,
 * then forward to Meta's CAPI.
 *
 * Environment variables (set on the Supabase function):
 *   META_PIXEL_ID          — required, e.g. "1234567890"
 *   META_CAPI_ACCESS_TOKEN — required, system-user token from Events Manager
 *   META_API_VERSION       — optional, default "v21.0"
 *   META_TEST_EVENT_CODE   — optional, for Events Manager → Test Events
 *   META_DEBUG             — optional, "1" to enable debug mode
 *   ALLOWED_ORIGIN         — optional, restrict to one origin (default = no CORS headers)
 *   CAPI_SHARED_SECRET     — optional but strongly recommended; HMAC key
 *                            used to authenticate per-page signatures. The
 *                            publish-landing-page edge function computes
 *                            HMAC(secret, page_id) at deploy time and
 *                            embeds the result in the published page's
 *                            SOCTIV_TRACK_CONFIG. Without this, anyone
 *                            with the capiUrl can POST fake Lead/Purchase
 *                            events attributed to your pixel (conversion
 *                            fraud / EMQ poisoning). When unset, signature
 *                            check is skipped — ONLY acceptable in dev.
 */
const META_GRAPH_BASE = 'https://graph.facebook.com';

// ─── PII hashing (Deno-native) ──────────────────────────────────────────────

const HASHED_KEYS = new Set([
    'em', 'ph', 'fn', 'ln', 'ct', 'st', 'zp', 'country', 'external_id'
]);

async function sha256Hex(value: string): Promise<string> {
    const bytes = new TextEncoder().encode(value.trim().toLowerCase());
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

async function hashUserData(raw: Record<string, unknown> | null): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    if (!raw) return out;
    await Promise.all(
        Object.entries(raw).map(async ([k, v]) => {
            if (v == null || v === '') return;
            if (HASHED_KEYS.has(k)) {
                out[k] = await sha256Hex(String(v));
            } else {
                // fbc, fbp pass through as-is
                out[k] = v;
            }
        })
    );
    return out;
}

// ─── Input validation ───────────────────────────────────────────────────────

const ALLOWED_EVENTS = new Set([
    'PageView',
    'ViewContent',
    'Search',
    'AddToCart',
    'AddToWishlist',
    'InitiateCheckout',
    'AddPaymentInfo',
    'Purchase',
    'Lead',
    'CompleteRegistration',
    'Contact',
    'Subscribe',
]);

/** Meta Pixel IDs are numeric strings (always 15-16 digits as of 2026).
 *  The lower bound (10) matches the actual minimum Meta has ever issued;
 *  the upper bound (20) is generous for future Meta policy changes. */
function isValidPixelId(s: unknown): s is string {
    return typeof s === 'string' && /^\d{10,20}$/.test(s);
}

function validateInput(body: any): string | null {
    if (!body || typeof body !== 'object') return 'invalid_body';
    if (!body.event || typeof body.event !== 'object') return 'missing_event';
    if (!body.event.event_name) return 'missing_event_name';
    if (!body.event.event_id) return 'missing_event_id';
    if (typeof body.event.event_id !== 'string' || body.event.event_id.length > 64) {
        return 'bad_event_id';
    }
    if (!ALLOWED_EVENTS.has(body.event.event_name)) return 'unsupported_event_name';
    // pixel_id is OPTIONAL (single-pixel deployments rely on the env var).
    // When present, must look like a real Meta pixel ID — see isValidPixelId.
    if (body.pixel_id != null && body.pixel_id !== '' && !isValidPixelId(body.pixel_id)) {
        return 'bad_pixel_id';
    }
    return null;
}

// ─── Client info from request ───────────────────────────────────────────────

function clientInfoFromReq(req: Request): { client_ip_address?: string; client_user_agent?: string } {
    const xff = req.headers.get('x-forwarded-for') || '';
    const ip = (xff.split(',')[0] || '').trim() || undefined;
    const ua = req.headers.get('user-agent') || undefined;
    return { client_ip_address: ip, client_user_agent: ua };
}

// ─── Build Meta payload ─────────────────────────────────────────────────────

async function buildEvent(opts: {
    event: any;
    userData: Record<string, unknown>;
    sourceUrl: string;
    testEventCode?: string;
    extraUserData?: Record<string, unknown>;
}): Promise<any> {
    const merged = { ...opts.userData, ...(opts.extraUserData || {}) };
    const hashed = await hashUserData(merged);
    const payload: any = {
        event_name: opts.event.event_name,
        event_id: opts.event.event_id,
        event_time: opts.event.event_time || Math.floor(Date.now() / 1000),
        action_source: opts.event.action_source || 'website',
        event_source_url: opts.event.event_source_url || opts.sourceUrl || '',
        user_data: hashed,
    };
    if (opts.event.custom_data && Object.keys(opts.event.custom_data).length) {
        payload.custom_data = opts.event.custom_data;
    }
    if (opts.testEventCode) payload.test_event_code = opts.testEventCode;
    if (opts.event.opt_out) payload.opt_out = opts.event.opt_out;
    return payload;
}

// ─── Send to Meta ───────────────────────────────────────────────────────────

async function sendToMeta(opts: {
    pixelId: string;
    accessToken: string;
    apiVersion: string;
    events: any[];
    debug?: boolean;
}): Promise<any> {
    if (!opts.pixelId) throw new Error('META_PIXEL_ID is not set');
    if (!opts.accessToken) throw new Error('META_CAPI_ACCESS_TOKEN is not set');
    if (!opts.events?.length) throw new Error('no_events');

    const url = `${META_GRAPH_BASE}/${opts.apiVersion || 'v21.0'}/${opts.pixelId}/events`;
    const body: any = { data: opts.events, access_token: opts.accessToken };
    if (opts.debug) body.debug = true;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const text = await res.text();
    let parsed: any = null;
    try { parsed = text ? JSON.parse(text) : null; } catch (_) { /* ignore */ }

    if (!res.ok) {
        const err: any = new Error('meta_api_error');
        err.status = res.status;
        err.body = parsed || text;
        throw err;
    }

    // Defensive: Meta's CAPI returns `{ events_received: N, ... }` where N
    // can be 0 even on HTTP 200 (the request was accepted but the event
    // was rejected at the field level — e.g. bad IP, unsupported field).
    // Without this check, the browser would log "CAPI ok" and the
    // conversion would silently vanish. Throw so the caller surfaces a
    // useful error and the operator notices in the server logs.
    if (parsed && typeof parsed === 'object' && 'events_received' in parsed
        && (parsed.events_received == null || parsed.events_received < 1)) {
        const err: any = new Error('meta_zero_events_received');
        err.status = 502;
        err.body = parsed;
        throw err;
    }
    return parsed || { ok: true };
}

// ─── Handler ────────────────────────────────────────────────────────────────

/** Constant-time string equality. Avoids leaking the correct prefix length
 *  via early-exit timing when comparing HMAC signatures. */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

/** CORS allowlist for the CAPI proxy. Reading from env (not a wildcard `*`)
 *  closes the conversion-fraud vector where any website on the internet can
 *  POST fake conversion events to this endpoint and have them attributed
 *  to the target advertiser's Meta pixel. The legacy default of `*` was a
 *  real-world exposure — fixed in 2026-06.
 *
 *  Set ALLOWED_ORIGIN to a comma-separated list of full origins (e.g.
 *  `https://soctiv-landing.netlify.app,https://*.soctiv.ly`). If unset,
 *  no CORS headers are sent and browser cross-origin POSTs will be blocked
 *  by the browser's own CORS check — same-origin POSTs (Netlify → same
 *  Netlify origin) and server-to-server calls (no Origin header) still
 *  work. The previous default of `*` was removed; this is intentional. */
function getAllowedOrigins(): string[] {
    const raw = Deno.env.get('ALLOWED_ORIGIN') || '';
    return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function buildCorsHeaders(req: Request, allowed: string[]): Record<string, string> {
    if (allowed.length === 0) return {}; // No CORS — same-origin only
    const origin = req.headers.get('origin') || '';
    if (origin && allowed.includes(origin)) {
        return {
            'Access-Control-Allow-Origin': origin,
            'Vary': 'Origin',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
        };
    }
    return {}; // Origin not on allowlist — no CORS headers
}

Deno.serve(async (req) => {
    const allowed = getAllowedOrigins();
    const corsHeaders = buildCorsHeaders(req, allowed);

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    let body: any = {};
    try {
        body = await req.json();
    } catch (_) {
        return new Response(JSON.stringify({ error: 'invalid_json' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // ─── Per-page signature verification ────────────────────────────────────
    // Closes the conversion-fraud vector where anyone with the capiUrl can
    // POST fake Lead/Purchase events attributed to your pixel. The publish
    // edge function computes HMAC-SHA256(CAPI_SHARED_SECRET, page_id) at
    // deploy time and embeds the result in the published page's
    // SOCTIV_TRACK_CONFIG.pageToken. pixel.js forwards it as the
    // X-Soctiv-Signature header alongside a `page_id` body field.
    //
    // When CAPI_SHARED_SECRET is unset we skip the check (dev mode ONLY).
    // When set but signature is missing/mismatched, we 401.
    const sharedSecret = Deno.env.get('CAPI_SHARED_SECRET') || '';
    if (sharedSecret) {
        const providedSig = req.headers.get('x-soctiv-signature') || '';
        const providedPageId = String(body?.page_id || '');
        if (!providedSig) {
            return new Response(JSON.stringify({ error: 'missing_signature' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        if (!providedPageId) {
            return new Response(JSON.stringify({ error: 'missing_page_id' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw', enc.encode(sharedSecret),
            { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const sigBytes = await crypto.subtle.sign('HMAC', key, enc.encode(providedPageId));
        const expectedSig = 'sha256=' + [...new Uint8Array(sigBytes)]
            .map((b) => b.toString(16).padStart(2, '0')).join('');
        if (providedSig.length !== expectedSig.length || !timingSafeEqual(providedSig, expectedSig)) {
            return new Response(JSON.stringify({ error: 'bad_signature' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
    }

    const validationError = validateInput(body);
    if (validationError) {
        return new Response(JSON.stringify({ error: validationError }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        const userData = { ...(body.user_data || {}), ...clientInfoFromReq(req) };
        const event = await buildEvent({
            event: body.event,
            userData,
            sourceUrl: body.event?.event_source_url || req.headers.get('referer') || '',
            testEventCode: body.test_event_code || Deno.env.get('META_TEST_EVENT_CODE') || undefined,
            extraUserData: {},
        });

        // Per-page pixel routing: the Soctiv editor lets each landing page
        // set its own pixelId. If the browser sent one, use it; otherwise
        // fall back to the proxy's env var (single-pixel deployments).
        // isValidPixelId was already applied in validateInput.
        const envPixelId = Deno.env.get('META_PIXEL_ID') || '';
        const requestPixelId = isValidPixelId(body.pixel_id) ? body.pixel_id : '';
        const pixelId = requestPixelId || envPixelId;
        if (!pixelId) {
            // Mirror the sendToMeta guard so we surface a useful error
            // message (otherwise sendToMeta would throw the same thing).
            throw new Error('META_PIXEL_ID is not set (no env var, no request body pixel_id)');
        }

        const result = await sendToMeta({
            pixelId,
            accessToken: Deno.env.get('META_CAPI_ACCESS_TOKEN') || '',
            apiVersion: Deno.env.get('META_API_VERSION') || 'v21.0',
            events: [event],
            debug: Deno.env.get('META_DEBUG') === '1',
        });

        return new Response(JSON.stringify({ ok: true, result }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (err) {
        const e = err as Error & { status?: number; body?: unknown };
        const debug = Deno.env.get('META_DEBUG') === '1';
        if (debug) {
            console.error('[capi-proxy] error', err);
        }
        const status = e.status && e.status >= 400 && e.status < 600 ? 502 : 500;
        // Defense in depth: the `meta: e.body` field echoes Meta's response
        // (which can include the offending event we sent, including hashed
        // PII) back to the browser. Gate it behind META_DEBUG so an attacker
        // probing the endpoint with malformed events can't read back
        // server-side PII. The `message` field is the safe error code
        // (e.g. `meta_api_error`, `meta_zero_events_received`).
        return new Response(
            JSON.stringify({
                error: 'capi_failed',
                message: e.message,
                ...(debug ? { meta: e.body || undefined } : {}),
            }),
            { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
