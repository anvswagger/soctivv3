/**
 * Product DNA — Strictly typed interfaces for the entire Product DNA pipeline.
 * v2: Smart onboarding wizard + facts-first AI generation.
 */

export type PricingModel = 'one-time' | 'subscription' | 'tiered' | 'freemium' | 'negotiable';
export type Gender = 'male' | 'female' | 'other' | 'unspecified' | null;

// ─── Onboarding: Smart MCQ Generation ──────────────────────────────────────

export interface GeneratedQuestionOption {
    /** Unique identifier for this option */
    id: string;
    /** The display text the user sees (Arabic) */
    label: string;
}

export interface GeneratedQuestion {
    /** Unique identifier for this question */
    id: string;
    /** The question text in clear, simple Arabic */
    question: string;
    /** 3-5 multiple choice options tailored to this specific product */
    options: GeneratedQuestionOption[];
    /** Which fact category this question covers */
    category: 'ingredients' | 'use_case' | 'format' | 'target' | 'price_range' | 'differentiator' | 'other';
}

/** The user's answers to the generated MCQs */
export interface OnboardingAnswer {
    questionId: string;
    category: string;
    /**
     * The option id the user picked. Empty string `''` if the user
     * skipped the question or typed a custom answer (no option selected).
     */
    selectedOptionId: string;
    /** The display text of the selected option, or empty string when skipped. */
    selectedLabel: string;
    /**
     * The user's free-text answer. Set when the user chose to type their
     * own answer instead of picking one of the MCQ options. The label
     * "إجابة المستخدم:" is added in `enhanceDescription` when this is set.
     */
    customText?: string;
    /** ISO timestamp of when the answer was recorded. */
    answeredAt: string;
}

/** Full onboarding data collected before DNA generation */
export interface OnboardingData {
    /** The original product description typed by the user */
    productDescription: string;
    /** The AI-generated questions */
    questions: GeneratedQuestion[];
    /** The user's answers */
    answers: OnboardingAnswer[];
    /** Timestamp */
    completedAt: string;
}

// ─── Step 1: Product Identity (from user input) ───────────────────────────

export interface ProductIdentity {
    /** Product name — from user's description */
    productName: string;
    /** Short tagline */
    tagline: string;
    /** Summary in user's own words, lightly refined */
    summary: string;
    /** Key features — AI expands on what user described */
    keyFeatures: readonly string[];
    /** Use cases — derived from product type */
    useCases: readonly string[];
    /** Pricing from onboarding */
    pricing: {
        price: number;
        currency: string;
        pricingModel: PricingModel;
    };
    /** Categories */
    category: readonly string[];
    /** Tags */
    tags: readonly string[];
    /** Unique selling points — from user's differentiator answer */
    uniqueSellingPoints: readonly string[];
}

// ─── Step 2: Target Customer Analysis (AI's job) ──────────────────────────

export type AwarenessLevel = 'unaware' | 'problem_aware' | 'solution_aware' | 'product_aware' | 'most_aware';

export interface TargetCustomer {
    /** Who is the ideal buyer — AI analyzes this from product type */
    personaSummary: string;
    /** Demographics the AI infers */
    demographics: {
        ageRange: readonly [number, number];
        gender: Gender;
        location: readonly string[];
        occupation: readonly string[];
    };
    /** Pain points the AI identifies for this product's market */
    painPoints: readonly string[];
    /** Core desires that drive purchase */
    coreDesires: readonly string[];
    /** Behavioral traits */
    behavior: {
        buyingHabits: readonly string[];
        preferredChannels: readonly string[];
        decisionFactors: readonly string[];
    };
}

// ─── Step 3: Marketing Strategy (AI's main job) ───────────────────────────

export interface MarketingAngle {
    /** Short strategic angle concept name */
    angleName: string;
    /** Awareness level this angle targets */
    level: AwarenessLevel;
    /** Brief explanation of why this angle works */
    reasoning: string;
}

export interface MarketingStrategy {
    /** Primary value proposition */
    primaryValueProposition: string;
    /** Elevator pitch (1-2 sentences) */
    elevatorPitch: string;
    /** Marketing angles grouped by awareness level */
    marketingAngles: readonly MarketingAngle[];
    /** Recommended CTAs */
    callToActions: readonly string[];
    /** SEO keywords */
    seoKeywords: readonly string[];
    /** Recommended marketing channels */
    recommendedChannels: readonly string[];
    /** Proof elements to build trust */
    proofSuggestions: {
        testimonialPrompts: readonly string[];
        statSuggestions: readonly string[];
        guaranteeIdeas: readonly string[];
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

    /** Onboarding data that triggered generation */
    onboarding: OnboardingData;

    /** Step 1: Product Identity (from user input) */
    productIdentity: ProductIdentity;

    /** Step 2: Target Customer Analysis (AI's job) */
    targetCustomer: TargetCustomer;

    /** Step 3: Marketing Strategy (AI's main job) */
    marketingStrategy: MarketingStrategy;
}

// ─── API types for AI providers ─────────────────────────────────────────────

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