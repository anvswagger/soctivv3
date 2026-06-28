/**
 * EmptyLandingPages — first-class empty state for the landing pages list.
 *
 * Replaces the basic `EmptyState` component previously used. Centers a
 * Soctiv icon, headline, subtitle, and a single primary CTA inside a
 * glass card that picks up the brand ambient glow.
 */
import { useNavigate } from 'react-router-dom';
import { LayoutTemplate, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EmptyLandingPages() {
    const navigate = useNavigate();

    return (
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand-dark/40 via-card/60 to-brand-dark/40 p-10 md:p-16">
            {/* Ambient glows */}
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-brand-cyan/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-brand-accent/20 rounded-full blur-[120px] pointer-events-none" />

            <div className="relative flex flex-col items-center text-center max-w-md mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-brand-cyan/10 border border-brand-cyan/30 flex items-center justify-center text-brand-cyan mb-6 shadow-glow-cyan">
                    <LayoutTemplate className="h-8 w-8" />
                </div>

                <h2 className="text-2xl md:text-3xl font-heading font-bold tracking-tight">
                    لا توجد صفحات هبوط بعد
                </h2>
                <p className="text-muted-foreground mt-3 leading-relaxed">
                    ابدأ من Product DNA لمنتجك — الذكاء الاصطناعي سيولّد صفحة Soctiv كاملة
                    بنص عربي، نموذج طلب، اعتراضات، آراء عملاء، Meta Pixel + CAPI.
                </p>

                <Button
                    size="lg"
                    onClick={() => navigate('/products')}
                    className="mt-8 gap-2 bg-gradient-to-r from-brand-cyan to-brand-accent hover:from-brand-cyan-light hover:to-brand-cyan text-brand-darker font-extrabold shadow-glow-cyan transform transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Sparkles className="h-5 w-5" />
                    ابدأ من المنتجات
                </Button>

                <p className="text-xs text-muted-foreground mt-4">
                    افتح منتجًا → راجع Product DNA → اضغط "إنشاء صفحة هبوط"
                </p>
            </div>
        </div>
    );
}
