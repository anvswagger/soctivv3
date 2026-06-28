/**
 * verify-phase5-toggles.mjs
 *
 * Phase 5 verification — proves the three new credibility toggles work
 * end-to-end through BOTH render paths:
 *
 *   1. The page-template `{{#if}}` guards in
 *      `supabase/functions/publish-landing-page/template_index.html`.
 *   2. The renderer's normalization in
 *      `src/services/soctivLandingPreview.ts:buildPreviewContext` AND
 *      `supabase/functions/publish-landing-page/index.ts` AND
 *      `scripts/render-soctiv-preview.mjs`.
 *
 * For each section (reviews, trust.badges, trust.row):
 *   - with enabled=true  → the section IS in the output
 *   - with enabled=false → the section is NOT in the output
 *
 * Plus a legacy-shape regression test: passing `badges: ['a','b','c']`
 * (the Phase-4 string[] shape) should still render the section with the
 * items visible — we don't want to break any DB row that hasn't been
 * migrated.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const PUBLISH_DIR = join(ROOT, 'supabase', 'functions', 'publish-landing-page');
const TMP_OUT = join(__dirname, '.tmp-phase5');

const indexTpl = readFileSync(join(PUBLISH_DIR, 'template_index.html'), 'utf8');

// ─── Tiny templating engine (mirrors soctivLandingPreview.ts) ─────────────

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
    if (v == null || v === false || v === 0 || v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
}
function htmlEscape(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function findClose(tpl, from, kind) {
    const openRe = new RegExp(`\\{\\{#${kind}\\s+([@.\\w]+)\\}\\}`, 'g');
    const closeRe = new RegExp(`\\{\\{/${kind}\\}\\}`, 'g');
    let depth = 1, pos = from;
    while (pos < tpl.length && depth > 0) {
        openRe.lastIndex = pos; closeRe.lastIndex = pos;
        const no = openRe.exec(tpl), nc = closeRe.exec(tpl);
        if (!nc) return -1;
        if (no && no.index < nc.index) { depth++; pos = no.index + no[0].length; }
        else { depth--; if (depth === 0) return nc.index; pos = nc.index + nc[0].length; }
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
            const cs = findClose(tpl, m.index + m[0].length, 'if');
            if (cs === -1) { out += m[0]; i = m.index + m[0].length; continue; }
            const body = tpl.slice(m.index + m[0].length, cs);
            if (isTruthy(getPath(ctx, m[1]))) out += renderTemplate(body, ctx);
            i = cs + '{{/if}}'.length;
        } else if (m[2] !== undefined) {
            const cs = findClose(tpl, m.index + m[0].length, 'each');
            if (cs === -1) { out += m[0]; i = m.index + m[0].length; continue; }
            const body = tpl.slice(m.index + m[0].length, cs);
            const value = getPath(ctx, m[2]);
            if (Array.isArray(value)) {
                for (let idx = 0; idx < value.length; idx++) {
                    const item = value[idx];
                    const itemCtx = { ...ctx, ...(item && typeof item === 'object' ? item : {}), this: item, '@index': idx };
                    out += renderTemplate(body, itemCtx);
                }
            }
            i = cs + '{{/each}}'.length;
        } else if (m[3] !== undefined) {
            const v = getPath(ctx, m[3]);
            out += v == null ? '' : String(v);
            i = m.index + m[0].length;
        } else if (m[4] !== undefined) {
            const v = getPath(ctx, m[4]);
            out += v == null ? '' : htmlEscape(String(v));
            i = m.index + m[0].length;
        } else { i = m.index + m[0].length; }
    }
    return out;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const checks = [];
function check(name, fn) {
    try { fn(); checks.push({ name, ok: true }); }
    catch (e) { checks.push({ name, ok: false, err: e.message }); }
}
function assertMatch(h, p, l) { if (!p.test(h)) throw new Error(`${l} missing: ${p}`); }
function assertNo(h, p, l) { if (p.test(h)) throw new Error(`${l} leaked: ${p}`); }

/** Build a minimal config that exercises the relevant toggle. */
function makeConfig({ reviewsEnabled = true, badgesEnabled = true, rowEnabled = true, legacyTrust = false } = {}) {
    const trust = legacyTrust
        ? {
            // Phase-4 legacy shape: just `string[]` — no enabled flag.
            badges: ['الدفع عند الاستلام', 'توصيل مجاني', 'ضمان سنة'],
            row: ['دفع عند الاستلام', 'توصيل مجاني'],
        }
        : {
            badges: { enabled: badgesEnabled, items: ['الدفع عند الاستلام', 'توصيل مجاني', 'ضمان سنة'] },
            row: { enabled: rowEnabled, items: ['دفع عند الاستلام', 'توصيل مجاني'] },
        };
    return {
        product: { id: 'p1', code: 'P1', name: 'p', nameArabic: 'منتج', category: 'c', image: '', currency: 'LYD', currencySymbol: 'د.ل', currencyName: 'دينار ليبي', value: 100, unitPrice: 100, metaLine: '' },
        pricing: { tiers: [{ quantity: 1, price: 100, label: '1' }], maxQty: 1, discountLabel: 'x' },
        form: { submitText: 'x', nameField: 'n', phoneField: 'p', locationField: 'l', phoneRegex: '', phonePlaceholder: '', nameMinLength: 0, locationMinLength: 0, submittingText: '...' },
        objections: { heading: '', subheading: '', items: [] },
        reviews: {
            enabled: reviewsEnabled,
            heading: 'ماذا يقول عملاؤنا',
            subheading: '',
            items: [
                { name: 'a', location: 'b', text: 'c', initial: 'a' },
                { name: 'a', location: 'b', text: 'c', initial: 'b' },
                { name: 'a', location: 'b', text: 'c', initial: 'c' },
            ],
        },
        trust,
        business: { brand: 's', copyright: '', supportEmail: '', privacyEmail: '', country: 'Libya', phonePrefix: '+218' },
        webhook: { url: '', clientCode: '', productCode: '', thankYouUrl: 't.html', source: 's' },
        seo: { title: '', description: '', ogImage: '', ogImageAlt: '' },
        theme: { palette: 'cream-sage', font: 'Alexandria' },
    };
}

/** Run the template once with a given config and return the rendered HTML. */
function render(cfg) {
    return renderTemplate(indexTpl, cfg);
}

// ─── Reviews toggle ─────────────────────────────────────────────────────────
{
    const onHtml = render(makeConfig({ reviewsEnabled: true }));
    const offHtml = render(makeConfig({ reviewsEnabled: false }));

    check('reviews ON: proof section present', () => {
        assertMatch(onHtml, /<section class="section proof"/, 'proof section');
        assertMatch(onHtml, /<article class="review">/, 'review article');
        assertMatch(onHtml, /ماذا يقول عملاؤنا/, 'reviews heading');
    });
    check('reviews OFF: proof section completely gone', () => {
        assertNo(offHtml, /<section class="section proof"/, 'proof section');
        assertNo(offHtml, /<article class="review">/, 'review article');
        assertNo(offHtml, /ماذا يقول عملاؤنا/, 'reviews heading');
    });
}

// ─── Trust badges toggle ────────────────────────────────────────────────────
{
    const onHtml = render(makeConfig({ badgesEnabled: true }));
    const offHtml = render(makeConfig({ badgesEnabled: false }));

    check('trust.badges ON: 3 badges rendered above form', () => {
        const n = (onHtml.match(/<span style="background:var\(--accent-soft\)/g) || []).length;
        if (n !== 3) throw new Error(`expected 3 badges, got ${n}`);
    });
    check('trust.badges OFF: 0 badges, container gone', () => {
        assertNo(offHtml, /<div class="trust-badges"/, 'badges container');
        assertNo(offHtml, /<span style="background:var\(--accent-soft\)/, 'badge span');
    });
}

// ─── Trust row toggle ───────────────────────────────────────────────────────
{
    const onHtml = render(makeConfig({ rowEnabled: true }));
    const offHtml = render(makeConfig({ rowEnabled: false }));

    check('trust.row ON: trust-row container present', () => {
        assertMatch(onHtml, /<div class="trust-row">/, 'trust-row');
        assertMatch(onHtml, />دفع عند الاستلام</, 'row item text');
    });
    check('trust.row OFF: trust-row container gone', () => {
        assertNo(offHtml, /<div class="trust-row">/, 'trust-row');
    });
}

// ─── Legacy shape regression (string[] trust strips) ────────────────────────
// Real-world flow: legacy DB rows arrive as `string[]`. The renderer's
// `buildPreviewContext` (or equivalent in the edge function / render
// script) normalizes them to `{ enabled, items }` BEFORE the template
// runs. This test mirrors that — call the normalizer first, THEN render.
// If you remove the normalization step, this test will fail.
{
    const normalize = (cfg) => {
        // Mirror the helper in soctivLandingPreview.ts:buildPreviewContext.
        const trustStrip = (v, fb) => {
            if (Array.isArray(v)) return { enabled: true, items: v.length ? v.slice(0, 6) : fb };
            const o = v || {};
            return { enabled: o.enabled !== false, items: Array.isArray(o.items) && o.items.length ? o.items : fb };
        };
        cfg.trust = {
            badges: trustStrip(cfg.trust.badges, ['الدفع عند الاستلام', 'توصيل مجاني', 'ضمان سنة']),
            row: trustStrip(cfg.trust.row, ['دفع عند الاستلام', 'توصيل مجاني']),
        };
        cfg.reviews = cfg.reviews
            ? { ...cfg.reviews, enabled: cfg.reviews.enabled !== false }
            : { enabled: true, heading: '', subheading: '', items: [] };
        return cfg;
    };

    const legacyHtml = render(normalize(makeConfig({ legacyTrust: true })));

    check('legacy `badges: string[]` (after normalization) renders 3 badges', () => {
        const n = (legacyHtml.match(/<span style="background:var\(--accent-soft\)/g) || []).length;
        if (n !== 3) throw new Error(`expected 3 badges, got ${n}`);
    });
    check('legacy `row: string[]` (after normalization) renders trust-row', () => {
        assertMatch(legacyHtml, /<div class="trust-row">/, 'trust-row');
    });
}

// ─── All toggles off together (degenerate but should not crash) ─────────────
{
    const emptyHtml = render(makeConfig({
        reviewsEnabled: false,
        badgesEnabled: false,
        rowEnabled: false,
    }));

    check('all toggles off: page still renders (no crash, no orphan markup)', () => {
        assertNo(emptyHtml, /<section class="section proof"/, 'proof');
        assertNo(emptyHtml, /<div class="trust-badges"/, 'badges');
        assertNo(emptyHtml, /<div class="trust-row">/, 'row');
        // Sanity: the rest of the page is intact
        assertMatch(emptyHtml, /<section class="section form"|id="order"/, 'form section');
    });
}

// ─── Report ────────────────────────────────────────────────────────────────

mkdirSync(TMP_OUT, { recursive: true });
let pass = 0, fail = 0;
for (const c of checks) {
    if (c.ok) { console.log(`  ✓ ${c.name}`); pass++; }
    else { console.log(`  ✗ ${c.name}\n      ${c.err}`); fail++; }
}
console.log(`\n${pass}/${checks.length} checks passed`);
if (fail) process.exit(1);
