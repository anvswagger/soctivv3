#!/usr/bin/env node
/**
 * verify-cta-scroll.mjs — final end-to-end verification:
 *   1. Load the rendered preview HTML
 *   2. Take a "before" screenshot (at scrollY=0)
 *   3. Click the CTA
 *   4. Wait for the smooth scroll to complete
 *   5. Take an "after" screenshot
 *   6. Verify the scroll was animated (not instant)
 */
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9464;
const PREVIEW_PATH = join(process.cwd(), 'dist/soctiv-preview/verify-tmp/dist/preview-inlined.html');
const OUT_DIR = 'dist/soctiv-preview';

if (!existsSync(PREVIEW_PATH)) {
    console.error('Run verify-inlined-fonts.mjs first to generate preview-inlined.html');
    process.exit(1);
}

const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--enable-smooth-scrolling', '--enable-features=ScrollUnification',
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
    }
});

await send('Runtime.enable');
await new Promise(r => setTimeout(r, 500));

try {
    await send('Runtime.evaluate', {
        expression: `document.fonts.ready.then(() => 'ready')`,
        awaitPromise: true, returnByValue: true,
    });
} catch {}
await new Promise(r => setTimeout(r, 500));

// Snapshot 1: before click
const before = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(OUT_DIR, 'cta-before.png'), Buffer.from(before.data, 'base64'));

const beforeState = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
        scrollY: window.scrollY,
        orderTop: document.getElementById('order')?.getBoundingClientRect().top,
        firstInput: document.getElementById('f-name')?.value,
        focused: document.activeElement?.id,
    })`,
    returnByValue: true,
});
console.log('BEFORE click:', beforeState.result?.value);

// Click and sample scroll every 50ms over 1.5s
const result = await send('Runtime.evaluate', {
    expression: `(async () => {
        const cta = document.querySelector('.hero__cta');
        const samples = [];
        const start = performance.now();
        const sampler = setInterval(() => {
            samples.push({ t: Math.round(performance.now() - start), y: window.scrollY });
        }, 50);
        cta.click();
        await new Promise(r => setTimeout(r, 1500));
        clearInterval(sampler);
        // Check if the scroll was animated (multiple distinct y values)
        const distinctY = [...new Set(samples.map(s => s.y))].length;
        const wasAnimated = distinctY >= 5;
        return JSON.stringify({
            samples,
            distinctYValues: distinctY,
            wasAnimated,
            finalY: window.scrollY,
            finalOrderTop: document.getElementById('order')?.getBoundingClientRect().top,
            focused: document.activeElement?.id,
        });
    })()`,
    awaitPromise: true, returnByValue: true,
});
const parsed = JSON.parse(result.result?.value);
console.log('\\nScroll samples (t in ms, y in px):');
parsed.samples.forEach(s => console.log(`  t=${String(s.t).padStart(4)}ms  y=${s.y}`));
console.log('\\nAnimation analysis:');
console.log('  distinct Y values seen:', parsed.distinctYValues);
console.log('  was animated (>=5 frames):', parsed.wasAnimated);
console.log('  final scrollY:', parsed.finalY);
console.log('  final order top:', parsed.finalOrderTop);
console.log('  focused element:', parsed.focused);

const after = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(OUT_DIR, 'cta-after.png'), Buffer.from(after.data, 'base64'));

ws.close();
edge.kill();

console.log('\\nScreenshots written:');
console.log('  -', join(OUT_DIR, 'cta-before.png'));
console.log('  -', join(OUT_DIR, 'cta-after.png'));
