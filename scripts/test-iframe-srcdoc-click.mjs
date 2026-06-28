#!/usr/bin/env node
/**
 * test-iframe-srcdoc-click.mjs
 *
 * Reproduces the editor's actual iframe setup: host page with a srcDoc
 * iframe pointing at the rendered preview HTML. Clicks the hero CTA
 * inside the iframe and inspects:
 *   - Whether default navigation was prevented
 *   - Whether the iframe scroll position changed
 *   - Whether the order section is visible after the click
 *   - Any console errors inside the iframe
 *
 * This is the closest headless approximation of what the user sees in
 * the editor's preview pane.
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = 'dist/soctiv-preview';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
const LOG = join(OUT_DIR, 'iframe-srcdoc-click.log');

const indexHtml = readFileSync('dist/soctiv-preview/preview-page/index.html', 'utf8');
const htmlB64 = Buffer.from(indexHtml, 'utf8').toString('base64');

// Host HTML — embeds the preview HTML inside a same-origin iframe using
// srcdoc, with allow-scripts + allow-forms + allow-same-origin sandbox.
// The host page must be served from a real origin (file:// works) so the
// iframe can have a stable parent for cross-frame inspection.
const hostHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Host</title>
  <style>html,body{margin:0;padding:0;}#wrap{height:100vh;width:100vw;display:flex;}</style>
</head>
<body>
<div id="wrap">
  <iframe id="frm" sandbox="allow-scripts allow-forms allow-same-origin" style="border:0;width:100%;height:100%;display:block;"></iframe>
</div>
<script>
  const html = atob('${htmlB64}');
  const frm = document.getElementById('frm');
  frm.srcdoc = html;
</script>
</body>
</html>`;

const HOST_PATH = join(process.cwd(), 'dist/soctiv-preview/host.html');
writeFileSync(HOST_PATH, hostHtml, 'utf8');

const PORT = 9337;
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
await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
await new Promise(r => setTimeout(r, 2000));

// Find the iframe's targetId via Runtime.getProperties of the iframe element
const findIframe = await send('Runtime.evaluate', {
    expression: `(() => {
        const f = document.getElementById('frm');
        return { src: f.src.slice(0, 60), hasContent: !!f.contentDocument };
    })()`,
    returnByValue: true,
});
push('\n=== Host iframe probe ===');
push(JSON.stringify(findIframe.result?.value, null, 2));

// Use Page.navigate in the iframe via Runtime.evaluate is hard.
// Easier: evaluate inside the iframe via contentDocument
const initialProbe = await send('Runtime.evaluate', {
    expression: `(() => {
        const f = document.getElementById('frm');
        const idoc = f.contentDocument;
        if (!idoc) return { error: 'no contentDocument' };
        const iwin = f.contentWindow;
        const beforeScrollY = iwin.scrollY;
        const cta = idoc.querySelector('.hero__cta');
        return {
            previewFlag: iwin.__SOCTIV_PREVIEW__,
            configExists: typeof iwin.__SOCTIV_CONFIG__ !== 'undefined',
            productName: iwin.__SOCTIV_CONFIG__?.product?.nameArabic,
            ctaExists: !!cta,
            ctaHref: cta?.getAttribute('href'),
            formExists: !!idoc.getElementById('order-form'),
            qtyValue: idoc.getElementById('qty-value')?.textContent,
            beforeScrollY,
            docHeight: idoc.documentElement.scrollHeight,
            winHeight: iwin.innerHeight,
        };
    })()`,
    returnByValue: true,
});
push('\n=== Iframe initial probe ===');
push(JSON.stringify(initialProbe.result?.value, null, 2));

// Capture console logs from inside iframe by attaching to its window
const attachConsole = await send('Runtime.evaluate', {
    expression: `(() => {
        const f = document.getElementById('frm');
        const iwin = f.contentWindow;
        iwin.__IFRAME_LOGS__ = [];
        const orig = iwin.console.log;
        iwin.console.log = (...a) => { iwin.__IFRAME_LOGS__.push(a.map(x => String(x)).join(' ')); orig.apply(iwin.console, a); };
        iwin.addEventListener('error', (e) => iwin.__IFRAME_LOGS__.push('ERR: ' + (e.error?.stack || e.message)));
        iwin.addEventListener('unhandledrejection', (e) => iwin.__IFRAME_LOGS__.push('REJ: ' + (e.reason?.stack || e.reason)));
        return 'attached';
    })()`,
    returnByValue: true,
});
push('\nConsole attach: ' + JSON.stringify(attachConsole.result?.value));

// Click the CTA inside iframe
const click = await send('Runtime.evaluate', {
    expression: `(() => {
        const f = document.getElementById('frm');
        const idoc = f.contentDocument;
        const iwin = f.contentWindow;
        const cta = idoc.querySelector('.hero__cta');
        if (!cta) return { error: 'CTA not found in iframe' };
        const evt = new iwin.MouseEvent('click', { bubbles: true, cancelable: true });
        cta.dispatchEvent(evt);
        return {
            ctaText: cta.textContent.trim().slice(0, 60),
            ctaHref: cta.getAttribute('href'),
            defaultPrevented: evt.defaultPrevented,
            scrollY: iwin.scrollY,
            iframeDocHeight: idoc.documentElement.scrollHeight,
            orderExists: !!idoc.getElementById('order'),
            orderRectTop: idoc.getElementById('order')?.getBoundingClientRect()?.top,
        };
    })()`,
    returnByValue: true,
});
push('\n=== Iframe hero CTA click ===');
push(JSON.stringify(click.result?.value, null, 2));

await new Promise(r => setTimeout(r, 800));

// Inspect iframe logs
const iframeLogs = await send('Runtime.evaluate', {
    expression: `document.getElementById('frm').contentWindow.__IFRAME_LOGS__ || []`,
    returnByValue: true,
});
push('\n=== Iframe console logs ===');
iframeLogs.result?.value?.forEach(l => push('  ' + l));

push('\n=== Host console messages ===');
consoleLogs.forEach(l => push('  ' + l));

ws.close();
edge.kill();

writeFileSync(LOG, log.join('\n'), 'utf8');
