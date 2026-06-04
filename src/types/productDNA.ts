/**
 * Product DNA — Strictly typed interfaces for the entire Product DNA pipeline.
 * These map 1:1 to the JSON schemas enforced by OpenRouter multi-step chaining.
 */

export type PricingModel = 'one-time' | 'subscription' | 'tiered' | 'freemium' | 'negotiable';
export type Gender = 'male' | 'female' | 'other' | 'unspecified' | null;

// ─── Step 1: Core Fact Extraction ───────────────────────────────────────────

export interface ProductCoreFacts {
    /** Primary product name / brand */
    productName: string;

    /** Short one-line tagline */
    tagline: string;

    /** Full product description in structured format */
    description: {
        summary: string;
        keyFeatures: readonly string[];
        specifications: Record<string, string>;
        useCases: readonly string[];
    };

    /** Pricing information */
    pricing: {
        price: number;
        currency: string;
        paymentTerms: string | null;
        /** e.g. "subscription", "one-time", "tiered", "freemium", "negotiable" */
        pricingModel: PricingModel;
    };

    /** Visual and media assets */
    media: {
        productImages: readonly string[];
        demoVideoUrl: string | null;
    };

    /** Categorization */
    category: readonly string[];
    tags: readonly string[];

    /** Unique selling points extracted from raw data */
    uniqueSellingPoints: readonly string[];

    /** Any promotional offers */
    offers: readonly string[];
}

// ─── Step 2: ICP Profiling ──────────────────────────────────────────────────

export interface ICPProfile {
    /** Target market / industry */
    industry: string;

    /** Demographic details */
    demographics: {
        ageRange: readonly [number, number];
        gender: Gender;
        incomeRange: readonly [number, number];
        education: string | null;
        location: readonly string[];
        occupation: readonly string[];
    };

    /** Psychographic details */
    psychographics: {
        values: readonly string[];
        interests: readonly string[];
        lifestyle: readonly string[];
        painPoints: readonly string[];
        desires: readonly string[];
    };

    /** Behavioural traits */
    behavior: {
        buyingHabits: readonly string[];
        preferredChannels: readonly string[];
        decisionFactors: readonly string[];
        objections: readonly string[];
    };

    /** Specific problems this ICP faces that the product solves */
    primaryPainPoints: readonly string[];

    /** The core desires that drive purchase */
    coreDesires: readonly string[];

    /** Summary persona description */
    personaSummary: string;
}

// ─── Step 3: Marketing Synthesis ────────────────────────────────────────────

export type AwarenessLevel = 'unaware' | 'problem_aware' | 'solution_aware' | 'product_aware' | 'most_aware';

export interface MarketingAngle {
    angleName: string;
    level?: AwarenessLevel;
    headline: string;
    subheadline: string;
    bodyCopy: string;
    targetPainPoint: string;
    emotionalAppeal: string;
}

export interface ProofSection {
    testimonials: readonly string[];
    statistics: readonly string[];
    caseStudies: readonly string[];
    socialProof: readonly string[];
    guarantees: readonly string[];
}

export interface MarketingSynthesis {
    /** Primary value proposition */
    primaryValueProposition: string;

    /** Elevator pitch (1-2 sentences) */
    elevatorPitch: string;

    /** Multiple marketing angles for A/B testing */
    marketingAngles: readonly MarketingAngle[];

    /** Proof section to build trust */
    proofSection: ProofSection;

    /** Recommended call-to-action variations */
    callToActions: readonly string[];

    /** SEO keywords */
    seoKeywords: readonly string[];

    /** Recommended marketing channels */
    recommendedChannels: readonly string[];

    /** Competitive positioning */
    competitivePositioning: {
        directCompetitors: readonly string[];
        differentiation: readonly string[];
        marketGap: string;
    };
}

// ─── Unified Product DNA ────────────────────────────────────────────────────

export interface ProductDNA {
    /** Metadata */
    id: string;
    clientId: string;
    productId: string;
    version: string;
    generatedAt: string;

    /** Raw input that triggered generation */
    rawInput: Record<string, unknown>;

    /** Step 1: Core Facts */
    coreFacts: ProductCoreFacts;

    /** Step 2: ICP Profile */
    icpProfile: ICPProfile;

    /** Step 3: Marketing Synthesis */
    marketingSynthesis: MarketingSynthesis;
}

// ─── API types for OpenRouter ───────────────────────────────────────────────

export interface OpenRouterMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface OpenRouterRequest {
    model: string;
    messages: OpenRouterMessage[];
    response_format?: { type: 'json_object' };
    temperature?: number;
    max_tokens?: number;
}

export interface OpenRouterResponse {
    id: string;
    choices: {
        message: {
            content: string;
            role: string;
        };
        finish_reason: string;
    }[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface OpenRouterError {
    error: {
        code: number;
        message: string;
    };
}