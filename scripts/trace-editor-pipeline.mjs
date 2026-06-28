#!/usr/bin/env node
/**
 * trace-editor-pipeline.mjs — trace each step of the editor pipeline.
 */
import { build } from 'vite';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TMP = join(ROOT, 'dist/soctiv-preview/vite-tmp');
if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true });
if (!existsSync(join(TMP, 'dist'))) mkdirSync(join(TMP, 'dist'), { recursive: true });

const entryShim = `
import { renderSoctivIndexPreview, buildPreviewContext, renderTemplate } from '@/services/soctivLandingPreview';
import indexTpl from '@/../supabase/functions/publish-landing-page/template_index.html?raw';
import runtimeJs from '@/../supabase/functions/publish-landing-page/client_runtime.js?raw';
import stylesCss from '@/../supabase/functions/publish-landing-page/styles.css?raw';

const config = {
    product: { id: 'p-001', code: 'WT-LIB-001', name: 'smart-watch', nameArabic: 'ساعة ذكية Pro', category: 'إلكترونيات', image: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=1200&q=80', currency: 'LYD', currencySymbol: 'د.ل', currencyName: 'دينار ليبي', value: 89, unitPrice: 89, metaLine: 'دفع عند الاستلام' },
    pricing: { tiers: [{ quantity: 1, price: 89, label: 'قطعة واحدة' }], maxQty: 5, discountLabel: 'التخفيض' },
    tracking: { pixelId: '', capiUrl: '', testEventCode: '', debug: false },
    hero: { headline: 'ساعة', subline: 'ساعة ذكية', ctaText: 'اطلب الآن', imageUrl: 'x', imageAlt: 'ساعة' },
    form: { submitText: 'تأكيد', nameField: 'الاسم', phoneField: 'الهاتف', locationField: 'العنوان', phoneRegex: '^09[0-9]{8}$', phonePlaceholder: '091', nameMinLength: 3, locationMinLength: 5 },
    objections: { heading: '', subheading: '', items: [] },
    reviews: { heading: '', subheading: '', items: [] },
    trust: { badges: [], row: [] },
    business: { brand: 'soctiv', copyright: 'محفوظة' },
    webhook: { url: '', clientCode: '', productCode: '', thankYouUrl: 'thank-you.html', source: 'Landing Page' },
    seo: { title: '', description: '', ogImage: '', ogImageAlt: '', year: '2026' },
    theme: { palette: 'cream-sage', font: 'Alexandria' },
};

const ctx = buildPreviewContext(config, { supabaseUrl: 'https://example.supabase.co' });
const tpl = renderTemplate(indexTpl, ctx);
console.log('STEP 1: renderTemplate output');
console.log('  has <script src="runtime.js">: ' + tpl.includes('<script src="runtime.js"></script>'));
console.log('  contains </body>: ' + tpl.includes('</body>'));

const safeStyles = stylesCss.replace(/<\\\\/style>/gi, '<\\\\\\\\/style>');
const safeRuntime = runtimeJs.replace(/<\\\\/script>/gi, '<\\\\\\\\/script>');

let html2 = tpl;
html2 = html2.replace(/<link rel="stylesheet" href="styles\\\\.css"\\\\s*\\\\/?>/, '<style>' + safeStyles + '</style>');
html2 = html2.replace(/<script src="sha256\\\\.js"><\\\\/script>\\\\s*<script src="pixel\\\\.js"><\\\\/script>/, '<script>/* noop */</script>');
html2 = html2.replace(/<script src="runtime\\\\.js"><\\\\/script>/, '<script>' + safeRuntime + '<\\\\/script>');

console.log('STEP 2: inlineAssets output');
console.log('  size: ' + html2.length);
console.log('  has inlined runtime: ' + html2.includes('(function () {'));
console.log('  contains </body>: ' + html2.includes('</body>'));
const bodyIdx = html2.indexOf('</body>');
console.log('  first </body> at position: ' + bodyIdx + ' (of ' + html2.length + ')');
if (bodyIdx !== -1) {
    console.log('  context around first </body>: ' + JSON.stringify(html2.substring(Math.max(0, bodyIdx - 50), bodyIdx + 8)));
}

const previewFlag = '<script>window.__SOCTIV_PREVIEW__ = true; window.__SOCTIV_CONFIG__ = {};<\\\\/script>\\\\n';
let html3;
if (html2.includes('<script src="runtime.js"><\\\\/script>')) {
    html3 = html2.replace('<script src="runtime.js"><\\\\/script>', previewFlag + '<script src="runtime.js"><\\\\/script>');
} else {
    console.log('  FALLBACK: html.includes(<script src="runtime.js">) is FALSE — using body fallback');
    html3 = html2.replace('</body>', previewFlag + '</body>');
}
console.log('STEP 3: injectConfigScript output');
console.log('  size: ' + html3.length);
console.log('  first </body> at position: ' + html3.indexOf('</body>'));
`;
writeFileSync(join(TMP, 'trace-entry.mjs'), entryShim, 'utf8');
writeFileSync(join(TMP, 'trace-config.mjs'), `
import { defineConfig } from 'vite';
import path from 'node:path';
export default defineConfig({
    root: ${JSON.stringify(TMP)},
    resolve: {
        alias: { '@': ${JSON.stringify((ROOT + '/src').replace(/\\\\/g, '/'))} },
    },
    build: {
        outDir: ${JSON.stringify(TMP + '/trace-dist')},
        emptyOutDir: false,
        minify: false,
        target: 'node18',
        ssr: ${JSON.stringify(TMP + '/trace-entry.mjs')},
        rollupOptions: { input: ${JSON.stringify(TMP + '/trace-entry.mjs')}, output: { format: 'esm', entryFileNames: 'trace.bundled.mjs' } },
    },
    ssr: { noExternal: true, target: 'node' },
});
`, 'utf8');

await build({
    configFile: join(TMP, 'trace-config.mjs'),
    logLevel: 'warn',
});

const bundlePath = join(TMP, 'trace-dist', 'trace.bundled.mjs');
await import(bundlePath);
