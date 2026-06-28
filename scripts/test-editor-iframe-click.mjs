#!/usr/bin/env node
/**
 * test-editor-iframe-click.mjs v2 — clearer repro of the editor's iframe
 * preview interaction. Captures iframe console + exceptions.
 */
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = 'dist/soctiv-preview';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
const LOG = join(OUT_DIR, 'editor-iframe-click.log');

const PORT = 9336;
const html = readFileSync('dist/soctiv-preview/preview-page/index.html', 'utf8');
const runtimeJs = readFileSync('dist/soctiv-preview/preview-page/runtime.js', 'utf8');

if (!html.includes('window.__SOCTIV_PREVIEW__')) {
    console.error('PREVIEW FLAG MISSING — re-run node scripts/render-soctiv-preview.mjs');
    process.exit(1);
}
if (!runtimeJs.includes('showPreviewConfirmation')) {
    console.error('PREVIEW CONFIRMATION FUNCTION MISSING — runtime.js is stale');
    process.exit(1);
}

// Just open the preview-page/index.html directly (no host wrapper) so we can
// see the iframe's actual behavior in isolation. The browser will treat it
// as a top-level page rather than an iframe — that's fine for this test
// because we want to see what would happen if the user navigated directly
// to this file (which is what the iframe sandbox approximates).
const HOST_PATH = join(process.cwd(), 'dist/soctiv-preview/preview-page/index.html');
const log = [];
const push = (s) => { log.push(s); process.stdout.write(s + '\n'); };

const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--window-size=1400,2400',
    `--remote-debugging-port=${PORT}`,
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
    throw new Error('Page tab not found');
}

const wsUrl = await getPageWs();
const ws = new WebSocket(wsUrl);
let nextId = 1;
const pending = new Map();
const consoleLogs = [];

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
    } else if (msg.method === 'Runtime.consoleAPICalled') {
        consoleLogs.push(`[${msg.params.type}] ` + msg.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    } else if (msg.method === 'Runtime.exceptionThrown') {
        const ed = msg.params.exceptionDetails;
        push('EXCEPTION ' + ed.url + ':' + ed.lineNumber + ' ' + ed.text);
        if (ed.exception?.description) push('  ' + ed.exception.description.split('\n').slice(0, 4).join('\n  '));
    }
});

await send('Runtime.enable');
await new Promise(r => setTimeout(r, 1500));

// Probe basic state
const probe = await send('Runtime.evaluate', {
    expression: `({
        previewFlag: window.__SOCTIV_PREVIEW__,
        configExists: typeof window.__SOCTIV_CONFIG__ !== 'undefined',
        productName: window.__SOCTIV_CONFIG__?.product?.nameArabic,
        runtimeVersion: (window.__SOCTIV_CONFIG__?.product?.nameArabic ? 'runtime loaded' : 'runtime not loaded'),
        ctaExists: !!document.querySelector('.hero__cta'),
        formExists: !!document.getElementById('order-form'),
        qtyValue: document.getElementById('qty-value')?.textContent,
    })`,
    returnByValue: true,
});
push('\n=== Initial probe (page loaded directly) ===');
push(JSON.stringify(probe.result?.value, null, 2));
push('\n=== Console messages ===');
consoleLogs.forEach(l => push('  ' + l));

// Click hero CTA inside this top-level page
const click = await send('Runtime.evaluate', {
    expression: `(() => {
        const cta = document.querySelector('.hero__cta');
        if (!cta) return { error: 'CTA not found' };
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
        cta.dispatchEvent(evt);
        return {
            ctaText: cta.textContent.trim().slice(0, 60),
            ctaHref: cta.getAttribute('href'),
            defaultPrevented: evt.defaultPrevented,
            scrollY: window.scrollY,
            orderSectionExists: !!document.getElementById('order'),
            orderSectionTop: document.getElementById('order')?.getBoundingClientRect()?.top,
        };
    })()`,
    returnByValue: true,
});
push('\n=== Hero CTA click (real MouseEvent) ===');
push(JSON.stringify(click.result?.value, null, 2));

await new Promise(r => setTimeout(r, 500));

// Fill form and submit
const submit = await send('Runtime.evaluate', {
    expression: `(() => {
        const setVal = (id, v) => {
            const el = document.getElementById(id);
            el.value = v;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        };
        setVal('f-name', 'أحمد محمد');
        setVal('f-phone', '0912345678');
        setVal('f-location', 'طرابلس - شارع الجمهورية');
        const beforeUrl = window.location.href;
        const submitBtn = document.getElementById('submit-btn');
        submitBtn.click();
        return {
            beforeUrl,
            afterUrl: window.location.href,
            urlChanged: window.location.href !== beforeUrl,
            submitBtnText: submitBtn.textContent.trim(),
            submitBtnDisabled: submitBtn.disabled,
            previewConfirmShown: !!document.querySelector('.preview-confirm'),
            sessionStored: sessionStorage.getItem('soctiv_last_order') ? 'YES' : 'NO',
        };
    })()`,
    returnByValue: true,
});
push('\n=== Form submit (with preview flag) ===');
push(JSON.stringify(submit.result?.value, null, 2));

ws.close();
edge.kill();

writeFileSync(LOG, log.join('\n'), 'utf8');
