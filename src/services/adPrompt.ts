/**
 * Ad Builder — Prompt construction.
 *
 * We do NOT dump raw DNA JSON at the model. Instead we build a tight,
 * labeled "creative brief" containing only the fields that drive
 * direct-response copy (pain points, desires, USPs, proof, CTAs) plus the
 * chosen angle and its awareness level. The model writes far stronger copy
 * from a clean brief than from a wall of JSON.
 *
 * Key quality levers baked in here:
 *  - Awareness level is injected explicitly (derived from the angle's level).
 *  - Duration is converted to a target spoken-word band so the script
 *    actually fits the requested length (Value Per Second).
 *  - The ICP analysis is kept as SILENT reasoning — the model is told to
 *    think first, then output ONLY the locked format. This resolves the old
 *    contradiction where the prompt asked for analysis bullets AND
 *    output-only at the same time.
 *
 * The output format is locked to exactly what `adParser.ts` expects:
 *   <topic line>
 *   Hook 1..5: ...
 *   COPY:
 *   ...body...
 *   Headline: ...
 */
import type { ProductDNA, MarketingAngle, AwarenessLevel } from '@/types/productDNA';
import type { OpenRouterMessage } from '@/types/productDNA';

/**
 * Human-readable awareness level: English label (for the model's structural
 * understanding) + a short Misrati gloss (so the copy lands at the right
 * level of "knowing").
 */
const AWARENESS_LABELS: Record<AwarenessLevel, string> = {
    unaware: 'Unaware — ما يعرفش أصلاً إنّه عنده مشكلة',
    problem_aware: 'Problem Aware — حاسّ بالمشكلة، لكن ما يعرفش الحل',
    solution_aware: 'Solution Aware — يعرف نوع الحل، لكن ما يعرفش منتجك بالذات',
    product_aware: 'Product Aware — يعرف منتجك، يقارن بينه وبين غيره',
    most_aware: 'Most Aware — شبه جاهز يشري، يبي بس دفعة أخيرة',
};

/**
 * Spoken Misrati Arabic runs ~2.2 words/second on camera. Convert the
 * requested duration into a target word band for the COPY body so the script
 * is the right length instead of a generic blob.
 */
function pacingForDuration(seconds: number): { min: number; max: number } {
    return {
        min: Math.max(20, Math.round(seconds * 1.8)),
        max: Math.round(seconds * 2.6),
    };
}

/** Join a readonly string list into a clean bulleted block (or a dash if empty). */
function bullets(items: readonly string[] | undefined): string {
    const list = (items ?? []).map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) return '  —';
    return list.map((s) => `  • ${s}`).join('\n');
}

/**
 * Build the curated creative brief from the DNA. Only copy-relevant fields —
 * no metadata, no onboarding noise.
 */
function buildBrief(dna: ProductDNA, angle: MarketingAngle, durationSeconds: number): string {
    const pi = dna.productIdentity;
    const tc = dna.targetCustomer;
    const ms = dna.marketingStrategy;
    const pace = pacingForDuration(durationSeconds);

    const price =
        pi.pricing && typeof pi.pricing.price === 'number'
            ? `${pi.pricing.price} ${pi.pricing.currency ?? ''} (${pi.pricing.pricingModel ?? ''})`.trim()
            : '—';

    return `╔═══════════════════════════════════════════╗
║  CREATIVE BRIEF — اقرأها كويّس قبل ما تكتب  ║
╚═══════════════════════════════════════════╝

▸ المنتج
  الاسم: ${pi.productName || '—'}
  الجملة المختصرة: ${pi.tagline || '—'}
  الوصف: ${pi.summary || '—'}
  السعر: ${price}

▸ أهم المزايا (Key Features)
${bullets(pi.keyFeatures)}

▸ نقاط التميّز / ليش هذا مش غيره (USPs)
${bullets(pi.uniqueSellingPoints)}

▸ حالات الاستخدام (Use Cases)
${bullets(pi.useCases)}

▸ مين الزبون المثالي (ICP)
  ${tc.personaSummary || '—'}
  الفئة العمرية: ${tc.demographics?.ageRange ? `${tc.demographics.ageRange[0]}–${tc.demographics.ageRange[1]}` : '—'}
  المكان: ${(tc.demographics?.location ?? []).join('، ') || '—'}

▸ أوجاعه ومشاكله (Pain Points) — استعملها في الـ Empathy Anchor
${bullets(tc.painPoints)}

▸ رغباته العميقة (Core Desires) — هذا اللي يبيّه فعلاً
${bullets(tc.coreDesires)}

▸ إيش يأثر على قراره بالشراء (Decision Factors)
${bullets(tc.behavior?.decisionFactors)}

▸ القيمة الأساسية (Primary Value Proposition)
  ${ms.primaryValueProposition || '—'}

▸ عناصر الإثبات والثقة (Proof) — استعملها باش يصدّقك
${bullets([
    ...(ms.proofSuggestions?.guaranteeIdeas ?? []),
    ...(ms.proofSuggestions?.statSuggestions ?? []),
])}

▸ دعوات للفعل مقترحة (CTAs)
${bullets(ms.callToActions)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▸ الزاوية المختارة (THE ANGLE — اكتب حولها بالضبط)
  الاسم: ${angle.angleName}
  مستوى الوعي (Awareness): ${AWARENESS_LABELS[angle.level] ?? angle.level}
  ليش تشتغل: ${angle.reasoning || '—'}

▸ المدة المطلوبة: ${durationSeconds} ثانية
  → جسم السكربت (COPY) لازم يكون بين ${pace.min} و ${pace.max} كلمة تقريباً
    (الكلام المنطوق بالمصراتي ≈ ٢.٢ كلمة في الثانية). لا تتعدّاها.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

/**
 * The system prompt — world-class direct-response copywriter persona +
 * strict rules. The brief is injected via ${BRIEF}.
 */
function buildSystemPrompt(brief: string): string {
    return `Act as a world-class direct-response copywriter and Facebook Ads strategist who specializes in high-converting, direct-to-camera (UGC) video ads for the Libyan market.

Your single objective: produce a 10/10 Facebook Ads script (TEXT ONLY) that maximizes HOOK RATE (70%+) and HOLD RATE (40%+) by delivering maximum "Value Per Second" (VPS). Every second on screen must earn the next second.

CORE PHILOSOPHY
"Clear is better than clever." Do not try to sound smart. Sound like a trusted friend who understands the viewer's problem better than they understand it themselves. Talk TO one person, not to a crowd.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${brief}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULES & CONSTRAINTS (NON-NEGOTIABLE)
1. Language & Dialect: Write strictly in a simple Misrati Libyan dialect (لهجة مصراتية). Authentic, but simple enough that EVERY Libyan understands every single word with zero confusion. No Modern Standard Arabic (فصحى) stiffness. No Egyptian/Gulf/Levantine words.
2. Conversational Tone: Write exactly how a real Misrati person talks out loud. No robotic phrasing, no written-essay vibe. It must feel like an organized, warm conversation — not a sales pitch.
3. Clear > Clever: 3rd-grade vocabulary. If a sentence takes more than one second to understand, rewrite it shorter.
4. Zero Buzzwords: ABSOLUTELY no corporate jargon, no marketing buzzwords, no fake hype words ("ثوري", "حصري", "الأفضل في العالم" … forbidden unless backed by a real proof point from the brief).
5. Value Per Second: Cut ALL fluff. Every sentence must deliver value, deepen empathy, or move the story forward. No throat-clearing intros.
6. Deep Empathy: The viewer must think "كيف هذا الإنسان عارف بالضبط إيش أنا فيه؟" Use the real Pain Points and Core Desires from the brief — do not invent generic ones.
7. Match the Awareness Level: Write for exactly the awareness level stated in the brief. Don't explain things they already know; don't assume knowledge they don't have.
8. Logical Flow: Perfect transitions. Ideas stack so the viewer never gets lost.
9. Stay On Product: Use only facts, features, prices, and proof from the brief. Never invent claims, numbers, or guarantees that aren't there.

INTERNAL THINKING (DO THIS SILENTLY — DO NOT PRINT IT)
Before writing, think through the ICP privately: their silent daily frustrations, what they secretly complain about to a close friend, and the real pain of their past failed attempts with this kind of product. Let this sharpen the copy. DO NOT output this analysis — it is for your reasoning only.

SCRIPT STRUCTURE (this shapes the COPY body)
• HOOKS (5 variations): an instant reason to stop scrolling. 4–8 words each. Instantly clear, no wordplay. Each hook a different emotional door (pain, curiosity, bold claim, question, callout).
• BODY:
   – Empathy Anchor: open by naming their exact struggle so they feel understood.
   – Value-Per-Second Delivery: give the "Aha!" — break the solution (the What & the Who) into simple, bite-sized, logical steps.
   – Speed & Ease: show they'll get the result WITHOUT the headaches they normally expect.
   – Formatting: short sentences, natural spoken pauses using commas and ellipses (…) so it reads perfectly off a teleprompter.
• CTA: one clear, effortless next step in plain Libyan Arabic (e.g. اضغط هنا، ابعتلنا رسالة). Make acting feel easy and safe.

STRICT OUTPUT REQUIREMENTS
• Platform: Facebook Ads. Format: direct-to-camera spoken ad.
• Output TEXT ONLY. No emojis. No hashtags. No director's notes. No stage directions. No labels like "Empathy Anchor:" inside the body.
• Do NOT explain what you are doing or restate these instructions. Output ONLY the exact format below.
• The very FIRST line is the TOPIC: a short 3–6 word phrase naming this ad's specific angle/idea (no label, just the words). It must be DIFFERENT from any topic listed under "already used" (if provided).
• Then exactly 5 hooks, then COPY:, then the body, then Headline:.

REQUIRED OUTPUT FORMAT (EXACT — match it character-for-character):
<topic line here — 3 to 6 words, no label>
Hook 1:
Hook 2:
Hook 3:
Hook 4:
Hook 5:
COPY:
[the structured, perfectly flowing Misrati script, in short readable teleprompter lines]
Headline:
[one short, punchy Facebook ad headline in Misrati Arabic]

Take a breath and work through it step-by-step in your head for maximum clarity and value — then write.`;
}

/**
 * The block appended when the system already has ads for this angle.
 * Lists EVERY existing topic so the model picks a genuinely new framing.
 */
function buildTopicAvoidanceBlock(existingTopics: string[]): string {
    const list = existingTopics
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => `  • ${t}`)
        .join('\n');
    if (!list) return '';
    return `

══════════════════════════════════════════════
المواضيع المستعملة سابقاً في هذه الزاوية (ممنوع تكرارها)
══════════════════════════════════════════════
هذه المواضيع تكتبت قبل لنفس المنتج ونفس الزاوية. لازم تختار موضوعاً جديداً
مختلفاً تماماً — زاوية مختلفة، استعارة مختلفة، أو محرّك عاطفي مختلف — أي حاجة
إلا هذي:
${list}
══════════════════════════════════════════════`;
}

const USER_TRIGGER = (angleName: string, durationSeconds: number) =>
    `اكتب الآن إعلاناً واحداً فقط بزاوية "${angleName}" ومدته ${durationSeconds} ثانية. ابدأ بسطر الموضوع (topic) ثم Hook 1..5 ثم COPY ثم Headline، بالتنسيق المطلوب بالضبط وبدون أي كلام إضافي.`;

export interface BuildAdPromptInput {
    dna: ProductDNA;
    angle: MarketingAngle;
    durationSeconds: number;
    existingTopics: string[];
}

export interface BuiltPrompt {
    system: string;
    user: string;
    /** Character length of the system prompt (for logging/debug). */
    systemLength: number;
}

/**
 * Assemble the full system + user prompt for one ad generation.
 */
export function buildAdPrompt(input: BuildAdPromptInput): BuiltPrompt {
    const { dna, angle, durationSeconds, existingTopics } = input;

    const brief = buildBrief(dna, angle, durationSeconds);
    let system = buildSystemPrompt(brief);
    system += buildTopicAvoidanceBlock(existingTopics);

    return {
        system,
        user: USER_TRIGGER(angle.angleName, durationSeconds),
        systemLength: system.length,
    };
}

/**
 * Convert the built prompt to the OpenRouterMessage[] shape used by `callAI()`.
 */
export function toMessages(built: BuiltPrompt): OpenRouterMessage[] {
    return [
        { role: 'system', content: built.system },
        { role: 'user', content: built.user },
    ];
}
