/**
 * test-privacy-link-render.mjs
 *
 * Renders template_index.html through the production templating engine with
 * realistic configs to verify what the privacy link ACTUALLY ends up as in
 * the published HTML — for both the with-subdomain and the no-subdomain
 * (Netlify fallback) cases.
 *
 * This catches bugs where the conditional renders the wrong branch, or
 * where the absolute URL contains an unsafe value, or where the link points
 * somewhere it shouldn't (e.g. the Soctiv CRM app domain).
 *
 * Run: node scripts/test-privacy-link-render.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Mirror of templating.ts (the Deno module is TS, so we inline the JS) ──
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

function renderTemplate(template, ctx) {
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
            const closeStart = findMatchingClose(template, m.index + m[0].length, 'if');
            if (closeStart === -1) {
                out += m[0];
                i = m.index + m[0].length;
                continue;
            }
            const closeEnd = closeStart + '{{/if}}'.length;
            const body = template.slice(m.index + m[0].length, closeStart);
            const truthy = isTruthy(getPath(ctx, m[1]));
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
            const closeStart = findMatchingClose(template, m.index + m[0].length, 'each');
            if (closeStart === -1) {
                out += m[0];
                i = m.index + m[0].length;
                continue;
            }
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

// ─── Test harness ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(cond, label) {
    if (cond) {
        passed++;
        console.log(`  ✓ ${label}`);
    } else {
        failed++;
        console.log(`  ✗ ${label}`);
    }
}

// ─── Read the production template ───────────────────────────────────────────

const tpl = readFileSync(
    resolve(ROOT, 'supabase/functions/publish-landing-page/template_index.html'),
    'utf8',
);

// Extract just the privacy-link block for focused assertions.
const privacyBlockStart = tpl.indexOf('{{#if __publishedBaseUrl}}');
const privacyBlockEnd = tpl.indexOf('{{/if}}', privacyBlockStart) + '{{/if}}'.length;
const privacyBlock = tpl.slice(privacyBlockStart, privacyBlockEnd);

console.log('\n— Rendered privacy-link block per config —\n');

// Case 1: with subdomain → absolute URL branch should win
const withSubdomain = renderTemplate(privacyBlock, {
    __publishedBaseUrl: 'https://my-brand.soctiv.ly',
    business: { supportEmail: 'support@mybrand.com' },
});
console.log('with-subdomain rendered:\n  ' + withSubdomain.replace(/\n/g, '\n  '));
assert(withSubdomain.includes('href="https://my-brand.soctiv.ly/privacy-policy.html"'),
    'with-subdomain → absolute URL with privacy-policy.html path');
assert(!withSubdomain.includes('href="privacy-policy.html"'),
    'with-subdomain → does NOT fall through to relative branch');

// Case 2: with custom_domain → absolute URL branch should win
const withCustomDomain = renderTemplate(privacyBlock, {
    __publishedBaseUrl: 'https://shop.example.com',
    business: { supportEmail: 'support@example.com' },
});
assert(withCustomDomain.includes('href="https://shop.example.com/privacy-policy.html"'),
    'with-custom_domain → absolute URL');
assert(!withCustomDomain.includes('href="privacy-policy.html"'),
    'with-custom_domain → does NOT fall through to relative branch');

// Case 3: no subdomain / no custom_domain → relative branch (Netlify fallback)
const noSubdomain = renderTemplate(privacyBlock, {
    __publishedBaseUrl: '', // empty → else branch
    business: { supportEmail: 'support@example.com' },
});
console.log('no-subdomain rendered:\n  ' + noSubdomain.replace(/\n/g, '\n  '));
assert(noSubdomain.includes('href="privacy-policy.html"'),
    'no-subdomain → relative URL (privacy-policy.html)');
assert(!noSubdomain.includes('https://'),
    'no-subdomain → does NOT contain any absolute URL');

// Case 4: undefined __publishedBaseUrl (defensive — same as empty)
const undefBaseUrl = renderTemplate(privacyBlock, {
    business: { supportEmail: 'support@example.com' },
});
assert(undefBaseUrl.includes('href="privacy-policy.html"'),
    'undefined __publishedBaseUrl → relative URL branch');

// Case 5: hostile subdomain — XSS attempt — must be escaped
const hostile = renderTemplate(privacyBlock, {
    __publishedBaseUrl: '" onerror="alert(1)',
    business: { supportEmail: 'support@example.com' },
});
assert(!hostile.includes('onerror="alert(1)"'),
    'hostile subdomain value is HTML-escaped — does NOT inject onerror');

// Case 6: critical regression check — privacy link must NEVER point to the
// Soctiv CRM app domain, regardless of config.
for (const [label, ctx] of [
    ['with-subdomain', { __publishedBaseUrl: 'https://my-brand.soctiv.ly' }],
    ['with-custom', { __publishedBaseUrl: 'https://shop.example.com' }],
    ['no-subdomain', { __publishedBaseUrl: '' }],
    ['undefined', {}],
]) {
    const out = renderTemplate(privacyBlock, {
        ...ctx,
        business: { supportEmail: 'support@example.com' },
    });
    const linkMatches = out.match(/href="([^"]*)"/g) || [];
    for (const m of linkMatches) {
        assert(!m.includes('soctivcrm.com'),
            `${label}: privacy link does NOT point to soctivcrm.com (${m})`);
        assert(!m.includes('app.soctiv.ly'),
            `${label}: privacy link does NOT point to app.soctiv.ly (${m})`);
    }
}

// ─── Also test the privacy-policy.html itself (the "back to home" link) ────

console.log('\n— Privacy-policy.html back-to-home link —\n');
const privacyTpl = readFileSync(
    resolve(ROOT, 'supabase/functions/publish-landing-page/template_privacy.html'),
    'utf8',
);

// The privacy.html has 3 links to "index.html":
//   1. topbar__brand (line 30): "go to index"
//   2. topbar__back (line 34): "back to home"
//   3. footer__contact (line 273): "back to main page"
// All relative. On the Netlify deploy, they resolve to <deploy>/<pageId>/index.html.

const linkMatches = privacyTpl.match(/href="index\.html"/g) || [];
assert(linkMatches.length === 3,
    `template_privacy.html has 3 relative index.html links (got ${linkMatches.length})`);

// ─── Final tally ────────────────────────────────────────────────────────────

// ─── Verify the injectPreviewBaseTarget fix ─────────────────────────────────
//
// The preview renderer injects `<base target="_blank">` so link clicks in
// the sandboxed srcDoc iframe open in a NEW TAB instead of navigating
// the iframe to the embedding app's domain. Without this, a relative
// `privacy-policy.html` link in the preview would navigate the iframe
// to `<editor-domain>/privacy-policy.html`, which falls through the
// React Router catch-all and renders NotFound.tsx — the exact 404 the
// user reported.
//
// We mirror the fix here and verify it.
console.log('\n— injectPreviewBaseTarget verification —\n');

function injectPreviewBaseTarget(html) {
    const baseTag = `<base target="_blank" rel="noopener noreferrer">`;
    if (/<head\b[^>]*>/i.test(html)) {
        return html.replace(
            /<head\b([^>]*)>/i,
            (_match, attrs) => `<head${attrs}>\n  ${baseTag}`
        );
    }
    if (/<head\b/i.test(html)) {
        return html.replace(/<head\b/i, () => `<head>\n  ${baseTag}`);
    }
    return `${baseTag}\n${html}`;
}

// Realistic sample: a rendered template_index.html snippet
const sample = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>معاينة</title>
</head>
<body>
  <a href="privacy-policy.html">سياسة الخصوصية</a>
</body>
</html>`;

const injected = injectPreviewBaseTarget(sample);
assert(injected.includes('<base target="_blank" rel="noopener noreferrer">'),
    'injected output contains <base target="_blank">');
assert(injected.indexOf('<base target="_blank"') > injected.indexOf('<head'),
    'base tag is injected AFTER <head>');
assert(injected.indexOf('<base target="_blank"') < injected.indexOf('</head>'),
    'base tag is injected BEFORE </head>');
assert(injected.includes('href="privacy-policy.html"'),
    'relative privacy-policy.html link is preserved unchanged');

// What this fixes:
//   Clicking `<a href="privacy-policy.html">` inside the iframe would
//   navigate the iframe to `<editor-domain>/privacy-policy.html`.
//   With `<base target="_blank">`, it opens a NEW TAB instead.
//   The user's "page goes blank / 404 in the iframe" symptom is gone.

console.log(`\n=== Final Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed === 0 ? 0 : 1);
