#!/usr/bin/env node
/**
 * debug-render.mjs — render the preview HTML using the live source and
 * verify the output. We bypass the iframe to check what the editor
 * actually generates.
 */
import { build } from 'vite';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TMP = join(ROOT, 'dist/soctiv-preview/debug-tmp');
if (existsSync(TMP)) {
    const rmf = (p) => { try { (require('node:fs')).rmSync(p, { recursive: true, force: true }); } catch {} };
    rmf(TMP);
}
mkdirSync(TMP, { recursive: true });
mkdirSync(join(TMP, 'dist'), { recursive: true });

const entryShim = `
import { renderSoctivIndexPreview } from '@/services/soctivLandingPreview';
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
    objections: { heading: 'أسئلة شائعة', subheading: 'إجابات', items: [{q:'سؤال',a:'جواب'}] },
    reviews: { enabled: true, heading: 'آراء العملاء', subheading: '', items: [{name:'أحمد',location:'طرابلس',text:'ممتاز',initial:'أ'}] },
    trust: { badges: { enabled: true, items: ['الدفع عند الاستلام','توصيل مجاني','ضمان سنة'] }, row: { enabled: true, items: ['دفع عند الاستلام','توصيل مجاني'] } },
    business: { brand: 'soctiv', copyright: 'جميع الحقوق محفوظة', supportEmail: 'support@soctiv.ly', privacyEmail: 'privacy@soctiv.ly', country: 'Libya', phonePrefix: '+218', brandInitial: 's' },
    webhook: { url: '', clientCode: '', productCode: '', thankYouUrl: 'thank-you.html', source: 'Landing Page' },
    seo: { title: 'ساعة ذكية Pro — الدفع عند الاستلام | soctiv', description: 'ساعة ذكية Pro', ogImage: '', ogImageAlt: '', year: '2026' },
    theme: { palette: 'cream-sage', font: 'Alexandria' },
};

const html = renderSoctivIndexPreview(config, { supabaseUrl: 'https://example.supabase.co' });
writeFileSync('${join(TMP, 'dist', 'preview.html').replace(/\\/g, '/')}', html);

// Detailed checks
const checks = {
    totalLength: html.length,
    styleTagCount: (html.match(/<style/g) || []).length,
    styleTagCloses: (html.match(/<\\/style>/g) || []).length,
    scriptTagCount: (html.match(/<script/g) || []).length,
    hasStylesCssLink: html.includes('<link rel="stylesheet" href="styles.css"'),
    hasGoogleFontsLink: html.includes('fonts.googleapis.com/css2'),
    hasPreviewFlag: html.includes('__SOCTIV_PREVIEW__'),
    hasConfigObject: html.includes('__SOCTIV_CONFIG__'),
    configIndex: html.indexOf('__SOCTIV_CONFIG__'),
    runtimeIndex: html.indexOf('initOrderForm'),
    heroCtaIndex: html.indexOf('hero__cta'),
    orderIdIndex: html.indexOf('id="order"'),
    fontVarIndex: html.indexOf('--font:'),
    hasCssVars: html.includes('--bg:'),
    hasReset: html.includes('box-sizing: border-box'),
    hasBtnPrimary: html.includes('.btn--primary'),
};

console.log('Checks:', JSON.stringify(checks, null, 2));

// Find the position of __SOCTIV_PREVIEW__ relative to __SOCTIV_CONFIG__ and runtime
const previewIdx = html.indexOf('window.__SOCTIV_PREVIEW__ = true;');
const configIdx = previewIdx;
const runtimeStartIdx = html.indexOf('(function () {', previewIdx);
console.log({
    previewFlagIdx: previewIdx,
    configIdx: configIdx,
    runtimeStartIdx: runtimeStartIdx,
    configBeforeRuntime: configIdx < runtimeStartIdx,
});
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
        rollupOptions: { input: ${JSON.stringify(TMP + '/entry.mjs')}, output: { format: 'esm', entryFileNames: 'debug.bundled.mjs' } },
    },
    ssr: { noExternal: true, target: 'node' },
});
`, 'utf8');

await build({
    configFile: join(TMP, 'vite.config.mjs'),
    logLevel: 'warn',
});

const bundlePath = join(TMP, 'dist', 'debug.bundled.mjs');
await import('file:///' + bundlePath.replace(/\\/g, '/'));