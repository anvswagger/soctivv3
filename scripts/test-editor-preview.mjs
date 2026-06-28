// Test: mimic exactly what the editor's iframe gets fed, write to dist/soctiv-preview/iframe-test.html
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const __dirname = process.cwd();
const PUBLISH_DIR = resolve(__dirname, 'supabase', 'functions', 'publish-landing-page');

// ─── Inline templating engine (mirror of soctivLandingPreview.ts) ──────────
const TAG_RE = /\{\{(?:#if\s+([@.\w]+)|#each\s+([@.\w]+)|else|\/if|\/each|\{([@.\w]+)\}|([@.\w]+))\}\}/g;
function getPath(c, p) { if (p === 'this') return c.this; if (p === '@index') return c['@index']; const ps = p.split('.'); let x = c; for (const k of ps) { if (x && typeof x === 'object') x = x[k]; else return undefined; } return x; }
function isTruthy(v) { if (v === null || v === undefined || v === false || v === 0 || v === '') return false; if (Array.isArray(v) && v.length === 0) return false; return true; }
function htmlEscape(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function findMatchingClose(t, from, kind) { const o = new RegExp(`\\{\\{#${kind}\\s+([@.\\w]+)\\}\\}`, 'g'); const c = new RegExp(`\\{\\{/${kind}\\}\\}`, 'g'); let d = 1, p = from; while (p < t.length && d > 0) { o.lastIndex = p; c.lastIndex = p; const nO = o.exec(t), nC = c.exec(t); if (!nC) return -1; if (nO && nO.index < nC.index) { d++; p = nO.index + nO[0].length; } else { d--; if (d === 0) return nC.index; p = nC.index + nC[0].length; } } return -1; }
function findTopLevelElse(b) { let d = 0, p = 0; while (p < b.length) { const s = b.slice(p); const oI = s.match(/^\{\{#if\s+[@.\w]+\}\}/); const oE = s.match(/^\{\{#each\s+[@.\w]+\}\}/); const cI = s.match(/^\{\{\/if\}\}/); const cE = s.match(/^\{\{\/each\}\}/); const el = s.match(/^\{\{else\}\}/); if (oI || oE) { d++; p += (oI || oE)[0].length; } else if (cI || cE) { d--; p += (cI || cE)[0].length; } else if (el && d === 0) return p; else if (el) p += el[0].length; else p++; } return -1; }
function renderTemplate(t, c) {
    let out = '', i = 0;
    while (i < t.length) {
        TAG_RE.lastIndex = i;
        const m = TAG_RE.exec(t);
        if (!m) { out += t.slice(i); break; }
        out += t.slice(i, m.index);
        if (m[1] !== undefined) {
            const cs = findMatchingClose(t, m.index + m[0].length, 'if');
            if (cs === -1) { out += m[0]; i = m.index + m[0].length; continue; }
            const ce = cs + '{{/if}}'.length;
            const b = t.slice(m.index + m[0].length, cs);
            const tr = isTruthy(getPath(c, m[1]));
            const ei = findTopLevelElse(b);
            if (ei === -1) { if (tr) out += renderTemplate(b, c); }
            else { const tb = b.slice(0, ei); const eb = b.slice(ei + '{{else}}'.length); out += tr ? renderTemplate(tb, c) : renderTemplate(eb, c); }
            i = ce;
        } else if (m[2] !== undefined) {
            const cs = findMatchingClose(t, m.index + m[0].length, 'each');
            if (cs === -1) { out += m[0]; i = m.index + m[0].length; continue; }
            const ce = cs + '{{/each}}'.length;
            const b = t.slice(m.index + m[0].length, cs);
            const v = getPath(c, m[2]);
            if (Array.isArray(v) && v.length > 0) {
                for (let idx = 0; idx < v.length; idx++) {
                    const item = v[idx];
                    const ic = { ...c, ...(item && typeof item === 'object' ? item : {}), this: item, '@index': idx };
                    out += renderTemplate(b, ic);
                }
            }
            i = ce;
        } else if (m[3] !== undefined) {
            out += getPath(c, m[3]) == null ? '' : String(getPath(c, m[3]));
            i = m.index + m[0].length;
        } else if (m[4] !== undefined) {
            out += getPath(c, m[4]) == null ? '' : htmlEscape(String(getPath(c, m[4])));
            i = m.index + m[0].length;
        } else { out += m[0]; i = m.index + m[0].length; }
    }
    return out;
}

// ─── Inline assets (mirror of soctivLandingPreview.ts) ─────────────────────
const stylesCss = readFileSync(join(PUBLISH_DIR, 'styles.css'), 'utf8');
const runtimeJs = readFileSync(join(PUBLISH_DIR, 'client_runtime.js'), 'utf8');
const indexTpl = readFileSync(join(PUBLISH_DIR, 'template_index.html'), 'utf8');
const thankYouTpl = readFileSync(join(PUBLISH_DIR, 'template_thank_you.html'), 'utf8');

// Defense-in-depth: escape `</style>` and `</script>` inside inlined assets
// so the raw-text scan inside <style>/<script> can't be prematurely
// terminated by a literal closing tag.
const safeStyles = stylesCss.replace(/<\/style>/gi, '<\\/style>');
const safeRuntime = runtimeJs.replace(/<\/script>/gi, '<\\/script>');

function inlineAssets(html, { noopPixel = true } = {}) {
    let out = html;
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

function paletteToCssVars(theme) {
    const k = SOCTIV_PALETTES[theme?.palette] ? theme.palette : 'cream-sage';
    const body = Object.entries(SOCTIV_PALETTES[k]).map(([k, v]) => `${k}: ${v}`).join('; ');
    return `:root { ${body}; }`;
}

const SOCTIV_PALETTES = {
    'cream-sage': { '--bg': '#f6f3ec', '--surface': '#ffffff', '--accent': '#9a7e57', '--sage': '#6e8a7c', '--sage-deep': '#3f564a' },
    'ivory-teal': { '--bg': '#fafaf7', '--accent': '#3f7a7b', '--sage': '#3f7a7b' },
    'sand-amber': { '--bg': '#f5efe6', '--accent': '#c08a4a' },
};

// ─── Sample config (matches what editor renders) ──────────────────────────
const config = {
    product: { id:'p-1', code:'TEST-001', name:'test', nameArabic:'فستان اختبار', category:'ملابس', image:'https://i.imagekit.io/2bs8nn5zhz/products/test.webp', currency:'LYD', currencySymbol:'د.ل', currencyName:'دينار ليبي', value:265, unitPrice:265, metaLine:'دفع عند الاستلام · توصيل مجاني · ضمان سنة' },
    pricing: { tiers: [{quantity:1,price:265,label:'قطعة واحدة'},{quantity:2,price:499,label:'قطعتان'}], maxQty:5, discountLabel:'التخفيض', stepperLabel:'كم قطعة تريد؟', stepperAria:'اختر الكمية', minusAria:'إنقاص الكمية', plusAria:'زيادة الكمية', unitLabel:'سعر القطعة الواحدة', subtotalLabel:'سعر القطعة', deliveryLabel:'رسوم التوصيل', deliveryFree:'مجاناً', totalLabel:'الإجمالي الكلي' },
    tracking: { pixelId:'1234567890', capiUrl:'https://x.supabase.co/functions/v1/capi-proxy', testEventCode:'', debug:false },
    hero: { headline:'تألق بإطلالة خاطفة للأنظار في مناسباتك القادمة', subline:'وداعًا للفساتين التقليدية! استمتع بفخامة الأناقة', ctaText:'اطلب الآن — الدفع عند الاستلام', imageUrl:'https://i.imagekit.io/2bs8nn5zhz/products/test.webp', imageAlt:'فستان أحمر' },
    form: { submitText:'تأكيد الطلب — الدفع عند الاستلام', nameField:'الاسم الكامل', phoneField:'رقم الهاتف', locationField:'المدينة والعنوان', phoneRegex:'^09[0-9]{8}$', phonePlaceholder:'091 234 5678', nameMinLength:3, locationMinLength:5, submittingText:'جاري الإرسال…', namePlaceholder:'مثال: أحمد محمد', locationPlaceholder:'مثال: شارع الجمهورية، طرابلس', phoneError:'يرجى إدخال رقم هاتف ليبي صالح.', nameError:'يرجى إدخال الاسم الكامل.', locationError:'يرجى إدخال المدينة والعنوان.' },
    objections: { heading:'ثلاثة أسئلة', subheading:'الأسباب', items:[{q:'كم يستغرق التوصيل؟',a:'عادة 2-3 أيام'},{q:'هل المنتج أصلي؟',a:'نعم، مستورد'},{q:'هل يمكنني الفحص قبل الدفع؟',a:'بالتأكيد'}] },
    reviews: { heading:'ماذا يقول عملاؤنا', subheading:'تجارب', items:[{name:'أحمد',location:'طرابلس',text:'منتج رائع والتوصيل سريع',initial:'أ'},{name:'سعاد',location:'بنغازي',text:'ممتاز جداً وأنصح به',initial:'س'},{name:'علي',location:'مصراتة',text:'يستحق كل ريال',initial:'ع'}] },
    trust: { badges:['الدفع عند الاستلام','توصيل مجاني','ضمان سنة'], row:['دفع عند الاستلام','توصيل مجاني'] },
    business: { brand:'soctiv', brandInitial:'s', supportEmail:'support@soctiv.ly', privacyEmail:'privacy@soctiv.ly', country:'Libya', phonePrefix:'+218', copyright:'© 2026 soctiv — جميع الحقوق محفوظة' },
    webhook: { url:'https://x.supabase.co/functions/v1/facebook-leads-webhook', clientCode:'TEST', productCode:'TEST-001', thankYouUrl:'thank-you.html', source:'Landing Page' },
    seo: { title:'فستان أحمر | soctiv', description:'فستان أنيق', ogImage:'https://i.imagekit.io/x.jpg', ogImageAlt:'فستان', year:'2026' },
    theme: { palette:'cream-sage', font:'Alexandria' },
};

const ctx = { ...config, __cssVars: paletteToCssVars(config.theme) };
const rendered = renderTemplate(indexTpl, ctx);
const inlined = inlineAssets(rendered, { noopPixel: true });
// Build the inlined thank-you HTML so the runtime can swap to it on submit.
// Mirrors `renderSoctivPreview` in soctivLandingPreview.ts.
const thankYouRendered = renderTemplate(thankYouTpl, ctx);
const thankYouInlined = inlineAssets(thankYouRendered, { noopPixel: true });
// Escape the embedded thank-you HTML so it survives being JSON-stringified
// inside a <script> block (the HTML parser treats `<\/script>` as data).
const safeThankYou = JSON.stringify(thankYouInlined).replace(/<\/script>/gi, '<\\/script>');
const configScript = `<script>window.__SOCTIV_PREVIEW__ = { thankYouHtml: ${safeThankYou} }; window.__SOCTIV_CONFIG__ = ${JSON.stringify(config)};<\/script>`;
// Inject config BEFORE the inlined runtime.js so the runtime can read
// __SOCTIV_CONFIG__ at load time. Otherwise it crashes on
// `for (const tier of PRICING.tiers)` because the fallback `tiers: {}`
// (an object) is not iterable.
const runtimeTag = `<script>${safeRuntime}<\/script>`;
const final = inlined.includes(runtimeTag)
    ? inlined.replace(runtimeTag, configScript + runtimeTag)
    : inlined.replace('</body>', configScript + '</body>');

writeFileSync('dist/soctiv-preview/iframe-test.html', final, 'utf8');
console.log(`Wrote ${final.length} bytes to dist/soctiv-preview/iframe-test.html\n`);

// ─── Verify ────────────────────────────────────────────────────────────────
const styleMatches = [...final.matchAll(/<style[> ][^]*?<\/style>/g)];
console.log(`Total <style> tags: ${styleMatches.length}`);
styleMatches.forEach((m, i) => {
    console.log(`  [${i}] length=${m[0].length} preview=${JSON.stringify(m[0].substring(0, 80))}`);
});
const linkMatches = [...final.matchAll(/<link[^>]+>/g)];
console.log(`Total <link> tags: ${linkMatches.length}`);
linkMatches.forEach((m, i) => console.log(`  [${i}] ${m[0]}`));
const scriptSrc = [...final.matchAll(/<script[^>]+src=[^>]+>/g)];
console.log(`Total <script src=...> tags: ${scriptSrc.length}`);
scriptSrc.forEach((m, i) => console.log(`  [${i}] ${m[0]}`));
const placeholderLeak = final.match(/\{\{[^}]+\}\}/g);
console.log(`\nPlaceholder leakage: ${placeholderLeak ? placeholderLeak.length : 0}`);
if (placeholderLeak) console.log('  leaked:', placeholderLeak);
