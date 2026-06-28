/**
 * ProductOnboarding — Smart onboarding wizard for Product DNA.
 *
 * Flow:
 *   1. AI generates 4–10 smart MCQs based on the product description
 *   2. User answers each question — either by picking an MCQ option OR by
 *      typing a custom free-text answer (or skipping entirely)
 *   3. On complete, onboarding data is ready for DNA generation / enhancement
 *
 * UX highlights:
 *   - Big, tappable option cards
 *   - "Type your own answer" textarea below every question
 *   - "Skip question" link — record an empty answer and move on
 *   - Keyboard support: Enter to advance, 1–9 to pick an option
 *   - Engaging loading state with a pulsing brand mark
 *   - Smoother transitions and micro-animations
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageSquare,
    Loader2,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    Send,
    RotateCcw,
    AlertCircle,
    PencilLine,
    Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateSmartQuestions } from '@/services/productDnaService';
import type { GeneratedQuestion, OnboardingAnswer, OnboardingData } from '@/types/productDNA';

interface ProductOnboardingProps {
    /** Called when onboarding is complete with all data */
    onComplete: (onboarding: OnboardingData) => void;
    /** Whether the parent is currently generating DNA (disables inputs) */
    isGenerating?: boolean;
    /**
     * Pre-supplied product description. When provided, the textarea step is
     * skipped and the wizard auto-fetches questions on mount.
     */
    initialDescription?: string;
    /**
     * Product name — passed to the AI as additional context when generating
     * questions (no effect on the UI).
     */
    productName?: string;
    /**
     * Optional minimum length for the description textarea (default 10).
     * Useful when the parent already enforces stricter validation.
     */
    minDescriptionLength?: number;
    /**
     * When true, the "review answers" step is skipped and `onComplete` is fired
     * immediately after the last question is answered. Use this when the parent
     * does its own commit (e.g. real product onboarding).
     */
    autoCommit?: boolean;
    /**
     * When provided, a "Skip" button is rendered that calls this callback
     * without going through the question phase. Use to let the user opt out of
     * the AI enhancement step.
     */
    onSkip?: () => void;
    /**
     * When provided, a "Save & continue later" button is shown that calls
     * this callback with the partial onboarding data (questions + answers so
     * far) so the parent can persist it in its draft store.
     */
    onSaveProgress?: (partial: Pick<OnboardingData, 'questions' | 'answers'>) => void;
}

type WizardPhase = 'loading-questions' | 'answering' | 'confirming' | 'done';

const CATEGORY_LABELS: Record<string, string> = {
    ingredients: 'المكونات',
    use_case: 'الاستخدام',
    format: 'الشكل',
    target: 'الفئة المستهدفة',
    price_range: 'نطاق السعر',
    differentiator: 'ما يميزه',
    other: 'معلومة إضافية',
};

const smoothTransition = {
    type: 'tween' as const,
    duration: 0.28,
    ease: 'easeOut' as const,
};

export function ProductOnboarding({
    onComplete,
    isGenerating,
    initialDescription,
    productName,
    minDescriptionLength = 10,
    autoCommit = false,
    onSkip,
    onSaveProgress,
}: ProductOnboardingProps) {
    const hasInitialDescription = !!(initialDescription && initialDescription.trim().length >= minDescriptionLength);

    // Phase 2: Questions
    const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<OnboardingAnswer[]>([]);
    // Custom free-text per question, keyed by questionId.
    const [customTexts, setCustomTexts] = useState<Record<string, string>>({});

    // UI state
    const [phase, setPhase] = useState<WizardPhase>(
        hasInitialDescription ? 'loading-questions' : 'loading-questions'
    );
    const [error, setError] = useState<string | null>(null);
    const [abortController, setAbortController] = useState<AbortController | null>(null);

    // Latest ref of answers for use inside async callbacks (avoid stale closure).
    const answersRef = useRef<OnboardingAnswer[]>([]);
    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);

    // ─── Auto-fetch questions when an initial description is provided ───

    useEffect(() => {
        // Safety: if the wizard is opened without a description (e.g. parent
        // forwards a draft, or the user skipped the description step), don't
        // silently spin forever — surface a friendly message and stop fetching.
        if (!hasInitialDescription) {
            setError('أضف وصفًا للمنتج أولاً حتى نتمكن من إنشاء أسئلة مخصصة.');
            return;
        }
        let cancelled = false;
        const controller = new AbortController();
        setAbortController(controller);
        setError(null);

        (async () => {
            try {
                const generatedQuestions = await generateSmartQuestions(initialDescription!.trim(), {
                    signal: controller.signal,
                    context: productName ? { productName } : undefined,
                });
                if (cancelled) return;
                setQuestions(generatedQuestions);
                setCurrentQuestionIndex(0);
                setAnswers([]);
                setCustomTexts({});
                setPhase('answering');
            } catch (err) {
                if (cancelled) return;
                if (err instanceof DOMException && err.name === 'AbortError') {
                    return;
                }
                const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء إنشاء الأسئلة';
                setError(msg);
            } finally {
                if (!cancelled) setAbortController(null);
            }
        })();

        return () => {
            cancelled = true;
            controller.abort();
        };
        // We intentionally only run on mount when initialDescription is provided.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── Answer persistence helpers ─────────────────────────────────────

    const recordAnswer = useCallback(
        (
            questionId: string,
            category: string,
            optionId: string,
            optionLabel: string,
            customText: string | undefined
        ): OnboardingAnswer => {
            const answer: OnboardingAnswer = {
                questionId,
                category,
                selectedOptionId: optionId,
                selectedLabel: optionLabel,
                customText: customText?.trim() ? customText.trim() : undefined,
                answeredAt: new Date().toISOString(),
            };
            setAnswers((prev) => {
                const filtered = prev.filter((a) => a.questionId !== questionId);
                return [...filtered, answer];
            });
            return answer;
        },
        []
    );

    // ─── Step 2: Answer a question ──────────────────────────────────────

    const handleSelectOption = useCallback(
        (questionId: string, optionId: string, optionLabel: string, category: string) => {
            // Picking an MCQ option clears any custom text the user had typed.
            setCustomTexts((prev) => {
                if (!prev[questionId]) return prev;
                const { [questionId]: _drop, ...rest } = prev;
                return rest;
            });
            recordAnswer(questionId, category, optionId, optionLabel, undefined);

            // Auto-advance after a short delay
            setTimeout(() => {
                if (currentQuestionIndex < questions.length - 1) {
                    setCurrentQuestionIndex((i) => i + 1);
                } else {
                    if (autoCommit) {
                        // Build the final answers list (we just replaced the entry for `questionId`).
                        const finalAnswers = [
                            ...answersRef.current.filter((a) => a.questionId !== questionId),
                            {
                                questionId,
                                category,
                                selectedOptionId: optionId,
                                selectedLabel: optionLabel,
                                customText: undefined,
                                answeredAt: new Date().toISOString(),
                            },
                        ];
                        const onboarding: OnboardingData = {
                            productDescription: (initialDescription ?? '').trim(),
                            questions,
                            answers: finalAnswers,
                            completedAt: new Date().toISOString(),
                        };
                        setPhase('done');
                        onComplete(onboarding);
                    } else {
                        setPhase('confirming');
                    }
                }
            }, 280);
        },
        [autoCommit, currentQuestionIndex, questions, initialDescription, onComplete, recordAnswer]
    );

    const handleCustomAnswerSubmit = useCallback(
        (questionId: string, category: string) => {
            const text = (customTexts[questionId] ?? '').trim();
            if (!text) return;
            recordAnswer(questionId, category, '', '', text);
            setTimeout(() => {
                if (currentQuestionIndex < questions.length - 1) {
                    setCurrentQuestionIndex((i) => i + 1);
                } else {
                    if (autoCommit) {
                        const finalAnswers = [
                            ...answersRef.current.filter((a) => a.questionId !== questionId),
                            {
                                questionId,
                                category,
                                selectedOptionId: '',
                                selectedLabel: '',
                                customText: text,
                                answeredAt: new Date().toISOString(),
                            },
                        ];
                        const onboarding: OnboardingData = {
                            productDescription: (initialDescription ?? '').trim(),
                            questions,
                            answers: finalAnswers,
                            completedAt: new Date().toISOString(),
                        };
                        setPhase('done');
                        onComplete(onboarding);
                    } else {
                        setPhase('confirming');
                    }
                }
            }, 280);
        },
        [
            autoCommit,
            currentQuestionIndex,
            customTexts,
            initialDescription,
            onComplete,
            questions,
            recordAnswer,
        ]
    );

    // ─── Navigation ─────────────────────────────────────────────────────

    const goToQuestion = (index: number) => {
        if (index >= 0 && index < questions.length) {
            setCurrentQuestionIndex(index);
            setPhase('answering');
        }
    };

    const handleConfirm = () => {
        const onboarding: OnboardingData = {
            productDescription: (initialDescription ?? '').trim(),
            questions,
            answers,
            completedAt: new Date().toISOString(),
        };
        onComplete(onboarding);
    };

    const handleStartOver = () => {
        if (abortController) abortController.abort();
        setQuestions([]);
        setAnswers([]);
        setCustomTexts({});
        setCurrentQuestionIndex(0);
        setPhase('loading-questions');
        setError(null);
    };

    const handleEditAnswers = () => {
        setCurrentQuestionIndex(0);
        setPhase('answering');
    };

    // ─── Current question state ─────────────────────────────────────────

    const currentQuestion = questions[currentQuestionIndex];
    const currentAnswer = answers.find((a) => a.questionId === currentQuestion?.id);
    const allAnswered = questions.length > 0 && answers.length === questions.length;
    const answeredCount = answers.length;
    const hasCustomText = !!(currentQuestion && (customTexts[currentQuestion.id] ?? '').trim());

    // ─── Keyboard support ───────────────────────────────────────────────

    useEffect(() => {
        if (phase !== 'answering' || !currentQuestion) return;
        const handler = (e: KeyboardEvent) => {
            // Ignore when typing in an input/textarea (except Escape).
            const target = e.target as HTMLElement;
            const isEditing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
            if (isEditing) {
                if (e.key === 'Escape' && (target as HTMLInputElement).blur) {
                    (target as HTMLInputElement).blur();
                }
                return;
            }
            const optionKeys: Record<string, number> = {
                '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7, '9': 8,
            };
            if (e.key in optionKeys) {
                const idx = optionKeys[e.key];
                const opt = currentQuestion.options[idx];
                if (opt) {
                    e.preventDefault();
                    handleSelectOption(currentQuestion.id, opt.id, opt.label, currentQuestion.category);
                }
                return;
            }
            if (e.key === 'Enter' && currentAnswer) {
                e.preventDefault();
                if (currentQuestionIndex < questions.length - 1) {
                    setCurrentQuestionIndex((i) => i + 1);
                } else if (allAnswered) {
                    setPhase('confirming');
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [phase, currentQuestion, currentAnswer, allAnswered, currentQuestionIndex, questions.length, handleSelectOption]);

    // ─── RENDER ─────────────────────────────────────────────────────────

    return (
        <div className="w-full max-w-2xl mx-auto" dir="rtl">
            <AnimatePresence mode="wait">
                {/* ═══ Phase: Loading Questions ═══ */}
                {phase === 'loading-questions' && (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={smoothTransition}
                        className="flex flex-col items-center justify-center py-14 space-y-6"
                    >
                        <div className="relative">
                            <div className="absolute inset-0 w-14 h-14 rounded-2xl bg-primary/20 animate-ping" />
                            <div className="relative w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <Sparkles className="w-7 h-7 text-primary animate-pulse" />
                            </div>
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="text-lg font-semibold text-foreground">جاري تحليل وصف المنتج...</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                                الذكاء الاصطناعي يقرأ وصفك ويصمّم أسئلة محددة ومفيدة لمنتجك.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>عادةً يستغرق أقل من ١٠ ثوانٍ</span>
                        </div>

                        {error && (
                            <div className="w-full max-w-sm flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span className="leading-relaxed">{error}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleStartOver}
                                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                إعادة المحاولة
                            </button>
                            {onSkip && (
                                <>
                                    <span className="text-muted-foreground/40">•</span>
                                    <button
                                        onClick={onSkip}
                                        disabled={isGenerating}
                                        className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                                    >
                                        تخطي هذه الخطوة
                                    </button>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* ═══ Phase: Answering Questions ═══ */}
                {phase === 'answering' && currentQuestion && (
                    <motion.div
                        key={`question-${currentQuestionIndex}`}
                        initial={{ opacity: 0, x: -24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 24 }}
                        transition={smoothTransition}
                        className="space-y-5"
                    >
                        {/* Progress bar */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>
                                    السؤال {currentQuestionIndex + 1} من {questions.length}
                                </span>
                                <span>
                                    {answeredCount}/{questions.length} تم الإجابة
                                </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                <motion.div
                                    className="bg-gradient-to-l from-primary to-primary/70 h-full rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{
                                        width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
                                    }}
                                    transition={{ duration: 0.4, ease: 'easeOut' }}
                                />
                            </div>
                        </div>

                        {/* Question card */}
                        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm">
                            {/* Category pill */}
                            <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                                    <MessageSquare className="w-3 h-3" />
                                    {CATEGORY_LABELS[currentQuestion.category] ?? 'سؤال'}
                                </span>
                                {currentAnswer && (
                                    <motion.span
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full"
                                    >
                                        <CheckCircle2 className="w-3 h-3" />
                                        تم
                                    </motion.span>
                                )}
                            </div>

                            {/* Question text */}
                            <h3 className="text-lg sm:text-xl font-semibold text-foreground leading-relaxed">
                                {currentQuestion.question}
                            </h3>

                            {/* Options */}
                            <div className="space-y-2.5">
                                {currentQuestion.options.map((option, idx) => {
                                    const isSelected = currentAnswer?.selectedOptionId === option.id && !currentAnswer?.customText;
                                    return (
                                        <motion.button
                                            key={option.id}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ ...smoothTransition, delay: idx * 0.04 }}
                                            onClick={() =>
                                                handleSelectOption(
                                                    currentQuestion.id,
                                                    option.id,
                                                    option.label,
                                                    currentQuestion.category
                                                )
                                            }
                                            className={cn(
                                                'group w-full text-right px-4 py-3.5 rounded-xl border-2 text-sm font-medium transition-all relative overflow-hidden',
                                                isSelected
                                                    ? 'border-primary bg-primary/5 text-primary shadow-sm'
                                                    : 'border-border bg-card text-foreground hover:bg-muted/40 hover:border-primary/40'
                                            )}
                                        >
                                            <div className="flex items-center gap-3 relative z-10">
                                                <div
                                                    className={cn(
                                                        'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                                                        isSelected
                                                            ? 'border-primary bg-primary'
                                                            : 'border-muted-foreground/30 group-hover:border-primary/50'
                                                    )}
                                                >
                                                    {isSelected && (
                                                        <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                                                    )}
                                                </div>
                                                <span className="leading-relaxed flex-1">{option.label}</span>
                                                <span className="text-[10px] text-muted-foreground/60 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {idx + 1}
                                                </span>
                                            </div>
                                        </motion.button>
                                    );
                                })}
                            </div>

                            {/* Divider with "or" */}
                            <div className="flex items-center gap-3 pt-1">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                                    أو
                                </span>
                                <div className="flex-1 h-px bg-border" />
                            </div>

                            {/* Custom answer textarea */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                    <PencilLine className="w-3.5 h-3.5" />
                                    اكتب إجابتك بنفسك
                                </label>
                                <div className="flex gap-2">
                                    <textarea
                                        value={customTexts[currentQuestion.id] ?? ''}
                                        onChange={(e) =>
                                            setCustomTexts((prev) => ({
                                                ...prev,
                                                [currentQuestion.id]: e.target.value,
                                            }))
                                        }
                                        placeholder="اكتب هنا إجابتك المخصّصة... (اختياري)"
                                        className="flex-1 min-h-[64px] max-h-32 px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all leading-relaxed"
                                        maxLength={300}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-muted-foreground/70">
                                        {(customTexts[currentQuestion.id] ?? '').length}/300
                                    </span>
                                    <button
                                        onClick={() =>
                                            handleCustomAnswerSubmit(
                                                currentQuestion.id,
                                                currentQuestion.category
                                            )
                                        }
                                        disabled={!hasCustomText}
                                        className="text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-1"
                                    >
                                        <Send className="w-3 h-3" />
                                        إرسال الإجابة
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Navigation */}
                        <div className="flex items-center justify-between gap-2">
                            <button
                                onClick={() => {
                                    if (currentQuestionIndex > 0) {
                                        setCurrentQuestionIndex((i) => i - 1);
                                    }
                                }}
                                disabled={currentQuestionIndex === 0}
                                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-4 h-4" />
                                السابق
                            </button>

                            {/* Question dots */}
                            <div className="flex items-center gap-1.5">
                                {questions.map((q, i) => {
                                    const answered = answers.some((a) => a.questionId === q.id);
                                    const active = i === currentQuestionIndex;
                                    return (
                                        <button
                                            key={q.id}
                                            onClick={() => goToQuestion(i)}
                                            aria-label={`الانتقال إلى السؤال ${i + 1}`}
                                            className={cn(
                                                'w-2.5 h-2.5 rounded-full transition-all',
                                                active
                                                    ? 'bg-primary scale-125'
                                                    : answered
                                                        ? 'bg-primary/50'
                                                        : 'bg-muted'
                                            )}
                                        />
                                    );
                                })}
                            </div>

                            {currentQuestionIndex < questions.length - 1 ? (
                                <button
                                    onClick={() => {
                                        if (currentAnswer) {
                                            setCurrentQuestionIndex((i) => i + 1);
                                        }
                                    }}
                                    disabled={!currentAnswer}
                                    className="flex items-center gap-1 text-sm text-primary font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                                >
                                    التالي
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (allAnswered) setPhase('confirming');
                                    }}
                                    disabled={!allAnswered}
                                    className="flex items-center gap-1 text-sm text-primary font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                                >
                                    مراجعة
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Secondary skip actions removed per feedback */}
                    </motion.div>
                )}

                {/* ═══ Phase: Confirming Answers ═══ */}
                {phase === 'confirming' && (
                    <motion.div
                        key="confirming"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        transition={smoothTransition}
                        className="space-y-5"
                    >
                        <div className="text-center space-y-2">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-green-500/10">
                                <CheckCircle2 className="w-6 h-6 text-green-600" />
                            </div>
                            <h2 className="text-xl font-bold text-foreground">راجع إجاباتك</h2>
                            <p className="text-muted-foreground text-sm max-w-md mx-auto">
                                اضغط على أي سؤال لتعديل إجابته، ثم أكّد لإنشاء الوصف المحسّن.
                            </p>
                        </div>

                        {/* Answers summary */}
                        <div className="space-y-2">
                            {questions.map((q, i) => {
                                const answer = answers.find((a) => a.questionId === q.id);
                                const displayText = answer?.customText?.trim()
                                    || answer?.selectedLabel
                                    || null;
                                return (
                                    <button
                                        key={q.id}
                                        onClick={() => goToQuestion(i)}
                                        className="w-full bg-card border border-border rounded-xl p-3.5 flex items-center justify-between gap-4 hover:bg-muted/30 hover:border-primary/30 transition-all text-right"
                                    >
                                        <div className="flex-1 min-w-0 text-right">
                                            <p className="text-[11px] text-muted-foreground mb-0.5 line-clamp-1">
                                                {CATEGORY_LABELS[q.category] ?? 'سؤال'}
                                            </p>
                                            <p className="text-sm font-medium text-foreground truncate">
                                                {displayText ?? (
                                                    <span className="text-muted-foreground italic font-normal">
                                                        لم تتم الإجابة
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        {answer?.customText?.trim() ? (
                                            <span className="shrink-0 text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                                إجابة مخصّصة
                                            </span>
                                        ) : null}
                                        <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                                    </button>
                                );
                            })}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                            <Button
                                variant="outline"
                                onClick={handleEditAnswers}
                                className="flex-1"
                            >
                                تعديل الإجابات
                            </Button>
                            <Button
                                onClick={handleConfirm}
                                disabled={isGenerating}
                                className="flex-1 gap-2"
                            >
                                <Send className="w-4 h-4" />
                                إنشاء Product DNA
                            </Button>
                        </div>

                        <button
                            onClick={handleStartOver}
                            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            البدء من جديد
                        </button>
                    </motion.div>
                )}

                {/* ═══ Phase: Done (auto-commit mode) ═══ */}
                {phase === 'done' && (
                    <motion.div
                        key="done"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center py-10 space-y-3"
                    >
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-green-500/10">
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">تم استخراج التفاصيل</h3>
                        <p className="text-sm text-muted-foreground">يتم الآن استخدام الإجابات لتحسين وصف المنتج…</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Local Button to avoid changing the project's import path. Mirrors the
// shadcn Button API (variant + className). Kept tiny on purpose.
function Button({
    children,
    onClick,
    disabled,
    variant = 'default',
    className,
}: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: 'default' | 'outline';
    className?: string;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-opacity disabled:opacity-40 disabled:cursor-not-allowed',
                variant === 'outline'
                    ? 'border border-border text-foreground hover:bg-muted'
                    : 'bg-primary text-primary-foreground hover:opacity-90',
                className
            )}
        >
            {children}
        </button>
    );
}
