#!/usr/bin/env node
/**
 * debug-cta-click.mjs — click the "Order Now" CTA in the rendered preview and
 * observe what happens to the scroll position. Tells us whether:
 *   - The click handler fires
 *   - The scroll happens (and whether it's animated or instant)
 *   - The form is visible after the scroll
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9463;
const PREVIEW_PATH = join(process.cwd(), 'dist/soctiv-preview/verify-tmp/dist/preview-inlined.html');

if (!existsSync(PREVIEW_PATH)) {
    console.error('Run verify-inlined-fonts.mjs first to generate preview-inlined.html');
    process.exit(1);
}

const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    // Headless Chromium disables smooth scrolling by default for perf
    // benchmarks. The user-visible bug only matters in a real browser,
    // but we want to confirm via the headless probe too, so enable it.
    '--enable-smooth-scrolling',
    '--enable-features=ScrollUnification,SmoothScrolling',
    '--window-size=1400,2400', `--remote-debugging-port=${PORT}`,
    `file:///${PREVIEW_PATH.replace(/\\/g, '/')}`,
], { stdio: ['ignore', 'ignore', 'ignore'] });

async function getPageWs() {
    for (let i = 0; i < 60; i++) {
        try {
            const r = await fetch(`http://127.0.0.1:${PORT}/json`);
            const tabs = await r.json();
            const page = tabs.find(t => t.type === 'page' && t.url.includes('preview-inlined.html'));
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
        exceptions.push({ url: ed.url, line: ed.lineNumber, text: ed.text, desc: ed.exception?.description?.split('\n').slice(0, 2).join('\n') });
    }
});

await send('Runtime.enable');
await send('Page.enable');
await new Promise(r => setTimeout(r, 500));

// Wait for fonts to load
try {
    await send('Runtime.evaluate', {
        expression: `document.fonts.ready.then(() => 'ready')`,
        awaitPromise: true,
        returnByValue: true,
    });
} catch {}
await new Promise(r => setTimeout(r, 500));

// Initial state
const initial = await send('Runtime.evaluate', {
    expression: `(() => {
        const cta = document.querySelector('.hero__cta');
        const order = document.getElementById('order');
        return {
            ctaExists: !!cta,
            ctaHref: cta?.getAttribute('href'),
            ctaText: cta?.textContent?.trim().slice(0, 50),
            orderExists: !!order,
            orderTop: order?.getBoundingClientRect().top,
            orderAbsoluteTop: order?.offsetTop,
            scrollY: window.scrollY,
            docHeight: document.documentElement.scrollHeight,
            htmlScrollBehavior: window.getComputedStyle(document.documentElement).scrollBehavior,
            previewFlag: window.__SOCTIV_PREVIEW__,
        };
    })()`,
    returnByValue: true,
});
console.log('=== Initial state ===');
console.log(JSON.stringify(initial.result?.value, null, 2));

// Click the CTA and immediately observe scroll over time
console.log('\\n=== Clicking CTA, sampling scroll position over 1.5s ===');
const clickAndSample = await send('Runtime.evaluate', {
    expression: `(async () => {
        const cta = document.querySelector('.hero__cta');
        if (!cta) return { error: 'no cta' };
        // Set up a polling observer
        const samples = [];
        const start = performance.now();
        const sampler = setInterval(() => {
            samples.push({
                t: Math.round(performance.now() - start),
                y: window.scrollY,
                orderTop: document.getElementById('order')?.getBoundingClientRect().top,
            });
        }, 50);
        // Click!
        cta.click();
        await new Promise(r => setTimeout(r, 1500));
        clearInterval(sampler);
        return {
            samples,
            finalScrollY: window.scrollY,
            finalOrderTop: document.getElementById('order')?.getBoundingClientRect().top,
            focusedElement: document.activeElement?.id || document.activeElement?.tagName,
        };
    })()`,
    awaitPromise: true,
    returnByValue: true,
});
console.log(JSON.stringify(clickAndSample.result?.value, null, 2));

console.log('\\n=== Console logs ===');
consoleLogs.forEach(l => console.log('  ' + l));
console.log('\\n=== Exceptions ===');
exceptions.forEach(e => console.log('  ' + JSON.stringify(e)));

ws.close();
edge.kill();
