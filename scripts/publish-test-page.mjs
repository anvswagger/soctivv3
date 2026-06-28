// scripts/publish-test-page.mjs
// End-to-end test: pick an existing client + product + DNA in Supabase, create
// a landing_pages row with subdomain='test', invoke the publish-landing-page
// edge function, verify the page is live at https://test.soctiv.ly/.
//
// Uses the Supabase Management API (project owner = no RLS) for everything
// so it works even with empty anon-key reads blocked by RLS.

import { randomUUID } from 'node:crypto';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!PROJECT_REF || !ACCESS_TOKEN) {
    console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN env var.');
    process.exit(1);
}
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jYWVleWJzaG95Z21sdXllc29yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTQ4MzQsImV4cCI6MjA5MDA3MDgzNH0.WaJO9pu20NiZy2Ar2iDmY7L6bM9zjGVcHqGNcRGyazQ';

async function mgmtQuery(sql) {
    const res = await fetch(
        `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: sql }),
        }
    );
    const text = await res.text();
    if (!res.ok) throw new Error(`mgmt ${res.status}: ${text.slice(0, 600)}`);
    return text;
}

async function invokeFunction(name, body) {
    const url = `${SUPABASE_URL}/functions/v1/${name}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text };
}

console.log('━━━ 1. Pick test data ━━━');
const dataRaw = await mgmtQuery(`
    SELECT
        c.id AS client_id,
        c.webhook_code AS client_webhook_code,
        p.id AS product_id,
        p.name AS product_name,
        p.code AS product_code,
        p.price AS product_price,
        d.id AS dna_id,
        d.headline AS dna_headline,
        d.unique_selling_proposition AS dna_usp
    FROM clients c
    JOIN products p ON p.client_id = c.id
    LEFT JOIN product_dna d ON d.product_id = p.id
    WHERE c.id = '29aa7df7-838d-47b8-84a0-0b2d3892ff35'
    ORDER BY p.created_at DESC, d.created_at DESC
    LIMIT 1;
`);
console.log(dataRaw);
const parsed = JSON.parse(dataRaw);
if (!Array.isArray(parsed) || parsed.length === 0) {
    console.error('No client/product data found for the chosen client. Aborting.');
    process.exit(1);
}
const obj = parsed[0];

console.log('Using client:', obj.client_id);
console.log('Using product:', obj.product_name, obj.product_code, '$' + obj.product_price);
console.log('Using DNA:', obj.dna_id || '(none)');

console.log('\n━━━ 2. Build Soctiv config + create landing_pages row ━━━');
// If a row already exists for subdomain='test', update its config in place
// (so we don't collide with the subdomain unique constraint) and reuse the id.
const existingRaw = await mgmtQuery(`SELECT id FROM landing_pages WHERE subdomain = 'test' LIMIT 1`);
const existing = JSON.parse(existingRaw)[0];
const pageId = existing?.id || randomUUID();
console.log(existing ? `Reusing existing page id: ${pageId}` : `Created new page id: ${pageId}`);
const config = {
    business: {
        brand: 'soctiv',
        copyright: 'جميع الحقوق محفوظة',
        supportEmail: 'support@soctiv.ly',
        privacyEmail: 'privacy@soctiv.ly',
    },
    product: {
        id: obj.product_id,
        code: obj.product_code || '',
        nameArabic: obj.product_name || 'منتج تجريبي',
        name: obj.product_name || 'Test Product',
        category: 'تجريبي',
        currency: 'د.ل',
        value: Number(obj.product_price) || 0,
        compareAt: Math.round((Number(obj.product_price) || 0) * 1.5),
        discountPercent: 33,
    },
    hero: {
        headline: obj.dna_headline || obj.product_name || 'منتج تجريبي',
        subline: obj.dna_usp || 'صفحة هبوط تجريبية تم نشرها تلقائيًا.',
        cta: 'اطلب الآن',
    },
    seo: {
        title: `${obj.product_name} — soctiv`,
        description: obj.dna_usp?.slice(0, 160) || 'صفحة هبوط تجريبية',
    },
    form: { submitText: 'تأكيد الطلب' },
    pricing: {
        tiers: [
            { qty: 1, unitPrice: Number(obj.product_price), discount: 0 },
            { qty: 2, unitPrice: Math.round(Number(obj.product_price) * 0.9), discount: 10 },
            { qty: 3, unitPrice: Math.round(Number(obj.product_price) * 0.83), discount: 17 },
        ],
        maxQty: 3,
        discountLabel: 'التخفيض',
    },
    theme: { palette: 'charcoal-mint', font: 'Alexandria' },
    trust: {
        badges: { enabled: true, items: ['الدفع عند الاستلام', 'توصيل مجاني', 'ضمان سنة', 'منتج أصلي'] },
        row: { enabled: true, items: ['دفع عند الاستلام', 'توصيل مجاني'] },
    },
    reviews: {
        enabled: true,
        heading: 'ماذا يقول عملاؤنا',
        subheading: '',
        items: [
            { name: 'أحمد م.', rating: 5, text: 'منتج ممتاز وجودة عالية' },
            { name: 'سارة ع.', rating: 5, text: 'التوصيل سريع والمنتج أصلي' },
        ],
    },
    faqs: [
        { q: 'هل المنتج أصلي؟', a: 'نعم، جميع منتجاتنا أصلية ومضمونة سنة كاملة.' },
        { q: 'كم رسوم التوصيل؟', a: 'التوصيل مجاني لجميع المدن.' },
    ],
    webhook: { source: 'Landing Page' },
    tracking: { pixelId: '', debug: false },
};

const insertSql = existing
    ? `
UPDATE landing_pages
SET config = ${`'${JSON.stringify(config).replace(/'/g, "''")}'::jsonb`},
    product_id = '${obj.product_id}',
    product_dna_id = ${obj.dna_id ? `'${obj.dna_id}'` : 'NULL'},
    status = 'draft',
    published_url = NULL,
    published_at = NULL,
    updated_at = NOW()
WHERE id = '${pageId}';
`
    : `
INSERT INTO landing_pages (
    id, client_id, product_id, product_dna_id, subdomain, status,
    title, template_id, theme_config, content_data, config
) VALUES (
    '${pageId}', '${obj.client_id}', '${obj.product_id}',
    ${obj.dna_id ? `'${obj.dna_id}'` : 'NULL'},
    'test', 'draft',
    '${(obj.product_name || 'test').replace(/'/g, "''")}',
    'soctiv-pro',
    '{"palette":"charcoal-mint"}'::jsonb,
    '{}'::jsonb,
    ${`'${JSON.stringify(config).replace(/'/g, "''")}'::jsonb`}
);
`;
await mgmtQuery(insertSql);
console.log(existing ? 'Updated landing_pages id:' : 'Created landing_pages id:', pageId);

console.log('\n━━━ 3. Invoke publish-landing-page ━━━');
const pub = await invokeFunction('publish-landing-page', { landing_page_id: pageId });
console.log('Status:', pub.status);
console.log('Body:', JSON.stringify(pub.json, null, 2));

if (pub.status !== 200 || !pub.json?.published_url) {
    console.error('Publish failed.');
    process.exit(1);
}

console.log('\n━━━ 4. Verify live URL ━━━');
console.log('Live URL:', pub.json.published_url);
const live = await fetch(pub.json.published_url, {
    headers: { 'User-Agent': 'publish-test-page.mjs/1.0' },
});
const html = await live.text();
const containsHeadline = html.includes(obj.product_name) || html.includes(config.hero.headline);
console.log('HTTP status:', live.status);
console.log('Contains product name / headline:', containsHeadline);
console.log('Page size:', html.length, 'bytes');
console.log('\n✅ Done. Live at:', pub.json.published_url);
console.log('Page id:', pageId);