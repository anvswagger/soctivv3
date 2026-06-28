#!/usr/bin/env node
/**
 * test-hero-cta-direct.mjs — repro the user's complaint at the top-level
 * (not inside an iframe). We open the preview-page directly, which is
 * what the iframe's srcDoc would render — same DOM, same runtime. If the
 * click → scroll-into-view works here, the iframe behavior is downstream.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = 'dist/soctiv-preview';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const PORT = 9340;
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
await new Promise(r => setTimeout(r, 1500));

// ─── Probe state
console.log('=== Before click ===');
const before = await send('Runtime.evaluate', {
    expression: `(() => ({
        previewFlag: window.__SOCTIV_PREVIEW__,
        ctaExists: !!document.querySelector('.hero__cta'),
        ctaText: document.querySelector('.hero__cta')?.textContent?.trim(),
        ctaHref: document.querySelector('.hero__cta')?.getAttribute('href'),
        orderExists: !!document.getElementById('order'),
        orderTopBeforeScroll: document.getElementById('order')?.getBoundingClientRect()?.top,
        scrollY: window.scrollY,
        docHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
    }))()`,
    returnByValue: true,
});
console.log(JSON.stringify(before.result?.value, null, 2));

// ─── Click the hero CTA
console.log('\n=== Clicking .hero__cta ===');
const click = await send('Runtime.evaluate', {
    expression: `(() => {
        const cta = document.querySelector('.hero__cta');
        if (!cta) return { error: 'CTA not found' };
        cta.click();
        return {
            scrollYImmediately: window.scrollY,
            orderTopImmediately: document.getElementById('order')?.getBoundingClientRect()?.top,
            focusedElement: document.activeElement?.id || document.activeElement?.tagName,
        };
    })()`,
    returnByValue: true,
});
console.log(JSON.stringify(click.result?.value, null, 2));

await new Promise(r => setTimeout(r, 100));

console.log('\n=== After 100ms ===');
const after100 = await send('Runtime.evaluate', {
    expression: `(() => ({
        scrollY: window.scrollY,
        orderTop: document.getElementById('order')?.getBoundingClientRect()?.top,
        focusedElement: document.activeElement?.id || document.activeElement?.tagName,
        urlHash: window.location.hash,
    }))()`,
    returnByValue: true,
});
console.log(JSON.stringify(after100.result?.value, null, 2));

await new Promise(r => setTimeout(r, 600));

console.log('\n=== After 700ms total ===');
const after700 = await send('Runtime.evaluate', {
    expression: `(() => ({
        scrollY: window.scrollY,
        orderTop: document.getElementById('order')?.getBoundingClientRect()?.top,
        focusedElement: document.activeElement?.id || document.activeElement?.tagName,
        urlHash: window.location.hash,
    }))()`,
    returnByValue: true,
});
console.log(JSON.stringify(after700.result?.value, null, 2));

ws.close();
edge.kill();
