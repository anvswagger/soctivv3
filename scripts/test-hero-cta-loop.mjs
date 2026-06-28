#!/usr/bin/env node
/**
 * test-hero-cta-loop.mjs — repro the user's complaint:
 *   "Click 'اطلب الآن' in the preview iframe → it opens a loop
 *    of the other node, doesn't scroll down to the form."
 *
 * We replicate the editor's iframe sandbox exactly
 * (sandbox="allow-scripts allow-forms allow-same-origin", srcDoc)
 * and click the hero CTA inside the iframe, then observe:
 *   - Did the iframe navigate? (URL change on the iframe element)
 *   - Did scrollIntoView fire? (iframe content scrollTop)
 *   - Did the iframe go BLOCKED? (contentDocument accessibility)
 *   - Any uncaught exceptions?
 */
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = 'dist/soctiv-preview';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const PORT = 9339;
// Build a host page that mirrors the editor's exact iframe configuration:
//   sandbox="allow-scripts allow-forms allow-same-origin"  srcDoc=<html>
const previewHtml = readFileSync('dist/soctiv-preview/preview-page/index.html', 'utf8')
    // Defense: escape any closing script tags inside the srcdoc payload so
    // they don't terminate the host page's outer <script> block.
    .replace(/<\/script>/gi, '<\\/script>');

if (!previewHtml.includes('window.__SOCTIV_PREVIEW__')) {
    console.error('PREVIEW FLAG MISSING — re-run node scripts/render-soctiv-preview.mjs');
    process.exit(1);
}

const hostHtml = `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><title>host</title>
<style>html,body{margin:0;height:100%;background:#111;color:#fff;font-family:system-ui;}
.row{display:flex;gap:8px;padding:8px;}
.col{flex:1;height:600px;border:1px solid #444;overflow:auto;background:#fff;color:#000;}
iframe{width:100%;height:100%;border:0;display:block;}
#log{position:fixed;bottom:0;left:0;right:0;background:#000;color:#0f0;font:11px/1.4 monospace;
     max-height:200px;overflow:auto;padding:4px;white-space:pre;}
</style></head>
<body>
<div class="row">
  <div class="col"><div id="wrap"></div></div>
</div>
<div id="log"></div>
<script>
const log = document.getElementById('log');
const push = (s) => { log.textContent += s + '\\n'; };
const iframe = document.createElement('iframe');
iframe.sandbox = 'allow-scripts allow-forms allow-same-origin';
iframe.srcdoc = ${JSON.stringify(previewHtml)};
iframe.addEventListener('load', () => push('[host] iframe load — url=' + (iframe.contentWindow?.location?.href || 'unknown')));
window.addEventListener('error', (e) => push('[host:error] ' + e.message));
window.__probe = () => ({
    iframeUrl: iframe.contentWindow ? iframe.contentWindow.location.href : '(no contentWindow)',
    iframeDoc: iframe.contentDocument ? 'accessible' : 'BLOCKED',
    bodyChildren: iframe.contentDocument ? iframe.contentDocument.body.children.length : 'n/a',
    previewFlag: iframe.contentWindow ? iframe.contentWindow.__SOCTIV_PREVIEW__ : 'no window',
    ctaExists: iframe.contentDocument ? !!iframe.contentDocument.querySelector('.hero__cta') : 'n/a',
    orderExists: iframe.contentDocument ? !!iframe.contentDocument.getElementById('order') : 'n/a',
    scrollY: iframe.contentWindow ? iframe.contentWindow.scrollY : 'n/a',
});
document.getElementById('wrap').appendChild(iframe);
push('[host] iframe inserted, previewHtml length=' + ${previewHtml.length});
</script>
</body></html>`;

const HOST_PATH = join(OUT_DIR, 'host.html');
writeFileSync(HOST_PATH, hostHtml, 'utf8');

const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--window-size=1400,900', `--remote-debugging-port=${PORT}`,
    `file:///${HOST_PATH.replace(/\\/g, '/')}`,
], { stdio: ['ignore', 'ignore', 'ignore'] });

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
    throw new Error('no tab');
}

const wsUrl = await getPageWs();
const ws = new WebSocket(wsUrl);
let nextId = 1;
const pending = new Map();
const exceptions = [];
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
    } else if (msg.method === 'Runtime.exceptionThrown') {
        exceptions.push(msg.params.exceptionDetails.text + ' @' + msg.params.exceptionDetails.url + ':' + msg.params.exceptionDetails.lineNumber);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
        const args = msg.params.args.map(a => a.value ?? a.description ?? '').join(' ');
        consoleLogs.push(`[${msg.params.type}] ${args}`);
    }
});

await send('Runtime.enable');
// Capture host console output before any evaluate runs
await send('Runtime.evaluate', {
    expression: `console.log('[host] ready, body has ' + document.body.children.length + ' children, iframe count: ' + document.querySelectorAll('iframe').length)`,
    returnByValue: true,
});
await new Promise(r => setTimeout(r, 200));
// Wait for the iframe's load event to fire (srcDoc parses async)
await send('Runtime.evaluate', {
    expression: `new Promise((resolve) => {
        const f = document.querySelector('iframe');
        if (!f) return resolve('no iframe in dom');
        if (f.contentDocument && f.contentDocument.readyState === 'complete') return resolve('already-loaded');
        const to = setTimeout(() => resolve('timeout'), 8000);
        f.addEventListener('load', () => { clearTimeout(to); resolve('load-event'); });
    })`,
    awaitPromise: true,
    returnByValue: true,
}).then(r => console.log('[load probe]', r.result?.value));
await new Promise(r => setTimeout(r, 1500));

// ─── Probe before click
console.log('=== Probe before click ===');
const before = await send('Runtime.evaluate', {
    expression: `(() => {
        const f = document.querySelector('iframe');
        return {
            iframeReady: !!f.contentDocument,
            previewFlag: f.contentWindow ? f.contentWindow.__SOCTIV_PREVIEW__ : 'no win',
            ctaExists: f.contentDocument ? !!f.contentDocument.querySelector('.hero__cta') : 'no doc',
            orderExists: f.contentDocument ? !!f.contentDocument.getElementById('order') : 'no doc',
            scrollY: f.contentWindow ? f.contentWindow.scrollY : 'no win',
            docHeight: f.contentDocument ? f.contentDocument.documentElement.scrollHeight : 'no doc',
            iframeUrl: f.contentWindow ? f.contentWindow.location.href : 'no win',
        };
    })()`,
    returnByValue: true,
});
console.log('result:', JSON.stringify(before.result, null, 2));

// ─── Click the hero CTA via dispatching a real click on the iframe contentDocument
console.log('\n=== Clicking .hero__cta inside iframe ===');
const clickResult = await send('Runtime.evaluate', {
    expression: `(() => {
        const f = document.querySelector('iframe');
        const cta = f.contentDocument.querySelector('.hero__cta');
        if (!cta) return { error: 'CTA missing' };
        const before = { url: f.contentWindow.location.href, scrollY: f.contentWindow.scrollY };
        cta.click();
        return {
            ctaText: cta.textContent.trim(),
            ctaHref: cta.getAttribute('href'),
            docStillAccessible: !!f.contentDocument.body,
            before,
            immediatelyAfter: { url: f.contentWindow.location.href, scrollY: f.contentWindow.scrollY },
        };
    })()`,
    returnByValue: true,
});
console.log(JSON.stringify(clickResult.result?.value, null, 2));

await new Promise(r => setTimeout(r, 1500));

// ─── Probe after click + wait
console.log('\n=== Probe after click + wait ===');
const after = await send('Runtime.evaluate', {
    expression: `(() => {
        const f = document.querySelector('iframe');
        return {
            docStillAccessible: !!f.contentDocument.body,
            url: f.contentWindow.location.href,
            scrollY: f.contentWindow.scrollY,
            previewFlag: f.contentWindow.__SOCTIV_PREVIEW__,
            ctaExists: !!f.contentDocument.querySelector('.hero__cta'),
            orderExists: !!f.contentDocument.getElementById('order'),
        };
    })()`,
    returnByValue: true,
});
console.log(JSON.stringify(after.result?.value, null, 2));

console.log('\n=== Exceptions ===');
exceptions.forEach(e => console.log('  ' + e));
console.log('\n=== Console (host page) ===');
consoleLogs.forEach(l => console.log('  ' + l));

ws.close();
edge.kill();
