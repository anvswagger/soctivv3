#!/usr/bin/env node
/**
 * test-cdp-error.mjs — capture the FULL exception details + stack trace
 * from the runtime when it throws on load. We hook Runtime.exceptionThrown
 * and capture exceptionDetails.exception.description which has the stack.
 */
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = 'dist/soctiv-preview';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
const LOG = join(OUT_DIR, 'cdp-error.log');

const PORT = 9334;
const URL = 'file:///' + join(process.cwd(), 'dist/soctiv-preview', 'preview-page', 'index.html').replace(/\\/g, '/');

const log = [];
const push = (s) => { log.push(s); };

const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--window-size=1280,2400',
    `--remote-debugging-port=${PORT}`,
    URL,
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

await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
});

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
        push('EXCEPTION:');
        push('  text: ' + ed.text);
        push('  url: ' + ed.url);
        push('  lineNumber: ' + ed.lineNumber);
        push('  columnNumber: ' + ed.columnNumber);
        if (ed.exception) {
            push('  exception.description:');
            push(ed.exception.description);
            push('  exception.value:');
            push(ed.exception.value);
        }
        if (ed.stackTrace) {
            push('  stackTrace.callFrames:');
            ed.stackTrace.callFrames.forEach(f => {
                push(`    ${f.functionName || '<anon>'}  ${f.url}:${f.lineNumber}:${f.columnNumber}`);
            });
        }
    }
});

await send('Runtime.enable');
await new Promise(r => setTimeout(r, 2000));

ws.close();
edge.kill();

writeFileSync(LOG, log.join('\n'), 'utf8');
console.log(log.join('\n'));
