/**
 * HeroEditor — hero section fields (headline, subline, CTA, image).
 *
 * Minimal surface: 4 essential inputs. The `imageAlt` field has been
 * dropped — image alt is auto-derived from the product name in the
 * renderer, so the user never needs to touch it.
 */
import { Field, TextareaField } from '../fields';
import type { SoctivLandingConfig } from '@/types/soctivLandingConfig';

export function HeroEditor({
    config,
    onChange,
}: {
    config: SoctivLandingConfig;
    onChange: (next: SoctivLandingConfig) => void;
}) {
    const h = config.hero;
    const set = (patch: Partial<SoctivLandingConfig['hero']>) =>
        onChange({ ...config, hero: { ...h, ...patch } });

    return (
        <>
            <Field
                label="العنوان الرئيسي"
                value={h.headline}
                onChange={(e) => set({ headline: e.target.value })}
            />
            <TextareaField
                label="الوصف"
                value={h.subline}
                onChange={(e) => set({ subline: e.target.value })}
                rows={2}
            />
            <Field
                label="نص زر الطلب"
                value={h.ctaText}
                onChange={(e) => set({ ctaText: e.target.value })}
            />
            <Field
                label="رابط صورة المنتج"
                value={h.imageUrl}
                onChange={(e) => set({ imageUrl: e.target.value })}
                dir="ltr"
            />
        </>
    );
}