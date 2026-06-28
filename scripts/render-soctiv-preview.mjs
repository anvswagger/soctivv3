#!/usr/bin/env node
/**
 * render-soctiv-preview.mjs
 *
 * Renders the Soctiv landing-page templates with a sample Libyan COD
 * config (smart-watch funnel) and writes the full bundle to
 * `dist/soctiv-preview/preview-page/` — open `index.html` in any
 * browser to see the rendered page.
 *
 * Also writes a single-file preview to `dist/soctiv-preview/preview.html`
 * that inlines CSS + JS so it works without the sibling assets.
 *
 * Run with: `node scripts/render-soctiv-preview.mjs`
 *
 * No network, no DB, no Supabase calls. Pure local render.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CWD = process.cwd();
const PUBLISH_DIR = resolve(__dirname, '..', 'supabase', 'functions', 'publish-landing-page');
const ASSETS_SRC = join(PUBLISH_DIR, 'assets');
const OUT_DIR = join(CWD, 'dist', 'soctiv-preview');
const PAGE_DIR = join(OUT_DIR, 'preview-page');

for (const d of [OUT_DIR, PAGE_DIR]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

// ─── Templating engine (mirror of templating.ts) ────────────────────────────

const TAG_RE = /\{\{(?:#if\s+([@.\w]+)|#each\s+([@.\w]+)|else|\/if|\/each|\{([@.\w]+)\}|([@.\w]+))\}\}/g;
function getPath(ctx, p) {
    if (p === 'this') return ctx.this;
    if (p === '@index') return ctx['@index'];
    const parts = p.split('.');
    let c = ctx;
    for (const x of parts) {
        if (c && typeof c === 'object') c = c[x];
        else return undefined;
    }
    return c;
}
function isTruthy(v) {
    if (v === null || v === undefined || v === false || v === 0 || v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
}
function htmlEscape(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function findMatchingClose(tpl, from, kind) {
    const o = new RegExp(`\\{\\{#${kind}\\s+([@.\\w]+)\\}\\}`, 'g');
    const c = new RegExp(`\\{\\{/${kind}\\}\\}`, 'g');
    let d = 1, p = from;
    while (p < tpl.length && d > 0) {
        o.lastIndex = p; c.lastIndex = p;
        const nO = o.exec(tpl), nC = c.exec(tpl);
        if (!nC) return -1;
        if (nO && nO.index < nC.index) { d++; p = nO.index + nO[0].length; }
        else { d--; if (d === 0) return nC.index; p = nC.index + nC[0].length; }
    }
    return -1;
}
function findTopLevelElse(body) {
    let d = 0, p = 0;
    while (p < body.length) {
        const sub = body.slice(p);
        const oI = sub.match(/^\{\{#if\s+[@.\w]+\}\}/);
        const oE = sub.match(/^\{\{#each\s+[@.\w]+\}\}/);
        const cI = sub.match(/^\{\{\/if\}\}/);
        const cE = sub.match(/^\{\{\/each\}\}/);
        const el = sub.match(/^\{\{else\}\}/);
        if (oI || oE) { d++; p += (oI || oE)[0].length; }
        else if (cI || cE) { d--; p += (cI || cE)[0].length; }
        else if (el && d === 0) return p;
        else if (el) p += el[0].length;
        else p++;
    }
    return -1;
}
function renderTemplate(tpl, ctx) {
    let out = '', i = 0;
    while (i < tpl.length) {
        TAG_RE.lastIndex = i;
        const m = TAG_RE.exec(tpl);
        if (!m) { out += tpl.slice(i); break; }
        out += tpl.slice(i, m.index);
        if (m[1] !== undefined) {
            const cs = findMatchingClose(tpl, m.index + m[0].length, 'if');
            if (cs === -1) { out += m[0]; i = m.index + m[0].length; continue; }
            const ce = cs + '{{/if}}'.length;
            const body = tpl.slice(m.index + m[0].length, cs);
            const truthy = isTruthy(getPath(ctx, m[1]));
            const ei = findTopLevelElse(body);
            if (ei === -1) { if (truthy) out += renderTemplate(body, ctx); }
            else {
                const tb = body.slice(0, ei);
                const eb = body.slice(ei + '{{else}}'.length);
                out += truthy ? renderTemplate(tb, ctx) : renderTemplate(eb, ctx);
            }
            i = ce;
        } else if (m[2] !== undefined) {
            const cs = findMatchingClose(tpl, m.index + m[0].length, 'each');
            if (cs === -1) { out += m[0]; i = m.index + m[0].length; continue; }
            const ce = cs + '{{/each}}'.length;
            const body = tpl.slice(m.index + m[0].length, cs);
            const v = getPath(ctx, m[2]);
            if (Array.isArray(v) && v.length > 0) {
                for (let idx = 0; idx < v.length; idx++) {
                    const item = v[idx];
                    const ic = { ...ctx, ...(item && typeof item === 'object' ? item : {}), this: item, '@index': idx };
                    out += renderTemplate(body, ic);
                }
            }
            i = ce;
        } else if (m[3] !== undefined) {
            out += getPath(ctx, m[3]) == null ? '' : String(getPath(ctx, m[3]));
            i = m.index + m[0].length;
        } else if (m[4] !== undefined) {
            out += getPath(ctx, m[4]) == null ? '' : htmlEscape(String(getPath(ctx, m[4])));
            i = m.index + m[0].length;
        } else { out += m[0]; i = m.index + m[0].length; }
    }
    return out;
}

// ─── Palette + form/pricing copy (mirrors index.ts) ─────────────────────────

const SOCTIV_PALETTES = {
    'cream-sage': { '--bg': '#f6f3ec', '--surface': '#ffffff', '--surface-2': '#efeae0', '--surface-3': '#f9f6ef', '--ink': '#1f1f1c', '--ink-2': '#3a3a35', '--muted': '#7a786f', '--line': '#e9e4d8', '--line-2': '#ddd6c5', '--accent': '#9a7e57', '--accent-soft': '#ece2cd', '--sage': '#6e8a7c', '--sage-soft': '#e3ebe5', '--sage-deep': '#3f564a', '--success': '#4f7a64', '--success-bright': '#5e8c75', '--danger': '#a35a4a' },
    'ivory-teal': { '--bg': '#fafaf7', '--surface': '#ffffff', '--surface-2': '#f1efe8', '--surface-3': '#f5f3ec', '--ink': '#0f1f1f', '--ink-2': '#2a3a3a', '--muted': '#6a7878', '--line': '#e3e6e0', '--line-2': '#d0d5cd', '--accent': '#3f7a7b', '--accent-soft': '#d8e7e6', '--sage': '#3f7a7b', '--sage-soft': '#d8e7e6', '--sage-deep': '#1f4f50', '--success': '#2f6a5a', '--success-bright': '#3f8a72', '--danger': '#a35a4a' },
    'sand-amber': { '--bg': '#f5efe6', '--surface': '#ffffff', '--surface-2': '#ebe4d6', '--surface-3': '#efe9da', '--ink': '#2a1f12', '--ink-2': '#4a3a25', '--muted': '#7a6a55', '--line': '#e0d6c0', '--line-2': '#cdc1a5', '--accent': '#c08a4a', '--accent-soft': '#f0dfc0', '--sage': '#8a7a4a', '--sage-soft': '#e8e0c5', '--sage-deep': '#5a4a25', '--success': '#7a8a4a', '--success-bright': '#9aaa5a', '--danger': '#a35a3a' },
    'charcoal-mint': { '--bg': '#0f1417', '--surface': '#161c20', '--surface-2': '#1c2429', '--surface-3': '#222b30', '--ink': '#f0f3f5', '--ink-2': '#c0c8cc', '--muted': '#7a858a', '--line': '#2a3338', '--line-2': '#36403f', '--accent': '#7ce0c2', '--accent-soft': '#1c3a35', '--sage': '#7ce0c2', '--sage-soft': '#1c3a35', '--sage-deep': '#a8f0d8', '--success': '#7ce0c2', '--success-bright': '#a8f0d8', '--danger': '#ff7a6a' },
    'navy-coral': { '--bg': '#0d1825', '--surface': '#142133', '--surface-2': '#1a2a3f', '--surface-3': '#22344c', '--ink': '#f5f7fa', '--ink-2': '#c5cfd9', '--muted': '#7a8a9a', '--line': '#2a3a52', '--line-2': '#36456a', '--accent': '#ff6a5a', '--accent-soft': '#3a1f1c', '--sage': '#5a8aff', '--sage-soft': '#1c2a4a', '--sage-deep': '#a8bfff', '--success': '#5ae0a8', '--success-bright': '#7ce8c0', '--danger': '#ff6a5a' },
    'blush-bronze': { '--bg': '#faf3ee', '--surface': '#ffffff', '--surface-2': '#f5e8de', '--surface-3': '#f9ede2', '--ink': '#2a1a14', '--ink-2': '#4a3530', '--muted': '#8a6f5f', '--line': '#ead9c8', '--line-2': '#d9c0a8', '--accent': '#b8723a', '--accent-soft': '#f0dcc4', '--sage': '#a86a5a', '--sage-soft': '#f0d8d0', '--sage-deep': '#7a4a3a', '--success': '#7a9a6a', '--success-bright': '#9ab07a', '--danger': '#a85a4a' },
    'slate-violet': { '--bg': '#f4f4f8', '--surface': '#ffffff', '--surface-2': '#e8e8f0', '--surface-3': '#eeeef4', '--ink': '#1a1a2a', '--ink-2': '#3a3a4a', '--muted': '#6a6a7a', '--line': '#d8d8e0', '--line-2': '#c5c5d0', '--accent': '#6a4ae8', '--accent-soft': '#e0d8f5', '--sage': '#4a6ae8', '--sage-soft': '#d8e0f5', '--sage-deep': '#2a3aa0', '--success': '#4a8a6a', '--success-bright': '#6aaa8a', '--danger': '#a84a4a' },
    'espresso-emerald': { '--bg': '#1a120c', '--surface': '#221812', '--surface-2': '#2a1f18', '--surface-3': '#322520', '--ink': '#f5ebe0', '--ink-2': '#c5b5a0', '--muted': '#8a7a65', '--line': '#3a2a1f', '--line-2': '#4a3a2a', '--accent': '#5ae0a0', '--accent-soft': '#1c3a2a', '--sage': '#5ae0a0', '--sage-soft': '#1c3a2a', '--sage-deep': '#a8f0c5', '--success': '#5ae0a0', '--success-bright': '#a8f0c5', '--danger': '#ff7a5a' },
    'cloud-lavender': { '--bg': '#faf8fc', '--surface': '#ffffff', '--surface-2': '#f0eaf5', '--surface-3': '#f5f0fa', '--ink': '#1f1a2a', '--ink-2': '#3a3540', '--muted': '#7a7080', '--line': '#e5dceb', '--line-2': '#d0c5d8', '--accent': '#9a7ad8', '--accent-soft': '#ebdff5', '--sage': '#7a9ad8', '--sage-soft': '#dfe5f5', '--sage-deep': '#5a4a8a', '--success': '#6a9a7a', '--success-bright': '#8aaa8a', '--danger': '#a85a7a' },
    'ink-rose': { '--bg': '#0f0d12', '--surface': '#171420', '--surface-2': '#1f1a2a', '--surface-3': '#272234', '--ink': '#f5f0f5', '--ink-2': '#c5bcc5', '--muted': '#7a7080', '--line': '#2a2530', '--line-2': '#3a3540', '--accent': '#f0a8b8', '--accent-soft': '#3a2a30', '--sage': '#e0a8b8', '--sage-soft': '#3a2a30', '--sage-deep': '#f5c5d0', '--success': '#a8e0b8', '--success-bright': '#c5f0d0', '--danger': '#ff7a8a' },
};
function paletteToCssVars(theme) {
    const k = SOCTIV_PALETTES[theme?.palette] ? theme.palette : 'cream-sage';
    // Wrap in `:root { ... }` so the template `<style>{{__cssVars}}</style>`
    // produces valid CSS (without this, the result is `:root--bg: ...` which
    // is a missing-space / missing-braces CSS parse error). Emits `--font`
    // so the user's font choice is the first family in the cascade.
    const body = Object.entries(SOCTIV_PALETTES[k]).map(([k, v]) => `${k}: ${v}`).join('; ');
    return `:root { ${body}; --font: ${fontStack(theme)}; }`;
}
const FONT_MAP = {
    'Alexandria': 'Alexandria',
    'IBM Plex Sans Arabic': 'IBM+Plex+Sans+Arabic',
    'Cairo': 'Cairo',
    'Tajawal': 'Tajawal',
    'Noto Sans Arabic': 'Noto+Sans+Arabic',
    'Readex Pro': 'Readex+Pro',
    'Almarai': 'Almarai',
    'Inter': 'Inter',
};
const FONT_STACK = {
    // Alexandria uses the EXACT same stack as the home page
    // (`src/index.css:463` body rule) so the editor preview renders with
    // identical Latin/numeric glyphs and kerning. Other Arabic-first
    // fonts keep a dedicated Arabic fallback chain because their primary
    // family is Arabic-specific.
    'Alexandria': 'Alexandria, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'IBM Plex Sans Arabic': '"IBM Plex Sans Arabic", "IBM Plex Sans", system-ui, sans-serif',
    'Cairo': '"Cairo", "Segoe UI Arabic", system-ui, sans-serif',
    'Tajawal': '"Tajawal", "Segoe UI Arabic", system-ui, sans-serif',
    'Noto Sans Arabic': '"Noto Sans Arabic", "Noto Sans", "Segoe UI Arabic", system-ui, sans-serif',
    'Readex Pro': '"Readex Pro", "Segoe UI Arabic", system-ui, sans-serif',
    'Almarai': '"Almarai", "Segoe UI Arabic", system-ui, sans-serif',
    'Inter': '"Inter", "Segoe UI Arabic", system-ui, sans-serif',
};
function fontName(theme) {
    return FONT_MAP[theme?.font] || 'Alexandria';
}
function fontStack(theme) {
    return FONT_STACK[theme?.font] || FONT_STACK['Alexandria'];
}

const FORM_COPY_DEFAULTS = {
    submitText: 'تأكيد الطلب', nameField: 'الاسم الكامل', phoneField: 'رقم الهاتف',
    locationField: 'المدينة والعنوان', namePlaceholder: 'مثال: أحمد محمد',
    locationPlaceholder: 'مثال: شارع الجمهورية، طرابلس',
    phoneError: 'يرجى إدخال رقم هاتف ليبي صالح (10 أرقام يبدأ بـ 09).',
    nameError: 'يرجى إدخال الاسم الكامل.',
    locationError: 'يرجى إدخال المدينة والعنوان.',
    submittingText: 'جاري الإرسال…',
};
const PRICING_COPY_DEFAULTS = {
    stepperLabel: 'كم قطعة تريد؟', stepperAria: 'اختر الكمية',
    minusAria: 'إنقاص الكمية', plusAria: 'زيادة الكمية',
    unitLabel: 'سعر القطعة الواحدة', subtotalLabel: 'سعر القطعة',
    deliveryLabel: 'رسوم التوصيل', deliveryFree: 'مجاناً',
    discountLabel: 'التخفيض', totalLabel: 'الإجمالي الكلي',
};

// ─── Sample SoctivLandingConfig — Libyan COD smart-watch funnel ─────────────

const config = {
    product: {
        id: 'p-001',
        code: 'WT-LIB-001',
        name: 'smart-watch',
        nameArabic: 'ساعة ذكية Pro',
        category: 'إلكترونيات',
        image: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=1200&q=80',
        currency: 'LYD',
        currencySymbol: 'د.ل',
        currencyName: 'دينار ليبي',
        value: 89,
        unitPrice: 89,
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
        maxQty: 5,
        discountLabel: 'التخفيض',
    },
    tracking: {
        pixelId: '', // No pixel in preview — would interfere
        capiUrl: 'https://example.supabase.co/functions/v1/capi-proxy',
        testEventCode: '',
        debug: false,
    },
    hero: {
        headline: 'ساعة ذكية Pro — بتقنية البلوتوث واللياقة',
        subline: 'دفع عند الاستلام في كل المدن الليبية · توصيل مجاني · ضمان سنة كاملة',
        ctaText: 'اطلب الآن',
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1040&q=80',
        imageAlt: 'ساعة ذكية ليبيانا',
    },
    form: {
        submitText: 'تأكيد الطلب — الدفع عند الاستلام',
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
        subheading: 'إجابات مباشرة على أكثر الأسئلة شيوعاً من عملائنا',
        items: [
            {
                q: 'هل المنتج أصلي وبضمان؟',
                a: 'نعم، المنتج <strong>أصلي 100%</strong> ويأتي مع <strong>ضمان سنة كاملة</strong> ضد عيوب الصناعة. الشركة المصنعة معتمدة وموزعها الرسمي في ليبيا.',
            },
            {
                q: 'كم يستغرق التوصيل وهل التوصيل مجاني؟',
                a: 'التوصيل <strong>مجاني تماماً</strong> لكل المدن الليبية الرئيسية ويستغرق <strong>2-4 أيام عمل</strong>. للمدن البعيدة قد يحتاج يوماً إضافياً.',
            },
            {
                q: 'كيف يمكنني الدفع؟',
                a: '<strong>الدفع نقداً عند الاستلام فقط</strong> (COD). لا يتم خصم أي مبلغ إلكترونياً — تفحص المنتج ثم تدفع للمندوب.',
            },
        ],
    },
    reviews: {
        heading: 'ماذا يقول عملاؤنا',
        subheading: 'تجارب حقيقية من عملاء طلبوا من soctiv',
        items: [
            { name: 'أحمد من طرابلس', location: 'طرابلس', text: 'ساعة ممتازة والجودة أعلى من المتوقع. التوصيل كان سريع والمندوب محترم.', initial: 'أ' },
            { name: 'سارة من بنغازي', location: 'بنغازي', text: 'اشتريت قطعتين كهدية ودفعت عند الاستلام بكل أريحية. أنصح بالطلب.', initial: 'س' },
            { name: 'علي من مصراتة', location: 'مصراتة', text: 'سعر ممتاز مقارنة بالسوق المحلي. ميزة تتبع اللياقة والنبض دقيقة جداً.', initial: 'ع' },
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
        country: 'Libya',
        phonePrefix: '+218',
        copyright: 'جميع الحقوق محفوظة',
        brandInitial: 's',
    },
    webhook: {
        url: 'https://example.supabase.co/functions/v1/facebook-leads-webhook',
        clientCode: 'WT-LIB',
        productCode: 'WT-LIB-001',
        thankYouUrl: 'thank-you.html',
        source: 'Landing Page',
    },
    seo: {
        title: 'ساعة ذكية Pro — الدفع عند الاستلام | soctiv',
        description: 'ساعة ذكية Pro بتقنية البلوتوث واللياقة، ضمان سنة، دفع عند الاستلام في كل المدن الليبية. توصيل مجاني.',
        ogImage: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1040&q=80',
        ogImageAlt: 'ساعة ذكية ليبيانا',
        year: '2026',
    },
    theme: { palette: 'cream-sage', font: 'Alexandria' },
};

config.theme.font = fontName(config.theme);
config.form = { ...FORM_COPY_DEFAULTS, ...config.form };
config.pricing = { ...PRICING_COPY_DEFAULTS, ...config.pricing };

// Phase 5: migrate legacy `string[]` shape for trust strips to
// `{ enabled, items }` so the `{{#if}}` guards in template_index.html
// evaluate correctly. Mirrors `buildPreviewContext` in
// src/services/soctivLandingPreview.ts.
const trustStrip = (v, fallback) => {
    if (Array.isArray(v)) {
        return { enabled: true, items: v.length > 0 ? v.slice(0, 6) : fallback };
    }
    const obj = v || {};
    return {
        enabled: obj.enabled !== false,
        items: Array.isArray(obj.items) && obj.items.length > 0 ? obj.items : fallback,
    };
};
config.trust = {
    badges: trustStrip(config.trust.badges, ['الدفع عند الاستلام', 'توصيل مجاني', 'ضمان سنة']),
    row: trustStrip(config.trust.row, ['دفع عند الاستلام', 'توصيل مجاني']),
};
// Phase 5: reviews toggle (default true when undefined).
if (!config.reviews) {
    config.reviews = { enabled: true, heading: 'ماذا يقول عملاؤنا', subheading: '', items: [] };
} else {
    config.reviews = { ...config.reviews, enabled: config.reviews.enabled !== false };
}

// ─── Load templates + assets ────────────────────────────────────────────────

const indexTpl = readFileSync(join(PUBLISH_DIR, 'template_index.html'), 'utf8');
const thankYouTpl = readFileSync(join(PUBLISH_DIR, 'template_thank_you.html'), 'utf8');
const privacyTpl = readFileSync(join(PUBLISH_DIR, 'template_privacy.html'), 'utf8');
const css = readFileSync(join(PUBLISH_DIR, 'styles.css'), 'utf8');
const runtime = readFileSync(join(PUBLISH_DIR, 'client_runtime.js'), 'utf8');
const pixelJs = readFileSync(join(ASSETS_SRC, 'pixel.js'), 'utf8');
const sha256Js = readFileSync(join(ASSETS_SRC, 'sha256.js'), 'utf8');

// ─── Render + inject __SOCTIV_CONFIG__ ──────────────────────────────────────

const ctx = { ...config, __cssVars: paletteToCssVars(config.theme) };
// JSON.stringify does NOT escape `</script>` — escape any literal
// closing-tag sequence so a user-controlled string can't break out of
// the inlined <script> block. The HTML parser's raw-text script state
// treats `<\/script>` as data (not a terminator), and JSON.parse reads
// the value back correctly when the runtime consumes it.
const configJson = JSON.stringify({
    product: config.product,
    pricing: {
        tiers: config.pricing.tiers,
        maxQty: config.pricing.maxQty,
        discountLabel: config.pricing.discountLabel,
    },
    form: config.form,
    webhook: config.webhook,
    tracking: { debug: !!config.tracking.debug },
}).replace(/<\/script>/gi, '<\\/script>');

// Build the preview flag as an object containing the fully-inlined
// thank-you HTML, mirroring `injectConfigScript` in
// src/services/soctivLandingPreview.ts. The runtime swaps the iframe
// document to this HTML via `document.write` after a successful submit
// (the iframe is `about:srcdoc` and can't navigate to a sibling file).
function buildConfigScript(thankYouHtml) {
    if (!thankYouHtml) {
        return `<script>window.__SOCTIV_PREVIEW__ = true; window.__SOCTIV_CONFIG__ = ${configJson};<\/script>\n`;
    }
    // JSON.stringify escapes quotes/control chars; we additionally escape
    // `</script>` so a user-controlled string inside the embedded HTML
    // can't break out of THIS outer `<script>` block either. The HTML
    // parser's raw-text script state treats `<\/script>` as data and
    // JSON.parse reads it back correctly.
    const safeThankYou = JSON.stringify(thankYouHtml).replace(/<\/script>/gi, '<\\/script>');
    return `<script>window.__SOCTIV_PREVIEW__ = { thankYouHtml: ${safeThankYou} }; window.__SOCTIV_CONFIG__ = ${configJson};<\/script>\n`;
}

// Inject the config + preview flag IMMEDIATELY before <script src="runtime.js"></script>
// so the runtime can read both window.__SOCTIV_CONFIG__ AND window.__SOCTIV_PREVIEW__
// at load time. The preview flag tells the runtime to skip the real
// navigation to thank-you.html and swap to the embedded thank-you HTML
// instead (otherwise the iframe goes blank/BLOCKED).
function injectBeforeRuntime(html, thankYouHtml) {
    // Function-callback replacement, NOT a string. The config contains
    // user-controlled strings; if any contain `$&`, `String.replace` would
    // interpret it as "the matched substring" and leak the literal HTML
    // tag into the page body. Same fix as
    // src/services/soctivLandingPreview.ts `injectConfigScript`.
    const configScript = buildConfigScript(thankYouHtml);
    if (html.includes('<script src="runtime.js"></script>')) {
        return html.replace(
            '<script src="runtime.js"></script>',
            () => configScript + '<script src="runtime.js"></script>'
        );
    }
    return html.replace('</body>', () => configScript + '</body>');
}

// Render the thank-you page first (with assets inlined so the embedded
// copy is self-contained) and pass it into the index's preview flag.
const thankYouInlined = inlineAssets(renderTemplate(thankYouTpl, ctx), { noopPixel: true });
const indexHtml = injectBeforeRuntime(renderTemplate(indexTpl, ctx), thankYouInlined);
// Standalone multi-file copies still need the config script so the
// runtime can read __SOCTIV_CONFIG__ when opened directly in a browser.
const thankYouHtml = injectBeforeRuntime(renderTemplate(thankYouTpl, ctx), null);
const privacyHtml = renderTemplate(privacyTpl, ctx);

// ─── inlineAssets — for the single-file preview only ─────────────────────
// Mirrors `soctivLandingPreview.ts:inlineAssets()`. Inlines styles.css +
// runtime.js + pixel.js + sha256.js so the page is self-contained (no
// sibling deps). Pixel is inlined as a NOOP for the editor preview (we
// don't want real Meta calls from a preview iframe).
//
// CRITICAL: every `replace()` call uses a FUNCTION callback, not a string.
// See scripts/verify-leak-fix.mjs for the why — pixel.js source contains
// the literal `\\$&` (regex back-reference), and `String.replace` would
// interpret `$&` as "the matched substring" and leak `<script src=…>`
// into the page body. Function form short-circuits the interpretation.
function inlineAssets(html, { noopPixel = true } = {}) {
    const safeStyles = css.replace(/<\/style>/gi, '<\\/style>');
    const safeRuntime = runtime.replace(/<\/script>/gi, '<\\/script>');
    let out = html;

    out = out.replace(
        /<link rel="stylesheet" href="styles\.css"\s*\/?>/,
        () => `<style>${safeStyles}</style>`
    );

    if (noopPixel) {
        out = out.replace(
            /<script src="sha256\.js"><\/script>\s*<script src="pixel\.js"><\/script>/,
            () => `<script>/* pixel.js + sha256.js noop'd in preview */\nwindow.SOCTIV_TRACK_NOOP = true;\n<\/script>`
        );
    } else {
        const safeSha = sha256Js.replace(/<\/script>/gi, '<\\/script>');
        const safePixel = pixelJs.replace(/<\/script>/gi, '<\\/script>');
        out = out
            .replace(/<script src="sha256\.js"><\/script>/, () => `<script>${safeSha}<\/script>`)
            .replace(/<script src="pixel\.js"><\/script>/, () => `<script>${safePixel}<\/script>`);
    }

    out = out.replace(
        /<script src="runtime\.js"><\/script>/,
        () => `<script>${safeRuntime}<\/script>`
    );
    return out;
}

const inlinedIndex = inlineAssets(indexHtml, { noopPixel: true });

writeFileSync(join(PAGE_DIR, 'index.html'), indexHtml);
writeFileSync(join(PAGE_DIR, 'thank-you.html'), thankYouHtml);
writeFileSync(join(PAGE_DIR, 'privacy-policy.html'), privacyHtml);
writeFileSync(join(PAGE_DIR, 'styles.css'), css);
writeFileSync(join(PAGE_DIR, 'runtime.js'), runtime);
writeFileSync(join(PAGE_DIR, 'pixel.js'), pixelJs);
writeFileSync(join(PAGE_DIR, 'sha256.js'), sha256Js);

// ─── Verify ─────────────────────────────────────────────────────────────────

const checks = [];
function check(name, fn) {
    try { fn(); checks.push({ name, ok: true }); }
    catch (e) { checks.push({ name, ok: false, err: e.message }); }
}
function assertNo(h, p, l) { if (p.test(h)) throw new Error(`${l} leaked: ${p}`); }
function assertMatch(h, p, l) { if (!p.test(h)) throw new Error(`${l} missing: ${p}`); }
function count(h, p) { const m = h.match(p); return m ? m.length : 0; }

check('no {{...}} leakage in index.html', () => assertNo(indexHtml, /\{\{[^}]+\}\}/, 'placeholder'));
check('no {{...}} leakage in thank-you.html', () => assertNo(thankYouHtml, /\{\{[^}]+\}\}/, 'placeholder'));
check('no {{...}} leakage in privacy.html', () => assertNo(privacyHtml, /\{\{[^}]+\}\}/, 'placeholder'));
check('hero: headline + subline present', () => {
    assertMatch(indexHtml, /ساعة ذكية Pro/, 'headline');
    assertMatch(indexHtml, /دفع عند الاستلام في كل المدن/, 'subline');
});
check('hero: CTA scrolls to #order', () => assertMatch(indexHtml, /href="#order"/, 'CTA'));
check('order form: 3 fields', () => {
    assertMatch(indexHtml, /id="f-name"/, 'name');
    assertMatch(indexHtml, /id="f-phone"/, 'phone');
    assertMatch(indexHtml, /id="f-location"/, 'location');
});
check('phone regex pattern', () => assertMatch(indexHtml, /pattern="\^09\[0-9\]\{8\}\$"/, 'pattern'));
check('exactly 3 objections', () => {
    const n = count(indexHtml, /<div class="objection">/g);
    if (n !== 3) throw new Error(`expected 3, got ${n}`);
});
check('{{{a}}} raw output: <strong> tags preserved', () =>
    assertMatch(indexHtml, /<p class="objection__a">نعم، المنتج <strong>أصلي 100%<\/strong>/, 'strong'));
check('exactly 3 reviews', () => {
    const n = count(indexHtml, /<article class="review">/g);
    if (n !== 3) throw new Error(`expected 3, got ${n}`);
});
check('Arabic initials present', () => {
    assertMatch(indexHtml, /<div class="review__avatar">أ<\/div>/, 'initial أحمد');
    assertMatch(indexHtml, /<div class="review__avatar">س<\/div>/, 'initial سارة');
    assertMatch(indexHtml, /<div class="review__avatar">ع<\/div>/, 'initial علي');
});
check('3 trust badges', () => {
    const n = count(indexHtml, /<span style="background:var\(--accent-soft\)/g);
    if (n !== 3) throw new Error(`expected 3 badges, got ${n}`);
});
check('OG meta populated', () => {
    assertMatch(indexHtml, /<meta property="og:title" content="ساعة ذكية Pro/, 'og:title');
    assertMatch(indexHtml, /<meta property="og:image" content="https:\/\/images\.unsplash\.com\/photo-1523275335684/, 'og:image');
});
check('palette vars injected', () => assertMatch(indexHtml, /<style>:root\s*\{[^}]*--bg:\s*#f6f3ec/, 'palette'));
check('--font emitted with user-selected family first', () => {
    // The :root block must include --font and the first family must be
    // the user's pick (Alexandria in this config). Before the fix, the
    // hardcoded stack in styles.css always won on cascade so this string
    // was missing from the rendered output entirely. The home-page stack
    // (see src/index.css:463) does not quote "Alexandria" — it relies on
    // bare-word family names — so the assertion is just a presence check
    // for the family name in the first slot of the stack.
    assertMatch(indexHtml, /--font:[^;]*\bAlexandria\b/, '--font with Alexandria');
});
check('all 10 palettes defined', () => {
    const expected = ['cream-sage','ivory-teal','sand-amber','charcoal-mint','navy-coral','blush-bronze','slate-violet','espresso-emerald','cloud-lavender','ink-rose'];
    for (const p of expected) {
        if (!SOCTIV_PALETTES[p]) throw new Error(`palette missing: ${p}`);
        if (Object.keys(SOCTIV_PALETTES[p]).length < 17) {
            throw new Error(`palette ${p} has ${Object.keys(SOCTIV_PALETTES[p]).length} tokens, expected ≥17`);
        }
    }
});
check('all 8 fonts defined', () => {
    const expected = ['Alexandria','IBM Plex Sans Arabic','Cairo','Tajawal','Noto Sans Arabic','Readex Pro','Almarai','Inter'];
    for (const f of expected) {
        if (!FONT_MAP[f]) throw new Error(`FONT_MAP missing: ${f}`);
        if (!FONT_STACK[f]) throw new Error(`FONT_STACK missing: ${f}`);
    }
});
check('__SOCTIV_CONFIG__ inlined before runtime.js', () =>
    assertMatch(indexHtml, /window\.__SOCTIV_CONFIG__ = \{[\s\S]+?\};<\/script>\s*<script src="runtime\.js"><\/script>/, 'config'));

check('__SOCTIV_PREVIEW__ flag set as object with thankYouHtml', () =>
    assertMatch(indexHtml, /window\.__SOCTIV_PREVIEW__\s*=\s*\{\s*thankYouHtml:/, 'preview flag object'));
check('__SOCTIV_PREVIEW__.thankYouHtml contains success block markers', () => {
    // The embedded copy is JSON-escaped inside the <script> string, so
    // quotes appear as \". Assert against the inlined thank-you HTML
    // directly (before JSON serialization) — that's the source of truth.
    assertMatch(thankYouInlined, /<div id="success" hidden>/, 'success block in inlined thank-you');
    assertMatch(thankYouInlined, /id="cust-name"/, 'cust-name in inlined thank-you');
});
check('runtime.js script tag', () => assertMatch(indexHtml, /<script src="runtime\.js"><\/script>/, 'runtime.js'));
check('thank-you: success + empty states', () => {
    assertMatch(thankYouHtml, /<div id="success" hidden>/, 'success');
    assertMatch(thankYouHtml, /<div class="empty" id="empty" hidden>/, 'empty');
});
check('privacy: Meta ToS section 7.x intact', () => {
    assertMatch(privacyHtml, /٧\.١ ما الذي نجمعه/, '7.1');
    assertMatch(privacyHtml, /٧\.٦ مزوّد خدمة/, '7.6');
});

const passed = checks.filter(c => c.ok).length;
const failed = checks.length - passed;
console.log(`\n=== Soctiv preview render ===\n`);
console.log(`  ✓ index.html        ${String(indexHtml.length).padStart(6)} bytes`);
console.log(`  ✓ thank-you.html    ${String(thankYouHtml.length).padStart(6)} bytes`);
console.log(`  ✓ privacy-policy    ${String(privacyHtml.length).padStart(6)} bytes`);
console.log(`  ✓ styles.css        ${String(css.length).padStart(6)} bytes`);
console.log(`  ✓ runtime.js        ${String(runtime.length).padStart(6)} bytes`);
console.log(`  ✓ pixel.js          ${String(pixelJs.length).padStart(6)} bytes`);
console.log(`  ✓ sha256.js         ${String(sha256Js.length).padStart(6)} bytes`);
console.log(`\n=== Verification ===`);
console.log(`  ${passed}/${checks.length} checks passed${failed ? `, ${failed} failed` : ''}\n`);

if (failed > 0) {
    for (const c of checks.filter(c => !c.ok)) {
        console.log(`  ✗ ${c.name}\n      ${c.err}`);
    }
    process.exit(1);
}

console.log(`  Bundle written to: ${PAGE_DIR}`);
console.log(`    Open: index.html  (multi-file with pixel + sha256 runtime)`);
console.log(`    Open: thank-you.html  (post-order confirmation)`);
console.log(`    Open: privacy-policy.html  (Meta ToS disclosure)\n`);

// ─── Single-file self-contained preview ─────────────────────────────────────
// Inlines CSS + JS so it works from one HTML file with no sibling deps.
// Useful for sharing via Slack/email or opening directly from the editor.
//
// Defense-in-depth: escape `</style>` inside the inlined CSS (even in
// comments) to prevent the raw-text scan in <style> from terminating
// prematurely and leaking the rest of the CSS into the page body.

const safeCss = css.replace(/<\/style>/gi, '<\\/style>');
const safeRuntime = runtime.replace(/<\/script>/gi, '<\\/script>');

const singleFile = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>Soctiv landing page — single-file preview</title>
<style>${safeCss}</style>
<style>${paletteToCssVars(config.theme)}</style>
<script>
window.__SOCTIV_CONFIG__ = ${configJson};
</script>
</head>
<body>
${inlinedIndex.slice(inlinedIndex.indexOf('<body>') + 6, inlinedIndex.lastIndexOf('</body>'))}
</body>
</html>`;
writeFileSync(join(OUT_DIR, 'preview.html'), singleFile);
console.log(`  Single-file preview: ${join(OUT_DIR, 'preview.html')} (${singleFile.length} bytes)`);
console.log(`\nTo view: open the path above in your browser, or run:`);
console.log(`    start "" "${join(PAGE_DIR, 'index.html').replace(/\\/g, '\\\\')}"`);
console.log(`    explorer "${OUT_DIR}"\n`);
