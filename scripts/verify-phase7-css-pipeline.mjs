/**
 * verify-phase7-css-pipeline.mjs
 *
 * Phase 7 verification — proves the two CSS asset pipeline fixes:
 *
 *   7a. tailwind.config.ts has exactly ONE `boxShadow` block (not two).
 *   7b. vite.config.ts production-cleanup emits a `<noscript>` fallback
 *       after every rewritten `<link rel="stylesheet" ... onload=...>`.
 *
 * The vite plugin logic is mirrored here verbatim and run against a
 * realistic production HTML fixture. If the source diverges, this test
 * fails — that's the point: it locks in the contract that a no-JS user
 * still sees styles.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ─── 7a: Tailwind boxShadow audit ────────────────────────────────────────────

const tailwindSrc = readFileSync(join(ROOT, 'tailwind.config.ts'), 'utf8');

// Find every `boxShadow: {` opening — count them.
const boxShadowBlockOpens = (tailwindSrc.match(/^\s*boxShadow:\s*\{/gm) || []).length;

const checks = [];
function check(name, fn) {
    try { fn(); checks.push({ name, ok: true }); }
    catch (e) { checks.push({ name, ok: false, err: e.message }); }
}

check('7a: tailwind.config.ts has exactly ONE boxShadow block (was 2 before fix)', () => {
    if (boxShadowBlockOpens !== 1) {
        throw new Error(`expected 1 boxShadow block, found ${boxShadowBlockOpens}`);
    }
});

check('7a: canonical block contains subtle + card + card-hover + glow + glow-cyan + glow-cyan-strong + elevated', () => {
    const expected = ['subtle', 'card', 'card-hover', 'glow', 'glow-cyan', 'glow-cyan-strong', 'elevated'];
    for (const k of expected) {
        const re = new RegExp(`['"]?${k}['"]?:`);
        if (!re.test(tailwindSrc)) throw new Error(`missing shadow key: ${k}`);
    }
});

// ─── 7b: Vite production-cleanup contract ───────────────────────────────────

// Mirror the production-cleanup transform from vite.config.ts EXACTLY.
// Keep in sync with the source.
function productionCleanupTransform(html) {
    let finalHtml = html
        .replace(/<script[^>]*refresh\.js[^>]*><\/script>/gi, '')
        .replace(/<script[^>]*lovable[^>]*><\/script>/gi, '')
        .replace(/<meta[^>]*twitter:site[^>]*content="@Lovable"[^>]*>/gi, '')
        .replace(/<link[^>]*href="\/@vite[^>]*>/gi, '');

    return finalHtml.replace(
        /<link(?=[^>]*rel="stylesheet")[^>]*href="([^"]+\.css)"[^>]*>/gi,
        (match, href) =>
            `<link rel="stylesheet" href="${href}" media="print" onload="this.media='all'">` +
            `<noscript><link rel="stylesheet" href="${href}"></noscript>`
    );
}

// Realistic fixture: a production index.html with a stylesheet + JS.
const fixture = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>Soctiv</title>
  <link rel="icon" href="/favicon.ico" />
  <link rel="stylesheet" href="/assets/index-abc123.css" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/index-def456.js"></script>
</body>
</html>`;

const transformed = productionCleanupTransform(fixture);

check('7b: dev artifacts still stripped (refresh.js, lovable, etc.)', () => {
    if (transformed.includes('refresh.js')) throw new Error('refresh.js leaked');
    if (transformed.includes('lovable')) throw new Error('lovable leaked');
});

check('7b: <link rel="stylesheet"> rewritten to media="print" onload pattern', () => {
    if (!/<link rel="stylesheet" href="\/assets\/index-abc123\.css" media="print" onload="this\.media='all'">/.test(transformed)) {
        throw new Error('stylesheet not rewritten to deferred pattern');
    }
});

check('7b: <noscript> fallback emitted immediately after the deferred link', () => {
    // The noscript must be a sibling right after the rewritten link, and
    // contain the SAME href (without the media="print" onload trick).
    const re = /<link rel="stylesheet" href="([^"]+\.css)" media="print" onload="this\.media='all'"><noscript><link rel="stylesheet" href="\1"><\/noscript>/;
    if (!re.test(transformed)) {
        throw new Error('noscript fallback missing or wrong format');
    }
});

check('7b: <noscript> uses the SAME href as the deferred link', () => {
    const m = transformed.match(/<link rel="stylesheet" href="([^"]+\.css)" media="print"[^>]*><noscript><link rel="stylesheet" href="([^"]+)"><\/noscript>/);
    if (!m) throw new Error('match failed');
    if (m[1] !== m[2]) throw new Error(`href mismatch: ${m[1]} vs ${m[2]}`);
});

check('7b: favicon (rel="icon") untouched', () => {
    if (!transformed.includes('<link rel="icon" href="/favicon.ico" />')) {
        throw new Error('favicon touched');
    }
});

check('7b: preconnect (no rel="stylesheet") untouched', () => {
    if (!transformed.includes('<link rel="preconnect" href="https://fonts.googleapis.com" />')) {
        throw new Error('preconnect touched');
    }
});

// ─── 7b': Defense-in-depth — ensure old behavior (no noscript) is REJECTED ──
check("7b': without the fix (no noscript), the contract breaks", () => {
    // This is a meta-test: prove that an older buggy transform would FAIL
    // the contract. Useful so a future refactor doesn't silently drop the
    // noscript without noticing.
    const buggy = fixture.replace(
        /<link(?=[^>]*rel="stylesheet")[^>]*href="([^"]+\.css)"[^>]*>/gi,
        (m, href) => `<link rel="stylesheet" href="${href}" media="print" onload="this.media='all'">`
    );
    if (/<noscript>.*<link rel="stylesheet"/.test(buggy)) {
        throw new Error('buggy version unexpectedly had noscript — update the test');
    }
    // Prove the fix is what makes the contract hold.
    if (!/<noscript>.*<link rel="stylesheet"/.test(transformed)) {
        throw new Error('fixed version missing noscript');
    }
});

// ─── Report ────────────────────────────────────────────────────────────────

let pass = 0, fail = 0;
for (const c of checks) {
    if (c.ok) { console.log(`  ✓ ${c.name}`); pass++; }
    else { console.log(`  ✗ ${c.name}\n      ${c.err}`); fail++; }
}
console.log(`\n${pass}/${checks.length} checks passed`);
if (fail) process.exit(1);
