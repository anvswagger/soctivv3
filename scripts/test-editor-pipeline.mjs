#!/usr/bin/env node
/**
 * test-editor-pipeline.mjs — use the EDITOR's actual render pipeline
 * (renderSoctivIndexPreview) instead of the standalone render script.
 * This is what PreviewPane.tsx puts in the iframe srcDoc.
 *
 * Confirms whether the editor's iframe HTML has the runtime inlined
 * and the listeners attach.
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'vite';

const OUT_DIR = 'dist/soctiv-preview';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// Build the editor's renderer module so we can import it from Node.
const TMP = join(process.cwd(), 'dist/soctiv-preview/build-tmp');
if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true });

const entryShim = `
import { renderSoctivIndexPreview } from '@/services/soctivLandingPreview';
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
    tracking: { pixelId: '', capiUrl: 'https://example.supabase.co/functions/v1/capi-proxy', testEventCode: '', debug: false },
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
    objections: { heading: '', subheading: '', items: [] },
    reviews: { heading: '', subheading: '', items: [] },
    trust: { badges: [], row: [] },
    business: { brand: 'soctiv', copyright: 'جميع الحقوق محفوظة' },
    webhook: { url: '', clientCode: '', productCode: '', thankYouUrl: 'thank-you.html', source: 'Landing Page' },
    seo: { title: '', description: '', ogImage: '', ogImageAlt: '', year: '2026' },
    theme: { palette: 'cream-sage', font: 'Alexandria' },
};
const html = renderSoctivIndexPreview(config, { supabaseUrl: 'https://example.supabase.co' });
process.stdout.write('---HTML-START---\\n');
process.stdout.write(html);
process.stdout.write('\\n---HTML-END---\\n');
`;
const entryPath = join(TMP, 'entry.mjs');
writeFileSync(entryPath, entryShim, 'utf8');

// Use Vite to bundle the entry (which resolves the `?raw` imports + @ alias)
const tmpRoot = join(process.cwd(), 'dist/soctiv-preview/vite-tmp');
if (!existsSync(tmpRoot)) mkdirSync(tmpRoot, { recursive: true });
const viteEntry = join(tmpRoot, 'entry.mjs');
writeFileSync(viteEntry, entryShim, 'utf8');
writeFileSync(join(tmpRoot, 'vite.config.mjs'), `
import { defineConfig } from 'vite';
import path from 'node:path';
export default defineConfig({
    root: ${JSON.stringify(tmpRoot)},
    resolve: {
        alias: { '@': ${JSON.stringify(process.cwd().replace(/\\\\/g, '/') + '/src')} },
    },
    build: {
        outDir: ${JSON.stringify(tmpRoot + '/dist')},
        write: false,
        minify: false,
        target: 'es2020',
        lib: { entry: ${JSON.stringify(viteEntry)}, formats: ['es'], fileName: 'bundle' },
        rollupOptions: { external: [] },
    },
});
`, 'utf8');

await build({
    configFile: join(tmpRoot, 'vite.config.mjs'),
    logLevel: 'error',
});

const bundlePath = join(tmpRoot, 'dist/bundle.js');
const bundleSrc = readFileSync(bundlePath, 'utf8');
// Write a thin CJS shim that runs the bundle and dumps the captured HTML
const runnerPath = join(tmpRoot, 'run.cjs');
writeFileSync(runnerPath, `
const { fork } = require('node:child_process');
const path = require('node:path');
const bundlePath = ${JSON.stringify(bundlePath)};
const child = fork(bundlePath, [], { stdio: ['ignore', 'pipe', 'inherit'] });
child.stdout.on('data', d => process.stdout.write(d));
child.on('exit', code => process.exit(code || 0));
`, 'utf8');

// Just import via dynamic import and capture HTML directly
const indexHtml = await (async () => {
    const mod = await import(bundlePath);
    // The entry doesn't actually export anything; we need a different approach.
    return null;
})().catch(() => null);

// Alternative: bundle as CommonJS so we can require it from Node
writeFileSync(join(tmpRoot, 'vite.config.mjs'), `
import { defineConfig } from 'vite';
import path from 'node:path';
export default defineConfig({
    root: ${JSON.stringify(tmpRoot)},
    resolve: {
        alias: { '@': ${JSON.stringify(process.cwd().replace(/\\\\/g, '/') + '/src')} },
    },
    build: {
        outDir: ${JSON.stringify(tmpRoot + '/dist')},
        write: false,
        minify: false,
        target: 'node18',
        lib: { entry: ${JSON.stringify(viteEntry)}, formats: ['cjs'], fileName: 'bundle' },
        rollupOptions: { external: [], output: {} },
    },
    ssr: { noExternal: true, target: 'node' },
});
`, 'utf8');

await build({
    configFile: join(tmpRoot, 'vite.config.mjs'),
    logLevel: 'error',
});

const cjsPath = join(tmpRoot, 'dist/bundle.cjs');
const cjsSrc = readFileSync(cjsPath, 'utf8');
// The CJS bundle should write HTML to stdout when required (because of
// process.stdout.write calls in entry).
const Module = (await import('node:module')).default;
const m = new Module('inline');
m._compile(cjsSrc.replace('process.stdout.write', 'globalThis.__CAP__(process.stdout.write)'), 'inline.cjs');
let captured = '';
globalThis.__CAP__ = (orig) => orig.bind({ write: (s) => { captured += s; return true; } });
m._compile(cjsSrc, 'inline.cjs');

const editorHtml = captured.split('---HTML-START---\n')[1]?.split('\n---HTML-END---')[0] || '';

if (!editorHtml) {
    console.error('FAILED to capture editor HTML output');
    process.exit(1);
}

console.log(`Editor iframe HTML: ${editorHtml.length} bytes`);
console.log(`  inlined runtime? ${editorHtml.includes('function () {\\n    \\'use strict\\';') || editorHtml.includes('(function () {')}`);
console.log(`  sibling <script src="runtime.js">? ${editorHtml.includes('<script src="runtime.js">')}`);

// Save to a file we can inspect
writeFileSync(join(OUT_DIR, 'editor-iframe.html'), editorHtml, 'utf8');
console.log(`  written: ${join(OUT_DIR, 'editor-iframe.html')}`);
