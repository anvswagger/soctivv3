#!/usr/bin/env node
/**
 * test-thank-you-swap.mjs — end-to-end browser test for the editor
 * preview form submit flow. Verifies:
 *
 *   1. __SOCTIV_PREVIEW__ is set as an OBJECT (not boolean true)
 *      — so the runtime's `preview.thankYouHtml` check passes
 *   2. __SOCTIV_PREVIEW__.thankYouHtml contains the success block markers
 *      (id="success", id="cust-name", etc.)
 *   3. On form submit + successful webhook POST, the iframe swaps to
 *      the FULL thank-you HTML via document.write — not the inline
 *      confirmation card
 *   4. The thank-you page's success block is visible after the swap
 *
 * Uses Chrome DevTools Protocol via Node ws (same harness as
 * scripts/test-cdp-flow.mjs).
 */
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = 'dist/soctiv-preview';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
const LOG = join(OUT_DIR, 'thank-you-swap.log');
const SCREENSHOT = join(OUT_DIR, 'thank-you-swap.png');

const PORT = 9335;
// Use the SINGLE-FILE preview.html (all CSS + JS inlined) so the test
// doesn't depend on sibling asset files loading over file:// (which
// Chromium blocks for security on local file URLs in headless mode).
const URL = 'file:///' + join(process.cwd(), 'dist/soctiv-preview', 'preview.html').replace(/\\/g, '/');
// Use a UNIQUE user-data-dir each run. The runtime persists
// `soctiv_last_order` in sessionStorage and on the next page load
// immediately swaps to the thank-you page (no form fields visible).
// A fresh profile guarantees a clean sessionStorage. Also avoids Edge's
// session-restore reusing the previous test's submitted URL.
const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const USER_DATA_DIR = join(OUT_DIR, `.edge-profile-thank-you-swap-${RUN_ID}`);

const log = [];
const push = (s) => { log.push(s); process.stdout.write(s + '\n'); };

push('Starting Edge with CDP on port ' + PORT);
const edge = spawn(EDGE, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--window-size=1280,2400',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    URL,
], { stdio: ['ignore', 'ignore', 'ignore'] });

async function fetchTabs() {
    for (let i = 0; i < 60; i++) {
        try {
            const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
            if (r.ok) return r.json();
        } catch {}
        await new Promise(r => setTimeout(r, 200));
    }
    throw new Error('CDP did not start');
}
async function getPageWs() {
    for (let i = 0; i < 60; i++) {
        try {
            const r = await fetch(`http://127.0.0.1:${PORT}/json`);
            const tabs = await r.json();
            const allPages = tabs.filter(t => t.type === 'page');
            if (i === 5) push('  [debug] pages: ' + allPages.map(t => t.url).join(', '));
            const page = tabs.find(t => t.type === 'page' && t.url.includes('preview.html'));
            if (page) return page.webSocketDebuggerUrl;
        } catch {}
        await new Promise(r => setTimeout(r, 200));
    }
    throw new Error('Page tab not found');
}

const v = await fetchTabs();
push('Edge ' + v.Browser);
const wsUrl = await getPageWs();
push('Page tab WS: ' + wsUrl);

const WS = (await import('ws').catch(() => null))?.WebSocket ?? globalThis.WebSocket;
const ws = new WS(wsUrl);

let nextId = 1;
const pending = new Map();
const consoleLogs = [];

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id != null && pending.has(msg.id)) {
        const { resolve } = pending.get(msg.id);
        pending.delete(msg.id);
        resolve(msg.result || msg.error);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
        const args = (msg.params.args || []).map(a => a.value ?? a.description ?? '').join(' ');
        consoleLogs.push(`[${msg.params.type}] ${args}`);
    } else if (msg.method === 'Runtime.exceptionThrown') {
        consoleLogs.push(`[exception] ${msg.params.exceptionDetails.text} ${msg.params.exceptionDetails.exception?.description || ''}`);
    } else if (msg.method === 'Log.entryAdded') {
        consoleLogs.push(`[log] ${msg.params.entry.text}`);
    }
});

function send(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve) => {
        pending.set(id, { resolve });
        ws.send(JSON.stringify({ id, method, params }));
    });
}

await new Promise(r => ws.on('open', r));
await send('Runtime.enable');
await send('Page.enable');
await send('Log.enable');

// Give the page time to fully load + initialize (includes external
// styles.css, runtime.js, pixel.js, sha256.js)
await new Promise(r => setTimeout(r, 5000));

// Belt-and-suspenders: clear sessionStorage in case Edge's session
// restore pulled a previous tab that had soctiv_last_order persisted.
// Then hard-reload so the runtime re-runs from a known-clean state.
await send('Runtime.evaluate', {
    expression: `
        try { sessionStorage.clear(); } catch (_) {}
        location.href = location.pathname;
    `,
});
await new Promise(r => setTimeout(r, 2000));

push('\n=== TEST 1: __SOCTIV_PREVIEW__ is an object (not boolean) ===');
const flagCheck = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
        type: typeof window.__SOCTIV_PREVIEW__,
        isObject: typeof window.__SOCTIV_PREVIEW__ === 'object',
        hasThankYouHtml: !!(window.__SOCTIV_PREVIEW__ && window.__SOCTIV_PREVIEW__.thankYouHtml),
        thankYouHtmlLength: window.__SOCTIV_PREVIEW__?.thankYouHtml?.length || 0,
        thankYouHtmlHead: (window.__SOCTIV_PREVIEW__?.thankYouHtml || '').slice(0, 200),
    })`,
    returnByValue: true,
});
push('  ' + flagCheck.result.value);
const flag = JSON.parse(flagCheck.result.value);

if (!flag.isObject) {
    push('  ✗ FAIL: __SOCTIV_PREVIEW__ is NOT an object (got ' + flag.type + ')');
    push('  ✗ This means the runtime will fall back to showPreviewConfirmation (inline card)');
} else if (!flag.hasThankYouHtml) {
    push('  ✗ FAIL: __SOCTIV_PREVIEW__ is an object but thankYouHtml is missing');
} else {
    push(`  ✓ PASS: object with thankYouHtml (${flag.thankYouHtmlLength} chars)`);
}

push('\n=== TEST 2: Embedded thank-you HTML contains expected markers ===');
const thankYouMarkers = await send('Runtime.evaluate', {
    expression: `(() => {
        const html = window.__SOCTIV_PREVIEW__?.thankYouHtml || '';
        return JSON.stringify({
            hasSuccess: html.includes('id="success"'),
            hasCustName: html.includes('id="cust-name"'),
            hasOrderId: html.includes('id="order-id"'),
            hasRuntime: html.includes('initThankYou') || html.includes('sessionStorage'),
            hasWhatsApp: html.includes('واتساب') || html.includes('WhatsApp') || html.includes('wa.me'),
        });
    })()`,
    returnByValue: true,
});
push('  ' + thankYouMarkers.result.value);

push('\n=== TEST 3: Form fields exist ===');
const formCheck = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
        hasForm: !!document.getElementById('order-form'),
        hasNameField: !!document.getElementById('f-name'),
        hasPhoneField: !!document.getElementById('f-phone'),
        hasLocationField: !!document.getElementById('f-location'),
        hasSubmitBtn: !!document.getElementById('submit-btn'),
        bodyChildrenCount: document.body.children.length,
        bodyInnerLength: document.body.innerHTML.length,
        bodyHasOrderForm: document.body.innerHTML.includes('id="order-form"'),
        bodyHasFName: document.body.innerHTML.includes('id="f-name"'),
        title: document.title,
        headChildCount: document.head.children.length,
        url: location.href,
    })`,
    returnByValue: true,
});
push('  ' + formCheck.result.value);

push('\n=== TEST 4: Mock the webhook (intercept fetch) + fill form + submit ===');
// Mock fetch BEFORE submitting so the runtime's POST resolves successfully.
await send('Runtime.evaluate', {
    expression: `
        window.__originalFetch = window.fetch;
        window.fetch = function(url, opts) {
            if (typeof url === 'string' && url.includes('facebook-leads-webhook')) {
                return Promise.resolve(new Response(JSON.stringify({
                    ok: true,
                    lead_id: 'mock-lead-12345',
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                }));
            }
            return window.__originalFetch(url, opts);
        };
    `,
});

// Fill the form
await send('Runtime.evaluate', {
    expression: `
        document.getElementById('f-name').value = 'أحمد محمد';
        document.getElementById('f-phone').value = '0912345678';
        document.getElementById('f-location').value = 'طرابلس - شارع الجمهورية';
    `,
});
push('  Filled form');

push('\n=== TEST 5: Submit form and check what happens ===');
const submitResult = await send('Runtime.evaluate', {
    expression: `
        (async () => {
            // Snapshot sessionStorage BEFORE submit
            const before = {
                hasSuccess: !!document.getElementById('success'),
                hasInlineConfirm: !!document.querySelector('.preview-confirm'),
                hasFormError: !!document.querySelector('.form-error'),
                hasOrderForm: !!document.getElementById('order-form'),
            };

            // Submit
            const form = document.getElementById('order-form');
            form.requestSubmit();
            // Give the runtime time to await the fetch + do document.write
            await new Promise(r => setTimeout(r, 1500));

            const after = {
                hasSuccess: !!document.getElementById('success'),
                successHidden: document.getElementById('success')?.hidden ?? null,
                successVisible: document.getElementById('success') && !document.getElementById('success').hidden,
                hasInlineConfirm: !!document.querySelector('.preview-confirm'),
                hasFormError: !!document.querySelector('.form-error'),
                hasOrderForm: !!document.getElementById('order-form'),
                title: document.title,
                sessionStorageOrder: sessionStorage.getItem('soctiv_last_order'),
            };

            return JSON.stringify({ before, after });
        })()
    `,
    awaitPromise: true,
    returnByValue: true,
});
const result = JSON.parse(submitResult.result.value);
push('  Before submit: ' + JSON.stringify(result.before));
push('  After submit:  ' + JSON.stringify(result.after, null, 2));

const swapHappened = result.after.hasSuccess && !result.after.hasOrderForm;
const inlineConfirmShown = result.after.hasInlineConfirm;
const formStillThere = result.after.hasOrderForm;

if (swapHappened) {
    push('  ✓ PASS: iframe swapped to thank-you page (success block exists, form gone)');
} else if (inlineConfirmShown) {
    push('  ✗ FAIL: showed INLINE confirmation card, NOT the full thank-you page');
    push('  ✗ This is the bug the user reported');
} else if (formStillThere) {
    push('  ✗ FAIL: form is still visible (submit may have failed)');
}

if (result.after.hasFormError) {
    push('  ✗ FAIL: form error banner is shown — the mock fetch must have failed');
}

push('\n=== TEST 6: Cust-name bound on thank-you page ===');
const custNameCheck = await send('Runtime.evaluate', {
    expression: `(() => {
        const el = document.getElementById('cust-name');
        if (!el) return 'NO cust-name element';
        return JSON.stringify({
            textContent: el.textContent,
            visible: el.offsetParent !== null,
        });
    })()`,
    returnByValue: true,
});
push('  ' + custNameCheck.result.value);

push('\n=== Console logs from page ===');
consoleLogs.forEach((l) => push('  ' + l));

// Take a screenshot for visual confirmation
const screenshot = await send('Page.captureScreenshot', { format: 'png' });
if (screenshot && screenshot.data) {
    writeFileSync(SCREENSHOT, Buffer.from(screenshot.data, 'base64'));
    push('\n  Screenshot saved: ' + SCREENSHOT);
}

writeFileSync(LOG, log.join('\n'), 'utf8');
ws.close();
edge.kill();
push('\n=== Done ===');