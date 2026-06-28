#!/usr/bin/env node
/**
 * test-soctiv-local-preview.mjs
 *
 * Smoke-tests the editor's local-preview rendering pipeline. Mirrors
 * the logic in `src/services/soctivLandingPreview.ts` (which uses
 * `?raw` Vite imports — only resolvable in a real build) and asserts:
 *
 *   1. styles.css is inlined (not linked as <link>)
 *   2. runtime.js is inlined (not <script src=...>)
 *   3. pixel.js + sha256.js are NOOP'd (preview should not hit Meta)
 *   4. window.__SOCTIV_CONFIG__ is inlined before </body>
 *   5. No `{{...}}` placeholder leakage
 *   6. CSS contains `:root` palette tokens
 *   7. Hero, form, objections, reviews, footer all rendered
 */

import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLISH_DIR = resolve(__dirname, '..', 'supabase', 'functions', 'publish-landing-page');

// ─── Inline the templating engine (mirror of templating.ts) ────────────────
const TAG_RE = /\{\{(?:#if\s+([@.\w]+)|#each\s+([@.\w]+)|else|\/if|\/each|\{([@.\w]+)\}|([@.\w]+))\}\}/g;
function getPath(c,p){if(p==='this')return c.this;if(p==='@index')return c['@index'];const ps=p.split('.');let x=c;for(const k of ps){if(x&&typeof x==='object')x=x[k];else return undefined;}return x;}
function isTruthy(v){if(v===null||v===undefined||v===false||v===0||v==='')return false;if(Array.isArray(v)&&v.length===0)return false;return true;}
function htmlEscape(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function findMatchingClose(t,from,kind){const o=new RegExp(`\\{\\{#${kind}\\s+([@.\\w]+)\\}\\}`,'g');const c=new RegExp(`\\{\\{/${kind}\\}\\}`,'g');let d=1,p=from;while(p<t.length&&d>0){o.lastIndex=p;c.lastIndex=p;const nO=o.exec(t),nC=c.exec(t);if(!nC)return-1;if(nO&&nO.index<nC.index){d++;p=nO.index+nO[0].length;}else{d--;if(d===0)return nC.index;p=nC.index+nC[0].length;}}return-1;}
function findTopLevelElse(b){let d=0,p=0;while(p<b.length){const s=b.slice(p);const oI=s.match(/^\{\{#if\s+[@.\w]+\}\}/);const oE=s.match(/^\{\{#each\s+[@.\w]+\}\}/);const cI=s.match(/^\{\{\/if\}\}/);const cE=s.match(/^\{\{\/each\}\}/);const el=s.match(/^\{\{else\}\}/);if(oI||oE){d++;p+=(oI||oE)[0].length;}else if(cI||cE){d--;p+=(cI||cE)[0].length;}else if(el&&d===0)return p;else if(el)p+=el[0].length;else p++;}return-1;}
function renderTemplate(t,c){let out='',i=0;while(i<t.length){TAG_RE.lastIndex=i;const m=TAG_RE.exec(t);if(!m){out+=t.slice(i);break;}out+=t.slice(i,m.index);if(m[1]!==undefined){const cs=findMatchingClose(t,m.index+m[0].length,'if');if(cs===-1){out+=m[0];i=m.index+m[0].length;continue;}const ce=cs+'{{/if}}'.length;const b=t.slice(m.index+m[0].length,cs);const tr=isTruthy(getPath(c,m[1]));const ei=findTopLevelElse(b);if(ei===-1){if(tr)out+=renderTemplate(b,c);}else{const tb=b.slice(0,ei);const eb=b.slice(ei+'{{else}}'.length);out+=tr?renderTemplate(tb,c):renderTemplate(eb,c);}i=ce;}else if(m[2]!==undefined){const cs=findMatchingClose(t,m.index+m[0].length,'each');if(cs===-1){out+=m[0];i=m.index+m[0].length;continue;}const ce=cs+'{{/each}}'.length;const b=t.slice(m.index+m[0].length,cs);const v=getPath(c,m[2]);if(Array.isArray(v)&&v.length>0){for(let idx=0;idx<v.length;idx++){const item=v[idx];const ic={...c,...(item&&typeof item==='object'?item:{}),this:item,'@index':idx};out+=renderTemplate(b,ic);}}i=ce;}else if(m[3]!==undefined){out+=getPath(c,m[3])==null?'':String(getPath(c,m[3]));i=m.index+m[0].length;}else if(m[4]!==undefined){out+=getPath(c,m[4])==null?'':htmlEscape(String(getPath(c,m[4])));i=m.index+m[0].length;}else{out+=m[0];i=m.index+m[0].length;}}return out;}

// ─── Inline assets (mirror of inlineAssets) ────────────────────────────────
const stylesCss = readFileSync(join(PUBLISH_DIR, 'styles.css'), 'utf8');
const runtimeJs = readFileSync(join(PUBLISH_DIR, 'client_runtime.js'), 'utf8');

function inlineAssets(html, { noopPixel = true } = {}) {
    let out = html;
    // Defense-in-depth: escape `</style>` and `</script>` inside inlined
    // assets so the raw-text scan inside <style>/<script> can't be
    // prematurely terminated by a literal closing tag.
    const safeStyles = stylesCss.replace(/<\/style>/gi, '<\\/style>');
    const safeRuntime = runtimeJs.replace(/<\/script>/gi, '<\\/script>');
    out = out.replace(
        /<link rel="stylesheet" href="styles\.css"\s*\/?>/,
        `<style>${safeStyles}</style>`
    );
    if (noopPixel) {
        out = out.replace(
            /<script src="sha256\.js"><\/script>\s*<script src="pixel\.js"><\/script>/,
            `<script>window.SOCTIV_TRACK_NOOP = true;<\/script>`
        );
    }
    out = out.replace(
        /<script src="runtime\.js"><\/script>/,
        `<script>${safeRuntime}<\/script>`
    );
    return out;
}

function injectConfigScript(html, config, thankYouHtml) {
    const configJson = JSON.stringify({
        product: config.product,
        pricing: { tiers: config.pricing.tiers, maxQty: config.pricing.maxQty, discountLabel: config.pricing.discountLabel },
        form: config.form,
        webhook: config.webhook,
        tracking: { debug: !!config.tracking?.debug },
    });
    // The preview flag is now an object containing the fully-inlined
    // thank-you HTML, mirroring `injectConfigScript` in
    // src/services/soctivLandingPreview.ts. The runtime swaps the iframe
    // document to this HTML via `document.write` on successful submit.
    let previewPayload;
    if (thankYouHtml) {
        const safeThankYou = JSON.stringify(thankYouHtml).replace(/<\/script>/gi, '<\\/script>');
        previewPayload = `{ thankYouHtml: ${safeThankYou} }`;
    } else {
        previewPayload = `true`;
    }
    const configScript = `<script>window.__SOCTIV_PREVIEW__ = ${previewPayload}; window.__SOCTIV_CONFIG__ = ${configJson};<\/script>`;
    // Inject config + preview flag BEFORE the inlined runtime.js so the runtime
    // can read __SOCTIV_CONFIG__ AND __SOCTIV_PREVIEW__ at load time.
    // Otherwise it crashes on `for (const tier of PRICING.tiers)` because the
    // fallback tiers object is not iterable; AND form submit would navigate
    // the iframe to about:srcdoc/thank-you.html (404) and the iframe goes
    // blank.
    if (html.includes('<script src="runtime.js"></script>')) {
        return html.replace(
            '<script src="runtime.js"></script>',
            configScript + '\n<script src="runtime.js"></script>'
        );
    }
    // After inlineAssets has replaced <script src="runtime.js"> with the
    // inlined JS block, look for that pattern instead.
    const runtimeInlineRe = /<script>[^<]*\(function \(\) \{[\s\S]*?\}\)\(\);<\/script>/;
    if (runtimeInlineRe.test(html)) {
        return html.replace(runtimeInlineRe, (match) => configScript + match);
    }
    return html.replace('</body>', configScript + '\n</body>');
}

// ─── Sample config + render ────────────────────────────────────────────────
const config = {
    product: { id:'p-1', code:'TEST-001', name:'test', nameArabic:'فستان اختبار', category:'ملابس', image:'https://i.imagekit.io/2bs8nn5zhz/products/test.webp', currency:'LYD', currencySymbol:'د.ل', currencyName:'دينار ليبي', value:265, unitPrice:265, metaLine:'دفع عند الاستلام · توصيل مجاني · ضمان سنة' },
    pricing: { tiers: [{quantity:1,price:265,label:'قطعة واحدة'},{quantity:2,price:499,label:'قطعتان'}], maxQty:5, discountLabel:'التخفيض' },
    tracking: { pixelId:'1234567890', capiUrl:'https://x.supabase.co/functions/v1/capi-proxy', testEventCode:'', debug:false },
    hero: { headline:'تألق بإطلالة خاطفة للأنظار في مناسباتك القادمة', subline:'وداعًا للفساتين التقليدية! استمتع بفخامة الأناقة', ctaText:'اطلب الآن — الدفع عند الاستلام', imageUrl:'https://i.imagekit.io/2bs8nn5zhz/products/test.webp', imageAlt:'فستان أحمر' },
    form: { submitText:'تأكيد الطلب — الدفع عند الاستلام', nameField:'الاسم الكامل', phoneField:'رقم الهاتف', locationField:'المدينة والعنوان', phoneRegex:'^09[0-9]{8}$', phonePlaceholder:'091 234 5678', nameMinLength:3, locationMinLength:5 },
    objections: { heading:'س', subheading:'ص', items:[{q:'س1',a:'ج1'},{q:'س2',a:'ج2'},{q:'س3',a:'ج3'}] },
    reviews: { heading:'آراء', subheading:'تجارب', items:[{name:'أح',location:'طرابلس',text:'رائع',initial:'أ'},{name:'سع',location:'بنغازي',text:'ممتاز',initial:'س'},{name:'عل',location:'مصراتة',text:'يستحق',initial:'ع'}] },
    trust: { badges:['الدفع عند الاستلام','توصيل مجاني','ضمان سنة'], row:['دفع عند الاستلام','توصيل مجاني'] },
    business: { brand:'soctiv', brandInitial:'s', supportEmail:'support@soctiv.ly', privacyEmail:'privacy@soctiv.ly', country:'Libya', phonePrefix:'+218', copyright:'© 2026 soctiv — جميع الحقوق محفوظة' },
    webhook: { url:'https://x.supabase.co/functions/v1/facebook-leads-webhook', clientCode:'TEST', productCode:'TEST-001', thankYouUrl:'thank-you.html', source:'Landing Page' },
    seo: { title:'فستان أحمر | soctiv', description:'فستان', ogImage:'https://i.imagekit.io/x.jpg', ogImageAlt:'فستان', year:'2026' },
    theme: { palette:'cream-sage', font:'Alexandria' },
};

const indexTpl = readFileSync(join(PUBLISH_DIR, 'template_index.html'), 'utf8');
const thankYouTpl = readFileSync(join(PUBLISH_DIR, 'template_thank_you.html'), 'utf8');

const ctx = {
    ...config,
    theme: { ...config.theme, font: 'Alexandria' },
    __cssVars: ':root { --bg: #f6f3ec; --accent: #9a7e57; --sage: #6e8a7c; }',
};

const rawRendered = renderTemplate(indexTpl, ctx);
// Build the inlined thank-you HTML so the runtime can swap to it on submit.
// Mirrors `renderSoctivPreview` in src/services/soctivLandingPreview.ts.
const thankYouInlined = inlineAssets(renderTemplate(thankYouTpl, ctx), { noopPixel: true });
const finalHtml = injectConfigScript(inlineAssets(rawRendered, { noopPixel: true }), config, thankYouInlined);

// ─── Tests ──────────────────────────────────────────────────────────────────
const results = [];
function test(name, fn) {
    try { fn(); results.push({ name, ok: true }); process.stdout.write(`  ✓ ${name}\n`); }
    catch (e) { results.push({ name, ok: false, err: e.message }); process.stdout.write(`  ✗ ${name}\n      ${e.message}\n`); }
}
function assertMatch(h, p, l) { if (!p.test(h)) throw new Error(`${l} missing: ${p}`); }
function assertNoMatch(h, p, l) { if (p.test(h)) throw new Error(`${l} still present: ${p}`); }

console.log('\n=== Local preview iframe rendering ===\n');
console.log(`  raw rendered: ${rawRendered.length} bytes`);
console.log(`  with assets inlined: ${finalHtml.length} bytes\n`);

test('no <link rel="stylesheet" href="styles.css"> remains', () =>
    assertNoMatch(finalHtml, /<link rel="stylesheet" href="styles\.css"/i, 'external stylesheet link'));

test('<style>...styles.css...</style> inlined', () =>
    assertMatch(finalHtml, /<style>[\s\S]*?\.hero[\s\S]*?<\/style>/, 'inlined styles.css'));

test('styles.css contains :root palette tokens', () =>
    assertMatch(stylesCss, /:root\s*\{[\s\S]*?--bg/, 'palette tokens in source CSS'));

test('no <script src="runtime.js"> remains', () =>
    assertNoMatch(finalHtml, /<script src="runtime\.js"><\/script>/, 'external runtime'));

test('runtime.js inlined as <script>...</script>', () =>
    assertMatch(finalHtml, /<script>[\s\S]*?function initOrderForm[\s\S]*?<\/script>/, 'inlined runtime'));

test('pixel.js + sha256.js NOOP\'d for preview', () =>
    assertMatch(finalHtml, /SOCTIV_TRACK_NOOP\s*=\s*true/, 'pixel noop marker'));

test('__SOCTIV_CONFIG__ injected before runtime.js', () => {
    // The config script must come BEFORE the inlined runtime.js block so
    // the runtime can read window.__SOCTIV_CONFIG__ at load time.
    const cfgIdx = finalHtml.indexOf('window.__SOCTIV_CONFIG__');
    const runtimeIdx = finalHtml.indexOf('function initOrderForm');
    if (cfgIdx === -1) throw new Error('config script missing');
    if (runtimeIdx === -1) throw new Error('runtime block missing');
    if (cfgIdx > runtimeIdx) throw new Error(`config (${cfgIdx}) appears AFTER runtime (${runtimeIdx})`);
});

test('__SOCTIV_PREVIEW__ is an object carrying thankYouHtml', () => {
    // The preview flag is no longer a boolean — it's an object so the
    // runtime can `document.write(preview.thankYouHtml)` on submit and
    // swap to the full thank-you page (vs. an inline confirmation card).
    assertMatch(finalHtml, /window\.__SOCTIV_PREVIEW__\s*=\s*\{\s*thankYouHtml:/, 'preview flag object');
});

test('hero headline + subline + CTA present', () => {
    assertMatch(finalHtml, /تألق بإطلالة خاطفة/, 'headline');
    assertMatch(finalHtml, /وداعًا للفساتين التقليدية/, 'subline');
    assertMatch(finalHtml, /اطلب الآن — الدفع عند الاستلام/, 'CTA');
});

test('no {{placeholder}} leakage', () =>
    assertNoMatch(finalHtml, /\{\{[^}]+\}\}/, 'placeholder'));

test('order form: 3 fields + submit', () => {
    assertMatch(finalHtml, /id="f-name"/, 'name field');
    assertMatch(finalHtml, /id="f-phone"/, 'phone field');
    assertMatch(finalHtml, /id="f-location"/, 'location field');
    assertMatch(finalHtml, /id="submit-btn"/, 'submit button');
});

test('exactly 3 objections', () => {
    const n = (finalHtml.match(/<div class="objection">/g) || []).length;
    if (n !== 3) throw new Error(`expected 3 objections, got ${n}`);
});

test('exactly 3 reviews', () => {
    const n = (finalHtml.match(/<article class="review">/g) || []).length;
    if (n !== 3) throw new Error(`expected 3 reviews, got ${n}`);
});

test('CSS reset + box-sizing rules inlined', () =>
    assertMatch(finalHtml, /box-sizing:\s*border-box/, 'reset CSS'));

test('hero__cta styled by CSS (not naked anchor)', () => {
    // The .hero__cta class must be defined in inlined CSS
    assertMatch(finalHtml, /\.hero__cta\s*\{/, 'hero__cta rule');
});

const passed = results.filter(r => r.ok).length;
const failed = results.length - passed;
console.log(`\n${passed} passed, ${failed} failed (${results.length} total)\n`);
process.exit(failed === 0 ? 0 : 1);
