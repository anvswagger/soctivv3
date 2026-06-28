#!/usr/bin/env node
/**
 * test-cdp-flow.mjs — drive the rendered page with Chrome DevTools Protocol
 * via Node ws. Captures console messages, page errors, network failures,
 * then simulates clicks on the hero CTA, qty +/-, and submit.
 *
 * Usage: node scripts/test-cdp-flow.mjs
 */
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = 'dist/soctiv-preview';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
const LOG = join(OUT_DIR, 'cdp-flow.log');
const SCREENSHOT = join(OUT_DIR, 'cdp-after-click.png');

const PORT = 9333;
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

// Wait for the CDP endpoint
async function fetchTabs() {
    for (let i = 0; i < 60; i++) {
        try {
            const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
            if (r.ok) return r.json();
        } catch {}
        await new Promise(r => setTimeout(r, 200));
    }
    throw new Error('CDP did not start in 12s');
}

const v = await fetchTabs();
push('Edge ' + v.Browser);

// Find the page tab
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

const wsUrl = await getPageWs();
push('Page tab WS: ' + wsUrl);

const WebSocketCtor = (await import('ws').catch(() => null))?.WebSocket ?? globalThis.WebSocket;
let WS;
if (WebSocketCtor === globalThis.WebSocket) {
    // Node 22 has global WebSocket
    WS = globalThis.WebSocket;
} else {
    WS = WebSocketCtor;
}

const ws = new WS(wsUrl);
let nextId = 1;
const pending = new Map();
const consoleLogs = [];
const pageErrors = [];
const reqFailed = [];

await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
});

function send(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
    });
}

ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data.toString());
    if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
        const args = msg.params.args.map(a => a.value ?? a.description ?? '').join(' ');
        consoleLogs.push(`[${msg.params.type}] ${args}`);
    } else if (msg.method === 'Runtime.exceptionThrown') {
        pageErrors.push(msg.params.exceptionDetails.text + ': ' + (msg.params.exceptionDetails.exception?.description || ''));
    } else if (msg.method === 'Network.loadingFailed') {
        reqFailed.push(`${msg.params.errorText} (${msg.params.requestId})`);
    }
});

await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');
await send('Log.enable');

// Wait for page to settle
await new Promise(r => setTimeout(r, 1500));

push('\n=== Console logs from page ===');
consoleLogs.forEach(l => push('  ' + l));
push('\n=== Page errors ===');
pageErrors.forEach(e => push('  ' + e));
push('\n=== Network failures ===');
reqFailed.forEach(r => push('  ' + r));

// Probe: does the runtime have its handlers bound?
const probe1 = await send('Runtime.evaluate', {
    expression: `({
        hasOrderForm: !!document.getElementById('order-form'),
        submitBtn: !!document.getElementById('submit-btn'),
        qtyMinus: !!document.getElementById('qty-minus'),
        qtyPlus: !!document.getElementById('qty-plus'),
        hasConfig: typeof window.__SOCTIV_CONFIG__ !== 'undefined',
        runtimeLoaded: typeof window.SOCTIV_TRACK !== 'undefined' || !!document.getElementById('qty-value'),
        formAction: document.getElementById('order-form')?.action,
        formMethod: document.getElementById('order-form')?.method,
    })`,
    returnByValue: true,
});
push('\n=== Page probe ===');
push(JSON.stringify(probe1.result?.value, null, 2));

// Click the hero "Order Now" CTA and check what happens
const clickHero = await send('Runtime.evaluate', {
    expression: `(() => {
        const cta = document.querySelector('.hero__cta');
        const beforeY = window.scrollY;
        cta.click();
        return {
            ctaExists: !!cta,
            ctaHref: cta?.getAttribute('href'),
            afterY: window.scrollY,
            scrollMoved: window.scrollY !== beforeY,
            targetEl: document.getElementById('order') ? 'exists' : 'missing',
        };
    })()`,
    returnByValue: true,
});
push('\n=== Hero CTA click result ===');
push(JSON.stringify(clickHero.result?.value, null, 2));

// Click qty-plus once
const clickPlus = await send('Runtime.evaluate', {
    expression: `(() => {
        const btn = document.getElementById('qty-plus');
        const v = document.getElementById('qty-value');
        const before = v?.textContent;
        btn.click();
        const after = v?.textContent;
        return { before, after, btnDisabled: btn?.disabled, btnExists: !!btn };
    })()`,
    returnByValue: true,
});
push('\n=== qty-plus click result ===');
push(JSON.stringify(clickPlus.result?.value, null, 2));

// Try to submit an empty form — should fail validation, not navigate
const submitEmpty = await send('Runtime.evaluate', {
    expression: `(() => {
        const f = document.getElementById('order-form');
        const before = window.location.href;
        const submitBtn = document.getElementById('submit-btn');
        submitBtn.click();
        return {
            before,
            after: window.location.href,
            urlChanged: window.location.href !== before,
            submitBtnText: submitBtn.textContent.trim(),
            submitBtnDisabled: submitBtn.disabled,
        };
    })()`,
    returnByValue: true,
});
push('\n=== Submit empty form ===');
push(JSON.stringify(submitEmpty.result?.value, null, 2));

// Fill the form and submit
const fillAndSubmit = await send('Runtime.evaluate', {
    expression: `(() => {
        const f = (id, val) => {
            const el = document.getElementById(id);
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        };
        f('f-name', 'أحمد محمد');
        f('f-phone', '0912345678');
        f('f-location', 'طرابلس - شارع الجمهورية');
        const before = window.location.href;
        document.getElementById('submit-btn').click();
        return {
            before,
            after: window.location.href,
            urlChanged: window.location.href !== before,
            submitBtnText: document.getElementById('submit-btn').textContent.trim(),
            submitBtnDisabled: document.getElementById('submit-btn').disabled,
            hasOrderInSession: sessionStorage.getItem('soctiv_last_order') ? 'YES' : 'NO',
        };
    })()`,
    returnByValue: true,
});
push('\n=== Submit filled form ===');
push(JSON.stringify(fillAndSubmit.result?.value, null, 2));

await new Promise(r => setTimeout(r, 1500));

// Final URL
const finalUrl = await send('Runtime.evaluate', {
    expression: 'window.location.href',
    returnByValue: true,
});
push('\n=== Final URL after submit: ' + finalUrl.result?.value);

// Screenshot the post-click state
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(SCREENSHOT, Buffer.from(shot.data, 'base64'));
push('\nScreenshot: ' + SCREENSHOT);

ws.close();
edge.kill();

writeFileSync(LOG, log.join('\n'), 'utf8');
process.exit(0);
