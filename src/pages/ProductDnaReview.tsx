/**
 * ProductDnaReview — Page for reviewing generated Product DNA.
 * Allows users to trigger generation, view results, and download PDF.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Sparkles, AlertCircle, RotateCcw, ArrowLeft, CheckCircle2, Package, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProductDna } from '@/hooks/useProductDna';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DnaSummaryCard } from '@/components/productDna/DnaSummaryCard';
import { DnaPdfPreview } from '@/components/productDna/DnaPdfPreview';
import type { ProductDNA } from '@/types/productDNA';

const STEP_LABELS: Record<number, { name: string; description: string }> = {
    1: { name: 'استخراج الحقائق الأساسية', description: 'تحليل بيانات المنتج واستخراج المعلومات المنظمة...' },
    2: { name: 'تحليل العميل المثالي', description: 'تحديد ملف العميل المثالي بناءً على حقائق المنتج...' },
    3: { name: 'التوليف التسويقي', description: 'إنشاء الزوايا التسويقية والنصوص والاستراتيجية...' },
};

const STEP_ICONS: Record<number, string> = {
    1: '\u{1F50D}',   // 🔍
    2: '\u{1F9D1}\u200D\u{1F4BB}', // 👨‍💻
    3: '\u{2728}',    // ✨
};

export default function ProductDnaReview() {
    const { productId } = useParams<{ productId: string }>();
    const navigate = useNavigate();
    const { client, user } = useAuth();
    const { toast } = useToast();
    const { isGenerating, progress, dna, error, generate, reset } = useProductDna({ autoSave: false });

    const [productData, setProductData] = useState<Record<string, unknown> | null>(null);
    const [isLoadingProduct, setIsLoadingProduct] = useState(true);
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [generationStarted, setGenerationStarted] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Load product data from Supabase
    useEffect(() => {
        if (!productId) return;

        const loadProduct = async () => {
            setIsLoadingProduct(true);
            try {
                const { data, error: fetchError } = await (supabase as any)
                    .from('products')
                    .select('*')
                    .eq('id', productId)
                    .single();

                if (fetchError) throw new Error(fetchError.message || 'Failed to load product');
                if (data) {
                    setProductData(data as Record<string, unknown>);
                    // Auto-start generation
                    setGenerationStarted(true);
                }
            } catch (err) {
                console.error('Failed to load product:', err);
            } finally {
                setIsLoadingProduct(false);
            }
        };

        loadProduct();
    }, [productId]);

    // Trigger generation when product data is loaded
    useEffect(() => {
        if (productData && !isGenerating && !dna && !error && generationStarted) {
            generate(productData);
        }
    }, [productData, generationStarted]);

    const handleRegenerate = () => {
        reset();
        setShowPdfPreview(false);
        setIsSaved(false);
        setGenerationStarted(true);
    };

    const goBack = () => {
        navigate(-1);
    };

    // Loading state
    if (isLoadingProduct) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-muted-foreground">جاري تحميل بيانات المنتج...</p>
                </div>
            </div>
        );
    }

    // No product found
    if (!productData) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center space-y-4 max-w-md px-6">
                    <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
                    <h2 className="text-xl font-bold text-foreground">المنتج غير موجود</h2>
                    <p className="text-muted-foreground">
                        تعذر تحميل بيانات المنتج. يرجى العودة والمحاولة مرة أخرى.
                    </p>
                    <button
                        onClick={goBack}
                        className="inline-flex items-center gap-2 text-primary hover:underline"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        العودة
                    </button>
                </div>
            </div>
        );
    }

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
                        <h1 className="text-3xl font-bold text-foreground">
                            Product DNA
                        </h1>
                    </div>
                    <p className="text-muted-foreground">
                        تحليل بالذكاء الاصطناعي لـ{' '}
                        <span className="font-semibold text-foreground">
                            {(productData?.name as string) ?? 'منتجك'}
                        </span>
                    </p>
                </div>

                {/* Generation Progress */}
                {isGenerating && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-card border border-border rounded-xl p-8 max-w-lg mx-auto"
                    >
                        <div className="text-center space-y-6">
                            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
                            <div className="space-y-2">
                                <h3 className="text-lg font-semibold text-foreground">
                                    جاري إنشاء Product DNA
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    الذكاء الاصطناعي يحلل منتجك في 3 خطوات...
                                </p>
                            </div>

                            {/* Step indicators */}
                            <div className="space-y-4">
                                {[1, 2, 3].map((step) => {
                                    const isActive = progress?.step === step;
                                    const isComplete = (progress?.step ?? 0) > step;
                                    const isPending = (progress?.step ?? 0) < step;
                                    const stepInfo = STEP_LABELS[step];

                                    return (
                                        <div
                                            key={step}
                                            className={`flex items-center gap-4 p-3 rounded-lg transition-all ${isActive
                                                ? 'bg-primary/10 border border-primary/20'
                                                : isComplete
                                                    ? 'bg-success/5 border border-success/10'
                                                    : 'bg-muted/30 border border-border/50'
                                                }`}
                                        >
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isActive
                                                ? 'bg-primary text-primary-foreground'
                                                : isComplete
                                                    ? 'bg-success text-success-foreground'
                                                    : 'bg-muted text-muted-foreground'
                                                }`}>
                                                {isComplete ? (
                                                    <CheckCircle2 className="w-4 h-4" />
                                                ) : isActive && isGenerating ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            reset();
                                                            setGenerationStarted(false);
                                                            toast({ title: 'تم الإلغاء', description: 'تم إيقاف إنشاء Product DNA' });
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
                                                <p className={`text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'
                                                    }`}>
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
                                {progress?.percentage ?? 0}% complete
                            </p>
                        </div>
                    </motion.div>
                )}

                {/* Error State */}
                {error && !isGenerating && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 max-w-lg mx-auto text-center space-y-4"
                    >
                        <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
                        <h3 className="text-lg font-semibold text-foreground">
                            فشل الإنشاء
                        </h3>
                        <p className="text-sm text-muted-foreground">{error}</p>
                        <div className="flex justify-center gap-3">
                            <button
                                onClick={handleRegenerate}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
                            >
                                <RotateCcw className="w-4 h-4" />
                                إعادة المحاولة
                            </button>
                            <button
                                onClick={goBack}
                                className="inline-flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted transition-colors"
                            >
                                العودة
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* DNA Summary Card */}
                {dna && !isGenerating && (
                    <>
                        <DnaSummaryCard
                            dna={dna}
                            onRegenerate={handleRegenerate}
                            onSave={async () => {
                                const clientId = client?.id || user?.id;
                                if (!clientId) {
                                    toast({ title: 'خطأ', description: 'لم يتم العثور على حساب مصادق. سجّل الدخول أولاً.', variant: 'destructive' });
                                    return;
                                }
                                setIsSaving(true);
                                try {
                                    // Validate product_id is a real UUID (not 'unknown' or garbage)
                                    const isValidUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
                                    const validProductId = dna.productId && isValidUuid(dna.productId) ? dna.productId : null;

                                    const record = {
                                        id: dna.id,
                                        client_id: clientId,
                                        product_id: validProductId,
                                        core_facts: dna.coreFacts,
                                        icp_profile: dna.icpProfile,
                                        marketing_synthesis: dna.marketingSynthesis,
                                        raw_input: dna.rawInput,
                                        generated_at: dna.generatedAt,
                                        version: dna.version,
                                    };

                                    // Use timeout to prevent hanging
                                    const controller = new AbortController();
                                    const timeoutId = setTimeout(() => controller.abort(), 15000);

                                    try {
                                        const { error: saveError } = await supabase
                                            .from('product_dna')
                                            .upsert(record as any, { onConflict: 'id' });

                                        clearTimeout(timeoutId);

                                        if (saveError) {
                                            console.error('Failed to save DNA:', saveError);
                                            toast({ title: 'فشل الحفظ', description: saveError.message || 'حدث خطأ غير معروف', variant: 'destructive' });
                                            return;
                                        }
                                        setIsSaved(true);
                                        toast({ title: 'تم الحفظ', description: 'تم حفظ Product DNA بنجاح' });
                                    } catch (upsertErr) {
                                        clearTimeout(timeoutId);
                                        throw upsertErr;
                                    }
                                } catch (err) {
                                    const msg = err instanceof Error ? err.message : 'حدث خطأ غير معروف';
                                    console.error('Failed to save DNA:', err);
                                    if (err instanceof DOMException && err.name === 'AbortError') {
                                        toast({ title: 'فشل الحفظ', description: 'انتهت المهلة. تحقق من اتصالك بالإنترنت.', variant: 'destructive' });
                                    } else {
                                        toast({ title: 'فشل الحفظ', description: msg, variant: 'destructive' });
                                    }
                                } finally {
                                    setIsSaving(false);
                                }
                            }}
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