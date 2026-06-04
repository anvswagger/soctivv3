/**
 * Product DNA Pipeline Service.
 *
 * Orchestrates the 3-step chained AI pipeline:
 *   1. Core Fact Extraction
 *   2. ICP Profiling
 *   3. Marketing Synthesis
 *
 * Each step passes its output as context to the next step.
 * All outputs are strictly typed JSON.
 */
import { callOpenRouter } from './openRouterService';
import { callGoogleAI } from './googleAiService';
import { loadAIConfig } from './aiConfigService';
import type {
    ProductCoreFacts,
    ICPProfile,
    MarketingSynthesis,
    ProductDNA,
    OpenRouterMessage,
} from '@/types/productDNA';

// ─── Prompt Templates ──────────────────────────────────────────────────────

const STEP1_SYSTEM_PROMPT = `أنت محلل بيانات منتجات. استخرج الحقائق الفعلية فقط من بيانات المنتج.

أرجع JSON بالشكل التالي:
{
  "productName": "اسم المنتج",
  "tagline": "عبارة قصيرة عن المنتج",
  "description": {
    "summary": "ملخص المنتج في 2-3 جمل",
    "keyFeatures": ["ميزة 1", "ميزة 2", "ميزة 3"],
    "specifications": {"المكونات": "الوصف", "الخصائص": "الوصف"},
    "useCases": ["حالة استخدام 1", "حالة استخدام 2"]
  },
  "pricing": {
    "price": 0,
    "currency": "LYD",
    "paymentTerms": null,
    "pricingModel": "one-time"
  },
  "media": { "productImages": [], "demoVideoUrl": null },
  "category": ["التصنيف"],
  "tags": ["وسم"],
  "uniqueSellingPoints": ["نقطة بيع 1"],
  "offers": ["عرض 1"]
}

القواعد:
- اكتب كل شيء بالعربية (عدا أكواد العملات والأرقام).
- استخرج الحقائق الموجودة فقط في المدخلات. لا تختلق معلومات.
- إذا لم يُذكر السعر، اجعله 0. العملة الافتراضية LYD.
- إذا لم يُذكر شيء، استخدم مصفوفة فارغة أو null.`;

const STEP2_SYSTEM_PROMPT = `أنت محلل سوق. حدد العميل المستهدف لهذا المنتج.

أرجع JSON بالشكل التالي:
{
  "industry": "الصناعة",
  "demographics": {
    "ageRange": [25, 45],
    "gender": null,
    "incomeRange": [0, 0],
    "education": null,
    "location": [],
    "occupation": []
  },
  "psychographics": {
    "values": [],
    "interests": [],
    "lifestyle": [],
    "painPoints": [],
    "desires": []
  },
  "behavior": {
    "buyingHabits": [],
    "preferredChannels": [],
    "decisionFactors": [],
    "objections": []
  },
  "primaryPainPoints": ["نقطة ألم 1", "نقطة ألم 2", "نقطة ألم 3"],
  "coreDesires": ["رغبة 1", "رغبة 2", "رغبة 3"],
  "personaSummary": "ملخص مختصر عن العميل المستهدف"
}

القواعد:
- اكتب كل شيء بالعربية.
- استنِد فقط على بيانات المنتج. لا تختلق معلومات.
- كن محدداً وواقعياً. تجنب اللغة التسويقية العامة.
- نقاط الألم والرغبات هي الأهم — كن واضحاً ومباشرة.`;

const STEP3_SYSTEM_PROMPT = `أنت استراتيجي تسويق. أنشئ زوايا تسويقية متنوعة مصنفة حسب مستوى وعي العميل.

أرجع JSON بالشكل التالي:
{
  "primaryValueProposition": "جملة واحدة واضحة لماذا يجب شراء هذا المنتج",
  "elevatorPitch": "عرض تقديمي مختصر في جملتين",
  "marketingAngles": [
    {
      "angleName": "اسم الزاوية",
      "level": "unaware | problem_aware | solution_aware | product_aware | most_aware",
      "headline": "عنوان جذاب",
      "subheadline": "عنوان فرعي",
      "bodyCopy": "نص إعلاني مقنع في 2-3 فقرات قصيرة",
      "targetPainPoint": "نقطة الألم التي تستهدفها",
      "emotionalAppeal": "الجانب العاطفي"
    }
  ],
  "proofSection": {
    "testimonials": [],
    "statistics": [],
    "caseStudies": [],
    "socialProof": [],
    "guarantees": []
  },
  "callToActions": [],
  "seoKeywords": [],
  "recommendedChannels": [],
  "competitivePositioning": {
    "directCompetitors": [],
    "differentiation": [],
    "marketGap": ""
  }
}

مستويات الوعي:
- unaware: العميل لا يعلم بالمشكلة
- problem_aware: العميل يعلم بالمشكلة لكن لا يعرف الحل
- solution_aware: العميل يعرف الحل لكن لا يعرف منتجك
- product_aware: العميل يعرف منتجك لكن غير متأكد
- most_aware: العميل على وشك الشراء

القواعد:
- اكتب كل شيء بالعربية.
- أنشئ 2-3 زوايا لكل مستوى وعي (إجمالاً 10-15 زاوية على الأقل).
- الزوايا يجب أن تستهدف نقاط ألم ورغبات العميل المحددة.
- كن مباشراً وواضحاً. تجnie اللغة الزائفة.`;

// ─── UUID Generation ───────────────────────────────────────────────────────

function generateId(): string {
    // Try using crypto.randomUUID (available in modern browsers)
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// ─── Helper: Build Raw Input ───────────────────────────────────────────────

function buildRawInput(productData: Record<string, unknown>, clientData: Record<string, unknown>): Record<string, unknown> {
    return {
        product: {
            name: productData.name,
            description: productData.description,
            price: productData.price,
            returnRate: productData.returnRate,
            offer: productData.offer,
            imageUrl: productData.imageUrl,
        },
        client: {
            companyName: clientData.company_name,
            specialty: clientData.specialty,
            workArea: clientData.work_area,
            strength: clientData.strength,
            achievements: clientData.achievements,
            headquarters: clientData.headquarters,
            promotionalOffer: clientData.promotional_offer,
        },
    };
}

function buildUserMessage(rawInput: Record<string, unknown>): string {
    return `Analyze the following product data and extract structured facts:

Product Data:
${JSON.stringify(rawInput.product, null, 2)}

Client/Business Context:
${JSON.stringify(rawInput.client, null, 2)}

Return ONLY valid JSON matching the specified schema.`;
}

// ─── Pipeline Steps ────────────────────────────────────────────────────────

function createStepMessages(
    systemPrompt: string,
    context: string
): OpenRouterMessage[] {
    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: context },
    ];
}

function createContextualStepMessages(
    systemPrompt: string,
    previousStepLabel: string,
    previousStepOutput: string,
    userInput: string
): OpenRouterMessage[] {
    return [
        { role: 'system', content: systemPrompt },
        {
            role: 'user',
            content: `Previous step (${previousStepLabel}) output:\n${previousStepOutput}\n\nOriginal product input:\n${userInput}\n\nBased on ALL of the above, generate the next analysis. Return ONLY valid JSON.`,
        },
    ];
}

// ─── Validation Utilities ────────────────────────────────────────────────────

function assertObject(data: unknown, step: number): asserts data is Record<string, unknown> {
    if (!data || typeof data !== 'object') throw new Error(`Step ${step} output is not an object`);
}

function assertString(value: unknown, field: string): asserts value is string {
    if (typeof value !== 'string' || !value) throw new Error(`${field} is required`);
}

function assertArray(value: unknown, field: string): asserts value is unknown[] {
    if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
}

function assertNonEmptyArray<T>(value: unknown, field: string): asserts value is T[] {
    if (!Array.isArray(value) || value.length === 0) throw new Error(`${field} must be a non-empty array`);
}

function extractJsonFromText(text: string): string {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence && fence[1]) return fence[1].trim();

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
        const candidate = text.slice(start, end + 1).trim();
        if (candidate.startsWith('{') && candidate.endsWith('}')) return candidate;
    }

    throw new Error('No JSON object found in model output');
}

function validateStep1(data: unknown): ProductCoreFacts {
    assertObject(data, 1);
    assertString(data.productName, 'Step 1: productName');
    if (typeof data.tagline !== 'string') throw new Error('Step 1: tagline is required');
    if (!data.description || typeof data.description !== 'object') throw new Error('Step 1: description is required');
    assertArray(data.uniqueSellingPoints, 'Step 1: uniqueSellingPoints');
    if (!data.pricing || typeof data.pricing !== 'object') throw new Error('Step 1: pricing is required');
    return data as unknown as ProductCoreFacts;
}

function validateStep2(data: unknown): ICPProfile {
    assertObject(data, 2);
    assertString(data.industry, 'Step 2: industry');
    if (!data.demographics || typeof data.demographics !== 'object') throw new Error('Step 2: demographics is required');
    if (!data.psychographics || typeof data.psychographics !== 'object') throw new Error('Step 2: psychographics is required');
    assertArray(data.primaryPainPoints, 'Step 2: primaryPainPoints');
    assertArray(data.coreDesires, 'Step 2: coreDesires');
    return data as unknown as ICPProfile;
}

function validateStep3(data: unknown): MarketingSynthesis {
    assertObject(data, 3);
    assertString(data.primaryValueProposition, 'Step 3: primaryValueProposition');
    assertNonEmptyArray(data.marketingAngles, 'Step 3: marketingAngles');
    if (!data.proofSection || typeof data.proofSection !== 'object') throw new Error('Step 3: proofSection is required');
    assertArray(data.callToActions, 'Step 3: callToActions');
    assertArray(data.seoKeywords, 'Step 3: seoKeywords');
    return data as unknown as MarketingSynthesis;
}

// ─── Step Runner ───────────────────────────────────────────────────────────

interface StepRunnerConfig<T> {
    stepNumber: number;
    stepLabel: string;
    systemPrompt: string;
    context: string;
    previousResult?: unknown;
    previousLabel?: string;
    validate: (data: unknown) => T;
    onComplete?: (step: number, label: string, result: unknown) => void;
    onError?: (step: number, error: Error) => void;
    options: {
        model?: string;
        temperature?: number;
        signal?: AbortSignal;
    };
    aiCaller?: (messages: OpenRouterMessage[], options?: { model?: string; temperature?: number; maxTokens?: number; signal?: AbortSignal }) => Promise<Record<string, unknown> | string>;
}

async function runPipelineStep<T>(config: StepRunnerConfig<T>): Promise<T> {
    const { stepNumber, stepLabel, systemPrompt, context, previousResult, previousLabel, validate, onComplete, onError, options, aiCaller } = config;

    console.log(`[ProductDNA] Step ${stepNumber}: ${stepLabel} started`);

    let messages: OpenRouterMessage[];
    if (previousResult && previousLabel) {
        const previousOutput = JSON.stringify(previousResult, null, 2);
        messages = createContextualStepMessages(systemPrompt, previousLabel, previousOutput, context);
    } else {
        messages = createStepMessages(systemPrompt, context);
    }

    try {
        let resultRaw: Record<string, unknown>;
        if (aiCaller) {
            const text = await aiCaller(messages, options);
            if (typeof text === 'string') {
                resultRaw = JSON.parse(extractJsonFromText(text)) as Record<string, unknown>;
            } else {
                resultRaw = text;
            }
        } else {
            // Auto-detect provider from config
            const config = loadAIConfig();
            if (config.provider === 'google_ai' && config.googleAI.apiKey) {
                const text = await callGoogleAI(messages, {
                    model: options.model || config.googleAI.model,
                    temperature: options?.temperature,
                    signal: options?.signal,
                });
                resultRaw = JSON.parse(extractJsonFromText(text)) as Record<string, unknown>;
            } else {
                resultRaw = await callOpenRouter({ messages, model: options.model } as any, options);
            }
        }
        const validated = validate(resultRaw);
        console.log(`[ProductDNA] Step ${stepNumber} complete`);
        onComplete?.(stepNumber, stepLabel, validated);
        return validated;
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error(`[ProductDNA] Step ${stepNumber} failed:`, err);
        onError?.(stepNumber, err);
        throw new Error(`Step ${stepNumber} (${stepLabel}) failed: ${err.message}`);
    }
}

// ─── Main Pipeline ─────────────────────────────────────────────────────────

export interface DnaGenerationOptions {
    productId: string;
    clientId: string;
    productData: Record<string, unknown>;
    clientData: Record<string, unknown>;
    /** Called when each step completes */
    onStepComplete?: (step: number, label: string, result: unknown) => void;
    /** Called when any step errors */
    onError?: (step: number, error: Error) => void;
    /** Optional model override */
    model?: string;
    /** Optional temperature override */
    temperature?: number;
    /** AbortSignal to cancel the pipeline */
    signal?: AbortSignal;
    /** Custom AI caller function (for Google AI or other providers) */
    aiCaller?: (messages: import('@/types/productDNA').OpenRouterMessage[], options?: { model?: string; temperature?: number; maxTokens?: number; signal?: AbortSignal }) => Promise<Record<string, unknown>>;
}

/**
 * Run the full 3-step Product DNA generation pipeline.
 * Each step passes its output as context to the next.
 */
export async function generateProductDna(options: DnaGenerationOptions): Promise<ProductDNA> {
    const { productId, clientId, productData, clientData, onStepComplete, onError, model, temperature, signal } = options;

    if (signal?.aborted) {
        throw new Error('DNA generation aborted before starting');
    }

    const rawInput = buildRawInput(productData, clientData);
    const userMessage = buildUserMessage(rawInput);
    const stepOptions = { model, temperature, signal };

    // ─── Step 1: Core Fact Extraction ─────────────────────────────────────
    const coreFacts = await runPipelineStep<ProductCoreFacts>({
        stepNumber: 1,
        stepLabel: 'Core Fact Extraction',
        systemPrompt: STEP1_SYSTEM_PROMPT,
        context: userMessage,
        validate: validateStep1,
        onComplete: onStepComplete,
        onError: onError,
        options: stepOptions,
    });

    await delay(500); // Rate limit buffer

    // ─── Step 2: ICP Profiling ────────────────────────────────────────────
    const icpProfile = await runPipelineStep<ICPProfile>({
        stepNumber: 2,
        stepLabel: 'ICP Profiling',
        systemPrompt: STEP2_SYSTEM_PROMPT,
        context: userMessage,
        previousResult: coreFacts,
        previousLabel: 'Core Fact Extraction',
        validate: validateStep2,
        onComplete: onStepComplete,
        onError: onError,
        options: stepOptions,
    });

    await delay(500); // Rate limit buffer

    // ─── Step 3: Marketing Synthesis ───────────────────────────────────────
    const marketingSynthesis = await runPipelineStep<MarketingSynthesis>({
        stepNumber: 3,
        stepLabel: 'Marketing Synthesis',
        systemPrompt: STEP3_SYSTEM_PROMPT,
        context: userMessage,
        previousResult: { coreFacts, icpProfile },
        previousLabel: 'ICP Profiling',
        validate: validateStep3,
        onComplete: onStepComplete,
        onError: onError,
        options: stepOptions,
    });

    // ─── Build Unified DNA ─────────────────────────────────────────────────
    const dna: ProductDNA = {
        id: generateId(),
        clientId,
        productId,
        version: '1.0',
        generatedAt: new Date().toISOString(),
        rawInput,
        coreFacts,
        icpProfile,
        marketingSynthesis,
    };

    console.log('[ProductDNA] Pipeline complete. DNA ID:', dna.id);
    return dna;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export {
    validateStep1,
    validateStep2,
    validateStep3,
};
