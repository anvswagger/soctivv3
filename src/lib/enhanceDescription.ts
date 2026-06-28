/**
 * enhanceDescription — Build a richer product description from the user's
 * original description and their AI-questionnaire answers.
 *
 * Deterministic (no extra AI round-trip) so the real product onboarding flow
 * stays fast. The output is appended to the original description in Arabic,
 * with a short bullet list of Q&A pairs grouped by category.
 *
 * Used by the real product onboarding page after the AI questions phase.
 *
 * Behaviour:
 *   - For each answer, prefer `customText` (user-typed answer) when present.
 *   - When `customText` is set, label the bullet as "إجابة المستخدم:" so the
 *     AI-generated description preserves the user's voice and intent.
 *   - For MCQ-picked answers, label by category (المكونات، الاستخدام، إلخ).
 *   - Skipped questions (no label, no custom text) are dropped silently.
 */
import type { OnboardingAnswer } from '@/types/productDNA';

const CATEGORY_LABELS: Record<string, string> = {
    ingredients: 'المكونات',
    use_case: 'الاستخدام',
    format: 'الشكل',
    target: 'الفئة المستهدفة',
    price_range: 'نطاق السعر',
    differentiator: 'ما يميزه',
    other: 'معلومة إضافية',
};

const CATEGORY_ORDER: readonly string[] = [
    'ingredients',
    'use_case',
    'format',
    'target',
    'differentiator',
    'price_range',
    'other',
];

const MAX_OUTPUT_LENGTH = 600;
const CUSTOM_LABEL = 'إجابة المستخدم';

export interface EnhanceDescriptionInput {
    /** Original description typed by the user (may be empty). */
    originalDescription: string;
    /** Answers collected from the AI MCQ phase. */
    answers: readonly OnboardingAnswer[];
}

/**
 * Resolve the visible text for a single answer. Custom text wins when set
 * and non-empty, otherwise the MCQ label is used.
 */
function resolveAnswerText(answer: OnboardingAnswer): string | null {
    const custom = answer.customText?.trim();
    if (custom) return custom;
    const label = answer.selectedLabel?.trim();
    if (label) return label;
    return null;
}

/**
 * Whether the answer should be labelled as a user-typed answer.
 */
function isCustomAnswer(answer: OnboardingAnswer): boolean {
    return !!(answer.customText && answer.customText.trim());
}

/**
 * Build a richer description from the original text and the AI answers.
 * The result is a single string suitable for the `products.description` column.
 */
export function enhanceDescriptionWithAnswers(input: EnhanceDescriptionInput): string {
    const { originalDescription, answers } = input;

    if (!answers || answers.length === 0) {
        return originalDescription.trim();
    }

    // Group answers by category, preserving the configured category order.
    // Custom (user-typed) answers go into a separate bucket so they can be
    // rendered under a distinct label.
    const grouped = new Map<string, OnboardingAnswer[]>();
    const customAnswers: OnboardingAnswer[] = [];

    for (const a of answers) {
        // Drop empty/skipped answers — they add no information.
        const text = resolveAnswerText(a);
        if (!text) continue;

        if (isCustomAnswer(a)) {
            customAnswers.push(a);
            continue;
        }

        const cat = a.category || 'other';
        if (!grouped.has(cat)) grouped.set(cat, []);
        grouped.get(cat)!.push(a);
    }

    const lines: string[] = [];

    const trimmedOriginal = originalDescription.trim();
    if (trimmedOriginal) {
        lines.push(trimmedOriginal);
        lines.push('');
    }

    const hasGrouped = grouped.size > 0;
    const hasCustom = customAnswers.length > 0;

    if (hasGrouped) {
        lines.push('تفاصيل المنتج:');
        for (const category of CATEGORY_ORDER) {
            const items = grouped.get(category);
            if (!items || items.length === 0) continue;
            const label = CATEGORY_LABELS[category] ?? CATEGORY_LABELS.other;
            for (const item of items) {
                const text = resolveAnswerText(item);
                if (text) lines.push(`• ${label}: ${text}`);
            }
        }
        // Defensive: surface any unknown categories.
        for (const [category, items] of grouped.entries()) {
            if (CATEGORY_ORDER.includes(category)) continue;
            const label = CATEGORY_LABELS[category] ?? category;
            for (const item of items) {
                const text = resolveAnswerText(item);
                if (text) lines.push(`• ${label}: ${text}`);
            }
        }
    }

    if (hasCustom) {
        if (hasGrouped) lines.push('');
        lines.push(`${CUSTOM_LABEL}:`);
        for (const item of customAnswers) {
            const text = resolveAnswerText(item);
            if (text) lines.push(`• ${text}`);
        }
    }

    if (!hasGrouped && !hasCustom) {
        return originalDescription.trim();
    }

    const joined = lines.join('\n').trim();
    if (joined.length <= MAX_OUTPUT_LENGTH) return joined;

    // Truncate gracefully on the last newline so we don't cut a bullet mid-line.
    const truncated = joined.slice(0, MAX_OUTPUT_LENGTH);
    const lastNewline = truncated.lastIndexOf('\n');
    return (lastNewline > 0 ? truncated.slice(0, lastNewline) : truncated).trim();
}
