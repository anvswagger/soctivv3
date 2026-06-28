#!/usr/bin/env node
/**
 * test-soctiv-full.mjs
 *
 * End-to-end integration test for the Soctiv landing-page publish pipeline.
 * Loads the actual `template_index.html`, `template_thank_you.html`, and
 * `template_privacy.html` from `supabase/functions/publish-landing-page/`,
 * feeds them a representative SoctivLandingConfig, and asserts:
 *
 *   1. No `{{...}}` placeholder leakage in the rendered output.
 *   2. `{{#each objections.items}}` → exactly 3 blocks.
 *   3. `{{#each reviews.items}}` → exactly 3 blocks.
 *   4. `{{#if tracking.pixelId}}` toggles the pixel scripts correctly.
 *   5. `{{__cssVars}}` injects `:root { ... }` with the chosen palette.
 *   6. OG / Twitter meta tags are populated from `seo.*`.
 *   7. `window.__SOCTIV_CONFIG__` is inlined before `</body>`.
 *   8. The webhook URL passed to the runtime is the Supabase edge function.
 *   9. The Pixel config is inlined as `window.SOCTIV_TRACK_CONFIG`.
 *  10. Privacy policy has Meta ToS disclosure section ٧.x intact.
 *  11. Arabic copy renders without HTML escaping artifacts.
 *
 * Run with: `npm run test:soctiv-full`
 *
 * The script intentionally avoids any network or DB calls — it loads
 * files from disk and runs in pure Node. If you want a real smoke
 * test against a live edge function, see `scripts/dry-run-publish.mjs`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLISH_DIR = resolve(__dirname, '..', 'supabase', 'functions', 'publish-landing-page');

// ─── Reuse the templating engine from the templating test ───────────────────

const TAG_RE = /\{\{(?:#if\s+([@.\w]+)|#each\s+([@.\w]+)|else|\/if|\/each|\{([@.\w]+)\}|([@.\w]+))\}\}/g;

function getPath(ctx, path) {
    if (path === 'this') return ctx.this;
    if (path === '@index') return ctx['@index'];
    const parts = path.split('.');
    let cur = ctx;
    for (const p of parts) {
        if (cur && typeof cur === 'object') cur = cur[p];
        else return undefined;
    }
    return cur;
}

function isTruthy(v) {
    if (v === null || v === undefined || v === false || v === 0 || v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
}

function htmlEscape(s) {
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function findMatchingClose(template, from, kind) {
    const openRe = new RegExp(`\\{\\{#${kind}\\s+([@.\\w]+)\\}\\}`, 'g');
    const closeRe = new RegExp(`\\{\\{/${kind}\\}\\}`, 'g');
    let depth = 1, pos = from;
    while (pos < template.length && depth > 0) {
        openRe.lastIndex = pos; closeRe.lastIndex = pos;
        const nextOpen = openRe.exec(template);
        const nextClose = closeRe.exec(template);
        if (!nextClose) return -1;
        if (nextOpen && nextOpen.index < nextClose.index) {
            depth++; pos = nextOpen.index + nextOpen[0].length;
        } else {
            depth--;
            if (depth === 0) return nextClose.index;
            pos = nextClose.index + nextClose[0].length;
        }
    }
    return -1;
}

function findTopLevelElse(body) {
    let depth = 0, pos = 0;
    while (pos < body.length) {
        const sub = body.slice(pos);
        const openIf = sub.match(/^\{\{#if\s+[@.\w]+\}\}/);
        const openEach = sub.match(/^\{\{#each\s+[@.\w]+\}\}/);
        const closeIf = sub.match(/^\{\{\/if\}\}/);
        const closeEach = sub.match(/^\{\{\/each\}\}/);
        const elseTag = sub.match(/^\{\{else\}\}/);
        if (openIf || openEach) { depth++; pos += (openIf || openEach)[0].length; }
        else if (closeIf || closeEach) { depth--; pos += (closeIf || closeEach)[0].length; }
        else if (elseTag && depth === 0) return pos;
        else if (elseTag) pos += elseTag[0].length;
        else pos++;
    }
    return -1;
}

function renderTemplate(template, ctx) {
    let out = '', i = 0;
    while (i < template.length) {
        TAG_RE.lastIndex = i;
        const m = TAG_RE.exec(template);
        if (!m) { out += template.slice(i); break; }
        out += template.slice(i, m.index);
        if (m[1] !== undefined) {
            const closeStart = findMatchingClose(template, m.index + m[0].length, 'if');
            if (closeStart === -1) { out += m[0]; i = m.index + m[0].length; continue; }
            const closeEnd = closeStart + '{{/if}}'.length;
            const body = template.slice(m.index + m[0].length, closeStart);
            const truthy = isTruthy(getPath(ctx, m[1]));
            const elseIdx = findTopLevelElse(body);
            if (elseIdx === -1) { if (truthy) out += renderTemplate(body, ctx); }
            else {
                const thenBranch = body.slice(0, elseIdx);
                const elseBranch = body.slice(elseIdx + '{{else}}'.length);
                out += truthy ? renderTemplate(thenBranch, ctx) : renderTemplate(elseBranch, ctx);
            }
            i = closeEnd;
        } else if (m[2] !== undefined) {
            const closeStart = findMatchingClose(template, m.index + m[0].length, 'each');
            if (closeStart === -1) { out += m[0]; i = m.index + m[0].length; continue; }
            const closeEnd = closeStart + '{{/each}}'.length;
            const body = template.slice(m.index + m[0].length, closeStart);
            const value = getPath(ctx, m[2]);
            if (Array.isArray(value) && value.length > 0) {
                for (let idx = 0; idx < value.length; idx++) {
                    const item = value[idx];
                    const itemCtx = {
                        ...ctx,
                        ...(item && typeof item === 'object' ? item : {}),
                        this: item,
                        '@index': idx,
                    };
                    out += renderTemplate(body, itemCtx);
                }
            }
            i = closeEnd;
        } else if (m[3] !== undefined) {
            out += getPath(ctx, m[3]) == null ? '' : String(getPath(ctx, m[3]));
            i = m.index + m[0].length;
        } else if (m[4] !== undefined) {
            out += getPath(ctx, m[4]) == null ? '' : htmlEscape(String(getPath(ctx, m[4])));
            i = m.index + m[0].length;
        } else {
            out += m[0]; i = m.index + m[0].length;
        }
    }
    return out;
}

// ─── Mirrors of the edge-function resolvers ─────────────────────────────────

const SOCTIV_PALETTES = {
    'cream-sage': {
        '--bg': '#f6f3ec', '--surface': '#ffffff', '--surface-2': '#efeae0',
        '--ink': '#1f1f1c', '--accent': '#9a7e57', '--sage': '#6e8a7c', '--sage-deep': '#3f564a',
    },
    'ivory-teal': {
        '--bg': '#fafaf7', '--surface': '#ffffff', '--surface-2': '#f1efe8',
        '--ink': '#0f1f1f', '--accent': '#3f7a7b', '--sage': '#3f7a7b', '--sage-deep': '#1f4f50',
    },
    'sand-amber': {
        '--bg': '#f5efe6', '--surface': '#ffffff', '--surface-2': '#ebe4d6',
        '--ink': '#2a1f12', '--accent': '#c08a4a', '--sage': '#8a7a4a', '--sage-deep': '#5a4a25',
    },
};
function paletteToCssVars(theme) {
    const key = SOCTIV_PALETTES[theme?.palette] ? theme.palette : 'cream-sage';
    // Wrap in `:root { ... }` so the template's `<style>{{__cssVars}}</style>`
    // produces valid CSS. (Was previously a bare list of vars.)
    const body = Object.entries(SOCTIV_PALETTES[key]).map(([k, v]) => `${k}: ${v}`).join('; ');
    return `:root { ${body}; }`;
}
function fontName(theme) {
    return { 'Alexandria': 'Alexandria', 'IBM Plex Sans Arabic': 'IBM+Plex+Sans+Arabic', 'Cairo': 'Cairo' }[theme?.font] || 'Alexandria';
}

const FORM_COPY_DEFAULTS = {
    submitText: 'تأكيد الطلب', nameField: 'الاسم الكامل', phoneField: 'رقم الهاتف',
    locationField: 'المدينة والعنوان',
    namePlaceholder: 'مثال: أحمد محمد',
    locationPlaceholder: 'مثال: شارع الجمهورية، طرابلس',
    phoneError: 'يرجى إدخال رقم هاتف ليبي صالح (10 أرقام يبدأ بـ 09).',
    nameError: 'يرجى إدخال الاسم الكامل.', locationError: 'يرجى إدخال المدينة والعنوان.',
    submittingText: 'جاري الإرسال…',
};
const PRICING_COPY_DEFAULTS = {
    stepperLabel: 'كم قطعة تريد؟', stepperAria: 'اختر الكمية',
    minusAria: 'إنقاص الكمية', plusAria: 'زيادة الكمية',
    unitLabel: 'سعر القطعة الواحدة', subtotalLabel: 'سعر القطعة',
    deliveryLabel: 'رسوم التوصيل', deliveryFree: 'مجاناً',
    discountLabel: 'التخفيض', totalLabel: 'الإجمالي الكلي',
};

// ─── Sample SoctivLandingConfig (Libyan COD wrist-watch funnel) ─────────────

const sampleProduct = {
    id: 'p-001',
    code: 'WT-LIB-001',
    name: 'smart-watch',
    nameArabic: 'ساعة ذكية ليبيانا',
    category: 'إلكترونيات',
    image: 'https://cdn.example.com/watch.jpg',
    currency: 'LYD',
    currencySymbol: 'د.ل',
    currencyName: 'دينار ليبي',
    value: 89,
    unitPrice: 89,
    metaLine: 'دفع عند الاستلام · توصيل مجاني',
};

const sampleConfig = () => ({
    product: { ...sampleProduct },
    pricing: {
        tiers: [
            { quantity: 1, price: 89, label: 'قطعة واحدة' },
            { quantity: 2, price: 159, label: 'قطعتان' },
            { quantity: 3, price: 219, label: 'ثلاث قطع' },
            { quantity: 4, price: 269, label: 'أربع قطع' },
            { quantity: 5, price: 309, label: 'خمس قطع' },
        ],
        maxQty: 5,
        discountLabel: 'التخفيض',
    },
    tracking: {
        pixelId: '1234567890',
        capiUrl: 'https://abc.supabase.co/functions/v1/capi-proxy',
        testEventCode: 'TEST12345',
        debug: false,
    },
    hero: {
        headline: 'ساعة ذكية بسعر مميز',
        subline: 'دفع عند الاستلام في كل المدن الليبية',
        ctaText: 'اطلب الآن',
        imageUrl: 'https://cdn.example.com/hero.jpg',
        imageAlt: 'ساعة ذكية ليبيانا',
    },
    form: {
        submitText: 'تأكيد الطلب',
        nameField: 'الاسم الكامل',
        phoneField: 'رقم الهاتف',
        locationField: 'المدينة والعنوان',
        phoneRegex: '^09[0-9]{8}$',
        phonePlaceholder: '091 234 5678',
        nameMinLength: 3,
        locationMinLength: 5,
    },
    objections: {
        heading: 'كل ما تحتاج معرفته قبل الطلب',
        subheading: 'إجابات مباشرة على أكثر الأسئلة شيوعاً',
        items: [
            { q: 'هل المنتج أصلي؟', a: 'نعم، المنتج أصلي ومضمون' },
            { q: 'كم يستغرق التوصيل؟', a: '2-4 أيام للمدن الرئيسية' },
            { q: 'هل الدفع آمن؟', a: 'الدفع نقداً عند الاستلام' },
        ],
    },
    reviews: {
        heading: 'آراء عملائنا',
        subheading: 'تجارب حقيقية من ليبيا',
        items: [
            { name: 'أحمد من طرابلس', location: 'طرابلس', text: 'منتج رائع وتوصيل سريع', initial: 'أ' },
            { name: 'سارة من بنغازي', location: 'بنغازي', text: 'دفعت عند الاستلام بكل أريحية', initial: 'س' },
            { name: 'علي من مصراتة', location: 'مصراتة', text: 'أنصح به بشدة، جودة عالية', initial: 'ع' },
        ],
    },
    trust: {
        badges: ['الدفع عند الاستلام', 'توصيل مجاني', 'ضمان سنة'],
        row: ['دفع عند الاستلام', 'توصيل مجاني'],
    },
    business: {
        brand: 'soctiv',
        supportEmail: 'support@soctiv.ly',
        privacyEmail: 'privacy@soctiv.ly',
        country: 'ليبيا',
        phonePrefix: '+218',
        copyright: 'جميع الحقوق محفوظة',
        brandInitial: 's',
    },
    webhook: {
        url: 'https://abc.supabase.co/functions/v1/facebook-leads-webhook',
        clientCode: 'WT-LIB',
        productCode: 'WT-LIB-001',
        thankYouUrl: 'thank-you.html',
        source: 'Landing Page',
    },
    seo: {
        title: 'ساعة ذكية — الدفع عند الاستلام | soctiv',
        description: 'ساعة ذكية بسعر مميز، دفع عند الاستلام وتوصيل مجاني في كل ليبيا.',
        ogImage: 'https://cdn.example.com/og.jpg',
        ogImageAlt: 'ساعة ذكية ليبيانا',
        year: '2026',
    },
    theme: { palette: 'cream-sage', font: 'Alexandria' },
});

// ─── Replicates the `__SOCTIV_CONFIG__` injection the edge function does ─────
// Must inject BEFORE <script src="runtime.js"> so the runtime can read
// window.__SOCTIV_CONFIG__ at load time. Otherwise it crashes on
// `for (const tier of PRICING.tiers)` because the fallback tiers object
// is not iterable.

function injectConfigScript(html, config, thankYouHtml) {
    const configJson = JSON.stringify({
        product: config.product,
        pricing: {
            tiers: config.pricing?.tiers || [],
            maxQty: config.pricing?.maxQty || 5,
            discountLabel: config.pricing?.discountLabel || 'التخفيض',
        },
        form: config.form,
        webhook: config.webhook,
        tracking: { debug: !!config.tracking?.debug },
    });
    // Preview flag is now an object carrying the rendered thank-you HTML
    // so the runtime can `document.write(preview.thankYouHtml)` on a
    // successful submit and swap to the full thank-you page inside the
    // iframe (vs. an inline confirmation card). Mirrors
    // `injectConfigScript` in src/services/soctivLandingPreview.ts.
    let previewPayload;
    if (thankYouHtml) {
        const safeThankYou = JSON.stringify(thankYouHtml).replace(/<\/script>/gi, '<\\/script>');
        previewPayload = `{ thankYouHtml: ${safeThankYou} }`;
    } else {
        previewPayload = `true`;
    }
    const script = `<script>window.__SOCTIV_PREVIEW__ = ${previewPayload}; window.__SOCTIV_CONFIG__ = ${configJson};<\/script>\n`;
    if (html.includes('<script src="runtime.js"></script>')) {
        return html.replace(
            '<script src="runtime.js"></script>',
            script + '<script src="runtime.js"></script>'
        );
    }
    return html.replace('</body>', script + '</body>');
}

// ─── Test harness ───────────────────────────────────────────────────────────

const results = [];
function test(name, fn) {
    try {
        fn();
        results.push({ name, ok: true });
        process.stdout.write(`  ✓ ${name}\n`);
    } catch (err) {
        results.push({ name, ok: false, err });
        process.stdout.write(`  ✗ ${name}\n      ${err.message}\n`);
    }
}
function assertMatch(actual, pattern, label) {
    if (!pattern.test(actual)) throw new Error(`${label || 'assertMatch'} failed — pattern ${pattern}\n  in: ${actual.slice(0, 300)}`);
}
function assertNoMatch(actual, pattern, label) {
    if (pattern.test(actual)) throw new Error(`${label || 'assertNoMatch'} failed — pattern ${pattern} should not match\n  in: ${actual.slice(0, 300)}`);
}
function assertEq(actual, expected, label) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label || 'assertEq'} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function countMatches(html, regex) {
    const m = html.match(regex);
    return m ? m.length : 0;
}

// ─── Load templates + render ────────────────────────────────────────────────

console.log('\n=== Loading Soctiv templates ===\n');

const indexTpl = readFileSync(join(PUBLISH_DIR, 'template_index.html'), 'utf8');
const thankYouTpl = readFileSync(join(PUBLISH_DIR, 'template_thank_you.html'), 'utf8');
const privacyTpl = readFileSync(join(PUBLISH_DIR, 'template_privacy.html'), 'utf8');

const config = sampleConfig();
config.theme.font = fontName(config.theme);

const ctx = { ...config, __cssVars: paletteToCssVars(config.theme) };
// Stamps the edge function applies (mirrored here for parity)
config.business.copyright = config.business.copyright || `© ${new Date().getFullYear()} ${config.business.brand} — جميع الحقوق محفوظة`;

const indexHtml = injectConfigScript(renderTemplate(indexTpl, ctx), config, renderTemplate(thankYouTpl, ctx));
const thankYouHtml = injectConfigScript(renderTemplate(thankYouTpl, ctx), config);
const privacyHtml = renderTemplate(privacyTpl, ctx);

console.log(`  ✓ template_index.html loaded (${indexTpl.length} chars) → rendered ${indexHtml.length} chars`);
console.log(`  ✓ template_thank_you.html loaded (${thankYouTpl.length} chars) → rendered ${thankYouHtml.length} chars`);
console.log(`  ✓ template_privacy.html loaded (${privacyTpl.length} chars) → rendered ${privacyHtml.length} chars`);

// ─── Assertions ─────────────────────────────────────────────────────────────

console.log('\n=== Render correctness ===\n');

test('index.html: no {{placeholder}} leakage', () => {
    assertNoMatch(indexHtml, /\{\{[^}]+\}\}/, 'index has unresolved {{...}} tag');
});
test('thank-you.html: no {{placeholder}} leakage', () => {
    assertNoMatch(thankYouHtml, /\{\{[^}]+\}\}/, 'thank-you has unresolved {{...}} tag');
});
test('privacy.html: no {{placeholder}} leakage', () => {
    assertNoMatch(privacyHtml, /\{\{[^}]+\}\}/, 'privacy has unresolved {{...}} tag');
});

test('index.html: {{#each objections.items}} produces 3 blocks', () => {
    assertEq(countMatches(indexHtml, /<div class="objection">/g), 3);
});
test('index.html: {{#each reviews.items}} produces 3 blocks', () => {
    assertEq(countMatches(indexHtml, /<article class="review">/g), 3);
});
test('index.html: {{#each trust.badges}} produces 3 chips', () => {
    assertEq(countMatches(indexHtml, /<span style="background:var\(--accent-soft\)/g), 3);
});
test('index.html: {{#each trust.row}} produces 2 chips', () => {
    // The trust-row spans are inside <div class="trust-row">…</div>; count just those
    const rowMatch = indexHtml.match(/<div class="trust-row">([\s\S]*?)<\/div>/);
    if (!rowMatch) throw new Error('trust-row container missing');
    assertEq(countMatches(rowMatch[1], /<span>/g), 2);
});

test('thank-you.html: {{#each trust.row}} produces 2 chips', () => {
    const rowMatch = thankYouHtml.match(/<div class="trust">([\s\S]*?)<\/div>/);
    if (!rowMatch) throw new Error('trust container missing');
    assertEq(countMatches(rowMatch[1], /<span>/g), 2);
});

test('tracking.pixelId toggles pixel scripts (on)', () => {
    assertMatch(indexHtml, /window\.SOCTIV_TRACK_CONFIG = \{/);
    assertMatch(indexHtml, /<script src="pixel\.js"><\/script>/);
    assertMatch(indexHtml, /<script src="sha256\.js"><\/script>/);
});
test('tracking.pixelId toggles pixel scripts (off)', () => {
    const cfg = sampleConfig();
    cfg.tracking.pixelId = '';
    cfg.theme.font = fontName(cfg.theme);
    const ctx2 = { ...cfg, __cssVars: paletteToCssVars(cfg.theme) };
    const html = renderTemplate(indexTpl, ctx2);
    assertNoMatch(html, /<script src="pixel\.js"><\/script>/);
    assertNoMatch(html, /window\.SOCTIV_TRACK_CONFIG/);
});

test('{{__cssVars}} injects :root with palette tokens', () => {
    // Now wrapped in `:root { ... }` — produces valid CSS like
    //   <style>:root { --bg: #f6f3ec; --accent: #9a7e57; ... --sage: #6e8a7c; }</style>
    assertMatch(indexHtml, /<style>:root\s*\{[^}]*--bg:\s*#f6f3ec;[\s\S]*?--sage:\s*#6e8a7c;[\s\S]*?\}<\/style>/);
});

test('palette override changes --bg and --accent', () => {
    const cfg = sampleConfig();
    cfg.theme = { palette: 'sand-amber', font: 'Cairo' };
    cfg.theme.font = fontName(cfg.theme);
    const ctx2 = { ...cfg, __cssVars: paletteToCssVars(cfg.theme) };
    const html = renderTemplate(indexTpl, ctx2);
    assertMatch(html, /:root\s*\{[^}]*--bg:\s*#f5efe6;/);
    assertMatch(html, /--accent:\s*#c08a4a;/);
    // Font URL uses URL-safe name (Cairo → Cairo, IBM Plex → IBM+Plex+Sans+Arabic)
    assertMatch(html, /family=Cairo/);
});

test('OG meta is populated from seo.*', () => {
    assertMatch(indexHtml, /<meta property="og:title" content="ساعة ذكية — الدفع عند الاستلام \| soctiv" \/>/u);
    assertMatch(indexHtml, /<meta property="og:description" content="ساعة ذكية بسعر مميز، دفع عند الاستلام وتوصيل مجاني في كل ليبيا\." \/>/u);
    assertMatch(indexHtml, /<meta property="og:image" content="https:\/\/cdn\.example\.com\/og\.jpg" \/>/);
    assertMatch(indexHtml, /<meta property="og:image:alt" content="ساعة ذكية ليبيانا" \/>/u);
    assertMatch(indexHtml, /<meta property="product:price:amount" content="89" \/>/);
    assertMatch(indexHtml, /<meta property="product:price:currency" content="LYD" \/>/);
});

test('<title> is populated from seo.title', () => {
    assertMatch(indexHtml, /<title>ساعة ذكية — الدفع عند الاستلام \| soctiv<\/title>/u);
});

test('window.__SOCTIV_CONFIG__ inlined BEFORE runtime.js', () => {
    // Config must precede runtime.js so the runtime can read it at load time.
    const cfgIdx = indexHtml.indexOf('window.__SOCTIV_CONFIG__');
    const runtimeIdx = indexHtml.indexOf('<script src="runtime.js"></script>');
    if (cfgIdx === -1) throw new Error('config missing in index.html');
    if (runtimeIdx === -1) throw new Error('runtime.js missing in index.html');
    if (cfgIdx > runtimeIdx) throw new Error(`config (${cfgIdx}) AFTER runtime (${runtimeIdx})`);

    const cfgIdx2 = thankYouHtml.indexOf('window.__SOCTIV_CONFIG__');
    const runtimeIdx2 = thankYouHtml.indexOf('<script src="runtime.js"></script>');
    if (cfgIdx2 === -1) throw new Error('config missing in thank-you.html');
    if (runtimeIdx2 === -1) throw new Error('runtime.js missing in thank-you.html');
    if (cfgIdx2 > runtimeIdx2) throw new Error(`config (${cfgIdx2}) AFTER runtime (${runtimeIdx2}) in thank-you.html`);
});

test('runtime config carries the webhook URL the form will POST to', () => {
    assertMatch(indexHtml, /"url":\s*"https:\/\/abc\.supabase\.co\/functions\/v1\/facebook-leads-webhook"/);
    assertMatch(indexHtml, /"clientCode":\s*"WT-LIB"/);
    assertMatch(indexHtml, /"productCode":\s*"WT-LIB-001"/);
});

test('runtime config carries the phone regex + minLengths', () => {
    assertMatch(indexHtml, /"phoneRegex":\s*"\^09\[0-9\]\{8\}\$"/);
    assertMatch(indexHtml, /"nameMinLength":\s*3/);
    assertMatch(indexHtml, /"locationMinLength":\s*5/);
});

test('runtime config carries pricing tiers + maxQty', () => {
    assertMatch(indexHtml, /"maxQty":\s*5/);
    // Tiers are an array; check the first one's price is in the JSON
    assertMatch(indexHtml, /"quantity":\s*1,\s*"price":\s*89/);
});

test('hero CTA scrolls to #order and uses ctaText', () => {
    assertMatch(indexHtml, /<a href="#order" class="btn btn--primary btn--xl hero__cta">\s*اطلب الآن\s*<svg/);
});

test('submit button uses form.submitText', () => {
    assertMatch(indexHtml, /id="submit-btn"[^>]*>\s*تأكيد الطلب\s*<\/button>/);
});

test('order form fields use form.* labels + placeholders', () => {
    assertMatch(indexHtml, /<label class="field__label" for="f-name">الاسم الكامل<\/label>/);
    assertMatch(indexHtml, /<label class="field__label" for="f-phone">رقم الهاتف<\/label>/);
    assertMatch(indexHtml, /<label class="field__label" for="f-location">المدينة والعنوان<\/label>/);
    assertMatch(indexHtml, /placeholder="091 234 5678"/);
    assertMatch(indexHtml, /pattern="\^09\[0-9\]\{8\}\$"/);
});

test('objection items render {{q}} and {{{a}}} correctly', () => {
    // Arabic question mark `؟` (U+061F), not ASCII `?`
    assertMatch(indexHtml, /هل المنتج أصلي؟/);
    assertMatch(indexHtml, /كم يستغرق التوصيل؟/);
    assertMatch(indexHtml, /هل الدفع آمن؟/);
    // {{{a}}} is raw — <strong> tags should pass through unescaped
    assertMatch(indexHtml, /<p class="objection__a">نعم، المنتج أصلي ومضمون<\/p>/);
});

test('reviews render name + location + initial', () => {
    assertMatch(indexHtml, /<div class="review__avatar">أ<\/div>/);
    assertMatch(indexHtml, /<div class="review__name">أحمد من طرابلس<\/div>/);
    assertMatch(indexHtml, /<div class="review__loc">طرابلس<\/div>/);
});

test('trust badges use ✓ prefix', () => {
    assertMatch(indexHtml, /✓ الدفع عند الاستلام/);
    assertMatch(indexHtml, /✓ توصيل مجاني/);
    assertMatch(indexHtml, /✓ ضمان سنة/);
});

test('footer has brand + brand initial + copyright + email', () => {
    assertMatch(indexHtml, /<span class="footer__brand-mark">s<\/span>/);
    assertMatch(indexHtml, /soctiv/);
    assertMatch(indexHtml, /mailto:support@soctiv\.ly/);
    assertMatch(indexHtml, /سياسة الخصوصية والشروط/);
});

test('thank-you.html: order-id, sum-qty, sum-total slots present', () => {
    assertMatch(thankYouHtml, /id="order-id"/);
    assertMatch(thankYouHtml, /id="sum-qty"/);
    assertMatch(thankYouHtml, /id="sum-total"/);
    assertMatch(thankYouHtml, /id="sum-phone"/);
    assertMatch(thankYouHtml, /id="sum-location"/);
    assertMatch(thankYouHtml, /id="cust-name"/);
});

test('thank-you.html: Pixel + CAPI scripts (so Purchase event fires)', () => {
    assertMatch(thankYouHtml, /window\.SOCTIV_TRACK_CONFIG = \{/);
    assertMatch(thankYouHtml, /<script src="pixel\.js"><\/script>/);
    assertMatch(thankYouHtml, /<script src="sha256\.js"><\/script>/);
});

test('thank-you.html: trust row chips rendered', () => {
    assertMatch(thankYouHtml, /<span>دفع عند الاستلام<\/span>/);
    assertMatch(thankYouHtml, /<span>توصيل مجاني<\/span>/);
});

test('thank-you.html: hidden success + empty states exist', () => {
    assertMatch(thankYouHtml, /<div id="success" hidden>/);
    assertMatch(thankYouHtml, /<div class="empty" id="empty" hidden>/);
});

test('privacy.html: Meta ToS section ٧.١-٧.٦ intact', () => {
    assertMatch(privacyHtml, /٧\.١ ما الذي نجمعه عبر أدوات Meta/);
    assertMatch(privacyHtml, /٧\.٢ كيف نستخدم هذه البيانات/);
    assertMatch(privacyHtml, /٧\.٣ الأساس القانوني/);
    assertMatch(privacyHtml, /٧\.٤ كيف تتحكم في البيانات التي يجمعها Meta/);
    assertMatch(privacyHtml, /٧\.٥ نقل البيانات خارج ليبيا/);
    assertMatch(privacyHtml, /٧\.٦ مزوّد خدمة إضافي/);
});

test('privacy.html: SHA-256 disclosure present', () => {
    assertMatch(privacyHtml, /SHA-256/);
});

test('privacy.html: brand + emails substituted', () => {
    assertMatch(privacyHtml, /soctiv/);
    assertMatch(privacyHtml, /privacy@soctiv\.ly/);
    assertMatch(privacyHtml, /support@soctiv\.ly/);
});

test('Arabic copy is not HTML-escaped into entities', () => {
    // The publish function should render Arabic text as-is. If escaping
    // is wrongly applied to {{{ ... }}} slots, Arabic letters would survive
    // but punctuation would get mangled.
    assertMatch(indexHtml, /ساعة ذكية بسعر مميز/);
    assertMatch(indexHtml, /دفع عند الاستلام/);
});

test('"{{path}}" escaping protects against XSS in user-supplied hero copy', () => {
    const cfg = sampleConfig();
    cfg.hero.headline = '<script>alert("xss")</script>';
    cfg.theme.font = fontName(cfg.theme);
    const ctx2 = { ...cfg, __cssVars: paletteToCssVars(cfg.theme) };
    const html = renderTemplate(indexTpl, ctx2);
    assertMatch(html, /&lt;script&gt;alert\(&quot;xss&quot;\)&lt;\/script&gt;/);
    assertNoMatch(html, /<script>alert\("xss"\)<\/script>/);
});

test('legacy Zenon-shaped config does not blow up rendering', () => {
    // The new template simply ignores legacy keys (meta, offers, theme.colors).
    // Confirm no unresolved {{placeholder}} from those.
    const cfg = sampleConfig();
    cfg.meta = { foo: 'bar' };          // legacy leftover
    cfg.offers = [{ id: 1 }];            // legacy leftover
    cfg.theme.colors = { primary: '#000' }; // legacy leftover
    cfg.theme.font = fontName(cfg.theme);
    const ctx2 = { ...cfg, __cssVars: paletteToCssVars(cfg.theme) };
    const html = renderTemplate(indexTpl, ctx2);
    assertNoMatch(html, /\{\{[^}]+\}\}/);
});

// ─── Result summary ─────────────────────────────────────────────────────────

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
console.log(`\n${passed} passed, ${failed} failed (${results.length} total)\n`);
process.exit(failed === 0 ? 0 : 1);
