/**
 * Landing Page AI Generation Service
 *
 * Takes Product DNA data and generates structured landing page content
 * that templates consume. Uses OpenRouter for AI generation.
 */
import { callOpenRouter } from "./openRouterService";
import { callGoogleAI } from "./googleAiService";
import { loadAIConfig } from "./aiConfigService";
import type { OpenRouterMessage } from "@/types/productDNA";
import { supabase as rawSupabase } from "@/integrations/supabase/client";

// Use type-asserted supabase to avoid generated type mismatches
const supabase = rawSupabase as any;
import type {
  LandingPageContent,
  LandingPageTheme,
  LandingPageGenerationResponse,
  LandingPageTemplate,
} from "@/types/landingPage";
import { getTemplateById } from "@/types/landingPage";

// ─── System Prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a world-class landing page copywriter and conversion optimization expert specializing in Arabic markets.

Your job is to generate a complete landing page content as a JSON object. You must also suggest a color theme that matches the product's brand identity.

IMPORTANT: Generate ALL text content in ARABIC LANGUAGE (except brand names, technical terms, and numbers).

Return a valid JSON object with this EXACT structure:
{
  "content": {
    "hero": {
      "headline": "string (Arabic) — punchy, benefit-driven headline, max 10 words",
      "subheadline": "string (Arabic) — supporting line that expands on the headline",
      "ctaText": "string (Arabic) — action button text, e.g. 'اطلب الآن', 'احجز استشارة مجانية'",
      "imageUrl": null
    },
    "features": [
      {
        "icon": "string — emoji or lucide icon name that represents this feature",
        "title": "string (Arabic) — feature name, max 5 words",
        "description": "string (Arabic) — 1-2 sentence description of the benefit"
      }
    ],
    "proofSection": {
      "stats": [
        {
          "value": "string — impressive number, e.g. '10,000+'",
          "label": "string (Arabic) — what the stat represents"
        }
      ],
      "testimonials": [
        {
          "quote": "string (Arabic) — realistic customer testimonial, 1-2 sentences",
          "author": "string (Arabic) — customer name",
          "role": "string (Arabic) — their title or description"
        }
      ],
      "guarantees": [
        "string (Arabic) — guarantee or promise, e.g. 'ضمان استرداد المبلغ خلال 30 يوم'"
      ]
    },
    "cta": {
      "headline": "string (Arabic) — final CTA section headline",
      "subheadline": "string (Arabic) — urgency or benefit statement",
      "buttonText": "string (Arabic) — CTA button text",
      "formFields": [
        {
          "name": "first_name",
          "label": "string (Arabic) — field label",
          "type": "text",
          "required": true,
          "placeholder": "string (Arabic)"
        },
        {
          "name": "phone",
          "label": "string (Arabic) — field label",
          "type": "tel",
          "required": true,
          "placeholder": "string (Arabic)"
        }
      ]
    },
    "seo": {
      "title": "string (Arabic) — SEO page title, 50-60 chars",
      "description": "string (Arabic) — meta description, 150-160 chars",
      "keywords": ["string (Arabic) — relevant keywords"]
    }
  },
  "theme": {
    "primaryColor": "string — hex color",
    "secondaryColor": "string — hex color",
    "accentColor": "string — hex color",
    "backgroundColor": "string — hex color",
    "textColor": "string — hex color",
    "headingFont": "string — one of: Inter, Cairo, Tajawal, Noto Sans Arabic",
    "bodyFont": "string — one of: Inter, Cairo, Tajawal, Noto Sans Arabic",
    "borderRadius": "string — one of: 0px, 4px, 8px, 12px, 16px, 9999px"
  }
}

Rules:
- Generate 3-5 features that highlight the product's unique value
- Generate 2-3 realistic testimonials
- Generate 2-3 guarantees that reduce buyer anxiety
- Generate 2-4 stats that build credibility
- Keep form fields minimal (name + phone minimum, optionally email)
- SEO keywords should be realistic search terms in Arabic
- Theme colors should complement the product's brand feel
- All testimonials must sound authentic, not generic
- Headlines should be benefit-driven, not feature-driven`;

// ─── Generation Function ────────────────────────────────────────────────────

/**
 * Generate landing page content from Product DNA.
 * Auto-detects AI provider (Google AI or OpenRouter) from config.
 */
export async function generateLandingPageContent(
  productDna: Record<string, unknown>,
  templateId: string,
  signal?: AbortSignal
): Promise<LandingPageGenerationResponse> {
  const coreFacts = productDna.core_facts as Record<string, unknown> | null;
  const icpProfile = productDna.icp_profile as Record<string, unknown> | null;
  const marketingSynthesis = productDna.marketing_synthesis as Record<string, unknown> | null;

  const template = getTemplateById(templateId);
  if (!template) {
    throw new Error(`Template "${templateId}" not found`);
  }

  const userMessage = `Generate a landing page based on the following Product DNA:

## Product Core Facts:
${JSON.stringify(coreFacts, null, 2)}

## Ideal Customer Profile:
${JSON.stringify(icpProfile, null, 2)}

## Marketing Strategy:
${JSON.stringify(marketingSynthesis, null, 2)}

## Template Style: ${template.nameAr} (${template.name})
Use this template's default theme as a starting point, but adjust colors to match the product's brand identity:
${JSON.stringify(template.defaultTheme, null, 2)}

Generate the complete landing page JSON. Return ONLY valid JSON.`;

  const messages: OpenRouterMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  // Auto-detect provider from config
  const aiConfig = loadAIConfig();
  let result: Record<string, unknown>;

  if (aiConfig.provider === 'google_ai' && aiConfig.googleAI.apiKey) {
    const text = await callGoogleAI(messages, {
      model: aiConfig.googleAI.model,
      temperature: 0.4,
      maxTokens: 4096,
      signal,
    });
    result = JSON.parse(text) as Record<string, unknown>;
  } else {
    result = await callOpenRouter(
      {
        model: "openai/gpt-4o-mini",
        messages,
      },
      {
        temperature: 0.4,
        maxTokens: 4096,
        signal,
      }
    );
  }

  // Parse and validate
  const generated = result as Record<string, unknown>;
  const content = generated.content as LandingPageContent;
  const themeOverride = generated.theme as Partial<LandingPageTheme>;

  if (!content?.hero?.headline) {
    throw new Error("AI generation failed: invalid content structure");
  }

  // Merge theme with template defaults
  const theme: LandingPageTheme = {
    ...template.defaultTheme,
    ...(themeOverride || {}),
  };

  return { content, theme };
}

/**
 * Save generated content to the landing page record.
 */
export async function saveLandingPageContent(
  landingPageId: string,
  content: LandingPageContent,
  theme: LandingPageTheme
): Promise<void> {
  const { error } = await supabase
    .from("landing_pages")
    .update({
      content_data: content as any,
      theme_config: theme as any,
    })
    .eq("id", landingPageId as any);

  if (error) throw error;
}

/**
 * Full pipeline: generate + save in one call.
 */
export async function generateAndSaveLandingPage(
  landingPageId: string,
  productDnaId: string,
  templateId: string,
  signal?: AbortSignal
): Promise<LandingPageGenerationResponse> {
  // Fetch Product DNA
  const { data: dnaData, error: dnaError } = await supabase
    .from("product_dna")
    .select("*")
    .eq("id", productDnaId as any)
    .single();

  if (dnaError || !dnaData) {
    throw new Error(`Failed to fetch Product DNA: ${dnaError?.message || "Not found"}`);
  }

  // Generate content
  const { content, theme } = await generateLandingPageContent(
    dnaData,
    templateId,
    signal
  );

  // Save
  await saveLandingPageContent(landingPageId, content, theme);

  return { content, theme };
}