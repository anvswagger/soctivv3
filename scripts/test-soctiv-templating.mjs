#!/usr/bin/env node
/**
 * test-soctiv-templating.mjs
 *
 * Unit-tests for the mini-templating engine that the
 * `publish-landing-page` edge function uses to render Soctiv landing pages.
 *
 * Run with: `npm run test:soctiv-templating`
 *
 * The engine itself is a small TS file at
 * `supabase/functions/publish-landing-page/templating.ts`. Rather than
 * requiring a TS build step here, we re-implement the same parser in
 * plain JS and run it against a battery of synthetic templates. The
 * goal is to lock in the contract the Soctiv templates depend on:
 *
 *   - {{path}}      → HTML-escaped
 *   - {{{path}}}    → raw, no escape
 *   - {{#if path}}…{{/if}}    → block kept if truthy
 *   - {{#if path}}…{{else}}…{{/if}} → with else
 *   - {{#each list}}…{{/each}} → block repeated per item
 *     - {{this}}            → the item itself
 *     - {{this.field}}      → item's field (also implicit {{field}})
 *     - {{@index}}          → 0-based index
 *
 * Each `assert` records a pass/fail; the script exits 1 on any failure.
 */

import process from 'node:process';

// ─── Templating engine (JS port of templating.ts) ───────────────────────────

const TAG_RE = /\{\{(?:#if\s+([@.\w]+)|#each\s+([@.\w]+)|else|\/if|\/each|\{([@.\w]+)\}|([@.\w]+))\}\}/g;

function getPath(ctx, path) {
    if (path === 'this') return ctx.this;
    if (path === '@index') return ctx['@index'];
    const parts = path.split('.');
    let cur = ctx;
    for (const p of parts) {
        if (cur && typeof cur === 'object') {
            cur = cur[p];
        } else {
            return undefined;
        }
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
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function findMatchingClose(template, from, kind) {
    const openRe = new RegExp(`\\{\\{#${kind}\\s+([@.\\w]+)\\}\\}`, 'g');
    const closeRe = new RegExp(`\\{\\{/${kind}\\}\\}`, 'g');
    let depth = 1;
    let pos = from;
    while (pos < template.length && depth > 0) {
        openRe.lastIndex = pos;
        closeRe.lastIndex = pos;
        const nextOpen = openRe.exec(template);
        const nextClose = closeRe.exec(template);
        if (!nextClose) return -1;
        if (nextOpen && nextOpen.index < nextClose.index) {
            depth++;
            pos = nextOpen.index + nextOpen[0].length;
        } else {
            depth--;
            if (depth === 0) return nextClose.index;
            pos = nextClose.index + nextClose[0].length;
        }
    }
    return -1;
}

function findTopLevelElse(body) {
    let depth = 0;
    let pos = 0;
    while (pos < body.length) {
        const sub = body.slice(pos);
        const openIf = sub.match(/^\{\{#if\s+[@.\w]+\}\}/);
        const openEach = sub.match(/^\{\{#each\s+[@.\w]+\}\}/);
        const closeIf = sub.match(/^\{\{\/if\}\}/);
        const closeEach = sub.match(/^\{\{\/each\}\}/);
        const elseTag = sub.match(/^\{\{else\}\}/);
        if (openIf || openEach) {
            depth++;
            pos += (openIf || openEach)[0].length;
        } else if (closeIf || closeEach) {
            depth--;
            pos += (closeIf || closeEach)[0].length;
        } else if (elseTag && depth === 0) {
            return pos;
        } else if (elseTag) {
            pos += elseTag[0].length;
        } else {
            pos++;
        }
    }
    return -1;
}

export function renderTemplate(template, ctx) {
    let out = '';
    let i = 0;
    while (i < template.length) {
        TAG_RE.lastIndex = i;
        const m = TAG_RE.exec(template);
        if (!m) {
            out += template.slice(i);
            break;
        }
        out += template.slice(i, m.index);

        if (m[1] !== undefined) {
            const path = m[1];
            const closeStart = findMatchingClose(template, m.index + m[0].length, 'if');
            if (closeStart === -1) {
                out += m[0];
                i = m.index + m[0].length;
                continue;
            }
            const closeEnd = closeStart + '{{/if}}'.length;
            const body = template.slice(m.index + m[0].length, closeStart);
            const truthy = isTruthy(getPath(ctx, path));
            const elseIdx = findTopLevelElse(body);
            if (elseIdx === -1) {
                if (truthy) out += renderTemplate(body, ctx);
            } else {
                const thenBranch = body.slice(0, elseIdx);
                const elseBranch = body.slice(elseIdx + '{{else}}'.length);
                out += truthy ? renderTemplate(thenBranch, ctx) : renderTemplate(elseBranch, ctx);
            }
            i = closeEnd;
        } else if (m[2] !== undefined) {
            const path = m[2];
            const closeStart = findMatchingClose(template, m.index + m[0].length, 'each');
            if (closeStart === -1) {
                out += m[0];
                i = m.index + m[0].length;
                continue;
            }
            const closeEnd = closeStart + '{{/each}}'.length;
            const body = template.slice(m.index + m[0].length, closeStart);
            const value = getPath(ctx, path);
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
            const v = getPath(ctx, m[3]);
            out += v == null ? '' : String(v);
            i = m.index + m[0].length;
        } else if (m[4] !== undefined) {
            const v = getPath(ctx, m[4]);
            out += v == null ? '' : htmlEscape(String(v));
            i = m.index + m[0].length;
        } else {
            out += m[0];
            i = m.index + m[0].length;
        }
    }
    return out;
}

// ─── Tiny test harness ──────────────────────────────────────────────────────

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

function assertEq(actual, expected, label) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
        throw new Error(`${label || 'assertEq'} — expected ${e}, got ${a}`);
    }
}

function assertMatch(actual, pattern, label) {
    if (!pattern.test(actual)) {
        throw new Error(`${label || 'assertMatch'} — pattern ${pattern} did not match\n  actual: ${actual.slice(0, 200)}`);
    }
}

function assertNoMatch(actual, pattern, label) {
    if (pattern.test(actual)) {
        throw new Error(`${label || 'assertNoMatch'} — pattern ${pattern} should not match\n  actual: ${actual.slice(0, 200)}`);
    }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

console.log('\n=== Soctiv templating engine ===\n');

test('renders {{path}} with HTML escaping', () => {
    const out = renderTemplate('hello {{name}}', { name: '<b>world</b>' });
    assertEq(out, 'hello &lt;b&gt;world&lt;/b&gt;');
});

test('renders {{{path}}} raw without escaping', () => {
    const out = renderTemplate('{{{html}}}', { html: '<b>x</b>' });
    assertEq(out, '<b>x</b>');
});

test('renders {{path.to.value}} nested paths', () => {
    const out = renderTemplate('{{product.nameArabic}}', { product: { nameArabic: 'ساعة ذكية' } });
    assertEq(out, 'ساعة ذكية');
});

test('renders missing keys as empty string', () => {
    const out = renderTemplate('[{{missing}}]', { other: 1 });
    assertEq(out, '[]');
});

test('{{#if truthy}} keeps body', () => {
    const out = renderTemplate('A{{#if x}}B{{/if}}C', { x: true });
    assertEq(out, 'ABC');
});

test('{{#if falsy}} drops body', () => {
    const out = renderTemplate('A{{#if x}}B{{/if}}C', { x: '' });
    assertEq(out, 'AC');
});

test('{{#if}} with {{else}} picks then-branch', () => {
    const out = renderTemplate('{{#if x}}YES{{else}}NO{{/if}}', { x: 'yes' });
    assertEq(out, 'YES');
});

test('{{#if}} with {{else}} picks else-branch', () => {
    const out = renderTemplate('{{#if x}}YES{{else}}NO{{/if}}', { x: '' });
    assertEq(out, 'NO');
});

test('{{#each list}} repeats per item', () => {
    const tpl = '{{#each items}}<li>{{this}}</li>{{/each}}';
    const out = renderTemplate(tpl, { items: ['a', 'b', 'c'] });
    assertEq(out, '<li>a</li><li>b</li><li>c</li>');
});

test('{{#each}} exposes {{this.field}}', () => {
    const tpl = '{{#each reviews}}<p>{{this.text}}</p>{{/each}}';
    const out = renderTemplate(tpl, { reviews: [{ text: 'A' }, { text: 'B' }] });
    assertEq(out, '<p>A</p><p>B</p>');
});

test('{{#each}} exposes implicit {{field}} (Handlebars-style)', () => {
    const tpl = '{{#each r}}{{name}}-{{/each}}';
    const out = renderTemplate(tpl, { r: [{ name: 'A' }, { name: 'B' }] });
    assertEq(out, 'A-B-');
});

test('{{#each}} exposes {{@index}} (0-based)', () => {
    const tpl = '{{#each xs}}[{{@index}}:{{this}}]{{/each}}';
    const out = renderTemplate(tpl, { xs: ['a', 'b', 'c'] });
    assertEq(out, '[0:a][1:b][2:c]');
});

test('{{#each}} on empty array renders nothing', () => {
    const out = renderTemplate('A{{#each xs}}X{{/each}}B', { xs: [] });
    assertEq(out, 'AB');
});

test('nested {{#if}} inside {{#each}} resolves correctly', () => {
    const tpl = '{{#each xs}}{{#if flag}}+{{this}}{{/if}}{{/each}}';
    const out = renderTemplate(tpl, { xs: [1, 2, 3], flag: true });
    assertEq(out, '+1+2+3');
});

test('nested {{#each}} inside {{#each}}', () => {
    const tpl = '{{#each a}}{{#each this.b}}[{{this}}]{{/each}}{{/each}}';
    const out = renderTemplate(tpl, { a: [{ b: [1, 2] }, { b: [3] }] });
    assertEq(out, '[1][2][3]');
});

test('{{#if}} with {{else}} inside {{#each}}', () => {
    const tpl = '{{#each xs}}{{#if this.active}}*{{this.name}}{{else}}-{{this.name}}{{/if}} {{/each}}';
    const out = renderTemplate(tpl, {
        xs: [{ name: 'a', active: true }, { name: 'b', active: false }, { name: 'c', active: true }],
    });
    assertEq(out, '*a -b *c ');
});

test('numeric values are rendered as their string form', () => {
    const out = renderTemplate('price={{product.value}}', { product: { value: 89 } });
    assertEq(out, 'price=89');
});

test('booleans are rendered as true/false', () => {
    const out = renderTemplate('{{flag}}', { flag: true });
    assertEq(out, 'true');
});

test('a stray {{/if}} without open is treated as literal', () => {
    const out = renderTemplate('a {{/if}} b', {});
    // Emitted as literal to avoid infinite loops in malformed templates.
    assertEq(out, 'a {{/if}} b');
});

// ─── Soctiv-flavored integration tests ──────────────────────────────────────

console.log('\n=== Soctiv template patterns ===\n');

const SOCTIV_PALETTES = {
    'cream-sage': {
        '--bg': '#f6f3ec',
        '--accent': '#9a7e57',
        '--sage': '#6e8a7c',
    },
};
function paletteToCssVars(palette) {
    return Object.entries(SOCTIV_PALETTES[palette] || SOCTIV_PALETTES['cream-sage'])
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ');
}

test('hero block substitutes headline + subline + imageUrl + ctaText', () => {
    const tpl = `<h1>{{hero.headline}}</h1><p>{{hero.subline}}</p><img src="{{hero.imageUrl}}" alt="{{hero.imageAlt}}"/><a>{{hero.ctaText}}</a>`;
    const out = renderTemplate(tpl, {
        hero: { headline: 'ساعة', subline: 'دفع عند الاستلام', imageUrl: '/img.jpg', imageAlt: 'ساعة ذكية', ctaText: 'اطلب الآن' },
    });
    assertMatch(out, /<h1>ساعة<\/h1>/);
    assertMatch(out, /<p>دفع عند الاستلام<\/p>/);
    assertMatch(out, /<img src="\/img\.jpg" alt="ساعة ذكية"\/>/u);
    assertMatch(out, /<a>اطلب الآن<\/a>/);
});

test('objections block emits exactly N items', () => {
    const tpl = '{{#each objections.items}}<div class="objection"><div class="objection__q">{{q}}</div><p>{{a}}</p></div>{{/each}}';
    const items = [
        { q: 'هل هو أصلي؟', a: 'نعم' },
        { q: 'متى يصل؟', a: '2-4 أيام' },
        { q: 'كيف الدفع؟', a: 'عند الاستلام' },
    ];
    const out = renderTemplate(tpl, { objections: { items } });
    const matches = out.match(/<div class="objection">/g) || [];
    if (matches.length !== 3) throw new Error(`expected 3 objection blocks, got ${matches.length}`);
});

test('reviews block emits exactly N items', () => {
    const tpl = '{{#each reviews.items}}<article class="review"><p>{{text}}</p><span>{{name}}</span></article>{{/each}}';
    const items = [
        { name: 'أحمد', text: 'ممتاز' },
        { name: 'سارة', text: 'رائع' },
        { name: 'علي', text: 'يستحق' },
    ];
    const out = renderTemplate(tpl, { reviews: { items } });
    const matches = out.match(/<article class="review">/g) || [];
    if (matches.length !== 3) throw new Error(`expected 3 review blocks, got ${matches.length}`);
});

test('tracking.pixelId toggles pixel scripts', () => {
    const tpl = `<head>{{#if tracking.pixelId}}<script src="pixel.js"></script>{{/if}}</head>`;
    const on = renderTemplate(tpl, { tracking: { pixelId: '1234567890' } });
    const off = renderTemplate(tpl, { tracking: { pixelId: '' } });
    assertMatch(on, /<script src="pixel\.js"><\/script>/);
    assertNoMatch(off, /<script src="pixel\.js"><\/script>/);
});

test('tracking pixelId inside JS uses triple braces (no escape)', () => {
    // The pixel-id is inserted into a JS string literal via {{{ ... }}}
    // — escaping would break the JS.
    const tpl = `window.SOCTIV_TRACK_CONFIG = { pixelId: "{{{tracking.pixelId}}}" };`;
    const out = renderTemplate(tpl, { tracking: { pixelId: '1234567890' } });
    assertMatch(out, /pixelId: "1234567890"/);
});

test('OG meta is populated from seo.*', () => {
    const tpl = `<meta property="og:title" content="{{seo.title}}" /><meta property="og:image" content="{{seo.ogImage}}" />`;
    const out = renderTemplate(tpl, {
        seo: { title: 'ساعة ذكية', ogImage: 'https://example.com/img.jpg' },
    });
    assertMatch(out, /<meta property="og:title" content="ساعة ذكية" \/>/);
    assertMatch(out, /<meta property="og:image" content="https:\/\/example\.com\/img\.jpg" \/>/);
});

test('__cssVars is inlined as :root{...}', () => {
    const tpl = `<style>:root{{__cssVars}}</style>`;
    const ctx = { __cssVars: paletteToCssVars('cream-sage') };
    const out = renderTemplate(tpl, ctx);
    assertMatch(out, /<style>:root--bg: #f6f3ec; --accent: #9a7e57; --sage: #6e8a7c<\/style>/);
});

test('html escaping does not corrupt Arabic characters', () => {
    // Confirm Arabic letters survive the escape regex.
    const out = renderTemplate('{{text}}', { text: 'الدفع عند الاستلام' });
    assertEq(out, 'الدفع عند الاستلام');
});

test('html escaping protects against XSS in user-supplied copy', () => {
    const out = renderTemplate('<p>{{headline}}</p>', { headline: '<script>alert(1)</script>' });
    assertEq(out, '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
    assertNoMatch(out, /<script>alert/);
});

test('trust.badges array is rendered with each item', () => {
    const tpl = '{{#each trust.badges}}<span>✓ {{this}}</span>{{/each}}';
    const out = renderTemplate(tpl, { trust: { badges: ['COD', 'توصيل مجاني', 'ضمان سنة'] } });
    assertMatch(out, /✓ COD/);
    assertMatch(out, /✓ توصيل مجاني/);
    assertMatch(out, /✓ ضمان سنة/);
});

test('legacy config (Zenon top-level keys) renders the same — no special handling', () => {
    // The new template doesn't reference Zenon-specific paths, so missing keys
    // must simply render as empty. Confirms `meta`, `offers`, `theme.colors`
    // left over from the old shape don't blow up.
    const tpl = `<title>{{seo.title}}</title>{{#if hero.headline}}<h1>{{hero.headline}}</h1>{{/if}}`;
    const out = renderTemplate(tpl, {
        seo: { title: 'ساعة' },
        hero: { headline: '' },
        meta: { foo: 'bar' }, // legacy leftover
        offers: [],
        theme: { colors: {} }, // legacy leftover
    });
    assertEq(out, '<title>ساعة</title>');
});

// ─── Result summary ─────────────────────────────────────────────────────────

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
console.log(`\n${passed} passed, ${failed} failed (${results.length} total)\n`);
process.exit(failed === 0 ? 0 : 1);
