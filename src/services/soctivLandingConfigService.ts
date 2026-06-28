/**
 * Soctiv Landing Config — AI generation service.
 *
 * Generates a complete `SoctivLandingConfig` from Product DNA + product fields.
 * The output is what the publish edge function (`publish-landing-page`)
 * renders into the published static HTML and ships to Netlify.
 *
 * Design rules (enforced by the system prompt):
 *   - All marketing copy in Arabic (numbers + brand names stay as-is).
 *   - 3 objections (Q&A) covering delivery, authenticity, and inspection.
 *   - 3 social-proof reviews with realistic Libyan names + cities.
 *   - Pricing tiers: 1..maxQty with monotonic discounts (5 tiers default).
 *   - Palette: pick from {cream-sage, ivory-teal, sand-amber}.
 *   - Font: pick from {Alexandria, IBM Plex Sans Arabic, Cairo}.
 *
 * What the AI does NOT generate (use market defaults instead):
 *   - phone regex / country / currency / language direction
 *   - webhook URL / client code / product code (auto-stamped at publish)
 *   - meta pixel ID / CAPI URL
 *   - business info (brand, emails)
 *
 * The system prompt is intentionally written with strict JSON shape
 * constraints because minor shape drift here breaks the build pipeline.
 */
import { callOpenRouter } from './openRouterService';
import { callGoogleAI } from './googleAiService';
import { loadAIConfig } from './aiConfigService';
import type { OpenRouterMessage } from '@/types/productDNA';
import { supabase as rawSupabase } from '@/integrations/supabase/client';
const supabase = rawSupabase as any;

import {
    type SoctivLandingConfig,
    type SoctivSectionKey,
    buildDefaultSoctivConfig,
    DEFAULT_SOCTIV_THEME_PALETTES,
    DEFAULT_SOCTIV_FONTS,
} from '@/types/soctivLandingConfig';

// ─── Input shape ────────────────────────────────────────────────────────────

export interface GenerateSoctivConfigInput {
    productDna?: Record<string, unknown>;
    product: {
        id: string;
        code?: string;
        name: string;
        nameArabic?: string;
        imageUrl: string | null;
        price: number;
        category?: string;
    };
    market?: {
        country?: string;
        currency?: 'LYD';
        phoneRegex?: string;
    };
    /** When true, only the listed section keys are returned (used by the
     *  per-section "Regenerate" button). The rest of the config is taken
     *  from `currentConfig` and merged in. */
    sectionOnly?: ReadonlyArray<SoctivSectionKey>;
    /** Free-text guidance from the user when regenerating a section. */
    guidance?: string;
    signal?: AbortSignal;
}

// ─── System prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a world-class Arabic landing-page copywriter for Libyan / North-African ecommerce (RTL, cash-on-delivery, Facebook-lead-generation funnels).

You will be given a Product DNA object describing a physical or digital product, plus its product price. Your job is to return a JSON object matching the EXACT shape below — only the fields you can fill (Arabic marketing copy and a theme choice).

OUTPUT LANGUAGE: Arabic for all marketing copy. Brand names, numbers, and proper nouns can stay as-is. Currency symbols (e.g. د.ل) are written in Arabic.

Return ONLY valid JSON. No prose, no markdown, no commentary.

{
  "hero": {
    "headline": "Arabic, max 10 words, benefit-driven (not feature-driven). Use the customer's pain point + the outcome.",
    "subline": "Arabic, 1-2 sentences. Expand on the headline with a concrete benefit.",
    "ctaText": "Arabic, e.g. 'اطلب الآن — الدفع عند الاستلام'",
    "imageAlt": "Arabic, short alt text describing the product image"
  },
  "product": {
    "metaLine": "Arabic, short one-liner under product name on the order card. e.g. 'إلغاء ضوضاء · ضمان سنة'"
  },
  "objections": {
    "heading": "Arabic, max 8 words, e.g. 'ثلاثة أسئلة تشغلك — وإجاباتها'",
    "subheading": "Arabic, 1 short sentence",
    "items": [
      { "q": "Arabic question", "a": "Arabic answer (1-2 sentences)" },
      ...EXACTLY 3 items. Order them: 1) delivery time, 2) authenticity + warranty, 3) inspection-before-payment / risk-reversal.
    ]
  },
  "reviews": {
    "heading": "Arabic, e.g. 'ماذا يقول عملاؤنا'",
    "subheading": "Arabic, 1 short sentence",
    "items": [
      { "name": "Arabic full name, e.g. 'أحمد م.'", "location": "Libyan city, e.g. 'طرابلس'", "text": "Arabic review, 1-2 sentences", "initial": "single Arabic letter for avatar (first letter of name)" },
      ...EXACTLY 3 items. Use realistic Libyan names + diverse cities (طرابلس, بنغازي, مصراتة, الزاوية, زليتن, سبها, الخمس...).
    ]
  },
  "trust": {
    "badges": [ "Arabic, 2-4 words" ...3 entries total ],
    "row":    [ "Arabic, 2-4 words" ...2 entries total ]
  },
  "form": {
    "submitText": "Arabic, e.g. 'تأكيد الطلب'"
  },
  "seo": {
    "title": "Arabic, 50-60 chars. Include the product name and a benefit.",
    "description": "Arabic, 150-160 chars. Hook + what they get + CTA."
  },
  "theme": {
    "palette": "ONE of: 'cream-sage' (warm cream + sage green, default), 'ivory-teal' (clean ivory + teal, for tech/health), 'sand-amber' (warm sand + amber, for luxury/beauty).",
    "font": "ONE of: 'Alexandria', 'IBM Plex Sans Arabic', 'Cairo'. 'Alexandria' is the safe default for Arabic landing pages."
  }
}

GUIDANCE (if provided in the user message): If the user gives free-text guidance like "make it more emotional" or "focus on women 30+", apply that to ALL relevant text fields. Stay inside the schema — do not add or rename fields.

RULES:
- No English in marketing copy except proper nouns, brand names, and numbers.
- No placeholder text like "Lorem ipsum" or "[Your text]".
- No promises that would mislead (e.g. medical cures for beauty products).
- Objections and reviews arrays MUST have exactly 3 entries each. Never 2, never 4.
- Trust.badges has exactly 3 entries. Trust.row has exactly 2 entries.
- Output ONLY the JSON object. No preamble.`;

// ─── Generation ─────────────────────────────────────────────────────────────

/** Generate the full SoctivLandingConfig. Returns a valid config — the AI
 *  fills the variable parts (Arabic copy + theme) and we fill the rest from
 *  product + market defaults. */
export async function generateSoctivLandingConfig(
    input: GenerateSoctivConfigInput
): Promise<SoctivLandingConfig> {
    const base = buildDefaultSoctivConfig({
        product: {
            id: input.product.id,
            code: input.product.code,
            name: input.product.name,
            nameArabic: input.product.nameArabic,
            imageUrl: input.product.imageUrl,
            price: input.product.price,
            category: input.product.category,
        },
        market: input.market,
    });

    const userMessage = buildUserPrompt(input, base);
    const messages: OpenRouterMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
    ];

    const aiConfig = loadAIConfig();
    let raw: Record<string, unknown>;
    if (aiConfig.provider === 'google_ai' && aiConfig.googleAI.apiKey) {
        const text = await callGoogleAI(messages, {
            model: aiConfig.googleAI.model,
            temperature: 0.7,
            maxTokens: 4096,
            signal: input.signal,
        });
        raw = safeJsonParse(text);
    } else {
        raw = await callOpenRouter(
            {
                model: 'openai/gpt-4o-mini',
                messages,
                response_format: { type: 'json_object' },
            },
            {
                temperature: 0.7,
                maxTokens: 4096,
                signal: input.signal,
            }
        );
    }

    return mergeAiOutputIntoConfig(raw, base, input);
}

/** Regenerate just one section (or a small set) of an existing config. Used
 *  by the editor's per-section "Regenerate with AI" button. */
export async function regenerateSoctivSection(
    currentConfig: SoctivLandingConfig,
    sectionKey: SoctivSectionKey,
    guidance?: string,
    signal?: AbortSignal
): Promise<SoctivLandingConfig> {
    const newConfig = await generateSoctivLandingConfig({
        productDna: {},
        product: {
            id: currentConfig.product.id,
            code: currentConfig.product.code,
            name: currentConfig.product.name,
            nameArabic: currentConfig.product.nameArabic,
            imageUrl: currentConfig.product.image || null,
            price: currentConfig.product.value,
            category: currentConfig.product.category,
        },
        sectionOnly: [sectionKey],
        guidance,
        signal,
    });

    if (sectionKey === 'theme') {
        return { ...currentConfig, theme: newConfig.theme };
    }
    return {
        ...currentConfig,
        [sectionKey]: (newConfig as any)[sectionKey],
    };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildUserPrompt(
    input: GenerateSoctivConfigInput,
    base: SoctivLandingConfig
): string {
    const dna = input.productDna || {};
    const parts: string[] = [];

    parts.push(`Product name: ${input.product.name}`);
    if (input.product.nameArabic) parts.push(`Product name (Arabic): ${input.product.nameArabic}`);
    parts.push(`Product price: ${input.product.price} ${base.product.currency}`);
    parts.push(`Country: ${base.business.country}`);
    parts.push(`Currency: ${base.product.currency} (${base.product.currencySymbol})`);

    if (Object.keys(dna).length > 0) {
        parts.push('');
        parts.push('Product DNA:');
        parts.push(JSON.stringify(dna, null, 2));
    }

    if (input.sectionOnly && input.sectionOnly.length > 0) {
        parts.push('');
        parts.push(`REGENERATE ONLY THESE SECTIONS: ${input.sectionOnly.join(', ')}`);
        parts.push(
            'For other sections, leave them out of the response OR repeat the existing values.'
        );
    }

    if (input.guidance) {
        parts.push('');
        parts.push(`USER GUIDANCE: ${input.guidance}`);
    }

    parts.push('');
    parts.push('Return the JSON object now.');

    return parts.join('\n');
}

function safeJsonParse(text: string): Record<string, unknown> {
    // Strip markdown code fences if the model wraps the output anyway.
    const cleaned = text
        .trim()
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/, '')
        .trim();
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        // Try to extract the first {...} block.
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                return JSON.parse(match[0]);
            } catch {
                throw new Error(`AI returned invalid JSON: ${(e as Error).message}`);
            }
        }
        throw new Error(`AI returned invalid JSON: ${(e as Error).message}`);
    }
}

function mergeAiOutputIntoConfig(
    raw: Record<string, unknown>,
    base: SoctivLandingConfig,
    _input: GenerateSoctivConfigInput
): SoctivLandingConfig {
    const out: SoctivLandingConfig = JSON.parse(JSON.stringify(base));

    // ─── Hero
    if (raw.hero && typeof raw.hero === 'object') {
        const h = raw.hero as Record<string, string>;
        if (h.headline) out.hero.headline = h.headline;
        if (h.subline) out.hero.subline = h.subline;
        if (h.ctaText) out.hero.ctaText = h.ctaText;
        if (h.imageAlt) out.hero.imageAlt = h.imageAlt;
    }

    // ─── Product
    if (raw.product && typeof raw.product === 'object') {
        const p = raw.product as Record<string, string>;
        if (p.metaLine) out.product.metaLine = p.metaLine;
    }

    // ─── Objections
    if (raw.objections && typeof raw.objections === 'object') {
        const o = raw.objections as Record<string, any>;
        if (o.heading) out.objections.heading = o.heading;
        if (o.subheading) out.objections.subheading = o.subheading;
        if (Array.isArray(o.items) && o.items.length > 0) {
            const items = o.items
                .slice(0, 3)
                .map((it: any) => ({
                    q: String(it?.q || ''),
                    a: String(it?.a || ''),
                }));
            // Pad / truncate to exactly 3
            while (items.length < 3) {
                items.push({ q: '', a: '' });
            }
            out.objections.items = items;
        }
    }

    // ─── Reviews
    if (raw.reviews && typeof raw.reviews === 'object') {
        const r = raw.reviews as Record<string, any>;
        if (r.heading) out.reviews.heading = r.heading;
        if (r.subheading) out.reviews.subheading = r.subheading;
        if (Array.isArray(r.items) && r.items.length > 0) {
            const items = r.items
                .slice(0, 3)
                .map((it: any) => ({
                    name: String(it?.name || ''),
                    location: String(it?.location || ''),
                    text: String(it?.text || ''),
                    initial: String(it?.initial || '').slice(0, 1),
                }));
            while (items.length < 3) {
                items.push({ name: '', location: '', text: '', initial: '' });
            }
            out.reviews.items = items;
        }
    }

    // ─── Trust
    if (raw.trust && typeof raw.trust === 'object') {
        const t = raw.trust as Record<string, any>;
        if (Array.isArray(t.badges)) {
            out.trust.badges = t.badges.slice(0, 5).map((s: any) => String(s || ''));
        }
        if (Array.isArray(t.row)) {
            out.trust.row = t.row.slice(0, 4).map((s: any) => String(s || ''));
        }
    }

    // ─── Form
    if (raw.form && typeof raw.form === 'object') {
        const f = raw.form as Record<string, string>;
        if (f.submitText) out.form.submitText = f.submitText;
    }

    // ─── SEO
    if (raw.seo && typeof raw.seo === 'object') {
        const s = raw.seo as Record<string, string>;
        if (s.title) out.seo.title = s.title;
        if (s.description) out.seo.description = s.description;
    }

    // ─── Theme (validate against allowlist)
    if (raw.theme && typeof raw.theme === 'object') {
        const t = raw.theme as Record<string, string>;
        if (t.palette && (DEFAULT_SOCTIV_THEME_PALETTES as readonly string[]).includes(t.palette)) {
            out.theme.palette = t.palette as SoctivLandingConfig['theme']['palette'];
        }
        if (t.font && (DEFAULT_SOCTIV_FONTS as readonly string[]).includes(t.font)) {
            out.theme.font = t.font as SoctivLandingConfig['theme']['font'];
        }
    }

    // ─── Fallbacks (any AI field that came back empty inherits a sensible default)
    if (!out.hero.headline) {
        out.hero.headline = `${out.product.nameArabic} — الحل الأمثل`;
    }
    if (!out.hero.subline) {
        out.hero.subline = `اطلب ${out.product.nameArabic} الآن وادفع عند الاستلام في جميع المدن الليبية.`;
    }
    if (!out.seo.title && out.hero.headline) {
        out.seo.title = `${out.product.nameArabic} — ${out.hero.headline}`.slice(0, 60);
    }
    if (!out.seo.description && out.hero.subline) {
        out.seo.description = out.hero.subline.slice(0, 160);
    }
    if (!out.product.metaLine) {
        out.product.metaLine = `منتج أصلي 100% — توصيل سريع`;
    }

    return out;
}

// ─── DB persistence ────────────────────────────────────────────────────────

/** Save the config to the landing_pages row's `config` JSONB column. */
export async function saveSoctivLandingConfig(
    landingPageId: string,
    config: SoctivLandingConfig
): Promise<void> {
    const { error } = await supabase
        .from('landing_pages')
        .update({ config: config as any })
        .eq('id', landingPageId as any);
    if (error) throw error;
}

/** Load the config from a landing_pages row. Returns null if empty. */
export async function loadSoctivLandingConfig(
    landingPageId: string
): Promise<SoctivLandingConfig | null> {
    const { data, error } = await supabase
        .from('landing_pages')
        .select('config')
        .eq('id', landingPageId as any)
        .single();
    if (error || !data) return null;
    const cfg = (data as any).config;
    if (!cfg || typeof cfg !== 'object' || Object.keys(cfg).length === 0) return null;
    return cfg as SoctivLandingConfig;
}

/** Pipeline: generate + save in one call. The full "create a new landing
 *  page from a product" entry point used by the editor. */
export async function generateAndSaveSoctivLandingPage(
    landingPageId: string,
    productDnaId: string,
    productId: string,
    market?: GenerateSoctivConfigInput['market'],
    signal?: AbortSignal
): Promise<SoctivLandingConfig> {
    const [dnaResult, productResult] = await Promise.all([
        supabase.from('product_dna').select('*').eq('id', productDnaId as any).single(),
        supabase
            .from('products')
            .select('id, name, image_url, price, code, category')
            .eq('id', productId as any)
            .single(),
    ]);
    if (dnaResult.error || !dnaResult.data) {
        throw new Error(
            `Failed to fetch Product DNA: ${dnaResult.error?.message || 'Not found'}`
        );
    }
    if (productResult.error || !productResult.data) {
        throw new Error(`Failed to fetch product: ${productResult.error?.message || 'Not found'}`);
    }
    const product = productResult.data as any;
    const config = await generateSoctivLandingConfig({
        productDna: dnaResult.data as Record<string, unknown>,
        product: {
            id: product.id,
            code: product.code || product.id,
            name: product.name,
            imageUrl: product.image_url || null,
            price: Number(product.price) || 0,
            category: product.category || undefined,
        },
        market,
        signal,
    });

    // Default webhook URL points at the existing facebook-leads-webhook
    // edge function. The CAPI proxy is separate.
    const supabaseUrl =
        (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
        '';
    if (!config.webhook.url && supabaseUrl) {
        config.webhook.url = `${supabaseUrl}/functions/v1/facebook-leads-webhook`;
    }
    if (!config.tracking.capiUrl && supabaseUrl) {
        config.tracking.capiUrl = `${supabaseUrl}/functions/v1/capi-proxy`;
    }

    await saveSoctivLandingConfig(landingPageId, config);
    return config;
}
