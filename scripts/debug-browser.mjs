#!/usr/bin/env node
/**
 * debug-browser.mjs — open the generated preview HTML in a headless Edge
 * browser and inspect:
 *   1. Whether the inlined <style> tags are being applied
 *   2. Whether the Google Fonts link is loading
 *   3. Whether the body font-family resolves to "Alexandria"
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = 'dist/soctiv-preview';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const PORT = 9460;
const HOST_PATH = join(process.cwd(), 'dist/soctiv-preview/debug-tmp/dist/preview.html');

if (!existsSync(HOST_PATH)) {
    console.error('Preview HTML not found. Run node scripts/debug-render.mjs first.');
    process.exit(1);
}

const USE_HTTP = process.env.USE_HTTP === '1';
const TARGET_URL = USE_HTTP
    ? 'http://localhost:9455/index.html'
    : `file:///${HOST_PATH.replace(/\\/g, '/')}`;

const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--window-size=1400,2400', `--remote-debugging-port=${PORT}`,
    TARGET_URL,
], { stdio: ['ignore', 'ignore', 'ignore'] });

async function getPageWs() {
    for (let i = 0; i < 60; i++) {
        try {
            const r = await fetch(`http://127.0.0.1:${PORT}/json`);
            const tabs = await r.json();
            const page = tabs.find(t => t.type === 'page' && t.url.includes('preview.html'));
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
const networkLog = [];

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
    } else if (msg.method === 'Network.requestWillBeSent') {
        networkLog.push({ type: 'request', url: msg.params.request.url, method: msg.params.request.method });
    } else if (msg.method === 'Network.responseReceived') {
        const last = networkLog[networkLog.length - 1];
        if (last && last.url === msg.params.requestId) {
            // ignore - requestId is opaque
        }
        networkLog.push({ type: 'response', url: msg.params.response.url, status: msg.params.response.status });
    } else if (msg.method === 'Network.loadingFailed') {
        networkLog.push({ type: 'failed', requestId: msg.params.requestId, error: msg.params.errorText });
    }
});

await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');
await new Promise(r => setTimeout(r, 3000));

// Wait for fonts to load
try {
    await send('Runtime.evaluate', {
        expression: `document.fonts ? document.fonts.ready.then(() => 'fonts ready') : 'no document.fonts'`,
        awaitPromise: true,
        returnByValue: true,
    });
} catch (e) {
    console.log('Font wait error:', e.message);
}
await new Promise(r => setTimeout(r, 2000));

console.log('\n=== Console logs ===');
consoleLogs.forEach(l => console.log('  ' + l));
console.log('\n=== Exceptions ===');
exceptions.forEach(e => console.log('  ' + JSON.stringify(e)));

console.log('\n=== Network requests ===');
networkLog.forEach(n => console.log('  ' + JSON.stringify(n)));

const probe = await send('Runtime.evaluate', {
    expression: `(() => {
        const body = document.body;
        const heroTitle = document.querySelector('.hero__title');
        const cta = document.querySelector('.hero__cta');
        const orderSection = document.getElementById('order');
        const styleTags = document.querySelectorAll('style');

        // Try to get computed font
        const bodyFont = window.getComputedStyle(body).fontFamily;
        const bodyFontLoaded = document.fonts ? document.fonts.check('16px "Alexandria"') : 'no document.fonts';
        const fontCss = document.fonts ? Array.from(document.fonts).map(f => ({ family: f.family, status: f.status, weight: f.weight, style: f.style })) : [];

        // Check if link to google fonts exists
        const googleFontsLink = document.querySelector('link[href*="fonts.googleapis.com"]');

        // Check if style tags have content
        const styleContents = Array.from(styleTags).map((s, i) => ({
            index: i,
            length: s.textContent.length,
            firstChars: s.textContent.substring(0, 60),
        }));

        // Find any @font-face rules in the style tags
        const allStyleContent = Array.from(styleTags).map(s => s.textContent).join('\n');
        const fontFaceRules = (allStyleContent.match(/@font-face\\s*\\{[^}]*\\}/g) || []).slice(0, 3);
        const cssVarFont = (allStyleContent.match(/--font:[^;]+/g) || []);

        // Check body computed styles in detail
        const bodyStyle = window.getComputedStyle(body);
        const heroStyle = heroTitle ? window.getComputedStyle(heroTitle) : null;

        return {
            previewFlag: window.__SOCTIV_PREVIEW__,
            configExists: typeof window.__SOCTIV_CONFIG__ !== 'undefined',
            bodyFont,
            bodyFontLoaded,
            fontCssLoadedCount: fontCss.filter(f => f.status === 'loaded').length,
            fontCssUnloadedCount: fontCss.filter(f => f.status === 'unloaded').length,
            googleFontsLinkExists: !!googleFontsLink,
            heroTitle: heroTitle?.textContent?.trim().slice(0, 50),
            ctaText: cta?.textContent?.trim().slice(0, 30),
            orderSectionExists: !!orderSection,
            styleTagsCount: styleTags.length,
            styleContents,
            heroTitleColor: heroTitle ? heroStyle.color : null,
            heroTitleFontSize: heroTitle ? heroStyle.fontSize : null,
            heroTitleFontFamily: heroTitle ? heroStyle.fontFamily : null,
            heroTitleFontWeight: heroTitle ? heroStyle.fontWeight : null,
            bodyBgColor: bodyStyle.backgroundColor,
            bodyFontFamily: bodyStyle.fontFamily,
            fontFaceRulesFound: fontFaceRules.length,
            fontFaceRulesSample: fontFaceRules.map(r => r.substring(0, 200)),
            cssVarFontLines: cssVarFont,
        };
    })()`,
    returnByValue: true,
});
console.log('\n=== State probe ===');
console.log(JSON.stringify(probe.result?.value, null, 2));

ws.close();
edge.kill();