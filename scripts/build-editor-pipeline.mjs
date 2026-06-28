#!/usr/bin/env node
/**
 * build-editor-pipeline-trace.mjs — trace each step of the editor pipeline
 * to find where the </body> substitution happens.
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
import { renderSoctivIndexPreview } from '@/services/soctivLandingPreview';
import { renderTemplate } from '@/services/soctivLandingPreview';
import indexTpl from '@/../supabase/functions/publish-landing-page/template_index.html?raw';
import runtimeJs from '@/../supabase/functions/publish-landing-page/client_runtime.js?raw';
import stylesCss from '@/../supabase/functions/publish-landing-page/styles.css?raw';

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

// Save full output
import('node:fs').then(({ writeFileSync: wfs }) => {
    wfs('${join(TMP, 'dist', 'trace-output.html').replace(/\\\\/g, '/')}', html);
});

// Also report </body> occurrences and surrounding context
const matches = [];
let idx = 0;
while ((idx = html.indexOf('</body>', idx)) !== -1) {
    const before = html.substring(Math.max(0, idx - 30), idx);
    const after = html.substring(idx + 8, idx + 38);
    matches.push({ position: idx, before, after });
    idx += 8;
}
console.log('---FULL-HTML-START---');
console.log(html);
console.log('---FULL-HTML-END---');
console.log('---</body>-OCCURRENCES---');
console.log(JSON.stringify(matches, null, 2));
`;
writeFileSync(join(TMP, 'entry.mjs'), entryShim, 'utf8');
writeFileSync(join(TMP, 'vite.config.mjs'), `
import { defineConfig } from 'vite';
import path from 'node:path';
export default defineConfig({
    root: ${JSON.stringify(TMP)},
    resolve: {
        alias: {
            '@': ${JSON.stringify((ROOT + '/src').replace(/\\\\/g, '/'))},
        },
    },
    build: {
        outDir: ${JSON.stringify(TMP + '/dist')},
        emptyOutDir: false,
        minify: false,
        target: 'node18',
        ssr: ${JSON.stringify(TMP + '/entry.mjs')},
        rollupOptions: { input: ${JSON.stringify(TMP + '/entry.mjs')}, output: { format: 'esm', entryFileNames: 'trace.bundled.mjs' } },
    },
    ssr: { noExternal: true, target: 'node' },
});
`, 'utf8');

await build({
    configFile: join(TMP, 'vite.config.mjs'),
    logLevel: 'warn',
});

const bundlePath = join(TMP, 'dist', 'trace.bundled.mjs');
await import(bundlePath);
