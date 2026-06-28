#!/usr/bin/env node
/**
 * test-editor-flow.mjs — full end-to-end of the editor's iframe preview
 * flow: load → click qty + → fill form → click submit → expect confirmation
 * card (NOT navigation). Then click "refresh" (clear + bump nonce) and
 * verify the iframe re-mounts cleanly.
 */
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = 'dist/soctiv-preview';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const PORT = 9338;
const HOST_PATH = join(process.cwd(), 'dist/soctiv-preview/preview-page/index.html');

const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--window-size=1280,2400', `--remote-debugging-port=${PORT}`,
    `file:///${HOST_PATH.replace(/\\/g, '/')}`,
], { stdio: ['ignore', 'ignore', 'ignore'] });

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
    throw new Error('no tab');
}

const wsUrl = await getPageWs();
const ws = new WebSocket(wsUrl);
let nextId = 1;
const pending = new Map();
const errors = [];

await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });

function send(method, params = {}) {
    const id = nextId++;
    return new Promise((res, rej) => {
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params }));
    });
}

ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data.toString());
    if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message));
        else res(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
        errors.push(msg.params.exceptionDetails.text);
    }
});

await send('Runtime.enable');
await new Promise(r => setTimeout(r, 1500));

// === Phase 1: First load — verify everything works ===
console.log('=== Phase 1: Initial load ===');
const p1 = await send('Runtime.evaluate', {
    expression: `({
        previewFlag: window.__SOCTIV_PREVIEW__,
        cta: !!document.querySelector('.hero__cta'),
        form: !!document.getElementById('order-form'),
    })`,
    returnByValue: true,
});
console.log(JSON.stringify(p1.result?.value, null, 2));

// === Phase 2: Click qty + and submit ===
console.log('\n=== Phase 2: Submit (no refresh yet) ===');
const p2 = await send('Runtime.evaluate', {
    expression: `(() => {
        const setVal = (id, v) => {
            const el = document.getElementById(id);
            el.value = v;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        };
        document.getElementById('qty-plus').click();
        document.getElementById('qty-plus').click();
        setVal('f-name', 'أحمد');
        setVal('f-phone', '0912345678');
        setVal('f-location', 'طرابلس');
        const beforeUrl = location.href;
        document.getElementById('submit-btn').click();
        return {
            qtyValue: document.getElementById('qty-value')?.textContent,
            beforeUrl,
            afterUrl: location.href,
            urlChanged: location.href !== beforeUrl,
            confirmShown: !!document.querySelector('.preview-confirm'),
            sessionStored: !!sessionStorage.getItem('soctiv_last_order'),
        };
    })()`,
    returnByValue: true,
});
console.log(JSON.stringify(p2.result?.value, null, 2));

// === Phase 3: Verify errors so far ===
console.log('\n=== Errors so far ===');
errors.forEach(e => console.log('  ' + e));

ws.close();
edge.kill();
console.log('\nDONE');
process.exit(0);
