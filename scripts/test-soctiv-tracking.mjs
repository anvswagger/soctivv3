#!/usr/bin/env node
/**
 * test-soctiv-tracking.mjs
 *
 * Verifies the Soctiv landing-page Meta Pixel + CAPI pipeline end-to-end
 * (browser side):
 *
 *   1. Loads `supabase/functions/publish-landing-page/assets/sha256.js` and
 *      `supabase/functions/publish-landing-page/assets/pixel.js` into a
 *      mocked browser environment (window, document.cookie, fetch, crypto).
 *   2. Configures pixel.js with `window.SOCTIV_TRACK_CONFIG`.
 *   3. Calls SOCTIV_TRACK.lead() / .purchase() / .viewContent() with
 *      realistic data and asserts the CAPI POST body shape matches the
 *      contract the capi-proxy edge function expects:
 *         { event: { event_name, event_id, event_time, event_source_url,
 *                    action_source, custom_data },
 *           user_data: { ... (hashed PII), fbp, fbc },
 *           pixel_id: '1234567890',
 *           test_event_code: 'TEST12345' (optional) }
 *   4. Also asserts that pixel.js's `fbq` calls use `trackSingle` with the
 *      `eventID` option so Meta can dedup browser + server events.
 *
 * This test would have caught the critical bug where pixel.js was sending a
 * flat payload (event_name at top level) but capi-proxy expected a wrapped
 * `{event: {...}}` envelope — every CAPI event was being rejected with
 * `missing_event`.
 *
 * Run with: `node scripts/test-soctiv-tracking.mjs`
 *
 * Each `assert` records a pass/fail; the script exits 1 on any failure.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import { TextEncoder, TextDecoder } from 'node:util';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const sha256Src = readFileSync(
    resolve(ROOT, 'supabase/functions/publish-landing-page/assets/sha256.js'),
    'utf8',
);
const pixelSrc = readFileSync(
    resolve(ROOT, 'supabase/functions/publish-landing-page/assets/pixel.js'),
    'utf8',
);

// ─── Test harness ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, label) {
    if (cond) {
        passed++;
        console.log(`  ✓ ${label}`);
    } else {
        failed++;
        failures.push(label);
        console.log(`  ✗ ${label}`);
    }
}

function assertEq(actual, expected, label) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) {
        passed++;
        console.log(`  ✓ ${label}`);
    } else {
        failed++;
        failures.push(label);
        console.log(`  ✗ ${label}`);
        console.log(`      expected: ${JSON.stringify(expected)}`);
        console.log(`      actual:   ${JSON.stringify(actual)}`);
    }
}

function assertHas(obj, key, label) {
    const ok = obj && Object.prototype.hasOwnProperty.call(obj, key);
    if (ok) {
        passed++;
        console.log(`  ✓ ${label}`);
    } else {
        failed++;
        failures.push(label);
        console.log(`  ✗ ${label} (key '${key}' missing from ${JSON.stringify(obj)})`);
    }
}

// ─── Mocked browser environment ─────────────────────────────────────────────

function createBrowser({ pixelId, capiUrl, testEventCode, cookies = {}, fbpFromInit = null } = {}) {
    const fetchCalls = [];
    const fbqCalls = [];

    // Sandbox object
    const sandbox = {
        // crypto: real SHA-256 via Node's webcrypto (the script uses
        // crypto.subtle.digest). `crypto.randomUUID` is also on webcrypto.
        crypto: globalThis.crypto,
        // TextEncoder/TextDecoder are used by sha256.js's SubtleCrypto
        // branch. Node 22 has them on globalThis, but vm contexts don't
        // inherit globals — inject explicitly.
        TextEncoder,
        TextDecoder,
        console: { log: () => {}, warn: () => {}, error: () => {}, info: () => {}, debug: () => {} },

        // document: minimal stubs
        document: {
            cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '),
            readyState: 'complete', // skip DOMContentLoaded wait
            addEventListener: () => {},
            getElementsByTagName: () => [null],
            head: { appendChild: () => {} },
            createElement: () => ({
                async: false,
                src: '',
                crossOrigin: '',
                parentNode: null,
            }),
        },

        // window.location
        location: { href: 'https://example.com/order', pathname: '/order', search: '' },

        // window.fetch: capture every call
        fetch: (url, opts) => {
            fetchCalls.push({ url, opts });
            // Return a fake 2xx JSON response
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ events_received: 1 }),
            });
        },

        // window.fbq: capture every call
        fbq: (...args) => { fbqCalls.push(args); },
    };

    // Inject the per-page tracking config BEFORE pixel.js runs.
    sandbox.SOCTIV_TRACK_CONFIG = { pixelId, capiUrl, testEventCode, debug: false };

    vm.createContext(sandbox);

    // In a real browser, `window` is the global object itself. In a Node
    // vm context, all globals are sandbox properties — but sha256.js and
    // pixel.js do `window.SOCTIV = ...` and `window.SOCTIV_TRACK = ...`,
    // so we need `window` to be reachable as a name inside the sandbox.
    // We expose the sandbox itself under the name `window` (matching the
    // browser convention where `window.window === window`).
    sandbox.window = sandbox;

    // Load sha256 first, then pixel
    vm.runInContext(sha256Src, sandbox, { filename: 'sha256.js' });
    vm.runInContext(pixelSrc, sandbox, { filename: 'pixel.js' });

    // After pixel.js runs, the browser's _fbp cookie is set by fbq. Simulate
    // that for the re-read path.
    if (fbpFromInit) {
        sandbox.document.cookie = (sandbox.document.cookie ? sandbox.document.cookie + '; ' : '') + `_fbp=${fbpFromInit}`;
    }

    return { sandbox, fetchCalls, fbqCalls };
}

function parseFetchBody(call) {
    try {
        return JSON.parse(call.opts.body);
    } catch (e) {
        return null;
    }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

const tests = [];

function test(name, fn) {
    tests.push({ name, fn });
}

test('pixel.js loads and exposes window.SOCTIV_TRACK', () => {
    const { sandbox } = createBrowser({ pixelId: '111111111111111', capiUrl: 'https://capi.example/capi' });
    assert(typeof sandbox.SOCTIV_TRACK === 'object', 'window.SOCTIV_TRACK is an object');
    assert(typeof sandbox.SOCTIV_TRACK.lead === 'function', 'SOCTIV_TRACK.lead is a function');
    assert(typeof sandbox.SOCTIV_TRACK.purchase === 'function', 'SOCTIV_TRACK.purchase is a function');
    assert(typeof sandbox.SOCTIV_TRACK.setUserData === 'function', 'SOCTIV_TRACK.setUserData is a function');
    assert(typeof sandbox.SOCTIV_TRACK.eventId === 'function', 'SOCTIV_TRACK.eventId is a function');
});

test('pageview() fires fbq trackSingle PageView (no CAPI without user data)', () => {
    const { sandbox, fbqCalls, fetchCalls } = createBrowser({ pixelId: '111111111111111', capiUrl: 'https://capi.example/capi' });
    fetchCalls.length = 0;
    fbqCalls.length = 0;
    sandbox.SOCTIV_TRACK.pageview();
    assert(fbqCalls.some(c => c[0] === 'trackSingle' && c[1] === '111111111111111' && c[2] === 'PageView'),
        'fbq("trackSingle", PIXEL_ID, "PageView") was called');
    // CAPI not sent for PageView (no user data)
    assert(fetchCalls.length === 0, 'CAPI not called for PageView (no user data)');
});

test('Lead CAPI body has the wrapped {event:{...}} envelope (not the old flat shape)', () => {
    const { sandbox, fetchCalls, fbqCalls } = createBrowser({
        pixelId: '222222222222222',
        capiUrl: 'https://capi.example/capi',
        fbpFromInit: 'fb.1.999.test-fbp',
    });
    fetchCalls.length = 0;
    fbqCalls.length = 0;

    return sandbox.SOCTIV_TRACK.setUserData({
        name: 'أحمد محمد',
        phone: '0912345678',
        location: 'طرابلس، شارع الجمهورية',
        external_id: 'LY-TEST01',
    }).then(() => {
        sandbox.SOCTIV_TRACK.lead({
            qty: 2,
            value: 178,
            orderId: 'LY-TEST01',
            eventId: 'lead_LY-TEST01',
        });

        assert(fetchCalls.length === 1, `exactly 1 CAPI fetch fired (got ${fetchCalls.length})`);
        const body = parseFetchBody(fetchCalls[0]);
        assert(body !== null, 'CAPI body is valid JSON');
        assertHas(body, 'event', 'body has top-level "event" envelope (the fix)');
        assertHas(body, 'user_data', 'body has top-level "user_data" (the fix)');
        assertHas(body, 'pixel_id', 'body has top-level "pixel_id" for per-page routing');

        // CRITICAL: the OLD buggy shape would have these at top level.
        // Make sure they're NOT there anymore.
        assert(!('event_name' in body), 'body does NOT have flat "event_name" (old bug)');
        assert(!('event_id' in body), 'body does NOT have flat "event_id" (old bug)');
        assert(!('custom_data' in body), 'body does NOT have flat "custom_data" (old bug)');
        assert(!('action_source' in body), 'body does NOT have flat "action_source" (old bug)');

        // Verify the wrapped shape
        assertEq(body.event.event_name, 'Lead', 'body.event.event_name === "Lead"');
        assertEq(body.event.event_id, 'lead_LY-TEST01', 'body.event.event_id === "lead_LY-TEST01"');
        assertEq(body.event.action_source, 'website', 'body.event.action_source === "website"');
        assertEq(body.event.event_source_url, 'https://example.com/order', 'body.event.event_source_url set');
        assertHas(body.event, 'event_time', 'body.event.event_time is present');
        assertEq(typeof body.event.event_time, 'number', 'body.event.event_time is a number');

        // custom_data lives inside the envelope
        assertHas(body.event, 'custom_data', 'body.event has custom_data');
        assertEq(body.event.custom_data.value, 178, 'body.event.custom_data.value === 178');
        assertEq(body.event.custom_data.currency, 'LYD', 'body.event.custom_data.currency === "LYD"');
        assertEq(body.event.custom_data.num_items, 2, 'body.event.custom_data.num_items === 2');
        assertEq(body.event.custom_data.order_id, 'LY-TEST01', 'body.event.custom_data.order_id === "LY-TEST01"');
        assertEq(body.event.custom_data.payment_method, 'cod', 'body.event.custom_data.payment_method === "cod"');

        // The dead noise field is gone
        assert(!('content_type_original' in (body.event.custom_data || {})),
            'body.event.custom_data does NOT contain dead "content_type_original" field');

        // user_data shape. PII fields are sent in their RAW form here
        // (e.g. "+218912345678") — the CAPI proxy re-hashes them server-side
        // before forwarding to Meta. This is the established design:
        //   1. Browser pixel uses state.userDataHashed for fbq AM (hashed PII
        //      on the client, never raw).
        //   2. CAPI posts raw PII to the proxy, which hashes again — a
        //      defense-in-depth pattern that protects against a buggy or
        //      compromised client trying to bypass the hash.
        // Empty values are dropped by mergeUserData's `if (src[k])` filter
        // (em is empty because the form has no email field).
        assertHas(body.user_data, 'fbp', 'body.user_data.fbp is present');
        assertEq(body.user_data.fbp, 'fb.1.999.test-fbp', 'body.user_data.fbp is the re-read cookie value');
        assertHas(body.user_data, 'ph', 'body.user_data.ph is present (raw)');
        assertEq(body.user_data.ph, '+218912345678', 'body.user_data.ph is the raw E.164 phone');
        assertHas(body.user_data, 'fn', 'body.user_data.fn is present (raw)');
        assertEq(body.user_data.fn, 'أحمد', 'body.user_data.fn is the raw first name');
        assertHas(body.user_data, 'ln', 'body.user_data.ln is present (raw)');
        assertHas(body.user_data, 'ct', 'body.user_data.ct is present (raw)');
        assertHas(body.user_data, 'external_id', 'body.user_data.external_id is present (raw)');
        assertEq(body.user_data.country, 'ly', 'body.user_data.country === "ly"');
        // em was empty — the mergeUserData filter drops empty fields. Good.
        assert(!('em' in body.user_data),
            'body.user_data.em is dropped (empty in the form, mergeUserData filters falsy)');

        // pixel_id for per-page routing
        assertEq(body.pixel_id, '222222222222222', 'body.pixel_id is the per-page pixel id');
    });
});

test('Browser pixel uses trackSingle + eventID for dedup with CAPI', () => {
    const { sandbox, fbqCalls, fetchCalls } = createBrowser({
        pixelId: '333333333333333',
        capiUrl: 'https://capi.example/capi',
    });
    fbqCalls.length = 0;
    fetchCalls.length = 0;

    return sandbox.SOCTIV_TRACK.setUserData({
        name: 'فاطمة الزهراء',
        phone: '0923456789',
        location: 'بنغازي',
        external_id: 'LY-TEST02',
    }).then(() => {
        sandbox.SOCTIV_TRACK.lead({
            qty: 1,
            value: 89,
            orderId: 'LY-TEST02',
            eventId: 'lead_LY-TEST02',
        });

        // The browser pixel call should be trackSingle(pixelId, 'Lead', customData, {eventID})
        const trackCall = fbqCalls.find(c => c[0] === 'trackSingle' && c[2] === 'Lead');
        assert(trackCall !== undefined, 'fbq trackSingle Lead was called');
        assertEq(trackCall[1], '333333333333333', 'trackSingle used the per-page pixelId');
        assertEq(trackCall[3].value, 89, 'customData.value === 89');

        // eventID is the dedup key — must match the CAPI event_id
        const opts = trackCall[4];
        assert(opts && opts.eventID === 'lead_LY-TEST02', 'fbq options.eventID matches CAPI event_id');
    });
});

test('testEventCode is forwarded to CAPI when configured', () => {
    const { sandbox, fetchCalls } = createBrowser({
        pixelId: '444444444444444',
        capiUrl: 'https://capi.example/capi',
        testEventCode: 'TEST12345',
    });
    fetchCalls.length = 0;
    return sandbox.SOCTIV_TRACK.setUserData({
        name: 'خالد',
        phone: '0945678901',
        location: 'مصراتة',
        external_id: 'LY-TEST03',
    }).then(() => {
        sandbox.SOCTIV_TRACK.lead({
            qty: 3,
            value: 250,
            orderId: 'LY-TEST03',
            eventId: 'lead_LY-TEST03',
        });
        const body = parseFetchBody(fetchCalls[0]);
        assertEq(body.test_event_code, 'TEST12345', 'body.test_event_code === "TEST12345"');
    });
});

test('Purchase event has correct shape (with contents array)', () => {
    const { sandbox, fetchCalls } = createBrowser({
        pixelId: '555555555555555',
        capiUrl: 'https://capi.example/capi',
    });
    fetchCalls.length = 0;
    return sandbox.SOCTIV_TRACK.setUserData({
        name: 'سارة',
        phone: '0934567890',
        location: 'الزاوية',
        external_id: 'LY-TEST04',
    }).then(() => {
        sandbox.SOCTIV_TRACK.purchase({
            qty: 2,
            value: 178,
            orderId: 'LY-TEST04',
            eventId: 'purchase_LY-TEST04',
        });
        const body = parseFetchBody(fetchCalls[0]);
        assertEq(body.event.event_name, 'Purchase', 'event_name === "Purchase"');
        assertEq(body.event.event_id, 'purchase_LY-TEST04', 'event_id === "purchase_LY-TEST04"');
        assertHas(body.event.custom_data, 'contents', 'custom_data has contents array (Meta spec)');
        assertEq(body.event.custom_data.contents[0].id, 'HEADPHONES-001', 'contents[0].id is set');
        assertEq(body.event.custom_data.contents[0].quantity, 2, 'contents[0].quantity === 2');
    });
});

test('CAPI is SKIPPED for events with no user data (e.g. ViewContent on first load)', () => {
    const { sandbox, fetchCalls } = createBrowser({
        pixelId: '666666666666666',
        capiUrl: 'https://capi.example/capi',
    });
    fetchCalls.length = 0;
    sandbox.SOCTIV_TRACK.viewContent();
    assert(fetchCalls.length === 0, 'CAPI not called for ViewContent without user data');
});

test('user_data.st is empty (Libya has no states — do not fabricate one)', () => {
    const { sandbox, fetchCalls } = createBrowser({
        pixelId: '777777777777777',
        capiUrl: 'https://capi.example/capi',
    });
    fetchCalls.length = 0;
    return sandbox.SOCTIV_TRACK.setUserData({
        name: 'محمد',
        phone: '0911111111',
        location: 'سرت، شارع طرابلس',
        external_id: 'LY-TEST05',
    }).then(() => {
        sandbox.SOCTIV_TRACK.lead({
            qty: 1,
            value: 89,
            orderId: 'LY-TEST05',
            eventId: 'lead_LY-TEST05',
        });
        // The pixel.js source should have `st: ''` — verify by reading it.
        // The `''` is filtered out by mergeUserData's `if (src[k])` check,
        // so body.user_data should NOT contain `st` at all (rather than
        // containing the SHA-256 of an empty string).
        const body = parseFetchBody(fetchCalls[0]);
        assert(!('st' in (body.user_data || {})),
            'body.user_data.st is absent (filtered out as empty, not fabricated as a city)');
        // The city IS in `ct` (the correct place for a city).
        assertHas(body.user_data, 'ct', 'body.user_data.ct is present (the city)');
        // Confirm pixel.js source uses `st: ''` (not `st: loc.city`).
        assert(pixelSrc.includes("st: ''"),
            'pixel.js source uses `st: ""` (not the old `st: loc.city`)');
        assert(!pixelSrc.includes('st: loc.city'),
            'pixel.js source does NOT contain the old `st: loc.city` heuristic');
    });
});

test('capi-proxy source matches the new payload contract', () => {
    const capiProxy = readFileSync(
        resolve(ROOT, 'supabase/functions/capi-proxy/index.ts'),
        'utf8',
    );
    // The validation must check `body.event.event_name` (wrapped) — not
    // `body.event_name` (flat).
    assert(capiProxy.includes('body.event.event_name'),
        'capi-proxy validates body.event.event_name (wrapped shape)');
    assert(capiProxy.includes('body.event.event_id'),
        'capi-proxy validates body.event.event_id (wrapped shape)');
    assert(capiProxy.includes('isValidPixelId'),
        'capi-proxy has isValidPixelId helper');

    // The handler must use the per-page pixelId from body if present.
    assert(capiProxy.includes('requestPixelId'),
        'capi-proxy reads pixel_id from request body for per-page routing');
    assert(capiProxy.includes('envPixelId'),
        'capi-proxy falls back to META_PIXEL_ID env var');
});

test('pixelId regex is tightened from 5-30 to 10-20 digits (matches real Meta pixel IDs)', () => {
    const capiProxy = readFileSync(
        resolve(ROOT, 'supabase/functions/capi-proxy/index.ts'),
        'utf8',
    );
    const lanidngMeta = readFileSync(
        resolve(ROOT, 'LANIDNG PAGE SOCTIV/api/_lib/meta.js'),
        'utf8',
    );
    // The old regex accepted 5-30 digits. The new regex is 10-20 (real
    // Meta pixel IDs are 15-16 digits; the upper bound is generous for
    // future Meta policy changes).
    assert(capiProxy.includes('/^\\d{10,20}$/'),
        'capi-proxy uses tightened /^\\d{10,20}$/ regex');
    assert(!capiProxy.includes('/^\\d{5,30}$/'),
        'capi-proxy does NOT still have the old /^\\d{5,30}$/ regex');
    assert(lanidngMeta.includes('/^\\d{10,20}$/'),
        'standalone _lib/meta.js uses tightened /^\\d{10,20}$/ regex');
    assert(!lanidngMeta.includes('/^\\d{5,30}$/'),
        'standalone _lib/meta.js does NOT still have the old /^\\d{5,30}$/ regex');
});

test('pixelId normalization rejects 0 / too-short / too-long values (C2)', () => {
    // The publish function normalizes tracking.pixelId server-side so the
    // template's `{{#if tracking.pixelId}}` works correctly. Before this
    // fix, a pixelId of "0" was treated as falsy by isTruthy, silently
    // hiding the tracking scripts.
    const publishFn = readFileSync(
        resolve(ROOT, 'supabase/functions/publish-landing-page/index.ts'),
        'utf8',
    );
    const previewFn = readFileSync(
        resolve(ROOT, 'src/services/soctivLandingPreview.ts'),
        'utf8',
    );
    // The normalization must reject '0' explicitly.
    assert(publishFn.includes("cleaned === '0'"),
        'publish function normalizes pixelId === "0" to empty (C2 fix)');
    assert(previewFn.includes("cleaned === '0'"),
        'preview function normalizes pixelId === "0" to empty (C2 fix)');
    // The normalization must reject too-short (1-9 digits) and too-long (21+).
    assert(publishFn.includes('cleaned.length < 10'),
        'publish function rejects pixelId shorter than 10 digits');
    assert(publishFn.includes('cleaned.length > 20'),
        'publish function rejects pixelId longer than 20 digits');
});

test('XSS hardening: template uses pre-built track config script, not triple-brace substitution (C1)', () => {
    const tpl = readFileSync(
        resolve(ROOT, 'supabase/functions/publish-landing-page/template_index.html'),
        'utf8',
    );
    const publishFn = readFileSync(
        resolve(ROOT, 'supabase/functions/publish-landing-page/index.ts'),
        'utf8',
    );
    // The old template had `pixelId: "{{{tracking.pixelId}}}"` etc., which
    // is a raw, un-escaped substitution. A user-controlled value with
    // `</script>` would break out of the inlined script block.
    assert(!tpl.includes('"{{{tracking.pixelId}}}"'),
        'template does NOT use triple-brace `{{{tracking.pixelId}}}` (XSS sink)');
    assert(!tpl.includes('"{{{tracking.capiUrl}}}"'),
        'template does NOT use triple-brace `{{{tracking.capiUrl}}}` (XSS sink)');
    assert(!tpl.includes('"{{{tracking.testEventCode}}}"'),
        'template does NOT use triple-brace `{{{tracking.testEventCode}}}` (XSS sink)');
    // The new template uses a pre-built server-side script via
    // `{{{__trackConfigScript}}}` (raw, but the value is JSON.stringify'd
    // with `</script>` escape so it's safe).
    assert(tpl.includes('{{{__trackConfigScript}}}'),
        'template uses pre-built {{{__trackConfigScript}}} placeholder');
    // The publish function must build this safely.
    assert(publishFn.includes('buildTrackConfigScript'),
        'publish function has buildTrackConfigScript helper');
    assert(publishFn.includes('__trackConfigScript'),
        'publish function injects __trackConfigScript into template context');
    // The helper must escape `</script>`.
    assert(publishFn.includes('<\\\\/$1') || publishFn.includes('<\\/$1'),
        'buildTrackConfigScript escapes </script> terminator');
});

test('CORS allowlist closes the conversion-fraud vector (H3)', () => {
    const capiProxy = readFileSync(
        resolve(ROOT, 'supabase/functions/capi-proxy/index.ts'),
        'utf8',
    );
    const lanidngMeta = readFileSync(
        resolve(ROOT, 'LANIDNG PAGE SOCTIV/api/_lib/meta.js'),
        'utf8',
    );
    // The handler must NOT default to `*` — that was the conversion-fraud
    // vector. The new behavior is: read from ALLOWED_ORIGIN env var, allow
    // only listed origins, no wildcard.
    assert(!capiProxy.includes("Deno.env.get('ALLOWED_ORIGIN') || '*'"),
        'capi-proxy does NOT default to ALLOWED_ORIGIN="*" wildcard');
    assert(capiProxy.includes("getAllowedOrigins"),
        'capi-proxy uses getAllowedOrigins helper for CORS allowlist');
    assert(!lanidngMeta.includes("res.setHeader('Access-Control-Allow-Origin', origin || '*')"),
        'standalone _lib/meta.js does NOT default to origin="*" wildcard');
    assert(lanidngMeta.includes("getAllowedOrigins"),
        'standalone _lib/meta.js uses getAllowedOrigins helper');
});

test('PII leak in CAPI error responses is gated behind META_DEBUG (M4)', () => {
    const capiProxy = readFileSync(
        resolve(ROOT, 'supabase/functions/capi-proxy/index.ts'),
        'utf8',
    );
    const lanidngCapi = readFileSync(
        resolve(ROOT, 'LANIDNG PAGE SOCTIV/api/capi.js'),
        'utf8',
    );
    // The `meta: e.body` field echoes Meta's response (which can include
    // hashed PII) back to the browser. It must be gated behind META_DEBUG
    // via a conditional spread (`...(debug ? { meta: ... } : {})`).
    // The old shape was a plain `meta: e.body || undefined` line OUTSIDE
    // any debug check — that would always include the leaked field.
    assert(capiProxy.includes('debug ? { meta:'),
        'capi-proxy gates `meta: e.body` behind META_DEBUG (conditional spread)');
    // Negative test: look for the OLD unconditional shape. The new code
    // wraps the field in a conditional spread, so a bare `meta: e.body || undefined`
    // at top level of the response object (not inside a ternary) would
    // indicate the leak wasn't actually fixed.
    // We scan the catch block to find the response object — easier to
    // check that the response builder doesn't include the field outside
    // the debug conditional. The simplest robust assertion: the literal
    // substring "meta: e.body" must appear inside a `debug ? {` ternary,
    // not as a standalone object key.
    const debugSpread = capiProxy.match(/\.\.\.\(debug\s*\?\s*\{\s*meta:/g) || [];
    assert(debugSpread.length > 0,
        'capi-proxy includes the `meta: e.body` field inside a debug-conditional spread');
    assert(lanidngCapi.includes('debug ? { meta:'),
        'standalone capi.js gates `meta: e.body` behind META_DEBUG');
    const debugSpreadL = lanidngCapi.match(/\.\.\.\(debug\s*\?\s*\{\s*meta:/g) || [];
    assert(debugSpreadL.length > 0,
        'standalone capi.js includes the `meta: e.body` field inside a debug-conditional spread');
});

test('events_received === 0 from Meta is treated as an error, not a success (L1)', () => {
    const capiProxy = readFileSync(
        resolve(ROOT, 'supabase/functions/capi-proxy/index.ts'),
        'utf8',
    );
    const lanidngMeta = readFileSync(
        resolve(ROOT, 'LANIDNG PAGE SOCTIV/api/_lib/meta.js'),
        'utf8',
    );
    // Meta's CAPI returns 200 OK with events_received: 0 when an event is
    // rejected at the field level. Without this check, the browser logs
    // "CAPI ok" and the conversion silently vanishes.
    assert(capiProxy.includes('events_received') && capiProxy.includes('meta_zero_events_received'),
        'capi-proxy checks events_received and throws on 0');
    assert(lanidngMeta.includes('events_received') && lanidngMeta.includes('meta_zero_events_received'),
        'standalone _lib/meta.js checks events_received and throws on 0');
});

test('LANIDNG PAGE SOCTIV standalone CAPI handler matches the new contract', () => {
    const lanidngMeta = readFileSync(
        resolve(ROOT, 'LANIDNG PAGE SOCTIV/api/_lib/meta.js'),
        'utf8',
    );
    const lanidngCapi = readFileSync(
        resolve(ROOT, 'LANIDNG PAGE SOCTIV/api/capi.js'),
        'utf8',
    );
    const lanidngPixel = readFileSync(
        resolve(ROOT, 'LANIDNG PAGE SOCTIV/js/pixel.js'),
        'utf8',
    );
    // Same wrapped shape validation
    assert(lanidngMeta.includes('body.event.event_name'),
        'standalone _lib/meta.js validates wrapped body.event.event_name');
    // Same isValidPixelId helper
    assert(lanidngMeta.includes('isValidPixelId'),
        'standalone _lib/meta.js exports isValidPixelId helper');
    assert(lanidngMeta.includes("module.exports = {") && lanidngMeta.includes("isValidPixelId,"),
        'standalone _lib/meta.js exports isValidPixelId in module.exports');
    // capi.js uses per-page pixelId
    assert(lanidngCapi.includes('requestPixelId'),
        'standalone capi.js reads pixel_id from request body');
    // pixel.js uses wrapped shape. The check below looks for the OLD
    // buggy shape (a `var payload = {` block that has `event_name:` as a
    // direct top-level key, NOT nested inside `event: { ... }`). The
    // simplest robust way: extract the `var payload = { ... };` block and
    // parse its top-level keys via a small JSON-ish walk.
    const fireSection = lanidngPixel.slice(lanidngPixel.indexOf('function fire'));
    assert(fireSection.includes('event: {') && fireSection.includes('event_name:'),
        'standalone pixel.js fire() sends wrapped {event: {event_name, ...}} shape');

    // Extract the payload object literal from `var payload = { ... };` in
    // the fire() function. We deliberately scan from the FIRST `var payload`
    // (the one that builds the CAPI body) and stop at the first `};` that
    // closes it.
    const payloadStart = fireSection.indexOf('var payload = {');
    if (payloadStart < 0) {
        failed++;
        failures.push('standalone pixel.js fire() does not contain `var payload = {`');
        console.log('  ✗ standalone pixel.js fire() does not contain `var payload = {`');
    } else {
        // Find the matching `};` — the payload object ends at the first `;`
        // after the opening `{`. This works because the payload literal is
        // a single object on multiple lines.
        const openBrace = fireSection.indexOf('{', payloadStart);
        let depth = 1;
        let pos = openBrace + 1;
        while (pos < fireSection.length && depth > 0) {
            const ch = fireSection[pos];
            if (ch === '{') depth++;
            else if (ch === '}') depth--;
            pos++;
        }
        const payloadLiteral = fireSection.slice(openBrace + 1, pos - 1);

        // Walk the literal to find its top-level keys. A "top-level key" is
        // an identifier that appears at brace depth 0 followed by `:`. We
        // commit the buffer at every top-level newline, comma, opening
        // brace, OR closing brace — so a key like `event:` followed by `{`
        // on the same line is captured BEFORE we descend into the nested
        // object. Inside a nested object we drop chars so the buffer can't
        // accumulate a false-positive key on the way out.
        const topLevelKeys = [];
        let nested = 0;
        let buf = '';
        const commit = () => {
            const m = buf.match(/^\s*(\w+)\s*:/);
            if (m) topLevelKeys.push(m[1]);
            buf = '';
        };
        for (let i = 0; i < payloadLiteral.length; i++) {
            const ch = payloadLiteral[i];
            if (ch === '{') {
                commit();        // capture the key (e.g. "event") before
                nested++;        // descending into the nested object
            } else if (ch === '}') {
                nested--;
                commit();        // capture keys on the line that closes us
            } else if (nested === 0 && (ch === '\n' || ch === ',')) {
                commit();
            } else if (nested === 0) {
                buf += ch;
            } else {
                // inside a nested object — drop chars to keep buf from
                // accumulating junk that might look like a key on the way out
            }
        }
        commit();
        assert(!topLevelKeys.includes('event_name'),
            'standalone pixel.js fire() payload does NOT have flat "event_name" top-level key');
        assert(topLevelKeys.includes('event'),
            `standalone pixel.js fire() payload has wrapped "event" top-level key (got: ${topLevelKeys.join(', ')})`);
        assert(topLevelKeys.includes('user_data'),
            'standalone pixel.js fire() payload has "user_data" top-level key');
    }
});

// ─── Runner ──────────────────────────────────────────────────────────────────

console.log('\n=== Soctiv Landing Page Tracking Tests ===\n');

(async () => {
    for (const t of tests) {
        console.log(`\n— ${t.name} —`);
        try {
            await t.fn();
        } catch (err) {
            failed++;
            failures.push(`${t.name}: ${err.message}`);
            console.log(`  ✗ EXCEPTION: ${err.message}`);
            if (err.stack) console.log(err.stack);
        }
    }
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
    if (failed > 0) {
        console.log('Failures:');
        for (const f of failures) console.log(`  - ${f}`);
        process.exit(1);
    } else {
        console.log('All Soctiv tracking contract tests passed.\n');
        process.exit(0);
    }
})();
