/**
 * EmptyEditor — the first-run experience when no landing page exists yet.
 *
 * Calm, focused, ONE primary action:
 *   - Centered glass card
 *   - Product name + DNA chip
 *   - Large gradient "Generate with AI" button
 *   - Bullet list (max 5 items) of what gets generated
 *
 * No competing back buttons. No "alternative" actions. One obvious next step.
 */
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Sparkles, Package, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyEditorProps {
    product: {
        id: string;
        name: string;
        nameArabic?: string;
        imageUrl?: string | null;
    } | null;
    /** True when Product DNA was used to seed this page. */
    hasDna: boolean;
    dnaError: boolean;
    productError: boolean;
    /** True while waiting for product + DNA queries. */
    loadingContext: boolean;
    /** True when product is missing OR DNA is missing (show blocked message). */
    blocked: boolean;
    blockedReason?: string;
    generating: boolean;
    onGenerate: () => void;
    onRetry: () => void;
}

export function EmptyEditor({
    product,
    hasDna,
    dnaError,
    productError,
    loadingContext,
    blocked,
    blockedReason,
    generating,
    onGenerate,
    onRetry,
}: EmptyEditorProps) {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-brand-dark text-white relative overflow-hidden p-6">
            {/* Ambient glows — reused from MarketingLanding */}
            <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-cyan opacity-[0.06] rounded-full blur-[120px] pointer-events-none" />
            <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-accent opacity-[0.06] rounded-full blur-[120px] pointer-events-none" />

            {/* Back link — top corner, subtle */}
            <button
                type="button"
                onClick={() => navigate('/landing-pages')}
                className="absolute top-5 right-5 sm:top-8 sm:right-8 inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"
            >
                <ArrowRight className="h-4 w-4" />
                صفحات الهبوط
            </button>

            {/* Main card */}
            <div className="relative w-full max-w-xl">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-8 sm:p-10 shadow-2xl">
                    {/* Product header */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-brand-cyan/10 border border-brand-cyan/30 flex items-center justify-center text-brand-cyan shrink-0">
                            {product?.imageUrl ? (
                                <img
                                    src={product.imageUrl}
                                    alt=""
                                    className="w-10 h-10 rounded-xl object-cover"
                                />
                            ) : (
                                <Package className="h-5 w-5" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs text-white/50 mb-0.5">منتج جديد</p>
                            <h1 className="text-xl sm:text-2xl font-heading font-bold truncate">
                                {product?.nameArabic || product?.name || 'منتج'}
                            </h1>
                        </div>
                    </div>

                    {/* States */}
                    {loadingContext ? (
                        <div className="flex items-center justify-center gap-3 py-12 text-white/70">
                            <Loader2 className="h-5 w-5 animate-spin text-brand-cyan" />
                            <span>جاري تحميل بيانات المنتج…</span>
                        </div>
                    ) : blocked ? (
                        <BlockedState
                            reason={blockedReason}
                            hasDna={hasDna}
                            dnaError={dnaError}
                            productError={productError}
                            onRetry={onRetry}
                            onViewProducts={() => navigate('/products')}
                            onViewLandingPages={() => navigate('/landing-pages')}
                        />
                    ) : (
                        <>
                            {/* Headline */}
                            <div className="space-y-2 mb-6">
                                <h2 className="text-2xl font-heading font-bold leading-tight">
                                    جاهز لإنشاء{' '}
                                    <span className="text-brand-cyan">صفحة الهبوط</span>
                                </h2>
                                <p className="text-white/70 leading-relaxed text-sm">
                                    الذكاء الاصطناعي سيولّد صفحة Soctiv كاملة من Product DNA
                                    الخاص بمنتجك — نص عربي جاهز للنشر.
                                </p>
                            </div>

                            {/* What gets generated */}
                            <ul className="space-y-2 mb-8 text-sm">
                                <Bullet>صفحة RTL عربية بنص مولّد بالذكاء الاصطناعي</Bullet>
                                <Bullet>نموذج طلب بدفع عند الاستلام</Bullet>
                                <Bullet>3 اعتراضات (توصيل، أصالة، فحص قبل الدفع)</Bullet>
                                <Bullet>3 آراء عملاء من مدن ليبية</Bullet>
                                <Bullet>Meta Pixel + Conversion API مدمجان</Bullet>
                            </ul>

                            {/* Primary action — single button */}
                            <Button
                                size="lg"
                                onClick={onGenerate}
                                disabled={generating}
                                className="w-full gap-2 h-12 bg-gradient-to-r from-brand-cyan to-brand-accent hover:from-brand-cyan-light hover:to-brand-cyan text-brand-darker font-extrabold text-base shadow-glow-cyan transform transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        جاري التوليد…
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-5 w-5" />
                                        توليد بالذكاء الاصطناعي
                                    </>
                                )}
                            </Button>

                            <p className="text-[11px] text-white/40 text-center mt-4">
                                ستنتقل تلقائيًا إلى المحرر فور الانتهاء
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function Bullet({ children }: { children: React.ReactNode }) {
    return (
        <li className="flex items-start gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-cyan shrink-0" />
            <span className="text-white/85 leading-relaxed">{children}</span>
        </li>
    );
}

function BlockedState({
    reason,
    hasDna,
    dnaError,
    productError,
    onRetry,
    onViewProducts,
    onViewLandingPages,
}: {
    reason?: string;
    hasDna: boolean;
    dnaError: boolean;
    productError: boolean;
    onRetry: () => void;
    onViewProducts: () => void;
    onViewLandingPages: () => void;
}) {
    const message =
        reason ||
        (dnaError
            ? 'تعذّر تحميل Product DNA. تحقق من الاتصال وأعد المحاولة.'
            : productError
              ? 'تعذّر تحميل بيانات المنتج. تحقق من الاتصال وأعد المحاولة.'
              : !hasDna
                ? 'لم يتم العثور على Product DNA. أنشئ أو أعد توليد DNA لهذا المنتج أولاً.'
                : 'لا يمكن المتابعة. تحقق من المنتج وProduct DNA ثم أعد المحاولة.');

    return (
        <div className="text-center py-6">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
                <Wand2 className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold mb-2">لا يمكن إنشاء الصفحة الآن</h3>
            <p className="text-white/70 text-sm leading-relaxed mb-6">{message}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="outline" size="sm" onClick={onRetry} className="bg-white/5 border-white/10 text-white hover:bg-white/10">
                    إعادة تحميل
                </Button>
                <Button variant="outline" size="sm" onClick={onViewProducts} className="bg-white/5 border-white/10 text-white hover:bg-white/10">
                    المنتجات
                </Button>
                <Button variant="ghost" size="sm" onClick={onViewLandingPages} className="text-white/70 hover:text-white hover:bg-white/5">
                    صفحات الهبوط
                </Button>
            </div>
        </div>
    );
}