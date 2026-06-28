#!/usr/bin/env node
/**
 * test-editor-iframe-probe.mjs — use the EDITOR's actual iframe HTML
 * (renderSoctivIndexPreview output) inside an iframe srcDoc and click
 * the hero CTA. This is what PreviewPane.tsx renders in production.
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = 'dist/soctiv-preview';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// Load the editor's actual iframe HTML (inlined runtime, inlined styles)
const editorHtml = readFileSync('dist/soctiv-preview/editor-iframe.html', 'utf8');
if (!editorHtml.includes('(function () {')) {
    console.error('editor-iframe.html does not have inlined runtime — re-run build-editor-pipeline.mjs');
    process.exit(1);
}

// Inject a probe that wraps addEventListener to log every registration.
const probeScript = `<script>
window.__PROBE__ = [];
const origAdd = EventTarget.prototype.addEventListener;
EventTarget.prototype.addEventListener = function (type, listener, opts) {
    try {
        const el = this;
        let sel = '?';
        if (el && el.tagName) {
            sel = el.tagName.toLowerCase();
            if (el.id) sel += '#' + el.id;
            if (el.className && typeof el.className === 'string') {
                sel += '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.');
            }
        }
        window.__PROBE__.push({ kind: 'add', sel, type });
    } catch (e) {}
    return origAdd.call(this, type, listener, opts);
};
window.addEventListener('error', (e) => {
    window.__PROBE__.push({ kind: 'error', msg: e.message, file: e.filename, line: e.lineno });
});
const origErr = console.error;
console.error = (...args) => {
    window.__PROBE__.push({ kind: 'console.error', msg: args.map(a => String(a)).join(' ') });
    origErr.apply(console, args);
};
</script>`;
const instrumented = editorHtml.replace(
    '<script>window.__SOCTIV_PREVIEW__',
    probeScript + '<script>window.__SOCTIV_PREVIEW__'
);

const htmlB64 = Buffer.from(instrumented, 'utf8').toString('base64');
const hostHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Host</title></head>
<body style="margin:0;">
<iframe id="frm" sandbox="allow-scripts allow-forms allow-same-origin"
  style="border:0;width:100vw;height:100vh;display:block;"></iframe>
<script>document.getElementById('frm').srcdoc = atob('${htmlB64}');</script>
</body></html>`;
const HOST_PATH = join(process.cwd(), 'dist/soctiv-preview/host-editor.html');
writeFileSync(HOST_PATH, hostHtml, 'utf8');

const PORT = 9340;
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
            const page = tabs.find(t => t.type === 'page' && t.url.includes('host-editor.html'));
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
        if (ed.exception?.description) push('  ' + ed.exception.description.split('\n').slice(0, 12).join('\n  '));
    }
});

await send('Runtime.enable');
await new Promise(r => setTimeout(r, 2500));

const probeLog = await send('Runtime.evaluate', {
    expression: `document.getElementById('frm').contentWindow.__PROBE__ || 'no probe'`,
    returnByValue: true,
});
push('\n=== EDITOR iframe addEventListener log ===');
const events = probeLog.result?.value || [];
if (typeof events === 'string') {
    push('  ' + events);
} else {
    const hero = events.filter(e => e.kind === 'add' && e.sel && e.sel.includes('hero__cta'));
    const formEvents = events.filter(e => e.kind === 'add' && (
        e.sel?.includes('hero__cta') ||
        e.sel?.includes('qty-') ||
        e.sel?.includes('submit-btn') ||
        e.sel?.includes('order-form') ||
        e.sel?.includes('f-')
    ));
    push('Total events captured: ' + events.length);
    push('hero__cta listeners: ' + JSON.stringify(hero));
    push('\nForm-related listeners:');
    formEvents.forEach(e => push('  ' + JSON.stringify(e)));
    const errors = events.filter(e => e.kind !== 'add');
    if (errors.length) {
        push('\nErrors / rejections / console.error:');
        errors.forEach(e => push('  ' + JSON.stringify(e)));
    }
}

const clickResult = await send('Runtime.evaluate', {
    expression: `(() => {
        const f = document.getElementById('frm');
        const iwin = f.contentWindow;
        const idoc = f.contentDocument;
        const cta = idoc.querySelector('.hero__cta');
        const beforeY = iwin.scrollY;
        const evt = new iwin.MouseEvent('click', { bubbles: true, cancelable: true });
        cta.dispatchEvent(evt);
        return {
            defaultPrevented: evt.defaultPrevented,
            scrollY: iwin.scrollY,
            scrolled: iwin.scrollY !== beforeY,
            afterUrl: iwin.location.href,
            orderTopAfter: idoc.getElementById('order')?.getBoundingClientRect()?.top,
        };
    })()`,
    returnByValue: true,
});
push('\n=== Click CTA in EDITOR iframe ===');
push(JSON.stringify(clickResult.result?.value, null, 2));

// Test quantity stepper +/- buttons
const stepperResult = await send('Runtime.evaluate', {
    expression: `(() => {
        const f = document.getElementById('frm');
        const iwin = f.contentWindow;
        const idoc = f.contentDocument;
        const qtyPlus = idoc.getElementById('qty-plus');
        const qtyMinus = idoc.getElementById('qty-minus');
        const qtyValue = idoc.getElementById('qty-value');
        if (!qtyPlus) return { error: 'qty-plus not found' };
        qtyPlus.click();
        qtyPlus.click();
        const after = qtyValue.textContent;
        qtyMinus.click();
        const afterMinus = qtyValue.textContent;
        return {
            afterPlus2: after,
            afterMinus1: afterMinus,
            qtyMinusDisabled: qtyMinus.disabled,
            qtyPlusDisabled: qtyPlus.disabled,
        };
    })()`,
    returnByValue: true,
});
push('\n=== Quantity stepper in EDITOR iframe ===');
push(JSON.stringify(stepperResult.result?.value, null, 2));

// Test submit button
const submitResult = await send('Runtime.evaluate', {
    expression: `(() => {
        const f = document.getElementById('frm');
        const iwin = f.contentWindow;
        const idoc = f.contentDocument;
        const setVal = (id, v) => {
            const el = idoc.getElementById(id);
            el.value = v;
            el.dispatchEvent(new iwin.Event('input', { bubbles: true }));
        };
        setVal('f-name', 'أحمد محمد');
        setVal('f-phone', '0912345678');
        setVal('f-location', 'طرابلس - شارع الجمهورية');
        const form = idoc.getElementById('order-form');
        const submitBtn = idoc.getElementById('submit-btn');
        const beforeUrl = iwin.location.href;
        form.dispatchEvent(new iwin.Event('submit', { bubbles: true, cancelable: true }));
        return {
            beforeUrl,
            afterUrl: iwin.location.href,
            urlChanged: beforeUrl !== iwin.location.href,
            submitBtnText: submitBtn.textContent.trim(),
            submitBtnDisabled: submitBtn.disabled,
            previewConfirmShown: !!idoc.querySelector('.preview-confirm'),
        };
    })()`,
    returnByValue: true,
});
push('\n=== Submit button in EDITOR iframe ===');
push(JSON.stringify(submitResult.result?.value, null, 2));

ws.close();
edge.kill();
