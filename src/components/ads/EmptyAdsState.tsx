/**
 * Empty states for the Ad Builder.
 *
 * - `no-product-selected`: when the user hasn't picked a product yet (rare —
 *   the page pre-selects when productId is in the URL).
 * - `no-dna-yet`: when the picked product doesn't have a generated DNA yet.
 *   CTA routes to /dna-review/{productId}.
 * - `no-ads-yet`: when the user has switched to Library tab and nothing exists.
 */
import { Link } from 'react-router-dom';
import { Dna, Sparkles, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';

interface BaseProps {
    className?: string;
}

interface NoProductSelectedProps extends BaseProps {}

export function EmptyAdsNoProductSelected({ className }: NoProductSelectedProps) {
    return (
        <EmptyState
            icon={Sparkles}
            title="اختر منتجاً"
            description="اختر منتجاً من القائمة أعلاه لتوليد إعلان جديد."
            className={className}
        />
    );
}

interface NoDnaYetProps extends BaseProps {
    productId: string;
}

export function EmptyAdsNoDna({ productId, className }: NoDnaYetProps) {
    return (
        <EmptyState
            icon={Dna}
            title="أنشئ حمضاً نووياً أولاً"
            description="لا يوجد Product DNA لهذا المنتج بعد. أنشئ واحداً ثم ارجع لتوليد الإعلانات."
            action={
                <Button asChild>
                    <Link to={`/dna-review/${productId}`}>
                        <Dna className="ml-2 h-4 w-4" />
                        إنشاء الحمض النووي
                    </Link>
                </Button>
            }
            className={className}
        />
    );
}

interface NoAdsYetProps extends BaseProps {
    onStartCreating?: () => void;
}

export function EmptyAdsLibrary({ onStartCreating, className }: NoAdsYetProps) {
    return (
        <EmptyState
            icon={BookOpen}
            title="لا توجد إعلانات بعد"
            description="لم يحفظ هذا المنتج أي إعلان بعد. أنشئ واحداً من تبويب 'إنشاء إعلان'."
            action={
                onStartCreating ? (
                    <Button onClick={onStartCreating}>
                        <Sparkles className="ml-2 h-4 w-4" />
                        ابدأ بإنشاء إعلان
                    </Button>
                ) : undefined
            }
            className={className}
        />
    );
}