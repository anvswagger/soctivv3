/**
 * ProductDnaReview — Page for generating Product DNA from a saved product.
 *
 * Per the new design, the AI questions phase happens ONLY during the initial
 * product onboarding flow. This page reads the saved enhanced description
 * straight from the `products` table and generates DNA from it — no re-asking
 * of questions.
 *
 * Flow:
 *   1. Load product from Supabase (name, image, price, description)
 *   2. Show product summary card with a "Generate DNA" button
 *   3. Run the 3-step DNA generation pipeline from the saved description
 *   4. Show results (collapsible sections)
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Loader2,
    AlertCircle,
    RotateCcw,
    ArrowLeft,
    Package,
    XCircle,
    Sparkles,
    CheckCircle2,
    Tag,
    Image as ImageIcon,
    Dna,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProductDna } from '@/hooks/useProductDna';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DnaSummaryCard } from '@/components/productDna/DnaSummaryCard';
import { DnaPdfPreview } from '@/components/productDna/DnaPdfPreview';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { ProductDNA, OnboardingData } from '@/types/productDNA';

const STEP_LABELS: Record<number, { name: string; description: string }> = {
    1: { name: 'هوية المنتج', description: 'بناء الهوية من المعلومات المقدمة...' },
    2: { name: 'تحليل العميل المستهدف', description: 'تحديد الملف الشخصي للعميل المثالي...' },
    3: { name: 'الاستراتيجية التسويقية', description: 'بناء الزوايا والاستراتيجية التسويقية...' },
};

type PagePhase = 'loading-product' | 'ready' | 'generating' | 'results' | 'error';

interface ProductRecord {
    id: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    return_rate: number | null;
    offer: string | null;
}

export default function ProductDnaReview() {
    const { productId } = useParams<{ productId: string }>();
    const navigate = useNavigate();
    const { client, user } = useAuth();
    const { toast } = useToast();
    const { isGenerating, progress, dna, error, generate, cancel, reset, setDna } = useProductDna({
        autoSave: false,
        // Passing productId lets the hook restore a previously-cached DNA
        // from localStorage on mount, so navigating away and back doesn't
        // wipe the generated result.
        productId,
    });

    const [phase, setPhase] = useState<PagePhase>('loading-product');
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [product, setProduct] = useState<ProductRecord | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    // Tracks whether the restored DNA was loaded from the localStorage cache
    // (so we can show the results without requiring a click).
    const [restoredFromCache, setRestoredFromCache] = useState(false);

    // ─── Load the product from Supabase ────────────────────────────────

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!productId) {
                setLoadError('لم يتم تحديد المنتج');
                setPhase('error');
                return;
            }
            try {
                const { data, error: fetchError } = await supabase
                    .from('products')
                    .select('id, name, description, price, image_url, return_rate, offer')
                    .eq('id', productId)
                    .maybeSingle();

                if (cancelled) return;
                if (fetchError) throw new Error(fetchError.message);
                if (!data) {
                    setLoadError('لم يتم العثور على المنتج');
                    setPhase('error');
                    return;
                }
                setProduct(data as ProductRecord);
                // If the hook already restored a cached DNA for this product,
                // jump straight to the results phase. Otherwise show the
                // "ready" card with the Generate button.
                setPhase(dna ? 'results' : 'ready');
                if (dna) setRestoredFromCache(true);
            } catch (err) {
                if (cancelled) return;
                const msg = err instanceof Error ? err.message : 'فشل تحميل المنتج';
                setLoadError(msg);
                setPhase('error');
            }
        };
        load();
        return () => {
            cancelled = true;
        };
        // We intentionally only run on mount / productId change. The
        // `dna` read inside is for the initial-cache detection only.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productId]);

    // ─── If a cached DNA was restored before the product finished loading,
    //     transition to the results phase as soon as the product is ready.
    useEffect(() => {
        if (product && dna && phase === 'ready' && !isGenerating) {
            setPhase('results');
            setRestoredFromCache(true);
        }
    }, [product, dna, phase, isGenerating]);

    // ─── Handle generation errors ──────────────────────────────────────

    useEffect(() => {
        if (error && phase === 'generating') {
            setPhase('error');
        }
    }, [error, phase]);

    // ─── Generate DNA from saved description ───────────────────────────

    const handleGenerate = useCallback(async () => {
        if (!product) return;
        const description = (product.description ?? '').trim();
        if (!description) {
            toast({
                title: 'لا يوجد وصف',
                description: 'هذا المنتج لا يحتوي على وصف. أضف وصفاً أولاً من صفحة المنتجات.',
                variant: 'destructive',
            });
            return;
        }

        setPhase('generating');
        setRestoredFromCache(false);
        // Synthesize a minimal OnboardingData — the AI pipeline reads
        // productDescription and answers; with no answers, the steps still
        // produce a DNA from the description alone.
        const onboarding: OnboardingData = {
            productDescription: description,
            questions: [],
            answers: [],
            completedAt: new Date().toISOString(),
        };
        const result = await generate(onboarding, productId);
        if (result) {
            setPhase('results');
        } else if (!error) {
            // User cancelled — return to ready state
            setPhase('ready');
        }
    }, [product, productId, generate, error, toast]);

    // ─── Handle regeneration / retry ───────────────────────────────────

    const handleRegenerate = () => {
        reset();
        setShowPdfPreview(false);
        setIsSaved(false);
        setPhase('ready');
    };

    const handleRetry = () => {
        reset();
        setShowPdfPreview(false);
        setIsSaved(false);
        handleGenerate();
    };

    const goBack = () => {
        if (phase === 'generating') {
            cancel();
        }
        navigate(-1);
    };

    // ─── Handle save ───────────────────────────────────────────────────

    const handleSave = async (): Promise<ProductDNA | null> => {
        const clientId = client?.id || user?.id;
        if (!clientId) {
            toast({
                title: 'خطأ',
                description: 'لم يتم العثور على حساب مصادق. سجّل الدخول أولاً.',
                variant: 'destructive',
            });
            return null;
        }
        if (!dna) return null;

        setIsSaving(true);
        try {
            const isValidUuid = (v: string) =>
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
            const validProductId =
                dna.productId && isValidUuid(dna.productId) ? dna.productId : null;

            // The live `product_dna` table has a UNIQUE constraint on
            // product_id (auto-named product_dna_product_id_key), so only
            // one DNA row may exist per product. A fresh `dna.id` from
            // regeneration is a brand-new UUID, and an upsert with
            // onConflict: 'id' would try to INSERT a new row, tripping the
            // unique constraint. Look up the existing row's id first and
            // reuse it so the upsert updates the same row in place.
            let existingId: string | null = null;
            if (validProductId) {
                const { data: existing, error: lookupErr } = await supabase
                    .from('product_dna')
                    .select('id')
                    .eq('product_id', validProductId as any)
                    .maybeSingle();
                if (lookupErr) {
                    console.warn(
                        '[ProductDnaReview] Could not look up existing DNA row:',
                        lookupErr.message
                    );
                } else {
                    existingId = (existing as { id: string } | null)?.id ?? null;
                }
            }

            const record = {
                id: existingId ?? dna.id,
                client_id: clientId,
                product_id: validProductId,
                core_facts: dna.productIdentity,
                icp_profile: dna.targetCustomer,
                marketing_synthesis: dna.marketingStrategy,
                raw_input: dna.onboarding,
                generated_at: dna.generatedAt,
                version: dna.version,
            };

            // Try upsert on product_id first (the unique constraint that
            // actually exists in the live DB). If PostgREST doesn't know
            // about that constraint on the project's schema cache, fall
            // back to onConflict: 'id' — which works once we've already
            // resolved the existing id above.
            let saveResult = await supabase
                .from('product_dna')
                .upsert(record as any, { onConflict: 'product_id' });

            if (saveResult.error && /onconflict|conflict target/i.test(saveResult.error.message)) {
                console.warn(
                    '[ProductDnaReview] onConflict: product_id not accepted, falling back to onConflict: id:',
                    saveResult.error.message
                );
                saveResult = await supabase
                    .from('product_dna')
                    .upsert(record as any, { onConflict: 'id' });
            }

            const saveError = saveResult.error;
            if (saveError) {
                console.error('Failed to save DNA:', saveError);
                toast({
                    title: 'فشل الحفظ',
                    description: saveError.message || 'حدث خطأ غير معروف',
                    variant: 'destructive',
                });
                return null;
            }

            // ── Re-fetch the row so we know the real DB-assigned id ─────
            // The upsert may have replaced `id: undefined` with a fresh
            // gen_random_uuid() value. Without this fetch, downstream
            // consumers (e.g. "open landing page") would navigate with a
            // stale id and trip a foreign-key violation.
            let savedId: string | null = (existingId ?? dna.id) ?? null;
            const candidateId = existingId ?? dna.id;
            if (candidateId && isValidUuid(candidateId)) {
                const { data: byId, error: fetchByIdError } = await supabase
                    .from('product_dna')
                    .select('id')
                    .eq('id', candidateId)
                    .maybeSingle();
                if (fetchByIdError) {
                    console.warn('Failed to verify saved DNA by id:', fetchByIdError);
                } else if (byId?.id) {
                    savedId = byId.id;
                }
            } else {
                // No id yet — find the most recent record for this product+client.
                const { data: byProduct, error: fetchByProductError } = await supabase
                    .from('product_dna')
                    .select('id, generated_at, created_at')
                    .eq('client_id', clientId)
                    .eq('product_id', validProductId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (fetchByProductError) {
                    console.warn('Failed to look up saved DNA by product:', fetchByProductError);
                } else if (byProduct?.id) {
                    savedId = byProduct.id;
                }
            }

            if (savedId && savedId !== dna.id) {
                // Update hook state + localStorage cache with the real id.
                const updated: ProductDNA = { ...dna, id: savedId };
                setDna(updated);
            }

            setIsSaved(true);
            toast({ title: 'تم الحفظ', description: 'تم حفظ Product DNA بنجاح' });
            return savedId ? { ...dna, id: savedId } : dna;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'حدث خطأ غير معروف';
            console.error('Failed to save DNA:', err);
            toast({ title: 'فشل الحفظ', description: msg, variant: 'destructive' });
            return null;
        } finally {
            setIsSaving(false);
        }
    };

    // ═══ RENDER ═══════════════════════════════════════════════════════════

    return (
        <div className="min-h-screen bg-background" dir="rtl">
            <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
                {/* Back button */}
                <button
                    onClick={goBack}
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    عودة
                </button>

                {/* Header */}
                <div className="text-center space-y-3">
                    <div className="flex items-center justify-center gap-2">
                        <Package className="w-6 h-6 text-primary" />
                        <h1 className="text-3xl font-bold text-foreground">Product DNA</h1>
                    </div>
                    <p className="text-muted-foreground text-sm">
                        تحليل بالذكاء الاصطناعي لمنتجك — بناءً على المعلومات المحفوظة
                    </p>
                </div>

                {/* ═══ Phase: Loading Product ═══ */}
                {phase === 'loading-product' && (
                    <Card className="p-8 max-w-lg mx-auto flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">جاري تحميل بيانات المنتج…</p>
                    </Card>
                )}

                {/* ═══ Phase: Ready (show product + generate button) ═══ */}
                {phase === 'ready' && product && (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-2xl mx-auto space-y-5"
                    >
                        <Card className="p-6 space-y-5 shadow-sm">
                            <div className="flex items-start gap-4">
                                {product.image_url ? (
                                    <img
                                        src={product.image_url}
                                        alt={product.name}
                                        className="w-20 h-20 rounded-xl object-cover border border-border shrink-0"
                                    />
                                ) : (
                                    <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center shrink-0">
                                        <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-xl font-bold text-foreground truncate">
                                        {product.name}
                                    </h2>
                                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                        <Tag className="w-3.5 h-3.5" />
                                        <span>{Number(product.price || 0).toLocaleString()} د.ل</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    وصف المنتج
                                </h3>
                                {product.description?.trim() ? (
                                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                                        {product.description}
                                    </p>
                                ) : (
                                    <p className="text-sm text-muted-foreground italic">
                                        لا يوجد وصف محفوظ. أضف وصفاً للمنتج أولاً من صفحة المنتجات لتوليد DNA.
                                    </p>
                                )}
                            </div>
                        </Card>

                        <div className="flex flex-col items-center gap-3">
                            <Button
                                onClick={handleGenerate}
                                disabled={!product.description?.trim()}
                                size="lg"
                                className="gap-2 px-8"
                            >
                                <Dna className="w-4 h-4" />
                                توليد Product DNA
                            </Button>
                            <p className="text-xs text-muted-foreground text-center max-w-md">
                                سيتم تحليل الوصف على ثلاث مراحل: هوية المنتج، العميل المستهدف، الاستراتيجية التسويقية.
                            </p>
                        </div>
                    </motion.div>
                )}

                {/* ═══ Phase: Generating ═══ */}
                {phase === 'generating' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-card border border-border rounded-xl p-8 max-w-lg mx-auto"
                    >
                        <div className="text-center space-y-6">
                            <div className="relative inline-flex">
                                <Sparkles className="w-10 h-10 text-primary animate-pulse" />
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-lg font-semibold text-foreground">
                                    جاري إنشاء Product DNA
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    الذكاء الاصطناعي يحلل منتجك بناءً على المعلومات المحفوظة...
                                </p>
                            </div>

                            {/* Step indicators */}
                            <div className="space-y-3">
                                {[1, 2, 3].map((step) => {
                                    const isActive = progress?.step === step;
                                    const isComplete = (progress?.step ?? 0) > step;
                                    const stepInfo = STEP_LABELS[step];

                                    return (
                                        <div
                                            key={step}
                                            className={`flex items-center gap-4 p-3 rounded-lg transition-all ${isActive
                                                    ? 'bg-primary/10 border border-primary/20'
                                                    : isComplete
                                                        ? 'bg-green-50 border border-green-100'
                                                        : 'bg-muted/30 border border-border/50'
                                                }`}
                                        >
                                            <div
                                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isActive
                                                        ? 'bg-primary text-primary-foreground'
                                                        : isComplete
                                                            ? 'bg-green-500 text-white'
                                                            : 'bg-muted text-muted-foreground'
                                                    }`}
                                            >
                                                {isComplete ? (
                                                    <CheckCircle2 className="w-4 h-4" />
                                                ) : isActive ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            cancel();
                                                            setPhase('ready');
                                                            toast({
                                                                title: 'تم الإلغاء',
                                                                description: 'تم إيقاف إنشاء Product DNA',
                                                            });
                                                        }}
                                                        className="inline-flex items-center gap-1 text-[10px] font-bold bg-white/20 hover:bg-white/30 text-current px-1 rounded"
                                                        aria-label={`إلغاء الخطوة ${step}`}
                                                    >
                                                        <XCircle className="w-3.5 h-3.5" />
                                                        إلغاء
                                                    </button>
                                                ) : (
                                                    step
                                                )}
                                            </div>
                                            <div className="flex-1 text-right">
                                                <p
                                                    className={`text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'
                                                        }`}
                                                >
                                                    {stepInfo.name}
                                                </p>
                                                {isActive && (
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {stepInfo.description}
                                                    </p>
                                                )}
                                            </div>
                                            {isActive && (
                                                <div className="w-4 h-4 rounded-full bg-primary animate-pulse" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress?.percentage ?? 0}%` }}
                                    className="bg-primary h-full rounded-full"
                                    transition={{ duration: 0.5 }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {progress?.percentage ?? 0}% مكتمل
                            </p>
                        </div>
                    </motion.div>
                )}

                {/* ═══ Phase: Error ═══ */}
                {phase === 'error' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 max-w-lg mx-auto text-center space-y-4"
                    >
                        <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
                        <h3 className="text-lg font-semibold text-foreground">
                            {loadError ? 'فشل التحميل' : 'فشل الإنشاء'}
                        </h3>
                        <p className="text-sm text-muted-foreground">{loadError ?? error}</p>
                        <div className="flex justify-center gap-3">
                            {!loadError && (
                                <button
                                    onClick={handleRetry}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    إعادة المحاولة
                                </button>
                            )}
                            <button
                                onClick={() => navigate('/products')}
                                className="inline-flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted transition-colors text-sm"
                            >
                                العودة للمنتجات
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* ═══ Phase: Results ═══ */}
                {phase === 'results' && dna && (
                    <>
                        {restoredFromCache && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="max-w-2xl mx-auto flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>تم استعادة آخر DNA محفوظ لهذا المنتج. اضغط "إعادة إنشاء" لتوليد DNA جديد.</span>
                            </motion.div>
                        )}
                        <DnaSummaryCard
                            dna={dna}
                            onRegenerate={handleRegenerate}
                            onSave={handleSave}
                            isSaved={isSaved}
                        />

                        {/* Toggle PDF preview */}
                        <div className="text-center">
                            <button
                                onClick={() => setShowPdfPreview(!showPdfPreview)}
                                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                                {showPdfPreview ? 'إخفاء معاينة PDF' : 'عرض معاينة PDF'}
                            </button>
                        </div>

                        {showPdfPreview && (
                            <DnaPdfPreview
                                dna={dna}
                                onClose={() => setShowPdfPreview(false)}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
