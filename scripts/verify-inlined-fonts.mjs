#!/usr/bin/env node
/**
 * verify-inlined-fonts.mjs — exercise the inlined-fonts path end-to-end:
 *   1. Use the live `fetchInlinedGoogleFontsCss` to fetch + inline the CSS
 *   2. Render the preview with the inlined CSS
 *   3. Save the rendered HTML to a file
 *   4. Open it in headless Edge and probe body font + loaded fontfaces
 */
import { build } from 'vite';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TMP = join(ROOT, 'dist/soctiv-preview/verify-tmp');
if (existsSync(TMP)) {
    const rmf = (p) => { try { (require('node:fs')).rmSync(p, { recursive: true, force: true }); } catch {} };
    rmf(TMP);
}
mkdirSync(TMP, { recursive: true });
mkdirSync(join(TMP, 'dist'), { recursive: true });

const entryShim = `
import { renderSoctivIndexPreview } from '@/services/soctivLandingPreview';
import { fetchInlinedGoogleFontsCss } from '@/services/soctivFontInliner';
import { writeFileSync } from 'node:fs';

const config = {
    product: {
        id: 'p-001', code: 'WT-LIB-001', name: 'smart-watch',
        nameArabic: 'ساعة ذكية Pro', category: 'إلكترونيات',
        image: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=1200&q=80',
        currency: 'LYD', currencySymbol: 'د.ل', currencyName: 'دينار ليبي',
        value: 89, unitPrice: 89,
        metaLine: 'دفع عند الاستلام · توصيل مجاني · ضمان سنة',
    },
    pricing: {
        tiers: [
            { quantity: 1, price: 89, label: 'قطعة واحدة' },
            { quantity: 2, price: 159, label: 'قطعتان' },
            { quantity: 3, price: 219, label: 'ثلاث قطع' },
            { quantity: 4, price: 269, label: 'أربع قطع' },
            { quantity: 5, price: 309, label: 'خمس قطع' },
        ],
        maxQty: 5, discountLabel: 'التخفيض',
    },
    tracking: { pixelId: '', capiUrl: '', testEventCode: '', debug: false },
    hero: {
        headline: 'ساعة ذكية Pro — بتقنية البلوتوث واللياقة',
        subline: 'دفع عند الاستلام في كل المدن الليبية · توصيل مجاني · ضمان سنة كاملة',
        ctaText: 'اطلب الآن',
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1040&q=80',
        imageAlt: 'ساعة ذكية ليبيانا',
    },
    form: {
        submitText: 'تأكيد الطلب — الدفع عند الاستلام',
        nameField: 'الاسم الكامل', phoneField: 'رقم الهاتف', locationField: 'المدينة والعنوان',
        phoneRegex: '^09[0-9]{8}$', phonePlaceholder: '091 234 5678',
        nameMinLength: 3, locationMinLength: 5,
    },
    objections: { heading: 'أسئلة شائعة', subheading: 'إجابات', items: [{q:'سؤال',a:'جواب'}] },
    reviews: { enabled: true, heading: 'آراء العملاء', subheading: '', items: [{name:'أحمد',location:'طرابلس',text:'ممتاز',initial:'أ'}] },
    trust: { badges: { enabled: true, items: ['الدفع عند الاستلام','توصيل مجاني','ضمان سنة'] }, row: { enabled: true, items: ['دفع عند الاستلام','توصيل مجاني'] } },
    business: { brand: 'soctiv', copyright: 'جميع الحقوق محفوظة', supportEmail: 'support@soctiv.ly', privacyEmail: 'privacy@soctiv.ly', country: 'Libya', phonePrefix: '+218', brandInitial: 's' },
    webhook: { url: '', clientCode: '', productCode: '', thankYouUrl: 'thank-you.html', source: 'Landing Page' },
    seo: { title: 'ساعة ذكية Pro — الدفع عند الاستلام | soctiv', description: 'ساعة ذكية Pro', ogImage: '', ogImageAlt: '', year: '2026' },
    theme: { palette: 'cream-sage', font: 'Alexandria' },
};

const inlinedCss = await fetchInlinedGoogleFontsCss();
const html = renderSoctivIndexPreview(config, {
    supabaseUrl: 'https://example.supabase.co',
    year: '2026',
    inlinedGoogleFontsCss: inlinedCss,
});
writeFileSync('${join(TMP, 'dist', 'preview-inlined.html').replace(/\\/g, '/')}', html);

// Sanity checks
const checks = {
    totalLength: html.length,
    styleTagCount: (html.match(/<style/g) || []).length,
    hasGoogleFontsLink: html.includes('fonts.googleapis.com/css2'),
    hasInlinedFontsTag: html.includes('data-soctiv-fonts'),
    hasFontFace: html.includes('@font-face'),
    hasDataUri: html.includes('data:font/woff2;base64,'),
    hasNoopPixel: html.includes('SOCTIV_TRACK_NOOP'),
    runtimeIndex: html.indexOf('initOrderForm'),
    previewFlagIndex: html.indexOf('__SOCTIV_PREVIEW__'),
    configIndex: html.indexOf('__SOCTIV_CONFIG__'),
};
console.log('Checks:', JSON.stringify(checks, null, 2));
console.log('\\nInlined CSS length:', inlinedCss.length);
console.log('Inlined CSS @font-face count:', (inlinedCss.match(/@font-face/g) || []).length);
console.log('Inlined CSS data: URI count:', (inlinedCss.match(/data:font/g) || []).length);
`;

writeFileSync(join(TMP, 'entry.mjs'), entryShim, 'utf8');
writeFileSync(join(TMP, 'vite.config.mjs'), `
import { defineConfig } from 'vite';
export default defineConfig({
    root: ${JSON.stringify(TMP)},
    resolve: {
        alias: {
            '@': ${JSON.stringify((ROOT + '/src').replace(/\\/g, '/'))},
        },
    },
    build: {
        outDir: ${JSON.stringify(TMP + '/dist')},
        emptyOutDir: false,
        minify: false,
        target: 'node18',
        ssr: ${JSON.stringify(TMP + '/entry.mjs')},
        rollupOptions: { input: ${JSON.stringify(TMP + '/entry.mjs')}, output: { format: 'esm', entryFileNames: 'verify.bundled.mjs' } },
    },
    ssr: { noExternal: true, target: 'node' },
});
`, 'utf8');

await build({
    configFile: join(TMP, 'vite.config.mjs'),
    logLevel: 'warn',
});

const bundlePath = join(TMP, 'dist', 'verify.bundled.mjs');
await import('file:///' + bundlePath.replace(/\\/g, '/'));

// Now probe the rendered HTML in headless Edge
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9462;
const PREVIEW_PATH = join(TMP, 'dist', 'preview-inlined.html');

const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
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
    } else if (msg.method === 'Runtime.exceptionThrown') {
        const ed = msg.params.exceptionDetails;
        exceptions.push({ url: ed.url, line: ed.lineNumber, text: ed.text, desc: ed.exception?.description?.split('\n').slice(0, 2).join('\n') });
    } else if (msg.method === 'Network.responseReceived') {
        networkLog.push({ type: 'response', url: msg.params.response.url, status: msg.params.response.status });
    }
});

await send('Runtime.enable');
await send('Network.enable');
await new Promise(r => setTimeout(r, 500));

// Wait for fonts to load
try {
    await send('Runtime.evaluate', {
        expression: `document.fonts.ready.then(() => 'ready')`,
        awaitPromise: true,
        returnByValue: true,
    });
} catch (e) {
    console.log('Font wait error:', e.message);
}
await new Promise(r => setTimeout(r, 1500));

console.log('\\n=== Exceptions ===');
exceptions.forEach(e => console.log('  ' + JSON.stringify(e)));

console.log('\\n=== Network responses (top 30) ===');
networkLog.slice(0, 30).forEach(n => console.log('  ' + JSON.stringify(n)));

const probe = await send('Runtime.evaluate', {
    expression: `(() => {
        const body = document.body;
        const heroTitle = document.querySelector('.hero__title');
        const bodyStyle = window.getComputedStyle(body);
        const fonts = document.fonts ? Array.from(document.fonts).map(f => ({ family: f.family, status: f.status, weight: f.weight, style: f.style })) : [];
        const loadedFamilies = [...new Set(fonts.filter(f => f.status === 'loaded').map(f => f.family))];
        return {
            bodyFontFamily: bodyStyle.fontFamily,
            bodyBgColor: bodyStyle.backgroundColor,
            bodyColor: bodyStyle.color,
            heroTitleText: heroTitle?.textContent?.trim().slice(0, 50),
            heroTitleFont: heroTitle ? window.getComputedStyle(heroTitle).fontFamily : null,
            heroTitleColor: heroTitle ? window.getComputedStyle(heroTitle).color : null,
            fontFacesTotal: fonts.length,
            fontFacesLoaded: fonts.filter(f => f.status === 'loaded').length,
            fontFacesUnloaded: fonts.filter(f => f.status === 'unloaded').length,
            loadedFamilies,
            hasInlinedFontsTag: !!document.querySelector('[data-soctiv-fonts]'),
            hasGoogleFontsLink: !!document.querySelector('link[href*="fonts.googleapis.com"]'),
        };
    })()`,
    returnByValue: true,
});
console.log('\\n=== State probe ===');
console.log(JSON.stringify(probe.result?.value, null, 2));

ws.close();
edge.kill();
