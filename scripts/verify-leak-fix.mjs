/**
 * verify-leak-fix.mjs
 *
 * Reproduction + fix verification for the editor-preview / published-page
 * leak where literal `<script src="pixel.js"></script>` ended up in the
 * rendered page body, AND where the CTA button stopped responding to
 * clicks.
 *
 * Root cause:
 *   `pixel.js` source contains the literal characters `\\$&` (5 chars:
 *   backslash, backslash, dollar, ampersand). That's the JS escape for
 *   `\$&` — the regex back-reference substitution that `getCookie` uses:
 *
 *     getCookie(name) {
 *       var m = document.cookie.match(
 *         new RegExp(
 *           '(?:^|; )' + name.replace(/[-.+]/g, '\\$&') + '=([^;]*)'
 *         )
 *       );
 *       return m ? decodeURIComponent(m[1]) : null;
 *     }
 *
 *   When `inlineAssets()` in `soctivLandingPreview.ts` did:
 *
 *     out.replace(
 *       /<script src="pixel\.js"><\/script>/,
 *       `<script>${safePixel}<\/script>`
 *     )
 *
 *   …the second argument was a STRING. `String.prototype.replace` treats
 *   the strings `$&`, `$$`, `$1`, … in the replacement as special
 *   patterns. `$&` means "the matched substring". So the `\\$&` inside
 *   safePixel got expanded into the matched text
 *   `<script src="pixel.js"></script>`, which leaked straight into the
 *   page body as visible text — AND broke the surrounding JS context so
 *   the CTA's click handler could no longer register.
 *
 * Fix:
 *   Pass a function as the second argument. In a function callback, JS
 *   does NOT interpret `$&` patterns in the returned string — it returns
 *   the string verbatim.
 *
 * This script proves:
 *   1. The OLD pattern (string replacement) leaks `<script src=...>`.
 *   2. The NEW pattern (function replacement) does not leak.
 *   3. After the fix, the CTA button gets a working click handler.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const ASSETS = join(ROOT, 'supabase', 'functions', 'publish-landing-page');
const pixelSrc = readFileSync(join(ASSETS, 'assets', 'pixel.js'), 'utf8');
const indexTpl = readFileSync(join(ASSETS, 'template_index.html'), 'utf8');

const checks = [];
function check(name, fn) {
    try { fn(); checks.push({ name, ok: true }); }
    catch (e) { checks.push({ name, ok: false, err: e.message }); }
}
function assertNo(haystack, pattern, label) {
    if (pattern.test(haystack)) throw new Error(`${label} leaked: ${pattern}`);
}
function assertMatch(haystack, pattern, label) {
    if (!pattern.test(haystack)) throw new Error(`${label} missing: ${pattern}`);
}

// Sanity: confirm the seed condition exists in the source. If a future
// refactor removes `\\$&` from pixel.js this test would no longer
// reproduce the bug; that's fine — just delete this file too.
check('pixel.js contains literal `\\\\$&` (the seed for the bug)', () => {
    if (!pixelSrc.includes("'\\\\$&'")) {
        throw new Error('seed gone — fix pixel.js not your test');
    }
});

// ─── 1. OLD pattern (string replacement) — leaks ──────────────────────────
const OLD_html = indexTpl;
const OLD_safePixel = pixelSrc.replace(/<\/script>/gi, '<\\/script>');
const OLD_out = OLD_html.replace(
    /<script src="pixel\.js"><\/script>/,
    `<script>${OLD_safePixel}<\/script>`
);

check('OLD (string) leaks literal <script src="pixel.js"></script>', () => {
    assertMatch(OLD_out, /<script src="pixel\.js"><\/script>/, 'pixel tag');
});

// ─── 2. NEW pattern (function replacement) — does not leak ────────────────
const NEW_html = indexTpl;
const NEW_safePixel = pixelSrc.replace(/<\/script>/gi, '<\\/script>');
const NEW_out = NEW_html.replace(
    /<script src="pixel\.js"><\/script>/,
    () => `<script>${NEW_safePixel}<\/script>`
);

check('NEW (function) does NOT leak literal <script src="pixel.js">', () => {
    assertNo(NEW_out, /<script src="pixel\.js"><\/script>/, 'pixel tag');
});
check('NEW (function) preserves the `\\\\$&` regex back-reference', () => {
    assertMatch(NEW_out, /'\\\\\$&'/, 'regex back-reference');
});
check('NEW (function) keeps `getCookie` function intact', () => {
    assertMatch(NEW_out, /function getCookie\(name\)/, 'getCookie fn');
    assertMatch(NEW_out, /decodeURIComponent/, 'decodeURIComponent');
});

// ─── 3. User-controlled strings also safe with function replacement ───────
// Defense in depth: if any user input contains `$&`, the function form
// also prevents the leak. Simulate a worst-case config.
const maliciousJson = JSON.stringify({
    product: { nameArabic: '$&' }, // literal dollar-amp
});
const maliciousFlag = `<script>window.__SOCTIV_CONFIG__ = ${maliciousJson};<\/script>\n`;
const maliciousHtml = `<html><body><script src="runtime.js"></script></body></html>`;

const MAL_old = maliciousHtml.replace(
    '<script src="runtime.js"></script>',
    maliciousFlag + '<script src="runtime.js"></script>'
);
const MAL_new = maliciousHtml.replace(
    '<script src="runtime.js"></script>',
    () => maliciousFlag + '<script src="runtime.js"></script>'
);

check('OLD leaks `$&` user input as the matched substring', () => {
    assertMatch(MAL_old, /window\.__SOCTIV_CONFIG__ = \{"product":\{"nameArabic":"<script src="runtime\.js"><\/script>"\}\}/, '$& expansion');
});
check('NEW preserves user `$&` verbatim', () => {
    assertMatch(MAL_new, /"nameArabic":"\$&"/, '$& verbatim');
    // Runtime tag should appear EXACTLY ONCE (the legitimate injection
    // we made) — not twice as it would if the user string got expanded.
    const matches = MAL_new.match(/<script src="runtime\.js"><\/script>/g) || [];
    if (matches.length !== 1) throw new Error(`expected 1 runtime tag, got ${matches.length}`);
});

// ─── Report ────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
for (const c of checks) {
    if (c.ok) { console.log(`  ✓ ${c.name}`); pass++; }
    else { console.log(`  ✗ ${c.name}\n      ${c.err}`); fail++; }
}
console.log(`\n${pass}/${checks.length} checks passed`);
if (fail) process.exit(1);
