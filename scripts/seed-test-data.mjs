// scripts/seed-test-data.mjs
// Seeds a complete test data chain (auth.users -> profiles -> clients ->
// products -> landing_pages) and returns the new landing_page_id so a
// caller can immediately invoke publish-landing-page. Idempotent: re-running
// just rotates the generated UUIDs; nothing is overwritten.

import { randomUUID } from 'node:crypto';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

const TEST_USER_EMAIL = `test-publisher-${Date.now()}@soctiv.local`;
const TEST_USER_ID = randomUUID();
const TEST_PROFILE_ID = TEST_USER_ID; // profiles.id = auth.users.id
const TEST_CLIENT_ID = randomUUID();
const TEST_PRODUCT_ID = randomUUID();
const TEST_PAGE_ID = randomUUID();
const TEST_DNA_ID = randomUUID();

const sql = `
-- 1. auth.users (we can't use the admin API from here without a service-role
-- JWT; direct SQL is fine since this DB is a dev project).
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES (
  '${TEST_USER_ID}', '00000000-0000-0000-0000-000000000000', '${TEST_USER_EMAIL}',
  crypt('test-password-not-real', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  'authenticated', 'authenticated', now(), now(), '', '', '', ''
);

-- 2. profiles
INSERT INTO public.profiles (id, full_name, approval_status)
VALUES ('${TEST_PROFILE_ID}', 'Test Publisher', 'approved');

-- 3. user_roles
INSERT INTO public.user_roles (user_id, role)
VALUES ('${TEST_PROFILE_ID}', 'client');

-- 4. clients
INSERT INTO public.clients (
  id, user_id, company_name, industry, website, address, phone,
  webhook_code, onboarding_completed
) VALUES (
  '${TEST_CLIENT_ID}', '${TEST_PROFILE_ID}',
  'شركة الاختبار', 'E-commerce', 'https://example.com', 'طرابلس',
  '0910000000',
  'TEST-CODE-' || substr(md5(random()::text), 1, 8),
  true
);

-- 5. products
INSERT INTO public.products (
  id, client_id, name, description, price, sku, category, code, is_active, stock_quantity
) VALUES (
  '${TEST_PRODUCT_ID}', '${TEST_CLIENT_ID}',
  'سماعات بلوتوث لاسلكية برو', 'سماعات عالية الجودة مع خاصية إلغاء الضوضاء وعمر بطارية 40 ساعة',
  120.00, 'SKU-BT-PRO-001', 'إلكترونيات', 'PROD-001', true, 100
);

-- 6. product_dna (minimal, just so the landing_pages row can reference it)
INSERT INTO public.product_dna (
  id, client_id, product_id, headline, unique_selling_proposition, value_proposition,
  benefits, icp, testimonials, customer_avatars, media_assets, faqs, target_audience,
  core_facts, icp_profile, marketing_synthesis, raw_input, version,
  tone_of_voice, brand_colors, fonts
) VALUES (
  '${TEST_DNA_ID}', '${TEST_CLIENT_ID}', '${TEST_PRODUCT_ID}',
  'صوت نقي بلا ضوضاء',
  'أحدث تقنيات إلغاء الضوضاء النشطة مع عمر بطارية 40 ساعة',
  'احصل على تجربة صوتية احترافية بسعر لا يُقاوم',
  ARRAY['إلغاء ضوضاء فعال', 'بطارية 40 ساعة', 'بلوتوث 5.3', 'مقاومة للماء IPX5', 'ميكروفون مدمج عالي الوضوح'],
  '{"primary":{"label":"شباب 25-45","description":"محبو التقنية"},"pain_points":["جودة صوت منخفضة","عمر بطارية قصير"]}'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '{"primary_audience":"شباب مهتمون بالموسيقى والتقنية"}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '1',
  'احترافي ودافئ',
  '{"primary":"#1f1f1c"}'::jsonb,
  '{"heading":"Alexandria","body":"Cairo"}'::jsonb
);

-- 7. landing_pages (the Soctiv config lives in the config jsonb; theme_config +
-- content_data are required NOT NULL jsonb placeholders for legacy columns).
INSERT INTO public.landing_pages (
  id, client_id, product_id, product_dna_id, subdomain, status,
  title, template_id, theme_config, content_data, config
) VALUES (
  '${TEST_PAGE_ID}', '${TEST_CLIENT_ID}', '${TEST_PRODUCT_ID}', '${TEST_DNA_ID}',
  'test', 'draft',
  'سماعات بلوتوث برو — soctiv',
  'soctiv-pro',
  '{}'::jsonb,
  '{}'::jsonb,
  $CONFIG$
{
  "business": {
    "brand": "soctiv",
    "copyright": "جميع الحقوق محفوظة",
    "supportEmail": "support@example.com",
    "privacyEmail": "privacy@example.com"
  },
  "product": {
    "id": "PROD-001",
    "code": "PROD-001",
    "nameArabic": "سماعات بلوتوث لاسلكية برو",
    "name": "Wireless Bluetooth Pro",
    "category": "إلكترونيات",
    "currency": "د.ل",
    "value": 120,
    "compareAt": 180,
    "discountPercent": 33
  },
  "hero": {
    "headline": "صوت نقي بلا ضوضاء",
    "subline": "سماعات احترافية مع إلغاء ضوضاء فعال وعمر بطارية 40 ساعة — توصيل مجاني وضمان سنة كاملة",
    "cta": "اطلب الآن"
  },
  "seo": {
    "title": "سماعات بلوتوث برو — الدفع عند الاستلام",
    "description": "سماعات احترافية بسعر 120 د.ل مع توصيل مجاني وضمان سنة"
  },
  "form": {
    "submitText": "تأكيد الطلب"
  },
  "pricing": {
    "tiers": [
      {"qty": 1, "unitPrice": 120, "discount": 0},
      {"qty": 2, "unitPrice": 108, "discount": 10},
      {"qty": 3, "unitPrice": 99, "discount": 17}
    ],
    "maxQty": 3,
    "discountLabel": "التخفيض"
  },
  "theme": {
    "palette": "charcoal-mint",
    "font": "Alexandria"
  },
  "trust": {
    "badges": {"enabled": true, "items": ["الدفع عند الاستلام", "توصيل مجاني", "ضمان سنة", "منتج أصلي"]},
    "row": {"enabled": true, "items": ["دفع عند الاستلام", "توصيل مجاني", "ضمان سنة"]}
  },
  "reviews": {
    "enabled": true,
    "heading": "ماذا يقول عملاؤنا",
    "subheading": "",
    "items": [
      {"name": "أحمد م.", "rating": 5, "text": "منتج ممتاز، جودة الصوت رائعة"},
      {"name": "سارة ع.", "rating": 5, "text": "التوصيل كان سريع والمنتج أصلي"}
    ]
  },
  "faqs": [
    {"q": "هل المنتج أصلي؟", "a": "نعم، جميع منتجاتنا أصلية ومضمونة سنة كاملة."},
    {"q": "كم رسوم التوصيل؟", "a": "التوصيل مجاني لجميع المدن."}
  ],
  "webhook": {
    "source": "Landing Page"
  },
  "tracking": {
    "pixelId": "",
    "debug": false
  }
}
  $CONFIG$::jsonb
);

-- Return everything we created
SELECT
  '${TEST_USER_ID}'::uuid AS user_id,
  '${TEST_PROFILE_ID}'::uuid AS profile_id,
  '${TEST_CLIENT_ID}'::uuid AS client_id,
  '${TEST_PRODUCT_ID}'::uuid AS product_id,
  '${TEST_DNA_ID}'::uuid AS dna_id,
  '${TEST_PAGE_ID}'::uuid AS landing_page_id;
`;

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
if (!res.ok) {
    console.error(`SQL failed: ${res.status}\n${text.slice(0, 1000)}`);
    process.exit(1);
}
console.log(text);