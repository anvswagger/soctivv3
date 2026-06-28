#!/usr/bin/env node
/**
 * test-iframe-debug.mjs — diagnose why the .hero__cta click handler
 * doesn't fire in the editor's iframe preview.
 *
 * Checks:
 *   1. Does window.__SOCTIV_PREVIEW__ exist inside iframe?
 *   2. Does the .hero__cta element have any click listeners attached?
 *      (Chrome's getEventListeners only works in DevTools; we instead
 *      check by wrapping addEventListener on the prototype BEFORE the
 *      runtime attaches, then checking at runtime-load end how many
 *      clicks were captured. Here we just manually dispatch and see.)
 *   3. What is the iframe's URL after click?
 *   4. Is there a JS error inside the iframe?
 *   5. Does dispatching a 'click' event on the CTA trigger the handler?
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = 'dist/soctiv-preview';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
const LOG = join(OUT_DIR, 'iframe-debug.log');

const indexHtml = readFileSync('dist/soctiv-preview/preview-page/index.html', 'utf8');
const htmlB64 = Buffer.from(indexHtml, 'utf8').toString('base64');

const hostHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Host</title></head>
<body style="margin:0;">
<iframe id="frm" sandbox="allow-scripts allow-forms allow-same-origin"
  style="border:0;width:100vw;height:100vh;display:block;"></iframe>
<script>
  document.getElementById('frm').srcdoc = atob('${htmlB64}');
</script>
</body></html>`;

const HOST_PATH = join(process.cwd(), 'dist/soctiv-preview/host.html');
writeFileSync(HOST_PATH, hostHtml, 'utf8');

const PORT = 9338;
const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--window-size=1400,1100',
    `--remote-debugging-port=${PORT}`,
    `file:///${HOST_PATH.replace(/\\/g, '/')}`,
], { stdio: ['ignore', 'ignore', 'ignore'] });

const log = [];
const push = (s) => { log.push(s); process.stdout.write(s + '\n'); };

async function getPageWs() {
    for (let i = 0; i < 60; i++) {
        try {
            const r = await fetch(`http://127.0.0.1:${PORT}/json`);
            const tabs = await r.json();
            const page = tabs.find(t => t.type === 'page' && t.url.includes('host.html'));
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
        const ed = msg.params.exceptionDetails;
        push('EXCEPTION ' + (ed.url || '') + ':' + ed.lineNumber + ' ' + (ed.text || ''));
        if (ed.exception?.description) push('  ' + ed.exception.description.split('\n').slice(0, 8).join('\n  '));
    } else if (msg.method === 'Runtime.consoleAPICalled') {
        push('[' + msg.params.type + '] ' + msg.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    }
});

await send('Runtime.enable');
await send('Log.enable');
await send('Network.enable');
await new Promise(r => setTimeout(r, 2000));

// Detailed probe: check runtime state, errors, listener attachment
const probe = await send('Runtime.evaluate', {
    expression: `(() => {
        const f = document.getElementById('frm');
        const iwin = f.contentWindow;
        const idoc = f.contentDocument;
        const cta = idoc.querySelector('.hero__cta');
        const orderForm = idoc.getElementById('order-form');
        const qtyMinus = idoc.getElementById('qty-minus');
        const submitBtn = idoc.getElementById('submit-btn');

        // Wrap addEventListener after-the-fact isn't possible since the
        // runtime already attached. Instead, attempt a click and see what
        // happens. Also try invoking the runtime's click handler logic
        // directly by mimicking it.

        const beforeUrl = iwin.location.href;

        // Dispatch a real MouseEvent 'click'
        const clickEvt = new iwin.MouseEvent('click', { bubbles: true, cancelable: true, view: iwin });
        cta.dispatchEvent(clickEvt);

        return {
            previewFlag: iwin.__SOCTIV_PREVIEW__,
            configProductName: iwin.__SOCTIV_CONFIG__?.product?.nameArabic,
            ctaExists: !!cta,
            ctaHref: cta?.getAttribute('href'),
            ctaText: cta?.textContent.trim(),
            orderFormExists: !!orderForm,
            qtyMinusExists: !!qtyMinus,
            qtyMinusDisabled: qtyMinus?.disabled,
            submitBtnExists: !!submitBtn,
            submitBtnText: submitBtn?.textContent,
            beforeUrl,
            afterUrl: iwin.location.href,
            urlChanged: beforeUrl !== iwin.location.href,
            defaultPrevented: clickEvt.defaultPrevented,
            scrollY: iwin.scrollY,
            orderSectionTop: idoc.getElementById('order')?.getBoundingClientRect()?.top,
        };
    })()`,
    returnByValue: true,
});
push('\n=== Iframe detailed probe ===');
push(JSON.stringify(probe.result?.value, null, 2));

await new Promise(r => setTimeout(r, 800));

// Try clicking with an actual HTMLElement.click() vs MouseEvent dispatch
const probe2 = await send('Runtime.evaluate', {
    expression: `(() => {
        const f = document.getElementById('frm');
        const iwin = f.contentWindow;
        const idoc = f.contentDocument;
        const cta = idoc.querySelector('.hero__cta');

        const beforeUrl = iwin.location.href;
        const beforeScroll = iwin.scrollY;

        // Use HTMLElement.click() — this is what a real user click would do
        let result = 'no handler result';
        let error = null;
        try {
            // The runtime attaches its listener using addEventListener, so
            // .click() should trigger it.
            const ret = cta.click();
            result = String(ret);
        } catch (e) {
            error = e.message + '\\n' + (e.stack || '');
        }

        return {
            beforeUrl,
            afterUrl: iwin.location.href,
            urlChanged: beforeUrl !== iwin.location.href,
            beforeScroll,
            afterScroll: iwin.scrollY,
            scrolled: iwin.scrollY !== beforeScroll,
            orderSectionTop: idoc.getElementById('order')?.getBoundingClientRect()?.top,
            result,
            error,
        };
    })()`,
    returnByValue: true,
});
push('\n=== Iframe HTMLElement.click() probe ===');
push(JSON.stringify(probe2.result?.value, null, 2));

await new Promise(r => setTimeout(r, 500));

ws.close();
edge.kill();

writeFileSync(LOG, log.join('\n'), 'utf8');
