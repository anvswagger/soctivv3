#!/usr/bin/env node
/**
 * test-final-screenshot.mjs — take a clean screenshot of the page after
 * a preview-mode submit so we can verify the confirmation card renders.
 */
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = 'dist/soctiv-preview';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const PORT = 9337;
const HOST_PATH = join(process.cwd(), 'dist/soctiv-preview/preview-page/index.html');

const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--window-size=1280,3200', `--remote-debugging-port=${PORT}`,
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

// Click qty-plus 2 times to make the form interactive
await send('Runtime.evaluate', {
    expression: `(() => {
        document.getElementById('qty-plus').click();
        document.getElementById('qty-plus').click();
        document.getElementById('f-name').value = 'أحمد محمد';
        document.getElementById('f-name').dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('f-phone').value = '0912345678';
        document.getElementById('f-phone').dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('f-location').value = 'طرابلس - شارع الجمهورية';
        document.getElementById('f-location').dispatchEvent(new Event('input', { bubbles: true }));
    })()`,
    returnByValue: true,
});
await new Promise(r => setTimeout(r, 500));

// Submit and screenshot the confirmation
await send('Runtime.evaluate', {
    expression: 'document.getElementById("submit-btn").click()',
    returnByValue: true,
});
await new Promise(r => setTimeout(r, 1000));

// Scroll the confirmation into view
await send('Runtime.evaluate', {
    expression: `(() => {
        const c = document.querySelector('.preview-confirm');
        if (c) c.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()`,
    returnByValue: true,
});
await new Promise(r => setTimeout(r, 500));

const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(OUT_DIR, 'preview-confirmation-card.png'), Buffer.from(shot.data, 'base64'));
console.log('Saved', join(OUT_DIR, 'preview-confirmation-card.png'));

ws.close();
edge.kill();
