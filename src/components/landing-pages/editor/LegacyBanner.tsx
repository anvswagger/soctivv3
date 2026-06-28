/**
 * LegacyBanner — shown when a landing page row has the legacy Zenon config.
 *
 * Calm, one-action UX: explain why the page needs regeneration, then offer
 * a single primary "Regenerate" button.
 */
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LegacyBannerProps {
    regenerating: boolean;
    disabled: boolean;
    onRegenerate: () => void;
}

export function LegacyBanner({
    regenerating,
    disabled,
    onRegenerate,
}: LegacyBannerProps) {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-brand-dark text-white relative overflow-hidden p-6">
            <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-500/[0.06] rounded-full blur-[120px] pointer-events-none" />

            <button
                type="button"
                onClick={() => navigate('/landing-pages')}
                className="absolute top-5 right-5 sm:top-8 sm:right-8 inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"
            >
                صفحات الهبوط
            </button>

            <div className="relative w-full max-w-lg rounded-3xl border border-amber-500/30 bg-amber-500/[0.04] backdrop-blur-md p-8 sm:p-10 shadow-2xl">
                <div className="flex items-start gap-4">
                    <div className="shrink-0 w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-heading font-bold">هذه صفحة بنمط قديم</h2>
                        <p className="text-sm text-white/70 mt-2 leading-relaxed">
                            النظام الجديد يستخدم نموذج Soctiv الموحد مع Meta Pixel + CAPI مدمج.
                            اضغط الزر أدناه لإعادة التوليد وفق النموذج الجديد.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-6 pt-6 border-t border-amber-500/15">
                    <Button
                        onClick={onRegenerate}
                        disabled={regenerating || disabled}
                        className="gap-2 bg-gradient-to-r from-brand-cyan to-brand-accent hover:from-brand-cyan-light hover:to-brand-cyan text-brand-darker font-bold shadow-glow-cyan"
                    >
                        {regenerating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="h-4 w-4" />
                        )}
                        إعادة التوليد وفق نموذج Soctiv
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/landing-pages')}
                        className="text-white/70 hover:text-white"
                    >
                        العودة
                    </Button>
                </div>
            </div>
        </div>
    );
}
