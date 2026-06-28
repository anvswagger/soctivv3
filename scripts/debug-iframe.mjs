#!/usr/bin/env node
/**
 * debug-iframe.mjs — debug what's actually rendering in the editor preview iframe.
 * Loads the dev server, navigates to a sample landing page editor, and inspects
 * the iframe contents to see what's actually loaded (font, CSS, runtime).
 */
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = 'dist/soctiv-preview';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
const LOG = join(OUT_DIR, 'debug-iframe.log');

const PORT = 9450;

const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--window-size=1400,2400',
    `--remote-debugging-port=${PORT}`,
    'http://localhost:8092/',
], { stdio: ['ignore', 'ignore', 'ignore'] });

async function getPageWs() {
    for (let i = 0; i < 60; i++) {
        try {
            const r = await fetch(`http://127.0.0.1:${PORT}/json`);
            const tabs = await r.json();
            const page = tabs.find(t => t.type === 'page');
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
const exceptions = [];

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
        exceptions.push({ url: ed.url, line: ed.lineNumber, text: ed.text, desc: ed.exception?.description?.split('\n').slice(0, 4).join('\n') });
    }
});

await send('Runtime.enable');
await send('Page.enable');
await new Promise(r => setTimeout(r, 2000));

// Take a screenshot of the current state
const screenshot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(OUT_DIR, 'debug-initial.png'), Buffer.from(screenshot.data, 'base64'));

console.log('\n=== Console logs ===');
consoleLogs.forEach(l => console.log('  ' + l));
console.log('\n=== Exceptions ===');
exceptions.forEach(e => console.log('  ' + JSON.stringify(e)));

// Get all iframes on the page
const iframesProbe = await send('Runtime.evaluate', {
    expression: `(() => {
        const iframes = document.querySelectorAll('iframe');
        return Array.from(iframes).map((f, i) => ({
            index: i,
            src: f.src,
            srcDocPreview: f.srcdoc ? f.srcdoc.substring(0, 200) : null,
            sandbox: f.sandbox?.toString() || f.getAttribute('sandbox'),
            title: f.title,
            offsetHeight: f.offsetHeight,
            offsetWidth: f.offsetWidth,
        }));
    })()`,
    returnByValue: true,
});
console.log('\n=== Iframes on page ===');
console.log(JSON.stringify(iframesProbe.result?.value, null, 2));

// Look for the preview iframe specifically
const previewIframe = await send('Runtime.evaluate', {
    expression: `(() => {
        const iframes = document.querySelectorAll('iframe');
        const preview = Array.from(iframes).find(f => f.srcdoc && f.srcdoc.includes('hero__cta'));
        if (!preview) return { found: false };
        return {
            found: true,
            srcDocLength: preview.srcdoc.length,
            srcDocStart: preview.srcdoc.substring(0, 500),
            sandbox: preview.getAttribute('sandbox'),
        };
    })()`,
    returnByValue: true,
});
console.log('\n=== Preview iframe ===');
console.log(JSON.stringify(previewIframe.result?.value, null, 2));

ws.close();
edge.kill();

writeFileSync(LOG, [
    '=== Console ===',
    ...consoleLogs,
    '=== Exceptions ===',
    ...exceptions.map(e => JSON.stringify(e)),
    '=== Iframes ===',
    JSON.stringify(iframesProbe.result?.value, null, 2),
    '=== Preview ===',
    JSON.stringify(previewIframe.result?.value, null, 2),
].join('\n'), 'utf8');
console.log(`\nLog: ${LOG}`);