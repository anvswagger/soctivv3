/**
 * Product DNA Pipeline Service v2.
 *
 * New architecture:
 *   Phase 0: AI generates smart MCQs based on product description
 *   Phase 1: Build product identity from user input (facts-first)
 *   Phase 2: AI analyzes target customer from product facts
 *   Phase 3: AI builds marketing strategy on top of verified facts
 *
 * The onboarding is the TRUTH source. The AI is the STRATEGY engine.
 */
import { callGoogleAI } from './googleAiService';
import { loadAIConfig } from './aiConfigService';
import { buildAngleCatalogPromptSection } from '@/lib/marketingAngles';
import type { Database } from '@/integrations/supabase/types';
import type {
    ProductIdentity,
    TargetCustomer,
    MarketingStrategy,
    ProductDNA,
    OnboardingData,
    GeneratedQuestion,
    OpenRouterMessage,
    AwarenessLevel,
} from '@/types/productDNA';

// ─── Prompt: Smart Question Generation ─────────────────────────────────────

const QUESTION_GENERATION_PROMPT = `أنت خبير تسويق ومنتجات. مهمتك توليد أسئلة اختيار من متعدد (MCQ) دقيقة ومفيدة لمنتج معيّن، لمساعدتي على كتابة وصف تسويقي قوي وحقيقي.

═══════════════════════════════════════
المبادئ الثلاثة لكل سؤال
═══════════════════════════════════════

1. **واضح (Clear)** — سؤال قصير ومبهم لا يحتمل تأويلاً.
   • اكتب بجملة واحدة، لا تستخدم جملة طويلة معقدة.
   • تجنّب المصطلحات الفنية والاختصارات.
   • سؤال واحد = فكرة واحدة. لا تسأل عن شيئين في سؤال.

2. **مفيد (Beneficial)** — إجابة السؤال يجب أن تغيّر الوصف فعلياً.
   • اسأل فقط عمّا ينقص في الوصف — لا تكرّر معلومة موجودة أصلاً.
   • كل إجابة يجب أن تتحوّل إلى جملة في الوصف النهائي.
   • إذا كانت الإجابة لا تهم الزبون (تفاصيل تقنية بحتة)، لا تسأل عنها.

3. **حقيقي (Real)** — الخيارات تعكس الواقع الفعلي للمنتج، لا قوالب عامة.
   • كل خيار يجب أن يكون قابلاً للاختيار فعلاً من قبل صاحب المنتج.
   • الخيارات يجب أن تكون مخصّصة لهذا النوع من المنتج تحديداً.
   • لا تستخدم "خيار 1 / خيار 2" أو صياغات عامة قابلة لأي منتج.

═══════════════════════════════════════
عدد الأسئلة
═══════════════════════════════════════

- منتج بسيط واضح المعالم: **4 إلى 5 أسئلة**.
- منتج يحتاج بعض التفصيل: **6 إلى 8 أسئلة**.
- منتج فيه عدة استخدامات أو فئات مستهدفة مختلفة: **8 إلى 10 أسئلة**.
- لا تقل عن 4 ولا تزيد عن 10 أسئلة في أي حال.

═══════════════════════════════════════
قواعد كتابة السؤال
═══════════════════════════════════════

- من 3 إلى 5 خيارات لكل سؤال.
- الخيارات يجب أن تكون **متكاملة** (تغطي الاحتمالات الواقعية) **ولا متداخلة** (لا يصح اختيار أكثر من واحد).
- اطرح دائماً خياراً "محايداً" أو "لا ينطبق" إن كان منطقياً (مثلاً: "لا يوجد مكون مميز"، "جميع الفئات"، "غير ذلك").
- اعرف المستخدم بنفسك سيضيف إجابته الخاصة في حقل نصي، فلا حاجة لوضع خيار "أخرى" صريح.

═══════════════════════════════════════
الفئات المستهدفة (category)
═══════════════════════════════════════

- "ingredients": المكونات أو المواد الرئيسية أو الفعّالة.
- "use_case": الاستخدام الرئيسي أو المناسبة الأساسية.
- "format": الشكل أو الحجم أو النوع أو التغليف.
- "target": الشريحة المستهدفة (عمر، جنس، اهتمام، مشكلة).
- "differentiator": ما يميّز المنتج عن المنافسين أو نقطة البيع الفريدة.
- "other": أي تفصيل مهم آخر لا يدخل في الفئات أعلاه (مثل: بلد المنشأ، الضمان، طريقة الاستخدام، إلخ).

═══════════════════════════════════════
أمثلة (افهم الأسلوب قبل أن تكتب)
═══════════════════════════════════════

❌ سؤال ضعيف:
  "ما هو نوع المنتج؟"
  خيارات: ["منتج 1", "منتج 2", "منتج 3"]
  → عام جداً، لا يخبرنا بشيء محدد.

✅ سؤال قوي:
  "ما نوع بشرة هذا الكريم موجّه لها؟"
  خيارات: ["بشرة دهنية", "بشرة جافة", "بشرة مختلطة", "جميع أنواع البشرة"]
  → واضح، مفيد، حقيقي.

❌ سؤال ضعيف:
  "ما هي المكونات؟"
  خيارات: ["نعم", "لا", "أحياناً"]
  → لا معنى له.

✅ سؤال قوي:
  "ما المكوّن الفعّال الرئيسي في المنتج؟"
  خيارات: ["فيتامين سي", "حمض الهيالورونيك", "الريتينول", "مكوّن آخر", "لا يوجد مكوّن فعّال مميز"]
  → واضح ومحدد وحقيقي.

═══════════════════════════════════════
صيغة الإخراج (JSON فقط، بدون أي كلام إضافي)
═══════════════════════════════════════

{
  "questions": [
    {
      "id": "q1",
      "question": "نص السؤال هنا",
      "options": [
        { "id": "q1_a", "label": "خيار 1" },
        { "id": "q1_b", "label": "خيار 2" },
        { "id": "q1_c", "label": "خيار 3" }
      ],
      "category": "ingredients"
    }
  ]
}

الوصف:
`;

// ─── Prompt: Step 1 — Product Identity ─────────────────────────────────────

/**
 * Tags the AI must NEVER include in the `tags` array, no matter the product.
 * These get filtered post-validation too (see `validateIdentity`) so existing
 * data and AI drift are both covered.
 */
export const BLOCKED_PRODUCT_TAGS: readonly string[] = Object.freeze([
    'شريط لاصق',
    'مانع تسريب',
    'صيانة منزلية',
]);

const STEP1_IDENTITY_PROMPT = `أنت محلل منتجات محترف. مهمتك بناء هوية المنتج من المعلومات المقدمة.

**المهمة:** أنشئ هوية المنتج الكاملة بناءً على وصف المنتج والإجابات على الأسئلة.

**قواعد صارمة:**
1. لا تختلق معلومات غير موجودة في الوصف أو في إجابات المستخدم.
2. اسم المنتج والوصف يجب أن يكونا مبنيين على ما كتبه المستخدم — ليس من خيالك.
3. الميزات الرئيسية يجب أن تُوسع الميزات المذكورة في الوصف فقط — لا تضيف ميزات وهمية.
4. المكونات والخصائص يجب أن تعتمد فقط على ما أجابه المستخدم في الأسئلة.
5. إذا لم يُذكر السعر، اجعله 0. العملة الافتراضية LYD.

أرجع JSON بالشكل التالي:
{
  "productName": "اسم المنتج كما ذكره المستخدم",
  "tagline": "عبارة قصيرة تعكس القيمة — مبنية على وصف المستخدم",
  "summary": "ملخص دقيق للمنتج في 3-4 جمل — مبني حصرياً على المعلومات المقدمة",
  "keyFeatures": ["ميزة محددة 1 مبنية على الوصف", "ميزة 2", "ميزة 3", "ميزة 4", "ميزة 5"],
  "useCases": ["حالة استخدام محددة وواقعية", "حالة 2", "حالة 3"],
  "pricing": {
    "price": 0,
    "currency": "LYD",
    "pricingModel": "one-time"
  },
  "category": ["التصنيف الرئيسي", "التصنيف الفرعي"],
  "tags": ["وسم 1", "وسم 2", "وسم 3"],
  "uniqueSellingPoints": ["نقطة بيع 1 مبنية على إجابة المستخدم", "نقطة 2", "نقطة 3"]
}

الcoeud PricingModel المسموحة: "one-time" | "subscription" | "tiered" | "freemium" | "negotiable"

═══════════════════════════════════════
قائمة الوسوم الممنوعة (لا تستخدمها أبداً)
═══════════════════════════════════════

يُمنع منعاً باتاً استخدام أي وسم من القائمة التالية في حقل "tags"، لأي منتج كان:
${BLOCKED_PRODUCT_TAGS.map((t) => `  • ${t}`).join('\n')}

اختر وسوماً دقيقة ومفيدة بدلاً منها. إذا كانت الوسوم الممنوعة تبدو مناسبة فعلاً للمنتج، استبدلها بأقرب مرادف دقيق وصحيح.
`;

// ─── Prompt: Step 2 — Target Customer Analysis ────────────────────────────

const STEP2_CUSTOMER_PROMPT = `أنت محلل سوق استشاري محترف. مهمتك تحديد العميل المثالي لهذا المنتج.

**المهمة:** بناءً على هوية المنتج والمعلومات المقدمة، حلّل من هو العميل الأكثر احتمالاً لشراء هذا المنتج.

**كيفية التحليل:**
1. افهم نوع المنتج أولاً — ما هو؟ لمن هو؟
2. حدد الفئة العمرية والجنس والمنطقة الأكثر احتمالاً للشراء.
3. نقاط الألم يجب أن تكون محددة ومحسوسة — لا تكتب كلاماً عاماً.
4. الرغبات يجب أن تكون مرتبطة بالمنتج تحديداً.
5. سلوك الشراء يجب أن يعكس كيفية شراء هذا النوع من المنتجات فعلياً.

أرجع JSON بالشكل التالي:
{
  "personaSummary": "وصف دقيق للعميل المثالي — من هو، ماذا يعاني، لماذا يحتاج لهذا المنتج",
  "demographics": {
    "ageRange": [25, 40],
    "gender": null,
    "location": ["موقع محدد 1", "موقع 2"],
    "occupation": ["مهنة 1", "مهنة 2"]
  },
  "painPoints": ["نقطة ألم محددة ومحسوسة 1", "نقطة 2", "نقطة 3"],
  "coreDesires": ["رغبة أساسية محددة 1", "رغبة 2", "رغبة 3"],
  "behavior": {
    "buyingHabits": ["عادة شراء محددة", "عادة 2"],
    "preferredChannels": ["قناة 1", "قناة 2"],
    "decisionFactors": ["عامل قرار 1", "عامل 2", "عامل 3"]
  }
}

القواعد:
- اكتب كل شيء بالعربية.
- العميل يجب أن يكون دقيقاً ومحدداً — لا تكتب وصفاً عاماً.
- استنِد على نوع المنتج والسوق الفعلي.
- تجنب العبارات العامة مثل "يريد الجمال" — كن محدداً.`;

// ─── Prompt: Step 3 — Marketing Strategy ───────────────────────────────────

/**
 * The Step 3 prompt is split into a static "frame" and a dynamic "catalog"
 * section. The frame is constant; the catalog is built from
 * `marketingAngles.ts` at module load time and injected here.
 *
 * This way the catalog of 30 reference angles is the single source of
 * truth, and the prompt stays small.
 */
const STEP3_STRATEGY_PROMPT_FRAME = `أنت استراتيجي تسويق محترف خبير في نموذج "Schwartz 5 Levels of Awareness".
مهمتك بناء استراتيجية تسويقية كاملة ومُحكَمة لهذا المنتج، مع توليد زوايا تسويقية مُفصّلة لكل مستوى وعي.

═══════════════════════════════════════
المهمة
═══════════════════════════════════════
بناءً على هوية المنتج والعميل المستهدف (من الخطوتين السابقتين)، أنشئ استراتيجية تسويقية كاملة، مع **5 إلى 6 زوايا تسويقية مميزة لكل مستوى وعي** (إجمالاً 25 إلى 30 زاوية على الأقل).

═══════════════════════════════════════
مفهوم الزاوية التسويقية
═══════════════════════════════════════
الزاوية التسويقية هي المفهوم النفسي أو الاستراتيجي الذي تُبنى عليه الحملة — ليست نصاً إعلانياً.
مثال: "الخوف من فقدان العملاء بسبب المظهر غير الاحترافي"، أو "الرغبة في إبهار الضيوف بأقل جهد"، أو "التوفير الذكي على المدى الطويل".

كل زاوية يجب أن تكون:
- **محددة** (ليست عامة — مرتبطة بهذا المنتج تحديداً).
- **مستوحاة من آلية** (من المكتبة المرجعية أدناه، أو آلية مبتكرة جديدة).
- **مُرتبطة بنقطة ألم أو رغبة حقيقية** من تحليل العميل.
- **قابلة للتنفيذ** (يمكن كتابة إعلان منها).

═══════════════════════════════════════
مستويات الوعي الخمسة (Schwartz)
═══════════════════════════════════════
1. **unaware** — العميل لا يعلم أنه لديه مشكلة أو رغبة كامنة. (الأكثر تعقيداً)
2. **problem_aware** — العميل يعلم بالمشكلة لكن لا يعرف أن حلاً متاحاً.
3. **solution_aware** — العميل يعرف أن حلولاً موجودة، لكن لم يختر منتجك بعد.
4. **product_aware** — العميل يعرف منتجك لكنه غير مقتنع ويحتاج دليلاً.
5. **most_aware** — العميل على وشك الشراء ويحتاج دفعة أخيرة.

═══════════════════════════════════════
صيغة الإخراج (JSON فقط — بدون أي كلام إضافي)
═══════════════════════════════════════

{
  "primaryValueProposition": "جملة واحدة واضحة لماذا يجب شراء هذا المنتج",
  "elevatorPitch": "عرض تقديمي مختصر في جملتين",
  "marketingAngles": [
    {
      "angleName": "اسم الزاوية الاستراتيجية — بالعربية، محدد، قصير، قوي",
      "level": "unaware | problem_aware | solution_aware | product_aware | most_aware",
      "reasoning": "سبب هذه الزاوية — لماذا ستنجح مع هذا العميل تحديداً (سطران إلى ثلاثة)"
    }
  ],
  "callToActions": ["دعوة للعمل 1", "دعوة 2", "دعوة 3", "دعوة 4"],
  "seoKeywords": ["كلمة مفتاحية 1", "كلمة 2", "كلمة 3", "كلمة 4", "كلمة 5"],
  "recommendedChannels": ["قناة تسويقية 1", "قناة 2", "قناة 3"],
  "proofSuggestions": {
    "testimonialPrompts": ["اقتراح شهادة: '...'", "اقتراح شهادة ثانية: '...'"],
    "statSuggestions": ["اقتراح إحصائية: '...'", "اقتراح إحصائية ثانية: '...'"],
    "guaranteeIdeas": ["اقتراح ضمان: '...'", "اقتراح ضمان ثاني: '...'"]
  }
}

═══════════════════════════════════════
قواعد صارمة
═══════════════════════════════════════
1. **5–6 زوايا مميزة لكل مستوى وعي** — لا تقل عن 5 ولا تزيد عن 6 لكل مستوى. (25–30 إجمالاً)
2. **كل زاوية يجب أن تكون فريدة** — لا تكرر نفس الفكرة بصياغة مختلفة.
3. **كل زاوية يجب أن تستهدف نقطة ألم أو رغبة مختلفة** من العميل.
4. **استخدم المكتبة المرجعية أدناه كإلهام** — لا تنسخ الأسماء حرفياً، بل اصنع زوايا مخصصة لهذا المنتج بالاستفادة من الآليات المذكورة.
5. **angleName بالعربية** — قصير، قوي، يصف الاستراتيجية لا الإعلان.
6. **reasoning يشرح** لماذا هذه الزاوية ستنجح مع هذا العميل تحديداً (اذكر نقطة الألم أو الرغبة من تحليل العميل).
7. **proofSuggestions** يجب أن يكون فيها 2+ عناصر في كل قسم (testimonials, stats, guarantees) — لأن الاستراتيجية الجيدة تحتاج أدلة كافية.
8. **callToActions** 3-4 عبارات متنوعة تناسب مراحل الوعي المختلفة.
9. **seoKeywords** 4-6 كلمات مفتاحية طويلة (long-tail) بالعربية.
10. **recommendedChannels** 2-3 قنوات تناسب الجمهور المستهدف.

═══════════════════════════════════════
مكتبة الزوايا المرجعية (Schwartz 5 Levels) — استخدمها كإلهام
═══════════════════════════════════════

`;

const STEP3_STRATEGY_PROMPT =
    STEP3_STRATEGY_PROMPT_FRAME + buildAngleCatalogPromptSection();

// ─── UUID Generation ───────────────────────────────────────────────────────

function generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// ─── JSON Extraction ──────────────────────────────────────────────────────

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

// ─── Validation Utilities ─────────────────────────────────────────────────

function assertObject(data: unknown, label: string): asserts data is Record<string, unknown> {
    if (!data || typeof data !== 'object') throw new Error(`${label}: output is not an object`);
}

function assertString(value: unknown, field: string): asserts value is string {
    if (typeof value !== 'string' || !value) throw new Error(`${field} is required`);
}

function assertArray(value: unknown, field: string): asserts value is unknown[] {
    if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
}

function assertNonEmptyArray(value: unknown, field: string): asserts value is unknown[] {
    if (!Array.isArray(value) || value.length === 0) throw new Error(`${field} must be a non-empty array`);
}

// ─── AI Caller (auto-detect provider) ──────────────────────────────────────

async function callAI(
    messages: OpenRouterMessage[],
    options?: { model?: string; temperature?: number; signal?: AbortSignal }
): Promise<string> {
    const config = loadAIConfig();

    if (config.provider === 'google_ai' && config.googleAI.apiKey) {
        return callGoogleAI(messages, {
            model: options?.model || config.googleAI.model,
            temperature: options?.temperature,
            signal: options?.signal,
        });
    }

    // Fallback: import OpenRouter dynamically to avoid circular deps
    const { callOpenRouter } = await import('./openRouterService');
    const result = await callOpenRouter(
        { messages, model: options?.model || config.openrouter.model } as any,
        options
    );

    if (typeof result === 'string') return result;
    return JSON.stringify(result);
}

// ─── Phase 0: Generate Smart Questions ─────────────────────────────────────

export interface GenerateQuestionsContext {
    /** Product name — used as additional context for the AI */
    productName?: string;
}

export async function generateSmartQuestions(
    productDescription: string,
    options?: { signal?: AbortSignal; context?: GenerateQuestionsContext }
): Promise<GeneratedQuestion[]> {
    const { signal, context } = options ?? {};

    const userMessageParts: string[] = [];
    if (context?.productName && context.productName.trim()) {
        userMessageParts.push(`اسم المنتج: ${context.productName.trim()}`);
    }
    userMessageParts.push(`وصف المنتج:\n${productDescription}`);

    const messages: OpenRouterMessage[] = [
        { role: 'system', content: QUESTION_GENERATION_PROMPT },
        { role: 'user', content: userMessageParts.join('\n\n') },
    ];

    const raw = await callAI(messages, { temperature: 0.4, signal });
    const parsed = JSON.parse(extractJsonFromText(raw));

    assertObject(parsed, 'Question Generation');
    assertArray(parsed.questions, 'questions');
    assertNonEmptyArray(parsed.questions, 'questions');

    // Validate each question
    const questions: GeneratedQuestion[] = parsed.questions.map((q: Record<string, unknown>, i: number) => {
        assertObject(q, `Question ${i + 1}`);
        assertString(q.question, `Question ${i + 1}.question`);
        assertArray(q.options, `Question ${i + 1}.options`);

        const qId = (typeof q.id === 'string' && q.id) ? q.id : `q${i + 1}`;
        const qCategory = (typeof q.category === 'string' && q.category) ? q.category : 'other';

        return {
            id: qId,
            question: q.question as string,
            options: (q.options as Record<string, unknown>[]).map((opt, j: number) => ({
                id: (typeof opt.id === 'string' && opt.id) ? opt.id : `q${i + 1}_${String.fromCharCode(97 + j)}`,
                label: (typeof opt.label === 'string' && opt.label) ? opt.label : (typeof opt.text === 'string' ? opt.text : `خيار ${j + 1}`),
            })),
            category: qCategory as GeneratedQuestion['category'],
        };
    });

    // Enforce 4–10 cap. Pad with whatever AI gave us; never empty.
    const minQuestions = 4;
    const maxQuestions = 10;
    if (questions.length < minQuestions) {
        // AI gave fewer than 4 — keep what we have (validator already checked non-empty).
        return questions;
    }
    return questions.slice(0, maxQuestions);
}

// ─── Validation: Product Identity ──────────────────────────────────────────

/**
 * Strips any blocked tag (case-insensitive, trimmed) from an incoming tag list.
 * Defensive against AI drift and stale data — even if the model outputs a
 * blocked tag despite the prompt instruction, it never reaches the UI.
 */
function stripBlockedTags(tags: unknown[]): string[] {
    const blocked = new Set(BLOCKED_PRODUCT_TAGS.map((t) => t.trim().toLowerCase()));
    return tags
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && !blocked.has(t.toLowerCase()));
}

function validateIdentity(data: unknown): ProductIdentity {
    assertObject(data, 'Product Identity');
    assertString(data.productName, 'productName');
    assertString(data.tagline, 'tagline');
    assertString(data.summary, 'summary');
    assertArray(data.keyFeatures, 'keyFeatures');
    assertArray(data.useCases, 'useCases');
    if (!data.pricing || typeof data.pricing !== 'object') throw new Error('pricing is required');
    assertArray(data.category, 'category');
    assertArray(data.tags, 'tags');
    assertArray(data.uniqueSellingPoints, 'uniqueSellingPoints');
    return {
        ...(data as unknown as ProductIdentity),
        tags: stripBlockedTags(data.tags as unknown[]),
    };
}

// ─── Validation: Target Customer ───────────────────────────────────────────

function validateTargetCustomer(data: unknown): TargetCustomer {
    assertObject(data, 'Target Customer');
    assertString(data.personaSummary, 'personaSummary');
    if (!data.demographics || typeof data.demographics !== 'object') throw new Error('demographics is required');
    assertArray(data.painPoints, 'painPoints');
    assertArray(data.coreDesires, 'coreDesires');
    if (!data.behavior || typeof data.behavior !== 'object') throw new Error('behavior is required');
    return data as unknown as TargetCustomer;
}

// ─── Validation: Marketing Strategy ────────────────────────────────────────

/** Awareness levels we expect coverage for in a complete marketing strategy. */
const EXPECTED_AWARENESS_LEVELS: readonly AwarenessLevel[] = [
    'unaware',
    'problem_aware',
    'solution_aware',
    'product_aware',
    'most_aware',
];

/**
 * Validates the marketing strategy and normalizes marketing angles.
 *
 * Behavior:
 * - Hard-fails on missing structural fields (PVP, elevator pitch, etc.).
 * - Soft-warns (does NOT throw) if a level has fewer than 4 angles, so
 *   we don't blow up a successful generation because the AI under-counted
 *   on one level. The UI surfaces the count so the user can regenerate.
 * - Coerces unknown `level` values to the closest valid level, falling
 *   back to `unaware` (the catch-all for the most-sophisticated level).
 */
function validateMarketingStrategy(data: unknown): MarketingStrategy {
    assertObject(data, 'Marketing Strategy');
    assertString(data.primaryValueProposition, 'primaryValueProposition');
    assertString(data.elevatorPitch, 'elevatorPitch');
    assertNonEmptyArray(data.marketingAngles, 'marketingAngles');
    assertArray(data.callToActions, 'callToActions');
    assertArray(data.seoKeywords, 'seoKeywords');
    assertArray(data.recommendedChannels, 'recommendedChannels');
    if (!data.proofSuggestions || typeof data.proofSuggestions !== 'object') {
        throw new Error('proofSuggestions is required');
    }

    // Normalize each angle: ensure angleName, level, reasoning are present.
    const rawAngles = data.marketingAngles as unknown[];
    const validLevels = new Set<string>(EXPECTED_AWARENESS_LEVELS);
    const normalizedAngles = rawAngles.map((raw, i) => {
        if (!raw || typeof raw !== 'object') {
            throw new Error(`marketingAngles[${i}] is not an object`);
        }
        const a = raw as Record<string, unknown>;
        if (typeof a.angleName !== 'string' || !a.angleName.trim()) {
            throw new Error(`marketingAngles[${i}].angleName is required`);
        }
        if (typeof a.level !== 'string' || !validLevels.has(a.level)) {
            // Unknown level — coerce to 'unaware' rather than throw. UI
            // groups it under "غير مدرك" and the user can fix.
            console.warn(
                `[ProductDNA] marketingAngles[${i}].level="${String(a.level)}" is not a valid awareness level — coercing to 'unaware'`
            );
            a.level = 'unaware';
        }
        if (typeof a.reasoning !== 'string') {
            a.reasoning = '';
        }
        return a as unknown as MarketingStrategy['marketingAngles'][number];
    });

    // Per-level coverage report. Soft warning only — never throws.
    const counts: Record<string, number> = {};
    for (const a of normalizedAngles) {
        counts[a.level] = (counts[a.level] ?? 0) + 1;
    }
    for (const level of EXPECTED_AWARENESS_LEVELS) {
        const c = counts[level] ?? 0;
        if (c < 4) {
            console.warn(
                `[ProductDNA] Level "${level}" has only ${c} angles (expected ≥4). Consider regenerating.`
            );
        }
    }

    return {
        ...(data as unknown as MarketingStrategy),
        marketingAngles: normalizedAngles,
    };
}

// ─── Step Runner ───────────────────────────────────────────────────────────

interface StepConfig<T> {
    label: string;
    systemPrompt: string;
    context: string;
    previousStepLabel?: string;
    previousStepOutput?: unknown;
    validate: (data: unknown) => T;
    signal?: AbortSignal;
    temperature?: number;
}

async function runStep<T>(config: StepConfig<T>): Promise<T> {
    const { label, systemPrompt, context, previousStepLabel, previousStepOutput, validate, signal, temperature } = config;

    let messages: OpenRouterMessage[];

    if (previousStepLabel && previousStepOutput) {
        messages = [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: `معلومات الخطوة السابقة (${previousStepLabel}):\n${JSON.stringify(previousStepOutput, null, 2)}\n\nالمدخلات الأصلية:\n${context}\n\nبناءً على كل ما سبق، أنشئ التحليل المطلوب. أرجع JSON فقط.`,
            },
        ];
    } else {
        messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: context },
        ];
    }

    const raw = await callAI(messages, { temperature: temperature ?? 0.3, signal });
    const parsed = JSON.parse(extractJsonFromText(raw));
    return validate(parsed);
}

// ─── Main Pipeline ─────────────────────────────────────────────────────────

export interface DnaGenerationOptions {
    productId: string;
    clientId: string;
    onboarding: OnboardingData;
    onStepComplete?: (step: number, label: string, result: unknown) => void;
    onError?: (step: number, error: Error) => void;
    signal?: AbortSignal;
}

/**
 * Run the full Product DNA generation pipeline.
 * Phase 0: Questions are already generated and answered during onboarding.
 * This runs the 3-step DNA generation using verified onboarding data.
 */
export async function generateProductDna(options: DnaGenerationOptions): Promise<ProductDNA> {
    const { productId, clientId, onboarding, onStepComplete, onError, signal } = options;

    if (signal?.aborted) {
        throw new Error('DNA generation aborted before starting');
    }

    // Build the context string from onboarding data
    const answersSummary = onboarding.answers
        .map((a) => `- ${a.category}: ${a.selectedLabel}`)
        .join('\n');

    const context = `وصف المنتج:\n${onboarding.productDescription}\n\nمعلومات مجمعة من الأسئلة:\n${answersSummary}`;

    // ─── Step 1: Product Identity (facts from user) ──────────────────────
    let productIdentity: ProductIdentity;
    try {
        console.log('[ProductDNA] Step 1: Product Identity started');
        productIdentity = await runStep<ProductIdentity>({
            label: 'Product Identity',
            systemPrompt: STEP1_IDENTITY_PROMPT,
            context,
            validate: validateIdentity,
            signal,
            temperature: 0.2, // Low temp for factual accuracy
        });
        console.log('[ProductDNA] Step 1 complete');
        onStepComplete?.(1, 'Product Identity', productIdentity);
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[ProductDNA] Step 1 failed:', error);
        onError?.(1, error);
        throw new Error(`Step 1 (Product Identity) failed: ${error.message}`);
    }

    if (signal?.aborted) throw new Error('DNA generation aborted');

    await delay(300);

    // ─── Step 2: Target Customer Analysis (AI's job) ────────────────────
    let targetCustomer: TargetCustomer;
    try {
        console.log('[ProductDNA] Step 2: Target Customer Analysis started');
        targetCustomer = await runStep<TargetCustomer>({
            label: 'Target Customer Analysis',
            systemPrompt: STEP2_CUSTOMER_PROMPT,
            context,
            previousStepLabel: 'Product Identity',
            previousStepOutput: productIdentity,
            validate: validateTargetCustomer,
            signal,
        });
        console.log('[ProductDNA] Step 2 complete');
        onStepComplete?.(2, 'Target Customer Analysis', targetCustomer);
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[ProductDNA] Step 2 failed:', error);
        onError?.(2, error);
        throw new Error(`Step 2 (Target Customer Analysis) failed: ${error.message}`);
    }

    if (signal?.aborted) throw new Error('DNA generation aborted');

    await delay(300);

    // ─── Step 3: Marketing Strategy (AI's main job) ─────────────────────
    let marketingStrategy: MarketingStrategy;
    try {
        console.log('[ProductDNA] Step 3: Marketing Strategy started');
        marketingStrategy = await runStep<MarketingStrategy>({
            label: 'Marketing Strategy',
            systemPrompt: STEP3_STRATEGY_PROMPT,
            context,
            previousStepLabel: 'Target Customer Analysis',
            previousStepOutput: { productIdentity, targetCustomer },
            validate: validateMarketingStrategy,
            signal,
        });
        console.log('[ProductDNA] Step 3 complete');
        onStepComplete?.(3, 'Marketing Strategy', marketingStrategy);
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[ProductDNA] Step 3 failed:', error);
        onError?.(3, error);
        throw new Error(`Step 3 (Marketing Strategy) failed: ${error.message}`);
    }

    // ─── Build Unified DNA ─────────────────────────────────────────────
    const dna: ProductDNA = {
        id: generateId(),
        clientId,
        productId,
        version: '2.0',
        generatedAt: new Date().toISOString(),
        onboarding,
        productIdentity,
        targetCustomer,
        marketingStrategy,
    };

    console.log('[ProductDNA] Pipeline complete. DNA ID:', dna.id);
    return dna;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Hydration: snake_case DB row → camelCase ProductDNA ──────────────────
//
// Reverse of the write-side mapping in `src/hooks/useProductDna.ts`.
// Required by any consumer that needs to re-load a saved DNA from Supabase
// (e.g. the Ad Builder page, which reads the DNA's marketingAngles to populate
// the angle dropdown).
//
// `productIdOverride` guards against rows where `product_id` was nulled by the
// FK ON DELETE SET NULL behaviour — the caller can pass the page's known
// product id and we'll prefer it.

export type ProductDnaRow = Database['public']['Tables']['product_dna']['Row'];

export function hydrateDnaRow(row: ProductDnaRow, productIdOverride?: string): ProductDNA {
    return {
        id: row.id,
        clientId: row.client_id,
        productId: productIdOverride ?? row.product_id ?? '',
        version: row.version,
        generatedAt: row.generated_at,
        onboarding: row.raw_input as unknown as ProductDNA['onboarding'],
        productIdentity: row.core_facts as unknown as ProductDNA['productIdentity'],
        targetCustomer: row.icp_profile as unknown as ProductDNA['targetCustomer'],
        marketingStrategy: row.marketing_synthesis as unknown as ProductDNA['marketingStrategy'],
    };
}

// ─── Read: load a product's DNA row from Supabase ─────────────────────────

/**
 * Fetch the DNA row for a given product. Returns `null` when no DNA exists
 * (caller should render an empty state). Uses the same RLS scope as the
 * product_dna SELECT policy — super-admins see all rows.
 */
export async function loadProductDna(
    productId: string,
    options?: { signal?: AbortSignal },
): Promise<{ row: ProductDnaRow; dna: ProductDNA } | null> {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await supabase
        .from('product_dna')
        .select('*')
        .eq('product_id', productId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (options?.signal?.aborted) return null;
    if (error) throw error;
    if (!data) return null;

    return { row: data, dna: hydrateDnaRow(data, productId) };
}