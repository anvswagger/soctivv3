#!/usr/bin/env node
/**
 * test-webhook-error-ux.mjs — verify that when the webhook POST fails,
 * the user sees the ACTUAL server response (status + body) in both the
 * iframe's inline error banner and the parent's toast — not just a
 * generic "فشل في إنشاء الطلب" message.
 *
 * Mocks the webhook to return:
 *   - 400 Bad Request with JSON body {error: "Client not found", details: ...}
 *
 * Then asserts:
 *   1. The iframe banner is visible
 *   2. The banner contains the status code (400)
 *   3. The banner contains the body text ("Client not found")
 *   4. The parent received a soctiv:lead-failed postMessage with status+body
 */
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = 'dist/soctiv-preview';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
const LOG = join(OUT_DIR, 'webhook-error-ux.log');
const SCREENSHOT = join(OUT_DIR, 'webhook-error-ux.png');

const PORT = 9337;
const URL = 'file:///' + join(process.cwd(), 'dist/soctiv-preview', 'preview-page', 'index.html').replace(/\\/g, '/');

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
            const page = tabs.find(t => t.type === 'page' && t.url.includes('preview-page'));
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
        consoleLogs.push(`[exception] ${msg.params.exceptionDetails.text}`);
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

// Wait for page load
await new Promise(r => setTimeout(r, 1500));

push('\n=== Intercept webhook fetch to return 400 with realistic body ===');
await send('Runtime.evaluate', {
    expression: `
        window.__originalFetch = window.fetch;
        window.__fetchCalls = [];
        window.fetch = function(url, opts) {
            if (typeof url === 'string' && url.includes('facebook-leads-webhook')) {
                window.__fetchCalls.push({ url, body: opts?.body });
                return Promise.resolve(new Response(JSON.stringify({
                    error: 'Client not found',
                    details: 'No client with webhook_code=WT-LIB in clients table'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }));
            }
            return window.__originalFetch(url, opts);
        };
    `,
});

// Listen for postMessage from iframe to window
await send('Runtime.evaluate', {
    expression: `
        window.__parentMessages = [];
        window.addEventListener('message', (e) => {
            window.__parentMessages.push(e.data);
        });
    `,
});

// Fill form
await send('Runtime.evaluate', {
    expression: `
        document.getElementById('f-name').value = 'أحمد محمد';
        document.getElementById('f-phone').value = '0912345678';
        document.getElementById('f-location').value = 'طرابلس';
    `,
});

push('\n=== Submit form ===');
const submitResult = await send('Runtime.evaluate', {
    expression: `
        (async () => {
            document.getElementById('order-form').requestSubmit();
            await new Promise(r => setTimeout(r, 1200));

            const banner = document.querySelector('.form-error');
            const bannerText = banner ? banner.textContent : null;
            const bannerInnerHTML = banner ? banner.innerHTML : null;

            return JSON.stringify({
                fetchCalled: window.__fetchCalls.length === 1,
                requestBody: window.__fetchCalls[0]?.body,
                hasBanner: !!banner,
                bannerText: bannerText?.slice(0, 400),
                bannerHasStatus: bannerText?.includes('400') || false,
                bannerHasBody: bannerText?.includes('Client not found') || false,
                parentMessages: window.__parentMessages,
            });
        })()
    `,
    awaitPromise: true,
    returnByValue: true,
});
const result = JSON.parse(submitResult.result.value);

push('\n=== RESULTS ===');
push('fetchCalled: ' + result.fetchCalled);
push('requestBody (truncated): ' + (result.requestBody?.slice(0, 200) || 'none'));
push('hasBanner: ' + result.hasBanner);
push('bannerText: ' + JSON.stringify(result.bannerText));
push('bannerHasStatus (400): ' + result.bannerHasStatus);
push('bannerHasBody ("Client not found"): ' + result.bannerHasBody);

push('\nparentMessages:');
result.parentMessages.forEach((m) => push('  ' + JSON.stringify(m)));

let pass = true;
if (!result.fetchCalled) {
    push('\n  ✗ FAIL: fetch was not called');
    pass = false;
}
if (!result.hasBanner) {
    push('\n  ✗ FAIL: error banner was not shown');
    pass = false;
}
if (!result.bannerHasStatus) {
    push('\n  ✗ FAIL: banner does NOT contain status code 400');
    pass = false;
}
if (!result.bannerHasBody) {
    push('\n  ✗ FAIL: banner does NOT contain webhook response body "Client not found"');
    pass = false;
}

// Check the postMessage to parent includes body
const failedMsg = result.parentMessages.find(m => m?.type === 'soctiv:lead-failed');
if (!failedMsg) {
    push('\n  ✗ FAIL: no soctiv:lead-failed postMessage to parent');
    pass = false;
} else {
    if (failedMsg.status === 400 && failedMsg.body?.includes('Client not found')) {
        push('\n  ✓ PASS: postMessage to parent includes status + body');
    } else {
        push('\n  ✗ FAIL: postMessage missing status/body: ' + JSON.stringify(failedMsg));
        pass = false;
    }
}

if (pass) {
    push('\n=== ALL CHECKS PASSED ===');
} else {
    push('\n=== SOME CHECKS FAILED ===');
}

// Take screenshot of the error state
const screenshot = await send('Page.captureScreenshot', { format: 'png' });
if (screenshot && screenshot.data) {
    writeFileSync(SCREENSHOT, Buffer.from(screenshot.data, 'base64'));
    push('Screenshot: ' + SCREENSHOT);
}

push('\n=== Console logs ===');
consoleLogs.forEach((l) => push('  ' + l));

writeFileSync(LOG, log.join('\n'), 'utf8');
ws.close();
edge.kill();
process.exit(pass ? 0 : 1);