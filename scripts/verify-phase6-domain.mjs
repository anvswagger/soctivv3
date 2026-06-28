/**
 * verify-phase6-domain.mjs
 *
 * Phase 6 verification — proves the domain validation logic in
 * `DomainEditor` works correctly without spinning up React:
 *
 *   - subdomain regex accepts / rejects correctly
 *   - custom-domain regex accepts / rejects correctly
 *   - subdomain autoclean strips invalid characters
 *   - empty strings normalize to null (so clearing the field works)
 *
 * The regexes live in src/components/landing-pages/editor/sections/DomainEditor.tsx
 * and the SAVE normalization lives in src/pages/LandingPageEditor.tsx
 * `saveDomainMutation`. We mirror them here verbatim and exercise them
 * against representative inputs.
 */

const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;
const DOMAIN_RE =
    /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

const checks = [];
function check(name, fn) {
    try { fn(); checks.push({ name, ok: true }); }
    catch (e) { checks.push({ name, ok: false, err: e.message }); }
}
function assertTrue(c, msg) { if (!c) throw new Error(msg); }
function assertFalse(c, msg) { if (c) throw new Error(msg); }

/** Mirror of the saveDomainMutation's normalization. */
function normalizeSave({ subdomain, customDomain }) {
    return {
        subdomain: subdomain.trim() ? subdomain.trim() : null,
        custom_domain: customDomain.trim()
            ? customDomain.trim().toLowerCase()
            : null,
    };
}

// ─── Subdomain regex ────────────────────────────────────────────────────────

check('subdomain: simple "my-brand" accepted', () =>
    assertTrue(SUBDOMAIN_RE.test('my-brand'), 'should accept my-brand'));
check('subdomain: simple "a" accepted', () =>
    assertTrue(SUBDOMAIN_RE.test('a'), 'should accept single char'));
check('subdomain: digits "123" accepted', () =>
    assertTrue(SUBDOMAIN_RE.test('123'), 'should accept digits'));
check('subdomain: 32-char string accepted', () =>
    assertTrue(SUBDOMAIN_RE.test('a'.repeat(32)), 'should accept 32 chars'));
check('subdomain: 33-char string rejected', () =>
    assertFalse(SUBDOMAIN_RE.test('a'.repeat(33)), 'should reject 33 chars'));
check('subdomain: leading dash rejected', () =>
    assertFalse(SUBDOMAIN_RE.test('-foo'), 'no leading dash'));
check('subdomain: trailing dash rejected', () =>
    assertFalse(SUBDOMAIN_RE.test('foo-'), 'no trailing dash'));
check('subdomain: uppercase rejected', () =>
    assertFalse(SUBDOMAIN_RE.test('MyBrand'), 'no uppercase'));
check('subdomain: underscore rejected', () =>
    assertFalse(SUBDOMAIN_RE.test('my_brand'), 'no underscore'));
check('subdomain: arabic rejected', () =>
    assertFalse(SUBDOMAIN_RE.test('منتج'), 'no non-latin'));
check('subdomain: empty is a "clear" signal — UI code checks length before regex', () => {
    // The DomainEditor code reads:
    //   const subValid = sub.length === 0 || isValidSubdomain(sub);
    // i.e. empty skips validation entirely. We mirror that here.
    const sub = '';
    const subValid = sub.length === 0 || SUBDOMAIN_RE.test(sub);
    assertTrue(subValid, 'empty must be treated as valid (clear)');
});

// ─── Domain regex ───────────────────────────────────────────────────────────

check('domain: "shop.example.com" accepted', () =>
    assertTrue(DOMAIN_RE.test('shop.example.com'), 'should accept shop.example.com'));
check('domain: "a.io" accepted (2-letter TLD)', () =>
    assertTrue(DOMAIN_RE.test('a.io'), 'should accept 2-letter TLD'));
check('domain: "example.com" accepted (no subdomain)', () =>
    assertTrue(DOMAIN_RE.test('example.com'), 'should accept 2-level domain'));
check('domain: "deep.nested.shop.example.com" accepted', () =>
    assertTrue(DOMAIN_RE.test('deep.nested.shop.example.com'), 'should accept deep subdomain'));
check('domain: "no-tld" rejected', () =>
    assertFalse(DOMAIN_RE.test('no-tld'), 'should require TLD'));
check('domain: ".com" rejected', () =>
    assertFalse(DOMAIN_RE.test('.com'), 'should reject just TLD'));
check('domain: "shop.example.123" rejected (numeric TLD)', () =>
    assertFalse(DOMAIN_RE.test('shop.example.123'), 'numeric TLD rejected'));
check('domain: 254-char string rejected', () =>
    assertFalse(DOMAIN_RE.test('a'.repeat(254) + '.com'), 'too long rejected'));
check('domain: empty is a "clear" signal — UI code checks length before regex', () => {
    const custom = '';
    const customValid = custom.length === 0 || DOMAIN_RE.test(custom);
    assertTrue(customValid, 'empty must be treated as valid (clear)');
});

// ─── Subdomain autoclean (the onChange handler in DomainEditor) ────────────

function autocleanSubdomain(s) {
    return s.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

check('autoclean: "My-Brand!" → "my-brand"', () =>
    assertTrue(autocleanSubdomain('My-Brand!') === 'my-brand', 'expected my-brand'));
check('autoclean: "SARA.COM" → "saracom"', () =>
    assertTrue(autocleanSubdomain('SARA.COM') === 'saracom', 'expected saracom (dots removed)'));
check('autoclean: "منتج" → "" (stripped to empty)', () =>
    assertTrue(autocleanSubdomain('منتج') === '', 'expected empty'));

// ─── Save normalization (mirrors saveDomainMutation) ────────────────────────

check('normalize: empty subdomain → null', () => {
    const r = normalizeSave({ subdomain: '', customDomain: '' });
    assertTrue(r.subdomain === null, 'subdomain null');
    assertTrue(r.custom_domain === null, 'custom null');
});
check('normalize: whitespace-only subdomain → null', () => {
    const r = normalizeSave({ subdomain: '   ', customDomain: '' });
    assertTrue(r.subdomain === null, 'subdomain null');
});
check('normalize: "  MyBrand  " → "MyBrand" (trim only, case preserved)', () => {
    const r = normalizeSave({ subdomain: '  MyBrand  ', customDomain: '' });
    assertTrue(r.subdomain === 'MyBrand', 'subdomain trimmed');
});
check('normalize: customDomain lowercased', () => {
    const r = normalizeSave({ subdomain: '', customDomain: 'SHOP.Example.COM' });
    assertTrue(r.custom_domain === 'shop.example.com', 'lowercased');
});
check('normalize: "shop.example.com" preserved', () => {
    const r = normalizeSave({ subdomain: 'foo', customDomain: 'shop.example.com' });
    assertTrue(r.subdomain === 'foo', 'subdomain kept');
    assertTrue(r.custom_domain === 'shop.example.com', 'custom kept');
});

// ─── Full URL builder (mirrors DomainEditor) ────────────────────────────────

function buildSubUrl(s) { return s ? `https://${s}.soctiv.ly` : null; }
function buildCustomUrl(d) { return d ? `https://${d}` : null; }

check('URL builder: subdomain → soctiv.ly', () =>
    assertTrue(buildSubUrl('my-brand') === 'https://my-brand.soctiv.ly', 'url'));
check('URL builder: custom → custom domain', () =>
    assertTrue(buildCustomUrl('shop.example.com') === 'https://shop.example.com', 'url'));
check('URL builder: empty → null (hides the URL chip)', () => {
    assertTrue(buildSubUrl('') === null, 'sub null');
    assertTrue(buildCustomUrl('') === null, 'custom null');
});

// ─── Report ────────────────────────────────────────────────────────────────

let pass = 0, fail = 0;
for (const c of checks) {
    if (c.ok) { console.log(`  ✓ ${c.name}`); pass++; }
    else { console.log(`  ✗ ${c.name}\n      ${c.err}`); fail++; }
}
console.log(`\n${pass}/${checks.length} checks passed`);
if (fail) process.exit(1);
